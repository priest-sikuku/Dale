-- P2P Payment Methods System Upgrade
-- Adds support for multiple payment methods: M-Pesa, M-Pesa Paybill, Airtel Money, Bank Transfer

-- Create payment_methods table for better organization
CREATE TABLE IF NOT EXISTS public.p2p_payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id uuid NOT NULL REFERENCES public.p2p_ads(id) ON DELETE CASCADE,
  method_type TEXT NOT NULL CHECK (method_type IN ('mpesa', 'mpesa_paybill', 'airtel_money', 'bank_transfer', 'other')),
  account_details TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(ad_id, method_type)
);

-- Add payment_methods_json to p2p_ads for denormalized access
ALTER TABLE public.p2p_ads ADD COLUMN IF NOT EXISTS payment_methods_json JSONB DEFAULT '{}';

-- Enable RLS
ALTER TABLE public.p2p_payment_methods ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view payment methods for active ads" ON public.p2p_payment_methods
FOR SELECT USING (true);

CREATE POLICY "Users can manage own payment methods" ON public.p2p_payment_methods
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.p2p_ads 
    WHERE id = ad_id AND user_id = auth.uid()
  )
);

-- Function to get advertiser's payment methods
CREATE OR REPLACE FUNCTION get_advertiser_payment_methods(p_ad_id UUID)
RETURNS TABLE (
  method_type TEXT,
  account_details TEXT,
  display_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pm.method_type,
    pm.account_details,
    CASE 
      WHEN pm.method_type = 'mpesa' THEN 'M-Pesa'
      WHEN pm.method_type = 'mpesa_paybill' THEN 'M-Pesa Paybill'
      WHEN pm.method_type = 'airtel_money' THEN 'Airtel Money'
      WHEN pm.method_type = 'bank_transfer' THEN 'Bank Transfer'
      ELSE 'Other'
    END as display_name
  FROM public.p2p_payment_methods pm
  WHERE pm.ad_id = p_ad_id
  ORDER BY pm.is_primary DESC, pm.created_at ASC;
END;
$$ LANGUAGE plpgsql;

-- Migrate existing payment data
INSERT INTO public.p2p_payment_methods (ad_id, method_type, account_details, is_primary)
SELECT id, 'mpesa', mpesa_number, TRUE FROM public.p2p_ads WHERE mpesa_number IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.p2p_payment_methods (ad_id, method_type, account_details, is_primary)
SELECT id, 'mpesa_paybill', paybill_number, FALSE FROM public.p2p_ads WHERE paybill_number IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.p2p_payment_methods (ad_id, method_type, account_details, is_primary)
SELECT id, 'airtel_money', airtel_money, FALSE FROM public.p2p_ads WHERE airtel_money IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.p2p_payment_methods (ad_id, method_type, account_details, is_primary)
SELECT id, 'bank_transfer', account_number, FALSE FROM public.p2p_ads WHERE account_number IS NOT NULL
ON CONFLICT DO NOTHING;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_advertiser_payment_methods(UUID) TO authenticated;
