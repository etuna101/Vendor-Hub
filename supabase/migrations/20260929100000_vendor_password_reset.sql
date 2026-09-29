CREATE TABLE IF NOT EXISTS public.password_reset_challenges (
  phone text PRIMARY KEY,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts smallint NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  sent_count smallint NOT NULL DEFAULT 1,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  last_sent_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.password_reset_challenges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.password_reset_challenges FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.password_reset_challenges TO service_role;

CREATE OR REPLACE FUNCTION public.find_vendor_for_password_reset(_phone text)
RETURNS TABLE(user_id uuid, preferred_language text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.preferred_language
  FROM public.profiles AS p
  WHERE public.normalize_kenyan_phone(p.phone) = _phone
    AND 1 = (
      SELECT count(*)
      FROM public.profiles AS matching
      WHERE public.normalize_kenyan_phone(matching.phone) = _phone
    )
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.issue_password_reset_challenge(
  _phone text,
  _code_hash text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _accepted boolean;
BEGIN
  INSERT INTO public.password_reset_challenges (
    phone, code_hash, expires_at, attempts, sent_count, window_started_at, last_sent_at
  ) VALUES (
    _phone, _code_hash, now() + interval '10 minutes', 0, 1, now(), now()
  )
  ON CONFLICT (phone) DO UPDATE SET
    code_hash = EXCLUDED.code_hash,
    expires_at = EXCLUDED.expires_at,
    attempts = 0,
    sent_count = CASE
      WHEN password_reset_challenges.window_started_at <= now() - interval '1 hour' THEN 1
      ELSE password_reset_challenges.sent_count + 1
    END,
    window_started_at = CASE
      WHEN password_reset_challenges.window_started_at <= now() - interval '1 hour' THEN now()
      ELSE password_reset_challenges.window_started_at
    END,
    last_sent_at = now()
  WHERE password_reset_challenges.last_sent_at <= now() - interval '1 minute'
    AND (
      password_reset_challenges.window_started_at <= now() - interval '1 hour'
      OR password_reset_challenges.sent_count < 3
    )
  RETURNING true INTO _accepted;

  RETURN COALESCE(_accepted, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_password_reset_challenge(
  _phone text,
  _code_hash text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _challenge public.password_reset_challenges%ROWTYPE;
BEGIN
  SELECT * INTO _challenge
  FROM public.password_reset_challenges
  WHERE phone = _phone
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF _challenge.expires_at <= now() OR _challenge.attempts >= 5 THEN
    DELETE FROM public.password_reset_challenges WHERE phone = _phone;
    RETURN false;
  END IF;

  IF _challenge.code_hash <> _code_hash THEN
    UPDATE public.password_reset_challenges
    SET attempts = attempts + 1
    WHERE phone = _phone;
    RETURN false;
  END IF;

  DELETE FROM public.password_reset_challenges WHERE phone = _phone;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.find_vendor_for_password_reset(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.issue_password_reset_challenge(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consume_password_reset_challenge(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_vendor_for_password_reset(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.issue_password_reset_challenge(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_password_reset_challenge(text, text) TO service_role;