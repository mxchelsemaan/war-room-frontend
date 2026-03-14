CREATE TABLE IF NOT EXISTS public.event_reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL,
  reason text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.event_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert reports"
  ON public.event_reports FOR INSERT
  WITH CHECK (true);
