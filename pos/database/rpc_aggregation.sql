-- =====================================================
-- RPC: get_dashboard_summary
-- Digunakan oleh tab Dashboard POS (per outlet)
-- =====================================================
CREATE OR REPLACE FUNCTION get_dashboard_summary(
    p_outlet_id UUID,
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_revenue', COALESCE(agg.total_revenue, 0),
        'total_trx', COALESCE(agg.total_trx, 0),
        'method_summary', COALESCE(methods.arr, '[]'::json),
        'product_summary', COALESCE(products.arr, '[]'::json)
    ) INTO result
    FROM (
        SELECT
            SUM(t.total_amount) AS total_revenue,
            COUNT(*) AS total_trx
        FROM transactions t
        WHERE t.outlet_id = p_outlet_id
          AND t.created_at >= p_start_date
          AND t.created_at <= p_end_date
    ) agg,
    LATERAL (
        SELECT json_agg(row_to_json(m)) AS arr
        FROM (
            SELECT
                COALESCE(t.payment_method, 'Tunai') AS method,
                COUNT(*) AS count,
                SUM(t.total_amount) AS total
            FROM transactions t
            WHERE t.outlet_id = p_outlet_id
              AND t.created_at >= p_start_date
              AND t.created_at <= p_end_date
            GROUP BY t.payment_method
            ORDER BY SUM(t.total_amount) DESC
        ) m
    ) methods,
    LATERAL (
        SELECT json_agg(row_to_json(p)) AS arr
        FROM (
            SELECT
                COALESCE(pr.name, 'Produk Terhapus') AS name,
                SUM(ti.quantity) AS qty,
                SUM(ti.quantity * ti.price) AS revenue
            FROM transaction_items ti
            JOIN transactions t ON t.id = ti.transaction_id
            LEFT JOIN products pr ON pr.id = ti.product_id
            WHERE t.outlet_id = p_outlet_id
              AND t.created_at >= p_start_date
              AND t.created_at <= p_end_date
            GROUP BY pr.name
            ORDER BY SUM(ti.quantity) DESC
        ) p
    ) products;

    RETURN result;
END;
$$;


-- =====================================================
-- RPC: get_analytics_summary
-- Digunakan oleh tab Analytics Superadmin/Management
-- =====================================================
CREATE OR REPLACE FUNCTION get_analytics_summary(
    p_outlet_ids UUID[] DEFAULT NULL,
    p_start_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_revenue', COALESCE(agg.total_revenue, 0),
        'total_trx', COALESCE(agg.total_trx, 0),
        'total_items', COALESCE(agg.total_items, 0),
        'daily_revenue', COALESCE(daily.arr, '[]'::json),
        'top_products', COALESCE(top_prods.arr, '[]'::json)
    ) INTO result
    FROM (
        SELECT
            SUM(t.total_amount) AS total_revenue,
            COUNT(*) AS total_trx,
            COALESCE(SUM(items_agg.item_count), 0) AS total_items
        FROM transactions t
        LEFT JOIN (
            SELECT transaction_id, SUM(quantity) AS item_count
            FROM transaction_items
            GROUP BY transaction_id
        ) items_agg ON items_agg.transaction_id = t.id
        WHERE (p_outlet_ids IS NULL OR t.outlet_id = ANY(p_outlet_ids))
          AND (p_start_date IS NULL OR t.created_at >= p_start_date)
    ) agg,
    LATERAL (
        SELECT json_agg(row_to_json(d) ORDER BY d.date) AS arr
        FROM (
            SELECT
                (t.created_at AT TIME ZONE 'Asia/Jakarta')::date::text AS date,
                SUM(t.total_amount) AS revenue
            FROM transactions t
            WHERE (p_outlet_ids IS NULL OR t.outlet_id = ANY(p_outlet_ids))
              AND (p_start_date IS NULL OR t.created_at >= p_start_date)
            GROUP BY (t.created_at AT TIME ZONE 'Asia/Jakarta')::date
        ) d
    ) daily,
    LATERAL (
        SELECT json_agg(row_to_json(tp)) AS arr
        FROM (
            SELECT
                COALESCE(pr.name, 'Unknown') AS name,
                SUM(ti.quantity) AS qty
            FROM transaction_items ti
            JOIN transactions t ON t.id = ti.transaction_id
            LEFT JOIN products pr ON pr.id = ti.product_id
            WHERE (p_outlet_ids IS NULL OR t.outlet_id = ANY(p_outlet_ids))
              AND (p_start_date IS NULL OR t.created_at >= p_start_date)
            GROUP BY pr.name
            ORDER BY SUM(ti.quantity) DESC
            LIMIT 5
        ) tp
    ) top_prods;

    RETURN result;
END;
$$;
