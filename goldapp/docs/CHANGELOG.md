# Changelog & Working History

Semua perubahan pada kode dan struktur proyek didokumentasikan di sini untuk menjaga agar konteks pekerjaan tetap terjaga di setiap sesi.

## [Unreleased]
*Catatan: Setiap kali fitur atau tugas baru diselesaikan, AI harus mencatat perubahannya pada bagian bawah (atau atas) tanggal hari ini.*

### 2026-07-22
- **Documentation**: Membuat inisialisasi dokumen arsitektur proyek (PRD, Database ERD, Tech Stack).
- **Setup**: Mengkonfigurasi folder `docs/` untuk menyimpan riwayat pekerjaan, environment variables map, dan file Changelog ini.
- **Rules**: Mengatur aturan di `.agents/AGENTS.md` untuk selalu memperbarui file ini setelah adanya modifikasi kode di sesi mendatang.
- **Cleanup**: Menghapus lebih dari 30+ file skrip sementara (`.cjs`, `_temp.js`) dan file *backup* (`posOld_index.html`) yang sudah usang di *root directory*.
- **Feature (POS)**: Menambahkan fitur kondisi "Minimal Belanja" pada modal Tambah Diskon (di dalam *app* POS), di mana diskon hanya akan teraplikasikan di checkout keranjang jika total belanja mencapai batas minimal yang ditentukan.
- **Bugfix (POS)**: Memperbaiki masalah tampilan angka desimal pada chart Omset Bersih vs Setoran (di dashboard) dan pada saat kalkulasi diskon persentase di keranjang. Menggunakan `Math.ceil` (pembulatan ke atas) pada perhitungan potongan MDR dashboard agar angka desimal 0.5 selalu naik ke atas.
- **Feature Update (POS)**: Mengubah implementasi "Minimal Belanja" dari global (berlaku untuk semua metode pembayaran) menjadi *per-metode pembayaran*. Ini memungkinkan setiap metode pembayaran memiliki syarat batas minimal belanja dan nominal diskon yang berbeda (contoh: GoFood minimal Rp 0 dapat diskon 4000, ShopeeFood minimal Rp 25.000 dapat diskon 5000).
