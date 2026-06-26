-- =====================================
-- PATCH V5: Fix timezone default values
-- =====================================

-- Change DEFAULT for created_at to now() instead of timezone('utc', now())
-- This prevents double-conversion bugs when the server timezone is not UTC.

ALTER TABLE public.profiles ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.branches ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.outlets ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.products ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.transactions ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.transaction_items ALTER COLUMN created_at SET DEFAULT now();
