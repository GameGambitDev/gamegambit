# GameGambit — Developer Reference

![Game Gambit Logo](/public/logo.png)

[![Next.js 15](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org)
[![React 18](https://img.shields.io/badge/React-18.3-blue)](https://react.dev)
[![Solana](https://img.shields.io/badge/Solana-Blockchain-9945FF)](https://solana.com)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E)](https://supabase.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-2D79C7)](https://typescriptlang.org)

**Game Gambit** is a decentralized gaming platform where players create wagers on chess, Call of Duty Mobile, PUBG, and Free Fire matches settled on the Solana blockchain. This file is the developer quick-reference — architecture decisions, hooks, edge function actions, DB gotchas, and environment setup.

---

## Live Links

| | |
|---|---|
| **Deployed App** | https://thegamegambit.vercel.app |
| **Admin Panel** | https://thegamegambit.vercel.app/itszaadminlogin |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 15, React 18, TypeScript 5.8 |
| **Styling** | Tailwind CSS 3.4, Radix UI / shadcn components |
| **Database** | Supabase PostgreSQL with Row-Level Security |
| **Blockchain** | Solana Web3.js, Anchor Framework |
| **Authentication** | Solana Wallet Adapter + Lichess OAuth PKCE |
| **Chess** | Lichess Public API + Platform Token game creation |
| **Push Notifications** | Web Push API (VAPID), PWA Service Worker |
| **Caching** | Upstash Redis + In-Memory Cache |

---

## Getting Started

### Prerequisites

- Node.js 18+ and npm/pnpm
- Solana Devnet wallet (Phantom, Magic Eden, etc.)
- Supabase project

### Installation

```bash
git clone https://github.com/GameGambitDev/gamegambit.git
cd gamegambit
pnpm install
cp .env.example .env.local
```

### Environment Variables

```env
# Solana
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_PROGRAM_ID=E2Vd3U91kMrgwp8JCXcLSn7bt3NowDmGwoBYsVRhGfMR

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# App URL — used for Lichess OAuth PKCE callback
NEXT_PUBLIC_SITE_URL=https://thegamegambit.vercel.app

# Admin Authentication (Required for /itszaadminlogin)
ADMIN_JWT_SECRET=your_jwt_secret_key_min_32_chars
ADMIN_SESSION_TIMEOUT=3600000
ADMIN_REFRESH_TIMEOUT=604800000
NEXT_PUBLIC_ADMIN_SOLANA_NETWORK=devnet
ADMIN_SMTP_HOST=smtp.your-email.com
ADMIN_SMTP_PORT=587
ADMIN_SMTP_USER=your-email@example.com
ADMIN_SMTP_PASSWORD=your-app-password

# PWA Push Notifications (VAPID)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_vapid_public_key   # must have NO surrounding whitespace/quotes
```

**Edge function secrets** — set in Supabase Dashboard → Edge Functions → Secrets (not in `.env.local`):

```
AUTHORITY_WALLET_SECRET=[your,keypair,bytes,array]
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SOLANA_RPC_URL=https://api.devnet.solana.com
LICHESS_PLATFORM_TOKEN=your_gamegambit_lichess_account_token
VAPID_PRIVATE_KEY=your_vapid_private_key
VAPID_PUBLIC_KEY=your_vapid_public_key
ADMIN_WALLET=your_admin_wallet_address
```

> **VAPID key format:** The `NEXT_PUBLIC_VAPID_PUBLIC_KEY` value must contain no leading/trailing whitespace or quote characters — Vercel env var UI can silently include them. The `useNotifications.ts` hook validates the key format before subscribing and logs a warning if invalid characters are detected.

### Running Locally

```bash
pnpm dev       # dev server with Turbopack
pnpm build     # production build
pnpm start     # start production server
pnpm lint      # ESLint
```

Visit `http://localhost:3000`.

### Database Setup

Run `gamegambit-setup.sql` in Supabase SQL Editor — creates all 15 tables, indexes, constraints, RLS policies, DB functions, triggers, and Realtime subscriptions in one shot.

For admin panel:
1. Run `scripts/migrations/001_create_admin_tables.sql` in Supabase SQL Editor
2. Set all `ADMIN_*` env vars
3. Generate JWT secret: `openssl rand -base64 32`

### Regenerating Types

After any DB migration, regenerate the Supabase TypeScript types:
```bash
supabase gen types typescript --project-id your_project_ref > src/integrations/supabase/types.ts
```

> ⚠️ **`wager_messages` and all v1.5.0+ tables are not in the generated types.** See [Known Type Gaps](#known-type-gaps) below.

---

## Project Structure

```
gamegambit/
├── src/
│   ├── app/                       # Next.js 15 App Router
│   │   ├── api/
│   │   │   ├── auth/lichess/callback/  # Lichess OAuth PKCE callback
│   │   │   ├── admin/                  # Admin API routes (auth, profile, wallet, audit)
│   │   │   └── lichess/webhook/        # Lichess game result webhook
│   │   ├── itszaadminlogin/       # Admin panel pages
│   │   │   ├── login/
│   │   │   ├── signup/
│   │   │   ├── dashboard/
│   │   │   ├── profile/
│   │   │   ├── wallet-bindings/
│   │   │   ├── audit-logs/
│   │   │   ├── disputes/
│   │   │   ├── users/
│   │   │   ├── wagers/
│   │   │   └── unauthorized/
│   │   ├── arena/                 # Wager creation & matching
│   │   ├── dashboard/             # User statistics
│   │   ├── leaderboard/           # Rankings
│   │   ├── my-wagers/             # Player's wager history
│   │   ├── profile/[walletAddress]/ # Public player profiles
│   │   └── page.tsx               # Landing page
│   │
│   ├── components/
│   │   ├── admin/                 # Admin UI components
│   │   ├── landing/               # Landing page sections
│   │   ├── layout/                # Navbar, footer, layout shells
│   │   ├── CreateWagerModal.tsx   # Wager creation (chess time controls, game picker)
│   │   ├── ReadyRoomModal.tsx     # Ready room + deposits + chat + proposals
│   │   ├── EditWagerModal.tsx     # Wager edit proposals UI
│   │   ├── LiveGameModal.tsx      # Lichess game embed (chess only)
│   │   ├── GameCompleteModal.tsx  # Step 3 — non-chess "confirm game done" + sync countdown
│   │   ├── VotingModal.tsx        # Step 3 — vote on winner (agree → resolve, disagree → dispute)
│   │   ├── GameResultModal.tsx    # Win/loss/draw result screen
│   │   ├── NotificationsDropdown.tsx
│   │   ├── NFTGallery.tsx
│   │   ├── AchievementBadges.tsx
│   │   └── ui/                    # shadcn/ui components
│   │
│   ├── hooks/
│   │   ├── admin/
│   │   │   ├── useAdminAction.ts
│   │   │   ├── useAdminAuth.ts
│   │   │   ├── useAdminProfile.ts
│   │   │   ├── useAdminSession.ts
│   │   │   ├── useAdminUsers.ts
│   │   │   ├── useAdminWagers.ts
│   │   │   └── useAdminWallet.ts
│   │   ├── useAutoCreatePlayer.ts  # Auto-registers player on first wallet connect
│   │   ├── useGameComplete.ts      # useMarkGameComplete mutation (Step 3)
│   │   ├── useLichess.ts           # OAuth PKCE flow, connect/disconnect
│   │   ├── useNFTs.ts
│   │   ├── useNotifications.ts     # Bell dropdown + Web Push subscription
│   │   ├── usePlayer.ts
│   │   ├── useQuickMatch.ts
│   │   ├── useSolanaProgram.ts     # Anchor program interaction
│   │   ├── useTransactions.ts      # wager_transactions queries
│   │   ├── useVoting.ts            # useSubmitVote, useRetractVote, deriveVoteOutcome (Step 3)
│   │   ├── useWagerChat.ts         # Ready room chat + proposals (wager_messages)
│   │   ├── useWagers.ts            # Wager CRUD + invokeSecureWager helper
│   │   ├── useWalletAuth.ts        # Ed25519 session token management
│   │   └── useWalletBalance.ts
│   │
│   ├── contexts/
│   │   ├── GameEventContext.tsx    # Global Realtime listener — keeps wager cache fresh
│   │   ├── WalletContext.tsx
│   │   ├── ModalContext.tsx
│   │   ├── PWAContext.tsx
│   │   └── BalanceAnimationContext.tsx
│   │
│   ├── lib/
│   │   ├── admin/
│   │   │   ├── auth.ts             # JWT sign/verify
│   │   │   ├── password.ts         # PBKDF2 hashing
│   │   │   ├── permissions.ts      # RBAC matrix
│   │   │   ├── validators.ts       # Input validation
│   │   │   └── wallet-verify.ts    # Ed25519 signature verification
│   │   ├── idl/                    # Solana IDL (gamegambit.json + gamegambit.ts)
│   │   ├── constants.ts
│   │   ├── data-consistency.ts
│   │   ├── database-utils.ts
│   │   ├── performance-tradeoffs.ts
│   │   ├── rate-limiting.ts
│   │   ├── solana-config.ts
│   │   ├── utils.ts
│   │   └── validation.ts
│   │
│   ├── integrations/supabase/
│   │   ├── client.ts
│   │   ├── types.ts               # Auto-generated (regen after migrations)
│   │   └── admin/                 # Admin DB operations
│   │       ├── actions.ts
│   │       ├── audit.ts
│   │       ├── auth.ts
│   │       ├── profile.ts
│   │       ├── sessions.ts
│   │       └── wallets.ts
│   │
│   └── types/
│       └── admin.ts
│
├── supabase/functions/
│   ├── secure-wager/    # All wager actions + Lichess game creation
│   ├── secure-player/   # Player create/update
│   ├── admin-action/    # Admin dispute resolution (force resolve/draw/cancel, ban)
│   └── resolve-wager/   # On-chain settlement (called by admin-action + Lichess webhook)
│
├── public/
│   ├── manifest.json    # PWA manifest
│   └── sw.js            # Service worker (caching + push notification handler)
│
├── scripts/migrations/
│   └── 001_create_admin_tables.sql
│
├── gamegambit-setup.sql   # Full DB setup in one shot
└── package.json
```

---

## Database Tables

All tables confirmed in the live production DB. See [`DB_SCHEMA.md`](./DB_SCHEMA.md) for full column specs.

| Table | Realtime | Purpose |
|-------|----------|---------|
| `players` | ❌ | User accounts, stats, Lichess OAuth data |
| `wagers` | ✅ | Gaming matches with full lifecycle state |
| `wager_transactions` | ✅ | On-chain transaction ledger |
| `wager_messages` | ✅ | Ready room chat and wager edit proposals |
| `notifications` | ✅ | In-app event notifications |
| `push_subscriptions` | ❌ | VAPID Web Push endpoint + keys per player |
| `nfts` | ❌ | Victory NFTs minted to Solana |
| `achievements` | ❌ | Player achievement badges |
| `rate_limit_logs` | ❌ | Sliding-window rate limiter |
| `admin_users` | ❌ | Admin portal accounts |
| `admin_sessions` | ❌ | Admin JWT session store |
| `admin_wallet_bindings` | ❌ | Admin Solana wallet bindings |
| `admin_audit_logs` | ❌ | Full RBAC audit trail with before/after state |
| `admin_logs` | ❌ | Wager-specific admin action log |
| `admin_notes` | ❌ | Admin free-text notes on players/wagers |
| `moderation_requests` | ❌ | Moderator assignment queue per dispute (v1.5.0) |
| `username_appeals` | ❌ | Player appeals for taken usernames (v1.5.0) |
| `username_change_requests` | ❌ | Formal username rebind requests (v1.5.0) |
| `punishment_log` | ❌ | Immutable punishment audit trail (v1.5.0) |
| `player_behaviour_log` | ❌ | Soft behavioural events for admin review (v1.5.0) |

---

## Known Type Gaps

| Table / Column | Status | Workaround |
|-------|--------|------------|
| `wager_messages` | ❌ Not in `types.ts` | `as any` cast in `useWagerChat.ts`; `WagerMessage` + `ProposalData` interfaces defined there |
| `moderation_requests` | ❌ Not in `types.ts` | Define local interface in consuming hook |
| `username_appeals` | ❌ Not in `types.ts` | Define local interface in consuming hook |
| `username_change_requests` | ❌ Not in `types.ts` | Define local interface in consuming hook |
| `punishment_log` | ❌ Not in `types.ts` | Define local interface in consuming hook |
| `player_behaviour_log` | ❌ Not in `types.ts` | Define local interface in consuming hook |
| `players` new columns (v1.5.0) | ❌ Not in `types.ts` | `as any` casts in `src/app/api/settings/route.ts` and `usePlayerSettings.ts` |
| `wagers` new columns (v1.5.0 + v1.6.0) | ❌ Not in `types.ts` | Local field references in `useWagers.ts` `Wager` interface |
| `game_type` enum `free_fire` | ❌ Not in `types.ts` | `GameType` union in `useWagers.ts` includes `'free_fire'` manually |

**To fix:** Re-run `supabase gen types typescript --project-id your_project_ref > src/integrations/supabase/types.ts` after any schema change, then remove `as any` workarounds.

---

## Edge Functions

Four edge functions handle all server-side operations. All run on Supabase's Deno runtime.

### `secure-wager`
All wager lifecycle actions. Requires `X-Session-Token` header (Ed25519 wallet session token) for auth. Called via `invokeSecureWager()` in `src/hooks/useWagers.ts`.

| Action | Auth Required | Who Can Call | Description |
|--------|---------------|--------------|-------------|
| `create` | ✅ | Any player | INSERT new wager, create on-chain PDA |
| `join` | ✅ | Any player (not owner) | UPDATE status → joined |
| `vote` | ✅ | Either participant | UPDATE vote_player_a/b (legacy — use `submitVote` for new flow) |
| `edit` | ✅ | Player A only | UPDATE stake/stream_url/is_public (status = created only) |
| `applyProposal` | ✅ | Either participant | Apply an accepted proposal — bypasses owner-only edit restriction |
| `notifyChat` | ✅ | Either participant | INSERT notification to opponent (rate-limited: 1 per 5 min per wager) |
| `notifyProposal` | ✅ | Either participant | INSERT notification to opponent about new proposals |
| `delete` | ✅ | Player A only | DELETE wager (status = created only) |
| `setReady` | ✅ | Either participant | Calls `set_player_ready` DB RPC |
| `startGame` | ✅ | Either participant | UPDATE status → voting; creates Lichess game via platform token |
| `recordOnChainCreate` | ✅ | Player A only | UPDATE deposit_player_a = true, tx_signature_a |
| `recordOnChainJoin` | ✅ | Player B only | UPDATE deposit_player_b = true, tx_signature_b |
| `checkGameComplete` | ✅ | Either participant | Poll Lichess API — if game ended, trigger resolve |
| `cancelWager` | ✅ | Either participant | UPDATE status → cancelled; trigger on-chain refund |
| `markGameComplete` | ✅ | Either participant | **Step 3** — sets `game_complete_a` or `game_complete_b`; when both set, writes `game_complete_deadline` (+10s) and `vote_deadline` (+5m 10s) |
| `submitVote` | ✅ | Either participant | **Step 3** — sets `vote_player_a` or `vote_player_b`; if both match → auto-resolve on-chain; if mismatch → status = `disputed` |
| `retractVote` | ✅ | Either participant | **Step 3** — clears caller's vote (only allowed while opponent hasn't voted yet) |

> **`applyProposal` vs `edit`:** `edit` is owner-only and blocked when status = `joined`. `applyProposal` accepts auth from either participant and applies the change regardless of status. Always use `applyProposal` when responding to a proposal acceptance — never `edit`.

> **`vote` vs `submitVote`:** The legacy `vote` action is kept for compatibility. All new code should use `submitVote` for the Step 3 peer voting flow.

---

### `secure-player`
Player profile management. Requires `X-Session-Token` header.

| Action | Description |
|--------|-------------|
| `create` | INSERT new player row (auto-called on first wallet connect via `useAutoCreatePlayer`) |
| `update` | UPDATE player profile fields (username, bio, avatar, game usernames) |

---

### `admin-action`
Admin dispute resolution and moderation. Requires admin JWT (not a player session token). Called via Next.js API routes at `/api/admin/action`.

| Action | Min Role | Description |
|--------|----------|-------------|
| `forceResolve` | moderator | UPDATE wager status → resolved with given winner; calls on-chain `resolve_wager` |
| `forceDraw` | moderator | UPDATE wager status → resolved as draw; calls on-chain `close_wager` |
| `forceCancel` | moderator | UPDATE wager status → cancelled; calls on-chain `close_wager` |
| `banPlayer` | admin | UPDATE player is_banned = true |
| `unbanPlayer` | admin | UPDATE player is_banned = false |

All actions write to both `admin_logs` and `admin_audit_logs` with before/after state.

---

### `resolve-wager`
Low-level on-chain settlement. Called by `admin-action` and by the Lichess webhook after a chess game completes. Not called directly by the frontend.

Performs:
1. Derives the WagerAccount PDA from `player_a_wallet` + `match_id`
2. Builds and sends `resolve_wager` instruction (90% → winner, 10% → platform)
3. Or `close_wager` instruction for draws/cancels (100% → both players)
4. Calls `update_winner_stats` / `update_loser_stats` DB RPCs
5. INSERTs `wager_transactions` records for the payout

---

## DB Triggers — Developer Gotchas

Four triggers fire automatically on DML. They **cannot be bypassed by the anon key** — only service role (used by edge functions) can write the protected fields.

### `protect_player_sensitive_fields` (BEFORE UPDATE on `players`)
Blocks direct client writes to: `is_banned`, `ban_reason`, `flagged_*`, `lichess_access_token`, `lichess_user_id`, `lichess_token_expires_at`.

**Symptom if you hit this:** Player update silently returns stale data or the field doesn't change. Write must go through `secure-player` or the Lichess OAuth callback route instead.

### `protect_wager_sensitive_fields` (BEFORE UPDATE on `wagers`)
Blocks direct client writes to: `status`, `winner_wallet`, `vote_player_a/b`, `deposit_player_a/b`, `resolved_at`, `cancelled_at`, `cancelled_by`.

**Symptom if you hit this:** Wager status update silently fails. All wager state transitions must go through `secure-wager`. This is by design — no frontend code should ever directly write wager status.

### `validate_player_insert` / `validate_wager_insert`
Validate new rows before insert. Enforce wallet address format, required fields, and basic business rules. If you see an unexpected 400 on player/wager creation, check these trigger conditions.

### `update_updated_at` / `update_updated_at_column`
Auto-refresh `updated_at` on any UPDATE. Two versions exist (`update_updated_at` and `update_updated_at_column`) — this is a legacy artefact from migration history. Both are active and harmless.

---

## Realtime Subscriptions

Four tables are in the `supabase_realtime` publication (confirmed live):

| Table | Channel Pattern | Used By |
|-------|----------------|---------|
| `wagers` | `game-events` (global) | `GameEventContext` — invalidates React Query cache on any change |
| `wager_transactions` | `wager-transactions:{wagerId}` | Ready Room deposit confirmation |
| `notifications` | `notifications:{walletAddress}` | `useNotifications` — bell icon dropdown |
| `wager_messages` | `wager-chat:{wagerId}` | `useWagerChat` — ready room chat + proposals |

> ⚠️ **Duplicate channel warning:** Never call `useWagerChat` for the same `wagerId` from both a parent and child component — Supabase silently drops duplicate channel names. The channel is created inside `useWagerChat` and must only exist once per wager per client session. Same applies to any other filtered channel. `GameCompleteModal` and `VotingModal` receive the live wager object from the React Query cache (kept fresh by `GameEventContext`) — they do NOT create their own Supabase subscriptions.

---

## Wager Chat & Proposals

The ready room includes a real-time chat and a wager edit proposal system, both backed by `wager_messages`.

**Chat flow:**
1. Player calls `sendMessage(text)` in `useWagerChat`
2. Direct INSERT to `wager_messages` with `message_type: 'chat'`
3. Opponent receives it instantly via Realtime INSERT event
4. `notifyChat` action fires a push notification to the opponent (rate-limited to 1 per 5 min per wager)

**Proposal flow:**
1. Player calls `sendProposal(wager, updates)` in `useWagerChat`
2. One `proposal` message inserted per changed field
3. Opponent sees pending proposals in their UI via Realtime
4. Opponent calls `respondToProposal(messageId, 'accepted' | 'rejected', proposalData, wagerId)`
5. On `'accepted'`: `applyProposal` is called on `secure-wager` — applies the change to the `wagers` row
6. On `'rejected'`: Only the `proposal_status` is updated to `'rejected'`

Supported proposal fields: `stake_lamports`, `is_public`, `stream_url`.

---

## Push Notifications

Push notifications are delivered via the Web Push API (VAPID) to players even when the tab is closed.

**Subscription flow:**
1. `useNotifications` calls `subscribeToPush(wallet)` on wallet connect
2. Requests browser notification permission if not already granted
3. Subscribes via `pushManager.subscribe({ applicationServerKey: vapidPublicKey })`
4. Upserts to `push_subscriptions` table keyed on `endpoint`

**Notification delivery:**
1. Edge function sends push notification using `VAPID_PRIVATE_KEY`
2. Browser's push service delivers to service worker (`/public/sw.js`)
3. Service worker shows OS notification via `showNotification()`
4. Click on notification navigates to `/my-wagers`

**Notification types:** `wager_joined`, `game_started`, `wager_won`, `wager_lost`, `wager_draw`, `wager_cancelled`.

---

## NFT Tier System

> ⚠️ **Correction:** The live DB `nft_tier` enum is `bronze | silver | gold | diamond`. Earlier docs incorrectly listed the top tier as `platinum`. **Diamond is the correct value.**

| Tier | Trigger |
|------|---------|
| `bronze` | First/basic victory |
| `silver` | 5+ consecutive wins |
| `gold` | 10+ consecutive wins |
| `diamond` | 20+ consecutive wins |

---

## DB Functions (RPC)

Callable via `.rpc()` on the Supabase client. Confirmed live in `information_schema.routines`.

| Function | Called By | Description |
|----------|-----------|-------------|
| `set_player_ready` | `secure-wager` (`setReady` action) | Atomic ready toggle + countdown start |
| `update_winner_stats` | `resolve-wager` | Increment wins, earnings, streak on players row |
| `update_loser_stats` | `resolve-wager` | Increment losses, total_spent, reset streak |
| `merge_game_bound_at` | `secure-player` | JSONB-merge a single game's bound timestamp without overwriting others (service role only) |

---

## Key Features

### Chess — Lichess OAuth PKCE
Players connect their Lichess account via OAuth PKCE — proves account ownership without sharing any password or token with GameGambit. When both players deposit their stakes and the wager enters `voting`, the platform automatically creates a locked Lichess game using a server-side platform token with `users=PlayerA,PlayerB`. Each player gets a per-color play link directly in the Ready Room. When the game ends on Lichess, GameGambit detects it within seconds and automatically pays out the winner on-chain.

**Flow:** Connect Lichess (OAuth) → Create Wager → Both Deposit → Game Auto-Created → Play on Lichess → Auto-Resolved → Winner Paid

---

### CODM / PUBG / Free Fire — Peer Voting Flow (Step 3)
Non-chess games resolve via a two-phase peer voting system. Both players play their external match, then return to the app to confirm and vote.

**Phase 1 — Game Complete Confirmation:**
1. Either player clicks "Confirm Game Complete" → `markGameComplete` in `secure-wager`
2. Server sets `game_complete_a` or `game_complete_b` on the wager row
3. When both are set, server writes `game_complete_deadline` (NOW + 10s) and `vote_deadline` (NOW + 5m 10s)
4. `GameCompleteModal` shows a live countdown synced to `game_complete_deadline`
5. Countdown hits 0 → parent component closes `GameCompleteModal`, opens `VotingModal`

**Phase 2 — Voting:**
1. Each player clicks their vote (Player A wins / Player B wins / Draw) → `submitVote`
2. Server evaluates both votes:
   - Same winner → calls `resolve-wager` on-chain instantly → status = `resolved`
   - Different winners → status = `disputed` → moderator assigned (Step 5)
3. Player can retract their vote (`retractVote`) only while opponent hasn't voted yet
4. If `vote_deadline` passes with no resolution → status = `disputed`

**Key implementation detail:** `GameCompleteModal` and `VotingModal` both receive the live `wager` object from React Query cache (kept fresh by `GameEventContext` Realtime subscription). No second Supabase subscription is created inside these modals.

**`deriveVoteOutcome(wager, myWallet)`** — utility in `useVoting.ts` that returns `'waiting' | 'pending' | 'agree' | 'disagree'` — drives the VotingModal UI state.

**Why `game_complete_deadline` exists:** Without it, both players' `VotingModal` countdowns could drift by a few seconds depending on when each client receives the Realtime update. The server-stamped deadline gives both clients the same reference point for the countdown.

---

### Wager Lifecycle

```
create → join → ready room (setReady + deposits) → startGame → voting → resolve / dispute / cancel
```

Chess path through `voting`:
```
startGame (Lichess game auto-created) → play on Lichess → webhook fires → resolve-wager on-chain
```

CODM / PUBG / Free Fire path through `voting`:
```
startGame → GameCompleteModal (both confirm) → 10s sync → VotingModal (5 min)
          → agree    = resolve-wager on-chain
          → disagree = status: disputed → moderator
```

### Error Recovery & Refunds
- **Cancel Wager**: Either player can cancel from ready room
- **Automatic Refunds**: Both players refunded on cancellation via `close_wager` on-chain
- **Error Logging**: All on-chain failures logged as `tx_type = 'error_*'` rows in `wager_transactions`

---

## API Reference

### Authentication
All player-facing edge function calls require a wallet session token in the header:
```javascript
headers: { 'X-Session-Token': sessionToken }
```

Session tokens are Ed25519 wallet signatures issued by `verify-wallet` and managed by `useWalletAuth`. They expire and trigger a `gg:session-expired` custom DOM event when stale.

### Edge Functions Summary

| Function | Path | Auth |
|----------|------|------|
| `secure-wager` | `/functions/v1/secure-wager` | Player session token |
| `secure-player` | `/functions/v1/secure-player` | Player session token |
| `admin-action` | `/api/admin/action` (Next.js route → edge fn) | Admin JWT |
| `resolve-wager` | Internal only (not called from frontend) | Service role |

### Key Next.js API Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/auth/lichess/callback` | Lichess OAuth PKCE callback |
| `POST` | `/api/admin/auth/login` | Admin login |
| `POST` | `/api/admin/auth/logout` | Admin logout |
| `POST` | `/api/admin/auth/signup` | Admin signup |
| `GET` | `/api/admin/auth/verify` | Verify admin session |
| `GET/PUT` | `/api/admin/profile` | Get/update admin profile |
| `POST` | `/api/admin/action` | Admin wager/player actions |
| `GET` | `/api/admin/audit-logs` | Fetch audit logs |
| `POST` | `/api/admin/wallet/bind` | Bind Solana wallet to admin |
| `POST` | `/api/admin/wallet/verify` | Verify admin wallet signature |

---

## Performance

Optimized for 200k+ MAUs:

| Query | Target | Strategy |
|-------|--------|----------|
| Player lookup | < 10ms | Indexed on `wallet_address` |
| Wager list | < 20ms | Indexed on `status`, `player_a_wallet` |
| Leaderboard (top 100) | < 50ms | Materialized view |
| Transaction history | < 50ms | Composite index on `wager_id` |
| Live feed | < 30ms | Supabase Realtime — no polling |

`GameEventContext` handles all wager Realtime subscriptions globally, keeping the React Query cache for `['wagers']` and `['wagers', 'open']` current without per-component polling.

---

## Rate Limiting

Per-wallet, per-endpoint sliding window via `rate_limit_logs`:

```typescript
const configs = {
  public: { windowMs: 60_000, maxRequests: 100 },
  api: { windowMs: 60_000, maxRequests: 50 },
  auth: { windowMs: 900_000, maxRequests: 5 },
  wagerCreation: { windowMs: 60_000, maxRequests: 10 },
};
```

`notifyChat` has an additional application-level rate limit: 1 push notification per wager per 5 minutes, enforced in `secure-wager` before calling the push service.

---

## Security

### Player Security
- All state transitions require a valid Ed25519 session token
- DB triggers (`protect_player_sensitive_fields`, `protect_wager_sensitive_fields`) prevent direct client writes to sensitive fields
- Lichess OAuth PKCE — no passwords or tokens shared with GameGambit
- RLS policies on `notifications` and `push_subscriptions`
- Rate limiting on wager creation and notifications
- Parameterized queries throughout (no SQL injection surface)

### Admin Panel Security
- PBKDF2 password hashing (100,000 iterations)
- httpOnly + Secure + SameSite session cookies with auto-refresh
- JWT tokens (Ed25519 signed) with expiry
- Ed25519 signature verification for Solana wallet binding
- Three-tier RBAC: moderator → admin → superadmin
- Complete audit trail in `admin_audit_logs` with IP + user agent + before/after state

---

## Deployment

```bash
# Deploy all edge functions
supabase link --project-ref your_project_ref
supabase functions deploy secure-wager
supabase functions deploy secure-player
supabase functions deploy admin-action
supabase functions deploy resolve-wager

# Frontend deploys automatically via Vercel on push to main
```

Set all edge function secrets in Supabase Dashboard → Edge Functions → Secrets before deploying.

See [`DEPLOYMENT_GUIDE.md`](./DEPLOYMENT_GUIDE.md) for the full checklist.

---

## Documentation Index

| File | Description |
|------|-------------|
| [`DB_SCHEMA.md`](./DB_SCHEMA.md) | All tables, triggers, RPCs, indexes, realtime |
| [`API_REFERENCE.md`](./API_REFERENCE.md) | Full REST + edge function API reference |
| [`DEPLOYMENT_GUIDE.md`](./DEPLOYMENT_GUIDE.md) | Production deployment checklist |
| [`DEVELOPMENT_GUIDE.md`](./DEVELOPMENT_GUIDE.md) | Local dev setup and workflows |
| [`PWA_GUIDE.md`](./PWA_GUIDE.md) | PWA setup, VAPID key generation, push notifications |
| [`CHANGE_LOGS.md`](./CHANGE_LOGS.md) | Version history |

---

## Roadmap

**Completed**
- [x] Chess — Lichess OAuth PKCE + Lichess game auto-creation + webhook auto-resolution
- [x] CODM / PUBG / Free Fire — peer voting flow (GameCompleteModal + VotingModal + secure-wager actions)
- [x] Push notifications — Web Push API (VAPID) + PWA service worker
- [x] Admin panel — dispute resolution, user management, audit trail, RBAC
- [x] Real-time arena + ready room + wager chat + proposals
- [x] In-app notifications (Supabase Realtime, bell dropdown)
- [x] Achievement badges + NFT tier system

**In Progress**
- [ ] Step 4 — Dispute grace period (24hr window before moderator auto-assigned)
- [ ] Step 5 — Moderator system (assignment queue, screenshot review, verdict, payout)
- [ ] Step 6 — Punishment system (strike tracking, auto-ban, admin escalation)

**Planned**
- [ ] Tournament / bracket mode
- [ ] Social share cards ("I just won X SOL")
- [ ] Weekly leaderboard rewards
- [ ] Mainnet deployment + multi-sig authority wallet
- [ ] Mobile app (React Native)
- [ ] Streaming integration (Twitch, YouTube)

---

**Made with ❤️ by Web3ProdigyDev**