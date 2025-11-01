-- Fix the daily 3pm price update system to ensure prices increase by 3% daily
-- This script creates a robust system that works even without cron jobs

-- Drop existing functions to recreate them
DROP FUNCTION IF EXISTS update_daily_reference_price() CASCADE;
DROP FUNCTION IF EXISTS check_and_update_reference_price() CASCADE;
DROP FUNCTION IF EXISTS auto_update_price_on_read() CASCADE;

-- Enhanced function to update reference price at 3pm daily with proper logging
CREATE OR REPLACE FUNCTION update_daily_reference_price()
RETURNS TABLE(success BOOLEAN, message TEXT, new_price DECIMAL, old_price DECIMAL) AS $$
DECLARE
  today_date DATE := CURRENT_DATE;
  -- Fixed timestamp creation using make_timestamptz function
  today_3pm TIMESTAMPTZ := make_timestamptz(
    EXTRACT(YEAR FROM CURRENT_DATE)::INT,
    EXTRACT(MONTH FROM CURRENT_DATE)::INT,
    EXTRACT(DAY FROM CURRENT_DATE)::INT,
    15, 0, 0, 'Africa/Nairobi'
  );
  calculated_new_price DECIMAL;
  current_prev_price DECIMAL;
  existing_ref RECORD;
BEGIN
  -- Check if we already updated today
  SELECT * INTO existing_ref
  FROM gx_price_references
  WHERE reference_date = today_date;
  
  IF existing_ref IS NOT NULL THEN
    RETURN QUERY SELECT false, 'Price already updated for today'::TEXT, existing_ref.price, existing_ref.previous_price;
    RETURN;
  END IF;
  
  -- Get the most recent reference price
  SELECT price INTO current_prev_price
  FROM gx_price_references
  ORDER BY reference_date DESC
  LIMIT 1;
  
  -- If no previous price exists, start with 16.00
  IF current_prev_price IS NULL THEN
    current_prev_price := 16.00;
  END IF;
  
  -- Calculate new price with 3% increase
  calculated_new_price := ROUND(current_prev_price * 1.03, 2);
  
  -- Insert new reference price for today
  INSERT INTO gx_price_references (reference_date, reference_time, price, previous_price)
  VALUES (today_date, today_3pm, calculated_new_price, current_prev_price);
  
  -- Update current price to match the new reference
  UPDATE gx_current_price
  SET price = calculated_new_price,
      previous_price = current_prev_price,
      change_percent = 3.00,
      updated_at = NOW();
  
  -- Log to price history
  INSERT INTO gx_price_history (price, timestamp)
  VALUES (calculated_new_price, NOW());
  
  RETURN QUERY SELECT true, 'Price updated successfully'::TEXT, calculated_new_price, current_prev_price;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function that auto-checks and updates price when called (can be triggered by any read operation)
CREATE OR REPLACE FUNCTION auto_update_price_on_read()
RETURNS TRIGGER AS $$
DECLARE
  current_hour INTEGER;
  today_date DATE := CURRENT_DATE;
  latest_ref_date DATE;
  update_result RECORD;
BEGIN
  -- Get current hour in EAT timezone
  current_hour := EXTRACT(HOUR FROM (NOW() AT TIME ZONE 'Africa/Nairobi'));
  
  -- Get the latest reference date
  SELECT reference_date INTO latest_ref_date
  FROM gx_price_references
  ORDER BY reference_date DESC
  LIMIT 1;
  
  -- If it's 3pm or later AND we don't have today's reference yet
  IF current_hour >= 15 AND (latest_ref_date IS NULL OR latest_ref_date < today_date) THEN
    -- Update the price
    SELECT * INTO update_result FROM update_daily_reference_price();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger on gx_current_price reads to auto-update if needed
-- This ensures price updates whenever someone checks the price after 3pm
DROP TRIGGER IF EXISTS trigger_auto_price_update ON gx_current_price;
CREATE TRIGGER trigger_auto_price_update
  BEFORE UPDATE ON gx_current_price
  FOR EACH ROW
  EXECUTE FUNCTION auto_update_price_on_read();

-- Function to manually trigger price update (can be called from frontend or API)
CREATE OR REPLACE FUNCTION manual_price_update()
RETURNS TABLE(success BOOLEAN, message TEXT, new_price DECIMAL, old_price DECIMAL) AS $$
BEGIN
  RETURN QUERY SELECT * FROM update_daily_reference_price();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function that checks if price needs updating and returns current price
