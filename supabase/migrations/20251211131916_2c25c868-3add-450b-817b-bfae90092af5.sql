-- Add ready state columns to wagers table
ALTER TABLE public.wagers
ADD COLUMN ready_player_a boolean DEFAULT false,
ADD COLUMN ready_player_b boolean DEFAULT false,
ADD COLUMN countdown_started_at timestamp with time zone DEFAULT NULL;