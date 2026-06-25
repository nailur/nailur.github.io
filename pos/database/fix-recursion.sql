-- Fungsi ini akan mengambil role user tanpa memicu RLS (karena SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

-- Hapus policy yang menyebabkan infinite recursion
DROP POLICY IF EXISTS "Enable ALL profiles for superadmin" ON public.profiles;

-- Buat ulang policy menggunakan fungsi get_my_role()
CREATE POLICY "Enable ALL profiles for superadmin" ON public.profiles 
FOR ALL TO authenticated 
USING ( public.get_my_role() = 'superadmin' );
