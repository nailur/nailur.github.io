-- PATCH V21: Global Discounts
-- =====================================

CREATE TABLE IF NOT EXISTS public.global_discounts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    outlet_id UUID REFERENCES public.outlets(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT false,
    payment_discounts JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Policy for global_discounts
ALTER TABLE public.global_discounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to global_discounts for authenticated users" 
ON public.global_discounts FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
