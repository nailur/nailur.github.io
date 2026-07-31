# DOM & Modal Mapping - NTGold App

Dokumen ini memetakan ID Modal, Elemen Utama, dan Fungsi JS pada `goldapp/index.html` dan `goldapp/res/js/main.js` untuk menghemat token pencarian AI.

---

## 1. Daftar Modal Utama

| Fitur / Kegunaan | ID Modal (`#id`) | Tombol / Form Terkait | Fungsi Pembuka | Fungsi Penyimpan / Aksi | File JS |
|---|---|---|---|---|---|
| **Tambah / Edit Portofolio (Goal)** | `#goal-modal` | `#goal-modal-submit-btn`, `#goal-name`, `#goal-target` | `toggleGoalModal(action, name, target)`, `openEditGoalModal()` | `saveGoal()` / Handler dalam modal | `res/js/main.js` |
| **Tambah Transaksi Emas** | `#add-modal` | `#add-price`, `#add-weight`, `#add-date` | `toggleAddModal()` | `saveTransaction()` / `addGold()` | `res/js/main.js` |
| **Konfirmasi Hapus** | `#confirm-modal` | Tombol Konfirmasi Hapus | `openConfirmModal()`, `closeConfirm()` | `confirmDelete()` | `res/js/main.js` |

---

## 2. Elemen Tampilan & Chart Utama

| Nama Bagian / Grafik | ID Kontainer (`#id`) | Fungsi Render Utama | Keterangan |
|---|---|---|---|
| **Grafik Harga Emas (Chart.js)** | `#priceChart` | `renderPriceChart()` | Menampilkan tren harga emas 30 hari terakhir dari Supabase |
| **Daftar Portofolio / Wallet** | `#portfolio-list` | `fetchGoals()`, `renderPortfolio()` | Daftar card target emas pengguna |
| **Daftar Riwayat Pembelian** | `#transaction-list` | `fetchPortfolio(user, walletId)` | Daftar item pembelian di dalam portofolio terpilih |
| **Harga Emas Terkini (Header)** | `#current-gold-price` | `fetchCurrentGoldPrice()` | Harga per 1 Gram terbaru hasil scraping Vercel |
