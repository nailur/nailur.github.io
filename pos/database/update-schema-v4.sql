-- =====================================
-- PATCH V4: Profile Names
-- =====================================

-- 1. Tambahkan kolom name ke tabel profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS name TEXT;
