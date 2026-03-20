# GameGambit — Database Schema

**Last Updated:** March 20, 2026  
**Database:** PostgreSQL (Supabase)  
**Environment:** Production

---

## Overview

GameGambit uses a comprehensive relational PostgreSQL database to manage players, wagers, transactions, NFTs, achievements, and admin operations. The schema is designed for trustless P2P gaming escrow with complete audit trails and dispute resolution.

---

## Table of Contents

1. [Custom Enum Types](#custom-enum-types)
2. [Core Tables](#core-tables)
3. [Admin Tables](#admin-tables)
4. [Supporting Tables](#supporting-tables)
5. [Relationships Diagram](#relationships-diagram)
6. [Key Design Decisions](#key-design-decisions)
7. [Indexes & Performance](#indexes--performance)
8. [Data Consistency Rules](#data-consistency-rules)
9. [Useful Queries](#useful-queries)
10. [Backup & Recovery](#backup--recovery)

---

## Custom Enum Types

### Wager Status (WagerStatus)
Mirrors the Rust program's `WagerStatus` enum for consistency:
- `'created'` — Player A deposited, waiting for Player B
- `'joined'` — Both players joined, ready room active
- `'voting'` — Game in progress, awaiting result votes
- `'retractable'` — Both votes agree, 15-second retract window
- `'disputed'` — Votes disagree, moderator required
- `'resolved'` — Winner paid out, wager closed
- `'cancelled'` — Cancelled by participant, refund triggered

### Transaction Types
Financial event tracking across on-chain and off-chain operations:
- `'escrow_deposit'` — Initial stake deposited to WagerAccount PDA
- `'escrow_release'` — Funds released from PDA to winner
- `'winner_payout'` — Winner payout distributed
- `'draw_refund'` — Full refund on draw
- `'cancel_refund'` — Refund on wager cancellation
- `'cancelled'` — Wager cancelled log entry
- `'platform_fee'` — Platform fee collected
- `'moderator_fee'` — Moderator fee on dispute resolution
- `'error_on_chain_resolve'` — Resolution transaction failed on-chain
- `'error_resolution_call'` — API resolution call failed

### Transaction Status
Blockchain confirmation states:
- `'pending'` — Awaiting blockchain confirmation
- `'confirmed'` — On-chain, irreversible
- `'failed'` — Transaction failed, needs retry

### Game Types
Supported games:
- `'chess'` — Chess (auto-resolved via Lichess)
- `'codm'` — Call of Duty Mobile
- `'pubg'` — PUBG

### Admin Roles
Role-based access control:
- `'moderator'` — Resolve disputes
- `'admin'` — Full admin access
- `'superadmin'` — System administration

---

## Core Tables

| Table Name | Purpose | Key Fields |
|-----------|---------|---------|
| `players` | User accounts with stats | wallet_address (UNIQUE), username, skill_rating, total_wins/losses |
| `wagers` | Gaming matches with state | match_id (UNIQUE), player_a/b_wallet, status, stake_lamports |
| `wager_transactions` | Blockchain transaction ledger | wager_id, tx_type, tx_signature (UNIQUE), status |

---

## Admin Tables

| Table Name | Purpose | Key Fields |
|-----------|---------|---------|
| `admin_users` | Admin portal accounts | email (UNIQUE), role, password_hash |
| `admin_sessions` | JWT session tracking | admin_id, token_hash (UNIQUE), expires_at |
| `admin_wallet_bindings` | Solana wallet verification | admin_id, wallet_address, verification_signature |
| `admin_audit_logs` | Complete action audit trail | admin_id, action_type, resource_type, old_values, new_values |
| `admin_logs` | Wager-specific admin actions | action, wager_id, performed_by |
| `admin_notes` | Admin annotations | player_wallet, wager_id, note_content |

---

## Supporting Tables

| Table Name | Purpose | Key Fields |
|-----------|---------|---------|
| `nfts` | Victory NFTs on Solana | mint_address (UNIQUE), owner_wallet, tier, wager_id |
| `achievements` | Player achievement badges | player_wallet, achievement_type, unlocked_at |

---

## Relationships Diagram

```
players (1) ──────────────────────────────────────────────── (N) wagers [player_a_wallet]
players (1) ──────────────────────────────────────────────── (N) wagers [player_b_wallet]
players (1) ──────────────────────────────────────────────── (N) wagers [winner_wallet]
players (1) ──────────────────────────────────────────────── (N) wagers [cancelled_by]
players (1) ──────────────────────────────────────────────── (N) wager_transactions
players (1) ──────────────────────────────────────────────── (N) nfts
players (1) ──────────────────────────────────────────────── (N) achievements
players (1) ──────────────────────────────────────────────── (N) admin_notes

wagers  (1) ──────────────────────────────────────────────── (N) wager_transactions
wagers  (1) ──────────────────────────────────────────────── (N) nfts
wagers  (1) ──────────────────────────────────────────────── (N) admin_logs
wagers  (1) ──────────────────────────────────────────────── (N) admin_notes

admin_users (1) ──────────────────────────────────────────── (N) admin_sessions
admin_users (1) ──────────────────────────────────────────── (N) admin_wallet_bindings
admin_users (1) ──────────────────────────────────────────── (N) admin_audit_logs

nfts    (1) ──────────────────────────────────────────────── (N) achievements [nft_mint_address]
```

---

## Key Design Decisions

### match_id as PDA Seed
The `wagers.match_id` is an auto-incrementing bigint used directly as the seed for the on-chain WagerAccount PDA alongside player_a_wallet. This creates a deterministic, unique PDA without a separate registry.

### Dual Deposit Tracking
`deposit_player_a` and `deposit_player_b` booleans track on-chain deposit confirmation separately from wager status. The game starts (status → voting) only when both are true, preventing races where one player appears ready before funds are confirmed on-chain.

### TX_SIGNATURE UNIQUE Constraint
The `wager_transactions.tx_signature` column has a UNIQUE constraint. Combined with upsert(..., onConflict: 'tx_signature', ignoreDuplicates: true) in edge functions, this prevents duplicate transaction records from concurrent resolution calls.

### Off-Chain Mirror Pattern
Wager state is mirrored in Supabase for real-time UI updates via Postgres Realtime. The Solana program is the authoritative source for funds; Supabase is the authoritative source for game metadata and UI state.

### Lichess OAuth (PKCE)
Players connect their Lichess account via OAuth PKCE flow. The callback saves `lichess_username`, `lichess_user_id`, and `lichess_access_token` to the player row. `lichess_user_id` is the authoritative proof of account ownership — it comes directly from the Lichess `/api/account` endpoint post-auth, not from user input.

### Platform Token Game Creation
When both players are deposited and the wager enters voting, `secure-wager` calls the Lichess API using `LICHESS_PLATFORM_TOKEN` (a server-side secret) with `users=PlayerA,PlayerB` to create a locked open challenge. Per-color URLs (`lichess_url_white`, `lichess_url_black`) are saved to the wager row and served to each player directly — no manual game ID entry needed.

---

## Detailed Table Specifications

### 1. **PLAYERS**

Core user account table. Every player has a wallet address as their primary identifier.

```sql
CREATE TABLE players (
  id                        BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  wallet_address            TEXT NOT NULL UNIQUE,
  username                  TEXT UNIQUE,
  bio                       TEXT,
  avatar_url                TEXT,

  -- Account Status
  is_banned                 BOOLEAN DEFAULT false,
  ban_reason                TEXT,
  verified                  BOOLEAN DEFAULT false,

  -- Performance Stats
  total_wins                INTEGER DEFAULT 0,
  total_losses              INTEGER DEFAULT 0,
  win_rate                  NUMERIC DEFAULT 0.0,
  total_earnings            BIGINT DEFAULT 0,       -- in lamports
  total_spent               BIGINT DEFAULT 0,       -- in lamports
  total_wagered             BIGINT DEFAULT 0,       -- in lamports
  current_streak            INTEGER DEFAULT 0,
  best_streak               INTEGER DEFAULT 0,
  skill_rating              INTEGER DEFAULT 1000,
  preferred_game            TEXT,

  -- Game Account Links
  lichess_username          TEXT,                   -- Set automatically on OAuth connect
  codm_username             TEXT,
  pubg_username             TEXT,

  -- Lichess OAuth (v1.1.0)
  lichess_access_token      TEXT,                   -- OAuth access token (challenge:write scope)
  lichess_token_expires_at  TIMESTAMPTZ,            -- null = no expiry for personal tokens
  lichess_user_id           TEXT,                   -- Authoritative Lichess identity proof

  -- Timestamps
  last_active               TIMESTAMPTZ,
  created_at                TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at                TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_players_wallet   ON players(wallet_address);
CREATE INDEX idx_players_username ON players(username);
CREATE INDEX idx_players_created  ON players(created_at DESC);
```

**Key Fields:**
- `wallet_address`: Solana public key, immutable primary identifier
- `skill_rating`: ELO-style rating, starts at 1000
- `total_earnings/spent/wagered`: All tracked in lamports (1 SOL = 1,000,000,000 lamports)
- `lichess_user_id`: Set by OAuth callback — authoritative proof of Lichess account ownership
- `lichess_access_token`: Stored server-side with challenge:write scope, never exposed to clients

---

### 2. **WAGERS**

Represents individual gaming matches with betting logic.

```sql
CREATE TABLE wagers (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id              BIGINT UNIQUE GENERATED ALWAYS AS IDENTITY,

  -- Players
  player_a_wallet       TEXT NOT NULL REFERENCES players(wallet_address),
  player_b_wallet       TEXT REFERENCES players(wallet_address),

  -- Game Details
  game                  game_type NOT NULL,           -- chess, codm, pubg
  stake_lamports        BIGINT NOT NULL,              -- Per player stake
  lichess_game_id       TEXT,                         -- Link to Lichess for chess

  -- Chess-specific (v1.1.0)
  chess_clock_limit     INTEGER DEFAULT 300,          -- seconds
  chess_clock_increment INTEGER DEFAULT 3,            -- seconds
  chess_rated           BOOLEAN DEFAULT false,
  lichess_url_white     TEXT,                         -- Per-color play URL for Player A
  lichess_url_black     TEXT,                         -- Per-color play URL for Player B

  -- Match Status
  status                wager_status DEFAULT 'created'::wager_status,

  -- Ready Room (10-second countdown)
  ready_player_a        BOOLEAN DEFAULT false,
  ready_player_b        BOOLEAN DEFAULT false,
  countdown_started_at  TIMESTAMPTZ,

  -- On-chain deposit tracking (v1.1.0)
  -- Set to true by secure-wager edge function after on-chain tx is confirmed.
  -- Game starts (status → voting) only when both are true — prevents race
  -- conditions where one player appears ready before funds land on-chain.
  deposit_player_a      BOOLEAN NOT NULL DEFAULT false,
  deposit_player_b      BOOLEAN NOT NULL DEFAULT false,
  tx_signature_a        TEXT,                         -- Player A deposit tx signature
  tx_signature_b        TEXT,                         -- Player B deposit tx signature

  -- Voting / Dispute Resolution
  requires_moderator    BOOLEAN DEFAULT false,
  vote_player_a         TEXT REFERENCES players(wallet_address),
  vote_player_b         TEXT REFERENCES players(wallet_address),
  vote_timestamp        TIMESTAMPTZ,
  retract_deadline      TIMESTAMPTZ,

  -- Results
  winner_wallet         TEXT REFERENCES players(wallet_address),
  resolved_at           TIMESTAMPTZ,

  -- Cancellation (for refunds)
  cancelled_at          TIMESTAMPTZ,
  cancelled_by          TEXT REFERENCES players(wallet_address),
  cancel_reason         TEXT,                         -- 'user_cancelled', 'transaction_failed', etc.

  -- Public Access
  is_public             BOOLEAN DEFAULT true,
  stream_url            TEXT,

  -- Timestamps
  created_at            TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_wagers_status   ON wagers(status);
CREATE INDEX idx_wagers_players  ON wagers(player_a_wallet, player_b_wallet);
CREATE INDEX idx_wagers_created  ON wagers(created_at DESC);
CREATE INDEX idx_wagers_resolved ON wagers(status) WHERE status = 'resolved';
```

**Status Flow:**
1. `created` → Waiting for player B to join
2. `joined` → Both players present, enter ready room
3. `voting` → Match in progress (after countdown and BOTH deposits confirmed on-chain)
4. `disputed` → Moderator review needed
5. `resolved` → Winner determined, payouts processed
6. `cancelled` → Wager cancelled, refunds processed (can occur from joined/voting)

---

### 3. **WAGER_TRANSACTIONS**

Immutable ledger of all Solana blockchain transactions.

```sql
CREATE TABLE wager_transactions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  wager_id         UUID NOT NULL REFERENCES wagers(id),
  wallet_address   TEXT NOT NULL REFERENCES players(wallet_address),

  -- Transaction Details
  tx_type          transaction_type NOT NULL,    -- deposit, withdraw, payout
  amount_lamports  BIGINT NOT NULL,
  tx_signature     TEXT UNIQUE,                  -- Solana tx hash

  -- Status Tracking
  status           transaction_status DEFAULT 'pending'::transaction_status,
  error_message    TEXT,

  -- Timestamps
  created_at       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tx_wager     ON wager_transactions(wager_id);
CREATE INDEX idx_tx_wallet    ON wager_transactions(wallet_address);
CREATE INDEX idx_tx_status    ON wager_transactions(status);
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
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Blockchain Data
  mint_address    TEXT NOT NULL UNIQUE,   -- Solana NFT mint address
  owner_wallet    TEXT NOT NULL REFERENCES players(wallet_address),

  -- NFT Details
  name            TEXT NOT NULL,
  tier            nft_tier NOT NULL,      -- bronze, silver, gold, platinum
  metadata_uri    TEXT,                   -- Arweave/IPFS link
  image_uri       TEXT,
  attributes      JSONB DEFAULT '{}'::jsonb,

  -- Associated Data
  wager_id        UUID REFERENCES wagers(id),
  match_id        BIGINT,
  stake_amount    BIGINT,
  lichess_game_id TEXT,

  -- Timestamps
  minted_at       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_nft_owner  ON nfts(owner_wallet);
CREATE INDEX idx_nft_wager  ON nfts(wager_id);
CREATE INDEX idx_nft_mint   ON nfts(mint_address);
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
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Reference
  player_wallet     TEXT NOT NULL REFERENCES players(wallet_address),

  -- Achievement Data
  achievement_type  TEXT NOT NULL,     -- "first_win", "streak_5", etc.
  achievement_value INTEGER,           -- Optional value (streak length, etc.)

  -- Optional NFT
  nft_mint_address  TEXT REFERENCES nfts(mint_address),

  -- Timestamps
  unlocked_at       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_achievement_player ON achievements(player_wallet);
CREATE INDEX idx_achievement_type   ON achievements(achievement_type);
```

---

## Admin Tables

### 6. **ADMIN_USERS**

Admin portal accounts. Separate from player accounts.

```sql
CREATE TABLE admin_users (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Authentication
  email               TEXT NOT NULL UNIQUE,
  password_hash       TEXT NOT NULL,          -- PBKDF2 hashed
  username            TEXT UNIQUE,
  full_name           TEXT,

  -- Authorization
  role                admin_role NOT NULL,     -- moderator, admin, superadmin
  permissions         JSONB NOT NULL,          -- Granular permission map

  -- Account Status
  is_active           BOOLEAN NOT NULL DEFAULT true,
  is_banned           BOOLEAN NOT NULL DEFAULT false,
  two_factor_enabled  BOOLEAN NOT NULL DEFAULT false,

  -- Timestamps
  last_login          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_admin_email    ON admin_users(email);
CREATE INDEX idx_admin_username ON admin_users(username);
CREATE INDEX idx_admin_role     ON admin_users(role);
```

---

### 7. **ADMIN_SESSIONS**

JWT session tracking for admin portal.

```sql
CREATE TABLE admin_sessions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Reference
  admin_id       UUID NOT NULL REFERENCES admin_users(id),

  -- Session Data
  token_hash     TEXT NOT NULL UNIQUE,     -- Hashed JWT
  ip_address     TEXT,
  user_agent     TEXT,

  -- Lifecycle
  expires_at     TIMESTAMPTZ NOT NULL,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  last_activity  TIMESTAMPTZ,

  -- Timestamps
  created_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_session_admin  ON admin_sessions(admin_id);
CREATE INDEX idx_session_active ON admin_sessions(is_active) WHERE is_active = true;
```

---

### 8. **ADMIN_WALLET_BINDINGS**

Solana wallets bound to admin accounts for on-chain verification.

```sql
CREATE TABLE admin_wallet_bindings (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Reference
  admin_id               UUID NOT NULL REFERENCES admin_users(id),

  -- Wallet Data
  wallet_address         TEXT NOT NULL UNIQUE,
  verification_signature TEXT,          -- Ed25519 signature proof

  -- Status
  verified               BOOLEAN NOT NULL DEFAULT false,
  is_primary             BOOLEAN NOT NULL DEFAULT false,
  verified_at            TIMESTAMPTZ,

  -- Timestamps
  created_at             TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_wallet_admin    ON admin_wallet_bindings(admin_id);
CREATE INDEX idx_wallet_verified ON admin_wallet_bindings(verified);
```

---

### 9. **ADMIN_AUDIT_LOGS**

Full audit trail of all admin actions for compliance.

```sql
CREATE TABLE admin_audit_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Reference
  admin_id       UUID NOT NULL REFERENCES admin_users(id),

  -- Action Details
  action_type    TEXT NOT NULL,          -- What was done
  resource_type  TEXT NOT NULL,          -- What was affected (players, wagers, etc.)
  resource_id    TEXT,                   -- ID of affected resource

  -- State Changes
  old_values     JSONB,                  -- Before state
  new_values     JSONB,                  -- After state

  -- Context
  ip_address     TEXT,
  user_agent     TEXT,

  -- Timestamps
  created_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_admin    ON admin_audit_logs(admin_id);
CREATE INDEX idx_audit_action   ON admin_audit_logs(action_type);
CREATE INDEX idx_audit_resource ON admin_audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_created  ON admin_audit_logs(created_at DESC);
```

---

### 10. **ADMIN_LOGS**

Wager-specific admin action log.

```sql
CREATE TABLE admin_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Action Details
  action         TEXT NOT NULL,
  wager_id       UUID NOT NULL REFERENCES wagers(id),
  wallet_address TEXT REFERENCES players(wallet_address),

  -- Who acted
  performed_by   TEXT NOT NULL,          -- Admin who acted

  -- Context
  notes          TEXT,
  metadata       JSONB,

  -- Timestamps
  created_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_admin_log_wager   ON admin_logs(wager_id);
CREATE INDEX idx_admin_log_wallet  ON admin_logs(wallet_address);
CREATE INDEX idx_admin_log_created ON admin_logs(created_at DESC);
```

---

### 11. **ADMIN_NOTES**

Admin notes attached to players or wagers.

```sql
CREATE TABLE admin_notes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  player_wallet  TEXT REFERENCES players(wallet_address),
  wager_id       UUID REFERENCES wagers(id),

  -- Note Content
  note           TEXT NOT NULL,
  created_by     TEXT NOT NULL,          -- Admin who wrote it

  -- Timestamps
  created_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_note_player ON admin_notes(player_wallet);
CREATE INDEX idx_note_wager  ON admin_notes(wager_id);
```

---

## Indexes & Performance

### Query Performance Optimization

| Index | Purpose | Expected Queries |
|-------|---------|------------------|
| `idx_players_wallet` | Fast wallet lookups | `SELECT * FROM players WHERE wallet_address = ?` |
| `idx_players_username` | Username searches | `SELECT * FROM players WHERE username = ?` |
| `idx_wagers_status` | Filter by wager status | `SELECT * FROM wagers WHERE status = 'created'` |
| `idx_wagers_players` | Player's wagers | `SELECT * FROM wagers WHERE player_a_wallet = ? OR player_b_wallet = ?` |
| `idx_tx_wager` | Transaction history | `SELECT * FROM wager_transactions WHERE wager_id = ?` |
| `idx_tx_wallet` | Wallet transactions | `SELECT * FROM wager_transactions WHERE wallet_address = ?` |
| `idx_tx_signature` | TX lookup by signature | `SELECT * FROM wager_transactions WHERE tx_signature = ?` |
| `idx_nft_owner` | User's NFTs | `SELECT * FROM nfts WHERE owner_wallet = ?` |
| `idx_admin_email` | Admin lookup | `SELECT * FROM admin_users WHERE email = ?` |
| `idx_session_admin` | Admin sessions | `SELECT * FROM admin_sessions WHERE admin_id = ?` |

### Query Performance Targets

- Wallet lookups: < 5ms
- Wager list by status: < 20ms
- Transaction history: < 50ms
- Leaderboard (100 entries): < 100ms
- Admin audit logs (1000 entries): < 200ms

---

## Data Consistency Rules

### Business Logic Constraints

1. **Stake Amounts**: Must be > 0
2. **Winning Players**: Must be either `player_a_wallet` or `player_b_wallet`
3. **Transaction Finality**: Once `status = 'confirmed'`, cannot be modified
4. **Wager Flow**: Status transitions validated by application logic
5. **Player Uniqueness**: One player cannot be both player_a and player_b in same wager
6. **Match ID Uniqueness**: Each wager has a unique match_id for PDA derivation
7. **TX Signature Uniqueness**: Prevents duplicate transactions from concurrent calls
8. **Dual Deposit Gate**: `status` cannot transition to `voting` unless both `deposit_player_a` and `deposit_player_b` are true

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

-- TX Signature uniqueness prevents duplicate records
ALTER TABLE wager_transactions ADD CONSTRAINT unique_tx_signature UNIQUE (tx_signature);
```

---

## Recent Migrations

### v1.1.0 — March 18, 2026

```sql
-- Wagers: dual deposit tracking + chess game support
ALTER TABLE wagers
  ADD COLUMN IF NOT EXISTS deposit_player_a      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deposit_player_b      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tx_signature_a        TEXT,
  ADD COLUMN IF NOT EXISTS tx_signature_b        TEXT,
  ADD COLUMN IF NOT EXISTS chess_clock_limit     INTEGER DEFAULT 300,
  ADD COLUMN IF NOT EXISTS chess_clock_increment INTEGER DEFAULT 3,
  ADD COLUMN IF NOT EXISTS chess_rated           BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS lichess_url_white     TEXT,
  ADD COLUMN IF NOT EXISTS lichess_url_black     TEXT;

-- Players: Lichess OAuth
ALTER TABLE players
  ADD COLUMN IF NOT EXISTS lichess_access_token      TEXT,
  ADD COLUMN IF NOT EXISTS lichess_token_expires_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lichess_user_id           TEXT;
```

---

## Useful Queries

### Player Leaderboard (Top 100)

```sql
SELECT
  wallet_address,
  username,
  total_wins,
  total_losses,
  ROUND((total_wins::numeric / NULLIF(total_wins + total_losses, 0) * 100), 2) AS win_rate,
  total_earnings / 1000000000.0 AS earnings_sol,
  skill_rating,
  current_streak,
  best_streak
FROM players
WHERE is_banned = false
ORDER BY skill_rating DESC, total_wins DESC
LIMIT 100;
```

### Wager History for a Player

```sql
SELECT
  id,
  match_id,
  game,
  stake_lamports / 1000000000.0 AS stake_sol,
  CASE WHEN winner_wallet = $1 THEN 'WON' ELSE 'LOST' END AS result,
  resolved_at,
  winner_wallet
FROM wagers
WHERE (player_a_wallet = $1 OR player_b_wallet = $1)
  AND status = 'resolved'
ORDER BY resolved_at DESC
LIMIT 50;
```

### Transaction Ledger for a Wager

```sql
SELECT
  id,
  tx_type,
  amount_lamports / 1000000000.0 AS amount_sol,
  status,
  tx_signature,
  error_message,
  created_at
FROM wager_transactions
WHERE wager_id = $1
ORDER BY created_at DESC;
```

### Admin Actions on a Player (Audit Trail)

```sql
SELECT
  al.action,
  al.wager_id,
  al.performed_by,
  al.notes,
  al.metadata,
  al.created_at
FROM admin_logs al
WHERE al.wallet_address = $1
ORDER BY al.created_at DESC
LIMIT 100;
```

### Disputed Wagers

```sql
SELECT
  id,
  match_id,
  player_a_wallet,
  player_b_wallet,
  game,
  stake_lamports / 1000000000.0 AS stake_sol,
  vote_player_a,
  vote_player_b,
  vote_timestamp,
  created_at
FROM wagers
WHERE status = 'disputed'
   OR (status = 'voting' AND requires_moderator = true)
ORDER BY vote_timestamp ASC;
```

---

## Backup & Recovery

### Supabase Automated Backups

Supabase automatically backs up your database daily. To restore:

1. Go to **Supabase Dashboard** → **Backups**
2. Select desired backup point
3. Click **Restore** (creates new database instance)
4. Update `NEXT_PUBLIC_SUPABASE_URL` in `.env.local`

### Manual Export/Import

```bash
# Export entire database
pg_dump postgresql://[user]:[password]@[host]:[port]/[database] > backup.sql

# Export specific table
pg_dump -t wagers postgresql://[user]:[password]@[host]:[port]/[database] > wagers_backup.sql

# Restore
psql postgresql://[user]:[password]@[host]:[port]/[database] < backup.sql
```

### Point-in-Time Recovery

Contact Supabase support with:
- Desired recovery timestamp
- Reason for recovery
- Authorization confirmation

---

## Related Documentation

- **Architecture**: See `ARCHITECTURE.md` for on-chain/off-chain design
- **Type Definitions**: See `src/integrations/supabase/types.ts`
- **Full DB Setup**: See `gamegambit-setup.sql`
- **API Reference**: See `API_REFERENCE.md`
- **Admin Guide**: See admin-specific documentation
- **Development**: See `DEVELOPMENT_GUIDE.md`

---

**Version Control**  
This schema is version controlled in GitHub. Update this document whenever database changes are made.

Last updated: March 20, 2026  
Schema version: 1.1.0 (Supabase PostgreSQL)