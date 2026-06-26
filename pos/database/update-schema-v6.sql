-- =====================================
-- PATCH V6: Manager RBAC (Role Based Access Control)
-- =====================================

-- 1. Table Outlets
-- Kepala Cabang bisa insert/update/delete outlets di cabangnya
CREATE POLICY "Kepala_Cabang ALL outlet in branch" ON public.outlets 
FOR ALL TO authenticated 
USING ( 
    branch_id = (SELECT branch_id FROM public.profiles WHERE id = auth.uid())
    AND public.get_my_role() = 'kepala_cabang'
)
WITH CHECK (
    branch_id = (SELECT branch_id FROM public.profiles WHERE id = auth.uid())
    AND public.get_my_role() = 'kepala_cabang'
);

-- 2. Table Profiles (Users)
-- Kepala Cabang bisa update users yang memiliki branch_id yang sama dengannya, 
-- ATAU users baru yang belum punya branch_id (branch_id IS NULL) untuk 'di-claim' ke cabangnya
-- dengan syarat jabatan hanya kepala_toko atau kasir.
CREATE POLICY "Kepala_Cabang update profiles" ON public.profiles 
FOR UPDATE TO authenticated 
USING ( 
    public.get_my_role() = 'kepala_cabang' 
    AND (branch_id = (SELECT branch_id FROM public.profiles WHERE id = auth.uid()) OR branch_id IS NULL)
)
WITH CHECK (
    public.get_my_role() = 'kepala_cabang'
    AND branch_id = (SELECT branch_id FROM public.profiles WHERE id = auth.uid())
    AND role IN ('kepala_toko', 'kasir')
);

-- Kepala Toko bisa update users yang memiliki outlet_id yang sama dengannya,
-- ATAU users baru yang belum punya outlet_id (outlet_id IS NULL) untuk 'di-claim' ke tokonya
-- dengan syarat jabatan hanya kasir.
CREATE POLICY "Kepala_Toko update profiles" ON public.profiles 
FOR UPDATE TO authenticated 
USING ( 
    public.get_my_role() = 'kepala_toko' 
    AND (outlet_id = (SELECT outlet_id FROM public.profiles WHERE id = auth.uid()) OR outlet_id IS NULL)
)
WITH CHECK (
    public.get_my_role() = 'kepala_toko'
    AND outlet_id = (SELECT outlet_id FROM public.profiles WHERE id = auth.uid())
    AND branch_id = (SELECT branch_id FROM public.profiles WHERE id = auth.uid())
    AND role = 'kasir'
);

-- 3. Table Products
-- Kepala Cabang bisa mengelola semua produk di outlet-outlet yang berada di cabangnya.
CREATE POLICY "Kepala_Cabang ALL products in branch" ON public.products 
FOR ALL TO authenticated 
USING ( 
    public.get_my_role() = 'kepala_cabang'
    AND outlet_id IN (SELECT id FROM public.outlets WHERE branch_id = (SELECT branch_id FROM public.profiles WHERE id = auth.uid()))
)
WITH CHECK (
    public.get_my_role() = 'kepala_cabang'
    AND outlet_id IN (SELECT id FROM public.outlets WHERE branch_id = (SELECT branch_id FROM public.profiles WHERE id = auth.uid()))
);
