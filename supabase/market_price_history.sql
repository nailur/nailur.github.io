-- ==========================================
-- NTGold Market Price History Table & Logic
-- ==========================================

-- 1. Create the table to store historical market prices
CREATE TABLE IF NOT EXISTS public.market_price_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    brand_name TEXT NOT NULL,
    weight_grams NUMERIC NOT NULL,
    price NUMERIC NOT NULL,
    recorded_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Ensure we only have one record per brand, per weight, per day
    UNIQUE(brand_name, weight_grams, recorded_date)
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.market_price_history ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
-- Allow anyone to read the price history
CREATE POLICY "Allow read access to all users" 
ON public.market_price_history FOR SELECT 
TO public 
USING (true);

-- Allow authenticated users to insert (if doing client-side cron/update)
CREATE POLICY "Allow insert access to authenticated users" 
ON public.market_price_history FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- ==========================================
-- OPTION A: SUPABASE EDGE FUNCTION (Recommended)
-- ==========================================
-- If you want to automatically fetch from your API daily without relying on user visits, 
-- you should create a Supabase Edge Function that runs a fetch() to your Cloudflare Worker
-- and inserts into this table. Then trigger it using pg_cron:
-- 
-- select cron.schedule(
--   'invoke-market-sync',
--   '0 1 * * *', -- Run at 1 AM every day
--   $$
--     select net.http_post(
--         url:='https://YOUR_PROJECT_REF.supabase.co/functions/v1/sync-prices',
--         headers:='{"Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
--     ) as request_id;
--   $$
-- );

-- ==========================================
-- OPTION B: CLIENT-SIDE AUTO UPDATE
-- ==========================================
-- If you don't want to use Edge Functions, you can add this logic to your `main.js`:
-- 
-- async function syncDailyPricesToDB(items) {
--    const today = new Date().toISOString().split('T')[0];
--    
--    // Check if we already have records for today
--    const { data } = await sbClient.from('market_price_history').select('id').eq('recorded_date', today).limit(1);
--    if (data && data.length > 0) return; // Already synced today
--
--    // Insert today's items
--    const inserts = items.map(item => ({
--        brand_name: item.tblbrand.brand_name,
--        weight_grams: item.weight_grams,
--        price: item.price,
--        recorded_date: today
--    }));
--    
--    await sbClient.from('market_price_history').upsert(inserts, { onConflict: 'brand_name, weight_grams, recorded_date' });
-- }
