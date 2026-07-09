-- PATCH: Tambahkan kolom yang terlewat karena IF NOT EXISTS 
-- di tabel attendances dan sales_deposits yang kebetulan sudah pernah dibuat.

-- Tabel attendances
ALTER TABLE public.attendances ADD COLUMN IF NOT EXISTS shift_id UUID REFERENCES public.shifts(id) ON DELETE SET NULL;
ALTER TABLE public.attendances ADD COLUMN IF NOT EXISTS clock_in TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.attendances ADD COLUMN IF NOT EXISTS clock_out TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.attendances ADD COLUMN IF NOT EXISTS notes TEXT;

-- Tabel sales_deposits
ALTER TABLE public.sales_deposits ADD COLUMN IF NOT EXISTS document_number TEXT DEFAULT 'DOC-' || floor(random() * 1000)::text;
ALTER TABLE public.sales_deposits ADD COLUMN IF NOT EXISTS deposit_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.sales_deposits ADD COLUMN IF NOT EXISTS amount NUMERIC DEFAULT 0;
ALTER TABLE public.sales_deposits ADD COLUMN IF NOT EXISTS account_type TEXT DEFAULT 'Lainnya';
ALTER TABLE public.sales_deposits ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.sales_deposits ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Diposting';
ALTER TABLE public.sales_deposits ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
