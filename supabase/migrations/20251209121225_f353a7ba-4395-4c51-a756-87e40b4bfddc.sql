-- Add username column to players table
ALTER TABLE public.players ADD COLUMN username text UNIQUE;

-- Create index for username lookups
CREATE INDEX idx_players_username ON public.players (username);

-- Add constraint to ensure username follows valid format when set
ALTER TABLE public.players ADD CONSTRAINT username_format_check 
  CHECK (username IS NULL OR (length(username) >= 3 AND length(username) <= 20 AND username ~ '^[a-zA-Z0-9_]+$'));