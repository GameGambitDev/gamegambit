# GameGambit — Database Schema

**Last Updated:** March 23, 2026  
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
7. [DB Functions (RPC)](#db-functions-rpc)
8. [DB Triggers](#db-triggers)
9. [Supabase Realtime Publication](#supabase-realtime-publication)
10. [Indexes & Performance](#indexes--performance)
11. [Data Consistency Rules](#data-consistency-rules)
12. [Known Type Gaps](#known-type-gaps)
13. [Useful Queries](#useful-queries)
14. [Backup & Recovery](#backup--recovery)

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
- `'error_on_chain_draw_refund'` — Draw refund tx failed on-chain
- `'error_on_chain_cancel_refund'` — Cancel refund tx failed on-chain
- `'error_cancel_refund'` — Cancel refund call failed

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

### NFT Tiers
> ⚠️ **Note:** The live DB enum is `bronze | silver | gold | diamond`. Earlier documentation incorrectly listed this as `bronze | silver | gold | platinum`. **Diamond is correct.**
- `'bronze'` — Basic victory NFT
- `'silver'` — 5+ consecutive wins
- `'gold'` — 10+ consecutive wins
- `'diamond'` — 20+ consecutive wins

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
| `wager_messages` | In-match chat and edit proposals | wager_id, sender_wallet, message_type, proposal_data, proposal_status |

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
| `notifications` | In-app real-time notifications | player_wallet, type, read, wager_id |
| `push_subscriptions` | Web Push notification subscriptions | player_wallet, endpoint (UNIQUE), p256dh, auth |
| `rate_limit_logs` | Per-wallet endpoint rate limiting | wallet_address, endpoint, request_count, window_reset_at |

---

## Relationships Diagram

```
players (1) ──────────────────────────────────────────────── (N) wagers [player_a_wallet]
players (1) ──────────────────────────────────────────────── (N) wagers [player_b_wallet]
players (1) ──────────────────────────────────────────────── (N) wagers [winner_wallet]
players (1) ──────────────────────────────────────────────── (N) wagers [cancelled_by]
players (1) ──────────────────────────────────────────────── (N) wager_transactions
players (1) ──────────────────────────────────────────────── (N) wager_messages [sender_wallet]
players (1) ──────────────────────────────────────────────── (N) nfts
players (1) ──────────────────────────────────────────────── (N) achievements
players (1) ──────────────────────────────────────────────── (N) admin_notes
players (1) ──────────────────────────────────────────────── (N) rate_limit_logs

wagers  (1) ──────────────────────────────────────────────── (N) wager_transactions
wagers  (1) ──────────────────────────────────────────────── (N) wager_messages
wagers  (1) ──────────────────────────────────────────────── (N) nfts
wagers  (1) ──────────────────────────────────────────────── (N) admin_logs
wagers  (1) ──────────────────────────────────────────────── (N) admin_notes
wagers  (1) ──────────────────────────────────────────────── (N) notifications

admin_users (1) ──────────────────────────────────────────── (N) admin_sessions
admin_users (1) ──────────────────────────────────────────── (N) admin_wallet_bindings
admin_users (1) ──────────────────────────────────────────── (N) admin_audit_logs

nfts    (1) ──────────────────────────────────────────────── (N) achievements [nft_mint_address]
players (1) ──────────────────────────────────────────────── (N) notifications
wagers  (1) ──────────────────────────────────────────────── (N) notifications
```

> **Note on `admin_logs.wallet_address`:** This column stores a player wallet string for context but does **not** have a FK constraint in the live DB (confirmed by `information_schema.table_constraints` query). It is informational only — the player row may not exist if the action was taken before the player was created. `admin_logs.wager_id` does have a FK to `wagers(id)`.

> **Note on `push_subscriptions.player_wallet`:** This column has no FK constraint in the live DB — the Supabase-generated types confirm an empty `Relationships` array. Access is enforced by RLS policies only, not a DB-level FK. This is intentional: push subscriptions should survive a player record being recreated.

> **Note on `wager_messages.sender_wallet`:** No FK constraint at the DB level (confirmed in live schema). The comment in the table DDL marks it as a logical FK but it was intentionally left unconstrained to avoid blocking message inserts if a player record is briefly inconsistent during creation. Access is enforced by edge function auth.

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

### Wager Chat & Proposals
`wager_messages` supports two message types. `chat` messages are plain text sent between the two players in the ready room. `proposal` messages carry a `proposal_data` JSONB payload describing a requested wager edit (field, old value, new value) and a `proposal_status` of `pending`, `accepted`, or `rejected`. When a proposal is accepted, the edge function applies the change to the `wagers` row directly. The table is included in the `supabase_realtime` publication so both players receive messages instantly without polling.

**Critical:** Never create more than one Supabase channel with the same name (`wager-chat:${wagerId}`) from the same client. Duplicate channel names cause Supabase to silently drop one subscription, breaking realtime delivery.

### Rate Limiting
`rate_limit_logs` provides a sliding-window rate limiter keyed on `(wallet_address, endpoint)`. Each row tracks the request count within the current window and the timestamp when the window resets. The edge function increments `request_count` on each call and rejects requests that exceed the configured limit before the window expires.

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

  -- Moderation
  flagged_for_review        BOOLEAN DEFAULT false,
  flagged_by                TEXT,
  flagged_at                TIMESTAMPTZ,
  flag_reason               TEXT,

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
- `flagged_for_review / flagged_by / flag_reason`: Set by admin actions for moderation queue

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

  -- Chess side preference (v1.2.0)
  chess_side_preference TEXT DEFAULT 'random'
    CHECK (chess_side_preference IN ('random', 'white', 'black')),

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
4. `retractable` → Both votes agree, 15-second retract window open
5. `disputed` → Moderator review needed (votes disagree)
6. `resolved` → Winner determined, payouts processed
7. `cancelled` → Wager cancelled, refunds processed (can occur from joined/voting)

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

**Monitoring:** Rows with `status = 'failed'` and `tx_type` beginning with `error_` represent on-chain failures and should be monitored. The `error_message` column contains the exception from the edge function for debugging.

---

### 4. **WAGER_MESSAGES**

Per-wager chat and edit proposal messages between the two players.
Included in `supabase_realtime` publication — both players receive new rows instantly.

> ⚠️ **Type Gap:** `wager_messages` is **not present in the generated `src/integrations/supabase/types.ts`**. The hook `useWagerChat.ts` works around this with an `as any` cast at the query boundary. After any schema change, regenerate types:
> ```bash
> supabase gen types typescript --project-id your_project_ref > src/integrations/supabase/types.ts
> ```
> The `WagerMessage` interface lives in `src/hooks/useWagerChat.ts` and is the authoritative TypeScript type for this table until types are regenerated.

```sql
CREATE TABLE wager_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  wager_id        UUID NOT NULL REFERENCES wagers(id),
  sender_wallet   TEXT NOT NULL,                 -- logical FK to players(wallet_address), no DB constraint

  -- Content
  message         TEXT NOT NULL,
  message_type    TEXT DEFAULT 'chat'            -- 'chat' | 'proposal'
    CHECK (message_type IN ('chat', 'proposal')),

  -- Proposal fields (null when message_type = 'chat')
  proposal_data   JSONB,                         -- { field, old_value, new_value, label }
  proposal_status TEXT                           -- 'pending' | 'accepted' | 'rejected'
    CHECK (proposal_status IN ('pending', 'accepted', 'rejected')),

  -- Timestamps
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_wager_messages_wager_id ON wager_messages(wager_id);
CREATE INDEX idx_wager_messages_created  ON wager_messages(wager_id, created_at ASC);
```

**Message Types:**
- `chat` — Plain text message between the two players in the ready room. `proposal_data` and `proposal_status` are null.
- `proposal` — A requested wager edit. `proposal_data` carries `{ field, old_value, new_value, label }`. `proposal_status` starts as `pending` and is updated to `accepted` or `rejected` by the opponent. On acceptance the `applyProposal` action in `secure-wager` applies the change to the `wagers` row.

**Proposal Data Shape:**
```json
{
  "field": "stake_lamports",
  "old_value": 10000000,
  "new_value": 50000000,
  "label": "Stake: 0.0100 → 0.0500 SOL"
}
```
Supported fields: `stake_lamports`, `is_public`, `stream_url`.

**Realtime:** `wager_messages` is in the `supabase_realtime` publication. The frontend subscribes to `postgres_changes` filtered by `wager_id`. Do NOT create more than one subscription per wager ID per client — duplicate channel names cause Supabase to silently drop one, breaking realtime delivery.

---

### 5. **NFTs**

Victory/achievement NFTs minted to Solana blockchain.

```sql
CREATE TABLE nfts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Blockchain Data
  mint_address    TEXT NOT NULL UNIQUE,   -- Solana NFT mint address
  owner_wallet    TEXT NOT NULL REFERENCES players(wallet_address),

  -- NFT Details
  name            TEXT NOT NULL,
  tier            nft_tier NOT NULL,      -- bronze, silver, gold, diamond
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

**Tier System** (live DB `nft_tier` enum — `diamond` not `platinum`):
- `bronze`: Basic victory NFT
- `silver`: 5+ consecutive wins
- `gold`: 10+ consecutive wins
- `diamond`: 20+ consecutive wins

---

### 6. **ACHIEVEMENTS**

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

### 7. **ADMIN_USERS**

Admin portal accounts. Separate from player accounts — uses its own email/password auth, not Supabase Auth.

```sql
CREATE TABLE admin_users (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Authentication
  email               TEXT NOT NULL UNIQUE,
  password_hash       TEXT NOT NULL,          -- PBKDF2 hashed (100,000 iterations)
  username            TEXT UNIQUE,
  full_name           TEXT,
  bio                 TEXT,
  avatar_url          TEXT,
  ban_reason          TEXT,

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

### 8. **ADMIN_SESSIONS**

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

### 9. **ADMIN_WALLET_BINDINGS**

Solana wallets bound to admin accounts for on-chain verification.

```sql
CREATE TABLE admin_wallet_bindings (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Reference
  admin_id               UUID NOT NULL REFERENCES admin_users(id),

  -- Wallet Data
  wallet_address         TEXT NOT NULL UNIQUE,
  verification_signature TEXT,          -- Ed25519 signature proof
  last_verified          TIMESTAMPTZ,

  -- Status
  verified               BOOLEAN NOT NULL DEFAULT false,
  is_primary             BOOLEAN NOT NULL DEFAULT false,
  verified_at            TIMESTAMPTZ,

  -- Timestamps
  created_at             TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_wallet_admin    ON admin_wallet_bindings(admin_id);
CREATE INDEX idx_wallet_verified ON admin_wallet_bindings(verified);
```

---

### 10. **ADMIN_AUDIT_LOGS**

Full audit trail of all admin actions for compliance. Includes before/after state snapshots.

```sql
CREATE TABLE admin_audit_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Reference
  admin_id       UUID REFERENCES admin_users(id),   -- nullable: system actions have no admin

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

### 11. **ADMIN_LOGS**

Wager-specific admin action log. Written by edge functions and API routes. Lighter than `admin_audit_logs` — no before/after state, just the action record.

```sql
CREATE TABLE admin_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Action Details
  action         TEXT NOT NULL,
  wager_id       UUID REFERENCES wagers(id),        -- FK confirmed in live DB
  wallet_address TEXT,                               -- No FK constraint — informational only

  -- Who acted
  performed_by   TEXT NOT NULL,          -- Admin who acted

  -- Context
  notes          TEXT,
  metadata       JSONB,

  -- Timestamps
  created_at     TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_admin_log_wager   ON admin_logs(wager_id);
CREATE INDEX idx_admin_log_wallet  ON admin_logs(wallet_address);
CREATE INDEX idx_admin_log_created ON admin_logs(created_at DESC);
```

> **Note:** `wallet_address` has no FK constraint in the live DB — this is confirmed. It is an informational field. Do not rely on it for JOIN integrity.

---

### 12. **ADMIN_NOTES**

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
  created_at     TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_note_player ON admin_notes(player_wallet);
CREATE INDEX idx_note_wager  ON admin_notes(wager_id);
```

---

### 13. **NOTIFICATIONS**

Real-time in-app notifications for wager events. Written by edge functions, read by the frontend via Supabase Realtime.

```sql
CREATE TABLE notifications (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Target player
  player_wallet  TEXT NOT NULL,

  -- Notification content
  type           TEXT NOT NULL CHECK (type IN (
                   'wager_joined',
                   'wager_won',
                   'wager_lost',
                   'wager_draw',
                   'wager_cancelled',
                   'game_started'
                 )),
  title          TEXT NOT NULL,
  message        TEXT NOT NULL,

  -- Optional wager reference
  wager_id       UUID REFERENCES wagers(id) ON DELETE CASCADE,

  -- Read state
  read           BOOLEAN DEFAULT FALSE,

  -- Timestamps
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_player_wallet ON notifications(player_wallet);
CREATE INDEX idx_notifications_read ON notifications(player_wallet, read);

-- Row Level Security
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can read own notifications"
  ON notifications FOR SELECT
  USING (player_wallet = current_setting('request.jwt.claims', true)::json->>'wallet');

CREATE POLICY "Service role can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Players can update own notifications"
  ON notifications FOR UPDATE
  USING (player_wallet = current_setting('request.jwt.claims', true)::json->>'wallet');
```

**Notification Types:**
- `wager_joined` — Sent to Player A when Player B joins their wager
- `game_started` — Sent to both players when both deposits confirmed + Lichess game created
- `wager_won` — Sent to winner when game resolves, includes payout amount
- `wager_lost` — Sent to loser when game resolves
- `wager_draw` — Sent to both players on draw/refund
- `wager_cancelled` — Sent to the non-cancelling player when wager is cancelled

**Realtime:** Frontend subscribes to `postgres_changes` on `notifications` filtered by `player_wallet`. New rows appear instantly in the bell icon dropdown without refresh.

---

### 14. **PUSH_SUBSCRIPTIONS**

Web Push API subscriptions for background notifications (RFC 8291 / VAPID).

```sql
CREATE TABLE push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  player_wallet TEXT NOT NULL,         -- No FK constraint — RLS only
  endpoint      TEXT NOT NULL UNIQUE,  -- Push service URL
  p256dh        TEXT NOT NULL,         -- Client public key (base64url)
  auth          TEXT NOT NULL,         -- Client auth secret (base64url)

  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_push_subscriptions_wallet ON push_subscriptions(player_wallet);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Players can manage own subscriptions"
  ON push_subscriptions FOR ALL
  USING (true) WITH CHECK (true);
```

**Notes:**
- `player_wallet` has **no FK constraint** — confirmed in live DB. Access is enforced by RLS only.
- `endpoint` is unique — if a push service returns 404 or 410, the row should be deleted
- `p256dh` and `auth` are base64url-encoded values from the browser's `PushSubscription` object
- VAPID signing is handled server-side using `VAPID_PRIVATE_KEY` / `VAPID_PUBLIC_KEY` edge function secrets
- The `upsert(..., { onConflict: 'endpoint' })` pattern in `useNotifications.ts` means re-subscribing a device updates the row rather than duplicating it

---

### 15. **RATE_LIMIT_LOGS**

Sliding-window rate limiter keyed on wallet + endpoint. Used by edge functions to reject excessive requests before they hit business logic.

```sql
CREATE TABLE rate_limit_logs (
  id              BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,

  wallet_address  TEXT NOT NULL,
  endpoint        TEXT NOT NULL,
  request_count   INTEGER DEFAULT 1,
  window_reset_at TIMESTAMPTZ NOT NULL,

  created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

**How it works:**
- On each request the edge function upserts a row keyed on `(wallet_address, endpoint)`
- If `window_reset_at` is in the past, the window resets and `request_count` returns to 1
- If `request_count` exceeds the configured limit before `window_reset_at`, the request is rejected with 429
- `notifyChat` is specifically rate-limited to 1 notification per 5 minutes per wager to prevent notification spam

---

## DB Functions (RPC)

These are callable via `.rpc()` on the Supabase client. Confirmed live in `information_schema.routines`.

### `set_player_ready`
Atomically toggles a player's ready state and handles countdown logic.

```sql
-- Args
p_wager_id   uuid
p_is_player_a boolean
p_ready      boolean

-- Returns: updated wagers row (SETOF wagers, isSetofReturn: false)
```

Called by `secure-wager` action `setReady`. Updates `ready_player_a` or `ready_player_b` based on `p_is_player_a`. If both become true, sets `countdown_started_at` to now. The function runs atomically to prevent race conditions where both players set ready simultaneously.

---

### `update_winner_stats`
Increments win stats on the `players` row after a wager resolves.

```sql
-- Args
p_wallet   text
p_stake    numeric
p_earnings numeric

-- Returns: void
```

Called by the `resolve-wager` edge function after on-chain settlement. Increments `total_wins`, `total_earnings`, `total_wagered`, and `current_streak`. Also updates `best_streak` if `current_streak` exceeds it, and recalculates `win_rate`.

---

### `update_loser_stats`
Increments loss stats on the `players` row after a wager resolves.

```sql
-- Args
p_wallet text
p_stake  numeric

-- Returns: void
```

Called alongside `update_winner_stats`. Increments `total_losses`, `total_spent`, `total_wagered`, resets `current_streak` to 0, and recalculates `win_rate`.

---

## DB Triggers

These functions fire automatically on DML events. All confirmed live in `information_schema.routines`. They cannot be bypassed by direct table writes — only the service role (used by edge functions) can circumvent them.

### `protect_player_sensitive_fields` (BEFORE UPDATE on `players`)
Blocks direct client-side updates to sensitive fields. Prevents frontend code from directly writing:
- `is_banned`, `ban_reason`
- `flagged_for_review`, `flagged_by`, `flag_reason`, `flagged_at`
- `lichess_access_token`, `lichess_user_id`, `lichess_token_expires_at`

These fields can only be written by edge functions running with the service role key. Any attempt to update them via the anon key will be silently stripped or rejected. This is why `secure-player` and the Lichess OAuth callback route exist — they're the only legitimate write paths for these columns.

---

### `protect_wager_sensitive_fields` (BEFORE UPDATE on `wagers`)
Blocks direct client-side updates to financial and state fields. Prevents frontend code from directly writing:
- `status`
- `winner_wallet`
- `vote_player_a`, `vote_player_b`
- `deposit_player_a`, `deposit_player_b`
- `resolved_at`, `cancelled_at`, `cancelled_by`

All wager state transitions must go through the `secure-wager` edge function. If you see a wager update silently fail or return stale data, this trigger is likely blocking the write.

---

### `validate_player_insert` (BEFORE INSERT on `players`)
Validates new player rows before they land. Enforces:
- `wallet_address` format (Solana base58, 32–44 chars)
- Required fields are present
- No duplicate wallet addresses

---

### `validate_wager_insert` (BEFORE INSERT on `wagers`)
Validates new wager rows. Enforces:
- `player_a_wallet` exists in `players`
- `stake_lamports` is positive
- `game` is a valid `game_type` enum value
- Player A is not creating a wager against themselves

---

### `update_updated_at` / `update_updated_at_column` (BEFORE UPDATE — multiple tables)
Two variants of the same timestamp-refresh trigger. Fires on any UPDATE and sets `updated_at = NOW()`. Applied to: `players`, `wagers`, `wager_transactions`, `admin_users`, `admin_notes`, `admin_wallet_bindings`.

> **Note:** Two versions of this trigger function exist in the DB (`update_updated_at` and `update_updated_at_column`). This is a legacy artefact — both do the same thing and were created at different points in the migration history. They are both active and harmless.

---

## Supabase Realtime Publication

The following tables are enabled in the `supabase_realtime` publication and emit `postgres_changes` events to subscribed clients. Confirmed via `pg_publication_tables WHERE pubname = 'supabase_realtime'`.

| Table | Events Used | Notes |
|-------|------------|-------|
| `wagers` | INSERT, UPDATE | `GameEventContext` keeps query cache in sync for all wager state changes |
| `wager_transactions` | INSERT | Used to track on-chain deposit confirmations in the Ready Room |
| `notifications` | INSERT | Bell icon dropdown, filtered by `player_wallet` |
| `wager_messages` | INSERT, UPDATE | Ready room chat and proposals, filtered by `wager_id` — **one subscription per wager per client** |

Tables **not** in realtime (not needed or not safe to subscribe to directly): `players`, `admin_*`, `push_subscriptions`, `rate_limit_logs`, `nfts`, `achievements`.

---

## Indexes & Performance

### Complete Index List (live DB)

| Table | Index | Definition |
|-------|-------|------------|
| `achievements` | `achievements_pkey` | UNIQUE btree (id) |
| `achievements` | `idx_achievements_player_wallet` | btree (player_wallet) |
| `admin_audit_logs` | `admin_audit_logs_pkey` | UNIQUE btree (id) |
| `admin_audit_logs` | `idx_audit_admin` | btree (admin_id) |
| `admin_audit_logs` | `idx_audit_action` | btree (action_type) |
| `admin_audit_logs` | `idx_audit_resource` | btree (resource_type, resource_id) |
| `admin_audit_logs` | `idx_audit_created` | btree (created_at DESC) |
| `admin_logs` | `admin_logs_pkey` | UNIQUE btree (id) |
| `admin_logs` | `idx_admin_log_wager` | btree (wager_id) |
| `admin_logs` | `idx_admin_log_wallet` | btree (wallet_address) |
| `admin_logs` | `idx_admin_log_created` | btree (created_at DESC) |
| `admin_notes` | `admin_notes_pkey` | UNIQUE btree (id) |
| `admin_notes` | `idx_note_player` | btree (player_wallet) |
| `admin_notes` | `idx_note_wager` | btree (wager_id) |
| `admin_sessions` | `admin_sessions_pkey` | UNIQUE btree (id) |
| `admin_sessions` | `admin_sessions_token_hash_key` | UNIQUE btree (token_hash) |
| `admin_sessions` | `idx_session_admin` | btree (admin_id) |
| `admin_sessions` | `idx_session_active` | btree (is_active) WHERE is_active = true |
| `admin_users` | `admin_users_pkey` | UNIQUE btree (id) |
| `admin_users` | `admin_users_email_key` | UNIQUE btree (email) |
| `admin_users` | `admin_users_username_key` | UNIQUE btree (username) |
| `admin_users` | `idx_admin_email` | btree (email) |
| `admin_users` | `idx_admin_role` | btree (role) |
| `admin_users` | `idx_admin_username` | btree (username) |
| `admin_wallet_bindings` | `admin_wallet_bindings_pkey` | UNIQUE btree (id) |
| `admin_wallet_bindings` | `admin_wallet_bindings_wallet_address_key` | UNIQUE btree (wallet_address) |
| `admin_wallet_bindings` | `idx_wallet_admin` | btree (admin_id) |
| `admin_wallet_bindings` | `idx_wallet_verified` | btree (verified) |
| `nfts` | `nfts_pkey` | UNIQUE btree (id) |
| `nfts` | `nfts_mint_address_key` | UNIQUE btree (mint_address) |
| `nfts` | `idx_nft_owner` | btree (owner_wallet) |
| `nfts` | `idx_nft_wager` | btree (wager_id) |
| `nfts` | `idx_nft_mint` | btree (mint_address) |
| `notifications` | `notifications_pkey` | UNIQUE btree (id) |
| `notifications` | `idx_notifications_player_wallet` | btree (player_wallet) |
| `notifications` | `idx_notifications_read` | btree (player_wallet, read) |
| `players` | `players_pkey` | UNIQUE btree (id) |
| `players` | `players_wallet_address_key` | UNIQUE btree (wallet_address) |
| `players` | `players_username_key` | UNIQUE btree (username) |
| `players` | `idx_players_wallet` | btree (wallet_address) |
| `players` | `idx_players_username` | btree (username) |
| `players` | `idx_players_created` | btree (created_at DESC) |
| `push_subscriptions` | `push_subscriptions_pkey` | UNIQUE btree (id) |
| `push_subscriptions` | `push_subscriptions_endpoint_key` | UNIQUE btree (endpoint) |
| `push_subscriptions` | `idx_push_subscriptions_wallet` | btree (player_wallet) |
| `rate_limit_logs` | `rate_limit_logs_pkey` | UNIQUE btree (id) |
| `wager_messages` | `wager_messages_pkey` | UNIQUE btree (id) |
| `wager_messages` | `idx_wager_messages_wager_id` | btree (wager_id) |
| `wager_messages` | `idx_wager_messages_created` | btree (wager_id, created_at ASC) |
| `wager_transactions` | `wager_transactions_pkey` | UNIQUE btree (id) |
| `wager_transactions` | `wager_transactions_tx_signature_key` | UNIQUE btree (tx_signature) |
| `wager_transactions` | `idx_tx_wager` | btree (wager_id) |
| `wager_transactions` | `idx_tx_wallet` | btree (wallet_address) |
| `wager_transactions` | `idx_tx_status` | btree (status) |
| `wager_transactions` | `idx_tx_signature` | btree (tx_signature) |
| `wagers` | `wagers_pkey` | UNIQUE btree (id) |
| `wagers` | `wagers_match_id_key` | UNIQUE btree (match_id) |
| `wagers` | `idx_wagers_status` | btree (status) |
| `wagers` | `idx_wagers_players` | btree (player_a_wallet, player_b_wallet) |
| `wagers` | `idx_wagers_created` | btree (created_at DESC) |
| `wagers` | `idx_wagers_resolved` | btree (status) WHERE status = 'resolved' |

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
4. **Wager Flow**: Status transitions enforced by `protect_wager_sensitive_fields` trigger — only edge functions with service role can advance state
5. **Player Uniqueness**: One player cannot be both player_a and player_b in same wager
6. **Match ID Uniqueness**: Each wager has a unique match_id for PDA derivation
7. **TX Signature Uniqueness**: Prevents duplicate transactions from concurrent calls
8. **Dual Deposit Gate**: `status` cannot transition to `voting` unless both `deposit_player_a` and `deposit_player_b` are true
9. **Proposal Integrity**: `wager_messages` rows with `message_type = 'proposal'` must have non-null `proposal_data` and `proposal_status`

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

## Known Type Gaps

| Table | Status | Workaround |
|-------|--------|------------|
| `wager_messages` | ❌ Not in `types.ts` | `as any` cast in `useWagerChat.ts`; `WagerMessage` interface defined there |

To fix, run after any schema change:
```bash
supabase gen types typescript --project-id your_project_ref > src/integrations/supabase/types.ts
```

---

## Recent Migrations

### v1.4.0 — March 22, 2026

```sql
-- Wager chat and edit proposals
CREATE TABLE IF NOT EXISTS wager_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wager_id        UUID NOT NULL REFERENCES wagers(id),
  sender_wallet   TEXT NOT NULL,
  message         TEXT NOT NULL,
  message_type    TEXT DEFAULT 'chat' CHECK (message_type IN ('chat', 'proposal')),
  proposal_data   JSONB,
  proposal_status TEXT CHECK (proposal_status IN ('pending', 'accepted', 'rejected')),
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_wager_messages_wager_id ON wager_messages(wager_id);
CREATE INDEX idx_wager_messages_created  ON wager_messages(wager_id, created_at ASC);

-- Enable realtime for chat
ALTER PUBLICATION supabase_realtime ADD TABLE wager_messages;

-- Rate limiting
CREATE TABLE IF NOT EXISTS rate_limit_logs (
  id              BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  wallet_address  TEXT NOT NULL,
  endpoint        TEXT NOT NULL,
  request_count   INTEGER DEFAULT 1,
  window_reset_at TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

---

### v1.3.0 — March 21, 2026

```sql
-- Push subscriptions for Web Push notifications
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_wallet TEXT NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_push_subscriptions_wallet ON push_subscriptions(player_wallet);
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Players can manage own subscriptions"
  ON push_subscriptions FOR ALL
  USING (true) WITH CHECK (true);
```

---

### v1.2.0 — March 21, 2026

```sql
-- Notifications table for real-time in-app alerts
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_wallet TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('wager_joined','wager_won','wager_lost','wager_draw','wager_cancelled','game_started')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  wager_id UUID REFERENCES wagers(id) ON DELETE CASCADE,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_player_wallet ON notifications(player_wallet);
CREATE INDEX idx_notifications_read ON notifications(player_wallet, read);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Chess side preference on wagers
ALTER TABLE wagers
  ADD COLUMN IF NOT EXISTS chess_side_preference TEXT DEFAULT 'random'
    CHECK (chess_side_preference IN ('random', 'white', 'black'));
```

---

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

### Failed Transactions (monitoring)

```sql
SELECT
  wt.id,
  wt.wager_id,
  wt.wallet_address,
  wt.tx_type,
  wt.amount_lamports / 1e9 AS amount_sol,
  wt.error_message,
  wt.created_at
FROM wager_transactions wt
WHERE wt.status = 'failed'
   OR wt.tx_type LIKE 'error_%'
ORDER BY wt.created_at DESC
LIMIT 50;
```

### Chat + Proposals for a Wager

```sql
SELECT
  id,
  sender_wallet,
  message,
  message_type,
  proposal_data,
  proposal_status,
  created_at
FROM wager_messages
WHERE wager_id = $1
ORDER BY created_at ASC;
```

### Pending Proposals for a Wager (opponent's view)

```sql
SELECT * FROM wager_messages
WHERE wager_id = $1
  AND message_type = 'proposal'
  AND proposal_status = 'pending'
  AND sender_wallet != $2   -- $2 = current player's wallet
ORDER BY created_at ASC;
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

### Rate Limit Check for a Wallet + Endpoint

```sql
SELECT request_count, window_reset_at
FROM rate_limit_logs
WHERE wallet_address = $1
  AND endpoint = $2
  AND window_reset_at > NOW();
```

### All DB Functions (verify live)

```sql
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
ORDER BY routine_name;
```

### All Triggers (verify live)

```sql
SELECT trigger_name, event_object_table, action_timing, event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;
```

### Realtime-Enabled Tables (verify live)

```sql
SELECT tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime';
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
- **Dev Guide**: See `DEVELOPMENT_GUIDE.md`
- **Deployment**: See `DEPLOYMENT_GUIDE.md`

---

**Version Control**  
This schema is version controlled in GitHub. Update this document whenever database changes are made.

Last updated: March 23, 2026