-- =====================================
-- PATCH V23: Allow UPDATE on transactions for Outlet
-- =====================================
-- This allows the cashier to update the transaction to attach notes immediately after checkout.

DROP POLICY IF EXISTS "Outlet update outlet transactions" ON public.transactions;

CREATE POLICY "Outlet update outlet transactions" ON public.transactions
FOR UPDATE TO authenticated
USING ( outlet_id = (SELECT outlet_id FROM public.profiles WHERE id = auth.uid()) );
