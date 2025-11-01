-- ============================================================================
-- COMPREHENSIVE REFERRAL & P2P SYSTEM REBUILD - SAFE SYNCHRONIZATION
-- ============================================================================
-- This script SAFELY rebuilds the referral and P2P system without data loss.
-- - Checks for existing columns before adding
-- - Generates missing referral codes for existing users
-- - Ensures consistent balance synchronization between dashboard and P2P
-- - Creates all necessary functions and triggers

-- SECTION 1: ENSURE ALL REFERRAL COLUMNS EXIST (NO DATA LOSS)
-- ============================================================================

-- Add referral_code to profiles if missing
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS total_referrals INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS total_commission NUMERIC DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON public.profiles(referral_code);
CREATE INDEX IF NOT EXISTS idx_profiles_referred_by ON public.profiles(referred_by);

-- SECTION 2: GENERATE MISSING REFERRAL CODES FOR EXISTING USERS
-- ============================================================================
-- This function generates a unique 6-character alphanumeric code

CREATE OR REPLACE FUNCTION generate_unique_referral_code()
RETURNS TEXT AS $$
DECLARE
  v_code TEXT;
  v_attempts INT := 0;
BEGIN
  LOOP
    -- Generate random 6-character alphanumeric code prefixed with AFX
    v_code := 'AFX_' || (
      SELECT STRING_AGG(c, '')
      FROM (
        SELECT SUBSTRING('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 
          (RANDOM() * 35 + 1)::INT, 1) AS c
        FROM GENERATE_SERIES(1, 8)
      ) t
    );
    
    -- Check if code already exists
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = v_code) THEN
      RETURN v_code;
    END IF;
    
    v_attempts := v_attempts + 1;
    IF v_attempts > 100 THEN
      RAISE EXCEPTION 'Failed to generate unique referral code after 100 attempts';
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Backfill missing referral codes for existing users (SAFE - only updates NULL codes)
UPDATE public.profiles
SET referral_code = generate_unique_referral_code()
WHERE referral_code IS NULL;

-- SECTION 3: UNIFIED BALANCE SYSTEM (Dashboard & P2P sync)
-- ============================================================================

-- Drop existing function if it exists to recreate it properly
DROP FUNCTION IF EXISTS get_unified_available_balance(UUID);

