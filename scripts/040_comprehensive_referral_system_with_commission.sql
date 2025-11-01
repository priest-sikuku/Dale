-- Comprehensive Referral System with 1.5% Transaction Commission
-- This script creates enhanced referral tracking and commission calculations

-- 1. Create enhanced referral_commissions table if not exists (already exists, we'll just ensure it's correct)
-- The table tracks all commission earnings from referrals

-- 2. Create a function to automatically generate 5 unique alphanumeric referral codes
CREATE OR REPLACE FUNCTION generate_referral_codes(user_id UUID)
RETURNS TABLE(code TEXT) AS $$
DECLARE
  codes TEXT[];
  code TEXT;
  i INT := 0;
BEGIN
  -- Generate 5 unique alphanumeric codes
  WHILE i < 5 LOOP
    -- Generate random 8-character alphanumeric code
    code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT || NOW()::TEXT || i::TEXT) FROM 1 FOR 8));
    
    -- Check if code is unique
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE referral_code = code) THEN
      codes[i + 1] := code;
      i := i + 1;
    END IF;
  END LOOP;
  
  RETURN QUERY SELECT unnest(codes);
END;
$$ LANGUAGE plpgsql;

-- 3. Create function to calculate and award 1.5% commission from downline transactions
CREATE OR REPLACE FUNCTION calculate_referral_commissions()
RETURNS void AS $$
DECLARE
  transaction_record RECORD;
  referrer_id UUID;
  commission_amount NUMERIC;
BEGIN
  -- Loop through all P2P trade transactions
  FOR transaction_record IN 
    SELECT 
      pt.id,
      pt.seller_id,
      (pt.gx_amount * pa.price_per_gx) as trade_value,
      r.referrer_id
    FROM p2p_trades pt
    JOIN p2p_ads pa ON pt.ad_id = pa.id
    JOIN referrals r ON r.referred_id = pt.seller_id
    WHERE pt.status = 'completed'
      AND NOT EXISTS (
        SELECT 1 FROM referral_commissions 
        WHERE source_id = pt.id 
        AND commission_type = 'trading'
      )
  LOOP
    referrer_id := transaction_record.referrer_id;
    commission_amount := (transaction_record.trade_value * 0.015); -- 1.5% commission
    
    -- Insert commission record
    INSERT INTO referral_commissions (
      id,
      referrer_id,
      referred_id,
      source_id,
      amount,
      commission_type,
      status,
      created_at
    ) VALUES (
      gen_random_uuid(),
      referrer_id,
      transaction_record.seller_id,
      transaction_record.id,
      commission_amount,
      'trading',
      'pending',
      NOW()
    );
    
    -- Update referral record with trading commission
    UPDATE referrals 
    SET total_trading_commission = total_trading_commission + commission_amount
    WHERE referrer_id = referrer_id 
      AND referred_id = transaction_record.seller_id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 4. Create scheduled job to calculate commissions daily (if supported)
-- This would need to be triggered by a cron job or scheduler

-- 5. Create view to see all downline transaction history with commission
CREATE OR REPLACE VIEW referral_downline_transactions AS
SELECT
  r.referrer_id as upline_id,
  r.referred_id as downline_id,
  pt.id as trade_id,
  pt.gx_amount,
  pa.price_per_gx,
  (pt.gx_amount * pa.price_per_gx) as trade_value,
  (pt.gx_amount * pa.price_per_gx * 0.015) as commission_15_percent,
  pt.status,
  pt.created_at,
  pt.updated_at,
  p1.username as downline_username,
  p2.username as upline_username
FROM p2p_trades pt
JOIN p2p_ads pa ON pt.ad_id = pa.id
JOIN referrals r ON r.referred_id = pt.seller_id
JOIN profiles p1 ON p1.id = r.referred_id
JOIN profiles p2 ON p2.id = r.referrer_id
WHERE pt.status = 'completed'
ORDER BY pt.created_at DESC;

-- 6. Create function to fetch all downline transactions for an upline user
CREATE OR REPLACE FUNCTION get_upline_downline_transactions(upline_user_id UUID)
RETURNS TABLE(
  downline_username TEXT,
  trade_value NUMERIC,
  commission_earned NUMERIC,
  trade_date TIMESTAMP,
  trade_status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.username,
    (pt.gx_amount * pa.price_per_gx)::NUMERIC,
    ((pt.gx_amount * pa.price_per_gx) * 0.015)::NUMERIC,
    pt.created_at,
    pt.status
  FROM p2p_trades pt
  JOIN p2p_ads pa ON pt.ad_id = pa.id
  JOIN referrals r ON r.referred_id = pt.seller_id
  JOIN profiles p ON p.id = r.referred_id
  WHERE r.referrer_id = upline_user_id
    AND pt.status = 'completed'
  ORDER BY pt.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- 7. Ensure profiles table has proper referral_code uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_code_unique ON profiles(referral_code) 
WHERE referral_code IS NOT NULL;

-- 8. Create index for faster referral lookups
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON referrals(referred_id);
CREATE INDEX IF NOT EXISTS idx_referral_commissions_referrer ON referral_commissions(referrer_id);
