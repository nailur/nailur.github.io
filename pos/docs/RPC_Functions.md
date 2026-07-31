# Supabase RPC & Database Functions Reference - NTPOS

This document references stored SQL functions (RPCs) and database triggers in Supabase invoked from client JavaScript via `supabase.rpc('function_name', { params })`.

---

## 1. Stored RPC Functions & Calling Parameters

| RPC Function Name | Input Parameters (`params`) | Return Type | Description & Purpose |
|---|---|---|---|
| `generate_receipt_no` | `{ p_outlet_id: uuid }` | `text` (receipt code) | Generates sequential, formatted receipt codes per outlet (e.g., `INV-20260731-0001`). Used as default receipt number during checkout. |
| `update_inventory_stock_from_posting` | (Trigger-based / No manual RPC) | `void` | Automatic trigger updating `current_stock` in `inventory_items` upon row insertion into `inventory_posting_items`. |
| `get_my_role` | (None) | `text` (`'superadmin'`, `'owner'`, `'kasir'`, etc.) | Retrieves the authenticated user's role from the `profiles` table based on `auth.uid()`. |
| `get_my_outlet_id` | (None) | `uuid` | Returns the assigned `outlet_id` for the authenticated user profile. |
| `get_my_branch_id` | (None) | `uuid` | Returns the assigned `branch_id` for the authenticated user profile. |
| `is_superadmin` | (None) | `boolean` | Quick boolean check verifying if the authenticated user has superadmin privileges. |
| `get_db_size` | (None) | `bigint` / `text` | Returns current database storage consumption (restricted to Superadmin in Settings). |

---

## 2. Row Level Security (RLS) & RPC Scope Notes
- **Superadmin**: Full execution rights across all administrative, financial, and reporting RPCs.
- **Owner**: Execution rights for read-only analytics, multi-branch reporting, and affiliate summaries.
- **Cashier / Staff**: Execution rights restricted to transaction creation, active shift management, and attendance within their assigned `outlet_id`.
