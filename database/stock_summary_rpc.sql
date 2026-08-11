-- SORA POS: aggregate stock dashboard metrics inside PostgreSQL.
-- Run after schema.sql and the stock/expiry migrations.
-- The backend keeps a JS fallback for databases that have not applied this file.

CREATE OR REPLACE FUNCTION public.get_stock_summary()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH active_products AS (
  SELECT
    p.id,
    p.name,
    p.sku,
    p.stock_quantity,
    p.min_stock_level,
    p.cost_price,
    p.sell_price,
    COALESCE(c.id::text, 'uncategorized') AS category_id,
    COALESCE(c.name, 'Chưa phân loại') AS category_name
  FROM public.products p
  LEFT JOIN public.categories c ON c.id = p.category_id
  WHERE p.is_active = TRUE
),
metrics AS (
  SELECT
    COUNT(*)::integer AS total_products,
    COUNT(*) FILTER (WHERE stock_quantity <= 0)::integer AS out_of_stock_count,
    COUNT(*) FILTER (WHERE stock_quantity > 0 AND stock_quantity <= min_stock_level)::integer AS low_stock_count,
    COUNT(*) FILTER (WHERE stock_quantity > min_stock_level)::integer AS safe_count,
    COALESCE(SUM(GREATEST(stock_quantity, 0) * COALESCE(cost_price, 0)), 0)::numeric AS total_stock_value,
    COALESCE(SUM(GREATEST(stock_quantity, 0) * COALESCE(sell_price, 0)), 0)::numeric AS total_retail_value
  FROM active_products
),
top_low_stock AS (
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'name', name,
        'sku', sku,
        'stock_quantity', stock_quantity,
        'min_stock_level', min_stock_level,
        'category', NULLIF(category_name, 'Chưa phân loại')
      )
      ORDER BY stock_quantity ASC, name ASC
    ),
    '[]'::jsonb
  ) AS items
  FROM (
    SELECT *
    FROM active_products
    WHERE stock_quantity <= min_stock_level
    ORDER BY stock_quantity ASC, name ASC
    LIMIT 10
  ) low
),
category_breakdown AS (
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', category_id,
        'name', category_name,
        'product_count', product_count,
        'low_stock_count', low_stock_count,
        'total_stock', total_stock
      )
      ORDER BY category_name ASC
    ),
    '[]'::jsonb
  ) AS items
  FROM (
    SELECT
      category_id,
      category_name,
      COUNT(*)::integer AS product_count,
      COUNT(*) FILTER (WHERE stock_quantity <= min_stock_level)::integer AS low_stock_count,
      COALESCE(SUM(GREATEST(stock_quantity, 0)), 0)::integer AS total_stock
    FROM active_products
    GROUP BY category_id, category_name
  ) categories
),
pending_alerts AS (
  SELECT COUNT(*)::integer AS total
  FROM public.stock_alerts
  WHERE status IN ('low_stock', 'out_of_stock')
)
SELECT jsonb_build_object(
  'total_products', metrics.total_products,
  'out_of_stock_count', metrics.out_of_stock_count,
  'low_stock_count', metrics.low_stock_count,
  'safe_count', metrics.safe_count,
  'total_stock_value', metrics.total_stock_value,
  'total_retail_value', metrics.total_retail_value,
  'alerts_pending', pending_alerts.total,
  'top_low_stock', top_low_stock.items,
  'category_breakdown', category_breakdown.items
)
FROM metrics, top_low_stock, category_breakdown, pending_alerts;
$$;

-- The endpoint is called by the service-role backend only. Do not expose
-- inventory levels to anonymous/authenticated browser clients via PostgREST.
REVOKE ALL ON FUNCTION public.get_stock_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_stock_summary() TO service_role;