-- This should be called by the frontend periodically
CREATE OR REPLACE FUNCTION get_current_gx_price_with_auto_update()
RETURNS TABLE(price DECIMAL, previous_price DECIMAL, change_percent DECIMAL, last_updated TIMESTAMPTZ, needs_update BOOLEAN) AS $$
DECLARE
  current_hour INTEGER;
  today_date DATE := CURRENT_DATE;
  latest_ref_date DATE;
  should_update BOOLEAN := false;
BEGIN
  -- Get current hour in EAT timezone
  current_hour := EXTRACT(HOUR FROM (NOW() AT TIME ZONE 'Africa/Nairobi'));
  
  -- Get the latest reference date
  SELECT reference_date INTO latest_ref_date
  FROM gx_price_references
  ORDER BY reference_date DESC
  LIMIT 1;
  
  -- Check if we need to update
  IF current_hour >= 15 AND (latest_ref_date IS NULL OR latest_ref_date < today_date) THEN
    should_update := true;
    -- Perform the update
    PERFORM update_daily_reference_price();
  END IF;
  
  -- Return current price
  RETURN QUERY
  SELECT 
    gcp.price,
    gcp.previous_price,
    gcp.change_percent,
    gcp.updated_at,
    should_update
  FROM gx_current_price gcp
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Backfill missing dates with 3% daily increases
DO $$
DECLARE
  start_date DATE;
  end_date DATE := CURRENT_DATE;
  current_date DATE;
  current_price DECIMAL;
  prev_price DECIMAL;
  -- Fixed timestamp creation for backfill
  ref_time TIMESTAMPTZ;
BEGIN
  -- Get the latest reference date
  SELECT reference_date, price INTO start_date, current_price
  FROM gx_price_references
  ORDER BY reference_date DESC
  LIMIT 1;
  
  -- If no reference exists, start from today with base price
  IF start_date IS NULL THEN
    start_date := CURRENT_DATE;
    current_price := 16.00;
  END IF;
  
  -- Fill in missing dates
  current_date := start_date + INTERVAL '1 day';
  
  WHILE current_date <= end_date LOOP
    -- Check if this date already exists
    IF NOT EXISTS (SELECT 1 FROM gx_price_references WHERE reference_date = current_date) THEN
      prev_price := current_price;
      current_price := ROUND(current_price * 1.03, 2);
      
      -- Fixed timestamp creation using make_timestamptz
      ref_time := make_timestamptz(
        EXTRACT(YEAR FROM current_date)::INT,
        EXTRACT(MONTH FROM current_date)::INT,
        EXTRACT(DAY FROM current_date)::INT,
        15, 0, 0, 'Africa/Nairobi'
      );
      
      INSERT INTO gx_price_references (reference_date, reference_time, price, previous_price)
      VALUES (current_date, ref_time, current_price, prev_price);
    ELSE
      -- Get the price for this date
      SELECT price INTO current_price
      FROM gx_price_references
      WHERE reference_date = current_date;
    END IF;
    
    current_date := current_date + INTERVAL '1 day';
  END LOOP;
  
  -- Update current price to today's reference
  UPDATE gx_current_price
  SET price = current_price,
      previous_price = (SELECT price FROM gx_price_references WHERE reference_date = end_date - INTERVAL '1 day'),
      change_percent = 3.00,
      updated_at = NOW();
END $$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_current_gx_price_with_auto_update() TO authenticated;
GRANT EXECUTE ON FUNCTION manual_price_update() TO authenticated;
GRANT EXECUTE ON FUNCTION update_daily_reference_price() TO authenticated;

-- Create a view for easy price checking
CREATE OR REPLACE VIEW current_gx_price_view AS
SELECT 
  price,
  previous_price,
  change_percent,
  updated_at,
  CASE 
    WHEN EXTRACT(HOUR FROM (NOW() AT TIME ZONE 'Africa/Nairobi')) >= 15 
    AND NOT EXISTS (
      SELECT 1 FROM gx_price_references 
      WHERE reference_date = CURRENT_DATE
    )
    THEN true
    ELSE false
  END as needs_update
FROM gx_current_price
LIMIT 1;

GRANT SELECT ON current_gx_price_view TO authenticated;
