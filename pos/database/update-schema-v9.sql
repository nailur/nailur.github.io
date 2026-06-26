-- =====================================
-- PATCH V9: Attendance RLS for Managers
-- =====================================

-- Allow Superadmin and Owner to read ALL attendance
CREATE POLICY "Superadmin Owner view all attendance" ON public.attendance
FOR SELECT TO authenticated
USING ( public.get_my_role() IN ('superadmin', 'owner') );

-- Allow Kepala Cabang to read attendance from outlets in their branch
CREATE POLICY "Kepala_Cabang view branch attendance" ON public.attendance
FOR SELECT TO authenticated
USING ( 
    public.get_my_role() = 'kepala_cabang'
    AND outlet_id IN (SELECT id FROM public.outlets WHERE branch_id = (SELECT branch_id FROM public.profiles WHERE id = auth.uid()))
);

-- Allow Kepala Toko to read attendance from their outlet
CREATE POLICY "Kepala_Toko view outlet attendance" ON public.attendance
FOR SELECT TO authenticated
USING ( 
    public.get_my_role() = 'kepala_toko'
    AND outlet_id = (SELECT outlet_id FROM public.profiles WHERE id = auth.uid())
);
