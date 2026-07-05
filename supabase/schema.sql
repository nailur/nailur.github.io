-- ==============================================================
-- NTGold - Full Database Schema (PostgreSQL for Supabase)
-- ==============================================================
-- IMPORTANT: This script will DROP existing tables if they exist.
-- Ensure you have backed up your data before running this!

-- 1. Drop existing tables (Optional, if you want a clean slate)
DROP TABLE IF EXISTS public.tblinventory CASCADE;
DROP TABLE IF EXISTS public.tblwallet CASCADE;
DROP TABLE IF EXISTS public.tblpricelog CASCADE;
DROP TABLE IF EXISTS public.market_price_history CASCADE;
DROP TABLE IF EXISTS public.tbluser CASCADE;
DROP TABLE IF EXISTS public.tbllang CASCADE;
DROP TABLE IF EXISTS public.tblbrand CASCADE;

-- ==============================================================
-- CORE TABLES
-- ==============================================================

-- Table: tbllang (Languages)
CREATE TABLE public.tbllang (
    lang_id TEXT PRIMARY KEY,
    lang_code TEXT UNIQUE NOT NULL
);

-- Insert Default Languages
INSERT INTO public.tbllang (lang_id, lang_code) VALUES 
('1', 'EN'),
('2', 'ID');

-- Table: tbluser (Extended User Profiles)
CREATE TABLE public.tbluser (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    user_type TEXT DEFAULT 'free',
    lang_id TEXT REFERENCES public.tbllang(lang_id) DEFAULT '1',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table: tblbrand (Gold Brands)
CREATE TABLE public.tblbrand (
    id TEXT PRIMARY KEY,
    brand_name TEXT UNIQUE NOT NULL,
    logo_url TEXT,
    website_url TEXT
);

-- Insert Default Brands
INSERT INTO public.tblbrand (id, brand_name) VALUES 
('3_2', 'Antam'),
('19_14', 'Emas Kita'),
('2_3', 'Galeri24'),
('4_5', 'Lotus Archi'),
('5_10', 'Sampoerna'),
('ubs', 'UBS');

-- Table: tblpricelog (Log Harga Manual/Internal DB)
CREATE TABLE public.tblpricelog (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    brand_id TEXT REFERENCES public.tblbrand(id) ON DELETE CASCADE,
    weight_grams NUMERIC NOT NULL,
    price NUMERIC NOT NULL,
    buyback_price NUMERIC,
    created_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table: market_price_history (Riwayat Harga Harian)
CREATE TABLE public.market_price_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    brand_name TEXT NOT NULL,
    weight_grams NUMERIC NOT NULL,
    price NUMERIC NOT NULL,
    recorded_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(brand_name, weight_grams, recorded_date)
);

-- ==============================================================
-- USER PORTFOLIO TABLES
-- ==============================================================

-- Table: tblwallet (Goal/Portfolio Category)
CREATE TABLE public.tblwallet (
    wallet_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    wallet_name TEXT NOT NULL,
    goal_amount NUMERIC NOT NULL DEFAULT 0,
    created_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table: tblinventory (Assets per Wallet)
CREATE TABLE public.tblinventory (
    inventory_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    wallet_id UUID REFERENCES public.tblwallet(wallet_id) ON DELETE CASCADE NOT NULL,
    brand_id TEXT REFERENCES public.tblbrand(id) ON DELETE CASCADE,
    weight_grams NUMERIC NOT NULL,
    purchase_price NUMERIC NOT NULL,
    purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);


-- ==============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================

-- Aktifkan RLS di semua tabel
ALTER TABLE public.tbluser ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tblbrand ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tbllang ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tblpricelog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tblwallet ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tblinventory ENABLE ROW LEVEL SECURITY;

-- 1. Read-Only untuk tabel referensi (Publik bisa baca)
CREATE POLICY "Public read tbllang" ON public.tbllang FOR SELECT USING (true);
CREATE POLICY "Public read tblbrand" ON public.tblbrand FOR SELECT USING (true);
CREATE POLICY "Public read tblpricelog" ON public.tblpricelog FOR SELECT USING (true);
CREATE POLICY "Public read market_price_history" ON public.market_price_history FOR SELECT USING (true);

-- 2. User Profiles (Hanya bisa dibaca dan diupdate oleh user itu sendiri)
CREATE POLICY "User can read own profile" ON public.tbluser FOR SELECT USING (auth.uid() = id);
CREATE POLICY "User can update own profile" ON public.tbluser FOR UPDATE USING (auth.uid() = id);

-- Trigger untuk membuat profil secara otomatis ketika user baru mendaftar (Sign Up)
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.tbluser (id, full_name, user_type, lang_id)
    VALUES (new.id, new.raw_user_meta_data->>'full_name', 'free', '1');
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Memicu fungsi ketika auth.users mendapatkan record baru
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 3. Wallets / Goals (CRUD hanya untuk pemilik)
CREATE POLICY "User read own wallets" ON public.tblwallet FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "User insert own wallets" ON public.tblwallet FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "User update own wallets" ON public.tblwallet FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "User delete own wallets" ON public.tblwallet FOR DELETE USING (auth.uid() = user_id);

-- 4. Inventory / Aset Emas (CRUD hanya untuk pemilik)
CREATE POLICY "User read own inventory" ON public.tblinventory FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "User insert own inventory" ON public.tblinventory FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "User update own inventory" ON public.tblinventory FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "User delete own inventory" ON public.tblinventory FOR DELETE USING (auth.uid() = user_id);