CREATE OR REPLACE FUNCTION get_unified_available_balance(p_user_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_total_balance NUMERIC;
  v_locked_in_ads NUMERIC;
BEGIN
  -- Get total balance from coins table (claimed coins)
  SELECT COALESCE(SUM(amount), 0) INTO v_total_balance
  FROM public.coins
  WHERE user_id = p_user_id 
    AND status = 'active'
    AND claim_type = 'mining'; -- Only count mined coins

  -- Get coins locked in active sell ads
  SELECT COALESCE(SUM(gx_amount), 0) INTO v_locked_in_ads
  FROM public.p2p_ads
  WHERE user_id = p_user_id
    AND status IN ('active', 'pending');

  -- Available balance = total - locked
  RETURN GREATEST(v_total_balance - v_locked_in_ads, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_unified_available_balance(UUID) TO authenticated;

-- SECTION 4: REFERRAL COMMISSION TRACKING (1.5% from downline transactions)
-- ============================================================================

-- Ensure referral_commissions table has all necessary columns
ALTER TABLE public.referral_commissions 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_referral_commissions_referrer_status 
ON public.referral_commissions(referrer_id, status);

-- Function to calculate and award 1.5% commission from any downline transaction
CREATE OR REPLACE FUNCTION calculate_and_award_referral_commission(
  p_referrer_id UUID,
  p_referred_id UUID,
  p_transaction_id UUID,
  p_transaction_type TEXT,
  p_transaction_amount NUMERIC
)
RETURNS VOID AS $$
DECLARE
  v_commission_amount NUMERIC;
  v_commission_type TEXT;
BEGIN
  -- Calculate 1.5% commission
  v_commission_amount := p_transaction_amount * 0.015;
  
  -- Determine commission type based on transaction
  IF p_transaction_type = 'trading' OR p_transaction_type = 'p2p_sell' THEN
    v_commission_type := 'trading';
  ELSIF p_transaction_type = 'claim' THEN
    v_commission_type := 'claim';
  ELSE
    v_commission_type := 'other';
  END IF;

  -- Insert commission record
  INSERT INTO public.referral_commissions (
    referrer_id,
    referred_id,
    source_id,
    amount,
    commission_type,
    status,
    created_at,
    updated_at
  ) VALUES (
    p_referrer_id,
    p_referred_id,
    p_transaction_id,
    v_commission_amount,
    v_commission_type,
    'pending',
    NOW(),
    NOW()
  ) ON CONFLICT DO NOTHING;

  -- Update referrals table with commission totals
  IF v_commission_type = 'trading' THEN
    UPDATE public.referrals
    SET total_trading_commission = total_trading_commission + v_commission_amount,
        updated_at = NOW()
    WHERE referrer_id = p_referrer_id AND referred_id = p_referred_id;
  ELSIF v_commission_type = 'claim' THEN
    UPDATE public.referrals
    SET total_claim_commission = total_claim_commission + v_commission_amount,
        updated_at = NOW()
    WHERE referrer_id = p_referrer_id AND referred_id = p_referred_id;
  END IF;

  -- Update profiles total_commission
  UPDATE public.profiles
  SET total_commission = total_commission + v_commission_amount,
      updated_at = NOW()
  WHERE id = p_referrer_id;

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error in calculate_and_award_referral_commission: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION calculate_and_award_referral_commission(UUID, UUID, UUID, TEXT, NUMERIC) TO authenticated;

-- SECTION 5: AUTO-INCREMENT REFERRAL COUNT TRIGGER
-- ============================================================================

-- Trigger to auto-increment total_referrals when new user signs up with referral
CREATE OR REPLACE FUNCTION increment_referral_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the referrer's total_referrals count
  UPDATE public.profiles
  SET total_referrals = total_referrals + 1,
      updated_at = NOW()
  WHERE id = NEW.referred_by
    AND NEW.referred_by IS NOT NULL;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger to recreate it
DROP TRIGGER IF EXISTS trigger_increment_referral_count ON public.profiles;

CREATE TRIGGER trigger_increment_referral_count
AFTER INSERT OR UPDATE OF referred_by ON public.profiles
FOR EACH ROW
WHEN (NEW.referred_by IS NOT NULL)
EXECUTE FUNCTION increment_referral_count();

-- Backfill total_referrals counts for existing referrers
UPDATE public.profiles
SET total_referrals = (
  SELECT COUNT(*) FROM public.profiles p2
  WHERE p2.referred_by = public.profiles.id
)
WHERE total_referrals = 0 AND id IN (
  SELECT DISTINCT referred_by FROM public.profiles WHERE referred_by IS NOT NULL
);

-- SECTION 6: P2P BALANCE VALIDATION FUNCTIONS
-- ============================================================================

-- Function to check if user has sufficient balance for P2P trade
CREATE OR REPLACE FUNCTION check_user_balance_for_p2p(
  p_user_id UUID,
  p_required_amount NUMERIC
)
RETURNS BOOLEAN AS $$
DECLARE
  v_available_balance NUMERIC;
BEGIN
  v_available_balance := get_unified_available_balance(p_user_id);
  RETURN v_available_balance >= p_required_amount;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION check_user_balance_for_p2p(UUID, NUMERIC) TO authenticated;

-- SECTION 7: VIEW FOR DOWNLINE TRANSACTION TRACKING
-- ============================================================================

DROP VIEW IF EXISTS v_downline_transactions_with_commission CASCADE;

CREATE OR REPLACE VIEW v_downline_transactions_with_commission AS
SELECT
  pt.id as trade_id,
  pt.seller_id,
  pt.buyer_id,
  r.referrer_id as upline_id,
  ps.username as seller_username,
  pb.username as buyer_username,
  pu.username as upline_username,
  pt.gx_amount,
  pa.price_per_gx,
  (pt.gx_amount * pa.price_per_gx) as trade_value,
  (pt.gx_amount * pa.price_per_gx * 0.015) as commission_15_percent,
  pt.status as trade_status,
  pt.created_at as trade_date,
  pt.updated_at
FROM public.p2p_trades pt
JOIN public.p2p_ads pa ON pt.ad_id = pa.id
JOIN public.profiles ps ON pt.seller_id = ps.id
JOIN public.profiles pb ON pt.buyer_id = pb.id
JOIN public.referrals r ON r.referred_id = pt.seller_id
LEFT JOIN public.profiles pu ON r.referrer_id = pu.id
WHERE pt.status = 'completed';

-- SECTION 8: GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT ON public.profiles TO authenticated;
GRANT SELECT ON public.referrals TO authenticated;
GRANT SELECT ON public.referral_commissions TO authenticated;
GRANT SELECT ON public.coins TO authenticated;
GRANT SELECT ON public.p2p_ads TO authenticated;
GRANT SELECT ON public.p2p_trades TO authenticated;
GRANT SELECT ON v_downline_transactions_with_commission TO authenticated;

-- SECTION 9: CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON public.referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_id ON public.referrals(referred_id);
CREATE INDEX IF NOT EXISTS idx_coins_user_status ON public.coins(user_id, status);
CREATE INDEX IF NOT EXISTS idx_p2p_ads_user_status ON public.p2p_ads(user_id, status);

-- ============================================================================
-- END OF REBUILD SCRIPT
-- ============================================================================
