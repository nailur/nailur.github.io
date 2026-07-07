# NTGold App - Changelog & Features Overview

Buku catatan ini merangkum seluruh fitur, keunggulan, dan teknologi pihak ketiga yang digunakan dalam membangun aplikasi **NTGold**, sebuah platform pemantau harga emas modern berbasis PWA.

---

## ✨ Fitur-Fitur Utama (Features)

1. **Real-time Price Web Scraping**
   - Menarik data harga emas secara *live* dari berbagai sumber resmi (Antam, Galeri24, UBS, Lotus Archi, Emas Kita, King Halim, Sampoerna).
   - Pengumpulan data dikemas dalam satu pintu (*API endpoint* tunggal).

2. **Automated Price Logging (Historical Data)**
   - Secara otomatis mencatat pergerakan harga emas ke dalam *database* setiap 15 menit sekali.
   - Berguna untuk keperluan analisis pergerakan tren harga jangka panjang.

3. **Smart Web Push Notifications**
   - Mengirimkan rangkuman harga emas pecahan 1 gram langsung ke layar *smartphone* atau PC pengguna setiap jam 9 pagi (WIB).
   - Dilengkapi dengan *Kecerdasan Eksekusi*: Meskipun sistem bekerja menarik data setiap 15 menit, notifikasi akan menahan diri dan HANYA terkirim pada jam 09:00 pagi demi kenyamanan pengguna.
   - Adanya opsi `?forcePush=true` untuk keperluan *testing* notifikasi instan.

4. **Progressive Web App (PWA)**
   - Aplikasi dapat di-instal (Add to Home Screen) layaknya aplikasi *native* di Android, iOS, maupun macOS/Windows.
   - Memiliki *icon* kustom khusus yang menyatu dengan sistem operasi (misalnya icon logo NTGold).

5. **Interactive Notification Toggle**
   - UI saklar (*toggle switch*) estetik untuk menyalakan/mematikan langganan notifikasi.
   - Status saklar langsung tersimpan otomatis di dalam `localStorage` sehingga preferensi pengguna tidak hilang saat aplikasi ditutup.

---

## 🚀 Keunggulan & Nilai Plus (Highlights)

- **$0 Server Cost (100% Serverless)**: Arsitektur dibangun sepenuhnya di atas layanan *cloud* gratis (*Serverless Edge Functions* dan *Static Hosting*), sehingga tidak memerlukan biaya sewa server bulanan (VPS).
- **Zero-Maintenance**: Karena menggunakan Vercel dan GitHub Pages, server tidak akan pernah *down*, kebal terhadap lonjakan *traffic*, dan tidak perlu me-*restart service* secara manual.
- **Bebas API Berbayar**: Mendapatkan sumber harga secara independen melalui teknik *web scraping* HTML yang dibungkus secara rapi, tanpa harus membeli akses *API Data Market* finansial yang harganya sangat mahal.
- **Blazing Fast**: *Frontend* hanyalah file statis (HTML/JS/CSS) murni, membuat waktu pemuatan halaman awal (*Initial Load Time*) terjadi dalam hitungan milidetik.
- **Smart Data Deduplication**: Skrip otomatis menolak data yang nilainya nol, menghindari format angka yang rusak, dan hanya mengirim tipe `physical IDR`.

---

## 🛠 Teknologi Pihak Ketiga (3rd Party Services)

NTGold dibangun di atas ekosistem modern dengan merangkai layanan-layanan raksasa berikut:

1. **GitHub Pages**
   - *Peran*: Sebagai *hosting* statis untuk *frontend* (HTML, CSS, JS, Gambar, dan `manifest.json` PWA).
2. **Vercel (Serverless Functions)**
   - *Peran*: Sebagai *backend* atau *mesin pekerja* (Node.js) yang mengeksekusi skrip penarik data (*scraper*) tanpa harus menyewa server 24/7.
3. **Supabase (PostgreSQL)**
   - *Peran*: Sebagai pangkalan data (*Database*) di awan untuk menampung riwayat panjang harga emas (*Log Price*) yang dipompa oleh Vercel.
4. **OneSignal**
   - *Peran*: Layanan pengirim *Push Notification* lintas perangkat (Web, Android, Apple).
5. **Cron-job.org**
   - *Peran*: "Jam Weker" gratis yang bertugas menyenggol / membangunkan Vercel setiap 15 menit sekali tanpa henti.
6. **JSDOM (Node.js Library)**
   - *Peran*: Alat bedah ajaib (*DOM Parser*) untuk membaca struktur HTML dari berbagai situs emas resmi guna mengambil angka harganya secara spesifik.
7. **Tailwind CSS (via CDN)**
   - *Peran*: Mempercantik antarmuka pengguna (*UI*) dengan desain yang responsif dan modern.
