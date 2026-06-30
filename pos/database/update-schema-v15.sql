-- =====================================
-- PATCH V15: Add status to profiles for user activation/deactivation
-- =====================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
