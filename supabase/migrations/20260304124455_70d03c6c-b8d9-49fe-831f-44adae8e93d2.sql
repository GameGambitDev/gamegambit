
-- Safely add wagers to realtime publication (ignore if already exists)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.wagers;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
