---
title: GameGambit API Reference
description: Complete API documentation for GameGambit backend endpoints
---

# GameGambit API Reference

## Overview

GameGambit provides a REST API and a set of Supabase edge functions for managing wagers, players, social features, side bets, and admin functions on Solana.

**Two authentication methods:**
- **Player API** — Wallet session token (`X-Session-Token` header) issued by `verify-wallet`
- **Admin API** — JWT bearer token issued by `/api/admin/auth/login`

---

## Authentication

### Player Session Token

All player-facing edge function calls require a wallet session token:

```http
X-Session-Token: <session_token>
Content-Type: application/json
```

Session tokens are Ed25519 wallet signatures issued by `verify-wallet` and managed by `useWalletAuth`. They expire and trigger a `gg:session-expired` custom DOM event when stale.

### Admin JWT

Admin panel routes require a JWT in the `Authorization` header or as an httpOnly cookie (set automatically on login):

```http
Authorization: Bearer <admin_jwt>
Content-Type: application/json
```

---

## Rate Limiting

Per-wallet sliding window via `rate_limit_logs`:

| Endpoint Type | Window | Max Requests |
|---|---|---|
| Public | 60s | 100 |
| API | 60s | 50 |
| Auth | 15 min | 5 |
| Wager creation | 60s | 10 |

`notifyChat` additionally enforces 1 push notification per wager per 5 minutes at the application level.

---

## Base URLs

```
App:           https://thegamegambit.vercel.app
API routes:    https://thegamegambit.vercel.app/api
Edge functions: https://<project>.supabase.co/functions/v1
```

> **Twitch stream embeds require `NEXT_PUBLIC_APP_DOMAIN`** to be set in your environment. This value is passed as the `parent` parameter in the Twitch player iframe URL. Without it, Twitch embeds fail silently on custom domains and Vercel preview URLs (which have random subdomains). Falls back to `window.location.hostname` for local dev. Set it to your production domain with no `https://` prefix and no trailing slash (e.g. `thegamegambit.vercel.app`).

---

## Edge Functions

### `secure-wager`

All wager lifecycle actions. Requires `X-Session-Token`.

| Action | Auth | Who Can Call | Description |
|--------|------|--------------|-------------|
| `create` | ✅ | Any player | INSERT new wager, create on-chain PDA |
| `join` | ✅ | Any player (not owner) | UPDATE status → joined |
| `vote` | ✅ | Either participant | Legacy vote action — kept for compatibility with older clients. **All new code must use `submitVote`** |
| `edit` | ✅ | Player A only | UPDATE stake/stream_url/is_public (status = created only) |
| `applyProposal` | ✅ | Either participant | Apply accepted proposal — bypasses owner-only restriction |
| `notifyChat` | ✅ | Either participant | INSERT notification to opponent (rate-limited: 1/5min/wager) |
| `notifyProposal` | ✅ | Either participant | INSERT notification to opponent for new proposals |
| `notifyRematch` | ✅ | Either participant | Send push notification for a rematch request |
| `delete` | ✅ | Player A only | DELETE wager (status = created only) |
| `setReady` | ✅ | Either participant | Calls `set_player_ready` DB RPC |
| `startGame` | ✅ | Either participant | UPDATE status → voting; creates Lichess game (chess) |
| `recordOnChainCreate` | ✅ | Player A only | UPDATE deposit_player_a = true, tx_signature_a |
| `recordOnChainJoin` | ✅ | Player B only | UPDATE deposit_player_b = true, tx_signature_b |
| `checkGameComplete` | ❌ | Cron only | Poll Lichess API for chess game result. **No auth required** — called by `check-chess-games` cron, not by any user session |
| `cancelWager` | ✅ | Either participant | UPDATE status → cancelled; trigger on-chain refund |
| `concedeDispute` | ✅ | Either participant | Grace period concession; resolves on-chain, no mod fee |
| `markGameComplete` | ✅ | Either participant | Sets game_complete_a/b; when both set, stamps deadlines |
| `submitVote` | ✅ | Either participant | Sets vote_player_a/b; agree → auto-resolve; disagree → disputed |
| `retractVote` | ✅ | Either participant | Clears caller's vote (only while opponent hasn't voted) |
| `finalizeVote` | ✅ | Either participant | Triggers on-chain `resolve_wager` once the 15s retract window expires without a retraction |
| `voteTimeout` | ✅ | Either participant | Called when `vote_deadline` passes with no resolution — sets status → `disputed`, triggers moderator assignment |
| `declineChallenge` | ✅ | Player B only | Soft-deletes an open wager (status = `created` only); fires `wager_declined` notification to Player A |

