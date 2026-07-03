DO $$
DECLARE
    rec RECORD;
BEGIN
    FOR rec IN 
        SELECT oid::regprocedure AS func_signature
        FROM pg_proc
        WHERE proname = 'process_checkout' AND pronamespace = 'public'::regnamespace
    LOOP
        EXECUTE 'DROP FUNCTION ' || rec.func_signature || ' CASCADE;';
    END LOOP;
END;
$$;

-- Setelah semua versi lama dihapus, kita buat satu-satunya versi yang benar:
CREATE OR REPLACE FUNCTION public.process_checkout(
    p_id uuid,
    p_outlet_id uuid,
    p_cashier_id uuid,
    p_subtotal_amount numeric,
    p_discount_amount numeric,
    p_tax_amount numeric,
    p_total_amount numeric,
    p_payment_method text,
    p_customer_name text,
    p_items jsonb,
    p_cash_received numeric DEFAULT 0,
    p_change_amount numeric DEFAULT 0
) RETURNS uuid AS $$
DECLARE
    v_transaction_id uuid;
    v_item jsonb;
BEGIN
    -- 1. Cek idempotency jika p_id sudah ada
    IF p_id IS NOT NULL THEN
        SELECT id INTO v_transaction_id FROM public.transactions WHERE id = p_id;
        IF v_transaction_id IS NOT NULL THEN
            RETURN v_transaction_id;
        END IF;
    END IF;

    -- 2. Insert ke tabel transactions
    INSERT INTO public.transactions (
        id,
        outlet_id, 
        cashier_id, 
        subtotal_amount, 
        discount_amount, 
        tax_amount, 
        total_amount, 
        payment_method, 
        customer_name,
        cash_received,
        change_amount
    ) VALUES (
        COALESCE(p_id, uuid_generate_v4()),
        p_outlet_id,
        p_cashier_id,
        p_subtotal_amount,
        p_discount_amount,
        p_tax_amount,
        p_total_amount,
        p_payment_method,
        p_customer_name,
        p_cash_received,
        p_change_amount
    ) RETURNING id INTO v_transaction_id;

    -- 3. Insert ke tabel transaction_items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO public.transaction_items (
            transaction_id,
            product_id,
            quantity,
            price
        ) VALUES (
            v_transaction_id,
            (v_item->>'product_id')::uuid,
            (v_item->>'quantity')::int,
            (v_item->>'price')::numeric
        );
        
        -- Kurangi stok produk
        UPDATE public.products
        SET stock = stock - (v_item->>'quantity')::int
        WHERE id = (v_item->>'product_id')::uuid;
    END LOOP;

    RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
