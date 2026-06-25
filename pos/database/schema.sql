-- Buat tabel outlets
CREATE TABLE public.outlets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Buat tabel profiles (ekstensi dari auth.users)
-- Role bisa 'superadmin' atau 'admin'
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('superadmin', 'kepala_toko', 'kasir')),
    outlet_id UUID REFERENCES public.outlets(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Buat tabel products
CREATE TABLE public.products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    outlet_id UUID REFERENCES public.outlets(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price NUMERIC NOT NULL,
    stock INTEGER DEFAULT 0,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Buat tabel transactions
CREATE TABLE public.transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    outlet_id UUID REFERENCES public.outlets(id) ON DELETE CASCADE,
    cashier_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    total_amount NUMERIC NOT NULL,
    payment_method TEXT DEFAULT 'cash',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Buat tabel transaction_items
CREATE TABLE public.transaction_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    transaction_id UUID REFERENCES public.transactions(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    quantity INTEGER NOT NULL,
    price NUMERIC NOT NULL, -- Harga pada saat transaksi
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insert data Superadmin default (ganti ID dengan ID dari auth.users setelah mendaftar pertama kali)
-- Anda harus mendaftar (Sign Up) dulu dari web, lalu update role-nya di Supabase menjadi superadmin:
-- UPDATE public.profiles SET role = 'superadmin' WHERE email = 'email_anda@domain.com';

-- Setup Row Level Security (RLS)
ALTER TABLE public.outlets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_items ENABLE ROW LEVEL SECURITY;

-- Kebijakan (Policies) sederhana untuk MVP ini:
-- Semua user terautentikasi bisa membaca outlets (karena dibutuhkan oleh admin dan superadmin)
CREATE POLICY "Enable read for authenticated users" ON public.outlets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable ALL for superadmin" ON public.outlets FOR ALL TO authenticated USING ( (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superadmin' );

CREATE POLICY "Enable read profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable ALL profiles for superadmin" ON public.profiles FOR ALL TO authenticated USING ( (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superadmin' );
-- Supaya user bisa insert profilenya sendiri saat sign up (lewat trigger)
CREATE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (new.id, new.email, 'kasir'); -- Default role kasir, bisa diubah oleh superadmin
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Products:
-- Superadmin bisa lihat semua. Kepala_Toko dan Kasir bisa lihat products di outletnya saja.
CREATE POLICY "Superadmin read all products" ON public.products FOR SELECT TO authenticated USING ( (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superadmin' );
CREATE POLICY "Outlet read outlet products" ON public.products FOR SELECT TO authenticated USING ( outlet_id = (SELECT outlet_id FROM public.profiles WHERE id = auth.uid()) );
CREATE POLICY "Superadmin ALL products" ON public.products FOR ALL TO authenticated USING ( (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superadmin' );
CREATE POLICY "Kepala_Toko ALL outlet products" ON public.products FOR ALL TO authenticated USING ( 
    outlet_id = (SELECT outlet_id FROM public.profiles WHERE id = auth.uid()) 
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'kepala_toko' 
);

-- Transactions:
CREATE POLICY "Superadmin read all transactions" ON public.transactions FOR SELECT TO authenticated USING ( (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superadmin' );
CREATE POLICY "Outlet read outlet transactions" ON public.transactions FOR SELECT TO authenticated USING ( outlet_id = (SELECT outlet_id FROM public.profiles WHERE id = auth.uid()) );
CREATE POLICY "Outlet insert outlet transactions" ON public.transactions FOR INSERT TO authenticated WITH CHECK ( outlet_id = (SELECT outlet_id FROM public.profiles WHERE id = auth.uid()) );

-- Transaction Items:
CREATE POLICY "Superadmin read all transaction_items" ON public.transaction_items FOR SELECT TO authenticated USING ( (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superadmin' );
CREATE POLICY "Outlet read outlet transaction_items" ON public.transaction_items FOR SELECT TO authenticated USING ( 
    transaction_id IN (SELECT id FROM public.transactions WHERE outlet_id = (SELECT outlet_id FROM public.profiles WHERE id = auth.uid()))
);
CREATE POLICY "Outlet insert transaction_items" ON public.transaction_items FOR INSERT TO authenticated WITH CHECK ( true ); -- Sederhananya diizinkan jika bisa insert transaction

-- Matikan RLS untuk testing jika mengalami error permission (HAPUS INI JIKA SUDAH PRODUCTION)
-- ALTER TABLE public.outlets DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.products DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.transactions DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.transaction_items DISABLE ROW LEVEL SECURITY;