---

### `secure-player`

Player profile management. Requires `X-Session-Token`.

| Action | Description |
|--------|-------------|
| `create` | INSERT new player row (accepts optional `referrerCode`) |
| `update` | UPDATE player profile fields (username, bio, avatar, game usernames) |
| `bindGame` | Dedicated game account binding for PUBG/CODM/Free Fire. Checks username uniqueness, calls `merge_game_bound_at` RPC. Returns `USERNAME_TAKEN` (409) if already linked to another wallet — client should enter appeal flow |

---

### `secure-bet`

Spectator side bet actions. Requires `X-Session-Token`. New in v1.8.0.

| Action | Auth | Description |
|--------|------|-------------|
| `place` | ✅ | Transfer SOL to platform wallet on-chain; INSERT bet row with 30-min expiry. Blocked if wager is `voting`/`resolved`/`cancelled`. Players cannot bet on their own match. |
| `counter` | ✅ | Propose different amount; status → `countered` |
| `accept` | ✅ | Second party sends SOL to platform wallet; status → `matched` |
| `cancel` | ✅ | Owner cancels open (unmatched) bet; platform wallet refunds SOL |
| `resolveForWager` | ✅ | Called after wager resolves. Pays winners 95% of pot, refunds unmatched open bets, marks all as resolved/expired. |

**Request body shape (place):**
```json
{
  "action": "place",
  "wagerId": "uuid",
  "backedPlayer": "player_a",
  "amountLamports": 500000000,
  "txSignature": "5yBGvU..."
}
```

---

### `admin-action`

Admin dispute resolution. Requires admin JWT. Called via `/api/admin/action`.

| Action | Min Role | Description |
|--------|----------|-------------|
| `forceResolve` | moderator | Force-resolve a disputed wager with a given winner wallet; calls on-chain `resolve_wager` |
| `forceRefund` | moderator | Force-refund both players; calls on-chain `close_wager` |
| `markDisputed` | moderator | Manually set wager status → `disputed` |
| `banPlayer` | admin | Set `is_banned = true` on a player row |
| `unbanPlayer` | admin | Clear ban on a player row |
| `flagPlayer` | admin | Set `flagged_for_review = true` with a reason |
| `unflagPlayer` | admin | Clear `flagged_for_review` and `flag_reason` on a player row |
| `checkPdaBalance` | admin | Inspect the live on-chain WagerAccount PDA balance for a wager (`wagerId` required) |
| `addNote` | admin | Insert a free-text row into `admin_notes` for a player or wager |

---

### `resolve-wager`

Low-level on-chain settlement. Internal only — not called from the frontend.

Derives WagerAccount PDA → builds `resolve_wager` (90–95% to winner) or `close_wager` (draw/cancel refund) → signs and sends → calls `update_winner_stats` / `update_loser_stats` RPCs → INSERTs `wager_transactions` records.

---

### `process-verdict`

Called after moderator submits verdict. On-chain settlement + 5-tier auto-punishment.

---

### `process-concession`

Called when player concedes during dispute grace period. On-chain `resolve_wager` (no mod fee, no punishment). Logs positive honesty event.

---

### `assign-moderator`

Fire-and-forget. Finds eligible moderator (lowest `moderation_skipped_count`, not a participant, not suspended, `moderation_requests_enabled = true`). Inserts `moderation_requests` row.

---

### `moderation-timeout`

Triggered by pg_cron every minute. Marks expired requests `timed_out`, increments skip count atomically, retries `assign-moderator`.

---

### `check-chess-games`

Polls Lichess API for completed games. Triggered by cron-job.org every 60s.

---

### `verify-wallet`

Issues Ed25519 session token from wallet signature.

---

## Next.js API Routes

### Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/auth/lichess/callback` | Lichess OAuth PKCE callback |
| `POST` | `/api/auth/verify-wallet` | Wallet signature → session token |

