DO $$
DECLARE
    rec RECORD;
BEGIN
    -- Hapus semua versi get_analytics_summary
    FOR rec IN 
        SELECT oid::regprocedure AS func_signature
        FROM pg_proc
        WHERE proname = 'get_analytics_summary' AND pronamespace = 'public'::regnamespace
    LOOP
        EXECUTE 'DROP FUNCTION ' || rec.func_signature || ' CASCADE;';
    END LOOP;

    -- Hapus semua versi get_dashboard_summary
    FOR rec IN 
        SELECT oid::regprocedure AS func_signature
        FROM pg_proc
        WHERE proname = 'get_dashboard_summary' AND pronamespace = 'public'::regnamespace
    LOOP
        EXECUTE 'DROP FUNCTION ' || rec.func_signature || ' CASCADE;';
    END LOOP;
END;
$$;

-- CREATE fungsi get_analytics_summary yang baru dan tunggal
CREATE OR REPLACE FUNCTION public.get_analytics_summary(p_outlet_ids uuid[], p_start_date text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_revenue numeric;
    v_total_trx int;
    v_total_discount numeric;
    v_total_tax numeric;
    v_total_items int;
    v_daily_revenue json;
    v_top_products json;
    v_payment_methods json;
    v_start_ts timestamptz;
BEGIN
    v_start_ts := p_start_date::timestamptz;
    
    -- Menghitung agregat utama
    SELECT COALESCE(SUM(total_amount), 0), COUNT(id), COALESCE(SUM(discount_amount), 0), COALESCE(SUM(tax_amount), 0)
    INTO v_total_revenue, v_total_trx, v_total_discount, v_total_tax
    FROM public.transactions
    WHERE (p_outlet_ids IS NULL OR array_length(p_outlet_ids, 1) IS NULL OR outlet_id = ANY(p_outlet_ids))
      AND created_at >= v_start_ts;
      
    -- Menghitung total items
    SELECT COALESCE(SUM(quantity), 0) INTO v_total_items
    FROM public.transaction_items ti
    JOIN public.transactions t ON t.id = ti.transaction_id
    WHERE (p_outlet_ids IS NULL OR array_length(p_outlet_ids, 1) IS NULL OR t.outlet_id = ANY(p_outlet_ids))
      AND t.created_at >= v_start_ts;

    -- Pendapatan harian
    SELECT json_agg(json_build_object('date', d, 'revenue', r)) INTO v_daily_revenue
    FROM (
        SELECT date(created_at AT TIME ZONE 'Asia/Jakarta') as d, SUM(total_amount) as r
        FROM public.transactions
        WHERE (p_outlet_ids IS NULL OR array_length(p_outlet_ids, 1) IS NULL OR outlet_id = ANY(p_outlet_ids))
          AND created_at >= v_start_ts
        GROUP BY date(created_at AT TIME ZONE 'Asia/Jakarta')
        ORDER BY d
    ) daily;
    
    -- Produk terlaris
    SELECT json_agg(json_build_object('name', name, 'qty', q)) INTO v_top_products
    FROM (
        SELECT p.name, SUM(ti.quantity) as q
        FROM public.transaction_items ti
        JOIN public.transactions t ON t.id = ti.transaction_id
        LEFT JOIN public.products p ON p.id = ti.product_id
        WHERE (p_outlet_ids IS NULL OR array_length(p_outlet_ids, 1) IS NULL OR t.outlet_id = ANY(p_outlet_ids))
          AND t.created_at >= v_start_ts
        GROUP BY p.name
        ORDER BY q DESC
        LIMIT 10
    ) prods;

    -- Metode pembayaran
    SELECT json_agg(json_build_object('method', m, 'count', c, 'total', t)) INTO v_payment_methods
    FROM (
        SELECT COALESCE(payment_method, 'Tunai') as m, COUNT(id) as c, SUM(total_amount) as t
        FROM public.transactions
        WHERE (p_outlet_ids IS NULL OR array_length(p_outlet_ids, 1) IS NULL OR outlet_id = ANY(p_outlet_ids))
          AND created_at >= v_start_ts
        GROUP BY COALESCE(payment_method, 'Tunai')
        ORDER BY t DESC
    ) methods;

    RETURN json_build_object(
        'total_revenue', v_total_revenue,
        'total_trx', v_total_trx,
        'total_discount', v_total_discount,
        'total_tax', v_total_tax,
        'total_items', v_total_items,
        'daily_revenue', COALESCE(v_daily_revenue, '[]'::json),
        'top_products', COALESCE(v_top_products, '[]'::json),
        'payment_methods', COALESCE(v_payment_methods, '[]'::json)
    );
END;
$$;


-- CREATE fungsi get_dashboard_summary yang baru dan tunggal
CREATE OR REPLACE FUNCTION public.get_dashboard_summary(p_outlet_id uuid, p_start_date text, p_end_date text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_revenue numeric;
    v_total_trx int;
    v_total_discount numeric;
    v_total_tax numeric;
    v_payment_methods json;
    v_top_products json;
    v_start_ts timestamptz;
    v_end_ts timestamptz;
BEGIN
    v_start_ts := p_start_date::timestamptz;
    v_end_ts := p_end_date::timestamptz;

    SELECT COALESCE(SUM(total_amount), 0), COUNT(id), COALESCE(SUM(discount_amount), 0), COALESCE(SUM(tax_amount), 0)
    INTO v_total_revenue, v_total_trx, v_total_discount, v_total_tax
    FROM public.transactions
    WHERE outlet_id = p_outlet_id
      AND created_at >= v_start_ts
      AND created_at <= v_end_ts;
      
    -- Metode pembayaran
    SELECT json_agg(json_build_object('method', m, 'count', c, 'total', t)) INTO v_payment_methods
    FROM (
        SELECT COALESCE(payment_method, 'Tunai') as m, COUNT(id) as c, SUM(total_amount) as t
        FROM public.transactions
        WHERE outlet_id = p_outlet_id
          AND created_at >= v_start_ts
          AND created_at <= v_end_ts
        GROUP BY COALESCE(payment_method, 'Tunai')
        ORDER BY t DESC
    ) methods;
    
    -- Produk terjual
    SELECT json_agg(json_build_object('name', name, 'qty', q, 'revenue', t)) INTO v_top_products
    FROM (
        SELECT p.name, SUM(ti.quantity) as q, SUM(ti.price * ti.quantity) as t
        FROM public.transaction_items ti
        JOIN public.transactions tr ON tr.id = ti.transaction_id
        LEFT JOIN public.products p ON p.id = ti.product_id
        WHERE tr.outlet_id = p_outlet_id
          AND tr.created_at >= v_start_ts
          AND tr.created_at <= v_end_ts
        GROUP BY p.name
        ORDER BY q DESC
        LIMIT 15
    ) prods;

    RETURN json_build_object(
        'total_revenue', v_total_revenue,
        'total_trx', v_total_trx,
        'total_discount', v_total_discount,
        'total_tax', v_total_tax,
        'method_summary', COALESCE(v_payment_methods, '[]'::json),
        'product_summary', COALESCE(v_top_products, '[]'::json)
    );
END;
$$;
