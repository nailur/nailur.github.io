# NTPOS - Point of Sale Application Summary

Dokumen ini berisi rangkuman fitur, keunggulan, dan daftar pustaka pihak ketiga (3rd party libraries) yang digunakan pada aplikasi NTPOS.

## 🚀 Fitur Utama & Poin Plus (Keunggulan)

Aplikasi ini dibangun dengan arsitektur modern (Serverless & PWA) yang menawarkan berbagai fitur lengkap untuk manajemen kasir dan operasional toko.

### 1. Progressive Web App (PWA) & Offline Support
- Dapat diinstal seperti aplikasi native di perangkat Mobile (Android/iOS) maupun Desktop.
- Mendukung mode offline/cache, sehingga aplikasi dapat dimuat lebih cepat.

### 2. Sistem Autentikasi & Multi-Role
- Login yang aman terintegrasi dengan backend.
- Fitur Lupa Password & Reset Password.
- Mendukung pemisahan role/akses: **Superadmin** dan **Kasir/Admin**.

### 3. Manajemen Sistem (Superadmin Dashboard)
- **Kelola Cabang:** Menambahkan dan mengatur data cabang toko.
- **Kelola Outlet:** Menambahkan outlet spesifik dan mengaitkannya dengan cabang.
- **Kelola User/Pengguna:** Mengatur akun staf, menentukan role, dan menempatkan mereka pada cabang/outlet tertentu.
- **Analitik & Laporan Lanjutan:** 
  - Grafik visualisasi data (Chart.js) untuk pendapatan, penjualan produk, dan metode pembayaran.
  - Filter laporan berdasarkan outlet dan periode waktu (7 hari, 30 hari, bulan ini, dll).
  - Ringkasan total pendapatan, jumlah transaksi, total diskon, pajak, dan item terjual.
- **Info Server:** Memantau penggunaan sumber daya database (Supabase) dan penyimpanan *hosting* (GitHub Pages) secara *real-time*.
- **Sistem Pengumuman (Broadcast):** Superadmin dapat mengirim pesan notifikasi massal ke semua perangkat kasir yang sedang aktif.

### 4. Modul Kasir / POS (Admin/Kasir)
- **Katalog Produk:** Tampilan grid/list produk dengan fitur pencarian real-time.
- **Manajemen Keranjang (Cart):** Memproses pesanan, menghitung subtotal, diskon, pajak, dan total akhir.
- **Pembayaran:** Mendukung berbagai metode pembayaran (Tunai, Transfer, E-Wallet, dll).
- **Koneksi Printer Bluetooth:** Terintegrasi dengan printer thermal bluetooth untuk mencetak struk secara langsung.

### 5. Absensi Kehadiran (Attendance)
- Fitur *Clock In* / *Clock Out* untuk mencatat jam kerja kasir secara otomatis.
- Riwayat absensi lengkap dengan filter tanggal dan fitur ekspor ke Excel.

### 6. Riwayat Transaksi & Dashboard Harian
- Melihat riwayat transaksi lengkap dengan detail diskon, pajak, metode pembayaran, dll.
- Filter transaksi berdasarkan periode tanggal.
- Fitur **Export to Excel** untuk rekapitulasi data penjualan.
- Dashboard kasir untuk melihat ringkasan performa harian (pendapatan, produk terlaris, metode pembayaran yang sering digunakan).

### 7. Optimasi Performa (Image Compression)
- Terdapat sistem otomatis untuk mengompresi gambar di sisi klien (browser) sebelum diunggah ke server.
- Meringankan beban penyimpanan (storage) server, menghemat *bandwidth*, serta mempercepat proses sinkronisasi dan waktu muat (loading) aplikasi.

---

## 🛠️ Daftar 3rd Party Libraries & Integrasi

Aplikasi ini memanfaatkan beberapa layanan dan pustaka eksternal untuk memperkaya fungsinya tanpa membebani performa aplikasi itu sendiri:

1. **[Supabase](https://supabase.com/)** (`@supabase/supabase-js`)
   - Digunakan sebagai *Backend-as-a-Service* (BaaS).
   - Menangani Database (PostgreSQL), Autentikasi User, dan API secara serverless.

2. **[Phosphor Icons](https://phosphoricons.com/)** (`@phosphor-icons/web`)
   - Digunakan untuk sistem ikon UI yang modern, bersih, dan konsisten di seluruh antarmuka aplikasi.

3. **[SheetJS](https://sheetjs.com/)** (`xlsx.full.min.js`)
   - Digunakan untuk fitur pemrosesan data ke format Spreadsheet.
   - Memungkinkan pengguna untuk mengekspor data laporan transaksi dan riwayat absensi menjadi file Excel (.xlsx).

4. **[Chart.js](https://www.chartjs.org/)** (`chart.js`)
   - Digunakan pada modul Analitik & Dashboard untuk membuat grafik interaktif (Visualisasi Data Pendapatan, Penjualan Produk, dan Metode Pembayaran).
