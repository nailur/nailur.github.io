# Supabase RPC & Database Reference - NTGold App

Dokumen ini memuat daftar fungsi dan interaksi utama ke database Supabase dari aplikasi NTGold.

---

## 1. Daftar RPC & Fungsi Database

| Nama Fungsi / Prosedur | Parameter Input | Return Type | Deskripsi & Kegunaan |
|---|---|---|---|
| `handle_new_user` (Trigger Function) | (PL/pgSQL Trigger `auth.users`) | `trigger` | Secara otomatis membuat baris profil baru pada tabel `profiles` di Supabase setiap kali user baru mendaftar melalui `auth.signUp()`. |
| *Direct Supabase Queries* | `user_id`, `wallet_id` | `JSON` | NTGold menggunakan pemanggilan standar RLS REST API (`.from('wallets')`, `.from('portfolio')`, `.from('gold_price_history')`) tanpa RPC tambahan. |

---

## 2. Row Level Security (RLS) pada Tabel Utama
- **`wallets` & `portfolio`**:
  - `auth.uid() = user_id`: Pengguna hanya berhak membaca, menambah, mengubah, dan menghapus portofolio/transaksi milik sendiri.
- **`gold_price_history`**:
  - **SELECT (`public`)**: Dapat dibaca oleh semua orang tanpa autentikasi (untuk render grafik dan info harga emas di halaman utama).
  - **INSERT / UPDATE**: Hanya dapat diubah oleh serverless function Vercel yang memiliki `SUPABASE_SERVICE_ROLE_KEY` melalui cron job.
