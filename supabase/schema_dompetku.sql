-- ==============================================================================
-- DOMPETKU & UNIFIED BOT DATABASE SCHEMA (SUPABASE POSTGRESQL)
-- Project ID: nnizooudxhvjyfaahydc
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABLE: PROFILES (User Profile & Telegram Link)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    telegram_chat_id BIGINT UNIQUE,
    telegram_username TEXT,
    telegram_link_code TEXT UNIQUE,
    default_wallet_id UUID,
    currency TEXT DEFAULT 'IDR',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for telegram lookups
CREATE INDEX IF NOT EXISTS idx_profiles_telegram_chat_id ON public.profiles(telegram_chat_id);
CREATE INDEX IF NOT EXISTS idx_profiles_telegram_link_code ON public.profiles(telegram_link_code);

-- 3. TABLE: WALLETS (Dompet / Rekening Bank / E-Wallet)
CREATE TABLE IF NOT EXISTS public.wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'cash', -- 'cash', 'bank', 'ewallet', 'savings', 'credit'
    balance NUMERIC NOT NULL DEFAULT 0,
    color TEXT DEFAULT '#10B981',
    icon TEXT DEFAULT 'ph-wallet',
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON public.wallets(user_id);

-- 4. TABLE: CATEGORIES (Master Kategori Transaksi)
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- NULL jika default template sistem
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'expense' / 'income'
    icon TEXT DEFAULT 'ph-tag',
    color TEXT DEFAULT '#6366F1',
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_categories_user_id ON public.categories(user_id);

-- 5. TABLE: TRANSACTIONS (Pencatatan Keuangan)
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
    to_wallet_id UUID REFERENCES public.wallets(id) ON DELETE SET NULL, -- Khusus Transfer
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    type TEXT NOT NULL, -- 'expense', 'income', 'transfer'
    amount NUMERIC NOT NULL,
    description TEXT NOT NULL,
    transaction_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    receipt_url TEXT,
    source TEXT DEFAULT 'web', -- 'web', 'telegram', 'api'
    telegram_message_id BIGINT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_wallet_id ON public.transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions(transaction_date);

-- 6. TABLE: BUDGETS (Anggaran Bulanan per Kategori)
CREATE TABLE IF NOT EXISTS public.budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    month INT NOT NULL, -- 1-12
    year INT NOT NULL,  -- 2026, dst
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, category_id, month, year)
);

CREATE INDEX IF NOT EXISTS idx_budgets_user_month ON public.budgets(user_id, month, year);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
DROP POLICY IF EXISTS "Users can view and update own profile" ON public.profiles;
CREATE POLICY "Users can view and update own profile" ON public.profiles
    FOR ALL USING (auth.uid() = id);

-- Wallets Policies
DROP POLICY IF EXISTS "Users can CRUD own wallets" ON public.wallets;
CREATE POLICY "Users can CRUD own wallets" ON public.wallets
    FOR ALL USING (auth.uid() = user_id);

-- Categories Policies
DROP POLICY IF EXISTS "Users can view system and own categories" ON public.categories;
CREATE POLICY "Users can view system and own categories" ON public.categories
    FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can insert/update/delete own categories" ON public.categories;
CREATE POLICY "Users can insert/update/delete own categories" ON public.categories
    FOR ALL USING (auth.uid() = user_id);

-- Transactions Policies
DROP POLICY IF EXISTS "Users can CRUD own transactions" ON public.transactions;
CREATE POLICY "Users can CRUD own transactions" ON public.transactions
    FOR ALL USING (auth.uid() = user_id);

-- Budgets Policies
DROP POLICY IF EXISTS "Users can CRUD own budgets" ON public.budgets;
CREATE POLICY "Users can CRUD own budgets" ON public.budgets
    FOR ALL USING (auth.uid() = user_id);

