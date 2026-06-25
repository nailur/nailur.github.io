-- 1. Update Profile Role Constraint
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('superadmin', 'kepala_toko', 'kasir'));

-- 2. Update Function handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (new.id, new.email, 'kasir'); -- Default role kasir, bisa diubah oleh superadmin
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Update Policies for Products
DROP POLICY IF EXISTS "Superadmin read all products" ON public.products;
DROP POLICY IF EXISTS "Admin read outlet products" ON public.products;
DROP POLICY IF EXISTS "Superadmin ALL products" ON public.products;
DROP POLICY IF EXISTS "Admin ALL outlet products" ON public.products;
DROP POLICY IF EXISTS "Outlet read outlet products" ON public.products;
DROP POLICY IF EXISTS "Kepala_Toko ALL outlet products" ON public.products;

CREATE POLICY "Superadmin read all products" ON public.products FOR SELECT TO authenticated USING ( (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superadmin' );
CREATE POLICY "Outlet read outlet products" ON public.products FOR SELECT TO authenticated USING ( outlet_id = (SELECT outlet_id FROM public.profiles WHERE id = auth.uid()) );
CREATE POLICY "Superadmin ALL products" ON public.products FOR ALL TO authenticated USING ( (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superadmin' );
CREATE POLICY "Kepala_Toko ALL outlet products" ON public.products FOR ALL TO authenticated USING ( 
    outlet_id = (SELECT outlet_id FROM public.profiles WHERE id = auth.uid()) 
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'kepala_toko' 
);

-- 4. Update Policies for Transactions
DROP POLICY IF EXISTS "Superadmin read all transactions" ON public.transactions;
DROP POLICY IF EXISTS "Admin read outlet transactions" ON public.transactions;
DROP POLICY IF EXISTS "Admin insert outlet transactions" ON public.transactions;
DROP POLICY IF EXISTS "Outlet read outlet transactions" ON public.transactions;
DROP POLICY IF EXISTS "Outlet insert outlet transactions" ON public.transactions;

CREATE POLICY "Superadmin read all transactions" ON public.transactions FOR SELECT TO authenticated USING ( (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superadmin' );
CREATE POLICY "Outlet read outlet transactions" ON public.transactions FOR SELECT TO authenticated USING ( outlet_id = (SELECT outlet_id FROM public.profiles WHERE id = auth.uid()) );
CREATE POLICY "Outlet insert outlet transactions" ON public.transactions FOR INSERT TO authenticated WITH CHECK ( outlet_id = (SELECT outlet_id FROM public.profiles WHERE id = auth.uid()) );

-- 5. Update Policies for Transaction Items
DROP POLICY IF EXISTS "Superadmin read all transaction_items" ON public.transaction_items;
DROP POLICY IF EXISTS "Admin read outlet transaction_items" ON public.transaction_items;
DROP POLICY IF EXISTS "Admin insert transaction_items" ON public.transaction_items;
DROP POLICY IF EXISTS "Outlet read outlet transaction_items" ON public.transaction_items;
DROP POLICY IF EXISTS "Outlet insert transaction_items" ON public.transaction_items;

CREATE POLICY "Superadmin read all transaction_items" ON public.transaction_items FOR SELECT TO authenticated USING ( (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superadmin' );
CREATE POLICY "Outlet read outlet transaction_items" ON public.transaction_items FOR SELECT TO authenticated USING ( 
    transaction_id IN (SELECT id FROM public.transactions WHERE outlet_id = (SELECT outlet_id FROM public.profiles WHERE id = auth.uid()))
);
CREATE POLICY "Outlet insert transaction_items" ON public.transaction_items FOR INSERT TO authenticated WITH CHECK ( true );
