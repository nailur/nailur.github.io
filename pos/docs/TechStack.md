# Technology Stack - NTPOS

## 1. Overview
NTPOS utilizes a **JAMStack (JavaScript, APIs, Markup)** and **BaaS (Backend-as-a-Service)** ecosystem to achieve high scalability with **Zero-Server Maintenance**. Data security and heavy business logic are offloaded directly to the Database Engine level.

## 2. Frontend (Client-side)
The client application is built without heavy bundlers or frameworks (React/Vue/Angular), keeping bundle sizes minimal.

- **Language/Structure**: HTML5, CSS3, Vanilla JavaScript (ES6+).
- **Progressive Web App (PWA)**: 
  - `manifest.json` (Installation settings & theme).
  - `sw.js` (Service Worker for Offline-First caching and synchronization).
- **Third-Party Libraries**:
  - **Phosphor Icons**: Modern and consistent UI icon system.
  - **Chart.js**: Analytical data visualization for revenue reports and sales statistics.
  - **SheetJS**: HTML/JSON data table processing and export to Microsoft Excel (.xlsx) format.
  - **Browser Image Compression**: Client-side image compression for receipts and product photos (reducing upload bandwidth).
  - **OneSignal SDK**: Push Notification broadcasting management.

## 3. Backend & Database (Supabase)
The entire backend layer is powered by **Supabase (PostgreSQL)**, providing enterprise-grade capabilities:

- **Supabase Auth**: Authentication management (Login/Signup) integrated with custom `profiles` tables via database triggers.
- **PostgreSQL**: Full-scale relational database storage.
- **Row Level Security (RLS)**: Core defensive layer. Policies are applied across tables ensuring users can only read/write data within their role scope (Superadmin vs Cashier) and assigned outlet/branch.
- **Database Functions (RPC)**:
  - Critical business processes such as transaction checkout (`process_checkout`), automatic receipt number generation (`generate_receipt_no`), and analytics summaries (`get_analytics_summary`) run as server-side SQL stored procedures to prevent client-side data tampering.
- **Supabase Edge Functions**: Deno-based server-side functions (e.g., `create-user`) utilizing the Service Role Key for admin-level operations.
- **Supabase Storage**: Bucket-scoped media storage:
  - `product-images` (Public): Catalog product images.
  - `attachments` (Private): Internal documents such as bank deposit slips, restricted to authenticated users.

## 4. Directory Structure Map
Vanilla modular structure for clean codebase organization:

```text
📁 /pos/
├── 📁 assets/                     # Local external libraries and assets
│   ├── 📁 img/                    # PWA image assets (Icons)
│   ├── 📁 lib/                    # supabase.min.js, browser-image-compression.js
│
├── 📁 css/                        # Stylesheets
│   ├── style.css                # Primary application stylesheet
│   ├── style-modals.css         # Popup and modal specific styling
│
├── 📁 docs/                       # Application documentation (PRD, ERD, TechStack, DOM_Modal_Map, Business_Rules_Formulas, RPC_Functions, CHANGELOG)
│
├── 📁 js/                         # Client modules (Vanilla JS)
│   ├── app.js                   # Application entry point, UI initialization, SPA tab routing
│   ├── utils.js                 # Shared utilities (showToast, escapeHtml, debounce, etc.)
│   ├── users.js                 # User & staff management UI (filterUserOutlets, handleRoleSelectionChange, loadTargetUsers)
│   ├── checkout.js              # Checkout & Payment module facade (re-exports from cart.js)
│   ├── state.js                 # Global state management for cart and UI
│   ├── auth.js                  # Authentication, login, logout, session handling (Supabase)
│   ├── supabase.js              # Supabase DB client configuration and initialization
│   ├── offline.js               # Caching, offline detection, queued transaction synchronization
│   ├── products.js              # Catalog product fetching and rendering
│   ├── cart.js                  # Shopping cart logic, total calculation, checkout execution
│   ├── history.js               # Transaction history list and Excel export
│   ├── dashboard.js             # Analytics dashboards (Chart.js), separate Operational vs Stock expenses, revenue reports
│   ├── shift.js                 # Cash drawer opening/closing logic
│   ├── shift-master.js          # Shift master data management
│   ├── shift-sessions.js        # Active shift session tracking
│   ├── attendance.js            # Staff attendance (Clock In / Clock Out)
│   ├── printer.js               # Bluetooth Web API ESC/POS receipt printing
│   ├── inventory.js             # Stock in/out management, unit conversions, categories
│   ├── management.js            # Superadmin management (Branches, Users, Outlets)
│   ├── expenses.js              # Operational costs recording and category management
│   ├── deposits.js              # Sales deposit slips and bank reconciliation
│   ├── discounts.js             # Global discounts, payment methods, item-level discounts
│   ├── modifiers.js             # Product customization options (Toppings, Sizes, Levels)
│   └── affiliate.js             # Superadmin affiliate commission claiming and period payouts
│
├── index.html                   # Single Page Application (SPA) POS interface
├── manifest.json                # PWA metadata
└── sw.js                        # PWA Service Worker (CACHE_NAME versioning)
```
