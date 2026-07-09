-- Migration script to allow storing AES Encrypted strings in tblinventory
-- Run this in your Supabase SQL Editor

ALTER TABLE public.tblinventory 
  ALTER COLUMN weight_grams TYPE text USING weight_grams::text,
  ALTER COLUMN purchase_price TYPE text USING purchase_price::text,
  ALTER COLUMN purchase_date TYPE text USING purchase_date::text;

-- Note: Existing numeric data will be cast to text.
-- The app will gracefully handle old unencrypted text data and new encrypted AES strings.
