
DROP POLICY IF EXISTS "Anyone can create tickets" ON public.tickets;
CREATE POLICY "Anyone can create tickets"
ON public.tickets
FOR INSERT
TO anon, authenticated
WITH CHECK (
  (auth.uid() IS NULL AND user_id IS NULL AND user_email IS NOT NULL)
  OR
  (auth.uid() IS NOT NULL AND (user_id IS NULL OR user_id = auth.uid()))
);

DROP POLICY IF EXISTS "Requesters can reopen own tickets" ON public.tickets;
CREATE POLICY "Requesters can reopen own tickets"
ON public.tickets
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
  AND status IN ('resolved'::ticket_status, 'closed'::ticket_status)
)
WITH CHECK (
  auth.uid() = user_id
  AND status = 'reopened'::ticket_status
);
