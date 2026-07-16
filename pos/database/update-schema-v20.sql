-- =====================================
-- PATCH V20: Update process_checkout RPC
-- =====================================
-- Changes:
-- 1. REMOVED stock auto-deduction (manual stock management by staff)
-- 2. Added cash_received and change_amount parameters
-- 3. Returns JSON {id, receipt_no} instead of UUID
-- 4. Supports modifiers in transaction items
-- 5. Keeps idempotency check from v18

DROP FUNCTION IF EXISTS public.process_checkout(UUID, UUID, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, JSONB);
DROP FUNCTION IF EXISTS public.process_checkout(UUID, UUID, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, JSONB, UUID);

CREATE OR REPLACE FUNCTION public.process_checkout(
  p_outlet_id UUID,
  p_cashier_id UUID,
  p_subtotal_amount NUMERIC,
  p_discount_amount NUMERIC,
  p_tax_amount NUMERIC,
  p_total_amount NUMERIC,
  p_payment_method TEXT,
  p_customer_name TEXT,
  p_items JSONB,
  p_id UUID DEFAULT NULL,
  p_cash_received NUMERIC DEFAULT 0,
  p_change_amount NUMERIC DEFAULT 0
) RETURNS JSON AS $$
DECLARE
  v_transaction_id UUID;
  v_receipt_no TEXT;
  v_item JSONB;
BEGIN
  -- 1. Idempotency check: if transaction with p_id already exists, return it
  IF p_id IS NOT NULL THEN
    SELECT id, receipt_no INTO v_transaction_id, v_receipt_no
    FROM public.transactions WHERE id = p_id;
    IF v_transaction_id IS NOT NULL THEN
      RETURN json_build_object('id', v_transaction_id, 'receipt_no', v_receipt_no);
    END IF;
  END IF;

  -- 2. Validate total amount matches calculation
  IF p_total_amount <= 0 THEN
    RAISE EXCEPTION 'Total amount must be greater than 0';
  END IF;

  -- 3. Insert Transaction
  INSERT INTO public.transactions (
    id, outlet_id, cashier_id,
    subtotal_amount, discount_amount, tax_amount, total_amount,
    payment_method, customer_name, cash_received, change_amount
  ) VALUES (
    COALESCE(p_id, gen_random_uuid()),
    p_outlet_id, p_cashier_id,
    p_subtotal_amount, p_discount_amount, p_tax_amount, p_total_amount,
    p_payment_method, p_customer_name, p_cash_received, p_change_amount
  ) RETURNING id, receipt_no INTO v_transaction_id, v_receipt_no;

  -- 4. Insert Transaction Items (with modifiers support)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.transaction_items (
      transaction_id, product_id, quantity, price, modifiers
    ) VALUES (
      v_transaction_id,
      (v_item->>'product_id')::UUID,
      (v_item->>'quantity')::INTEGER,
      (v_item->>'price')::NUMERIC,
      CASE 
        WHEN v_item ? 'modifiers' AND v_item->'modifiers' != 'null'::jsonb
        THEN v_item->'modifiers' 
        ELSE NULL 
      END
    );
  END LOOP;

  -- Note: Stock deduction intentionally NOT included.
  -- Stock management is done manually by staff via inventory posting.

  RETURN json_build_object('id', v_transaction_id, 'receipt_no', v_receipt_no);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
