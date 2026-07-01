-- =====================================
-- PATCH V16: Add Tax and Discount features
-- =====================================

-- Tambah persentase pajak untuk tiap outlet (default 0)
ALTER TABLE public.outlets ADD COLUMN IF NOT EXISTS tax_rate_percent NUMERIC DEFAULT 0;

-- Tambah komponen nilai (subtotal, diskon, pajak) pada tabel transaksi
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS subtotal_amount NUMERIC DEFAULT 0;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS tax_amount NUMERIC DEFAULT 0;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS customer_name TEXT;