### Admin Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/admin/auth/login` | Admin login → JWT + httpOnly cookie |
| `POST` | `/api/admin/auth/logout` | Clear session |
| `POST` | `/api/admin/auth/signup` | Admin signup |
| `GET` | `/api/admin/auth/verify` | Verify admin session |
| `POST` | `/api/admin/auth/refresh` | Refresh JWT |

### Admin Actions

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/admin/action` | Wager/player actions (forceResolve, forceRefund, markDisputed, banPlayer, etc.) |
| `GET` | `/api/admin/audit-logs` | Fetch audit logs |
| `GET/PUT` | `/api/admin/profile` | Get/update admin profile |
| `GET` | `/api/admin/wagers/inspect` | Fetch wager by UUID, match ID (numeric), or wallet address. Query param: `q`. Min role: moderator |
| `GET` | `/api/admin/wagers/pda-scan` | Bulk PDA scanner. Params: `status` (optional), `limit` (default 200, max 500), `offset`. Returns per-wager verdict: `STUCK_FUNDS` / `ACTIVE_FUNDED` / `DISTRIBUTED` / `NOT_FOUND` / `PENDING_DEPOSIT` / `RPC_ERROR`. Min role: moderator |
| `POST` | `/api/admin/wallet/bind` | Bind Solana wallet to admin |
| `POST` | `/api/admin/wallet/verify` | Verify admin wallet signature |
| `GET` | `/api/admin/wallet/list` | List admin wallet bindings |
| `DELETE` | `/api/admin/wallet/unbind` | Unbind wallet |

### Moderation

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/moderation/accept` | Player session | Accept moderator assignment |
| `POST` | `/api/moderation/decline` | Player session | Decline assignment; increment skip count |
| `POST` | `/api/moderation/verdict` | Player session | Submit verdict; triggers on-chain settlement |
| `POST` | `/api/moderation/report` | Player session | Report unfair verdict |

### Player Settings

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/settings` | Player session | Get notification + moderation prefs |
| `PATCH` | `/api/settings` | Player session | Update prefs |

### Username Binding

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/username/bind` | Player session | Bind game username to wallet |
| `POST` | `/api/username/appeal` | Player session | File appeal on taken username |
| `POST` | `/api/username/appeal/respond` | Player session | Holder responds to appeal |
| `POST` | `/api/username/change-request` | Player session | Request username rebind |
| `GET` | `/api/pubg/verify-username` | Public | Verify PUBG username via PUBG API |

---

## DB Functions (RPC)

Callable via `.rpc()` on the Supabase client.

| Function | Called By | Description |
|----------|-----------|-------------|
| `set_player_ready` | `secure-wager` (setReady) | Atomic ready toggle + countdown start |
| `update_winner_stats` | `resolve-wager` | Increment wins, earnings, streak |
| `update_loser_stats` | `resolve-wager` | Increment losses, total_spent, reset streak |
| `merge_game_bound_at` | `secure-player` | JSONB-merge single game bound timestamp |
| `increment_moderation_skip_count` | `moderation-timeout`, `/api/moderation/decline` | Atomic skip count increment |

---

## Wager Status Enum

```
created      → PDA exists, Player A deposited
joined       → Both deposited, game about to start
voting       → Game in progress, awaiting votes
retractable  → Both votes agree — 15s retract window
disputed     → Votes disagree — moderator required
resolved     → Winner paid out — PDA closed
cancelled    → Cancelled — funds returned
```

---

## Side Bet Status Enum

```
open        → Placed, awaiting match
countered   → Counter-offer proposed
matched     → Both parties locked in
expired     → Wager resolved before bet was matched — refunded
resolved    → Winner paid out
cancelled   → Cancelled by bettor — refunded
```

---

## Fee Schedule

| Stake | Platform Fee | Moderator Earns |
|-------|-------------|-----------------|
| < 0.5 SOL | 10% of pot | 30% of fee (capped $10 USD) |
| 0.5–5 SOL | 7% of pot | 30% of fee (capped $10 USD) |
| > 5 SOL | 5% of pot | 30% of fee (capped $10 USD) |

Side bet platform cut: 5% of side bet pot.

---

## Notification Types

