-- ==========================================
-- PATCH 1A & 3A: Security RLS & Indexes
-- ==========================================

-- 1. Fix RLS for global_discounts (from v21)
DROP POLICY IF EXISTS "Allow all access to global_discounts for authenticated users" ON public.global_discounts;

CREATE POLICY "Enable SELECT for active discounts" ON public.global_discounts 
FOR SELECT TO authenticated USING (is_active = true);

CREATE POLICY "Enable ALL for superadmin and owner" ON public.global_discounts 
FOR ALL TO authenticated USING (
    public.get_my_role() IN ('superadmin', 'owner')
);

-- 2. Fix RLS for products (from rollback-company-schema)
DROP POLICY IF EXISTS "Employees INSERT products" ON public.products;
DROP POLICY IF EXISTS "Employees UPDATE products" ON public.products;
DROP POLICY IF EXISTS "Employees DELETE products" ON public.products;

CREATE POLICY "Staff INSERT products" ON public.products 
FOR INSERT TO authenticated WITH CHECK (
    outlet_id = (SELECT outlet_id FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "Staff UPDATE products" ON public.products 
FOR UPDATE TO authenticated USING (
    outlet_id = (SELECT outlet_id FROM public.profiles WHERE id = auth.uid())
);

-- 3. Fix RLS for transaction_items 
DROP POLICY IF EXISTS "Employees INSERT transaction_items" ON public.transaction_items;
DROP POLICY IF EXISTS "Outlet insert transaction_items" ON public.transaction_items;
DROP POLICY IF EXISTS "TransactionItems INSERT policy" ON public.transaction_items;

-- (Insert transaction_items usually happens safely via RPC process_checkout, but if direct, restrict it)
CREATE POLICY "Staff INSERT transaction_items" ON public.transaction_items 
FOR INSERT TO authenticated WITH CHECK (
    transaction_id IN (SELECT id FROM public.transactions WHERE outlet_id = (SELECT outlet_id FROM public.profiles WHERE id = auth.uid()))
);

-- 4. Fix RLS for attendance
DROP POLICY IF EXISTS "Employees INSERT attendance" ON public.attendance;
DROP POLICY IF EXISTS "Employees UPDATE attendance" ON public.attendance;

CREATE POLICY "Staff INSERT attendance" ON public.attendance 
FOR INSERT TO authenticated WITH CHECK (
    profile_id = auth.uid()
);

CREATE POLICY "Staff UPDATE attendance" ON public.attendance 
FOR UPDATE TO authenticated USING (
    profile_id = auth.uid()
);

-- 5. Create Indexes for Performance (Poin 3A - Bonus eksekusi sekalian di file SQL yang sama)
CREATE INDEX IF NOT EXISTS idx_transactions_outlet_id ON public.transactions(outlet_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON public.transactions(created_at);

CREATE INDEX IF NOT EXISTS idx_transaction_items_trx_id ON public.transaction_items(transaction_id);

CREATE INDEX IF NOT EXISTS idx_products_outlet_id ON public.products(outlet_id);

CREATE INDEX IF NOT EXISTS idx_inventory_items_outlet_id ON public.inventory_items(outlet_id);

CREATE INDEX IF NOT EXISTS idx_expense_items_outlet_id ON public.expense_items(outlet_id);

CREATE INDEX IF NOT EXISTS idx_global_discounts_outlet_id ON public.global_discounts(outlet_id);
