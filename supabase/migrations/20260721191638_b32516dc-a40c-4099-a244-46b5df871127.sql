
ALTER TYPE public.expense_category ADD VALUE IF NOT EXISTS 'wages';
ALTER TYPE public.expense_category ADD VALUE IF NOT EXISTS 'market_fee';
ALTER TYPE public.expense_category ADD VALUE IF NOT EXISTS 'misc';

CREATE TABLE public.ai_interactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'chat',
  query TEXT NOT NULL,
  response TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.ai_interactions TO authenticated;
GRANT ALL ON public.ai_interactions TO service_role;

ALTER TABLE public.ai_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own ai interactions read" ON public.ai_interactions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "own ai interactions insert" ON public.ai_interactions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE INDEX ai_interactions_user_created_idx ON public.ai_interactions (user_id, created_at DESC);
