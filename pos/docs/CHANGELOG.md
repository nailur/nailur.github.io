# Changelog & Working History - NTPOS

All changes to the codebase and project structure must be documented here to maintain context across sessions.

## [Unreleased]
*Note: Every time a new feature or task is completed, AI agents must append their changes under the current date.*

### 2026-08-26
- **PWA Manifest & Standalone Fix (`pos/manifest.json`, `pos/index.html`, `pos/sw.js`)**:
  - Changed `start_url` from absolute URL `https://ntgroup.my.id/pos/` to relative `./index.html` and added `scope: "./"` to prevent Android Chrome from treating navigation as out-of-scope (which caused browser header and footer / CCT toolbar to appear).
  - Added `id: "/pos/"` and separated `any` vs `maskable` icon purposes.
  - Added mobile PWA meta tags (`mobile-web-app-capable`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`) to `index.html`.
  - Bumped PWA cache to `pos-cache-v118` in `sw.js`.

### 2026-08-08
- **Affiliate & HPP Enhancements (`pos/index.html`, `pos/js/affiliate.js`, `pos/js/hpp.js`)**:
  - Added "Metode Bayar" column to the Affiliate Unclaimed Transactions table and the Affiliate Details Modal to display the payment method of each claimed transaction.
  - Disabled the "Hapus" (Delete) button for Affiliate Postings that have already been marked as `Paid`.
  - Expanded the HPP Calculator Margin Table to calculate and display separate margins for Offline, GoFood, GrabFood, and ShopeeFood.
  - The HPP Calculator now dynamically fetches online prices from the `products` table and applies MDR fee deductions (dynamically fetched from the `outlets` table) to accurately calculate online profitability per item.
  - Bumped PWA cache to `pos-cache-v115` in `sw.js`.

### 2026-08-09
- **HPP Calculator Bug Fix (`pos/js/hpp.js`)**:
  - Fixed an issue where online margin calculations displayed `NaN` due to incorrect parsing of the new MDR fee configuration object format.
  - Bumped PWA cache to `pos-cache-v116` in `sw.js`.
- **Historical MDR Calculation Fix (`pos/js/cart.js`, `pos/js/dashboard.js`, `pos/js/offline.js`, `pos/docs/Database_ERD.md`)**:
  - Addressed an issue where modifying the MDR percentage recalculated all past dashboard reports.
  - Implemented `p_mdr_fee_amount` in `cart.js` checkout (online and offline sync) to snapshot the fee at the time of transaction.
  - Updated `dashboard.js` to read historical `mdr_fee_amount` if available, falling back to dynamic calculation for older transactions.
  - Updated Database ERD to include `mdr_fee_amount` in the `transactions` table.
  - Bumped PWA cache to `pos-cache-v113` in `sw.js`.
- **Product Export (`pos/index.html`, `pos/js/app.js`, `pos/js/products.js`)**:
  - Added "Export Harga Produk" button next to "Tutup Shift".
  - Implemented Excel export functionality for product prices (offline, GoFood, GrabFood, ShopeeFood) using SheetJS.
  - Button visibility is restricted to roles with product management access (Kepala Toko, Kepala Cabang, Owner, Superadmin).
  - Bumped PWA cache to `pos-cache-v112` in `sw.js`.

- **Operational Expenses Input Modal (`pos/index.html`, `pos/js/app.js`, `pos/js/expenses.js`)**:
  - Added a `Tanggal Pengeluaran` input field to the Add and Edit Operational Expenses modal.
  - Updated the save logic to use the inputted date and pre-fill the edit modal with the saved expense date.
  - Verified that the MDR Deduction Settings modal correctly saves data to the `mdr_fees` column in the `outlets` table.
  - Bumped PWA cache to `pos-cache-v111` in `sw.js`.

### 2026-08-06
- **Database & Security Documentation (`pos/docs/Database_ERD.md`)**:
  - Updated the documented `process_checkout` Supabase RPC function to increase the maximum allowed discount from 50% to 75% (`P0003` error code). This reflects the new business rule allowing cashiers to apply discounts up to 75% of the transaction subtotal.
- **Sales Deposits Input Modal (`pos/index.html`, `pos/js/deposits.js`)**:
  - Added a `Tanggal Setoran` input field to the Add and Edit Deposit modal.
  - Updated the save logic to use the inputted date instead of hardcoding today's date, and configured the edit modal to pre-fill the saved deposit date.
  - Bumped PWA cache to `pos-cache-v110` in `sw.js`.

### 2026-08-05
- **HPP & Profitability Calculator (`js/hpp.js`, `index.html`)**:
  - Migrated HPP Settings storage from `localStorage` to Supabase database (`hpp_settings` table) to ensure central synchronization across all devices at the same outlet.
  - Refactored `HPPSettingsManager` to fetch settings asynchronously on load (`fetchSettingsFromDB`) and upsert to database on save, with `localStorage` serving as a fallback cache.
  - Added loading indicator states for both the HPP Calculator Modal and the HPP Summary Card to improve UX during DB data retrieval.
  - Granularized ingredient inputs for Sambal Geprek into specific raw materials (Cabe Merah, Cabe Hijau, Bawang, Minyak Cair, Kaldu Kiloan, Garam Kiloan, Gula Kiloan, Sasa Kiloan, Kencur) to allow highly accurate costing based on specific recipes and portions.
  - Added formula explanation texts (`<span class="text-muted">`) under all input fields to clarify yield assumptions directly on the UI.
  - Restored the monthly kWh estimation helper box in the Operasional Bulanan tab, and added similar formula info boxes for the Bahan Ayam & Box and Bahan Extra & Saus tabs.
  - Adjusted Nasi cost to use Liter instead of 5Kg (yield assumption: 1L = 10 portions).
  - Detailed monthly operational costs (OPEX) inputs, replacing generic fields with specific consumable fields (Masker, Latex, Trash Bag, Tissue, Solatip, Thermal) and direct KWh inputs.
  - Removed Offline vs Online price mode separation in HPP calculations, simplifying it to a single base price calculation (HPP and margins are now unified).
  - Added "Saus Kocak" and "Saus Keju" Extra items to the menu catalog with automatic calculations for material costs (ingredients, cups, and yields).
  - Updated PWA cache to `pos-cache-v107` in `sw.js`.

### 2026-08-02
- **HPP & Profitability Calculator (`js/hpp.js`)**:
  - Fixed ES module scope issue where `pullHPPCostsFromDatabase()` threw `'Supabase client atau outlet aktif tidak terdeteksi'` by importing `supabase` from `./supabase.js`, `getActiveOutletId` from `./state.js`, and `showToast` from `./utils.js`.
  - Fixed ingredient price pulling logic (`inventory_posting_items`) by separating boolean flags (`pulledAyam`, `pulledSaos`, `pulledBeras`) so each item is checked independently without being blocked by earlier matches, and filtering stock postings by the active `outlet_id`.
  - Bumped PWA cache version to `pos-cache-v101` in `sw.js`.

### 2026-08-01
- **HPP & Profitability Calculator (`js/hpp.js`)**:
  - Implemented comprehensive HPP and profit margin calculator for all 36 NTPOS menu items in `js/hpp.js`.
  - Added Equal Chicken Cost Allocation (`Price per Kantong / 9`), Sauce Allocation (`2 pcs for Dada/PA, 1 pc for PB/Sayap`), Solid Oil absorption (`(200g + 42.8g)/9`), Seasoned Flour (`100g biang + 1kg serbaguna`), and configurable packaging costs (`Box M`, `Box XS`, `Kertas Nasi`, `Kertas Bungkus`, `Plastik`).
  - Added OPEX & Electricity absorption calculation with default monthly electricity breakdown (7 equipment items totaling ~Rp 235,717/month) and OPEX per portion based on target daily sales volume.
  - Added "Tarik dari Sistem (DB)" feature (`pullHPPCostsFromDatabase`) to fetch latest ingredient prices from `inventory_postings` and monthly OPEX from `operational_costs`.
  - Added `#modal-hpp-calculator` with 3 tabbed views (`Tabel Analisis Margin`, `Harga Bahan Baku`, `Biaya Operasional & Listrik`), "Kalkulator HPP" button in dashboard filter bar, and `#hpp-summary-card` on the dashboard (`index.html`).
  - Refined HPP Margin Table into a clean 6-column spreadsheet format (`Menu`, `Harga Jual`, `HPP Bahan`, `HPP Final (+ Operasional)`, `Laba Bersih`, `Margin Laba`) with interactive Offline/Online mode toggle and dedicated Excel export button (`exportHPPMarginTableExcel`).
  - Fixed modal visibility bug in `js/hpp.js` by removing `.hidden` class on `openHPPCalculatorModal()` (which previously conflicted with CSS `display: none !important`), added "Lihat Tabel HPP & Laba per Produk" button on `#hpp-summary-card`, and bumped PWA cache to `pos-cache-v99` in `sw.js`.
  - Fixed unclickable buttons inside HPP modal by removing `data-close` from `.modal-overlay` container (preventing click events from bubbling up and closing the modal) and implemented safe backdrop click check (`if (e.target === modal) closeHPPCalculatorModal()`).
  - Updated `exportHPPMarginTableExcel()` in `js/hpp.js` to automatically lazy-load SheetJS (`xlsx.full.min.js`) when exporting HPP margin reports.
  - Differentiated modal opening targets: "Kelola HPP" button now opens directly to `Harga Bahan Baku` tab (`openHPPCalculatorModal('bahan-baku')`), while "Kalkulator HPP" and "Lihat Tabel HPP & Laba per Produk" open the 6-column `Tabel Analisis Margin` tab (`openHPPCalculatorModal('margin-table')`).
  - Fixed Packaging Box estimation in `js/dashboard.js` by matching Paket Ori products (`Paket Dada`, `Paket P.Atas`, `Paket P.bawah`, `Paket Sayap`) without requiring the word 'ori' in the name (`isOriPaket = isPaket && !isGeprek`) and adding support for abbreviated parts (`p.atas`, `p.bawah`), bumped PWA cache to `pos-cache-v100` in `sw.js`.
- **Operational Expense Payment Method Option (`Tunai` / `Non-Tunai`)**:
  - Added payment method selection (`Tunai` vs `Non-Tunai`) in `#modal-expense` form and `#expenses-table` column in `index.html`.
  - Updated `js/app.js` and `js/expenses.js` to set default `'Tunai'`, load `payment_method` on edit, render payment method badges, and save `payment_method` to `operational_costs`.
  - Updated `js/dashboard.js` so that **Omset Bersih Cash** in the *Omset Bersih Tunai vs Setoran* chart only subtracts operational expenses where `payment_method = 'Tunai'`, excluding `Non-Tunai` expenses (e.g., equipment installments, cashier modal transfers) from physical cash flow comparisons.
  - Bumped PWA cache version to `pos-cache-v83` in `sw.js` and updated `Database_ERD.md` and `Business_Rules_Formulas.md`.
- **Comprehensive 9-Sheet Dashboard Excel Export**:
  - Upgraded `exportDashboardExcel()` in `js/dashboard.js` to export 9 dedicated sheets corresponding to every card, table, and chart on the dashboard (`Ringkasan Total & Laba`, `Arus Kas & Setoran`, `Pendapatan & Pengeluaran`, `Metode Pembayaran`, `Omset Bersih Per Metode`, `Produk Terjual`, `Estimasi Kantong Ayam`, `Estimasi Packaging Box`, and `Jam Sibuk (Peak Hours)`).
  - Added automatic Rupiah currency formatting (`z = '"Rp "#,##0;-"Rp "#,##0;"Rp "0'`) and tailored column widths for optimal spreadsheet readability.
  - Bumped PWA cache version to `pos-cache-v84` in `sw.js`.
- **Affiliate Claim Date Filter & Resource Optimization (`Catat Klaim Affiliate Baru`)**:
  - Added a date filter input (`#affiliate-unclaimed-date-filter`) above the unclaimed transactions table in `index.html`.
  - Updated `js/affiliate.js` (`loadUnclaimedTransactions` and `onAffiliateUnclaimedDateChange`) to default to today's date (`YYYY-MM-DD`) when opening the modal and query Supabase strictly for transactions created on the selected date instead of fetching 5,000 historical rows.
  - Ensured any transactions checked across different dates or loaded in edit mode remain preserved in `unclaimedTransactionsList`.
  - Bumped PWA cache version to `pos-cache-v85` in `sw.js`.
- **Accumulated Multi-Posting Affiliate Payment Feature (`Bayar Terpilih`)**:
  - Added checkbox column with Select-All support in `#affiliate-postings-table` (`index.html`) allowing Superadmins to select multiple `Unpaid` affiliate postings simultaneously.
  - Added `Bayar Terpilih (Count | Total Rp)` button in the action bar above the affiliate table in `index.html`.
  - Upgraded `openPaySelectedAffiliateModal()` and `handleSaveAffiliatePayment()` in `js/affiliate.js` to process batch payments, updating all selected postings in Supabase (`affiliate_postings`) to `Paid` with timestamp and optional transfer proof attachment in a single operation.
  - Bumped PWA cache version to `pos-cache-v86` in `sw.js`.
- **Transaction Payment Method Editing (`Riwayat Transaksi`)**:
  - Added an Edit Payment Method button (pencil icon) in the **Aksi** column of `#history-table` (`js/history.js`), restricted exclusively to `superadmin` and `owner` roles (`canEditPaymentMethod()`).
  - Implemented `#modal-edit-payment-method` in `index.html` allowing Superadmin/Owner to select a new payment method (`Tunai`, `QRIS`, `Bank Transfer`, `Go Food`, `Grab Food`, `Shopee Food`) for any completed transaction.
  - Added dynamic cash adjustment inputs (`Tunai Diterima` and automatic `Kembalian` calculation) when changing a transaction's payment method to `Tunai`.
  - Added `openEditPaymentMethodModal()` and `handleSaveEditPaymentMethod()` in `js/history.js` to update `payment_method`, `cash_received`, and `change_amount` in Supabase (`transactions`) and refresh the table and dashboard automatically.
  - Bumped PWA cache version to `pos-cache-v87` in `sw.js`.
- **Operational Expenses Excel Export (`Biaya Operasional`)**:
  - Added an **Export Excel** button (`#btn-export-expenses-excel`) to the action bar above `#expenses-table` in `index.html`.
  - Implemented `exportExpensesToExcel()` in `js/expenses.js` to generate and download a formatted spreadsheet (`Laporan_Biaya_Operasional_YYYY-MM-DD.xlsx`) containing all operational expenses for the active outlet, including columns for Document Number, Date, Total Amount, Payment Method (`Tunai` vs `Non-Tunai`), Notes, and Cashier Name.
  - Added automatic Rupiah formatting (`'"Rp "#,##0;-"Rp "#,##0;"Rp "0'`) and summary rows (`TOTAL KESELURUHAN`, `TOTAL TUNAI`, and `TOTAL NON-TUNAI`).
  - Bumped PWA cache version to `pos-cache-v88` in `sw.js`.
- **Transaction Customer Name & Payment Method Editing (`Riwayat Transaksi`)**:
  - Upgraded `#modal-edit-payment-method` in `index.html` to allow editing **Customer Name** (`#edit-pm-customer-name`) in addition to the payment method for completed transactions.
  - Updated `openEditPaymentMethodModal()` and `handleSaveEditPaymentMethod()` in `js/history.js` to select and update `customer_name` in Supabase (`transactions`).
  - Stored loaded transactions array in `window.historyTransactionsList` and updated `openEditPaymentMethodModal()` to immediately check and populate `customer_name` from local table data (fallback to DB query) so existing names like "A hamdan" are always pre-filled reliably.
  - Simplified payment method editing rules in `js/history.js`: only transactions with payment method `Tunai` can have their payment method changed (can be changed to `Tunai`, `QRIS`, or `Bank Transfer`); any non-Tunai payment method is locked from editing. Customer Name remains editable for all transactions.
  - Bumped PWA cache version to `pos-cache-v94` in `sw.js`.
- **Operational Expenses Multi-Sheet Detail Excel Export (`Biaya Operasional`)**:
  - Enhanced `exportExpensesToExcel()` in `js/expenses.js` to fetch `operational_cost_items` alongside `operational_costs` and export a 2-sheet workbook (`Laporan_Biaya_Operasional_YYYY-MM-DD.xlsx`).
  - Sheet 1 (**`Ringkasan Biaya`**): Includes a new **Rincian Item Pengeluaran** column displaying an itemized summary string for each document (e.g. `Gas Elpiji (1x @Rp 22.000 = Rp 22.000); Es Batu (2x @Rp 10.000 = Rp 20.000)`).
  - Sheet 2 (**`Detail Per Item`**): Dedicated analytical sheet where each individual expense item is listed on its own row with columns for `Kategori Biaya`, `Qty`, `Harga Satuan (Rp)`, and `Subtotal (Rp)`, enabling Excel filtering, sorting, and pivot table analysis by expense category.
  - Added automatic Rupiah formatting and summary rows (`TOTAL KESELURUHAN`, `TOTAL TUNAI`, `TOTAL NON-TUNAI`) across both sheets.
  - Formatted table Keterangan column in `js/expenses.js` (`#expenses-table`) with a compact `max-width: 160px` and text ellipsis truncation (`...`) so long notes do not stretch the table, while keeping full text accessible via hover tooltip and Edit modal.
  - Upgraded `#expense-notes` input in `index.html` (`#modal-expense`) to a `<textarea>` with multi-line support (`newline`/Enter).
  - Bumped PWA cache version to `pos-cache-v95` in `sw.js`.
- **Changelog Reset & Documentation Synchronization (`docs/*.md`)**:
  - Synchronized and updated all documentation markdown files in `pos/docs/` (`PRD.md`, `TechStack.md`, `Database_ERD.md`, `DOM_Modal_Map.md`, `Business_Rules_Formulas.md`, `RPC_Functions.md`) to reflect the latest NTPOS architecture and expense separation logic in English per **Rule 8**.
  - Reset historical changelog entries per user request.
