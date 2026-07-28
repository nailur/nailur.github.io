# Changelog & Working History - NTPOS

Semua perubahan pada kode dan struktur proyek didokumentasikan di sini untuk menjaga agar konteks pekerjaan tetap terjaga di setiap sesi.

## [Unreleased]
*Catatan: Setiap kali fitur atau tugas baru diselesaikan, AI harus mencatat perubahannya pada bagian bawah (atau atas) tanggal hari ini.*

### 2026-07-28
- **Feature (`index.html`, `js/inventory.js`, `sw.js`)**:
  - Menambahkan inputan baru **Harga Beli / Satuan (Rp)** pada modal **Posting Penambahan Stok** (`#modal-stock-posting`) agar kasir/admin dapat memasukkan harga penambahan stok barang inventaris/bahan baku.
  - Menambahkan perhitungan dan tampilan real-time **Total Biaya Penambahan Stok** di bagian *footer* tabel posting penambahan stok.
  - Menambahkan kolom **Harga Satuan (Rp)** dan **Subtotal (Rp)** pada modal **Detail Posting Stok** (`#modal-posting-details`) khusus untuk transaksi penambahan stok.
  - Menambahkan kolom dan inputan **Harga Beli / Satuan (Rp)** pada tabel utama Inventaris dan modal **Tambah/Edit Barang Inventaris** (`#modal-inventory`) sebagai harga referensi default.
  - Menambahkan perlindungan *fallback* database saat penyimpanan dan pembacaan sehingga aplikasi tetap stabil meskipun kolom `price` belum dibuat pada tabel `inventory_items` maupun `inventory_posting_items` di Supabase.
  - Memperbarui `CACHE_NAME` pada `sw.js` ke versi `pos-cache-v54`.
- **Audit & Architecture Review**:
  - Melakukan audit teknis, arsitektur, dan keamanan cyber (*Cyber Security & Threat Analysis*) pada aplikasi NTPOS, mencakup perlindungan terhadap serangan SQL Injection, Cross-Site Scripting (XSS), celah logika *Price Tampering* pada RPC, isolasi RLS per outlet, ketahanan *offline* (PWA), serta performa (*Egress*).
  - Menghasilkan dokumen laporan audit pada arsip `pos_audit_report.md` yang memuat **6 temuan teknis utama** (termasuk temuan penyebab toast notifikasi "Pembaruan terpasang" yang selalu muncul berulang akibat `controllerchange` PWA) dan **2 analisis kerentanan keamanan** beserta solusinya, serta memisahkan **Konsep Sesi Shift Bersama per Outlet** ke bagian khusus sebagai keputusan desain bisnis (*By Design*).
- **Fix Audit #1 (`sw.js`)**: Menambahkan 9 modul JS yang sebelumnya hilang dari `urlsToCache` (`attendance.js`, `dashboard.js`, `deposits.js`, `expenses.js`, `inventory.js`, `management.js`, `shift-master.js`, `shift-sessions.js`, `supabase.js`) agar PWA benar-benar *self-contained* dan semua halaman dapat diakses saat offline. Update `CACHE_NAME` ke `pos-cache-v52`.
- **Fix Audit #2 (`offline.js`)**: Menambahkan pengecekan idempotensi pada `syncOfflineTransactions()` — jika Supabase mengembalikan error duplikat (kode `23505` atau pesan mengandung kata *"duplicate"*), transaksi dianggap sudah masuk ke database dan langsung dihapus dari antrean IndexedDB, mencegah *retry loop* tak terbatas.
- **Fix Audit #3 (Database — SQL Migration)**: Menyiapkan file migrasi `migration_audit_fix_3_4.sql` untuk mengganti implementasi trigger `generate_receipt_no`. Kolom `last_receipt_seq` ditambahkan ke tabel `outlets`, dan nomor nota dibuat atomik via `UPDATE ... RETURNING` dengan *row-level lock* PostgreSQL, menggantikan `COUNT(*) + 1` yang rawan *race condition*.
- **Fix Audit #4 (`dashboard.js` + Database — SQL Migration)**: Menambahkan parameter `p_end_date` pada RPC `get_analytics_summary` di Supabase (via `migration_audit_fix_3_4.sql`) dan memperbarui pemanggilan di `dashboard.js` agar mengirimkan `endOfDay` ke server. Filter data kini dilakukan di database, bukan di browser — menghilangkan pemborosan kuota Egress Supabase.
- **Fix Audit #5 (`history.js`)**: Mengganti 2 query terpisah (fetch transactions + `.in('transaction_id', trxIds)`) menjadi 1 Nested Select Join PostgREST, mengeliminasi risiko HTTP Error 414 *URI Too Long* saat ekspor Excel dengan banyak transaksi.
- **Fix Audit #6 (`app.js`, `sw.js`)**: Memperbaiki tuntas toast *false-positive* "Pembaruan terpasang!" yang sering muncul akibat re-evaluasi impor CDN OneSignal (`OneSignalSDK.sw.js`) dan `clients.claim()`. Mengganti *event listener* `controllerchange` dengan pesan `postMessage` (`APP_UPDATED`) dari `sw.js` yang hanya dikirim ketika versi `CACHE_NAME` diperbarui dan cache lama benar-benar dihapus (Bump `CACHE_NAME` ke `pos-cache-v53`).

