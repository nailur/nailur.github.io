-- ============================================
-- Multi-Tenant POS: Migration Script
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Create outlets table
CREATE TABLE IF NOT EXISTS outlets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE outlets REPLICA IDENTITY FULL;

-- 2. Create user_roles table
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  outlet_id UUID REFERENCES outlets(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('superadmin', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, outlet_id)
);

ALTER TABLE user_roles REPLICA IDENTITY FULL;

-- 3. Add outlet_id to products table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'outlet_id'
  ) THEN
    ALTER TABLE products ADD COLUMN outlet_id UUID REFERENCES outlets(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 4. Add outlet_id to transactions table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'outlet_id'
  ) THEN
    ALTER TABLE transactions ADD COLUMN outlet_id UUID REFERENCES outlets(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 5. Create a default outlet and migrate existing data
DO $$
DECLARE
  default_outlet_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM outlets) THEN
    INSERT INTO outlets (name, address) VALUES ('Default Outlet', 'Main Location')
    RETURNING id INTO default_outlet_id;

    UPDATE products SET outlet_id = default_outlet_id WHERE outlet_id IS NULL;
    UPDATE transactions SET outlet_id = default_outlet_id WHERE outlet_id IS NULL;
  END IF;
END $$;

-- 6. Create indexes
CREATE INDEX IF NOT EXISTS idx_products_outlet ON products(outlet_id);
CREATE INDEX IF NOT EXISTS idx_transactions_outlet ON transactions(outlet_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_outlet ON user_roles(outlet_id);

-- 7. Enable RLS on all tables
ALTER TABLE outlets ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- 8. RLS Policies

-- Helper: check if current user is superadmin
CREATE OR REPLACE FUNCTION is_superadmin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'superadmin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper: get outlet_ids for current user
CREATE OR REPLACE FUNCTION user_outlet_ids()
RETURNS SETOF UUID AS $$
BEGIN
  RETURN QUERY
    SELECT outlet_id FROM user_roles
    WHERE user_id = auth.uid() AND outlet_id IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- OUTLETS policies
DROP POLICY IF EXISTS "Superadmin full access to outlets" ON outlets;
CREATE POLICY "Superadmin full access to outlets" ON outlets
  FOR ALL USING (is_superadmin());

DROP POLICY IF EXISTS "Admin can view own outlet" ON outlets;
CREATE POLICY "Admin can view own outlet" ON outlets
  FOR SELECT USING (id IN (SELECT user_outlet_ids()));

-- USER_ROLES policies
DROP POLICY IF EXISTS "Superadmin full access to user_roles" ON user_roles;
CREATE POLICY "Superadmin full access to user_roles" ON user_roles
  FOR ALL USING (is_superadmin());

DROP POLICY IF EXISTS "Users can view own role" ON user_roles;
CREATE POLICY "Users can view own role" ON user_roles
  FOR SELECT USING (user_id = auth.uid());

-- PRODUCTS policies
DROP POLICY IF EXISTS "Superadmin full access to products" ON products;
CREATE POLICY "Superadmin full access to products" ON products
  FOR ALL USING (is_superadmin());

DROP POLICY IF EXISTS "Admin full access to own outlet products" ON products;
CREATE POLICY "Admin full access to own outlet products" ON products
  FOR ALL USING (outlet_id IN (SELECT user_outlet_ids()));

-- TRANSACTIONS policies
DROP POLICY IF EXISTS "Superadmin full access to transactions" ON transactions;
CREATE POLICY "Superadmin full access to transactions" ON transactions
  FOR ALL USING (is_superadmin());

DROP POLICY IF EXISTS "Admin full access to own outlet transactions" ON transactions;
CREATE POLICY "Admin full access to own outlet transactions" ON transactions
  FOR ALL USING (outlet_id IN (SELECT user_outlet_ids()));

-- 9. View to get user emails (for admin dashboard)
CREATE OR REPLACE VIEW user_roles_with_email AS
SELECT
  ur.id,
  ur.user_id,
  ur.outlet_id,
  ur.role,
  ur.created_at,
  au.email
FROM user_roles ur
JOIN auth.users au ON au.id = ur.user_id;

GRANT SELECT ON user_roles_with_email TO authenticated;
