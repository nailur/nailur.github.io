-- =====================================
-- PATCH V21: Void Transactions Feature
-- =====================================

-- 1. Add new columns to transactions table
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed';
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS void_reason TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS voided_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 2. Create RPC for voiding transaction
CREATE OR REPLACE FUNCTION public.void_transaction(
  p_id UUID,
  p_reason TEXT,
  p_voided_by UUID
) RETURNS JSON AS $$
DECLARE
  v_current_status TEXT;
BEGIN
  -- Check current status
  SELECT status INTO v_current_status
  FROM public.transactions
  WHERE id = p_id;

  IF v_current_status = 'voided' THEN
    RAISE EXCEPTION 'Transaction is already voided';
  END IF;

  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'Transaction not found';
  END IF;

  -- Update status and info
  UPDATE public.transactions
  SET 
    status = 'voided',
    void_reason = p_reason,
    voided_by = p_voided_by,
    voided_at = now()
  WHERE id = p_id;

  RETURN json_build_object('success', true, 'message', 'Transaction voided successfully');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
