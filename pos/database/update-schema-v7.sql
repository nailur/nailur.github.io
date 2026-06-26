-- Menambahkan kolom harga khusus aplikasi ke tabel products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS price_gofood NUMERIC;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS price_shopeefood NUMERIC;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS price_grabfood NUMERIC;
