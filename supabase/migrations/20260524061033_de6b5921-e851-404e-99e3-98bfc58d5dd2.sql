-- 1. Replace overly-permissive ticket_status_history INSERT policy
DROP POLICY IF EXISTS "Authenticated can insert history" ON public.ticket_status_history;

CREATE POLICY "Insert history for accessible tickets"
ON public.ticket_status_history
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = ticket_status_history.ticket_id
      AND (
        t.user_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'sme'::app_role)
      )
  )
);

-- 2. Revoke EXECUTE on SECURITY DEFINER functions from client roles.
-- These are intended to be called by edge functions via the service role only,
-- or are used internally by RLS (which evaluates as table owner regardless).
REVOKE EXECUTE ON FUNCTION public.search_chunks(text, text, integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.match_chunks(vector, text, integer, double precision) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, authenticated;