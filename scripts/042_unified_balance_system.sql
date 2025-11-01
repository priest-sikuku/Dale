-- Unified Balance System for Dashboard and P2P
-- This ensures that P2P uses the same balance as the dashboard (from coins table)

BEGIN;

-- Create a function to get user's available balance for both dashboard and P2P
-- Available balance = total balance (from coins) - coins locked in active sell ads
CREATE OR REPLACE FUNCTION get_unified_available_balance(p_user_id UUID)
RETURNS DECIMAL AS $$
DECLARE
    v_total_balance DECIMAL;
    v_locked_in_ads DECIMAL;
    v_available_balance DECIMAL;
BEGIN
    -- Get total balance from coins table
    SELECT COALESCE(SUM(amount), 0)
    INTO v_total_balance
    FROM coins
    WHERE user_id = p_user_id AND is_claimed = true;

    -- Get coins locked in active sell ads
    SELECT COALESCE(SUM(pa.gx_amount - pa.remaining_amount), 0)
    INTO v_locked_in_ads
    FROM p2p_ads pa
    WHERE pa.user_id = p_user_id 
    AND pa.ad_type = 'sell'
    AND pa.status = 'active'
    AND pa.expires_at > NOW();

    -- Calculate available balance
    v_available_balance := v_total_balance - v_locked_in_ads;
    
    -- Return 0 if negative
    RETURN GREATEST(v_available_balance, 0);
END;
$$ LANGUAGE plpgsql STABLE;

-- Create a function to get total balance (claimed coins)
CREATE OR REPLACE FUNCTION get_total_afx_balance(p_user_id UUID)
RETURNS DECIMAL AS $$
BEGIN
    RETURN COALESCE(
        (SELECT SUM(amount) FROM coins WHERE user_id = p_user_id AND is_claimed = true),
        0
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- Update the balance panel to use unified system
-- This ensures P2P dashboard shows the same balance as the main dashboard
CREATE OR REPLACE FUNCTION sync_p2p_balance_view(p_user_id UUID)
RETURNS TABLE (
    total_balance DECIMAL,
    available_balance DECIMAL,
    locked_in_ads DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(SUM(CASE WHEN c.is_claimed THEN c.amount ELSE 0 END), 0) as total_balance,
        GREATEST(
            COALESCE(SUM(CASE WHEN c.is_claimed THEN c.amount ELSE 0 END), 0) - 
            COALESCE(SUM(CASE WHEN pa.ad_type = 'sell' AND pa.status = 'active' AND pa.expires_at > NOW() 
                            THEN (pa.gx_amount - pa.remaining_amount) ELSE 0 END), 0),
            0
        ) as available_balance,
        COALESCE(SUM(CASE WHEN pa.ad_type = 'sell' AND pa.status = 'active' AND pa.expires_at > NOW() 
                         THEN (pa.gx_amount - pa.remaining_amount) ELSE 0 END), 0) as locked_in_ads
    FROM coins c
    LEFT JOIN p2p_ads pa ON pa.user_id = p_user_id
    WHERE c.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- Create trigger to update total_mined when coins change
CREATE OR REPLACE FUNCTION update_total_mined_on_coins_change()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE profiles
    SET total_mined = (
        SELECT COALESCE(SUM(amount), 0)
        FROM coins
        WHERE user_id = NEW.user_id AND is_claimed = true
    )
    WHERE id = NEW.user_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop old trigger if exists and create new one
DROP TRIGGER IF EXISTS trigger_sync_total_mined ON coins;
CREATE TRIGGER trigger_sync_total_mined
AFTER INSERT OR UPDATE OR DELETE ON coins
FOR EACH ROW
EXECUTE FUNCTION update_total_mined_on_coins_change();

-- Ensure profiles table has the unified balance field
-- This should already exist, but making sure
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS total_mined DECIMAL DEFAULT 0;

-- Initialize all user balances from coins table
UPDATE profiles p
SET total_mined = COALESCE((
    SELECT SUM(amount)
    FROM coins c
    WHERE c.user_id = p.id AND c.is_claimed = true
), 0);

COMMIT;
