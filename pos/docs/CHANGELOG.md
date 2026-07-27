# Changelog & Working History - NTPOS

Semua perubahan pada kode dan struktur proyek didokumentasikan di sini untuk menjaga agar konteks pekerjaan tetap terjaga di setiap sesi.

## [Unreleased]
*Catatan: Setiap kali fitur atau tugas baru diselesaikan, AI harus mencatat perubahannya pada bagian bawah (atau atas) tanggal hari ini.*

### 2026-07-27
- **Feature (`dashboard.js`, `index.html`)**:
  - Menambahkan panel/kartu analisis **Estimasi Kantong Ayam Dibuka (`#chicken-bag-card`)** di bawah tabel *Produk Terjual* pada dasbor.
  - Menghitung otomatis estimasi jumlah kantong ayam yang dibuka berdasarkan rasio standar 1 Kantong = 9 Potong Ayam (3 Dada, 2 Paha Atas, 2 Paha Bawah, 2 Sayap).
  - Menampilkan ringkasan **Total Potong Terjual**, **Total Kantong Dibuka (kebutuhan tertinggi per bagian)**, serta rincian penjualan, kebutuhan kantong, dan sisa stok kantong untuk masing-masing bagian (Dada, Paha Atas, Paha Bawah, Sayap).
- **UI/UX Enhancement (`dashboard.js`, `index.html`)**:
  - Menambahkan kartu ringkasan baru **"Total Pengeluaran"** (`#dash-total-expense`) di sebelah kanan kartu *Total Batal* pada bagian atas dasbor untuk menampilkan total pengeluaran operasional outlet pada rentang tanggal yang dipilih.
  - Menghapus data/dataset **"Omset Bersih Seluruh"** dari grafik **"Omset Bersih Tunai vs Setoran"** agar grafik fokus membandingkan kas tunai bersih terhadap setoran dan selisihnya.
  - Menghapus data/dataset **"Omset Bersih Tunai"** dari grafik **"Omset Bersih Non-Tunai"** (`methodNetChart`) sehingga grafik khusus menampilkan rincian metode pembayaran selain tunai yang sudah dikurangi potongan MDR.
- **PWA (`sw.js`)**: Update `CACHE_NAME` ke `pos-cache-v46`.

### 2026-07-26
- **Feature (`dashboard.js`, `index.html`)**: Menambahkan tombol "Export Excel" pada Action Bar Dashboard untuk mengunduh laporan keuangan harian/periode dalam format `.xlsx` dengan tepat 2 Sheet menggunakan library SheetJS:
  - `Sheet 1: Pendapatan & Pengeluaran`: Menampilkan rincian harian Pendapatan Kotor (Omzet), Pengeluaran Operasional, Net (Pendapatan - Pengeluaran), dan baris TOTAL.
  - `Sheet 2: Omset Bersih Payment Method`: Menampilkan rincian harian Omset Bersih per Metode Pembayaran (Tunai, QRIS, Bank Transfer, Go Food, Grab Food, Shopee Food) serta Total Hari Ini dan baris TOTAL.
- **Feature (`dashboard.js`, `index.html`)**:
  - Menambahkan grafik khusus **Omset Bersih per Metode Pembayaran (`methodNetChart`)** untuk menampilkan grafik tren harian pendapatan setelah dikurangi potongan MDR per metode pembayaran (Tunai, QRIS, Go Food, Grab Food, Shopee Food, Bank Transfer).
  - Menambahkan kolom **Omset Bersih (Net MDR)** pada Tabel Metode Pembayaran di atas dasbor agar pengguna dapat melihat langsung perbandingan Omzet Bruto vs Net setelah potongan MDR untuk setiap metode pembayaran.
