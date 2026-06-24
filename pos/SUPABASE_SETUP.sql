-- Create transactions table
CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  items JSONB NOT NULL,
  subtotal DECIMAL(10, 2) NOT NULL,
  tax DECIMAL(10, 2) NOT NULL,
  total DECIMAL(10, 2) NOT NULL,
  timestamp BIGINT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX idx_transactions_timestamp ON transactions(timestamp DESC);

-- Enable real-time
ALTER TABLE transactions REPLICA IDENTITY FULL;
