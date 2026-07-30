# Changelog & Working History - NTPOS

Semua perubahan pada kode dan struktur proyek didokumentasikan di sini untuk menjaga agar konteks pekerjaan tetap terjaga di setiap sesi.

## [Unreleased]
*Catatan: Setiap kali fitur atau tugas baru diselesaikan, AI harus mencatat perubahannya pada bagian bawah (atau atas) tanggal hari ini.*

### 2026-07-30
- **Feature (`docs/affiliate_schema.sql`, `js/affiliate.js`, `index.html`, `js/app.js`, `sw.js`)**:
  - Menambahkan **Modul Affiliate** independen yang khusus dapat diakses oleh peran **superadmin**.
  - Membuat skema tabel Supabase (`affiliate_settings`, `affiliate_postings`, `affiliate_posting_items`, `affiliate_posting_transactions`) dengan RLS eksklusif `superadmin` (`auth.uid() = superadmin`).
  - Menambahkan menu dan navigasi tab **Affiliate** pada `index.html` dengan dua subtab: **Posting Affiliate** dan **Master Affiliate**.
  - Menambahkan fitur **Master Setting Komisi Produk**: pengaturan komisi normal (< 15 qty) dan komisi order masal (≥ 15 qty) secara persentase/nominal rupiah, dengan kalkulasi saling terhubung.
  - Menambahkan fitur **Klaim & Posting Affiliate**: memilih satu atau banyak transaksi penjualan yang belum diklaim (`affiliate_claimed = false`), menghitung komisi secara otomatis per item berdasarkan akumulasi kuantitas (mengaktifkan tarif massal otomatis apabila total kuantitas ≥ 15 box).
  - Menambahkan fitur **Pembayaran & Upload Bukti Transfer**: status default *Unpaid* dapat dikonfirmasi menjadi *Paid* dengan melampirkan bukti transfer yang dikompres otomatis di sisi klien via `browser-image-compression`.
  - Menambahkan tombol pintasan **Affiliate** pada navigasi tab **Pengaturan** (`#sa-nav-affiliate`) agar Superadmin dapat langsung membuka Modul Affiliate baik dari tampilan POS Kasir maupun dari tampilan Pengaturan.
  - Memperbarui `CACHE_NAME` pada `sw.js` ke `pos-cache-v58` serta menambahkan `affiliate.js` ke daftar `urlsToCache`.
- **Bugfix & UI Improvement (`index.html`, `js/affiliate.js`, `js/app.js`, `sw.js`)**:
  - **Perbaikan Overlap Tabel**: Mengganti variabel warna latar belakang pada header tabel sticky dari `var(--bg-surface)` menjadi `var(--surface)` agar header tidak transparan dan teks baris di bawahnya tidak bertumpuk/tabrakan.
  - **Perbaikan Query Database**: Menghapus kolom `is_active` dari query `.select()` pada `products` di `loadAffiliateSettings()` karena tabel `products` tidak memiliki kolom tersebut, mengeliminasi error `400 Bad Request (column products.is_active does not exist)` dan pesan error toast saat refresh halaman.
  - **Penghapusan Menu dari Pengaturan**: Menghapus tombol menu **Affiliate** dari navbar tab **Pengaturan** sesuai spesifikasi bahwa Modul Affiliate eksklusif hanya muncul pada menu utama POS.
  - **Penambahan Tombol "+ Atur Komisi Produk"**: Menambahkan tombol **+ Atur Komisi Produk** pada action bar **Master Affiliate** yang membuka modal dengan dropdown pilihan seluruh produk di outlet, mempermudah penambahan/pengaturan komisi tanpa harus scroll di tabel.
  - Memperbarui `CACHE_NAME` pada `sw.js` ke `pos-cache-v59`.
