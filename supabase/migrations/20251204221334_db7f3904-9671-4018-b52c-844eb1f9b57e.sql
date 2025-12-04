-- Create enum for wager status
CREATE TYPE wager_status AS ENUM ('created', 'joined', 'voting', 'retractable', 'disputed', 'resolved');

-- Create enum for game type
CREATE TYPE game_type AS ENUM ('chess', 'codm', 'pubg');

-- Create players table (links wallet to profile data)
CREATE TABLE public.players (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT NOT NULL UNIQUE,
  lichess_username TEXT,
  codm_username TEXT,
  pubg_username TEXT,
  total_wins INTEGER DEFAULT 0,
  total_losses INTEGER DEFAULT 0,
  total_earnings BIGINT DEFAULT 0,
  total_wagered BIGINT DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  best_streak INTEGER DEFAULT 0,
  is_banned BOOLEAN DEFAULT false,
  ban_expires_at TIMESTAMP WITH TIME ZONE,
  last_active TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create wagers table
CREATE TABLE public.wagers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id BIGINT NOT NULL,
  player_a_wallet TEXT NOT NULL,
  player_b_wallet TEXT,
  game game_type NOT NULL,
  stake_lamports BIGINT NOT NULL,
  lichess_game_id TEXT,
  status wager_status NOT NULL DEFAULT 'created',
  requires_moderator BOOLEAN DEFAULT false,
  vote_player_a TEXT,
  vote_player_b TEXT,
  winner_wallet TEXT,
  is_public BOOLEAN DEFAULT true,
  stream_url TEXT,
  vote_timestamp TIMESTAMP WITH TIME ZONE,
  retract_deadline TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_wagers_status ON public.wagers(status);
CREATE INDEX idx_wagers_player_a ON public.wagers(player_a_wallet);
CREATE INDEX idx_wagers_player_b ON public.wagers(player_b_wallet);
CREATE INDEX idx_wagers_created_at ON public.wagers(created_at DESC);
CREATE INDEX idx_players_wallet ON public.players(wallet_address);
CREATE INDEX idx_players_earnings ON public.players(total_earnings DESC);

-- Enable Row Level Security
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wagers ENABLE ROW LEVEL SECURITY;

-- Players policies (public read, write own data)
CREATE POLICY "Players are viewable by everyone" 
ON public.players FOR SELECT USING (true);

CREATE POLICY "Players can insert their own profile" 
ON public.players FOR INSERT WITH CHECK (true);

CREATE POLICY "Players can update their own profile" 
ON public.players FOR UPDATE USING (true);

-- Wagers policies (public read for public wagers, participants can modify)
CREATE POLICY "Public wagers are viewable by everyone" 
ON public.wagers FOR SELECT USING (is_public = true);

CREATE POLICY "Anyone can create a wager" 
ON public.wagers FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update wagers" 
ON public.wagers FOR UPDATE USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_players_updated_at
BEFORE UPDATE ON public.players
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_wagers_updated_at
BEFORE UPDATE ON public.wagers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();