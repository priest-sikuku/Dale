-- Create p2p_payment_details table to store seller verified payment information
CREATE TABLE IF NOT EXISTS public.p2p_payment_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  method_type TEXT NOT NULL CHECK (method_type IN ('mpesa_personal', 'mpesa_paybill', 'bank_transfer', 'airtel_money')),
  
  -- M-Pesa Personal fields
  full_name TEXT,
  phone_number TEXT,
  
  -- M-Pesa Paybill fields
  paybill_number TEXT,
  account_number TEXT,
  
  -- Bank Transfer fields
  bank_name TEXT,
  
  -- Airtel Money fields
  airtel_money_number TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT valid_mpesa_personal CHECK (
    method_type != 'mpesa_personal' OR (full_name IS NOT NULL AND phone_number IS NOT NULL)
  ),
  CONSTRAINT valid_mpesa_paybill CHECK (
    method_type != 'mpesa_paybill' OR (paybill_number IS NOT NULL AND account_number IS NOT NULL)
  ),
  CONSTRAINT valid_bank_transfer CHECK (
    method_type != 'bank_transfer' OR (bank_name IS NOT NULL AND account_number IS NOT NULL)
  ),
  CONSTRAINT valid_airtel_money CHECK (
    method_type != 'airtel_money' OR airtel_money_number IS NOT NULL
  )
);

-- Add seller_payment_id to p2p_trades
ALTER TABLE public.p2p_trades ADD COLUMN IF NOT EXISTS seller_payment_id UUID REFERENCES public.p2p_payment_details(id) ON DELETE RESTRICT;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_p2p_payment_details_user ON public.p2p_payment_details(user_id);
CREATE INDEX IF NOT EXISTS idx_p2p_payment_details_method ON public.p2p_payment_details(method_type);
CREATE INDEX IF NOT EXISTS idx_p2p_trades_seller_payment ON public.p2p_trades(seller_payment_id);

-- Enable RLS
ALTER TABLE public.p2p_payment_details ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own payment details"
  ON public.p2p_payment_details
  FOR SELECT
  USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM public.p2p_trades 
    WHERE seller_payment_id = p2p_payment_details.id 
    AND (buyer_id = auth.uid() OR seller_id = auth.uid())
  ));

CREATE POLICY "Users can create own payment details"
  ON public.p2p_payment_details
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own payment details"
  ON public.p2p_payment_details
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Helper function to validate payment details
CREATE OR REPLACE FUNCTION validate_seller_payment_details(
  p_user_id UUID,
  p_method_type TEXT,
  p_payment_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
  IF p_payment_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM public.p2p_payment_details
    WHERE id = p_payment_id 
    AND user_id = p_user_id 
    AND method_type = p_method_type
  ) THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.p2p_payment_details TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT EXECUTE ON FUNCTION validate_seller_payment_details TO authenticated;
