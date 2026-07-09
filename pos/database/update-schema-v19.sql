-- ==============================================================================
-- UPDATE SCHEMA V19: Shift Management, Inventory, Expenses, Deposits, Attendance
-- ==============================================================================

-- 1. Manajemen Stok & Inventaris
CREATE TABLE IF NOT EXISTS public.inventory_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    outlet_id UUID REFERENCES public.outlets(id) ON DELETE CASCADE,
    item_code TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT, -- 'bahan baku', 'pendukung', 'logistik'
    base_unit TEXT NOT NULL, -- satuan pakai e.g., 'kg', 'pcs'
    purchase_unit TEXT, -- satuan beli e.g., 'dus'
    conversion_factor NUMERIC DEFAULT 1, -- 1 dus = x kg
    stock_quantity NUMERIC DEFAULT 0, -- sisa stok dalam base_unit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Master Data Biaya Operasional
CREATE TABLE IF NOT EXISTS public.expense_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    outlet_id UUID REFERENCES public.outlets(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Master Shift
CREATE TABLE IF NOT EXISTS public.shifts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    outlet_id UUID REFERENCES public.outlets(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- 'Shift Pagi'
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Menambah shift default untuk user
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS shift_id UUID REFERENCES public.shifts(id) ON DELETE SET NULL;

-- 4. Shift Sessions (Drawer / POS Tracker)
CREATE TABLE IF NOT EXISTS public.shift_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    outlet_id UUID REFERENCES public.outlets(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    shift_id UUID REFERENCES public.shifts(id) ON DELETE SET NULL,
    status TEXT NOT NULL CHECK (status IN ('open', 'closed')),
    starting_cash NUMERIC DEFAULT 0,
    ending_cash NUMERIC DEFAULT 0,
    opened_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    closed_at TIMESTAMP WITH TIME ZONE
);

-- Mengaitkan transaksi POS dengan sesi shift kasir
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS shift_session_id UUID REFERENCES public.shift_sessions(id) ON DELETE SET NULL;

-- 5. Transaksi Biaya Operasional
CREATE TABLE IF NOT EXISTS public.operational_costs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    outlet_id UUID REFERENCES public.outlets(id) ON DELETE CASCADE,
    shift_session_id UUID REFERENCES public.shift_sessions(id) ON DELETE SET NULL,
    document_number TEXT NOT NULL,
    cost_date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_amount NUMERIC NOT NULL,
    notes TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.operational_cost_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    operational_cost_id UUID REFERENCES public.operational_costs(id) ON DELETE CASCADE,
    expense_item_id UUID REFERENCES public.expense_items(id) ON DELETE SET NULL,
    quantity NUMERIC NOT NULL,
    price NUMERIC NOT NULL,
    subtotal NUMERIC NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Absensi (Attendances)
CREATE TABLE IF NOT EXISTS public.attendances (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    outlet_id UUID REFERENCES public.outlets(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    shift_id UUID REFERENCES public.shifts(id) ON DELETE SET NULL,
    clock_in TIMESTAMP WITH TIME ZONE NOT NULL,
    clock_out TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Setoran Penjualan (Sales Deposits)
CREATE TABLE IF NOT EXISTS public.sales_deposits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    outlet_id UUID REFERENCES public.outlets(id) ON DELETE CASCADE,
    document_number TEXT NOT NULL,
    deposit_date DATE NOT NULL DEFAULT CURRENT_DATE,
    amount NUMERIC NOT NULL,
    account_type TEXT NOT NULL, -- 'bank', 'cash', etc.
    notes TEXT,
    status TEXT DEFAULT 'Diposting',
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================================
-- SETUP ROW LEVEL SECURITY (RLS)
-- ==============================================================================

-- Pastikan kolom outlet_id ada (berjaga-jaga jika tabel sudah pernah dibuat sebelumnya)
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS outlet_id UUID REFERENCES public.outlets(id) ON DELETE CASCADE;
ALTER TABLE public.expense_items ADD COLUMN IF NOT EXISTS outlet_id UUID REFERENCES public.outlets(id) ON DELETE CASCADE;
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS outlet_id UUID REFERENCES public.outlets(id) ON DELETE CASCADE;
ALTER TABLE public.shift_sessions ADD COLUMN IF NOT EXISTS outlet_id UUID REFERENCES public.outlets(id) ON DELETE CASCADE;
ALTER TABLE public.operational_costs ADD COLUMN IF NOT EXISTS outlet_id UUID REFERENCES public.outlets(id) ON DELETE CASCADE;
ALTER TABLE public.attendances ADD COLUMN IF NOT EXISTS outlet_id UUID REFERENCES public.outlets(id) ON DELETE CASCADE;
ALTER TABLE public.sales_deposits ADD COLUMN IF NOT EXISTS outlet_id UUID REFERENCES public.outlets(id) ON DELETE CASCADE;

-- Aktifkan RLS
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operational_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operational_cost_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_deposits ENABLE ROW LEVEL SECURITY;

-- Fungsi helper (jika belum ada)
-- public.get_my_role() mengembalikan text role user ('superadmin', 'kepala_toko', 'kasir')

-- 1. inventory_items
DROP POLICY IF EXISTS "Superadmin ALL inventory" ON public.inventory_items;
CREATE POLICY "Superadmin ALL inventory" ON public.inventory_items FOR ALL USING (public.get_my_role() = 'superadmin');
DROP POLICY IF EXISTS "Outlet ALL inventory" ON public.inventory_items;
CREATE POLICY "Outlet ALL inventory" ON public.inventory_items FOR ALL USING (
    outlet_id = public.get_my_outlet_id()
);

-- 2. expense_items
DROP POLICY IF EXISTS "Superadmin ALL expenses" ON public.expense_items;
CREATE POLICY "Superadmin ALL expenses" ON public.expense_items FOR ALL USING (public.get_my_role() = 'superadmin');
DROP POLICY IF EXISTS "Outlet ALL expenses" ON public.expense_items;
CREATE POLICY "Outlet ALL expenses" ON public.expense_items FOR ALL USING (
    outlet_id = public.get_my_outlet_id()
);

-- 3. shifts
DROP POLICY IF EXISTS "Superadmin ALL shifts" ON public.shifts;
CREATE POLICY "Superadmin ALL shifts" ON public.shifts FOR ALL USING (public.get_my_role() = 'superadmin');
DROP POLICY IF EXISTS "Outlet ALL shifts" ON public.shifts;
CREATE POLICY "Outlet ALL shifts" ON public.shifts FOR ALL USING (
    outlet_id = public.get_my_outlet_id()
);

-- 4. shift_sessions
DROP POLICY IF EXISTS "Superadmin ALL shift_sessions" ON public.shift_sessions;
CREATE POLICY "Superadmin ALL shift_sessions" ON public.shift_sessions FOR ALL USING (public.get_my_role() = 'superadmin');
DROP POLICY IF EXISTS "Outlet ALL shift_sessions" ON public.shift_sessions;
CREATE POLICY "Outlet ALL shift_sessions" ON public.shift_sessions FOR ALL USING (
    outlet_id = public.get_my_outlet_id()
);

-- 5. operational_costs
DROP POLICY IF EXISTS "Superadmin ALL op_costs" ON public.operational_costs;
CREATE POLICY "Superadmin ALL op_costs" ON public.operational_costs FOR ALL USING (public.get_my_role() = 'superadmin');
DROP POLICY IF EXISTS "Outlet ALL op_costs" ON public.operational_costs;
CREATE POLICY "Outlet ALL op_costs" ON public.operational_costs FOR ALL USING (
    outlet_id = public.get_my_outlet_id()
);

-- 6. operational_cost_items
DROP POLICY IF EXISTS "Superadmin ALL op_cost_items" ON public.operational_cost_items;
CREATE POLICY "Superadmin ALL op_cost_items" ON public.operational_cost_items FOR ALL USING (public.get_my_role() = 'superadmin');
DROP POLICY IF EXISTS "Outlet ALL op_cost_items" ON public.operational_cost_items;
CREATE POLICY "Outlet ALL op_cost_items" ON public.operational_cost_items FOR ALL USING (
    operational_cost_id IN (SELECT id FROM public.operational_costs WHERE outlet_id = public.get_my_outlet_id())
);

-- 7. attendances
DROP POLICY IF EXISTS "Superadmin ALL attendances" ON public.attendances;
CREATE POLICY "Superadmin ALL attendances" ON public.attendances FOR ALL USING (public.get_my_role() = 'superadmin');
DROP POLICY IF EXISTS "Outlet ALL attendances" ON public.attendances;
CREATE POLICY "Outlet ALL attendances" ON public.attendances FOR ALL USING (
    outlet_id = public.get_my_outlet_id()
);

-- 8. sales_deposits
DROP POLICY IF EXISTS "Superadmin ALL sales_deposits" ON public.sales_deposits;
CREATE POLICY "Superadmin ALL sales_deposits" ON public.sales_deposits FOR ALL USING (public.get_my_role() = 'superadmin');
DROP POLICY IF EXISTS "Outlet ALL sales_deposits" ON public.sales_deposits;
CREATE POLICY "Outlet ALL sales_deposits" ON public.sales_deposits FOR ALL USING (
    outlet_id = public.get_my_outlet_id()
);
