-- =====================================
-- PATCH V11: Attendance Report RPC & DELETE Policies
-- =====================================

-- 1. Fungsi RPC untuk Riwayat Absensi Dinamis (PRS/OFF)
CREATE OR REPLACE FUNCTION get_attendance_report(p_start_date DATE, p_end_date DATE)
RETURNS TABLE (
    record_date DATE,
    profile_id UUID,
    name TEXT,
    email TEXT,
    role TEXT,
    branch_name TEXT,
    outlet_name TEXT,
    clock_in TIMESTAMP WITH TIME ZONE,
    clock_out TIMESTAMP WITH TIME ZONE,
    status TEXT
) AS $$
DECLARE
    caller_role TEXT;
    caller_branch_id UUID;
    caller_outlet_id UUID;
BEGIN
    caller_role := public.get_my_role();
    
    IF caller_role = 'kepala_cabang' THEN
        SELECT branch_id INTO caller_branch_id FROM public.profiles WHERE id = auth.uid();
    ELSIF caller_role = 'kepala_toko' THEN
        SELECT outlet_id INTO caller_outlet_id FROM public.profiles WHERE id = auth.uid();
    END IF;

    RETURN QUERY
    WITH date_series AS (
        SELECT generate_series(p_start_date::timestamp, p_end_date::timestamp, '1 day'::interval)::date AS d
    ),
    target_users AS (
        SELECT p.id, p.name, p.email, p.role, o.name AS outlet_name, b.name AS branch_name, p.outlet_id, o.branch_id
        FROM public.profiles p
        LEFT JOIN public.outlets o ON p.outlet_id = o.id
        LEFT JOIN public.branches b ON o.branch_id = b.id
        WHERE p.role IN ('kasir', 'kepala_toko')
        AND (
            caller_role IN ('superadmin', 'owner')
            OR (caller_role = 'kepala_cabang' AND o.branch_id = caller_branch_id)
            OR (caller_role = 'kepala_toko' AND p.outlet_id = caller_outlet_id)
        )
    )
    SELECT 
        ds.d AS record_date,
        tu.id AS profile_id,
        tu.name,
        tu.email,
        tu.role,
        tu.branch_name,
        tu.outlet_name,
        a.clock_in,
        a.clock_out,
        CASE WHEN a.clock_in IS NOT NULL THEN 'PRS' ELSE 'OFF' END AS status
    FROM date_series ds
    CROSS JOIN target_users tu
    LEFT JOIN public.attendance a ON a.profile_id = tu.id AND a.date = ds.d
    ORDER BY ds.d DESC, tu.name ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Kebijakan DELETE untuk Profiles (User Management)
-- Kepala Cabang menghapus profil kasir/kepala_toko di cabangnya
CREATE POLICY "Kepala_Cabang delete profiles" ON public.profiles 
FOR DELETE TO authenticated 
USING ( 
    public.get_my_role() = 'kepala_cabang' 
    AND branch_id = (SELECT branch_id FROM public.profiles WHERE id = auth.uid())
    AND role IN ('kepala_toko', 'kasir')
);

-- Kepala Toko menghapus profil kasir di tokonya
CREATE POLICY "Kepala_Toko delete profiles" ON public.profiles 
FOR DELETE TO authenticated 
USING ( 
    public.get_my_role() = 'kepala_toko' 
    AND outlet_id = (SELECT outlet_id FROM public.profiles WHERE id = auth.uid())
    AND role = 'kasir'
);
