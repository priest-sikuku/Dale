-- AFX System-Wide Rebranding - Safe Migration
-- Updates only text-based branding fields, preserves all data integrity

-- Update coins table branding
UPDATE coins 
SET coin_symbol = 'AFX', coin_name = 'AfriX'
WHERE coin_symbol IN ('gx', 'GX') OR coin_name IN ('growx', 'GrowX', 'GrowX Coin');

-- Update p2p_ads payment method descriptions if stored as text
-- (This is a safety check - payment methods should be stored as separate records)
UPDATE p2p_ads
SET payment_method = 'M-Pesa'
WHERE payment_method IN ('mpesa', 'm-pesa', 'M-Pesa', 'MPESA');

UPDATE p2p_ads
SET payment_method = 'Bank Transfer'
WHERE payment_method IN ('bank', 'bank transfer', 'Bank', 'BANK TRANSFER');

-- Ensure profiles display name is consistent
-- No schema change needed - UI will handle display

-- Log the rebranding completion
DO $$
DECLARE
  affected_rows INT;
BEGIN
  SELECT COUNT(*) INTO affected_rows FROM coins WHERE coin_symbol = 'AFX';
  RAISE NOTICE 'Rebranding complete: % coins updated to AFX', affected_rows;
END $$;
