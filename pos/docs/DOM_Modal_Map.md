# DOM & Modal Mapping - NTPOS

This document maps Modal IDs, Form IDs, Trigger Buttons, and associated JS handlers in `pos/index.html` to avoid searching large DOM files (>2,800 lines).

---

## 1. Main Modals & Forms

| Module / Feature | Modal ID (`#id`) | Form / Container ID | Opening JS Function | Saving JS Function | JS File |
|---|---|---|---|---|---|
| **Product Catalog** | `#modal-product` | `#product-form` | `openProductModal()` | `handleSaveProduct(e)` | `js/products.js` |
| **Checkout / Payment** | `#modal-checkout` | `#checkout-content` | `openCheckoutModal()` | `finalizeCheckout()` | `js/checkout.js` (facade → `cart.js`) |
| **Discounts & Promo** | `#modal-discount` | `#discount-form` | `editDiscount(id)` / `setupDiscountForm()` | (inline in setupDiscountForm) | `js/discounts.js` |
| **Inventory Master** | `#modal-inventory` | `#inventory-form` | `openInventoryModal(id)` | `saveInventory(e)` | `js/inventory.js` |
| **Stock Adjustment (In/Out)** | `#modal-stock-posting` | `#stock-posting-form` | `openStockPostingModal(type)` | `saveStockPosting(e)` | `js/inventory.js` |
| **Expense Master** | `#modal-expense-item` | `#expense-item-form` | `openExpenseItemModal(id)` | `saveExpenseItem(e)` | `js/expenses.js` |
| **Record Expense** | `#modal-expense-posting` | `#expense-posting-form` | `openExpensePostingModal()` | `saveExpensePosting(e)` | `js/expenses.js` |
| **Cashier Deposit** | `#modal-deposit` | `#deposit-form` | `openDepositModal()` | `saveDeposit(e)` | `js/app.js` |
| **MDR Fee Settings** | `#modal-mdr` | `#form-mdr-settings` | Click handler on `#btn-open-mdr-settings` | Click handler on save button | `js/dashboard.js` |
| **HPP & Profitability Calculator** | `#modal-hpp-calculator` | `#hpp-tab-margin-table`, `#hpp-tab-bahan-baku`, `#hpp-tab-opex` | `openHPPCalculatorModal()` | `saveHPPSettingsFromForm()` | `js/hpp.js` |
| **Affiliate Period** | `#modal-affiliate-period` | `#modal-affiliate-period-form` | `openCreatePeriodModal(id)` | `handleSavePeriod(e)` | `js/affiliate.js` |
| **Affiliate Product Commission** | `#modal-affiliate-setting` | `#affiliate-setting-form` | `openCommissionSettingModal()` | `saveCommissionSetting(e)` | `js/affiliate.js` |
| **Affiliate Claim / Posting**| `#modal-affiliate-posting` | `#affiliate-posting-form` | `openCreateAffiliateModal(id)`| `handleSaveAffiliatePosting(e)`| `js/affiliate.js` |
| **Affiliate Commission Payment** | `#modal-affiliate-pay` | `#affiliate-pay-form` | `openPayAffiliateModal(id)` | `handleSaveAffiliatePayment(e)`| `js/affiliate.js` |
| **Staff / User Management** | `#modal-user` | `#user-form` | `editUser(id)` (management.js) | `handleAddUser(e)` (management.js) | `js/users.js` + `js/management.js` |

---

## 2. Main POS Tabs & Navigation

| POS Tab Name | Navigation Button Selector | Content Container ID | Main Load Data Function |
|---|---|---|---|
| **Cashier / POS** | `[data-target="pos-tab-content"]` | `#pos-tab-content` | `loadProducts()`, `renderCart()` |
| **Transaction History** | `[data-target="history-tab-content"]` | `#history-tab-content` | `loadHistory()` |
| **Inventory & Stock** | `[data-target="stock-tab-content"]` | `#stock-tab-content` | `loadInventory()`, `loadStockPostings()` |
| **Expenses** | `[data-target="expenses-tab-content"]` | `#expenses-tab-content` | `loadExpenseMaster()`, `loadExpenses()` |
| **Cashier Deposits** | `[data-target="deposits-tab-content"]` | `#deposits-tab-content` | `loadDeposits()` |
| **Affiliate (Superadmin/Owner)**| `[data-target="affiliate-tab-content"]`| `#affiliate-tab-content` | `loadAffiliatePostings()`, `loadAffiliateSettings()`|
| **Dashboard / Analytics** | `[data-target="dashboard-tab-content"]` | `#dashboard-tab-content` | `loadDashboard()` |

---

## 3. Dashboard Key Cards & Visual Elements Mapping

| Dashboard Element | Element / Container ID | JS Rendering Source | Description |
|---|---|---|---|
| **Operational Expense Card** | `#dash-operational-expense` | `js/dashboard.js` (`loadDashboard`) | Aggregated sum from `operational_costs` table |
| **Stock Expense Card** | `#dash-stock-expense` | `js/dashboard.js` (`loadDashboard`) | Aggregated sum from `inventory_postings` (`type = 'in'`) |
| **Chicken Bag Estimation Card** | `#chicken-bag-card` | `js/dashboard.js` (`loadDashboard`) | Shrunken 2-column card estimating chicken bag usage vs stock |
| **Packaging Box Estimation Card** | `#packaging-box-card` | `js/dashboard.js` (`loadDashboard`) | Estimates Box Ukuran M (Paket variants) and Box Ukuran XS (Geprek non-paket) |
| **Estimated Net Profit Card** | `#net-profit-card` | `js/dashboard.js` (`loadDashboard`) | Itemizes Gross Revenue, MDR Fees, Operational Expenses, Stock Expenses, and Profit Sharing |
| **Revenue vs Expenses Chart** | `#revenueChart` | `js/dashboard.js` (`loadDashboard`) | Bar chart displaying `Pendapatan (Rp)`, `Pengeluaran Operasional (Rp)`, and `Pengeluaran Stock (Rp)` |
| **Net Cash vs Deposit Chart** | `#depositComparisonChart` | `js/dashboard.js` (`loadDashboard`) | Bar chart comparing `Omset Bersih Cash` (`Omset Tunai - Pengeluaran Operasional`) against `Setoran` |
