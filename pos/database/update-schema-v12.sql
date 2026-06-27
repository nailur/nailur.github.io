-- =====================================
-- PATCH V12: Fix Attendance RPC for Kepala Cabang & Future Dates
-- =====================================

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
    actual_end_date DATE;
BEGIN
    caller_role := public.get_my_role();
    
    IF caller_role = 'kepala_cabang' THEN
        SELECT branch_id INTO caller_branch_id FROM public.profiles WHERE id = auth.uid();
    ELSIF caller_role = 'kepala_toko' THEN
        SELECT outlet_id INTO caller_outlet_id FROM public.profiles WHERE id = auth.uid();
    END IF;

    -- Cegah memunculkan OFF di future date (tanggal besok dan seterusnya)
    IF p_end_date > CURRENT_DATE THEN
        actual_end_date := CURRENT_DATE;
    ELSE
        actual_end_date := p_end_date;
    END IF;

    RETURN QUERY
    WITH date_series AS (
        SELECT generate_series(p_start_date::timestamp, actual_end_date::timestamp, '1 day'::interval)::date AS d
    ),
    target_users AS (
        SELECT p.id, p.name, p.email, p.role, o.name AS outlet_name, COALESCE(b.name, b2.name) AS branch_name, p.outlet_id, COALESCE(o.branch_id, p.branch_id) AS user_branch_id
        FROM public.profiles p
        LEFT JOIN public.outlets o ON p.outlet_id = o.id
        LEFT JOIN public.branches b ON o.branch_id = b.id
        LEFT JOIN public.branches b2 ON p.branch_id = b2.id
        WHERE p.role IN ('kasir', 'kepala_toko', 'kepala_cabang')
        AND (
            caller_role IN ('superadmin', 'owner')
            OR (caller_role = 'kepala_cabang' AND (o.branch_id = caller_branch_id OR p.branch_id = caller_branch_id))
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