All values that can appear in the `notifications` table and must be handled by `NotificationsDropdown`:

| Type | Description |
|------|-------------|
| `wager_joined` | Opponent joined your wager |
| `game_started` | Game is live |
| `wager_won` | You won |
| `wager_lost` | You lost |
| `wager_draw` | Draw |
| `wager_cancelled` | Wager cancelled |
| `rematch_challenge` | Rematch requested |
| `wager_vote` | Opponent submitted vote |
| `chat_message` | New chat message (rate-limited) |
| `wager_proposal` | New edit proposal |
| `wager_disputed` | Dispute raised |
| `moderation_request` | You've been assigned as moderator |
| `feed_reaction` | Someone reacted to your feed post |
| `friend_request` | Someone sent you a friend request |
| `friend_accepted` | Friend request accepted |
| `new_follower` | Someone followed your profile |

---

## Error Codes

| HTTP Code | Meaning |
|-----------|---------|
| 400 | Bad request / missing fields / invalid game type |
| 401 | Unauthorized — missing or expired session token |
| 403 | Forbidden — caller not permitted for this action |
| 404 | Resource not found |
| 409 | Conflict — e.g. wager status prevents this action |
| 429 | Rate limit exceeded |
| 500 | Edge function / on-chain error |

---

## Security Notes

- All state transitions require a valid Ed25519 session token
- DB triggers (`protect_player_sensitive_fields`, `protect_wager_sensitive_fields`) prevent direct client writes to sensitive fields — all mutations must go through edge functions
- `PLATFORM_WALLET_PRIVATE_KEY` must be set as an edge function secret for `secure-bet` payouts
- Players cannot bet on their own wager in `secure-bet`
- Moderator wallet is verified server-side against the `moderation_requests` row before any mutation
- Verdict is irreversible once submitted

---

---


---

## Detailed REST Endpoints

> Request/response shapes for core data operations. All wager mutations go through the edge functions documented above; these shapes apply to Supabase client queries and Next.js API routes.

### Wagers

#### Create Wager — `secure-wager` `create`

```json
{
  "game": "chess",
  "stake_lamports": 5000000000,
  "is_public": true
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `game` | `string` | Yes | `chess` \| `codm` \| `pubg` \| `free_fire` |
| `stake_lamports` | `number` | Yes | Stake per player in lamports (1 SOL = 1,000,000,000) |
| `is_public` | `boolean` | No | Visible in public lobby (default: `true`) |

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "match_id": 12345,
  "player_a_wallet": "G1R2k...",
  "game": "chess",
  "stake_lamports": 5000000000,
  "status": "created",
  "created_at": "2026-03-09T10:30:00Z"
}
```

**Error codes:**
| Code | Message |
|------|---------|
| 400 | Invalid game type |
| 400 | Insufficient balance |
| 401 | Unauthorized |
| 429 | Rate limit exceeded |

---

#### Join Wager — `secure-wager` `join`

```json
{ "action": "join", "wagerId": "550e8400-..." }
```

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "joined",
  "player_b_wallet": "xyz789...",
  "ready_player_a": false,
  "ready_player_b": false,
  "countdown_started_at": null
}
```

---

#### Resolve Wager — `resolve-wager` (internal)

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "resolved",
  "winner_wallet": "G1R2k...",
  "resolved_at": "2026-03-09T10:45:00Z",
  "transactions": [
    {
      "id": "tx-001",
      "type": "payout",
      "amount_lamports": 9500000000,
      "tx_signature": "5yBGvU..."
    }
  ]
}
```

---

#### Cancel Wager — `secure-wager` `cancelWager`

```json
{ "action": "cancelWager", "wagerId": "550e8400-..." }
```

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "cancelled",
  "cancelled_at": "2026-03-09T10:40:00Z",
  "refundInitiated": true
}
```

**Error responses:**
| Status | Code | Description |
|--------|------|-------------|
| 400 | `INVALID_STATUS` | Cannot cancel in current status |
| 403 | `NOT_PARTICIPANT` | Only participants can cancel |
| 404 | `NOT_FOUND` | Wager not found |

---

#### Get Wager Details — Supabase client

```typescript
const { data } = await supabase
  .from('wagers')
  .select('*')
  .eq('id', wagerId)
  .single()
