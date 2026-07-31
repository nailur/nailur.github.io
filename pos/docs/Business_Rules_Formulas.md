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
