# GameGambit — Database Schema

**Last Updated:** April 13, 2026
**Version:** v1.8.0
**Database:** PostgreSQL (Supabase)
**Environment:** Production

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
13. [Recent Migrations](#recent-migrations)
14. [Useful Queries](#useful-queries)
15. [Backup & Recovery](#backup--recovery)

---

## Custom Enum Types

### Wager Status (`wager_status`)
Mirrors the Rust program's `WagerStatus` enum for consistency:
- `'created'` — Player A deposited, waiting for Player B
- `'joined'` — Both players joined, ready room active
- `'voting'` — Game in progress, awaiting result votes
- `'retractable'` — Both votes agree, 15-second retract window
- `'disputed'` — Votes disagree, moderator required
- `'resolved'` — Winner paid out, wager closed
- `'cancelled'` — Cancelled by participant, refund triggered

### Transaction Types (`transaction_type`)
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

### Transaction Status (`transaction_status`)
Blockchain confirmation states:
- `'pending'` — Awaiting blockchain confirmation
- `'confirmed'` — On-chain, irreversible
- `'failed'` — Transaction failed, needs retry

### Game Types (`game_type`)
Supported games:
- `'chess'` — Chess (auto-resolved via Lichess)
- `'codm'` — Call of Duty Mobile
- `'pubg'` — PUBG
- `'free_fire'` — Free Fire *(added migration 004, v1.5.0, March 25 2026)*

### NFT Tiers (`nft_tier`)
> ⚠️ **Note:** The live DB enum is `bronze | silver | gold | diamond`. Earlier documentation incorrectly listed this as `bronze | silver | gold | platinum`. **Diamond is correct.**
- `'bronze'` — Basic victory NFT
- `'silver'` — 5+ consecutive wins
- `'gold'` — 10+ consecutive wins
- `'diamond'` — 20+ consecutive wins

### Admin Roles (`admin_role`)
Role-based access control:
- `'moderator'` — Resolve disputes
- `'admin'` — Full admin access
- `'superadmin'` — System administration

---

## Core Tables

| Table Name | Purpose | Key Fields |
|-----------|---------|-----------|
| `players` | User accounts with stats | wallet_address (UNIQUE), username, skill_rating, total_wins/losses |
| `wagers` | Gaming matches with state | match_id (UNIQUE), player_a/b_wallet, status, stake_lamports |
| `wager_transactions` | Blockchain transaction ledger | wager_id, tx_type, tx_signature (UNIQUE), status |
| `wager_messages` | In-match chat and edit proposals | wager_id, sender_wallet, message_type, proposal_data, proposal_status |

---

## Admin Tables

| Table Name | Purpose | Key Fields |
|-----------|---------|-----------|
| `admin_users` | Admin portal accounts | email (UNIQUE), role, password_hash |
| `admin_sessions` | JWT session tracking | admin_id, token_hash (UNIQUE), expires_at |
| `admin_wallet_bindings` | Solana wallet verification | admin_id, wallet_address, verification_signature |
| `admin_audit_logs` | Complete action audit trail | admin_id, action_type, resource_type, old_values, new_values |
| `admin_logs` | Wager-specific admin actions | action, wager_id, performed_by |
| `admin_notes` | Admin annotations | player_wallet, wager_id, note_content |

---

## Supporting Tables

| Table Name | Purpose | Key Fields |
|-----------|---------|-----------|
| `nfts` | Victory NFTs on Solana | mint_address (UNIQUE), owner_wallet, tier, wager_id |
| `achievements` | Player achievement badges | player_wallet, achievement_type, unlocked_at |
| `notifications` | In-app real-time notifications | player_wallet, type, read, wager_id |
| `push_subscriptions` | Web Push notification subscriptions | player_wallet, endpoint (UNIQUE), p256dh, auth |
| `rate_limit_logs` | Per-wallet endpoint rate limiting | wallet_address, endpoint, request_count, window_reset_at |
| `moderation_requests` | Per-wager moderator assignment chain | wager_id, moderator_wallet, status, deadline *(v1.5.0)* |
| `username_appeals` | Disputed game username ownership | claimant_wallet, holder_wallet, game, username *(v1.5.0)* |
| `username_change_requests` | Formal requests to rebind a game account | player_wallet, game, old_username, new_username *(v1.5.0)* |
| `punishment_log` | Immutable punishment audit trail | player_wallet, offense_type, punishment *(v1.5.0)* |
| `player_behaviour_log` | Soft event log for admin pattern review | player_wallet, event_type *(v1.5.0)* |
| `feed_reactions` | Emoji reactions on public wager feed entries | wager_id, wallet, reaction_type *(v1.8.0)* |
| `friendships` | Friend requests and social connections between players | requester_wallet, recipient_wallet, status *(v1.8.0)* |
| `direct_messages` | DM channel messages between friended players | channel_id, sender_wallet, message *(v1.8.0)* |
| `spectator_bets` | Side-bets placed by spectators on active wagers | wager_id, bettor_wallet, backed_player, amount_lamports *(v1.8.0)* |
| `follows` | Asymmetric follow graph — powers feed "Friends & Following" tab. Distinct from `friendships` (mutual/approval-required). | follower_wallet, following_wallet *(v1.8.0)* |

---

## Relationships Diagram

```
players (1) ──────────────────────────────────────────────── (N) wagers [player_a_wallet]
players (1) ──────────────────────────────────────────────── (N) wagers [player_b_wallet]
players (1) ──────────────────────────────────────────────── (N) wagers [winner_wallet]
players (1) ──────────────────────────────────────────────── (N) wagers [cancelled_by]
players (1) ──────────────────────────────────────────────── (N) wagers [moderator_wallet]
players (1) ──────────────────────────────────────────────── (N) wagers [grace_conceded_by]
players (1) ──────────────────────────────────────────────── (N) wager_transactions
players (1) ──────────────────────────────────────────────── (N) wager_messages [sender_wallet]
players (1) ──────────────────────────────────────────────── (N) nfts
players (1) ──────────────────────────────────────────────── (N) achievements
players (1) ──────────────────────────────────────────────── (N) admin_notes
players (1) ──────────────────────────────────────────────── (N) rate_limit_logs
players (1) ──────────────────────────────────────────────── (N) moderation_requests [moderator_wallet]
players (1) ──────────────────────────────────────────────── (N) username_appeals [claimant_wallet]
players (1) ──────────────────────────────────────────────── (N) username_appeals [holder_wallet]
players (1) ──────────────────────────────────────────────── (N) username_change_requests
players (1) ──────────────────────────────────────────────── (N) punishment_log
players (1) ──────────────────────────────────────────────── (N) player_behaviour_log

wagers  (1) ──────────────────────────────────────────────── (N) wager_transactions
wagers  (1) ──────────────────────────────────────────────── (N) wager_messages
wagers  (1) ──────────────────────────────────────────────── (N) nfts
wagers  (1) ──────────────────────────────────────────────── (N) admin_logs
wagers  (1) ──────────────────────────────────────────────── (N) admin_notes
wagers  (1) ──────────────────────────────────────────────── (N) notifications
wagers  (1) ──────────────────────────────────────────────── (N) moderation_requests

admin_users (1) ──────────────────────────────────────────── (N) admin_sessions
admin_users (1) ──────────────────────────────────────────── (N) admin_wallet_bindings
admin_users (1) ──────────────────────────────────────────── (N) admin_audit_logs

nfts    (1) ──────────────────────────────────────────────── (N) achievements [nft_mint_address]
players (1) ──────────────────────────────────────────────── (N) notifications
wagers  (1) ──────────────────────────────────────────────── (N) notifications

wagers  (1) ──────────────────────────────────────────────── (N) feed_reactions
wagers  (1) ──────────────────────────────────────────────── (N) spectator_bets
players (1) ──────────────────────────────────────────────── (N) feed_reactions [wallet]
players (1) ──────────────────────────────────────────────── (N) friendships [requester_wallet]
players (1) ──────────────────────────────────────────────── (N) friendships [recipient_wallet]
players (1) ──────────────────────────────────────────────── (N) follows [follower_wallet]
players (1) ──────────────────────────────────────────────── (N) follows [following_wallet]
```

> **Note on `admin_logs.wallet_address`:** This column stores a player wallet string for context but does **not** have a FK constraint in the live DB. It is informational only — the player row may not exist if the action was taken before the player was created. `admin_logs.wager_id` does have a FK to `wagers(id)`.

> **Note on `push_subscriptions.player_wallet`:** No FK constraint in the live DB — the Supabase-generated types confirm an empty `Relationships` array. Access is enforced by RLS policies only. This is intentional: push subscriptions should survive a player record being recreated.

> **Note on `wager_messages.sender_wallet`:** No FK constraint at the DB level. The column is a logical FK but was intentionally left unconstrained to avoid blocking message inserts if a player record is briefly inconsistent during creation. Access is enforced by edge function auth.

---

## Key Design Decisions

### match_id as PDA Seed
The `wagers.match_id` is an auto-incrementing bigint used directly as the seed for the on-chain WagerAccount PDA alongside `player_a_wallet`. This creates a deterministic, unique PDA without a separate registry.

### Dual Deposit Tracking
`deposit_player_a` and `deposit_player_b` booleans track on-chain deposit confirmation separately from wager status. The game starts (status → voting) only when both are true, preventing races where one player appears ready before funds are confirmed on-chain.

### TX_SIGNATURE UNIQUE Constraint
The `wager_transactions.tx_signature` column has a UNIQUE constraint. Combined with `upsert(..., onConflict: 'tx_signature', ignoreDuplicates: true)` in edge functions, this prevents duplicate transaction records from concurrent resolution calls.

### Off-Chain Mirror Pattern
Wager state is mirrored in Supabase for real-time UI updates via Postgres Realtime. The Solana program is the authoritative source for funds; Supabase is the authoritative source for game metadata and UI state.

### Lichess OAuth (PKCE)
Players connect their Lichess account via OAuth PKCE flow. The callback saves `lichess_username`, `lichess_user_id`, and `lichess_access_token` to the player row. `lichess_user_id` is the authoritative proof of account ownership — it comes directly from the Lichess `/api/account` endpoint post-auth, not from user input.

### Platform Token Game Creation
When both players are deposited and the wager enters voting, `secure-wager` calls the Lichess API using `LICHESS_PLATFORM_TOKEN` to create a locked open challenge. Per-color URLs (`lichess_url_white`, `lichess_url_black`) are saved to the wager row and served to each player directly — no manual game ID entry needed.

### Wager Chat & Proposals
`wager_messages` supports two message types. `chat` messages are plain text sent between the two players in the ready room. `proposal` messages carry a `proposal_data` JSONB payload describing a requested wager edit (field, old value, new value) and a `proposal_status` of `pending`, `accepted`, or `rejected`. When a proposal is accepted, the edge function applies the change to the `wagers` row directly. The table is included in the `supabase_realtime` publication so both players receive messages instantly without polling.

**Critical:** Never create more than one Supabase channel with the same name (`wager-chat:${wagerId}`) from the same client. Duplicate channel names cause Supabase to silently drop one subscription, breaking realtime delivery.

### Rate Limiting
`rate_limit_logs` provides a sliding-window rate limiter keyed on `(wallet_address, endpoint)`. Each row tracks the request count within the current window and the timestamp when the window resets. The edge function increments `request_count` on each call and rejects requests that exceed the configured limit before the window expires.

### Game Username Binding
Each player can bind one account per game (`codm`, `pubg`, `free_fire`). The bound timestamp for each game is stored in the `game_username_bound_at` JSONB column as `{ "pubg": "<ISO timestamp>", ... }`. Updating a single game's timestamp without overwriting others is done via the `merge_game_bound_at` RPC. Player IDs (`pubg_player_id`, `free_fire_uid`) are API-verified unique identifiers and carry partial UNIQUE indexes so two players cannot hold the same account.

### Moderation Request Chain
When a wager enters `disputed`, a moderation request row is created in `moderation_requests`. Candidate moderators have 20 seconds to accept — if they timeout or decline, another row is created (tracked via `moderation_skipped_count` on the wager). Once accepted the moderator has 10 minutes (`decision_deadline`) to submit a verdict. The full chain of attempts is preserved for audit.

### Punishment Escalation
Punishments are determined by cumulative offense counts: `false_vote_count`, `false_claim_count`, and `moderator_abuse_count` on the player row are incremented by edge functions. Each punishment event is written to `punishment_log` as an immutable record. Soft behavioral events (bindings, appeals, change requests) are written to `player_behaviour_log` for admin pattern review without triggering automatic penalties.

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
  ban_expires_at            TIMESTAMPTZ,            -- Timed ban expiry (set by resolve-wager ban_player action)
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

  -- Game Account Binding (v1.5.0)
  codm_player_id            TEXT,                   -- Numeric in-game CODM ID
  pubg_player_id            TEXT,                   -- API-verified PUBG account ID (persistent)
  free_fire_username        TEXT,
  free_fire_uid             TEXT,                   -- Unique Free Fire UID (API-verified)
  game_username_bound_at    JSONB DEFAULT '{}',     -- { "pubg": "<ISO ts>", "codm": "...", ... }

  -- Punishment Tracking (v1.5.0)
  is_suspended              BOOLEAN NOT NULL DEFAULT false,
  suspension_ends_at        TIMESTAMPTZ,
  false_vote_count          INT NOT NULL DEFAULT 0,
  false_claim_count         INT NOT NULL DEFAULT 0,
  moderator_abuse_count     INT NOT NULL DEFAULT 0,

  -- Settings (v1.5.0)
  push_notifications_enabled    BOOLEAN NOT NULL DEFAULT true,
  moderation_requests_enabled   BOOLEAN NOT NULL DEFAULT true,
  moderation_skipped_count      INT NOT NULL DEFAULT 0,      -- Incremented each time moderator declines/times out

  -- Timestamps
  last_active               TIMESTAMPTZ,
  created_at                TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at                TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_players_wallet   ON players(wallet_address);
CREATE INDEX idx_players_username ON players(username);
CREATE INDEX idx_players_created  ON players(created_at DESC);

-- v1.5.0 indexes
CREATE UNIQUE INDEX players_pubg_player_id_unique
  ON players (pubg_player_id) WHERE pubg_player_id IS NOT NULL;
CREATE UNIQUE INDEX players_free_fire_uid_unique
  ON players (free_fire_uid) WHERE free_fire_uid IS NOT NULL;
CREATE INDEX players_is_suspended_idx
  ON players (is_suspended) WHERE is_suspended = true;
CREATE INDEX players_false_vote_count_idx
  ON players (false_vote_count) WHERE false_vote_count > 0;
```

**Key Fields:**
- `wallet_address`: Solana public key, immutable primary identifier
- `skill_rating`: ELO-style rating, starts at 1000
- `total_earnings/spent/wagered`: All tracked in lamports (1 SOL = 1,000,000,000 lamports)
- `lichess_user_id`: Set by OAuth callback — authoritative proof of Lichess account ownership
- `lichess_access_token`: Stored server-side with challenge:write scope, never exposed to clients
- `flagged_for_review / flagged_by / flag_reason`: Set by admin actions for moderation queue
- `pubg_player_id / free_fire_uid`: API-verified IDs with UNIQUE partial indexes — two players cannot hold the same game account
- `game_username_bound_at`: JSONB keyed by game name; updated atomically via `merge_game_bound_at` RPC
- `false_vote_count / false_claim_count / moderator_abuse_count`: Incremented by edge functions; drive punishment escalation logic
- `push_notifications_enabled`: Player opt-in for Web Push background notifications
- `moderation_requests_enabled`: Player opt-in to receive dispute moderation assignments and earn moderator fees
- `moderation_skipped_count`: Atomically incremented (via `increment_moderation_skip_count` RPC) each time this player declines or times out a moderation request. `assign-moderator` orders candidates by this ascending — willing players are prioritised
- `ban_expires_at`: Set by `resolve-wager` `ban_player` action for timed bans. Not automatically cleared — a pg_cron suspension-lift job or admin action is required

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
  game                  game_type NOT NULL,           -- chess | codm | pubg | free_fire
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
  deposit_player_a      BOOLEAN NOT NULL DEFAULT false,
  deposit_player_b      BOOLEAN NOT NULL DEFAULT false,
  tx_signature_a        TEXT,
  tx_signature_b        TEXT,

  -- Voting / Dispute Resolution
  requires_moderator    BOOLEAN DEFAULT false,
  vote_player_a         TEXT REFERENCES players(wallet_address),
  vote_player_b         TEXT REFERENCES players(wallet_address),
  vote_timestamp        TIMESTAMPTZ,
  retract_deadline      TIMESTAMPTZ,

  -- Voting timestamps (v1.5.0)
  vote_a_at             TIMESTAMPTZ,
  vote_b_at             TIMESTAMPTZ,
  vote_deadline         TIMESTAMPTZ,                 -- 5-min window from first vote

  -- Game complete confirmation (v1.5.0)
  game_complete_a         BOOLEAN NOT NULL DEFAULT false,
  game_complete_b         BOOLEAN NOT NULL DEFAULT false,
  game_complete_a_at      TIMESTAMPTZ,
  game_complete_b_at      TIMESTAMPTZ,
  game_complete_deadline  TIMESTAMPTZ,               -- 15 min from first confirmation

  -- Dispute / Moderation (v1.5.0)
  dispute_created_at       TIMESTAMPTZ,
  moderator_wallet         TEXT REFERENCES players(wallet_address) ON DELETE SET NULL,
  moderator_assigned_at    TIMESTAMPTZ,
  moderator_deadline       TIMESTAMPTZ,              -- accepted_at + 10 minutes
  moderator_decision       TEXT,                     -- wallet address | 'draw' | 'cannot_determine'
  moderator_decided_at     TIMESTAMPTZ,
  moderation_skipped_count INT NOT NULL DEFAULT 0,   -- candidates declined/timed out

  -- Grace period (v1.5.0)
  grace_conceded_by        TEXT REFERENCES players(wallet_address) ON DELETE SET NULL,
  grace_conceded_at        TIMESTAMPTZ,

  -- Results
  winner_wallet         TEXT REFERENCES players(wallet_address),
  resolved_at           TIMESTAMPTZ,

  -- Cancellation
  cancelled_at          TIMESTAMPTZ,
  cancelled_by          TEXT REFERENCES players(wallet_address),
  cancel_reason         TEXT,

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

-- v1.5.0 indexes
CREATE INDEX wagers_disputed_idx
  ON wagers (status, dispute_created_at)
  WHERE status = 'disputed';
CREATE INDEX wagers_moderator_wallet_idx
  ON wagers (moderator_wallet)
  WHERE moderator_wallet IS NOT NULL;
```

**Status Flow:**
1. `created` → Waiting for player B to join
2. `joined` → Both players present, enter ready room
3. `voting` → Match in progress (after countdown and BOTH deposits confirmed on-chain)
4. `retractable` → Both votes agree, 15-second retract window open
5. `disputed` → Moderator review needed (votes disagree)
6. `resolved` → Winner determined, payouts processed
7. `cancelled` → Wager cancelled, refunds processed (can occur from `joined` or `voting`)

**Dispute Flow (v1.5.0):**
- On dispute: `dispute_created_at` stamped, `moderation_requests` row created for candidate moderator
- Each declined/timed-out candidate increments `moderation_skipped_count`
- Accepted moderator written to `moderator_wallet` + `moderator_assigned_at`; must decide before `moderator_deadline`
- Decision written to `moderator_decision` + `moderator_decided_at`; triggers resolution
- If a player concedes during the grace window: `grace_conceded_by` + `grace_conceded_at` set, dispute resolves without full moderator flow

---

### 3. **WAGER_TRANSACTIONS**

Immutable ledger of all Solana blockchain transactions.

```sql
CREATE TABLE wager_transactions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wager_id         UUID NOT NULL REFERENCES wagers(id),
  wallet_address   TEXT NOT NULL REFERENCES players(wallet_address),
  tx_type          transaction_type NOT NULL,
  amount_lamports  BIGINT NOT NULL,
  tx_signature     TEXT UNIQUE,
  status           transaction_status DEFAULT 'pending'::transaction_status,
  error_message    TEXT,
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

> ✅ **Type Gap Resolved (v1.8.0):** `wager_messages` is now present in `src/integrations/supabase/types.ts`. The `as any` cast and local `WagerMessage` interface in `useWagerChat.ts` can be removed and replaced with `Tables<'wager_messages'>`.

```sql
CREATE TABLE wager_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wager_id        UUID NOT NULL REFERENCES wagers(id),
  sender_wallet   TEXT NOT NULL,                 -- logical FK to players(wallet_address), no DB constraint
  message         TEXT NOT NULL,
  message_type    TEXT DEFAULT 'chat'
    CHECK (message_type IN ('chat', 'proposal')),
  proposal_data   JSONB,
  proposal_status TEXT
    CHECK (proposal_status IN ('pending', 'accepted', 'rejected')),
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
  mint_address    TEXT NOT NULL UNIQUE,
  owner_wallet    TEXT NOT NULL REFERENCES players(wallet_address),
  name            TEXT NOT NULL,
  tier            nft_tier NOT NULL,      -- bronze | silver | gold | diamond
  metadata_uri    TEXT,
  image_uri       TEXT,
  attributes      JSONB DEFAULT '{}'::jsonb,
  wager_id        UUID REFERENCES wagers(id),
  match_id        BIGINT,
  stake_amount    BIGINT,
  lichess_game_id TEXT,
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
  player_wallet     TEXT NOT NULL REFERENCES players(wallet_address),
  achievement_type  TEXT NOT NULL,
  achievement_value INTEGER,
  nft_mint_address  TEXT REFERENCES nfts(mint_address),
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
  email               TEXT NOT NULL UNIQUE,
  password_hash       TEXT NOT NULL,
  username            TEXT UNIQUE,
  full_name           TEXT,
  bio                 TEXT,
  avatar_url          TEXT,
  ban_reason          TEXT,
  role                admin_role NOT NULL,
  permissions         JSONB NOT NULL,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  is_banned           BOOLEAN NOT NULL DEFAULT false,
  two_factor_enabled  BOOLEAN NOT NULL DEFAULT false,
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
  admin_id       UUID NOT NULL REFERENCES admin_users(id),
  token_hash     TEXT NOT NULL UNIQUE,
  ip_address     TEXT,
  user_agent     TEXT,
  expires_at     TIMESTAMPTZ NOT NULL,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  last_activity  TIMESTAMPTZ,
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
  admin_id               UUID NOT NULL REFERENCES admin_users(id),
  wallet_address         TEXT NOT NULL UNIQUE,
  verification_signature TEXT,
  last_verified          TIMESTAMPTZ,
  verified               BOOLEAN NOT NULL DEFAULT false,
  is_primary             BOOLEAN NOT NULL DEFAULT false,
  verified_at            TIMESTAMPTZ,
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
  admin_id       UUID REFERENCES admin_users(id),
  action_type    TEXT NOT NULL,
  resource_type  TEXT NOT NULL,
  resource_id    TEXT,
  old_values     JSONB,
  new_values     JSONB,
  ip_address     TEXT,
  user_agent     TEXT,
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
  action         TEXT NOT NULL,
  wager_id       UUID REFERENCES wagers(id),
  wallet_address TEXT,                               -- No FK constraint — informational only
  performed_by   TEXT NOT NULL,
  notes          TEXT,
  metadata       JSONB,
  created_at     TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_admin_log_wager   ON admin_logs(wager_id);
CREATE INDEX idx_admin_log_wallet  ON admin_logs(wallet_address);
CREATE INDEX idx_admin_log_created ON admin_logs(created_at DESC);
```

> **Note:** `wallet_address` has no FK constraint in the live DB — confirmed. It is an informational field. Do not rely on it for JOIN integrity.

---

### 12. **ADMIN_NOTES**

Admin notes attached to players or wagers.

```sql
CREATE TABLE admin_notes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_wallet  TEXT REFERENCES players(wallet_address),
  wager_id       UUID REFERENCES wagers(id),
  note           TEXT NOT NULL,
  created_by     TEXT NOT NULL,
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
  player_wallet  TEXT NOT NULL,
  type           TEXT NOT NULL CHECK (type IN (
                   -- Wager lifecycle
                   'wager_joined',
                   'wager_won',
                   'wager_lost',
                   'wager_draw',
                   'wager_cancelled',
                   'game_started',
                   -- Voting / disputes
                   'wager_vote',
                   'wager_disputed',
                   'wager_proposal',
                   -- Chat / social
                   'chat_message',
                   'rematch_challenge',
                   -- Moderation
                   'moderation_request',
                   -- Username system
                   'username_appeal',
                   'username_appeal_resolved',
                   'username_appeal_update',
                   'username_change_request',
                   -- Social (v1.8.0)
                   'feed_reaction',
                   'friend_request',
                   'friend_accepted',
                   'new_follower'
                   -- NOTE: 'wager_declined' is emitted by declineChallenge in secure-wager
                   -- but is not yet handled in useNotifications.ts — pending integration gap
                 )),
  title          TEXT NOT NULL,
  message        TEXT NOT NULL,
  wager_id       UUID REFERENCES wagers(id) ON DELETE CASCADE,
  read           BOOLEAN DEFAULT FALSE,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_player_wallet ON notifications(player_wallet);
CREATE INDEX idx_notifications_read ON notifications(player_wallet, read);

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
- `game_started` — Sent to both players when both deposits confirmed + Lichess game created (chess) or game goes live (others)
- `wager_won` — Sent to winner when game resolves, includes payout amount
- `wager_lost` — Sent to loser when game resolves
- `wager_draw` — Sent to both players on draw/refund
- `wager_cancelled` — Sent to the non-cancelling player when wager is cancelled
- `wager_vote` — Sent when opponent casts or retracts a vote; also used for "votes agree / 15s window" alerts
- `wager_disputed` — Sent to both players when votes mismatch or vote timer expires
- `wager_proposal` — Sent when opponent proposes a wager edit in the ready room
- `chat_message` — Sent when opponent sends a ready room chat message (rate-limited: 1 per 5 min per wager)
- `rematch_challenge` — Sent when a player challenges opponent to a rematch on an open wager
- `moderation_request` — Sent to the selected moderator candidate by `assign-moderator`; triggers `ModerationRequestModal`
- `username_appeal` — Sent to the holder when a claimant files a username appeal
- `username_appeal_resolved` — Sent to both parties when an appeal is resolved (release or rejection)
- `username_appeal_update` — Sent to both parties when holder contests (appeal enters moderator review)
- `username_change_request` — Sent to the requesting player confirming their change request was received
- `feed_reaction` — Sent to wager owner when a viewer reacts to their feed post (10-minute digest guard prevents spam)
- `friend_request` — Sent when another player sends a friend request
- `friend_accepted` — Sent when a pending friend request is accepted by the recipient
- `new_follower` — Sent when another player follows your profile

> **Known gap:** `wager_declined` is emitted by `declineChallenge` in `secure-wager` but is not yet handled in `useNotifications.ts` — insert will succeed (type is not in the CHECK) but the notification will not appear in the bell dropdown until the hook is updated.

**Realtime:** Frontend subscribes to `postgres_changes` on `notifications` filtered by `player_wallet`. New rows appear instantly in the bell icon dropdown without refresh.

---

### 14. **PUSH_SUBSCRIPTIONS**

Web Push API subscriptions for background notifications (RFC 8291 / VAPID).

```sql
CREATE TABLE push_subscriptions (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_wallet TEXT NOT NULL,         -- No FK constraint — RLS only
  endpoint      TEXT NOT NULL UNIQUE,
  p256dh        TEXT NOT NULL,
  auth          TEXT NOT NULL,
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
- VAPID signing is handled server-side using `VAPID_PRIVATE_KEY` / `VAPID_PUBLIC_KEY` edge function secrets
- The `upsert(..., { onConflict: 'endpoint' })` pattern in `useNotifications.ts` means re-subscribing a device updates the row rather than duplicating it

---

### 15. **RATE_LIMIT_LOGS**

Sliding-window rate limiter keyed on wallet + endpoint.

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

### 16. **MODERATION_REQUESTS** *(v1.5.0)*

Every attempt to assign a moderator to a disputed wager is a separate row. Multiple rows can exist per wager (chain of rejections/timeouts).

```sql
CREATE TABLE IF NOT EXISTS moderation_requests (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  wager_id          UUID        NOT NULL REFERENCES wagers(id) ON DELETE CASCADE,
  moderator_wallet  TEXT        NOT NULL REFERENCES players(wallet_address) ON DELETE CASCADE,
  request_type      TEXT        NOT NULL DEFAULT 'dispute',
  -- 'dispute' | 'username_ownership'
  -- NOTE: assign-moderator inserts 'dispute' (not 'match_dispute').
  -- The schema previously documented 'match_dispute' — 'dispute' is what the live code sends.
  status            TEXT        NOT NULL DEFAULT 'pending',
  -- 'pending' | 'accepted' | 'rejected' | 'timed_out' | 'completed' | 'cancelled'
  assigned_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at      TIMESTAMPTZ,
  deadline          TIMESTAMPTZ NOT NULL,        -- 20 seconds to accept/reject
  decision_deadline TIMESTAMPTZ,                 -- once accepted, 10 minutes to decide
  decision          TEXT,                        -- player wallet | 'draw' | 'cannot_determine'
  decision_notes    TEXT,
  decided_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mod_requests_wager
  ON moderation_requests (wager_id);
CREATE INDEX IF NOT EXISTS idx_mod_requests_moderator
  ON moderation_requests (moderator_wallet);
CREATE INDEX IF NOT EXISTS idx_mod_requests_pending
  ON moderation_requests (deadline)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_mod_requests_accepted
  ON moderation_requests (decision_deadline)
  WHERE status = 'accepted';
```

---

### 17. **USERNAME_APPEALS** *(v1.5.0)*

Created when a player tries to bind a game username already held by another player.

```sql
CREATE TABLE IF NOT EXISTS username_appeals (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  claimant_wallet       TEXT        NOT NULL REFERENCES players(wallet_address) ON DELETE CASCADE,
  holder_wallet         TEXT        NOT NULL REFERENCES players(wallet_address) ON DELETE CASCADE,
  game                  TEXT        NOT NULL,   -- 'pubg' | 'codm' | 'free_fire'
  username              TEXT        NOT NULL,
  status                TEXT        NOT NULL DEFAULT 'pending_response',
  -- 'pending_response' | 'released' | 'contested' | 'moderating'
  -- | 'resolved_claimant' | 'resolved_holder' | 'escalated' | 'closed'
  holder_response       TEXT,                   -- 'release' | 'contest'
  holder_responded_at   TIMESTAMPTZ,
  moderator_wallet      TEXT        REFERENCES players(wallet_address) ON DELETE SET NULL,
  moderator_verdict     TEXT,                   -- 'claimant' | 'holder' | 'cannot_determine'
  claimant_evidence_url TEXT,                   -- screenshot / proof URL from claimant
  holder_evidence_url   TEXT,                   -- screenshot / proof URL from holder
  response_deadline     TIMESTAMPTZ NOT NULL,   -- holder has 48 hours to respond
  admin_notes           TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at           TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_username_appeals_claimant
  ON username_appeals (claimant_wallet);
CREATE INDEX IF NOT EXISTS idx_username_appeals_holder
  ON username_appeals (holder_wallet);
CREATE INDEX IF NOT EXISTS idx_username_appeals_status
  ON username_appeals (status)
  WHERE status NOT IN ('resolved_claimant', 'resolved_holder', 'closed');
```

> **Column naming note:** The evidence URL columns are `claimant_evidence_url` / `holder_evidence_url` in the live DB. Earlier migration drafts used `claimant_screenshot_url` / `holder_screenshot_url` — those names are incorrect and should not be referenced in code.

---

### 18. **USERNAME_CHANGE_REQUESTS** *(v1.5.0)*

Formal request to change a bound game username. Reviewed manually by admin.

```sql
CREATE TABLE IF NOT EXISTS username_change_requests (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  player_wallet    TEXT        NOT NULL REFERENCES players(wallet_address) ON DELETE CASCADE,
  game             TEXT        NOT NULL,   -- 'pubg' | 'codm' | 'free_fire'
  old_username     TEXT        NOT NULL,
  new_username     TEXT        NOT NULL,
  reason           TEXT        NOT NULL,
  reason_category  TEXT        NOT NULL,
  -- 'name_changed' | 'account_banned_in_game' | 'entry_error' | 'other'
  status           TEXT        NOT NULL DEFAULT 'pending_review',
  -- 'pending_review' | 'approved' | 'rejected' | 'flagged'
  admin_notes      TEXT,
  reviewed_by      TEXT,                   -- admin email
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_change_requests_player
  ON username_change_requests (player_wallet);
CREATE INDEX IF NOT EXISTS idx_change_requests_status
  ON username_change_requests (status)
  WHERE status = 'pending_review';
```

---

### 19. **PUNISHMENT_LOG** *(v1.5.0)*

Immutable audit trail — one row per punishment event.

```sql
CREATE TABLE IF NOT EXISTS punishment_log (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  player_wallet       TEXT        NOT NULL REFERENCES players(wallet_address) ON DELETE CASCADE,
  wager_id            UUID        REFERENCES wagers(id) ON DELETE SET NULL,
  offense_type        TEXT        NOT NULL,
  -- 'false_vote' | 'username_theft' | 'moderator_abuse' | 'false_username_claim'
  offense_count       INT         NOT NULL,   -- cumulative count AT TIME of this event
  punishment          TEXT        NOT NULL,
  -- 'warning' | 'suspension_1d' | 'suspension_3d' | 'suspension_7d' | 'indefinite_ban'
  punishment_ends_at  TIMESTAMPTZ,            -- NULL for warnings and indefinite bans
  issued_by           TEXT        NOT NULL DEFAULT 'system',
  -- 'system' | admin email | moderator wallet
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_punishment_log_player
  ON punishment_log (player_wallet, created_at DESC);
```

---

### 20. **PLAYER_BEHAVIOUR_LOG** *(v1.5.0)*

Soft event log — no automatic punishments, surfaces patterns for admin review.

```sql
CREATE TABLE IF NOT EXISTS player_behaviour_log (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  player_wallet  TEXT        NOT NULL REFERENCES players(wallet_address) ON DELETE CASCADE,
  event_type     TEXT        NOT NULL,
  -- 'username_bound' | 'username_dispute_filed' | 'username_released_voluntarily'
  -- | 'appeal_filed' | 'appeal_dismissed' | 'appeal_upheld'
  -- | 'dispute_conceded' | 'false_vote' | 'dispute_loss_moderated' | 'dispute_escalated'
  -- | 'change_request_submitted' | 'change_request_approved' | 'change_request_rejected'
  -- | 'moderator_reported' | 'moderator_report_upheld' | 'moderator_report_dismissed'
  -- | 'moderation_no_verdict'  ← written by moderation-timeout when accepted mod misses decision_deadline
  -- | 'verdict_reported'       ← written by /api/moderation/report when a player flags a verdict
  -- | 'suspension_applied' | 'ban_applied'
  related_id     TEXT,       -- wager_id, appeal_id, or request_id (TEXT for flexibility)
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_behaviour_log_player
  ON player_behaviour_log (player_wallet, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_behaviour_log_event_type
  ON player_behaviour_log (event_type, created_at DESC);
```

---

---

### 21. **FEED_REACTIONS** *(v1.8.0)*

Emoji reactions on wager feed entries. One reaction type per wallet per wager — upserted on change.

```sql
CREATE TABLE IF NOT EXISTS feed_reactions (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  wager_id       UUID        NOT NULL REFERENCES wagers(id) ON DELETE CASCADE,
  wallet         TEXT        NOT NULL,    -- logical FK to players(wallet_address)
  reaction_type  TEXT        NOT NULL,
  -- 'fire' | 'skull' | 'goat' | 'eyes'
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (wager_id, wallet)              -- one reaction per player per wager
);

CREATE INDEX idx_feed_reactions_wager ON feed_reactions (wager_id);
```

**Notes:**
- `wallet` has **no DB-level FK constraint** to `players`. Access is enforced by RLS / anon-key auth.
- The UNIQUE constraint on `(wager_id, wallet)` enables safe `upsert(..., { onConflict: 'wager_id,wallet' })` to change a reaction without creating duplicates.
- `reaction_type` is constrained in TypeScript as `'fire' | 'skull' | 'goat' | 'eyes'` — no DB CHECK constraint in the initial migration, so invalid values must be rejected at the API layer.

---

### 22. **FRIENDSHIPS** *(v1.8.0)*

Friend requests and social connections between players.

```sql
CREATE TABLE IF NOT EXISTS friendships (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_wallet TEXT        NOT NULL,   -- player who sent the request
  recipient_wallet TEXT        NOT NULL,   -- player who received the request
  status           TEXT        NOT NULL DEFAULT 'pending',
  -- 'pending' | 'accepted' | 'blocked'
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (requester_wallet, recipient_wallet)
);

CREATE INDEX idx_friendships_requester ON friendships (requester_wallet);
CREATE INDEX idx_friendships_recipient ON friendships (recipient_wallet);
CREATE INDEX idx_friendships_status    ON friendships (status) WHERE status = 'accepted';
```

**Notes:**
- `requester_wallet` and `recipient_wallet` have **no DB-level FK constraints** — confirmed by empty `Relationships` array in `types.ts`. Access enforced by RLS.
- The UNIQUE constraint on `(requester_wallet, recipient_wallet)` is directional — `(A→B)` and `(B→A)` are separate rows. Query both directions when checking friendship status.
- `useFriends.ts` queries all three statuses separately: `accepted` for the friends list, `pending` for incoming requests, and all for status lookups.

**Status Flow:**
1. `pending` — Request sent, awaiting recipient acceptance
2. `accepted` — Mutual friends; DMs unlocked
3. `blocked` — Either party blocked the other

---

### 23. **DIRECT_MESSAGES** *(v1.8.0)*

DM messages between friended players, keyed by a shared `channel_id`.

```sql
CREATE TABLE IF NOT EXISTS direct_messages (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id    TEXT        NOT NULL,    -- deterministic key: sorted([walletA, walletB]).join(':')
  sender_wallet TEXT        NOT NULL,   -- logical FK to players(wallet_address)
  message       TEXT        NOT NULL,
  read_at       TIMESTAMPTZ,            -- NULL = unread by recipient
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dm_channel    ON direct_messages (channel_id, created_at ASC);
CREATE INDEX idx_dm_sender     ON direct_messages (sender_wallet);
CREATE INDEX idx_dm_unread     ON direct_messages (channel_id, read_at) WHERE read_at IS NULL;
```

**Notes:**
- `channel_id` is constructed client-side as `[walletA, walletB].sort().join(':')` — alphabetical sort ensures both parties derive the same key regardless of who initiates.
- No FK constraints on either `channel_id` or `sender_wallet` — the table is accessed via RLS-protected client queries.
- `read_at` is set when the recipient opens the conversation. The partial index on `(channel_id, read_at) WHERE read_at IS NULL` supports fast unread-count queries.

---

### 24. **SPECTATOR_BETS** *(v1.8.0)*

Side-bets placed by spectators on active wagers. Supports a peer-to-peer counter-bet model.

```sql
CREATE TABLE IF NOT EXISTS spectator_bets (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  wager_id        UUID        NOT NULL REFERENCES wagers(id) ON DELETE CASCADE,
  bettor_wallet   TEXT        NOT NULL,   -- player who opened the bet
  backer_wallet   TEXT,                  -- player who countered (NULL until matched)
  backed_player   TEXT        NOT NULL,
  -- 'player_a' | 'player_b'
  amount_lamports BIGINT      NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'open',
  -- 'open' | 'countered' | 'matched' | 'expired' | 'resolved' | 'cancelled'
  counter_amount  BIGINT,                -- backer's counter-stake (may differ from bettor's)
  tx_signature    TEXT,                  -- on-chain escrow tx (when matched)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  matched_at      TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,           -- open bets expire if unmatched
  resolved_at     TIMESTAMPTZ
);

CREATE INDEX idx_spectator_bets_wager  ON spectator_bets (wager_id);
CREATE INDEX idx_spectator_bets_bettor ON spectator_bets (bettor_wallet);
CREATE INDEX idx_spectator_bets_open   ON spectator_bets (wager_id, status) WHERE status = 'open';
```

**Notes:**
- `bettor_wallet` and `backer_wallet` have **no DB-level FK constraints** — confirmed by `Relationships` in `types.ts` only containing the `wager_id` FK.
- The `counter_amount` allows asymmetric odds — e.g. bettor risks 0.1 SOL, backer risks 0.05 SOL at 2:1 odds.
- `spectator_bets` is fully wired as of v1.8.0. The primary hook is `useSideBets.ts` (local interface — table is not yet in auto-generated `types.ts`, see Known Issues). `useSpectatorCount` in `useFeed.ts` reads the count only. Place/counter/accept/cancel flow and auto-resolve on wager end are all implemented per the v1.8.0 roadmap.

---

### Table 25: FOLLOWS *(v1.8.0)*

```sql
CREATE TABLE IF NOT EXISTS follows (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_wallet  TEXT        NOT NULL,   -- player who followed
  following_wallet TEXT        NOT NULL,   -- player being followed
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (follower_wallet, following_wallet)
);

CREATE INDEX idx_follows_follower  ON follows (follower_wallet);
CREATE INDEX idx_follows_following ON follows (following_wallet);
```

**Notes:**
- `follower_wallet` and `following_wallet` have **no DB-level FK constraints** — access enforced by RLS policies only.
- Distinct from `friendships`: follows are **asymmetric and immediate** (no request/approval step). Player A can follow Player B without Player B following back.
- Realtime is enabled on the `follows` table. `useFollows.ts` subscribes to the channel `follows:{walletAddress}` filtered by `following_wallet=eq.{wallet}` to keep follower/following counts in sync.
- Run `ALTER PUBLICATION supabase_realtime ADD TABLE follows;` after applying the migration if the table was created after the initial Realtime setup.


## DB Functions (RPC)

These are callable via `.rpc()` on the Supabase client. Confirmed live in `information_schema.routines`.

### `set_player_ready`
Atomically toggles a player's ready state and handles countdown logic.

```sql
-- Args
p_wager_id    uuid
p_is_player_a boolean
p_ready       boolean

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

### `increment_moderation_skip_count` *(April 2, 2026)*
Atomically increments `moderation_skipped_count` on a player row by 1. Used by `moderation-timeout` and `decline/route.ts` to penalise moderators who time out or decline. Replaces the previous read-then-write pattern which had a race condition under concurrent cron execution.

```sql
create or replace function increment_moderation_skip_count(p_wallet text)
returns void language sql as $$
  update players set moderation_skipped_count = moderation_skipped_count + 1
  where wallet_address = p_wallet;
$$;
```

```typescript
// Usage from edge function or API route
await supabase.rpc('increment_moderation_skip_count', { p_wallet: walletAddress });
```

> **No permissions restriction** — callable by service role only in practice since all callers are server-side functions. Unlike `merge_game_bound_at`, no explicit REVOKE is needed as anon clients have no path to call this directly.

---

### `merge_game_bound_at`
Merges a single game key into the `game_username_bound_at` JSONB column without overwriting other keys. Only callable by the service role.

```sql
-- Args
p_wallet text   -- player's wallet_address
p_game   text   -- 'pubg' | 'codm' | 'free_fire'
p_ts     text   -- ISO 8601 timestamp string

-- Returns: void
```

Called by `secure-player` after a game username is successfully bound. Uses the `||` JSONB merge operator so binding `pubg` does not erase an existing `codm` key.

```sql
-- Usage from edge function
supabase.rpc('merge_game_bound_at', {
  p_wallet: 'So1ana...',
  p_game:   'pubg',
  p_ts:     '2026-03-25T12:00:00Z'
})
```

> **Permissions:** `REVOKE ALL ... FROM PUBLIC; GRANT EXECUTE ... TO service_role` — anon key cannot call this function directly.

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
| `moderation_requests` | INSERT | `GameEventContext` — filtered by `moderator_wallet=eq.{wallet}`, triggers moderator popup |
| `wager_messages` | INSERT, UPDATE | Ready room chat and proposals, filtered by `wager_id` — **one subscription per wager per client** |
| `follows` | INSERT, DELETE | `useFollows` — filtered by `following_wallet=eq.{wallet}`; invalidates follower/following query cache |

> **Migration required:** Run `ALTER PUBLICATION supabase_realtime ADD TABLE moderation_requests;` in the SQL editor if this table was created after the initial Realtime setup. Without this, `GameEventContext`'s moderator popup subscription will never fire.

Tables **not** in realtime: `players`, `admin_*`, `push_subscriptions`, `rate_limit_logs`, `nfts`, `achievements`, `username_appeals`, `username_change_requests`, `punishment_log`, `player_behaviour_log`, `feed_reactions`, `friendships`, `spectator_bets`.

> **Note on `direct_messages`:** Not yet in the realtime publication as of v1.8.0. The `messages` page in `useDirectMessages.ts` currently polls rather than subscribing. Add `ALTER PUBLICATION supabase_realtime ADD TABLE direct_messages;` when adding realtime DM delivery.

---

## Indexes & Performance

### Complete Index List (live DB, v1.8.0)

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
| `moderation_requests` | `moderation_requests_pkey` | UNIQUE btree (id) |
| `moderation_requests` | `idx_mod_requests_wager` | btree (wager_id) |
| `moderation_requests` | `idx_mod_requests_moderator` | btree (moderator_wallet) |
| `moderation_requests` | `idx_mod_requests_pending` | btree (deadline) WHERE status = 'pending' |
| `moderation_requests` | `idx_mod_requests_accepted` | btree (decision_deadline) WHERE status = 'accepted' |
| `nfts` | `nfts_pkey` | UNIQUE btree (id) |
| `nfts` | `nfts_mint_address_key` | UNIQUE btree (mint_address) |
| `nfts` | `idx_nft_owner` | btree (owner_wallet) |
| `nfts` | `idx_nft_wager` | btree (wager_id) |
| `nfts` | `idx_nft_mint` | btree (mint_address) |
| `notifications` | `notifications_pkey` | UNIQUE btree (id) |
| `notifications` | `idx_notifications_player_wallet` | btree (player_wallet) |
| `notifications` | `idx_notifications_read` | btree (player_wallet, read) |
| `player_behaviour_log` | `player_behaviour_log_pkey` | UNIQUE btree (id) |
| `player_behaviour_log` | `idx_behaviour_log_player` | btree (player_wallet, created_at DESC) |
| `player_behaviour_log` | `idx_behaviour_log_event_type` | btree (event_type, created_at DESC) |
| `players` | `players_pkey` | UNIQUE btree (id) |
| `players` | `players_wallet_address_key` | UNIQUE btree (wallet_address) |
| `players` | `players_username_key` | UNIQUE btree (username) |
| `players` | `players_pubg_player_id_unique` | UNIQUE btree (pubg_player_id) WHERE pubg_player_id IS NOT NULL |
| `players` | `players_free_fire_uid_unique` | UNIQUE btree (free_fire_uid) WHERE free_fire_uid IS NOT NULL |
| `players` | `idx_players_wallet` | btree (wallet_address) |
| `players` | `idx_players_username` | btree (username) |
| `players` | `idx_players_created` | btree (created_at DESC) |
| `players` | `players_is_suspended_idx` | btree (is_suspended) WHERE is_suspended = true |
| `players` | `players_false_vote_count_idx` | btree (false_vote_count) WHERE false_vote_count > 0 |
| `punishment_log` | `punishment_log_pkey` | UNIQUE btree (id) |
| `punishment_log` | `idx_punishment_log_player` | btree (player_wallet, created_at DESC) |
| `push_subscriptions` | `push_subscriptions_pkey` | UNIQUE btree (id) |
| `push_subscriptions` | `push_subscriptions_endpoint_key` | UNIQUE btree (endpoint) |
| `push_subscriptions` | `idx_push_subscriptions_wallet` | btree (player_wallet) |
| `rate_limit_logs` | `rate_limit_logs_pkey` | UNIQUE btree (id) |
| `username_appeals` | `username_appeals_pkey` | UNIQUE btree (id) |
| `username_appeals` | `idx_username_appeals_claimant` | btree (claimant_wallet) |
| `username_appeals` | `idx_username_appeals_holder` | btree (holder_wallet) |
| `username_appeals` | `idx_username_appeals_status` | btree (status) WHERE status NOT IN ('resolved_claimant', 'resolved_holder', 'closed') |
| `username_change_requests` | `username_change_requests_pkey` | UNIQUE btree (id) |
| `username_change_requests` | `idx_change_requests_player` | btree (player_wallet) |
| `username_change_requests` | `idx_change_requests_status` | btree (status) WHERE status = 'pending_review' |
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
| `wagers` | `wagers_disputed_idx` | btree (status, dispute_created_at) WHERE status = 'disputed' |
| `wagers` | `wagers_moderator_wallet_idx` | btree (moderator_wallet) WHERE moderator_wallet IS NOT NULL |
| `feed_reactions` | `feed_reactions_pkey` | UNIQUE btree (id) |
| `feed_reactions` | `feed_reactions_wager_id_wallet_key` | UNIQUE btree (wager_id, wallet) |
| `feed_reactions` | `idx_feed_reactions_wager` | btree (wager_id) |
| `friendships` | `friendships_pkey` | UNIQUE btree (id) |
| `friendships` | `friendships_requester_wallet_recipient_wallet_key` | UNIQUE btree (requester_wallet, recipient_wallet) |
| `friendships` | `idx_friendships_requester` | btree (requester_wallet) |
| `friendships` | `idx_friendships_recipient` | btree (recipient_wallet) |
| `friendships` | `idx_friendships_status` | btree (status) WHERE status = 'accepted' |
| `direct_messages` | `direct_messages_pkey` | UNIQUE btree (id) |
| `direct_messages` | `idx_dm_channel` | btree (channel_id, created_at ASC) |
| `direct_messages` | `idx_dm_sender` | btree (sender_wallet) |
| `direct_messages` | `idx_dm_unread` | btree (channel_id, read_at) WHERE read_at IS NULL |
| `spectator_bets` | `spectator_bets_pkey` | UNIQUE btree (id) |
| `spectator_bets` | `idx_spectator_bets_wager` | btree (wager_id) |
| `spectator_bets` | `idx_spectator_bets_bettor` | btree (bettor_wallet) |
| `spectator_bets` | `idx_spectator_bets_open` | btree (wager_id, status) WHERE status = 'open' |
| `follows` | `follows_pkey` | UNIQUE btree (id) |
| `follows` | `follows_follower_wallet_following_wallet_key` | UNIQUE btree (follower_wallet, following_wallet) |
| `follows` | `idx_follows_follower` | btree (follower_wallet) |
| `follows` | `idx_follows_following` | btree (following_wallet) |

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
10. **Game Account Uniqueness**: `pubg_player_id` and `free_fire_uid` have partial UNIQUE indexes — two players cannot hold the same verified game account
11. **Moderator Decision Window**: `moderator_deadline` is set to accepted_at + 10 minutes; cron job times out accepted requests that miss this deadline

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

> After any schema change, regenerate types:
> ```bash
> npx supabase gen types typescript --project-id vqgtwalwvalbephvpxap > src/integrations/supabase/types.ts
> ```

### ✅ Resolved in v1.8.0 (types.ts fully regenerated)

All previously listed gaps have been resolved. The following tables and columns are now fully present in `src/integrations/supabase/types.ts` and no workaround casts are needed:

- `wager_messages` — fully typed; remove the `as any` cast and local `WagerMessage` interface in `useWagerChat.ts`
- `moderation_requests`, `username_appeals`, `username_change_requests`, `punishment_log`, `player_behaviour_log`
- All v1.5.0 player and wager columns (game account binding, punishment tracking, dispute/moderation fields)
- `game_type` enum value `'free_fire'`
- New social/spectator tables: `feed_reactions`, `friendships`, `direct_messages`, `spectator_bets`

### ❌ Active Type Gaps

| Column | Table | Status | Notes |
|--------|-------|--------|-------|
| `ban_expires_at` | `players` | ❌ Not in `types.ts` | Added by v1.7.0 migration SQL and used in `resolve-wager/index.ts` but missing from generated types. Cast to `any` at update site or add manually until next regen. |

---

## Recent Migrations

### v1.8.0 — April 13, 2026

Five new tables for social, feed, and spectator features, plus a `notifications` CHECK constraint expansion. Run in the Supabase SQL editor:

**001 — `feed_reactions`**
```sql
CREATE TABLE IF NOT EXISTS feed_reactions (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  wager_id       UUID        NOT NULL REFERENCES wagers(id) ON DELETE CASCADE,
  wallet         TEXT        NOT NULL,
  reaction_type  TEXT        NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (wager_id, wallet)
);
CREATE INDEX IF NOT EXISTS idx_feed_reactions_wager ON feed_reactions (wager_id);
```

**002 — `friendships`**
```sql
CREATE TABLE IF NOT EXISTS friendships (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_wallet TEXT        NOT NULL,
  recipient_wallet TEXT        NOT NULL,
  status           TEXT        NOT NULL DEFAULT 'pending',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (requester_wallet, recipient_wallet)
);
CREATE INDEX IF NOT EXISTS idx_friendships_requester ON friendships (requester_wallet);
CREATE INDEX IF NOT EXISTS idx_friendships_recipient ON friendships (recipient_wallet);
CREATE INDEX IF NOT EXISTS idx_friendships_status    ON friendships (status) WHERE status = 'accepted';
```

**003 — `direct_messages`**
```sql
CREATE TABLE IF NOT EXISTS direct_messages (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id    TEXT        NOT NULL,
  sender_wallet TEXT        NOT NULL,
  message       TEXT        NOT NULL,
  read_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dm_channel ON direct_messages (channel_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_dm_sender  ON direct_messages (sender_wallet);
CREATE INDEX IF NOT EXISTS idx_dm_unread  ON direct_messages (channel_id, read_at) WHERE read_at IS NULL;
```

**004 — `spectator_bets`**
```sql
CREATE TABLE IF NOT EXISTS spectator_bets (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  wager_id        UUID        NOT NULL REFERENCES wagers(id) ON DELETE CASCADE,
  bettor_wallet   TEXT        NOT NULL,
  backer_wallet   TEXT,
  backed_player   TEXT        NOT NULL,
  amount_lamports BIGINT      NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'open',
  counter_amount  BIGINT,
  tx_signature    TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  matched_at      TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  resolved_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_spectator_bets_wager  ON spectator_bets (wager_id);
CREATE INDEX IF NOT EXISTS idx_spectator_bets_bettor ON spectator_bets (bettor_wallet);
CREATE INDEX IF NOT EXISTS idx_spectator_bets_open   ON spectator_bets (wager_id, status) WHERE status = 'open';
```

**005 — `follows`**
```sql
CREATE TABLE IF NOT EXISTS follows (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_wallet  TEXT        NOT NULL,
  following_wallet TEXT        NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (follower_wallet, following_wallet)
);
CREATE INDEX IF NOT EXISTS idx_follows_follower  ON follows (follower_wallet);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows (following_wallet);
ALTER PUBLICATION supabase_realtime ADD TABLE follows;
```

**006 — Regenerate TypeScript types** *(clears all previously listed type gaps)*
```bash
npx supabase gen types typescript --project-id vqgtwalwvalbephvpxap > src/integrations/supabase/types.ts
```

**007 — Expand `notifications.type` CHECK constraint to include social types**
```sql
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'wager_joined', 'wager_won', 'wager_lost', 'wager_draw',
    'wager_cancelled', 'game_started',
    'wager_vote', 'wager_disputed', 'wager_proposal',
    'chat_message', 'rematch_challenge',
    'moderation_request',
    'username_appeal', 'username_appeal_resolved',
    'username_appeal_update', 'username_change_request',
    'feed_reaction', 'friend_request', 'friend_accepted', 'new_follower'
  ));
```

---

### v1.7.0 — April 3, 2026

Run in the Supabase SQL editor:

**001 — `players` new columns**
```sql
-- Timed ban expiry (resolve-wager ban_player action)
ALTER TABLE players ADD COLUMN IF NOT EXISTS ban_expires_at TIMESTAMPTZ;

-- Moderator skip tracking — incremented atomically via increment_moderation_skip_count RPC
ALTER TABLE players ADD COLUMN IF NOT EXISTS moderation_skipped_count INT NOT NULL DEFAULT 0;
```

**002 — `increment_moderation_skip_count` RPC** *(if not already created from the April 2 hotfix)*
```sql
CREATE OR REPLACE FUNCTION increment_moderation_skip_count(p_wallet text)
RETURNS void LANGUAGE sql AS $$
  UPDATE players SET moderation_skipped_count = moderation_skipped_count + 1
  WHERE wallet_address = p_wallet;
$$;
```

**003 — Expand `notifications.type` CHECK constraint**

The existing CHECK constraint only covers the original 6 types. Nine more types are inserted by the codebase. Drop and recreate:
```sql
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'wager_joined', 'wager_won', 'wager_lost', 'wager_draw',
    'wager_cancelled', 'game_started',
    'wager_vote', 'wager_disputed', 'wager_proposal',
    'chat_message', 'rematch_challenge',
    'moderation_request',
    'username_appeal', 'username_appeal_resolved',
    'username_appeal_update', 'username_change_request'
  ));
```

**004 — Enable `moderation_requests` in Realtime publication**
```sql
-- Only needed if the table was created before Realtime was configured for it
ALTER PUBLICATION supabase_realtime ADD TABLE moderation_requests;
```

**005 — Fix `moderation_requests.request_type` default** *(if table already exists with wrong default)*
```sql
ALTER TABLE moderation_requests
  ALTER COLUMN request_type SET DEFAULT 'dispute';
```

---

### v1.5.0 — March 25, 2026

Run all 5 blocks IN ORDER in the Supabase SQL editor:
`https://supabase.com/dashboard/project/vqgtwalwvalbephvpxap/sql`

**001 — Player columns**
```sql
-- Game account binding
ALTER TABLE players ADD COLUMN IF NOT EXISTS pubg_player_id            TEXT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS free_fire_username        TEXT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS free_fire_uid             TEXT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS codm_player_id            TEXT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS game_username_bound_at    JSONB DEFAULT '{}';
-- Punishment tracking
ALTER TABLE players ADD COLUMN IF NOT EXISTS is_suspended              BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE players ADD COLUMN IF NOT EXISTS suspension_ends_at        TIMESTAMPTZ;
ALTER TABLE players ADD COLUMN IF NOT EXISTS false_vote_count          INT NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS false_claim_count         INT NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS moderator_abuse_count     INT NOT NULL DEFAULT 0;
-- Settings
ALTER TABLE players ADD COLUMN IF NOT EXISTS push_notifications_enabled    BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE players ADD COLUMN IF NOT EXISTS moderation_requests_enabled   BOOLEAN NOT NULL DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS players_pubg_player_id_unique
  ON players (pubg_player_id) WHERE pubg_player_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS players_free_fire_uid_unique
  ON players (free_fire_uid) WHERE free_fire_uid IS NOT NULL;
CREATE INDEX IF NOT EXISTS players_is_suspended_idx
  ON players (is_suspended) WHERE is_suspended = true;
CREATE INDEX IF NOT EXISTS players_false_vote_count_idx
  ON players (false_vote_count) WHERE false_vote_count > 0;
```

**002 — Wager columns**
```sql
-- Game complete confirmation
ALTER TABLE wagers ADD COLUMN IF NOT EXISTS game_complete_a          BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE wagers ADD COLUMN IF NOT EXISTS game_complete_b          BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE wagers ADD COLUMN IF NOT EXISTS game_complete_a_at       TIMESTAMPTZ;
ALTER TABLE wagers ADD COLUMN IF NOT EXISTS game_complete_b_at       TIMESTAMPTZ;
ALTER TABLE wagers ADD COLUMN IF NOT EXISTS game_complete_deadline    TIMESTAMPTZ;
-- Voting timestamps
ALTER TABLE wagers ADD COLUMN IF NOT EXISTS vote_a_at                TIMESTAMPTZ;
ALTER TABLE wagers ADD COLUMN IF NOT EXISTS vote_b_at                TIMESTAMPTZ;
ALTER TABLE wagers ADD COLUMN IF NOT EXISTS vote_deadline             TIMESTAMPTZ;
-- Dispute / moderation
ALTER TABLE wagers ADD COLUMN IF NOT EXISTS dispute_created_at        TIMESTAMPTZ;
ALTER TABLE wagers ADD COLUMN IF NOT EXISTS moderator_wallet          TEXT REFERENCES players(wallet_address) ON DELETE SET NULL;
ALTER TABLE wagers ADD COLUMN IF NOT EXISTS moderator_assigned_at     TIMESTAMPTZ;
ALTER TABLE wagers ADD COLUMN IF NOT EXISTS moderator_deadline        TIMESTAMPTZ;
ALTER TABLE wagers ADD COLUMN IF NOT EXISTS moderator_decision        TEXT;
ALTER TABLE wagers ADD COLUMN IF NOT EXISTS moderator_decided_at      TIMESTAMPTZ;
ALTER TABLE wagers ADD COLUMN IF NOT EXISTS moderation_skipped_count  INT NOT NULL DEFAULT 0;
-- Grace period
ALTER TABLE wagers ADD COLUMN IF NOT EXISTS grace_conceded_by         TEXT REFERENCES players(wallet_address) ON DELETE SET NULL;
ALTER TABLE wagers ADD COLUMN IF NOT EXISTS grace_conceded_at         TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS wagers_disputed_idx
  ON wagers (status, dispute_created_at) WHERE status = 'disputed';
CREATE INDEX IF NOT EXISTS wagers_moderator_wallet_idx
  ON wagers (moderator_wallet) WHERE moderator_wallet IS NOT NULL;
```

**003 — New supporting tables**
```sql
-- moderation_requests
CREATE TABLE IF NOT EXISTS moderation_requests (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  wager_id          UUID        NOT NULL REFERENCES wagers(id) ON DELETE CASCADE,
  moderator_wallet  TEXT        NOT NULL REFERENCES players(wallet_address) ON DELETE CASCADE,
  request_type      TEXT        NOT NULL DEFAULT 'match_dispute',
  status            TEXT        NOT NULL DEFAULT 'pending',
  assigned_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at      TIMESTAMPTZ,
  deadline          TIMESTAMPTZ NOT NULL,
  decision_deadline TIMESTAMPTZ,
  decision          TEXT,
  decision_notes    TEXT,
  decided_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mod_requests_wager      ON moderation_requests (wager_id);
CREATE INDEX IF NOT EXISTS idx_mod_requests_moderator  ON moderation_requests (moderator_wallet);
CREATE INDEX IF NOT EXISTS idx_mod_requests_pending    ON moderation_requests (deadline) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_mod_requests_accepted   ON moderation_requests (decision_deadline) WHERE status = 'accepted';

-- username_appeals
CREATE TABLE IF NOT EXISTS username_appeals (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  claimant_wallet       TEXT        NOT NULL REFERENCES players(wallet_address) ON DELETE CASCADE,
  holder_wallet         TEXT        NOT NULL REFERENCES players(wallet_address) ON DELETE CASCADE,
  game                  TEXT        NOT NULL,
  username              TEXT        NOT NULL,
  status                TEXT        NOT NULL DEFAULT 'pending_response',
  holder_response       TEXT,
  holder_responded_at   TIMESTAMPTZ,
  moderator_wallet      TEXT        REFERENCES players(wallet_address) ON DELETE SET NULL,
  moderator_verdict     TEXT,
  claimant_evidence_url TEXT,
  holder_evidence_url   TEXT,
  response_deadline     TIMESTAMPTZ NOT NULL,
  admin_notes           TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at           TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_username_appeals_claimant ON username_appeals (claimant_wallet);
CREATE INDEX IF NOT EXISTS idx_username_appeals_holder   ON username_appeals (holder_wallet);
CREATE INDEX IF NOT EXISTS idx_username_appeals_status
  ON username_appeals (status)
  WHERE status NOT IN ('resolved_claimant', 'resolved_holder', 'closed');

-- username_change_requests
CREATE TABLE IF NOT EXISTS username_change_requests (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  player_wallet    TEXT        NOT NULL REFERENCES players(wallet_address) ON DELETE CASCADE,
  game             TEXT        NOT NULL,
  old_username     TEXT        NOT NULL,
  new_username     TEXT        NOT NULL,
  reason           TEXT        NOT NULL,
  reason_category  TEXT        NOT NULL,
  status           TEXT        NOT NULL DEFAULT 'pending_review',
  admin_notes      TEXT,
  reviewed_by      TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_change_requests_player ON username_change_requests (player_wallet);
CREATE INDEX IF NOT EXISTS idx_change_requests_status
  ON username_change_requests (status) WHERE status = 'pending_review';

-- punishment_log
CREATE TABLE IF NOT EXISTS punishment_log (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  player_wallet       TEXT        NOT NULL REFERENCES players(wallet_address) ON DELETE CASCADE,
  wager_id            UUID        REFERENCES wagers(id) ON DELETE SET NULL,
  offense_type        TEXT        NOT NULL,
  offense_count       INT         NOT NULL,
  punishment          TEXT        NOT NULL,
  punishment_ends_at  TIMESTAMPTZ,
  issued_by           TEXT        NOT NULL DEFAULT 'system',
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_punishment_log_player
  ON punishment_log (player_wallet, created_at DESC);

-- player_behaviour_log
CREATE TABLE IF NOT EXISTS player_behaviour_log (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  player_wallet  TEXT        NOT NULL REFERENCES players(wallet_address) ON DELETE CASCADE,
  event_type     TEXT        NOT NULL,
  related_id     TEXT,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_behaviour_log_player
  ON player_behaviour_log (player_wallet, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_behaviour_log_event_type
  ON player_behaviour_log (event_type, created_at DESC);
```

**004 — Add `free_fire` to `game_type` enum**
```sql
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'free_fire'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'game_type')
  ) THEN
    ALTER TYPE game_type ADD VALUE 'free_fire';
  END IF;
END$$;
```

**005 — `merge_game_bound_at` RPC (service role only)**
```sql
CREATE OR REPLACE FUNCTION merge_game_bound_at(
  p_wallet TEXT,
  p_game   TEXT,
  p_ts     TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE players
  SET game_username_bound_at = game_username_bound_at || jsonb_build_object(p_game, p_ts)
  WHERE wallet_address = p_wallet;
END;
$$;

REVOKE ALL ON FUNCTION merge_game_bound_at(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION merge_game_bound_at(TEXT, TEXT, TEXT) TO service_role;
```

---

### v1.4.0 — March 22, 2026

```sql
-- Wager chat and edit proposals
CREATE TABLE IF NOT EXISTS wager_messages ( ... );
ALTER PUBLICATION supabase_realtime ADD TABLE wager_messages;

-- Rate limiting
CREATE TABLE IF NOT EXISTS rate_limit_logs ( ... );
```

---

### v1.3.0 — March 21, 2026

```sql
-- Push subscriptions for Web Push notifications
CREATE TABLE IF NOT EXISTS push_subscriptions ( ... );
```

---

### v1.2.0 — March 21, 2026

```sql
-- Notifications table for real-time in-app alerts
CREATE TABLE IF NOT EXISTS notifications ( ... );

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
  dispute_created_at,
  moderator_wallet,
  moderator_deadline,
  moderation_skipped_count,
  created_at
FROM wagers
WHERE status = 'disputed'
ORDER BY dispute_created_at ASC;
```

### Active Moderation Requests (cron timeout checker)

```sql
SELECT id, wager_id, moderator_wallet, deadline, status
FROM moderation_requests
WHERE status = 'pending'
  AND deadline < NOW()
ORDER BY deadline ASC;
```

### Punishment History for a Player

```sql
SELECT
  offense_type,
  offense_count,
  punishment,
  punishment_ends_at,
  issued_by,
  notes,
  created_at
FROM punishment_log
WHERE player_wallet = $1
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

Last updated: April 13, 2026 — v1.8.0