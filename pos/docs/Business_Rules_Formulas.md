# Business Rules & Formulas - NTPOS

This document summarizes the core business rules, calculation logic, and formulas used in NTPOS so that AI agents do not need to read lengthy calculation implementations in JavaScript code.

---

## 1. Cart & Checkout Calculation
- **Item Subtotal**: `qty * (price + modifier_price)`
- **Item Discount**: Can be percentage (`%`) or fixed nominal (`Rp`). Calculated per item row.
- **Global Discount**:
  - Applied after total item subtotals are reduced by item discounts.
  - Can be percentage or fixed nominal.
- **Grand Total**:
  ```
  Grand Total = Math.max(0, Total Subtotal - Total Item Discounts - Global Discount)
  ```
- **Change Amount**: `Cash Received - Grand Total` (if payment method is cash).

---

## 2. Affiliate Commission & Bonus Calculation (Affiliate Module)
- **Transaction Claim**: Affiliates claim one or more sales transactions that are unclaimed (`affiliate_claimed = false`).
- **Product Quantity Accumulation**: Total `qty` per product is aggregated from all selected transactions within a posting.
- **Commission Rate Selection (Normal vs Bulk)**:
  - If `total_qty >= 15` (or specified bulk threshold), use `bulk_commission_nominal`.
  - If `total_qty < 15`, use `commission_nominal`.
- **Product Commission Subtotal Formula**:
  ```
  Commission Subtotal = total_qty * commission_rate
  ```
- **Multiple Bonus Formula (Bonus Target Qty)**:
  - Each product has `bonus_target_qty` (default: `15`, customizable e.g. `10`) and `bonus_nominal` (e.g. Rp `5,000`).
  - Bonus is awarded for every multiple reached:
  ```
  Additional Bonus = Math.floor(total_qty / bonus_target_qty) * bonus_nominal
  ```
- **Total Posting Commission**: Sum of all item commission subtotals plus multiple bonuses.

---

## 3. Inventory Stock & Adjustment Calculation
- **Stock In (`type = 'in'`)**: Increases actual stock (`current_stock = current_stock + qty`).
- **Stock Out (`type = 'out'`)**: Decreases actual stock (`current_stock = current_stock - qty`).
- **Negative Stock Check**: Application warns or prevents deduction if usage exceeds remaining actual stock.

---

## 4. Cash Drawer & Shift Calculation
- **Opening Balance**: Entered by cashier when opening shift (`shift_sessions`).
- **Cash Inflows**: Total *Cash* transactions + Total *Deposits*.
- **Cash Outflows**: Total *Expenses* recorded during the shift.
- **Expected Ending Balance**:
  ```
  Expected Balance = Opening Balance + Total Cash Transactions + Total Deposits - Total Expenses
  ```
- **Cash Variance**: `Actual Cash Count - Expected Balance` (Positive = Surplus, Negative = Shortage).

---

## 5. Dashboard Financial & Expense Separation
- **Operational Expenses (`Pengeluaran Operasional`)**: Aggregated from `operational_costs` table. Can be recorded as either `Tunai` or `Non-Tunai`.
- **Stock Expenses (`Pengeluaran Stock`)**: Aggregated from `inventory_postings` table where `type = 'in'`.
- **Net Cash Revenue (`Omset Bersih Cash`)**:
  ```
  Net Cash Revenue = Cash Revenue - Operational Expenses (Tunai Only)
  ```
  *Note: Non-Tunai Operational Expenses and Stock Expenses do not reduce Net Cash Revenue. This ensures daily cash deposit comparisons (`Selisih = Setoran - Omset Bersih Cash`) reflect physical cashier cash flows without backend inventory purchase or non-cash expense distortions.*
- **Deposit Variance (`Selisih`)**:
  ```
  Selisih = Setoran (Cash Deposit) - Net Cash Revenue
  ```
- **Estimated Net Profit (`Estimasi Laba Bersih`)**:
  ```
  Net Profit = Gross Revenue - MDR Fees - Operational Expenses - Stock Expenses
  ```
- **Profit Sharing**: Calculated from Net Profit based on configurable percentages for Business Owner and Investor.

---

## 6. Packaging & Consumables Estimation
- **Chicken Bags (`Kantong Ayam Dibuka`)**:
  - Estimated per chicken part (`Dada`, `Paha Atas`, `Paha Bawah`, `Sayap`) based on sold item names.
  - Compares estimated usage against inventory stock (`inventory_items`).
- **Packaging Boxes (`Packaging Box Terpakai`)**:
  - **Box Ukuran M**: Assigned to all sold `Paket Ayam Ori` and `Paket Ayam Geprek` variants (`Dada`, `Paha Atas`, `Paha Bawah`, `Sayap`).
  - **Box Ukuran XS**: Assigned to all sold `Ayam Geprek` (non-paket) variants (`Dada`, `Paha Atas`, `Paha Bawah`, `Sayap`).

---

## 7. HPP & Profitability Calculator Formulas (`js/hpp.js`)
- **Equal Chicken Cost Allocation**:
  - 1 bag (`kantong`) = 9 pieces (`3 Dada, 2 Paha Atas, 2 Paha Bawah, 2 Sayap`).
  - `HPP per piece = Price per Kantong / 9`.
- **Sauce Allocation (`Saos`)**:
  - 1 pack = 24 sachets.
  - `Dada` & `Paha Atas` = 2 sachets per piece.
  - `Paha Bawah` & `Sayap` = 1 sachet per piece.
- **Deep Fryer Solid Oil (`Minyak Beku 15Kg`)**:
  - Consumption: `200 gr` per bag (9 pcs) + replacement `15,000 gr / 350 bags = ~42.86 gr/bag`.
  - Total oil cost per piece = `((200 + 42.86) / 9) * Price per gram`.
- **Seasoned Flour (`Tepung Bumbu`)**:
  - Mix ratio: `100 gr` premix (`Tepung Biang`) + `1,000 gr` all-purpose flour (`Tepung Serbaguna`).
  - `10 kg` mix covers 27 bags (243 pieces).
- **OPEX Absorption per Portion**:
  - Aggregated monthly overhead = Electricity (`163.16 kWh * Rate`) + Gas 3Kg + Trash Bags + Latex Gloves + Cooking Masks + Consumables.
  - `OPEX per Portion = Total Monthly OPEX / (Target Daily Volume * 30 Days)`.
- **Offline vs Online Margin Formula**:
  - `Offline Profit (Rp) = Offline Selling Price - (Raw COGS + OPEX per Portion)`.
  - `Online Selling Price = Offline Selling Price + Rp 4,000`.
  - `Online Net Revenue = Online Selling Price * (1 - 0.20)` (20% platform commission fee).
  - `Online Profit (Rp) = Online Net Revenue - (Raw COGS + OPEX per Portion)`.


