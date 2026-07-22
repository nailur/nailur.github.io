# Technology Stack - NTGold App

## 1. Overview
NTGold dibangun menggunakan arsitektur **Modern Serverless** dan **JAMStack (JavaScript, APIs, Markup)**. Pendekatan ini memungkinkan aplikasi berjalan dengan biaya infrastruktur hampir $0, performa pemuatan yang instan (blazing fast), dan keamanan terjamin tanpa perlu merawat peladen (server maintenance).

## 2. Frontend (Client-side)
- **HTML5, CSS3, Vanilla JavaScript**: Tidak menggunakan *framework* besar (seperti React/Vue) untuk menjaga ukuran *bundle* tetap kecil dan pemuatan awal (*Initial Load Time*) dalam hitungan milidetik.
- **Tailwind CSS (via CDN)**: Framework *utility-first CSS* untuk mendesain antarmuka yang responsif, modern, dan estetik dengan cepat.
- **Chart.js**: Library visualisasi data (grafik baris/line chart) berbasis Canvas HTML5, digunakan untuk menggambar grafik *Price History* 30 hari ke belakang.
- **Crypto-JS**: Library keamanan untuk operasi kriptografi pada sisi klien (seperti hashing/enkripsi sederhana saat manipulasi localStorage atau data di *client*).
- **Progressive Web App (PWA)**:
  - `manifest.json`: Berisi definisi *icon*, nama aplikasi, dan mode *standalone* sehingga dapat di-*install* di *home screen*.
  - `sw.js` (Service Worker): Berfungsi men-cache aset statis agar aplikasi cepat di-load.

## 3. Backend & API (Serverless Edge)
- **Vercel Serverless Functions (`/api/*`)**: Node.js *backend runtime* yang bertindak sebagai mesin pekerja. Menjalanakan fungsi `harga-emas.js` dan `cron-log-price.js`. Tidak aktif 24 jam penuh, melainkan hanya menyala ketika ada *request*, sehingga meminimalisir biaya (Serverless).
- **JSDOM**: *Node.js DOM Parser* ajaib yang ditanam di dalam Vercel untuk membedah struktur HTML situs resmi (Web Scraping) dan mengambil angka harganya.
- **Cron-job.org**: Bertugas sebagai *trigger* (jam weker) yang memanggil *endpoint* Vercel setiap 15 menit sekali untuk melakukan pengecekan harga emas terkini dan menuliskannya ke basis data.

## 4. Database & Authentication
- **Supabase (PostgreSQL)**: Sebagai Database utama di awan (Cloud).
  - Menggunakan **Supabase Auth** untuk autentikasi user yang aman.
  - Memanfaatkan fitur bawaan **Row Level Security (RLS)** untuk mengamankan data pengguna (Portofolio/Inventory) langsung di tingkat *database*, menghilangkan kebutuhan *middleware* tambahan di backend.
  - Menggunakan fungsi *Triggers* (PL/pgSQL) untuk sinkronisasi otomatis user baru ke tabel profil.

## 5. Third-Party Integrations
- **OneSignal**: SDK Web Push Notification untuk mengirim *Smart Alerts* (rangkuman pergerakan harga emas per 1 Gram) langsung ke perangkat pengguna pada jam 09:00 WIB pagi, dengan pengelolaan tag dan izin di sisi klien.

## 6. Hosting & Deployment
- **GitHub Pages**: Menjadi *hosting* 100% statis untuk *frontend* (UI/UX). Memiliki perlindungan terhadap serangan trafik dan bebas *downtime*.
- **GitHub Repositories**: Manajemen versi (*Version Control*) untuk semua aset kode (`nailur.github.io`).

## 7. Directory Structure Map & Environment
Peta file penting untuk membantu pemahaman arsitektur secara instan:

```text
📁 / (Root)
├── 📁 api/                      # Backend Serverless (Vercel)
│   ├── harga-emas.js          # API web scraper utama
│   └── cron-log-price.js      # Endpoint untuk log cron harian ke Supabase
│
└── 📁 goldapp/                  # Frontend PWA (GitHub Pages)
    ├── index.html             # Antarmuka (UI) utama aplikasi
    ├── manifest.json          # Konfigurasi PWA (Icon & Display)
    ├── sw.js                  # Service Worker untuk caching PWA
    ├── 📁 docs/                 # Dokumentasi (PRD, ERD, TechStack, Changelog)
    └── 📁 res/                  # Aset statis
        ├── 📁 css/main.min.css  # Desain dan Styling
        └── 📁 js/main.js        # Logika utama aplikasi (API Fetch, Auth, DOM)
```

**Environment Variables (Untuk Deployment Vercel):**
- `SUPABASE_URL`: Endpoint proyek Supabase (Contoh: `https://abcd.supabase.co`)
- `SUPABASE_ANON_KEY`: Kunci publik Supabase (jika dibutuhkan di sisi server)
- `SUPABASE_SERVICE_ROLE_KEY`: Kunci rahasia master untuk *bypass* RLS saat *cron job* mengeksekusi penulisan harga pasar.
