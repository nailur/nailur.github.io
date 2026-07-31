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
- **Changelog Reset & Documentation Synchronization (`docs/*.md`)**:
  - Synchronized and updated all documentation markdown files in `pos/docs/` (`PRD.md`, `TechStack.md`, `Database_ERD.md`, `DOM_Modal_Map.md`, `Business_Rules_Formulas.md`, `RPC_Functions.md`) to reflect the latest NTPOS architecture and expense separation logic in English per **Rule 8**.
  - Reset historical changelog entries per user request.
