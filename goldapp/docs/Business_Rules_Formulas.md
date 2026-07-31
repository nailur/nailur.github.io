# Business Rules & Formulas - NTGold App

Dokumen ini merangkum aturan bisnis dan rumus perhitungan pada aplikasi portofolio emas NTGold agar AI dapat langsung memahami kalkulasinya tanpa membaca kode JavaScript.

---

## 1. Kalkulasi Nilai Portofolio & Keuntungan (PL / Profit & Loss)
- **Total Berat Emas (Gram)**:
  ```
  Total Gram = Sum(item.weight_gram)
  ```
- **Total Modal Pembelian (Total Cost)**:
  ```
  Total Modal = Sum(item.weight_gram * item.buy_price_per_gram)
  ```
- **Nilai Pasar Saat Ini (Current Market Value)**:
  ```
  Nilai Pasar = Total Gram * Harga Emas Pasar Terkini (per Gram)
  ```
- **Keuntungan / Kerugian (Profit & Loss / PL)**:
  ```
  Nominal PL = Nilai Pasar - Total Modal
  Persentase PL = (Nominal PL / Total Modal) * 100%
  ```

---

## 2. Kalkulasi Progres Target (Goal Progress)
- **Persentase Capaian Target**:
  ```
  Progres (%) = Math.min(100, (Total Gram / Target Gram) * 100)
  ```
- **Sisa Target Emas**:
  ```
  Sisa (Gram) = Math.max(0, Target Gram - Total Gram)
  ```

---

## 3. Aturan Web Scraping Harga Emas & Cron
- **Frekuensi Pengecekan**: Cron-job.org memanggil `/api/cron-log-price.js` setiap 15 menit.
- **Penyimpanan Harga Pasar**: Hanya dicatat ke tabel `gold_price_history` apabila ada perubahan harga dibanding data rekor terakhir atau merupakan logging pertama di hari tersebut.
- **Notifikasi Harian (OneSignal)**: Dipicu setiap pukul 09:00 WIB untuk memberitahu harga pembukaan harian emas kepada seluruh pengguna aktif.