```

**Response shape:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "match_id": 12345,
  "player_a_wallet": "G1R2k...",
  "player_b_wallet": "xyz789...",
  "game": "chess",
  "stake_lamports": 5000000000,
  "status": "voting",
  "winner_wallet": null,
  "ready_player_a": true,
  "ready_player_b": true,
  "vote_player_a": "G1R2k...",
  "vote_player_b": null,
  "game_complete_a": true,
  "game_complete_b": false,
  "vote_deadline": "2026-04-01T10:40:00Z",
  "created_at": "2026-03-09T10:30:00Z"
}
```

---

#### List Wagers — Supabase client

```typescript
const { data } = await supabase
  .from('wagers')
  .select('*')
  .eq('status', 'created')
  .eq('is_public', true)
  .order('created_at', { ascending: false })
  .range(0, 49)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `status` | `string` | — | `created` \| `joined` \| `voting` \| `disputed` \| `resolved` \| `cancelled` |
| `game` | `string` | — | `chess` \| `codm` \| `pubg` \| `free_fire` |
| `limit` | `number` | 50 | Max 100 |

---

### Players

#### Get Player Profile — Supabase client

```typescript
const { data } = await supabase
  .from('players')
  .select('*')
  .eq('wallet_address', walletAddress)
  .single()
```

**Response shape:**
```json
{
  "wallet_address": "G1R2k...",
  "username": "ProGamer",
  "bio": "Chess master",
  "total_wagers": 42,
  "wins": 28,
  "losses": 14,
  "total_earnings": 15000000000,
  "invite_code": "G1R2k-a3f9",
  "referral_count": 5,
  "is_banned": false,
  "is_suspended": false,
  "created_at": "2026-01-01T00:00:00Z"
}
```

---

#### Get Leaderboard — Supabase client

```typescript
const { data } = await supabase
  .from('players')
  .select('wallet_address, username, wins, total_earnings, total_wagers')
  .order('total_earnings', { ascending: false })
  .limit(100)
```

| Sort Field | Description |
|------------|-------------|
| `total_earnings` | Most SOL earned (default) |
| `wins` | Most wins |
| `total_wagers` | Most active |

---

#### Create Player — `secure-player` `create`

```json
{
  "action": "create",
  "username": "ProGamer",
  "referrerCode": "xyz12-b7c3"
}
```

**Response:**
```json
{
  "wallet_address": "G1R2k...",
  "username": "ProGamer",
  "invite_code": "G1R2k-a3f9",
  "created_at": "2026-04-01T10:30:00Z"
}
```

---

#### Update Player — `secure-player` `update`

```json
{
  "action": "update",
  "bio": "Updated bio",
  "avatar_url": "https://...",
  "codm_username": "NewCODMName"
}
```

**Response:**
```json
{
  "wallet_address": "G1R2k...",
  "bio": "Updated bio",
  "avatar_url": "https://...",
  "updated_at": "2026-04-01T10:40:00Z"
}
```

---

### Transactions

#### Get Transaction History — Supabase client

```typescript
const { data } = await supabase
  .from('wager_transactions')
  .select('*')
  .eq('wager_id', wagerId)
  .order('created_at', { ascending: false })
