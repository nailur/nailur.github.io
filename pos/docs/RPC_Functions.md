# Supabase RPC & Database Functions Reference - NTPOS

Dokumen ini memuat daftar Stored Functions / RPC bawaan di database Supabase yang sering dipanggil dari kode JavaScript NTPOS melalui `supabase.rpc('function_name', { params })`.

---

## 1. Daftar RPC & Parameter Pemanggilannya

| Nama Fungsi RPC | Parameter Input (`params`) | Return Type | Deskripsi & Tujuan Kegunaan |
|---|---|---|---|
| `generate_receipt_no` | `{ p_outlet_id: uuid }` | `text` (nomor struk) | Membuat nomor struk urut otomatis per outlet (contoh: `INV-20260731-0001`). Digunakan sebagai default nomor transaksi baru. |
| `update_inventory_stock_from_posting` | (Trigger-based / No manual RPC) | `void` | Trigger otomatis yang memperbarui kolom `current_stock` pada `inventory_items` setelah baris baru di-insert ke `inventory_posting_items`. |
| `get_my_role` | (None) | `text` (`'superadmin'`, `'owner'`, `'kasir'`, dll) | Mengembalikan role user dari tabel `profiles` berdasarkan `auth.uid()`. |
| `get_my_outlet_id` | (None) | `uuid` | Mengembalikan ID outlet yang ditugaskan pada profile user yang sedang login. |
| `get_my_branch_id` | (None) | `uuid` | Mengembalikan ID branch dari profile user yang sedang login. |
| `is_superadmin` | (None) | `boolean` | Cepat memeriksa apakah user yang login saat ini adalah superadmin. |
| `get_db_size` | (None) | `bigint` / `text` | Menampilkan ukuran penyimpanan database saat ini (khusus Superadmin di tab Pengaturan). |

---

## 2. Catatan Akses RLS pada RPC
- **Superadmin**: Berhak memanggil seluruh fungsi manajemen & laporan global.
- **Owner**: Berhak memanggil fungsi *read-only* & kalkulasi laporan di seluruh outlet miliknya.
- **Kasir / Staf**: Berhak memanggil fungsi transaksi dan pengecekan absensi/shift di lingkup `outlet_id` masing-masing.
