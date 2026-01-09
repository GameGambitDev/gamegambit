-- Create nfts table for victory trophies
CREATE TABLE public.nfts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mint_address TEXT UNIQUE NOT NULL,
  owner_wallet TEXT NOT NULL,
  wager_id UUID REFERENCES public.wagers(id) ON DELETE SET NULL,
  tier TEXT NOT NULL CHECK (tier IN ('bronze', 'silver', 'gold', 'diamond')),
  name TEXT NOT NULL,
  metadata_uri TEXT NOT NULL,
  image_uri TEXT NOT NULL,
  match_id BIGINT,
  stake_amount BIGINT,
  lichess_game_id TEXT,
  minted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  attributes JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create achievements table
CREATE TABLE public.achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_wallet TEXT NOT NULL,
  achievement_type TEXT NOT NULL,
  achievement_value INTEGER,
  unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  nft_mint_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(player_wallet, achievement_type)
);

-- Create indexes for better query performance
CREATE INDEX idx_nfts_owner ON public.nfts(owner_wallet);
CREATE INDEX idx_nfts_tier ON public.nfts(tier);
CREATE INDEX idx_nfts_mint ON public.nfts(mint_address);
CREATE INDEX idx_nfts_wager ON public.nfts(wager_id);
CREATE INDEX idx_achievements_player ON public.achievements(player_wallet);
CREATE INDEX idx_achievements_type ON public.achievements(achievement_type);

-- Enable RLS
ALTER TABLE public.nfts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

-- RLS Policies for nfts - public read, service role write
CREATE POLICY "NFTs are viewable by everyone"
ON public.nfts FOR SELECT
USING (true);

CREATE POLICY "Service role can insert NFTs"
ON public.nfts FOR INSERT
WITH CHECK (true);

-- RLS Policies for achievements - public read, service role write
CREATE POLICY "Achievements are viewable by everyone"
ON public.achievements FOR SELECT
USING (true);

CREATE POLICY "Service role can insert achievements"
ON public.achievements FOR INSERT
WITH CHECK (true);

CREATE POLICY "Service role can update achievements"
ON public.achievements FOR UPDATE
USING (true);