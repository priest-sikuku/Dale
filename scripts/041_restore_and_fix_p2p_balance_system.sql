-- Comprehensive fix for P2P balance synchronization
-- This restores the total_mined column if missing and ensures P2P trades use the correct balance source

-- Step 1: Check if total_mined column exists, if not, restore it
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='profiles' AND column_name='total_mined'
  ) THEN
    ALTER TABLE profiles ADD COLUMN total_mined NUMERIC DEFAULT 0;
    COMMENT ON COLUMN profiles.total_mined IS 'Total AFX coins mined/owned by user - synced with coins table';
  END IF;
END $$;

-- Step 2: Create a function to calculate total balance from coins table
CREATE OR REPLACE FUNCTION get_total_balance(p_user_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_total NUMERIC;
BEGIN
  -- Sum all coins belonging to user
  SELECT COALESCE(SUM(amount), 0)
  INTO v_total
  FROM coins
  WHERE user_id = p_user_id
  AND status = 'active';
  
  RETURN v_total;
END;
$$ LANGUAGE plpgsql STABLE;

-- Step 3: Sync total_mined from coins table
UPDATE profiles p
SET total_mined = (
  SELECT COALESCE(SUM(c.amount), 0)
  FROM coins c
  WHERE c.user_id = p.id
  AND c.status = 'active'
)
WHERE total_mined IS NULL OR total_mined = 0;

-- Step 4: Create trigger to keep total_mined in sync when coins are added/removed
CREATE OR REPLACE FUNCTION sync_total_mined_on_coins_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the total_mined in profiles whenever coins change
  UPDATE profiles
  SET total_mined = (
    SELECT COALESCE(SUM(amount), 0)
    FROM coins
    WHERE user_id = NEW.user_id
    AND status = 'active'
  ),
  updated_at = NOW()
  WHERE id = NEW.user_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_coins_to_profile_balance ON coins;
CREATE TRIGGER sync_coins_to_profile_balance
AFTER INSERT OR UPDATE OR DELETE ON coins
FOR EACH ROW
EXECUTE FUNCTION sync_total_mined_on_coins_change();

-- Step 5: Fix get_available_balance function to use correct balance source
DROP FUNCTION IF EXISTS get_available_balance(UUID);

CREATE FUNCTION get_available_balance(p_user_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_total_balance NUMERIC;
  v_locked_balance NUMERIC;
BEGIN
  -- Get total balance from coins table
  SELECT COALESCE(SUM(amount), 0)
  INTO v_total_balance
  FROM coins
  WHERE user_id = p_user_id
  AND status = 'active';

  -- Get locked balance from active SELL ads
  SELECT COALESCE(SUM(remaining_amount), 0)
  INTO v_locked_balance
  FROM p2p_ads
  WHERE user_id = p_user_id
  AND status = 'active'
  AND ad_type = 'sell';

  -- Return available balance
  RETURN v_total_balance - v_locked_balance;
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION get_available_balance(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_total_balance(UUID) TO authenticated;

-- Step 6: Update P2P trade functions to use correct balance checks
CREATE OR REPLACE FUNCTION initiate_p2p_trade(
  p_ad_id UUID,
  p_buyer_id UUID,
  p_gx_amount NUMERIC
)
RETURNS jsonb AS $$
DECLARE
  v_ad_record RECORD;
  v_buyer_balance NUMERIC;
  v_seller_balance NUMERIC;
  v_trade_id UUID;
BEGIN
  -- Get ad details
  SELECT * INTO v_ad_record FROM p2p_ads WHERE id = p_ad_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ad not found');
  END IF;

  IF v_ad_record.status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ad is not active');
  END IF;

  -- Prevent self-trading
  IF v_ad_record.user_id = p_buyer_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot trade with yourself');
  END IF;

  -- Check amounts
  IF p_gx_amount < v_ad_record.min_amount OR p_gx_amount > v_ad_record.max_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount outside allowed range');
  END IF;

  -- For BUY ads: buyer receives coins (check seller has balance)
  IF v_ad_record.ad_type = 'buy' THEN
    SELECT get_available_balance(v_ad_record.user_id) INTO v_seller_balance;
    
    IF v_seller_balance < p_gx_amount THEN
      RETURN jsonb_build_object('success', false, 'error', 'Seller has insufficient balance: ' || v_seller_balance);
    END IF;
  END IF;

  -- For SELL ads: seller receives coins (no balance check needed for buyer)
  IF v_ad_record.ad_type = 'sell' THEN
    -- Balance already locked in the ad, so just proceed
    NULL;
  END IF;

  -- Create trade record
  INSERT INTO p2p_trades (
    ad_id,
    buyer_id,
    seller_id,
    gx_amount,
    escrow_amount,
    status,
    expires_at,
    created_at,
    updated_at
  ) VALUES (
    p_ad_id,
    p_buyer_id,
    v_ad_record.user_id,
    p_gx_amount,
    p_gx_amount,
    'pending_payment',
    NOW() + INTERVAL '24 hours',
    NOW(),
    NOW()
  )
  RETURNING id INTO v_trade_id;

  -- For SELL ads, move coins to escrow (deduct from seller)
  IF v_ad_record.ad_type = 'sell' THEN
    UPDATE profiles
    SET total_mined = total_mined - p_gx_amount,
        updated_at = NOW()
    WHERE id = v_ad_record.user_id;
  END IF;

  -- Update ad remaining amount
  UPDATE p2p_ads
  SET remaining_amount = remaining_amount - p_gx_amount,
      updated_at = NOW()
  WHERE id = p_ad_id;

  RETURN jsonb_build_object(
    'success', true,
    'trade_id', v_trade_id,
    'message', 'Trade initiated successfully'
  );
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION initiate_p2p_trade(UUID, UUID, NUMERIC) TO authenticated;

-- Step 7: Grants for all functions
GRANT EXECUTE ON FUNCTION get_available_balance(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION sync_total_mined_on_coins_change() TO authenticated;
