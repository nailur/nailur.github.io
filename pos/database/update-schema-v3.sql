-- =====================================
-- PATCH V3: Product Image Upload
-- =====================================

-- 1. Tambahkan kolom image_url ke tabel products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 2. Buat Storage Bucket "product-images" (Public)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage Policies
-- Izinkan semua orang membaca gambar produk (karena publik)
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
USING ( bucket_id = 'product-images' );

-- Izinkan user terautentikasi (admin/kepala/kasir) untuk mengunggah gambar
DROP POLICY IF EXISTS "Authenticated Insert" ON storage.objects;
CREATE POLICY "Authenticated Insert" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK ( bucket_id = 'product-images' );

-- Izinkan user terautentikasi untuk mengupdate gambar
DROP POLICY IF EXISTS "Authenticated Update" ON storage.objects;
CREATE POLICY "Authenticated Update" 
ON storage.objects FOR UPDATE 
TO authenticated 
USING ( bucket_id = 'product-images' );

-- Izinkan user terautentikasi untuk menghapus gambar
DROP POLICY IF EXISTS "Authenticated Delete" ON storage.objects;
CREATE POLICY "Authenticated Delete" 
ON storage.objects FOR DELETE 
TO authenticated 
USING ( bucket_id = 'product-images' );