- **UI Compactness & Formula Bonus Kelipatan (`index.html`, `css/style.css`, `js/affiliate.js`, `docs/affiliate_schema.sql`, `docs/Database_ERD.md`, `sw.js`)**:
  - **Tampilan Tabel Compact**: Mengurangi padding vertikal dan font-size pada tabel **Master Affiliate** dan **Posting Affiliate** (`padding: 6px 10px`, tombol `btn-sm` compact) serta menyusun isi sel dalam satu baris agar tampilan lebih ringkas dan hemat ruang layar.
  - **Formula Komisi & Bonus Kelipatan**: Mengubah logika formula komisi Master Affiliate sesuai spesifikasi pengguna:
    - Komisi dihitung dari **Komisi Satuan** (`commission_nominal`) dikali total kuantitas item.
    - Menambahkan parameter **Target Qty Kelipatan** (`bonus_target_qty`, default 15 namun dapat diubah bebas ke angka lain misal 10) dan **Bonus Nominal** (`bonus_nominal`, misal Rp 5.000).
    - Setiap akumulasi kuantitas produk mencapai kelipatan target tersebut, afiliator mendapatkan tambahan bonus nominal sebesar `Math.floor(total_qty / target_qty) * bonus_nominal` (misal 15 atau 16 item dapat 1x bonus Rp 5.000, 30 item dapat 2x bonus Rp 10.000, dst).
  - **Simulasi Live di Modal Setting**: Menambahkan kotak *live simulation* pada modal **Atur Komisi Produk** yang langsung menghitung dan menampilkan simulasi komisi untuk 14, 15, 16, hingga 30 qty secara real-time saat pengguna mengetik angka komisi/target/bonus.
  - **Proteksi Fallback Database**: Menambahkan kolom `bonus_target_qty` dan `bonus_nominal` pada dokumentasi skema SQL serta menambahkan penanganan fallback otomatis pada `handleSaveAffiliateSetting()` agar penyimpanan tidak gagal meskipun kolom belum ditambahkan di Supabase.
  - **Penyederhanaan Tombol Aksi**: Mengubah tombol aksi pada tabel **Master Affiliate** menjadi tombol ikon pensil saja (`<i class="ph ph-pencil-simple"></i>`) tanpa teks agar kolom aksi lebih ramping dan rapi.
  - **Perbaikan CSS Input Modal**: Menambahkan kelas `input` pada input angka di modal **Atur Komisi Produk** (`#affiliate-setting-normal`, `#affiliate-setting-target-qty`, `#affiliate-setting-bonus-nominal`) dan memperbarui selektor CSS di `style.css` menjadi `.input-group input` agar semua input yang bersarang di layout grid ter-render dengan border rounded, padding, dan efek fokus standar.
  - **Audit Keamanan & Optimasi Penggunaan (Usage Tuning)**:
    - Menambahkan `CREATE INDEX IF NOT EXISTS` untuk foreign keys pada `affiliate_schema.sql` (`idx_affiliate_settings_outlet`, `idx_affiliate_postings_outlet_date`, `idx_affiliate_posting_items_posting`, `idx_affiliate_posting_trx_transaction`) serta index untuk pengecekan role superadmin guna memangkas CPU usage & mengeliminasi sequential scan di database Supabase.
    - Menerapkan batasan query (`.limit(100)` pada riwayat posting dan transaksi selesai, `.limit(2000)` pada riwayat klaim) di `affiliate.js` sehingga payload JSON 50% lebih kecil dan tidak membebani pemakaian bandwidth/IOPS Supabase seiring bertambahnya data.
    - Memparalelkan eksekusi query pada modal **Detail Posting Affiliate** menggunakan `Promise.all` sehingga waktu pemuatan rincian item dan transaksi berkurang separuhnya.
    - Memastikan seluruh tampilan data dinamis diamankan dari celah XSS dengan `escapeHtml()` dan verifikasi akses eksklusif superadmin pada level antarmuka maupun RLS kebijakan database.
  - **Filter Ganda Anti-Cancel/Void (`js/affiliate.js`)**: Menambahkan filter `.neq('status', 'voided')` dan `.neq('status', 'cancelled')` pada query Supabase di `openCreateAffiliateModal()` serta penjagaan ganda di level JavaScript (`t.status !== 'voided' && t.status !== 'cancelled'`, dst.) untuk menjamin 100% hanya transaksi berhasil yang dapat dipilih dan diklaim sebagai komisi Affiliate.
  - Memperbarui `CACHE_NAME` pada `sw.js` ke `pos-cache-v63`.

### 2026-07-28
- **Feature (`index.html`, `js/inventory.js`, `sw.js`)**:
  - Mengubah label dan perilaku input pada modal **Posting Penambahan Stok** (`#modal-stock-posting`) dari "Harga Satuan" menjadi **Harga Penambahan (Rp)**, yaitu langsung total harga beli/biaya untuk jumlah item yang ditambahkan saat itu (mengeliminasi keharusan kasir menghitung harga satuan secara manual).
  - Menyesuaikan perhitungan **Total Biaya Penambahan Stok** secara real-time di bagian *footer* tabel agar langsung menjumlahkan harga penambahan per item.
  - Menambahkan kolom **Harga Penambahan (Rp)** pada modal **Detail Posting Stok** (`#modal-posting-details`) khusus untuk transaksi penambahan stok.
  - Menghapus tampilan kolom harga satuan dari tabel utama **Stok Inventaris (Master Stok)** dan input harga dari modal **Tambah/Edit Item** sesuai keputusan desain agar master stok fokus pada pengelolaan data barang & sisa stok fisik, sedangkan data harga eksklusif dicatat saat Posting Penambahan Stok.
  - Menambahkan perlindungan *fallback* database saat penyimpanan dan pembacaan sehingga aplikasi tetap stabil meskipun kolom `price` belum dibuat pada tabel `inventory_posting_items` di Supabase.
  - Memperbarui `CACHE_NAME` pada `sw.js` ke versi `pos-cache-v56`.
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
