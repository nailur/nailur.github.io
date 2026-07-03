-- Mengaktifkan RLS pada semua tabel utama
ALTER TABLE public.outlets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- 1. Tabel Profiles (Semua user yang login bisa membaca profil, tapi hanya bisa mengubah profilnya sendiri kecuali superadmin)
CREATE POLICY "Allow read profiles for authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- 2. Tabel Cabang (Semua user login bisa membaca)
CREATE POLICY "Allow read branches for authenticated" ON public.branches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow all branches for superadmin" ON public.branches FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'superadmin')
);

-- 3. Tabel Outlet (Semua user login bisa membaca)
CREATE POLICY "Allow read outlets for authenticated" ON public.outlets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow all outlets for superadmin" ON public.outlets FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'superadmin')
);

-- 4. Tabel Produk (Semua user login bisa membaca)
CREATE POLICY "Allow read products for authenticated" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow all products for superadmin and kepala_cabang" ON public.products FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('superadmin', 'kepala_cabang'))
);

-- 5. Tabel Transaksi (Hanya kasir yang bersangkutan, kepala cabang, atau superadmin)
CREATE POLICY "Allow read transactions" ON public.transactions FOR SELECT TO authenticated USING (
    cashier_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('superadmin', 'kepala_cabang'))
);
CREATE POLICY "Allow insert transactions" ON public.transactions FOR INSERT TO authenticated WITH CHECK (
    cashier_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('superadmin', 'kepala_cabang'))
);
CREATE POLICY "Allow update transactions" ON public.transactions FOR UPDATE TO authenticated USING (
    cashier_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('superadmin', 'kepala_cabang'))
);

-- 6. Tabel Transaction Items
CREATE POLICY "Allow read transaction items" ON public.transaction_items FOR SELECT TO authenticated USING (
    EXISTS (
        SELECT 1 FROM public.transactions t 
        WHERE t.id = transaction_id AND (
            t.cashier_id = auth.uid() OR 
            EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('superadmin', 'kepala_cabang'))
        )
    )
);
CREATE POLICY "Allow insert transaction items" ON public.transaction_items FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.transactions t 
        WHERE t.id = transaction_id AND (
            t.cashier_id = auth.uid() OR 
            EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('superadmin', 'kepala_cabang'))
        )
    )
);

-- 7. Tabel Attendance
CREATE POLICY "Allow read attendance" ON public.attendance FOR SELECT TO authenticated USING (
    profile_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('superadmin', 'kepala_cabang'))
);
CREATE POLICY "Allow insert attendance" ON public.attendance FOR INSERT TO authenticated WITH CHECK (
    profile_id = auth.uid()
);
CREATE POLICY "Allow update attendance" ON public.attendance FOR UPDATE TO authenticated USING (
    profile_id = auth.uid()
);
