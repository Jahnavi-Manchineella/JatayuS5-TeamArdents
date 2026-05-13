
-- 1. Tighten + broaden ticket_qa admin_review to admin OR sme
DROP POLICY IF EXISTS "Admin posts QA review" ON public.ticket_qa;
CREATE POLICY "Admin or SME posts QA review"
ON public.ticket_qa
FOR INSERT
TO authenticated
WITH CHECK (
  qa_type = 'admin_review'
  AND reviewer_id = auth.uid()
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'sme'::app_role))
  AND EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = ticket_qa.ticket_id
      AND t.status = ANY (ARRAY['resolved'::ticket_status, 'closed'::ticket_status])
  )
);

-- 2. Audit log feedback columns + UPDATE policy
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS feedback text CHECK (feedback IN ('up','down')),
  ADD COLUMN IF NOT EXISTS feedback_comment text,
  ADD COLUMN IF NOT EXISTS response text;
-- (response column already exists per schema; ADD IF NOT EXISTS is safe)

CREATE POLICY "Users update own audit feedback"
ON public.audit_logs
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 3. Answer templates table
CREATE TABLE IF NOT EXISTS public.answer_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intent text NOT NULL UNIQUE,
  pattern text NOT NULL,
  template text NOT NULL,
  category text NOT NULL DEFAULT 'General Operations',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.answer_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read templates"
ON public.answer_templates FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins insert templates"
ON public.answer_templates FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update templates"
ON public.answer_templates FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete templates"
ON public.answer_templates FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_answer_templates_updated_at
BEFORE UPDATE ON public.answer_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
