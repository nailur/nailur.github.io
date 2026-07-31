# Product Requirements Document (PRD) - NTPOS

## 1. Introduction
NTPOS is an integrated Point of Sale (POS) system built with a **Progressive Web App (PWA)** and **Serverless** backend architecture. It is designed to facilitate high-speed store transactions with robust offline support while providing granular multi-role management for multi-branch food & retail operations.

## 2. Target Audience & Roles
The system enforces strict role-based access control via Supabase Row Level Security (RLS):
- **Superadmin**: Full administrative access across all branches, outlets, users, financial settings, and affiliate payouts.
- **Owner**: Business owner with read/write oversight across branches, profit-sharing views, and financial analytics.
- **Branch Head (Kepala Cabang)**: Operates and oversees multiple outlets within a designated branch.
- **Store Manager (Kepala Toko)**: Manages inventory, staff attendance, product availability, and operations for a single outlet.
- **Cashier**: Processes daily sales, manages active cash drawer shifts, and records operational expenses.

## 3. Core Features

### 3.1. POS & Transaction Processing
- **Real-Time Catalog & Modifiers**: Searchable product catalog with support for item modifiers (e.g., Toppings, Spice Levels, Sizes).
- **Cart Management**: Dynamic subtotal, tax, item-level/global discount calculation, and checkout execution.
- **Flexible Payments**: Support for Cash, QRIS, Debit, Credit, and Online Transfers with configurable MDR fees per method.
- **Receipt & Printer**: Thermal Bluetooth printer integration (ESC/POS Web API) and transaction void capabilities.
- **Offline First**: Service Worker caching (`CACHE_NAME` versioned) enables seamless operation during network outages.

### 3.2. Cash Drawer & Shift Management (`shift-sessions`)
- Mandatory opening cash drawer balance entry (`Starting Cash`).
- Shift session tracking that binds sales and operational expenses to the active cashier shift.
- Expected cash reconciliation against actual cash count upon shift closing.

### 3.3. Inventory & Financial Management
- **Inventory Postings**: Multi-unit stock in/out adjustments with automatic conversion ratios.
- **Expense Separation**:
  - **Operational Expenses**: Day-to-day store expenses (`operational_costs`).
  - **Stock Expenses**: Inventory replenishment costs (`inventory_postings` where `type = 'in'`).
- **Sales Deposits**: Bank deposit slips and reconciliation with Net Cash Revenue.

### 3.4. Staff & Attendance (`attendance`)
- Clock In / Clock Out tracking bound to user profiles and assigned outlets.

### 3.5. Dashboard Analytics & Packaging Estimation
- **Financial Analytics**: Interactive Chart.js graphs displaying Gross Revenue, Operational Expenses, Stock Expenses, and Net Revenue by payment method.
- **Net Cash Isolation**: Isolates daily cashier cash flow (`Cash Sales - Operational Expenses`) from backend stock purchases for deposit variance tracking (`Selisih`).
- **Packaging Box & Consumables Estimation**:
  - Automatically calculates `Kantong Ayam Dibuka` based on sold chicken pieces.
  - Calculates `Packaging Box Terpakai`: **Box Ukuran M** for all `Paket Ayam Ori` and `Paket Ayam Geprek` variants; **Box Ukuran XS** for `Ayam Geprek` non-paket variants.
- **Profit Sharing**: Calculates Estimated Net Profit and splits returns between Business Owner and Investor based on outlet configuration.

### 3.6. Affiliate Commission System (`affiliate`)
- Dedicated Superadmin/Owner module for managing affiliate partners.
- Configurable base commission, bulk threshold rates, and multiple target bonuses (`bonus_target_qty` and `bonus_nominal`).
- Period claim creation and commission payout settlement.

## 4. User Flow (Cashier)
1. **Clock-in & Shift Open**: Cashier logs in, clocks attendance, and opens the cash drawer by inputting starting cash.
2. **Sales Execution**: Cashier selects items, applies modifiers/discounts, and completes checkout.
3. **Closing Shift**: Cashier closes shift, enters physical cash count, and reviews cash variance.
4. **Synchronization**: Queued offline transactions automatically sync to Supabase once connectivity is restored.