```

**Transaction shape:**
```json
{
  "id": "tx-uuid",
  "wager_id": "wager-uuid",
  "type": "payout",
  "from_wallet": "program_pda",
  "to_wallet": "G1R2k...",
  "amount_lamports": 9500000000,
  "tx_signature": "5yBGvU...",
  "created_at": "2026-03-09T10:45:00Z"
}
```

**Transaction types:**
| Type | Description |
|------|-------------|
| `deposit_a` | Player A on-chain deposit |
| `deposit_b` | Player B on-chain deposit |
| `payout` | Winner payout |
| `refund_a` | Player A refund (cancel/draw) |
| `refund_b` | Player B refund (cancel/draw) |
| `platform_fee` | Platform fee extraction |
| `moderator_fee` | Moderator incentive payment |

---

### Admin Endpoints

#### Admin Authentication

**POST** `/api/admin/auth/login`

```json
{
  "email": "admin@gamegambit.com",
  "password": "secure_password"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "admin_id": "admin-uuid",
  "role": "admin",
  "permissions": ["resolve_disputes", "ban_players", "view_audit_logs"]
}
```

**POST** `/api/admin/auth/signup`

```json
{
  "email": "newadmin@gamegambit.com",
  "password": "secure_password",
  "full_name": "Admin Name"
}
```

---

#### Admin Dashboard

**GET** `/api/admin/dashboard`  
Authorization: Admin token required

**Response:**
```json
{
  "total_wagers": 12542,
  "active_wagers": 342,
  "disputed_wagers": 8,
  "total_users": 5234,
  "total_volume_sol": 125.34,
  "platform_fees_sol": 12.53,
  "recent_disputes": [
    {
      "wager_id": "uuid",
      "players": ["wallet1", "wallet2"],
      "status": "disputed",
      "created_at": "2026-03-09T10:00:00Z"
    }
  ]
}
```

---

#### Dispute Resolution

**GET** `/api/admin/disputes?limit=50&offset=0`  
Authorization: Moderator role required

```json
{
  "data": [
    {
      "wager_id": "uuid",
      "match_id": 12345,
      "player_a": "wallet_a",
      "player_b": "wallet_b",
      "game": "pubg",
      "stake_lamports": 5000000000,
      "vote_a": "wallet_a",
      "vote_b": "wallet_b"
    }
  ],
  "total": 8
}
```

**POST** `/api/admin/disputes/{wager_id}/resolve`

```json
{
  "winner_wallet": "wallet_a",
  "resolution_notes": "Player A provided stronger evidence"
}
```

---

#### Player Management

**GET** `/api/admin/players/{wallet_address}`  
Authorization: Admin role required

```json
{
  "wallet_address": "G1R2k...",
  "username": "PlayerName",
  "total_wins": 142,
  "total_losses": 38,
  "is_banned": false,
  "flagged_for_review": false,
  "false_vote_count": 0,
  "moderation_skipped_count": 0,
  "last_active": "2026-03-09T10:35:00Z"
}
```

**POST** `/api/admin/players/{wallet_address}/ban`

```json
{ "ban_reason": "Suspicious voting pattern detected" }
```

**POST** `/api/admin/players/{wallet_address}/flag`

```json
{ "flag_reason": "Unusual betting pattern" }
```

---

#### Audit Logs

**GET** `/api/admin/audit-logs?limit=100&resource_type=players`  
Authorization: Admin role required

| Parameter | Type | Description |
|-----------|------|-------------|
| `action_type` | string | Type of action performed |
| `resource_type` | string | `players` \| `wagers` |
| `admin_id` | string | Filter by specific admin |
| `limit` | number | Max 500 |

**Response:**
```json
{
  "data": [
    {
      "id": "audit-uuid",
      "admin_id": "admin-uuid",
      "action_type": "ban_player",
      "resource_type": "players",
      "resource_id": "wallet_address",
      "old_values": { "is_banned": false },
      "new_values": { "is_banned": true, "ban_reason": "Suspicious activity" },
      "ip_address": "192.168.1.1",
      "created_at": "2026-03-09T10:50:00Z"
    }
  ],
  "total": 1245
}
```

---

#### Admin Wallet Binding

**POST** `/api/admin/wallet/bind`

```json
{
  "wallet_address": "G1R2k...",
  "verification_signature": "5yBGvU..."
}
```

**GET** `/api/admin/wallet/list`

```json
{
  "data": [
    {
      "wallet_address": "G1R2k...",
      "verified": true,
      "is_primary": true,
      "verified_at": "2026-03-09T10:00:00Z"
    }
  ]
}
```

---

### Voting (Peer Resolution)

#### Submit Vote — `secure-wager` `submitVote`

```json
{
  "action": "submitVote",
  "wagerId": "550e8400-...",
  "votedWinner": "G1R2k..."
}
```

Both votes agree → auto-resolve on-chain.  
Votes disagree → `status: "disputed"`, moderator assigned.

---

#### Retract Vote — `secure-wager` `retractVote`

```json
{
  "action": "retractVote",
  "wagerId": "550e8400-..."
}
```

Only allowed while opponent has not yet voted.

---

## Error Response Format

All edge functions return errors in this shape:

```json
{
  "error": "INSUFFICIENT_FUNDS",
  "message": "Player balance insufficient for wager stake",
  "details": {
    "required": 5000000000,
    "available": 2000000000
  }
}
```

### Common Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `INVALID_WALLET` | 400 | Wallet address is invalid |
| `UNAUTHORIZED` | 401 | Authentication signature invalid or expired |
| `INSUFFICIENT_FUNDS` | 400 | Wallet balance insufficient |
| `WAGER_NOT_FOUND` | 404 | Wager does not exist |
| `INVALID_GAME_TYPE` | 400 | Game type not supported |
| `WAGER_STATUS_INVALID` | 409 | Operation invalid for current wager status |
| `DUPLICATE_JOIN` | 400 | Player already joined this wager |
| `CANNOT_BET_OWN_MATCH` | 403 | Players cannot place side bets on their own wager |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server / on-chain error |

---

## Webhooks (Optional)

Game Gambit can send webhooks for important events. Configure at `/settings/webhooks`.

#### wager.created
```json
{
  "event": "wager.created",
  "timestamp": "2026-04-01T10:30:00Z",
  "data": {
    "wager_id": "550e8400-e29b-41d4-a716-446655440000",
    "player_a": "G1R2k...",
    "game": "chess",
    "stake_lamports": 5000000000
  }
}
```

#### wager.resolved
```json
{
  "event": "wager.resolved",
  "timestamp": "2026-04-01T10:45:00Z",
  "data": {
    "wager_id": "550e8400-e29b-41d4-a716-446655440000",
    "winner": "G1R2k...",
    "loser": "xyz789...",
    "winner_payout": 9500000000
  }
}
```

---

## Code Examples

### Invoke a Secure Wager Action (TypeScript)

```typescript
import { invokeSecureWager } from '@/hooks/useWagers'

