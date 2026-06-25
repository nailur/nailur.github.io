-- =====================================
-- PATCH V2: Cabang & Roles Baru
-- =====================================

-- 1. Buat tabel Branches (Cabang)
CREATE TABLE IF NOT EXISTS public.branches (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

-- 2. Tambahkan kolom branch_id ke outlets dan profiles
ALTER TABLE public.outlets ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;

-- 3. Update Role Constraint di profiles
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('superadmin', 'owner', 'kepala_cabang', 'kepala_toko', 'kasir'));

-- 4. Buat Fungsi Helper (Security Definer)
CREATE OR REPLACE FUNCTION public.get_my_role() RETURNS TEXT LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_my_outlet_id() RETURNS UUID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT outlet_id FROM profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_my_branch_id() RETURNS UUID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT branch_id FROM profiles WHERE id = auth.uid();
$$;

-- 5. Perbarui Kebijakan (Policies) Branches
DROP POLICY IF EXISTS "Enable read branches for authenticated" ON public.branches;
DROP POLICY IF EXISTS "Enable ALL branches for superadmin/owner" ON public.branches;
CREATE POLICY "Enable read branches for authenticated" ON public.branches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable ALL branches for superadmin/owner" ON public.branches FOR ALL TO authenticated USING ( public.get_my_role() IN ('superadmin', 'owner') );

-- 6. Perbarui Kebijakan (Policies) Outlets
DROP POLICY IF EXISTS "Enable read for authenticated users" ON public.outlets;
DROP POLICY IF EXISTS "Enable ALL for superadmin" ON public.outlets;
CREATE POLICY "Enable read outlets" ON public.outlets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable ALL outlets for superadmin/owner" ON public.outlets FOR ALL TO authenticated USING ( public.get_my_role() IN ('superadmin', 'owner') );

-- 7. Perbarui Kebijakan (Policies) Profiles
DROP POLICY IF EXISTS "Enable read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Enable ALL profiles for superadmin" ON public.profiles;
CREATE POLICY "Enable read profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable ALL profiles for superadmin/owner" ON public.profiles FOR ALL TO authenticated USING ( public.get_my_role() IN ('superadmin', 'owner') );

-- 8. Perbarui Kebijakan (Policies) Products
DROP POLICY IF EXISTS "Superadmin read all products" ON public.products;
DROP POLICY IF EXISTS "Outlet read outlet products" ON public.products;
DROP POLICY IF EXISTS "Superadmin ALL products" ON public.products;
DROP POLICY IF EXISTS "Kepala_Toko ALL outlet products" ON public.products;
DROP POLICY IF EXISTS "Products SELECT policy" ON public.products;
DROP POLICY IF EXISTS "Products ALL policy" ON public.products;

CREATE POLICY "Products SELECT policy" ON public.products FOR SELECT TO authenticated USING (
    public.get_my_role() IN ('superadmin', 'owner') OR
    (public.get_my_role() = 'kepala_cabang' AND outlet_id IN (SELECT id FROM public.outlets WHERE branch_id = public.get_my_branch_id())) OR
    (public.get_my_role() IN ('kepala_toko', 'kasir') AND outlet_id = public.get_my_outlet_id())
);

CREATE POLICY "Products ALL policy" ON public.products FOR ALL TO authenticated USING (
    public.get_my_role() IN ('superadmin', 'owner') OR
    (public.get_my_role() = 'kepala_cabang' AND outlet_id IN (SELECT id FROM public.outlets WHERE branch_id = public.get_my_branch_id())) OR
    (public.get_my_role() = 'kepala_toko' AND outlet_id = public.get_my_outlet_id())
);

-- 9. Perbarui Kebijakan (Policies) Transactions
DROP POLICY IF EXISTS "Superadmin read all transactions" ON public.transactions;
DROP POLICY IF EXISTS "Outlet read outlet transactions" ON public.transactions;
DROP POLICY IF EXISTS "Outlet insert outlet transactions" ON public.transactions;
DROP POLICY IF EXISTS "Transactions SELECT policy" ON public.transactions;
DROP POLICY IF EXISTS "Transactions INSERT policy" ON public.transactions;

CREATE POLICY "Transactions SELECT policy" ON public.transactions FOR SELECT TO authenticated USING (
    public.get_my_role() IN ('superadmin', 'owner') OR
    (public.get_my_role() = 'kepala_cabang' AND outlet_id IN (SELECT id FROM public.outlets WHERE branch_id = public.get_my_branch_id())) OR
    (public.get_my_role() IN ('kepala_toko', 'kasir') AND outlet_id = public.get_my_outlet_id())
);

CREATE POLICY "Transactions INSERT policy" ON public.transactions FOR INSERT TO authenticated WITH CHECK (
    public.get_my_role() IN ('superadmin', 'owner') OR
    (public.get_my_role() = 'kepala_cabang' AND outlet_id IN (SELECT id FROM public.outlets WHERE branch_id = public.get_my_branch_id())) OR
    (public.get_my_role() IN ('kepala_toko', 'kasir') AND outlet_id = public.get_my_outlet_id())
);

-- 10. Perbarui Kebijakan (Policies) Transaction Items
DROP POLICY IF EXISTS "Superadmin read all transaction_items" ON public.transaction_items;
DROP POLICY IF EXISTS "Outlet read outlet transaction_items" ON public.transaction_items;
DROP POLICY IF EXISTS "Outlet insert transaction_items" ON public.transaction_items;
DROP POLICY IF EXISTS "TransactionItems SELECT policy" ON public.transaction_items;
DROP POLICY IF EXISTS "TransactionItems INSERT policy" ON public.transaction_items;

CREATE POLICY "TransactionItems SELECT policy" ON public.transaction_items FOR SELECT TO authenticated USING (
    public.get_my_role() IN ('superadmin', 'owner') OR
    (public.get_my_role() = 'kepala_cabang' AND transaction_id IN (SELECT id FROM public.transactions WHERE outlet_id IN (SELECT id FROM public.outlets WHERE branch_id = public.get_my_branch_id()))) OR
    (public.get_my_role() IN ('kepala_toko', 'kasir') AND transaction_id IN (SELECT id FROM public.transactions WHERE outlet_id = public.get_my_outlet_id()))
);

CREATE POLICY "TransactionItems INSERT policy" ON public.transaction_items FOR INSERT TO authenticated WITH CHECK ( true );