- **UI/UX Enhancement (`dashboard.js`, `index.html`)**:
  - Menyederhanakan grafik **Omset Bersih vs Setoran (`depositComparisonChart`)** menjadi 4 batang utama per hari (`Omset Bersih Seluruh`, `Omset Bersih Cash`, `Setoran`, dan `Selisih`) agar tidak bertumpuk dan mudah dibaca.
  - Menambahkan grafik **Jam Sibuk Transaksi (`peakHoursChart`)** untuk menampilkan distribusi jumlah transaksi dan omzet berdasarkan jam (`00:00 - 23:00`).
  - Menambahkan panel ringkasan **Estimasi Laba Bersih (`#net-profit-card`)** yang diposisikan berdampingan (*side-by-side*) dalam grid 2 kolom dengan grafik *Estimasi Bagi Hasil*.
  - Menambahkan batas tinggi scroll (`max-height: 350px; overflow-y: auto;`) pada tabel *Metode Pembayaran* dan *Produk Terjual*.
- **PWA (`sw.js`)**: Update `CACHE_NAME` ke `pos-cache-v44`.

### 2026-07-25
- **Bugfix (`shift.js`)**: Memperbaiki anomali perbedaan waktu antara `opened_at` (Waktu Buka Shift) dan `clock_in` (Waktu Absen). Sebelumnya `opened_at` tidak di-set secara eksplisit dari *client*, sehingga menggunakan nilai *default* `now()` dari *server* Supabase yang memicu ketidakcocokan zona waktu. Perbaikan: `opened_at` kini diatur secara eksplisit dari browser menggunakan `new Date().toISOString()` (UTC) sehingga akan selalu sinkron dengan waktu absen (`clock_in`).
- **PWA**: Update `CACHE_NAME` dari `pos-cache-v41` ke `pos-cache-v42`.

### 2026-07-24
- **Bugfix (`shift.js`)**: Menambahkan validasi di `handleOpenShift()` — sebelum membuat sesi baru, sistem kini mengecek apakah user sudah memiliki sesi `open` di outlet yang sama. Jika ada, proses dibatalkan dan ditampilkan pesan error dengan waktu sesi yang masih aktif. Ini mencegah terbentuknya sesi "orphan" yang tidak bisa ditutup.
- **Bugfix (`shift-sessions.js`)**: Memperbaiki filter tanggal pada `loadShiftSessions()`. String `YYYY-MM-DD` dari input date sebelumnya diinterpretasikan sebagai UTC midnight oleh browser, menyebabkan filter bergeser 7 jam (WIB offset). Perbaikan: menggunakan `new Date(date + 'T00:00:00')` agar diinterpretasikan sebagai local time (WIB).
- **PWA**: Update `CACHE_NAME` dari `pos-cache-v40` ke `pos-cache-v41`.

### 2026-07-23
- **Database (Bugfix)**: Mengidentifikasi dan memandu perbaikan anomali pada tabel `shift_sessions` di Supabase terkait zona waktu.
  - Menemukan bahwa kolom `opened_at` dan `closed_at` secara tidak sengaja terkonfigurasi sebagai `timestamp` tanpa timezone, menyebabkan bentrok ketika dikombinasikan dengan server Supabase yang menggunakan zona waktu UTC. Hal ini menyebabkan selisih perhitungan yang tampak melompat 7-14 jam di *frontend*.
  - Memberikan skrip SQL (`ALTER TABLE`) kepada pengguna untuk mengubah tipe kolom menjadi `timestamptz` (timestamp with time zone) agar selalu tersinkronisasi otomatis dengan browser apa pun zona waktunya.
  - Memberikan skrip `UPDATE` sementara untuk memulihkan data shift historis yang waktunya terpotong/lompat di antarmuka.
- **Documentation**: Memperbarui skema `pos/docs/Database_ERD.md` untuk memasukkan tabel `shift_sessions` secara rinci dan menegaskan penggunaan tipe data `timestamptz` yang bersifat kritikal untuk kolom `opened_at` dan `closed_at`.
- **Documentation**: Membuat file `CHANGELOG.md` ini untuk menyimpan riwayat teknis khusus untuk modul aplikasi POS.
- **Feature (Attendance)**: Menambahkan snapshot jam shift (`shift_time_snapshot`) pada tabel presensi antarmuka.
- **Feature (Attendance)**: Menampilkan kolom Jam Shift pada antarmuka tabel Riwayat Absensi.
- **Feature (Export)**: Memperbarui fungsi ekspor ke Excel untuk menyertakan data Jam Shift pada absensi, serta menambahkan sheet baru untuk data Riwayat Sesi Shift.
