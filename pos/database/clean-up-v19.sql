-- Hapus tabel lama yang tidak sesuai schema baru
DROP TABLE IF EXISTS public.sales_deposits CASCADE;
DROP TABLE IF EXISTS public.operational_cost_items CASCADE;
DROP TABLE IF EXISTS public.operational_costs CASCADE;
DROP TABLE IF EXISTS public.attendances CASCADE;
DROP TABLE IF EXISTS public.shift_sessions CASCADE;
DROP TABLE IF EXISTS public.shifts CASCADE;

-- (Tabel Inventory & Expense Master tidak di-drop agar data lama Anda jika ada tidak hilang)