-- ==============================================================================
-- AUTOMATIC PROFILE CREATION & SEEDING ON USER SIGNUP
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_dompetku_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_wallet_id UUID;
BEGIN
    -- 1. Create Profile
    INSERT INTO public.profiles (id, email, full_name, telegram_link_code)
    VALUES (
        new.id, 
        new.email, 
        COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
        UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6))
    )
    ON CONFLICT (id) DO NOTHING;

    -- 2. Create Default Wallet (Cash)
    INSERT INTO public.wallets (id, user_id, name, type, balance, color, icon, is_default)
    VALUES (
        gen_random_uuid(),
        new.id,
        'Dompet Utama (Cash)',
        'cash',
        0,
        '#10B981',
        'ph-wallet',
        true
    )
    RETURNING id INTO new_wallet_id;

    -- Update profile default wallet
    UPDATE public.profiles SET default_wallet_id = new_wallet_id WHERE id = new.id;

    -- 3. Seed Default Expense Categories
    INSERT INTO public.categories (user_id, name, type, icon, color, is_default) VALUES
        (new.id, 'Makanan & Minuman', 'expense', 'ph-hamburger', '#EF4444', true),
        (new.id, 'Transportasi & Bensin', 'expense', 'ph-gas-pump', '#F59E0B', true),
        (new.id, 'Belanja & Kebutuhan', 'expense', 'ph-shopping-bag', '#3B82F6', true),
        (new.id, 'Tagihan & Utilitas', 'expense', 'ph-receipt', '#8B5CF6', true),
        (new.id, 'Hiburan & Hobi', 'expense', 'ph-game-controller', '#EC4899', true),
        (new.id, 'Kesehatan', 'expense', 'ph-first-aid', '#10B981', true),
        (new.id, 'Pendidikan', 'expense', 'ph-graduation-cap', '#6366F1', true),
        (new.id, 'Lain-lain', 'expense', 'ph-dots-three-circle', '#6B7280', true);

    -- 4. Seed Default Income Categories
    INSERT INTO public.categories (user_id, name, type, icon, color, is_default) VALUES
        (new.id, 'Gaji / Penghasilan', 'income', 'ph-money', '#10B981', true),
        (new.id, 'Bisnis / Usaha', 'income', 'ph-storefront', '#3B82F6', true),
        (new.id, 'Bonus / THR', 'income', 'ph-gift', '#F59E0B', true),
        (new.id, 'Investasi & Dividen', 'income', 'ph-chart-line-up', '#8B5CF6', true),
        (new.id, 'Pemasukan Lainnya', 'income', 'ph-arrow-down-left', '#6B7280', true);

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created_dompetku ON auth.users;
CREATE TRIGGER on_auth_user_created_dompetku
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_dompetku_new_user();

-- ==============================================================================
-- HELPER FUNCTIONS FOR BOT QUERIES (DOMPETKU + NTGOLD)
-- ==============================================================================

-- 1. Helper function: Get User Financial Summary (Cash + Gold Net Worth)
CREATE OR REPLACE FUNCTION public.get_user_net_worth(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
    v_total_cash NUMERIC := 0;
    v_total_gold_grams NUMERIC := 0;
    v_latest_gold_price NUMERIC := 0;
    v_gold_market_value NUMERIC := 0;
    v_result JSON;
BEGIN
    -- Sum all Dompetku Wallets
    SELECT COALESCE(SUM(balance), 0) INTO v_total_cash
    FROM public.wallets
    WHERE user_id = p_user_id;

    -- Sum all NTGold Inventory (tblinventory) if table exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'tblinventory') THEN
        SELECT COALESCE(SUM((weight_grams)::NUMERIC), 0) INTO v_total_gold_grams
        FROM public.tblinventory
        WHERE user_id = p_user_id;
    END IF;

    -- Get latest gold price per gram (Antam 1 gr) from market_price_history if exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'market_price_history') THEN
        SELECT COALESCE(price, 0) INTO v_latest_gold_price
        FROM public.market_price_history
        WHERE brand_name ILIKE '%Antam%' AND weight_grams = 1
        ORDER BY recorded_date DESC, created_at DESC
        LIMIT 1;
    END IF;

    IF v_latest_gold_price = 0 THEN
        v_latest_gold_price := 1500000; -- Default fallback price
    END IF;

    v_gold_market_value := v_total_gold_grams * v_latest_gold_price;

    SELECT json_build_object(
        'total_cash', v_total_cash,
        'total_gold_grams', v_total_gold_grams,
        'latest_gold_price', v_latest_gold_price,
        'gold_market_value', v_gold_market_value,
        'net_worth', (v_total_cash + v_gold_market_value)
    ) INTO v_result;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