// Create a wager
const result = await invokeSecureWager({
  action: 'create',
  game: 'chess',
  stake_lamports: 500_000_000,
  is_public: true,
}, sessionToken)

// Submit a vote
await invokeSecureWager({
  action: 'submitVote',
  wagerId: 'wager-uuid',
  votedWinner: walletPublicKey,
}, sessionToken)
```

### Place a Side Bet (TypeScript)

```typescript
const { placeSideBet } = usePlaceSideBet()

await placeSideBet({
  wagerId: 'wager-uuid',
  backedPlayer: 'player_a',
  amountLamports: 500_000_000,
  txSignature: '5yBGvU...',
})
```

### Create a Wager (JavaScript)

```typescript
const createWager = async (stake, game) => {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/secure-wager`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Token': sessionToken,
      },
      body: JSON.stringify({ action: 'create', game, stake_lamports: stake, is_public: true })
    }
  )
  return response.json()
}
```

### Get Leaderboard (TypeScript)

```typescript
const getLeaderboard = async (sort = 'total_earnings', limit = 100) => {
  const { data } = await supabase
    .from('players')
    .select('wallet_address, username, wins, total_earnings, total_wagers')
    .order(sort, { ascending: false })
    .limit(limit)
  return data
}
```

---

## Admin Panel

Access the admin dashboard at `/itszaadminlogin/`

**Features:**
- Dispute resolution interface with 5-step verdict workflow
- Player management — ban/flag/review players, full stats
- Wager oversight — complete history, transaction ledger, status tracking
- Audit logs with before/after state changes and IP logging
- Admin wallet binding and on-chain signature verification
- Session management with JWT tokens and auto-refresh

**Required Roles:**

| Role | Permissions |
|------|-------------|
| `superadmin` | Full system access including admin user management |
| `admin` | Dispute resolution, player bans, wager oversight, audit logs |
| `moderator` | Dispute resolution only |

---

## Performance Benchmarks

### v1.0.0 Baselines (Production — Devnet)

| Metric | Target | Achieved |
|--------|--------|----------|
| API response time (p50) | < 50ms | 35ms |
| API response time (p95) | < 200ms | 180ms |
| API response time (p99) | < 500ms | 420ms |
| Leaderboard query | < 50ms | 45ms |
| Wager creation | 100–300ms | 220ms |
| Database connection | < 10ms | 8ms |
| Cache hit rate | > 85% | 87% |
| Uptime | > 99.9% | 99.95% |

---

**Last Updated:** April 2026 — v1.8.0