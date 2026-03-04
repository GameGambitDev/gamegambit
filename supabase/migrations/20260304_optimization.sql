-- Database Indexing & Performance Optimization for 200k+ MAUs
-- Created: 2026-03-04

-- ========== PLAYERS TABLE OPTIMIZATION ==========
-- Primary indexes for most common queries
CREATE INDEX IF NOT EXISTS idx_players_wallet_address ON public.players(wallet_address);
CREATE INDEX IF NOT EXISTS idx_players_username ON public.players(username);
CREATE INDEX IF NOT EXISTS idx_players_is_banned ON public.players(is_banned);
CREATE INDEX IF NOT EXISTS idx_players_created_at ON public.players(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_players_last_active ON public.players(last_active DESC);

-- Composite indexes for common filter combinations
CREATE INDEX IF NOT EXISTS idx_players_stats ON public.players(total_wins DESC, total_losses DESC, total_earnings DESC);
CREATE INDEX IF NOT EXISTS idx_players_active_status ON public.players(is_banned, last_active DESC);

-- ========== WAGERS TABLE OPTIMIZATION ==========
-- Status-based queries (most common)
CREATE INDEX IF NOT EXISTS idx_wagers_status ON public.wagers(status);
CREATE INDEX IF NOT EXISTS idx_wagers_created_at ON public.wagers(created_at DESC);

-- Player-based queries
CREATE INDEX IF NOT EXISTS idx_wagers_player_a ON public.wagers(player_a_wallet);
CREATE INDEX IF NOT EXISTS idx_wagers_player_b ON public.wagers(player_b_wallet);
CREATE INDEX IF NOT EXISTS idx_wagers_players ON public.wagers(player_a_wallet, player_b_wallet);

-- Game type filtering
CREATE INDEX IF NOT EXISTS idx_wagers_game ON public.wagers(game);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_wagers_status_created ON public.wagers(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wagers_player_status ON public.wagers(player_a_wallet, status);

-- Real-time feeds
CREATE INDEX IF NOT EXISTS idx_wagers_public_recent ON public.wagers(is_public, created_at DESC) WHERE is_public = true;

-- Winner wallet lookups (for payouts)
CREATE INDEX IF NOT EXISTS idx_wagers_winner ON public.wagers(winner_wallet) WHERE winner_wallet IS NOT NULL;

-- ========== WAGER_TRANSACTIONS TABLE OPTIMIZATION ==========
CREATE INDEX IF NOT EXISTS idx_wager_transactions_wager_id ON public.wager_transactions(wager_id);
CREATE INDEX IF NOT EXISTS idx_wager_transactions_wallet ON public.wager_transactions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_wager_transactions_status ON public.wager_transactions(status);
CREATE INDEX IF NOT EXISTS idx_wager_transactions_created ON public.wager_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wager_transactions_type_status ON public.wager_transactions(tx_type, status);

-- ========== NFTS TABLE OPTIMIZATION ==========
CREATE INDEX IF NOT EXISTS idx_nfts_owner_wallet ON public.nfts(owner_wallet);
CREATE INDEX IF NOT EXISTS idx_nfts_mint_address ON public.nfts(mint_address);
CREATE INDEX IF NOT EXISTS idx_nfts_wager_id ON public.nfts(wager_id);
CREATE INDEX IF NOT EXISTS idx_nfts_tier ON public.nfts(tier);
CREATE INDEX IF NOT EXISTS idx_nfts_created_at ON public.nfts(created_at DESC);

-- ========== ACHIEVEMENTS TABLE OPTIMIZATION ==========
CREATE INDEX IF NOT EXISTS idx_achievements_player ON public.achievements(player_wallet);
CREATE INDEX IF NOT EXISTS idx_achievements_type ON public.achievements(achievement_type);
CREATE INDEX IF NOT EXISTS idx_achievements_created ON public.achievements(created_at DESC);

-- ========== MATERIALIZED VIEWS FOR ANALYTICS ==========
-- Leaderboard view with denormalized stats
CREATE MATERIALIZED VIEW IF NOT EXISTS leaderboard_view AS
SELECT 
  p.id,
  p.wallet_address,
  p.username,
  p.total_wins,
  p.total_losses,
  p.total_earnings,
  p.total_wagered,
  p.best_streak,
  p.current_streak,
  p.created_at,
  CASE 
    WHEN p.total_wins + p.total_losses = 0 THEN 0
    ELSE ROUND((p.total_wins::numeric / (p.total_wins + p.total_losses) * 100)::numeric, 2)
  END AS win_rate,
  ROW_NUMBER() OVER (ORDER BY p.total_earnings DESC) AS earnings_rank,
  ROW_NUMBER() OVER (ORDER BY p.total_wins DESC) AS wins_rank
FROM public.players p
WHERE p.is_banned = false
ORDER BY p.total_earnings DESC;

CREATE INDEX IF NOT EXISTS idx_leaderboard_view_earnings ON leaderboard_view(earnings_rank);
CREATE INDEX IF NOT EXISTS idx_leaderboard_view_wins ON leaderboard_view(wins_rank);

-- Active wagers view (heavily queried for real-time feed)
CREATE MATERIALIZED VIEW IF NOT EXISTS active_wagers_view AS
SELECT 
  w.id,
  w.game,
  w.stake_lamports,
  w.status,
  w.player_a_wallet,
  w.player_b_wallet,
  w.created_at,
  w.is_public,
  p_a.username AS player_a_username,
  p_b.username AS player_b_username,
  COALESCE(p_a.total_wins, 0) AS player_a_wins,
  COALESCE(p_b.total_wins, 0) AS player_b_wins
FROM public.wagers w
LEFT JOIN public.players p_a ON w.player_a_wallet = p_a.wallet_address
LEFT JOIN public.players p_b ON w.player_b_wallet = p_b.wallet_address
WHERE w.status IN ('created', 'joined', 'voting')
ORDER BY w.created_at DESC;

CREATE INDEX IF NOT EXISTS idx_active_wagers_view_status ON active_wagers_view(status);
CREATE INDEX IF NOT EXISTS idx_active_wagers_view_game ON active_wagers_view(game);

-- Refresh materialized views periodically (RLS policies handle user isolation)
-- Note: Use a scheduled job (e.g., pg_cron) to refresh every 5 minutes in production
-- SELECT cron.schedule('refresh_leaderboard', '5 minutes', 'REFRESH MATERIALIZED VIEW CONCURRENTLY leaderboard_view');
-- SELECT cron.schedule('refresh_active_wagers', '5 minutes', 'REFRESH MATERIALIZED VIEW CONCURRENTLY active_wagers_view');

-- ========== PARTITIONING STRATEGY FOR HISTORICAL DATA ==========
-- For 200k+ MAUs handling high write volumes, consider range partitioning on wagers and transactions
-- Example (uncomment when implementing): 
-- ALTER TABLE public.wagers PARTITION BY RANGE (date_trunc('month', created_at));

-- ========== QUERY OPTIMIZATION SETTINGS ==========
-- These settings help with query planning for large datasets
ALTER TABLE public.players SET (fillfactor = 90);
ALTER TABLE public.wagers SET (fillfactor = 90);
ALTER TABLE public.wager_transactions SET (fillfactor = 85);

-- Analyze tables to update statistics for query planner
ANALYZE public.players;
ANALYZE public.wagers;
ANALYZE public.wager_transactions;
ANALYZE public.nfts;
ANALYZE public.achievements;
