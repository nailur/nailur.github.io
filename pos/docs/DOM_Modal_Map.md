# DOM & Modal Mapping - NTPOS

Dokumen ini memetakan ID Modal, ID Form, Tombol Utama, dan File JS terkait pada antarmuka `pos/index.html` untuk menghindari pembacaan atau pencarian ulang file DOM yang besar (>2.800 baris).

---

## 1. Daftar Modal & Form Utama

| Modul / Fitur | ID Modal (`#id`) | ID Form / Kontainer | Fungsi JS Pembuka | Fungsi JS Penyimpan | File JS |
|---|---|---|---|---|---|
| **Katalog Produk** | `#modal-product` | `#product-form` | `openProductModal()` | `handleSaveProduct(e)` | `js/products.js` |
| **Checkout / Pembayaran** | `#modal-checkout` | `#checkout-content` | `openCheckoutModal()` | `finalizeCheckout()` | `js/checkout.js` (fasad → `cart.js`) |
| **Diskon & Promo** | `#modal-discount` | `#discount-form` | `editDiscount(id)` / `setupDiscountForm()` | (inline in setupDiscountForm) | `js/discounts.js` |
| **Master Inventaris** | `#modal-inventory` | `#inventory-form` | `openInventoryModal(id)` | `saveInventory(e)` | `js/inventory.js` |
| **Adjustment Stok (In/Out)** | `#modal-stock-posting` | `#stock-posting-form` | `openStockPostingModal(type)` | `saveStockPosting(e)` | `js/inventory.js` |
| **Master Biaya** | `#modal-expense-item` | `#expense-item-form` | `openExpenseItemModal(id)` | `saveExpenseItem(e)` | `js/expenses.js` |
| **Catat Pengeluaran** | `#modal-expense-posting` | `#expense-posting-form` | `openExpensePostingModal()` | `saveExpensePosting(e)` | `js/expenses.js` |
| **Setoran Kasir** | `#modal-deposit` | `#deposit-form` | `openDepositModal()` | `saveDeposit(e)` | `js/app.js` |
| **Periode Affiliate** | `#modal-affiliate-period` | `#modal-affiliate-period-form` | `openCreatePeriodModal(id)` | `handleSavePeriod(e)` | `js/affiliate.js` |
| **Atur Komisi Produk** | `#modal-affiliate-setting` | `#affiliate-setting-form` | `openCommissionSettingModal()` | `saveCommissionSetting(e)` | `js/affiliate.js` |
| **Posting / Klaim Affiliate**| `#modal-affiliate-posting` | `#affiliate-posting-form` | `openCreateAffiliateModal(id)`| `handleSaveAffiliatePosting(e)`| `js/affiliate.js` |
| **Bayar Komisi Affiliate** | `#modal-affiliate-pay` | `#affiliate-pay-form` | `openPayAffiliateModal(id)` | `handleSaveAffiliatePayment(e)`| `js/affiliate.js` |
| **Manajemen Staf / User** | `#modal-user` | `#user-form` | `editUser(id)` (management.js) | `handleAddUser(e)` (management.js) | `js/users.js` + `js/management.js` |

---

## 2. Peta Tab Utama & Navigasi POS

| Nama Tab POS | ID Tombol Navigasi | ID Kontainer Konten | Fungsi Load Data Utama |
|---|---|---|---|
| **Kasir / POS** | `[data-target="pos-tab-content"]` | `#pos-tab-content` | `loadProducts()`, `renderCart()` |
| **Riwayat Transaksi** | `[data-target="history-tab-content"]` | `#history-tab-content` | `loadHistory()` |
| **Inventaris & Stok** | `[data-target="stock-tab-content"]` | `#stock-tab-content` | `loadInventory()`, `loadStockPostings()` |
| **Pengeluaran** | `[data-target="expenses-tab-content"]` | `#expenses-tab-content` | `loadExpenseMaster()`, `loadExpenses()` |
| **Setoran Kasir** | `[data-target="deposits-tab-content"]` | `#deposits-tab-content` | `loadDeposits()` |
| **Affiliate (Superadmin/Owner)**| `[data-target="affiliate-tab-content"]`| `#affiliate-tab-content` | `loadAffiliatePostings()`, `loadAffiliateSettings()`|
| **Dashboard / Laporan** | `[data-target="dashboard-tab-content"]` | `#dashboard-tab-content` | `loadDashboard()` |
