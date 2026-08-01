# Changelog & Working History - NTPOS

All changes to the codebase and project structure must be documented here to maintain context across sessions.

## [Unreleased]
*Note: Every time a new feature or task is completed, AI agents must append their changes under the current date.*

### 2026-08-01
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
  - Implemented strict payment method editing rules in `js/history.js`: transactions with `QRIS`, `Shopee Food`, `Grab Food`, or `Go Food` cannot have their payment method changed (dropdown is locked/disabled while Customer Name remains editable); transactions with `Tunai` or `Bank Transfer` can only be changed to `Tunai`, `QRIS`, or `Bank Transfer`.
  - Bumped PWA cache version to `pos-cache-v92` in `sw.js`.
- **Operational Expenses Multi-Sheet Detail Excel Export (`Biaya Operasional`)**:
  - Enhanced `exportExpensesToExcel()` in `js/expenses.js` to fetch `operational_cost_items` alongside `operational_costs` and export a 2-sheet workbook (`Laporan_Biaya_Operasional_YYYY-MM-DD.xlsx`).
  - Sheet 1 (**`Ringkasan Biaya`**): Includes a new **Rincian Item Pengeluaran** column displaying an itemized summary string for each document (e.g. `Gas Elpiji (1x @Rp 22.000 = Rp 22.000); Es Batu (2x @Rp 10.000 = Rp 20.000)`).
  - Sheet 2 (**`Detail Per Item`**): Dedicated analytical sheet where each individual expense item is listed on its own row with columns for `Kategori Biaya`, `Qty`, `Harga Satuan (Rp)`, and `Subtotal (Rp)`, enabling Excel filtering, sorting, and pivot table analysis by expense category.
  - Added automatic Rupiah formatting and summary rows (`TOTAL KESELURUHAN`, `TOTAL TUNAI`, `TOTAL NON-TUNAI`) across both sheets.
  - Bumped PWA cache version to `pos-cache-v90` in `sw.js`.
- **Changelog Reset & Documentation Synchronization (`docs/*.md`)**:
  - Synchronized and updated all documentation markdown files in `pos/docs/` (`PRD.md`, `TechStack.md`, `Database_ERD.md`, `DOM_Modal_Map.md`, `Business_Rules_Formulas.md`, `RPC_Functions.md`) to reflect the latest NTPOS architecture and expense separation logic in English per **Rule 8**.
  - Reset historical changelog entries per user request.
