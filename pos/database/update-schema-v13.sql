-- =====================================
-- PATCH V13: Fix Kepala Toko Update Profiles Policy
-- =====================================

DROP POLICY IF EXISTS "Kepala_Toko update profiles" ON public.profiles;

CREATE POLICY "Kepala_Toko update profiles" ON public.profiles 
FOR UPDATE TO authenticated 
USING ( 
    public.get_my_role() = 'kepala_toko' 
    AND (outlet_id = (SELECT outlet_id FROM public.profiles WHERE id = auth.uid()) OR outlet_id IS NULL)
)
WITH CHECK (
    public.get_my_role() = 'kepala_toko'
    AND outlet_id = (SELECT outlet_id FROM public.profiles WHERE id = auth.uid())
    AND role = 'kasir'
);
