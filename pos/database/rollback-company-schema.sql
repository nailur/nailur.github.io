-- =========================================================================================
-- ROLLBACK SCRIPT: REMOVE MULTI-COMPANY ARCHITECTURE
-- =========================================================================================

-- 1. DROP NEW TABLES (IF THEY EXIST)
DROP TABLE IF EXISTS public.user_companies CASCADE;
DROP TABLE IF EXISTS public.companies CASCADE;

-- 2. DROP COMPANY_ID COLUMNS
ALTER TABLE public.profiles DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE public.branches DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE public.outlets DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE public.products DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE public.transactions DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE public.transaction_items DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE public.attendance DROP COLUMN IF EXISTS company_id CASCADE;

-- 3. DROP UTILITY FUNCTIONS
DROP FUNCTION IF EXISTS public.get_my_company_id();
DROP FUNCTION IF EXISTS public.get_workspace_role(UUID);
DROP FUNCTION IF EXISTS public.get_workspace_branch(UUID);
DROP FUNCTION IF EXISTS public.get_workspace_outlet(UUID);

-- 4. RESTORE ORIGINAL UTILITY FUNCTIONS
CREATE OR REPLACE FUNCTION public.get_my_role() RETURNS TEXT LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_my_outlet_id() RETURNS UUID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT outlet_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_my_branch_id() RETURNS UUID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT branch_id FROM public.profiles WHERE id = auth.uid();
$$;

-- 5. DROP ALL RLS POLICIES
DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN 
        SELECT tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename IN ('profiles', 'branches', 'outlets', 'products', 'transactions', 'transaction_items', 'attendance')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- 5. RE-APPLY STANDARD (NON-COMPANY) RLS POLICIES

-- PROFILES
CREATE POLICY "Superadmin ALL profiles" ON public.profiles FOR ALL TO authenticated USING ( public.get_my_role() = 'superadmin' );
CREATE POLICY "Owner ALL profiles" ON public.profiles FOR ALL TO authenticated USING ( public.get_my_role() = 'owner' );
CREATE POLICY "Kepala_Cabang ALL profiles in branch" ON public.profiles FOR ALL TO authenticated USING ( public.get_my_role() = 'kepala_cabang' AND branch_id = public.get_my_branch_id() );
CREATE POLICY "Self read/update" ON public.profiles FOR SELECT TO authenticated USING ( id = auth.uid() );
CREATE POLICY "Self update" ON public.profiles FOR UPDATE TO authenticated USING ( id = auth.uid() );

-- BRANCHES
CREATE POLICY "Superadmin ALL branches" ON public.branches FOR ALL TO authenticated USING ( public.get_my_role() = 'superadmin' );
CREATE POLICY "Owner ALL branches" ON public.branches FOR ALL TO authenticated USING ( public.get_my_role() = 'owner' );
CREATE POLICY "Employees READ branches" ON public.branches FOR SELECT TO authenticated USING ( true );

-- OUTLETS
CREATE POLICY "Superadmin ALL outlets" ON public.outlets FOR ALL TO authenticated USING ( public.get_my_role() = 'superadmin' );
CREATE POLICY "Owner ALL outlets" ON public.outlets FOR ALL TO authenticated USING ( public.get_my_role() = 'owner' );
CREATE POLICY "Employees READ outlets" ON public.outlets FOR SELECT TO authenticated USING ( true );

-- PRODUCTS
CREATE POLICY "Superadmin ALL products" ON public.products FOR ALL TO authenticated USING ( public.get_my_role() = 'superadmin' );
CREATE POLICY "Owner ALL products" ON public.products FOR ALL TO authenticated USING ( public.get_my_role() = 'owner' );
CREATE POLICY "Employees READ products" ON public.products FOR SELECT TO authenticated USING ( true );
CREATE POLICY "Employees INSERT products" ON public.products FOR INSERT TO authenticated WITH CHECK ( true );
CREATE POLICY "Employees UPDATE products" ON public.products FOR UPDATE TO authenticated USING ( true );
CREATE POLICY "Employees DELETE products" ON public.products FOR DELETE TO authenticated USING ( true );

-- TRANSACTIONS
CREATE POLICY "Superadmin ALL transactions" ON public.transactions FOR ALL TO authenticated USING ( public.get_my_role() = 'superadmin' );
CREATE POLICY "Owner ALL transactions" ON public.transactions FOR ALL TO authenticated USING ( public.get_my_role() = 'owner' );
CREATE POLICY "Employees READ transactions" ON public.transactions FOR SELECT TO authenticated USING ( true );
CREATE POLICY "Employees INSERT transactions" ON public.transactions FOR INSERT TO authenticated WITH CHECK ( true );
CREATE POLICY "Employees DELETE transactions" ON public.transactions FOR DELETE TO authenticated USING ( public.get_my_role() = 'owner' OR public.get_my_role() = 'superadmin' );

-- TRANSACTION ITEMS
CREATE POLICY "Superadmin ALL transaction_items" ON public.transaction_items FOR ALL TO authenticated USING ( public.get_my_role() = 'superadmin' );
CREATE POLICY "Owner ALL transaction_items" ON public.transaction_items FOR ALL TO authenticated USING ( public.get_my_role() = 'owner' );
CREATE POLICY "Employees READ transaction_items" ON public.transaction_items FOR SELECT TO authenticated USING ( true );
CREATE POLICY "Employees INSERT transaction_items" ON public.transaction_items FOR INSERT TO authenticated WITH CHECK ( true );

-- ATTENDANCE
CREATE POLICY "Superadmin ALL attendance" ON public.attendance FOR ALL TO authenticated USING ( public.get_my_role() = 'superadmin' );
CREATE POLICY "Owner ALL attendance" ON public.attendance FOR ALL TO authenticated USING ( public.get_my_role() = 'owner' );
CREATE POLICY "Employees READ attendance" ON public.attendance FOR SELECT TO authenticated USING ( true );
CREATE POLICY "Employees INSERT attendance" ON public.attendance FOR INSERT TO authenticated WITH CHECK ( true );
CREATE POLICY "Employees UPDATE attendance" ON public.attendance FOR UPDATE TO authenticated USING ( true );