### 2026-07-27
- **Feature (`dashboard.js`, `index.html`)**:
  - Menambahkan panel/kartu analisis **Estimasi Kantong Ayam Dibuka (`#chicken-bag-card`)** di bawah tabel *Produk Terjual* pada dasbor.
  - Menghitung otomatis estimasi jumlah kantong ayam yang dibuka berdasarkan rasio standar 1 Kantong = 9 Potong Ayam (3 Dada, 2 Paha Atas, 2 Paha Bawah, 2 Sayap).
  - Menampilkan ringkasan **Total Potong Terjual**, **Total Kantong Dibuka (kebutuhan tertinggi per bagian)**, serta rincian penjualan, kebutuhan kantong, dan sisa stok kantong untuk masing-masing bagian (Dada, Paha Atas, Paha Bawah, Sayap).
- **UI/UX Enhancement (`dashboard.js`, `index.html`)**:
  - Menambahkan kartu ringkasan baru **"Total Pengeluaran"** (`#dash-total-expense`) di sebelah kanan kartu *Total Batal* pada bagian atas dasbor untuk menampilkan total pengeluaran operasional outlet pada rentang tanggal yang dipilih.
  - Menghapus data/dataset **"Omset Bersih Seluruh"** dari grafik **"Omset Bersih Tunai vs Setoran"** agar grafik fokus membandingkan kas tunai bersih terhadap setoran dan selisihnya.
  - Menghapus data/dataset **"Omset Bersih Tunai"** dari grafik **"Omset Bersih Non-Tunai"** (`methodNetChart`) sehingga grafik khusus menampilkan rincian metode pembayaran selain tunai yang sudah dikurangi potongan MDR.
- **UI/UX Enhancement (`index.html`, `dashboard.js`)**:
  - Memperkecil dan mengoptimalkan tata letak grid kartu ringkasan KPI di bagian atas dasbor (`minmax(115px, 1fr)`, padding ringkas, `min-width: 0`, teks ellipsis) agar seluruh 6 kartu (Pendapatan, Transaksi, Diskon, Pajak, Batal, Pengeluaran) muat berdampingan dalam 1 baris horizontal pada layar tablet/laptop tanpa ada kartu yang terlempar ke baris bawah.
- **Feature (`history.js`, `app.js`)**:
  - Menambahkan tombol shortcut **Cetak Ulang Struk** (`<i class="ph ph-printer"></i>`) di kolom **AKSI** pada tabel halaman **Riwayat Transaksi**, berdampingan dengan tombol Detail (`<i class="ph ph-eye"></i>`).
- **Bugfix (`index.html`, `dashboard.js`)**:
  - Memperbaiki event listener tombol **Export Excel** pada menu Dashboard (`#btn-export-dashboard-excel`) dengan menambahkan inline handler `onclick="window.exportDashboardExcel && window.exportDashboardExcel()"` serta langsung mengikat event saat skrip `dashboard.js` dimuat, mengatasi kendala tombol tidak responsif saat diklik karena `DOMContentLoaded` sudah terlewati pada impor dinamis.
  - Menambahkan pengecekan otomatis untuk memuat data dasbor (`loadDashboard()`) terlebih dahulu jika `_lastDashboardData` belum tersedia saat klik Export Excel.
- **Feature (`dashboard.js`)**:
- **Feature (`index.html`, `app.js`)**:
  - Mengubah antarmuka menu **Info Penggunaan Server** (`#server-info-tab`) menjadi **Monitor Kuota Paket Gratis (Free Plan) & Rekomendasi Upgrade Server** yang profesional dan komprehensif.
  - Menampilkan 4 kartu batas kuota utama secara *real-time*:
    1. **Database Supabase (`500 MB`)**: Penggunaan aktual dari fungsi `get_db_size`, sisa kapasitas dalam MB, dan persentase terpakai dengan indikator status warna otomatis.
    2. **File Storage Bucket (`1 GB`)**: Estimasi pemakaian penyimpanan foto produk dan bukti transfer setoran tunai (terkompresi otomatis), sisa kapasitas, dan jumlah foto ter-upload.
    3. **Pengguna Aktif (`50.000 MAU`)**: Jumlah akun kasir/admin terdaftar aktif di outlet serta sisa kuota bulanan.
    4. **GitHub Pages Hosting (`1 GB`)**: Ukuran repositori aplikasi web secara live melalui GitHub API.
  - Menambahkan kartu panduan **Bandwidth Data Keluar (Egress Supabase - 5 GB/Bulan)** yang menjelaskan penghematan >90% bandwidth berkat arsitektur PWA Offline Cache.
  - Menambahkan tabel **Panduan Kritis: Kapan Harus Upgrade atau Migrasi Server?** untuk memandu pengguna membedakan kapan cukup melakukan arsip transaksi lama (>2 tahun) vs kapan outlet berkembang besar hingga membutuhkan upgrade ke Supabase Pro Plan ($25/bln).
- **PWA (`sw.js`)**: Update `CACHE_NAME` ke `pos-cache-v51`.

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
