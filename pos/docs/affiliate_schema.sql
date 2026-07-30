-- ====================================================================
-- NTPOS Affiliate Module - SQL Migration Script (Khusus Superadmin)
-- Silakan jalankan script ini di Supabase SQL Editor
-- ====================================================================

-- 1. Create table affiliate_settings (Master setting komisi per produk)
CREATE TABLE IF NOT EXISTS public.affiliate_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    outlet_id UUID NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    commission_nominal NUMERIC NOT NULL DEFAULT 0,
    bulk_commission_nominal NUMERIC NOT NULL DEFAULT 0,
    bonus_target_qty INTEGER NOT NULL DEFAULT 15,
    bonus_nominal NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_outlet_product_affiliate UNIQUE (outlet_id, product_id)
);

-- Note: Jika tabel affiliate_settings sudah ada sebelumnya, jalankan perintah berikut:
ALTER TABLE public.affiliate_settings 
ADD COLUMN IF NOT EXISTS bonus_target_qty INTEGER NOT NULL DEFAULT 15,
ADD COLUMN IF NOT EXISTS bonus_nominal NUMERIC NOT NULL DEFAULT 0;

-- 2. Create table affiliate_postings (Dokumen rekap klaim komisi Affiliate)
CREATE TABLE IF NOT EXISTS public.affiliate_postings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    outlet_id UUID NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
    document_number TEXT NOT NULL,
    affiliator_name TEXT NOT NULL,
    posting_date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_amount NUMERIC NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Unpaid' CHECK (status IN ('Unpaid', 'Paid')),
    proof_attachment TEXT NULL,
    paid_at TIMESTAMPTZ NULL,
    notes TEXT NULL,
    created_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create table affiliate_posting_items (Rincian kalkulasi per item produk)
CREATE TABLE IF NOT EXISTS public.affiliate_posting_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    posting_id UUID NOT NULL REFERENCES public.affiliate_postings(id) ON DELETE CASCADE,
    product_id UUID NULL REFERENCES public.products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    total_qty NUMERIC NOT NULL DEFAULT 0,
    commission_rate NUMERIC NOT NULL DEFAULT 0,
    subtotal NUMERIC NOT NULL DEFAULT 0
);

-- 4. Create table affiliate_posting_transactions (Relasi m-to-m ke transaksi penjualan)
CREATE TABLE IF NOT EXISTS public.affiliate_posting_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    posting_id UUID NOT NULL REFERENCES public.affiliate_postings(id) ON DELETE CASCADE,
    transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
    CONSTRAINT unique_affiliate_transaction UNIQUE (transaction_id)
);

-- ====================================================================
-- Enable Row Level Security (RLS) & Policies (Khusus Superadmin)
-- ====================================================================

ALTER TABLE public.affiliate_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_postings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_posting_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_posting_transactions ENABLE ROW LEVEL SECURITY;

-- Policies for affiliate_settings
CREATE POLICY "Superadmin ALL affiliate_settings" ON public.affiliate_settings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
              AND profiles.role = 'superadmin'
        )
    );

-- Policies for affiliate_postings
CREATE POLICY "Superadmin ALL affiliate_postings" ON public.affiliate_postings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
              AND profiles.role = 'superadmin'
        )
    );

-- Policies for affiliate_posting_items
CREATE POLICY "Superadmin ALL affiliate_posting_items" ON public.affiliate_posting_items
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
              AND profiles.role = 'superadmin'
        )
    );

-- Policies for affiliate_posting_transactions
CREATE POLICY "Superadmin ALL affiliate_posting_transactions" ON public.affiliate_posting_transactions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
              AND profiles.role = 'superadmin'
        )
    );

-- Grant privileges to authenticated users (RLS will restrict to superadmin)
GRANT ALL ON public.affiliate_settings TO authenticated;
GRANT ALL ON public.affiliate_postings TO authenticated;
GRANT ALL ON public.affiliate_posting_items TO authenticated;
GRANT ALL ON public.affiliate_posting_transactions TO authenticated;
GRANT ALL ON public.affiliate_settings TO service_role;
GRANT ALL ON public.affiliate_postings TO service_role;
GRANT ALL ON public.affiliate_posting_items TO service_role;
GRANT ALL ON public.affiliate_posting_transactions TO service_role;

-- ====================================================================
-- Performance Indexes (Meringankan beban query & menghemat CPU/IOPS Supabase)
-- ====================================================================

CREATE INDEX IF NOT EXISTS idx_affiliate_settings_outlet ON public.affiliate_settings(outlet_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_postings_outlet_date ON public.affiliate_postings(outlet_id, posting_date DESC);
CREATE INDEX IF NOT EXISTS idx_affiliate_posting_items_posting ON public.affiliate_posting_items(posting_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_posting_trx_posting ON public.affiliate_posting_transactions(posting_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_posting_trx_transaction ON public.affiliate_posting_transactions(transaction_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role_superadmin ON public.profiles(id, role);
