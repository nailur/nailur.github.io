# Technology Stack - NTPOS

## 1. Overview
NTPOS menggunakan ekosistem **JAMStack (JavaScript, APIs, Markup)** dan **BaaS (Backend-as-a-Service)** untuk mencapai skalabilitas tinggi dengan **Zero-Server Maintenance**. Keamanan data dan logika bisnis berat dipindahkan (di-*offload*) langsung ke tingkat *Database Engine*.

## 2. Frontend (Client-side)
Aplikasi klien murni dibangun tanpa *bundler* atau *framework* berat (React/Vue/Angular), menjaga ukuran *bundle* sekecil mungkin.

- **Bahasa/Struktur**: HTML5, CSS3, Vanilla JavaScript (ES6+).
- **Progressive Web App (PWA)**: 
  - `manifest.json` (Pengaturan instalasi & *Theme*).
  - `sw.js` (Service Worker untuk dukungan *Offline First* dan sinkronisasi).
- **Library Pihak Ketiga**:
  - **Phosphor Icons**: Sistem ikon UI yang modern dan konsisten.
  - **Chart.js**: Visualisasi data analitik untuk laporan pendapatan dan statistik penjualan.
  - **SheetJS**: Pemrosesan dan pengeksporan tabel data HTML/JSON menjadi format file Microsoft Excel (.xlsx).
  - **Browser Image Compression**: Modul kompresi gambar (kuitansi, foto produk) di sisi klien (menghemat *bandwidth* unggah).
  - **OneSignal SDK**: Pengelolaan *Push Notifications* (*Broadcasts*).

## 3. Backend & Database (Supabase)
Seluruh lapisan *backend* ditangani oleh **Supabase (PostgreSQL)**, yang memberikan fitur lengkap setara *enterprise*:

- **Supabase Auth**: Manajemen autentikasi (Login/Signup) terintegrasi secara otomatis dengan tabel kustom `profiles` via *Database Triggers*.
- **PostgreSQL**: Penyimpanan data relasional skala penuh.
- **Row Level Security (RLS)**: Lapisan pertahanan utama. Kebijakan akses (*Policies*) diterapkan di setiap tabel untuk memastikan pengguna hanya bisa membaca/menulis data sesuai dengan cakupan *role* (Superadmin vs Kasir) dan wilayahnya (*Outlet* / *Branch*).
- **Database Functions (RPC)**:
  - Proses bisnis kritis seperti kalkulasi *Checkout* transaksi (`process_checkout`), pembuatan ID kuitansi otomatis (`generate_receipt_no`), dan rekap analitik (`get_analytics_summary`) dijalankan sebagai fungsi SQL di server (*Stored Procedures*), mencegah manipulasi data dari sisi klien.
- **Supabase Edge Functions**: Menjalankan logika *server-side* berbasis Deno (contoh: `create-user`) menggunakan *Service Role Key* untuk operasi level-admin (membuat *user* dengan peran spesifik tanpa batasan *client*).
- **Supabase Storage**: Sistem penyimpanan media dengan kebijakan akses per-Bucket:
  - `product-images` (Public): Penyimpanan foto katalog produk.
  - `attachments` (Private): Penyimpanan dokumen internal seperti foto bukti setoran bank, hanya dapat diakses oleh user terautentikasi.

## 4. Directory Structure Map
Struktur modular *vanilla* untuk pengelolaan kode yang rapi:

```text
📁 /pos/
├── 📁 assets/                     # Library eksternal lokal
│   ├── 📁 img/                    # Aset gambar PWA (Icons)
│   ├── 📁 lib/                    # supabase.min.js, browser-image-compression.js
│
├── 📁 css/                        # File stylesheet
│   ├── style.css                # Styling utama aplikasi
│   ├── style-modals.css         # Styling khusus untuk popup/modal
│
├── 📁 docs/                       # Dokumentasi Aplikasi (PRD, ERD, TechStack)
│
├── 📁 js/                         # Logika Modul Klien (Vanilla JS)
│   ├── app.js                   # Entry point, inisialisasi UI, routing halaman SPA
│   ├── state.js                 # Global state management untuk keranjang dan UI
│   ├── auth.js                  # Logika login, logout, dan manajemen sesi (Supabase)
│   ├── supabase.js              # Konfigurasi dan inisialisasi klien Supabase DB
│   ├── offline.js               # Caching, deteksi offline, sinkronisasi data tertunda
│   ├── products.js              # Pengambilan dan rendering katalog produk toko
│   ├── cart.js                  # Logika keranjang belanja, kalkulasi total, checkout
│   ├── history.js               # Riwayat transaksi harian dan ekspor ke Excel
│   ├── dashboard.js             # Visualisasi analitik (Chart.js), laporan penjualan
│   ├── shift.js                 # Logika pembukaan/penutupan laci kasir (Cash Drawer)
│   ├── shift-master.js          # Pengelolaan shift secara umum (Master data)
│   ├── shift-sessions.js        # Logika sesi shift berjalan oleh user tertentu
│   ├── attendance.js            # Modul absensi (Clock In / Clock Out) staf
│   ├── printer.js               # Perintah cetak struk ESC/POS via Bluetooth Web API
│   ├── inventory.js             # Manajemen stok in/out, konversi unit, kategori
│   ├── management.js            # Modul manajemen Superadmin (Cabang, User, Outlet)
│   ├── expenses.js              # Pencatatan biaya operasional (Operational Costs) harian
│   ├── deposits.js              # Pencatatan setoran penjualan bank (Sales Deposits)
│   ├── discounts.js             # Pengelolaan diskon global, metode pembayaran, per item
│   └── modifiers.js             # Opsi kustomisasi produk (Topping, Ukuran, Level)
│
├── index.html                   # Halaman Tunggal (SPA) Antarmuka POS
├── manifest.json                # Metadata PWA
└── sw.js                        # Service Worker PWA
```
