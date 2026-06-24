-- Create products table
CREATE TABLE products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  category TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert sample products
INSERT INTO products (id, name, price, category) VALUES
('1', 'Coffee', 3.50, 'Beverages'),
('2', 'Espresso', 2.50, 'Beverages'),
('3', 'Cappuccino', 4.00, 'Beverages'),
('4', 'Croissant', 3.00, 'Pastries'),
('5', 'Donut', 2.00, 'Pastries'),
('6', 'Muffin', 2.75, 'Pastries'),
('7', 'Sandwich', 6.50, 'Food'),
('8', 'Salad', 7.50, 'Food'),
('9', 'Juice', 3.00, 'Beverages'),
('10', 'Water', 1.50, 'Beverages');

-- Create index
CREATE INDEX idx_products_category ON products(category);
