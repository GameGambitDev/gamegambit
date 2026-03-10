# Game Gambit Database Schema

**Last Updated:** March 2026  
**Database:** PostgreSQL (Supabase)  
**Environment:** Production

---

## Overview

Game Gambit uses a relational PostgreSQL database to manage players, wagers, transactions, NFTs, and achievements. The schema supports real-time gaming competitions with secure blockchain integration on Solana.

---

## Table of Contents

1. [Core Tables](#core-tables)
2. [Relationships Diagram](#relationships-diagram)
3. [Detailed Table Specifications](#detailed-table-specifications)
4. [Custom Types (Enums)](#custom-types-enums)
5. [Indexes & Performance](#indexes--performance)
6. [Data Consistency Rules](#data-consistency-rules)
7. [Migration Guide](#migration-guide)

---

## Core Tables

| Table Name | Purpose | Records |
|-----------|---------|---------|
| `players` | User accounts with stats | Primary user data |
| `wagers` | Gaming matches & bets | Core business data |
| `wager_transactions` | Blockchain transactions | Solana txs |
| `nfts` | Victory NFTs | Collectibles |
| `achievements` | User badges | Milestones |
| `rate_limit_logs` | API rate limiting | Operational |

---

## Relationships Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                          PLAYERS                                 │
│  (Central entity - all other tables reference this)              │
├─────────────────────────────────────────────────────────────────┤
│ PK: id (bigint)                                                  │
│ UNIQUE: wallet_address (text)                                    │
│ Stats: total_wins, total_losses, total_earnings, skill_rating    │
│ Accounts: lichess_username, codm_username, pubg_username         │
└─────────────────────────────────────────────────────────────────┘
    ↑                          ↑                          ↑
    │ (wallet_address FK)      │ (wallet_address FK)     │
    │                          │                         │
┌───┴───────────┐   ┌──────────┴──────────┐   ┌────────┴─────────┐
│    WAGERS     │   │ WAGER_TRANSACTIONS  │   │  ACHIEVEMENTS    │
├───────────────┤   ├─────────────────────┤   ├──────────────────┤
│ PK: id (uuid) │   │ PK: id (uuid)       │   │ PK: id (uuid)    │
│ Match data    │   │ Blockchain data     │   │ Badges/milestones│
│ player_a_wallet│   │ Status tracking     │   │ NFT refs         │
│ player_b_wallet│   │ Tx signatures       │   └──────────────────┘
│ winner_wallet │   │ Amount tracking     │
│ Game type     │   │ Error handling      │
│ Stake amount  │   └─────────────────────┘
│ Status        │
│ Voting data   │
└───┬───────────┘
    │ (wager_id FK)
    │
┌───┴────────────┐
│      NFTs      │
├────────────────┤
│ PK: id (uuid)  │
│ Mint address   │
│ Owner wallet   │
│ Tier/rarity    │
│ Metadata       │
└────────────────┘
```

---

## Detailed Table Specifications

### 1. **PLAYERS**

Core user account table. Every player has a wallet address as their primary identifier.

```sql
CREATE TABLE players (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  wallet_address TEXT NOT NULL UNIQUE,
  username TEXT UNIQUE,
  bio TEXT,
  avatar_url TEXT,
  
  -- Account Status
  is_banned BOOLEAN DEFAULT false,
  ban_reason TEXT,
  verified BOOLEAN DEFAULT false,
  
  -- Performance Stats
  total_wins INTEGER DEFAULT 0,
  total_losses INTEGER DEFAULT 0,
  win_rate NUMERIC DEFAULT 0.0,
  total_earnings BIGINT DEFAULT 0,  -- in lamports
  total_spent BIGINT DEFAULT 0,     -- in lamports
  current_streak INTEGER DEFAULT 0,
  best_streak INTEGER DEFAULT 0,
  skill_rating INTEGER DEFAULT 1000,
  preferred_game TEXT,
  
  -- Game Account Links
  lichess_username TEXT,            -- For chess
  codm_username TEXT,               -- For Call of Duty Mobile
  pubg_username TEXT,               -- For PUBG
  
  -- Timestamps
  last_active TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_players_wallet ON players(wallet_address);
CREATE INDEX idx_players_username ON players(username);
CREATE INDEX idx_players_created ON players(created_at DESC);
```

**Key Fields:**
- `wallet_address`: Solana public key, immutable
- `skill_rating`: ELO-style rating (starts at 1000)
- `total_earnings/spent`: Tracked in lamports (1 SOL = 1,000,000,000 lamports)

---

### 2. **WAGERS**

Represents individual gaming matches with betting logic.

```sql
CREATE TABLE wagers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id BIGINT UNIQUE GENERATED ALWAYS AS IDENTITY,
  
  -- Players
  player_a_wallet TEXT NOT NULL REFERENCES players(wallet_address),
  player_b_wallet TEXT REFERENCES players(wallet_address),
  
  -- Game Details
  game game_type NOT NULL,           -- chess, codm, pubg
  stake_lamports BIGINT NOT NULL,    -- Per player stake
  lichess_game_id TEXT,              -- Link to Lichess for chess
  
  -- Match Status
  status wager_status DEFAULT 'created'::wager_status,
  
  -- Ready Room (10-second countdown)
  ready_player_a BOOLEAN DEFAULT false,
  ready_player_b BOOLEAN DEFAULT false,
  countdown_started_at TIMESTAMP WITH TIME ZONE,
  
  -- Voting/Dispute Resolution
  requires_moderator BOOLEAN DEFAULT false,
  vote_player_a TEXT REFERENCES players(wallet_address),
  vote_player_b TEXT REFERENCES players(wallet_address),
  vote_timestamp TIMESTAMP WITH TIME ZONE,
  retract_deadline TIMESTAMP WITH TIME ZONE,
  
  -- Results
  winner_wallet TEXT REFERENCES players(wallet_address),
  resolved_at TIMESTAMP WITH TIME ZONE,
  
  -- Cancellation (for refunds)
  cancelled_at TIMESTAMP WITH TIME ZONE,
  cancelled_by TEXT REFERENCES players(wallet_address),
  cancel_reason TEXT,   -- 'user_cancelled', 'transaction_failed', etc.
  
  -- Public Access
  is_public BOOLEAN DEFAULT true,
  stream_url TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_wagers_status ON wagers(status);
CREATE INDEX idx_wagers_players ON wagers(player_a_wallet, player_b_wallet);
CREATE INDEX idx_wagers_created ON wagers(created_at DESC);
CREATE INDEX idx_wagers_resolved ON wagers(status) WHERE status = 'resolved';
```

**Status Flow:**
1. `created` → Waiting for player B to join
2. `joined` → Both players present, enter ready room
3. `voting` → Match in progress (after countdown and deposits)
4. `disputed` → Moderator review needed
5. `resolved` → Winner determined, payouts processed
6. `cancelled` → Wager cancelled, refunds processed (can occur from joined/voting)

---

### 3. **WAGER_TRANSACTIONS**

Immutable ledger of all Solana blockchain transactions.

```sql
CREATE TABLE wager_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- References
  wager_id UUID NOT NULL REFERENCES wagers(id),
  wallet_address TEXT NOT NULL REFERENCES players(wallet_address),
  
  -- Transaction Details
  tx_type transaction_type NOT NULL,  -- deposit, withdraw, payout
  amount_lamports BIGINT NOT NULL,
  tx_signature TEXT UNIQUE,            -- Solana tx hash
  
  -- Status Tracking
  status transaction_status DEFAULT 'pending'::transaction_status,
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tx_wager ON wager_transactions(wager_id);
CREATE INDEX idx_tx_wallet ON wager_transactions(wallet_address);
CREATE INDEX idx_tx_status ON wager_transactions(status);
CREATE INDEX idx_tx_signature ON wager_transactions(tx_signature);
```

**Status Values:**
- `pending`: Awaiting blockchain confirmation
- `confirmed`: On-chain, irreversible
- `failed`: Transaction failed, needs retry

---

### 4. **NFTs**

Victory/achievement NFTs minted to Solana blockchain.

```sql
CREATE TABLE nfts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Blockchain Data
  mint_address TEXT NOT NULL UNIQUE,  -- Solana NFT mint address
  owner_wallet TEXT NOT NULL REFERENCES players(wallet_address),
  
  -- NFT Details
  name TEXT NOT NULL,
  tier nft_tier NOT NULL,             -- bronze, silver, gold, platinum
  metadata_uri TEXT,                  -- Arweave/IPFS link
  image_uri TEXT,
  attributes JSONB DEFAULT '{}'::jsonb,
  
  -- Associated Data
  wager_id UUID REFERENCES wagers(id),
  match_id BIGINT,
  stake_amount BIGINT,
  lichess_game_id TEXT,
  
  -- Timestamps
  minted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_nft_owner ON nfts(owner_wallet);
CREATE INDEX idx_nft_wager ON nfts(wager_id);
CREATE INDEX idx_nft_mint ON nfts(mint_address);
```

**Tier System:**
- `bronze`: Basic victory NFT
- `silver`: 5+ consecutive wins
- `gold`: 10+ consecutive wins
- `platinum`: 20+ consecutive wins

---

### 5. **ACHIEVEMENTS**

User badges and milestones.

```sql
CREATE TABLE achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Reference
  player_wallet TEXT NOT NULL REFERENCES players(wallet_address),
  
  -- Achievement Data
  achievement_type TEXT NOT NULL,     -- "first_win", "streak_5", etc
  achievement_value INTEGER,          -- Optional value (streak length, etc)
  
  -- Optional NFT
  nft_mint_address TEXT REFERENCES nfts(mint_address),
  
  -- Timestamps
  unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_achievement_player ON achievements(player_wallet);
CREATE INDEX idx_achievement_type ON achievements(achievement_type);
```

---

### 6. **RATE_LIMIT_LOGS**

API rate limiting tracking.

```sql
CREATE TABLE rate_limit_logs (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  
  wallet_address TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  
  request_count INTEGER DEFAULT 1,
  window_reset_at TIMESTAMP WITH TIME ZONE NOT NULL,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ratelimit_wallet ON rate_limit_logs(wallet_address, endpoint);
```

---

## Custom Types (Enums)

```sql
-- Game Types
CREATE TYPE game_type AS ENUM ('chess', 'codm', 'pubg');

-- Wager Status
CREATE TYPE wager_status AS ENUM (
  'created',      -- Waiting for opponent
  'joined',       -- Both players ready
  'voting',       -- In progress / voting phase
  'disputed',     -- Moderator review
  'resolved',     -- Completed with winner
  'cancelled'     -- Cancelled with refunds
);

-- Transaction Types
CREATE TYPE transaction_type AS ENUM (
  'deposit',        -- Initial stake deposit
  'withdraw',       -- Withdrawal request
  'payout',         -- Winner payout
  'refund',         -- Refund on draw
  'cancel_refund',  -- Refund on cancellation
  'cancelled',      -- Wager cancelled log
  'error_on_chain_resolve',     -- On-chain resolution failed
  'error_on_chain_draw_refund', -- On-chain draw refund failed
  'error_on_chain_cancel_refund', -- On-chain cancel refund failed
  'error_resolution_call'       -- Resolution API call failed
);

-- Transaction Status
CREATE TYPE transaction_status AS ENUM ('pending', 'confirmed', 'failed');

-- NFT Tier
CREATE TYPE nft_tier AS ENUM ('bronze', 'silver', 'gold', 'platinum');
```

---

## Indexes & Performance

### Query Performance Optimization

| Index | Purpose | Expected Queries |
|-------|---------|------------------|
| `idx_players_wallet` | Fast wallet lookups | `SELECT * FROM players WHERE wallet_address = ?` |
| `idx_wagers_status` | Filter by wager status | `SELECT * FROM wagers WHERE status = 'created'` |
| `idx_wagers_players` | Player's wagers | `SELECT * FROM wagers WHERE player_a_wallet = ?` |
| `idx_tx_wager` | Transaction history | `SELECT * FROM wager_transactions WHERE wager_id = ?` |
| `idx_nft_owner` | User's NFTs | `SELECT * FROM nfts WHERE owner_wallet = ?` |

### Slow Query Alerts

Monitor queries taking > 100ms:
- Leaderboard calculations (requires `total_wins`, `skill_rating` sorts)
- Historical wager lookups for specific players
- NFT collection queries with large result sets

---

## Data Consistency Rules

### Business Logic Constraints

1. **Stake Amounts**: Must be > 0 and <= player's account balance
2. **Winning Players**: Must be either `player_a_wallet` or `player_b_wallet`
3. **Transaction Finality**: Once `status = 'confirmed'`, cannot be modified
4. **Wager Flow**: Cannot skip status (e.g., `created` → `voting` requires `joined` first)
5. **Player Uniqueness**: One player cannot be both player_a and player_b in same wager

### Database Constraints

```sql
-- Prevent self-wagers
ALTER TABLE wagers ADD CONSTRAINT check_different_players 
  CHECK (player_a_wallet != player_b_wallet);

-- Prevent negative amounts
ALTER TABLE wagers ADD CONSTRAINT check_positive_stake 
  CHECK (stake_lamports > 0);

-- Prevent invalid winners
ALTER TABLE wagers ADD CONSTRAINT check_valid_winner 
  CHECK (winner_wallet IS NULL 
         OR winner_wallet IN (player_a_wallet, player_b_wallet));
```

---

## Migration Guide

### Adding New Fields

1. Create migration file: `migrations/[timestamp]_add_field.sql`
2. Test on staging database first
3. Deploy with zero-downtime: Add column as nullable, update defaults, then add constraints
4. Update TypeScript types in `src/integrations/supabase/types.ts`

### Example Migration:

```sql
-- Add field as nullable
ALTER TABLE players ADD COLUMN discord_id TEXT;

-- Backfill data if needed
UPDATE players SET discord_id = NULL;

-- Add unique constraint if needed
ALTER TABLE players ADD CONSTRAINT unique_discord_id UNIQUE (discord_id);

-- Add index
CREATE INDEX idx_players_discord ON players(discord_id);
```

### Rollback Procedure:

```sql
-- Drop in reverse order
DROP INDEX IF EXISTS idx_players_discord;
ALTER TABLE players DROP COLUMN IF EXISTS discord_id;
```

---

## Useful Queries

### Player Stats

```sql
-- Get player stats
SELECT 
  wallet_address,
  username,
  total_wins,
  total_losses,
  ROUND((total_wins::numeric / NULLIF(total_wins + total_losses, 0) * 100), 2) as win_rate,
  total_earnings / 1000000000.0 as earnings_sol,
  skill_rating
FROM players
ORDER BY total_wins DESC, skill_rating DESC;
```

### Wager History

```sql
-- Get completed wagers for a player
SELECT 
  id,
  match_id,
  game,
  stake_lamports / 1000000000.0 as stake_sol,
  CASE WHEN winner_wallet = ? THEN 'WON' ELSE 'LOST' END as result,
  resolved_at
FROM wagers
WHERE (player_a_wallet = ? OR player_b_wallet = ?)
  AND status = 'resolved'
ORDER BY resolved_at DESC
LIMIT 20;
```

### Transaction Ledger

```sql
-- Get all transactions for a wager
SELECT 
  id,
  tx_type,
  amount_lamports / 1000000000.0 as amount_sol,
  status,
  tx_signature,
  created_at
FROM wager_transactions
WHERE wager_id = ?
ORDER BY created_at;
```

---

## Backup & Recovery

### Daily Backups

Supabase automatically backs up data. To restore:

1. Go to **Supabase Dashboard** → **Backups**
2. Select desired backup point
3. Click **Restore** (creates new database instance)
4. Update connection string in `.env`

### Manual Export

```bash
# Export entire database
pg_dump postgresql://[user]:[password]@[host]:[port]/[database] > backup.sql

# Restore
psql postgresql://[user]:[password]@[host]:[port]/[database] < backup.sql
```

---

## Related Documentation

- **API Documentation**: See `API_REFERENCE.md`
- **Type Definitions**: See `src/integrations/supabase/types.ts`
- **Hooks**: See `src/hooks/useWagers.ts`, `src/hooks/usePlayer.ts`

---

**Version Control**  
This schema is version controlled in GitHub. Update this document whenever database changes are made.

Last reviewed: March 2026
