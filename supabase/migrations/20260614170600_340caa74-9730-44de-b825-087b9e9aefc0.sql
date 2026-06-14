
-- 1. Storage: explicit admin-only UPDATE policy on 'documents' bucket
DROP POLICY IF EXISTS "Admins can update documents bucket" ON storage.objects;
CREATE POLICY "Admins can update documents bucket"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'documents' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'documents' AND public.has_role(auth.uid(), 'admin'));

-- 2. ticket_status_history: drop overly permissive insert policy, replace with staff-only + self-attribution
DROP POLICY IF EXISTS "Insert history for accessible tickets" ON public.ticket_status_history;
DROP POLICY IF EXISTS "Staff can insert ticket status history" ON public.ticket_status_history;

CREATE POLICY "Staff can insert ticket status history"
ON public.ticket_status_history
FOR INSERT
TO authenticated
WITH CHECK (
  changed_by = auth.uid()
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'sme')
  )
);
