# Product Requirements Document (PRD) - NTGold App

## 1. Introduction
NTGold adalah aplikasi Progressive Web App (PWA) modern yang berfungsi sebagai pemantau harga emas secara real-time dan manajemen portofolio/inventori emas digital bagi penggunanya. Aplikasi ini didesain agar sangat ringan, tanpa biaya server bulanan (Serverless), dan dapat memberikan informasi pergerakan harga emas kepada pengguna setiap hari melalui Smart Web Push Notifications.

## 2. Target Audience
- Investor emas fisik (Antam, UBS, Galeri24, Lotus Archi, Emas Kita, King Halim).
- Pengguna yang ingin memantau nilai aset emas mereka berdasarkan harga buyback/jual terkini.
- Pengguna yang membutuhkan pengingat harga harian tanpa harus selalu membuka aplikasi.

## 3. Core Features

### 3.1. Market Price Monitoring (Real-time Scraping)
- Menampilkan harga emas terkini dari berbagai *brand* emas fisik di Indonesia.
- Sistem menarik data dari berbagai sumber (API/Web HTML) menggunakan Serverless Edge Functions (Node.js/JSDOM).
- Menampilkan visualisasi pergerakan harga (Historical Price) dalam bentuk chart untuk 30 hari terakhir.

### 3.2. Automated Price Logging & Smart Data Deduplication
- Secara otomatis mencatat pergerakan harga emas ke dalam *database* setiap 15 menit sekali.
- **Smart Data Deduplication**: Sistem secara cerdas menolak data yang nilainya nol (0), menghindari format angka yang rusak, dan memfilter hanya emas tipe fisik mata uang Rupiah (`physical IDR`).

### 3.3. Portfolio & Asset Management
- Pengguna dapat menambahkan data pembelian emas (Brand, Berat/Gram, Harga Beli, Tanggal Pembelian).
- Sistem secara otomatis menghitung *Net Worth* (Total Kekayaan), Persentase Keuntungan/Kerugian (P&L) berdasarkan harga *buyback* terkini.
- Terdapat fitur **Kalkulator Zakat Emas** yang muncul secara otomatis jika total simpanan pengguna telah mencapai nisab (85 gram), menampilkan estimasi zakat (2.5%) yang harus dikeluarkan.

### 3.4. Financial Goals (Wallet)
- Pengguna dapat membuat "Goal" atau dompet terpisah (contoh: "Rumah Baru", "Pendidikan Anak") dengan target dana (Rupiah).
- Aset emas yang dimasukkan ke portofolio dihubungkan ke Goal tertentu, menampilkan *progress bar* sejauh mana target dana tersebut telah tercapai (berdasarkan valuasi emas).

### 3.5. Smart Web Push Notifications
- Terintegrasi dengan OneSignal untuk mengirim notifikasi push ke perangkat (Mobile & Desktop).
- **Kecerdasan Eksekusi**: Meskipun sistem bekerja menarik data setiap 15 menit, sistem menahan diri dan HANYA mengirimkan notifikasi pada pukul **09:00 WIB** pagi demi kenyamanan pengguna.
- Terdapat opsi `?forcePush=true` pada URL/Endpoint untuk keperluan *testing* notifikasi instan.
- Toggle aktif/non-aktif notifikasi langsung tersimpan pada preferensi pengguna dan tersimpan di `localStorage` perangkat.

### 3.6. Progressive Web App (PWA)
- Mendukung fitur *Add to Home Screen* layaknya aplikasi *native* dengan *icon* kustom.
- Akses dan antarmuka layaknya aplikasi native di Android/iOS dengan *caching* statis yang super cepat.

### 3.7. User Authentication
- Login dan Registrasi menggunakan Supabase Auth (Email & Password).
- Data pengguna tersinkronisasi antar perangkat.

## 4. User Flow
1. **Onboarding**: Pengguna membuka PWA, disuguhkan dengan Market Price harian (bisa diakses publik tanpa login).
2. **Authentication**: Pengguna login/register untuk membuka fitur Portofolio.
3. **Asset Entry**: Pengguna memasukkan data aset emas mereka melalui tombol "Add New Item".
4. **Monitoring**: Pengguna memantau *Net Worth* yang bergerak dinamis.
5. **Notification Opt-in**: Pengguna menyalakan toggle notifikasi harian melalui halaman Profil.
