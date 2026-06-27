-- =====================================
-- PATCH V10: Database Size RPC
-- =====================================

-- Fungsi untuk mengambil ukuran database (dalam bytes)
-- SECURITY DEFINER membuat fungsi ini dieksekusi dengan hak akses pembuatnya,
-- sehingga pengguna bisa membaca pg_database_size.
CREATE OR REPLACE FUNCTION get_db_size()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT pg_database_size(current_database());
$$;
