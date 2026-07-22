# Product Requirements Document (PRD) - NTPOS

## 1. Introduction
NTPOS adalah sistem kasir (Point of Sale) terpadu yang dibangun dengan arsitektur **Progressive Web App (PWA)** dan **Serverless** backend. Sistem ini dirancang untuk memfasilitasi transaksi toko dengan cepat (mendukung mode offline), sekaligus memberikan kontrol manajemen tingkat tinggi secara berjenjang untuk bisnis multi-cabang.

## 2. Target Audience & Roles
Sistem menggunakan pendekatan *Multi-Role* yang ketat (diatur via Supabase RLS):
- **Superadmin**: Akses penuh ke seluruh sistem, cabang, outlet, dan pengaturan pengguna.
- **Owner**: Pemilik bisnis dengan akses baca (monitoring) atau pengelolaan level atas ke seluruh cabang.
- **Kepala Cabang**: Mengelola operasional beberapa outlet di bawah satu cabang tertentu.
- **Kepala Toko**: Mengelola produk, stok, absensi, dan memantau transaksi spesifik pada 1 outlet.
- **Kasir**: Menjalankan transaksi harian, absensi, dan pengelolaan laci uang (*Cash Drawer*).

## 3. Core Features

### 3.1. Modul POS (Point of Sale) & Transaksi
- **Katalog & Modifiers**: Pencarian produk secara *real-time*, dukungan *Modifiers* (opsi tambahan pada produk seperti *Topping*, Ukuran).
- **Manajemen Keranjang (Cart)**: Kalkulasi subtotal, pajak, diskon (global maupun per-item), dan total akhir.
- **Metode Pembayaran**: Fleksibilitas metode pembayaran (Cash, Transfer, E-Wallet, dll).
- **Manajemen Struk & Printer**: Pencetakan struk langsung menggunakan Printer Thermal Bluetooth, dukungan fitur *Void* transaksi.
- **Offline Support**: Aplikasi tetap dapat digunakan meski koneksi terputus berkat Service Worker dan *Caching*.

### 3.2. Manajemen Kasir & Shift (Cash Drawer)
- Pencatatan saldo awal laci uang (*Starting Cash*).
- Validasi penutupan shift (*End Time* / *Ending Cash*).
- Menghindari manipulasi data dengan pencatatan otomatis transaksi pada sesi yang aktif.

### 3.3. Manajemen Inventaris & Operasional
- **Inventory Postings**: Sistem stok masuk/keluar (In/Out) dengan rasio konversi (*conversion rate*) dari satuan besar ke satuan kecil.
- **Biaya Operasional (Operational Costs)**: Pencatatan pengeluaran harian toko yang mengikat pada sesi shift kasir.
- **Setoran Penjualan (Sales Deposits)**: Fitur pelaporan uang fisik yang disetorkan ke bank/rekening tujuan.

### 3.4. Kepegawaian & Absensi (Attendance)
- Modul *Clock In* dan *Clock Out* untuk mencatat jam kehadiran.
- Terhubung langsung dengan profil pengguna dan outlet tempat bekerja.

### 3.5. Analitik, Laporan & Notifikasi
- **Dashboard Summary**: Laporan visual (grafik dengan Chart.js) mencakup pendapatan, produk terlaris, dan rasio metode pembayaran.
- **Eksport Excel**: Kemampuan mengunduh riwayat transaksi dan absensi menggunakan SheetJS.
- **Push Notification**: Sistem *Broadcast* dari Superadmin ke seluruh perangkat (Mobile/Desktop) melalui OneSignal.
- **Optimasi Gambar**: Otomatisasi kompresi gambar di klien (*Browser Image Compression*) sebelum masuk ke database.

## 4. User Flow (Kasir)
1. **Clock-in & Shift Open**: Kasir masuk, melakukan absen, dan membuka *Cash Drawer* dengan memasukkan modal awal.
2. **Transaksi**: Kasir memilih produk, menambahkan *modifiers* jika ada, menerapkan diskon, lalu memproses pembayaran (*Checkout*).
3. **Closing Shift**: Saat selesai bekerja, kasir menutup *Cash Drawer*, menghitung sisa kas fisik, dan mencatat *Operational Costs* (jika ada).
4. **Sinkronisasi**: Jika transaksi dilakukan secara *offline*, sistem akan memantau konektivitas dan menyinkronkan data ke *cloud* (Supabase) secara transparan.
