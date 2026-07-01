-- =====================================
-- PATCH V17: RPC for Atomic Checkout and Inventory Deduction
-- =====================================

CREATE OR REPLACE FUNCTION public.process_checkout(
  p_outlet_id UUID,
  p_cashier_id UUID,
  p_subtotal_amount NUMERIC,
  p_discount_amount NUMERIC,
  p_tax_amount NUMERIC,
  p_total_amount NUMERIC,
  p_payment_method TEXT,
  p_customer_name TEXT,
  p_items JSONB
) RETURNS UUID AS $$
DECLARE
  v_transaction_id UUID;
  v_item JSONB;
BEGIN
  -- 1. Insert Transaction
  INSERT INTO public.transactions (
    outlet_id, 
    cashier_id, 
    subtotal_amount, 
    discount_amount, 
    tax_amount, 
    total_amount, 
    payment_method, 
    customer_name
  ) VALUES (
    p_outlet_id,
    p_cashier_id,
    p_subtotal_amount,
    p_discount_amount,
    p_tax_amount,
    p_total_amount,
    p_payment_method,
    p_customer_name
  ) RETURNING id INTO v_transaction_id;

  -- 2. Process each item
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Insert Transaction Item
    INSERT INTO public.transaction_items (
      transaction_id,
      product_id,
      quantity,
      price
    ) VALUES (
      v_transaction_id,
      (v_item->>'product_id')::UUID,
      (v_item->>'quantity')::INTEGER,
      (v_item->>'price')::NUMERIC
    );

    -- Reduce Stock
    UPDATE public.products 
    SET stock = stock - (v_item->>'quantity')::INTEGER
    WHERE id = (v_item->>'product_id')::UUID;
  END LOOP;

  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
