-- Ensure existing databases can save the vendor stall location from the profile page.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stall_location text;
