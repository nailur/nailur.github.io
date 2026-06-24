export interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  outlet_id: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface Transaction {
  id: string;
  items: CartItem[];
  subtotal: number;
  tax: number;
  total: number;
  timestamp: number;
  outlet_id: string;
}

export interface Outlet {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  is_active: boolean;
  created_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  outlet_id: string | null;
  role: 'superadmin' | 'admin';
  email?: string;
  created_at: string;
}

export type AppRole = 'superadmin' | 'admin';
