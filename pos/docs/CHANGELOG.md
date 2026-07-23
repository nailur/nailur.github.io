# Changelog & Working History - NTPOS

Semua perubahan pada kode dan struktur proyek didokumentasikan di sini untuk menjaga agar konteks pekerjaan tetap terjaga di setiap sesi.

## [Unreleased]
*Catatan: Setiap kali fitur atau tugas baru diselesaikan, AI harus mencatat perubahannya pada bagian bawah (atau atas) tanggal hari ini.*

### 2026-07-23
- **Database (Bugfix)**: Mengidentifikasi dan memandu perbaikan anomali pada tabel `shift_sessions` di Supabase terkait zona waktu.
  - Menemukan bahwa kolom `opened_at` dan `closed_at` secara tidak sengaja terkonfigurasi sebagai `timestamp` tanpa timezone, menyebabkan bentrok ketika dikombinasikan dengan server Supabase yang menggunakan zona waktu UTC. Hal ini menyebabkan selisih perhitungan yang tampak melompat 7-14 jam di *frontend*.
  - Memberikan skrip SQL (`ALTER TABLE`) kepada pengguna untuk mengubah tipe kolom menjadi `timestamptz` (timestamp with time zone) agar selalu tersinkronisasi otomatis dengan browser apa pun zona waktunya.
  - Memberikan skrip `UPDATE` sementara untuk memulihkan data shift historis yang waktunya terpotong/lompat di antarmuka.
- **Documentation**: Memperbarui skema `pos/docs/Database_ERD.md` untuk memasukkan tabel `shift_sessions` secara rinci dan menegaskan penggunaan tipe data `timestamptz` yang bersifat kritikal untuk kolom `opened_at` dan `closed_at`.
- **Documentation**: Membuat file `CHANGELOG.md` ini untuk menyimpan riwayat teknis khusus untuk modul aplikasi POS.
