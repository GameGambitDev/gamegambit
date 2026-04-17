---
title: Game Gambit Development Guide
description: Guide for developers contributing to Game Gambit
---

# Development Guide

This guide covers the development workflow, architecture decisions, and best practices for Game Gambit.

## Getting Started

### Local Development Setup

```bash
# Clone repository
git clone https://github.com/GameGambitDev/gamegambit.git
cd gamegambit

# Install dependencies
pnpm install

# Setup environment variables
cp .env.example .env.local

# Start development server
pnpm dev
```

Visit `http://localhost:3000` to see the app with hot reload enabled via Turbopack.

> **Note on package managers:** The repo includes a `bunfig.toml` but `pnpm` is the primary package manager used for development and CI. If you use `bun install`, the lockfile will regenerate — this is intentional per the bun config, but stick to `pnpm` for consistency.

### Environment Variables

Required variables for local development:

```env
# Solana (Devnet for testing)
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_PROGRAM_ID=E2Vd3U91kMrgwp8JCXcLSn7bt3NowDmGwoBYsVRhGfMR

# Supabase (local or staging)
NEXT_PUBLIC_SUPABASE_URL=<your_supabase_url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your_supabase_anon_key>
SUPABASE_SERVICE_ROLE_KEY=<your_service_role_key>

# Required for admin panel and Next.js API routes
ADMIN_JWT_SECRET=<min_32_char_secret>
AUTHORITY_WALLET_SECRET=<json_byte_array_keypair>
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Required for push notifications
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<your_vapid_public_key>

# OG image URL (used for dynamic per-wager og:image)
NEXT_PUBLIC_APP_URL=https://thegamegambit.vercel.app

# Required for Twitch stream embeds — sets the `parent` domain param in the Twitch player iframe URL.
# Without this, Twitch iframes fail silently on custom domains. Falls back to window.location.hostname for local dev.
NEXT_PUBLIC_APP_DOMAIN=thegamegambit.vercel.app

# Required for WalletConnect adapter — without this, wallet modal loads but WalletConnect silently fails to connect.
# Get a project ID at https://cloud.walletconnect.com
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=<your_walletconnect_project_id>

# Optional — enables live PUBG username verification
# Without this, PUBG binding falls back to manual confirmation
PUBG_API_KEY=<your_pubg_api_key>
```

> Edge function secrets (`AUTHORITY_WALLET_SECRET`, `LICHESS_PLATFORM_TOKEN`, `VAPID_PRIVATE_KEY`, etc.) are set in Supabase Dashboard → Edge Functions → Secrets — not in `.env.local`. See [`DEPLOYMENT_GUIDE.md`](./DEPLOYMENT_GUIDE.md) for the full list.

> `AUTHORITY_WALLET_SECRET` is also required in `.env.local` (as a Next.js server-side variable) because `/api/settings`, `/api/username/appeal`, `/api/username/appeal/respond`, and `/api/username/change-request` use it to validate session tokens — the same HMAC-SHA256 scheme as the edge functions.

---

## Project Architecture

### Full Project Structure

```
gamegambit/
├── src/
│   ├── app/                         # Next.js 15 App Router
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   ├── lichess/callback/  # Lichess OAuth PKCE callback
│   │   │   │   └── verify-wallet/     # Ed25519 wallet signature → session token
│   │   │   ├── admin/                 # Admin panel API routes only
│   │   │   │   ├── auth/              # login, logout, signup, verify, refresh
│   │   │   │   ├── profile/
│   │   │   │   ├── action/            # Proxies to admin-action edge function
│   │   │   │   ├── audit-logs/
│   │   │   │   └── wallet/            # bind, list, unbind, verify
│   │   │   ├── lichess/webhook/       # Lichess game result webhook
│   │   │   ├── pubg/
│   │   │   │   └── verify-username/   # PUBG API username lookup (optional key)
│   │   │   ├── settings/              # GET/PATCH player notification settings
│   │   │   └── username/
│   │   │       ├── appeal/            # POST — file username ownership appeal
│   │   │       │   └── respond/       # POST — holder releases or contests
│   │   │       └── change-request/    # POST — formal username rebind request
│   │   ├── itszaadminlogin/           # Full admin panel (separate auth system)
│   │   │   ├── login/
│   │   │   ├── signup/
│   │   │   ├── dashboard/
│   │   │   ├── profile/
│   │   │   ├── wallet-bindings/
│   │   │   ├── audit-logs/
│   │   │   ├── disputes/
│   │   │   ├── users/
│   │   │   ├── wagers/
│   │   │   ├── behaviour-flags/       # Phase 6 — player risk scores, false vote/dispute loss events
│   │   │   ├── username-appeals/      # Phase 6 — review username ownership appeals
│   │   │   ├── username-changes/      # Phase 6 — review username change requests
│   │   │   ├── on-chain/              # Live on-chain wager/player inspector — PDA lookup by wager UUID, match ID, or wallet address (force-dynamic)
│   │   │   ├── pda-scanner/           # Bulk PDA scanner — classifies each deposited wager as STUCK_FUNDS / ACTIVE_FUNDED / DISTRIBUTED / NOT_FOUND / PENDING_DEPOSIT / RPC_ERROR; configurable threshold + batch recovery UI
│   │   │   ├── stuck-wagers/          # Filtered view of wagers with funds stuck on-chain; configurable age threshold (1h–7d); bulk force-resolve / force-refund
│   │   │   └── unauthorized/
│   │   ├── arena/                     # Wager creation & lobby
│   │   ├── dashboard/
│   │   ├── events/                    # Airdrop / campaign page (v1.8.0)
│   │   ├── faq/
│   │   ├── feed/                      # Social feed — For You / Friends / Live Now (v1.8.0)
│   │   ├── invite/
│   │   │   └── [code]/                # Referral landing page (v1.8.0)
│   │   ├── leaderboard/
│   │   ├── messages/                  # DM inbox + realtime chat (v1.8.0)
│   │   ├── my-wagers/
│   │   ├── privacy/
│   │   ├── profile/
│   │   │   └── [walletAddress]/
│   │   ├── settings/                  # Player settings page (notifications, moderation)
│   │   ├── terms/
│   │   ├── wager/
│   │   │   └── [id]/
│   │   │       ├── page.tsx           # Spectator page + SideBetsPanel (v1.8.0)
│   │   │       ├── layout.tsx         # generateMetadata — dynamic OG title/desc (v1.8.0)
│   │   │       └── opengraph-image.tsx # Per-wager 1200×630 PNG via next/og (v1.8.0)
│   │   └── page.tsx                   # Landing page
│   │
│   ├── components/
│   │   ├── admin/                     # Admin UI components
│   │   ├── landing/                   # Hero, HowItWorks, LiveFeed, etc.
│   │   ├── layout/                    # Header, footer
│   │   ├── CreateWagerModal.tsx
│   │   ├── ReadyRoomModal.tsx         # Deposits + chat + proposals + countdown
│   │   ├── EditWagerModal.tsx
│   │   ├── LiveGameModal.tsx          # Lichess iframe embed
│   │   ├── GameResultModal.tsx
│   │   ├── GameAccountCard.tsx        # PUBG/CODM/Free Fire bind, appeal, change-request
│   │   ├── Gamecompletemodal.tsx      # Non-chess: both players confirm game done
│   │   ├── Votingmodal.tsx            # Non-chess: peer vote with 5-min countdown
│   │   ├── WagerChat.tsx
│   │   ├── WagerDetailsModal.tsx
│   │   ├── ModerationOrchestrator.tsx # Mounts once in Providers; coordinates popup → panel state
│   │   ├── ModerationRequestModal.tsx # 30s accept/decline popup with countdown ring
│   │   ├── ModerationPanel.tsx        # 5-step guided verdict workflow
│   │   ├── DisputeGraceModal.tsx      # Phase 6 — concession prompt before moderator search
│   │   ├── PunishmentNoticeModal.tsx  # Phase 6 — shown to dispute loser; offense count, tier, escalation ladder, "Report unfair verdict" button
│   │   ├── ReportModeratorModal.tsx   # Phase 6 — POST /api/moderation/report; min 10 chars; 409 treated as success (idempotent)
│   │   ├── SuspensionBanner.tsx       # Phase 6 — sticky top banner when player.is_suspended === true; shows time remaining; session-dismissible
│   │   ├── FollowButton.tsx           # Follow / Following (hover to unfollow); uses useFollows
│   │   ├── PlayerLink.tsx             # Renders a wallet address as /profile/[wallet] link with username or truncated address
│   │   ├── ShareCards.tsx             # Canvas-based 1200×630 PNG share cards (Win card + Airdrop card)
│   │   ├── PageTransition.tsx         # Framer Motion page-level fade-in wrapper
│   │   ├── ScrollToTop.tsx            # Auto-scrolls to top on route change
│   │   ├── ThemeToggle.tsx            # Dark/light mode toggle (app defaults to dark)
│   │   ├── NotificationsDropdown.tsx
│   │   ├── NFTGallery.tsx
│   │   ├── TransactionHistory.tsx
│   │   ├── UsernameEnforcer.tsx
│   │   ├── UsernameSetupModal.tsx
│   │   └── ui/                        # shadcn/ui primitives
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
│   │   ├── useAutoCreatePlayer.ts     # Auto-registers player on first wallet connect
│   │   ├── useDisputeGrace.ts         # Phase 6 — useConcede mutation for grace period concession
│   │   ├── useFollows.ts              # Asymmetric follow graph — follow/unfollow, follower/following counts, Realtime sync on follows:{wallet}. DISTINCT from useFriends (mutual approval). Powers feed "Friends & Following" tab
│   │   ├── useGameComplete.ts         # markGameComplete mutation (non-chess flow)
│   │   ├── useLichess.ts              # OAuth PKCE flow
│   │   ├── useModeration.ts           # ModerationRequest queries + accept/decline/verdict mutations
│   │   ├── useNFTs.ts
│   │   ├── useNotifications.ts        # Bell dropdown + Web Push subscription
│   │   ├── usePlayer.ts
│   │   ├── usePlayerSettings.ts       # GET/PATCH push + moderation toggles
│   │   ├── useQuickMatch.ts
│   │   ├── useSolanaProgram.ts        # Anchor program interaction
│   │   ├── useTransactions.ts         # wager_transactions queries
│   │   ├── useUsernameBinding.ts      # Phase 6 — exports useBindUsername, useUsernameAppeal, useSubmitChangeRequest mutations for game account bind/appeal/change flows
│   │   ├── useVoting.ts               # submitVote, retractVote, deriveVoteOutcome
│   │   ├── useWagerChat.ts            # Ready room chat + proposals
│   │   ├── useWagers.ts               # Wager queries + invokeSecureWager helper
│   │   ├── useWalletAuth.ts           # Ed25519 session token management
│   │   ├── useWalletBalance.ts
│   │   ├── useFriends.ts              # Mutual friend graph — sendRequest, accept/decline/remove, friendsList. Requires acceptance. Powers DMs + challenge invites. DISTINCT from useFollows (v1.8.0)
│   │   ├── useDirectMessages.ts       # DM channel queries + realtime (v1.8.0)
│   │   ├── useFeed.ts                 # Feed posts + reactions (v1.8.0)
│   │   └── useSideBets.ts             # Place/counter/accept/cancel side bets (v1.8.0)
│   │
│   ├── contexts/
│   │   ├── AdminAuthContext.tsx       # Single source of truth for admin session state — mounted once in admin layout. All admin hooks (useAdminAuth, useAdminSession) read from here. Never call /api/admin/auth/verify directly; use useAdminAuth() instead
│   │   ├── GameEventContext.tsx       # Global Realtime listener — keeps wager cache fresh
│   │   ├── WalletContext.tsx
│   │   ├── ModalContext.tsx
│   │   ├── PWAContext.tsx
│   │   └── BalanceAnimationContext.tsx  # Queues win/loss SOL delta to sessionStorage for wallet balance flash animation. GameResultModal calls queueAnimation({ delta, wagerId, type }) before navigating; balance display consumes it on next mount via useBalanceAnimation()
│   │
│   ├── lib/
│   │   ├── admin/
│   │   │   ├── auth.ts                # JWT sign/verify
│   │   │   ├── password.ts            # PBKDF2 hashing
│   │   │   ├── permissions.ts         # RBAC matrix
│   │   │   ├── validators.ts
│   │   │   └── wallet-verify.ts       # Ed25519 signature verification
│   │   ├── idl/                       # Solana IDL (gamegambit.json + gamegambit.ts)
│   │   ├── solana-config.ts           # Canonical PROGRAM_ID, AUTHORITY_PUBKEY, PLATFORM_WALLET_PUBKEY, PLATFORM_FEE_BPS, RETRACT_WINDOW_SECONDS, INSTRUCTION_DISCRIMINATORS, EVENT_DISCRIMINATORS, ACCOUNT_DISCRIMINATORS, WAGER_JOIN_EXPIRY_SECONDS. Single source of truth for all on-chain constants
│   │   ├── constants.ts               # GAMES config, WAGER_STATUS enum, STATUS_LABELS, MANUAL_GAMES, fee helpers (calculatePlatformFee, getPlatformFeeBps, getFeeTierLabel), formatSol, truncateAddress. ⚠️ Also exports a stale PROGRAM_ID — never import it; always use solana-config.ts
│   │   ├── rate-limiting.ts           # Sliding-window rate limiter. ⚠️ Uses in-memory Map store — resets on every Vercel cold start; not shared across concurrent function instances. Replace with Upstash Redis for distributed production limiting (tracked as C1 in fix plan)
│   │   ├── streamEmbed.ts             # getStreamEmbed(url) converts YouTube (full + youtu.be) and Twitch channel URLs into embeddable iframe src strings. Twitch embeds require NEXT_PUBLIC_APP_DOMAIN for the parent param; falls back to window.location.hostname
│   │   ├── confetti.ts                # triggerConfetti() (3s interval burst from both sides) and triggerCelebration() (big burst + two side bursts). Used in GameResultModal, LiveGameModal, UsernameSetupModal
│   │   ├── validation.ts              # All Zod schemas: usernameSchema, walletAddressSchema, gameTypeSchema, createWagerSchema, submitVoteSchema, bindUsernameSchema, usernameAppealSchema, appealResponseSchema, usernameChangeRequestSchema, updateSettingsSchema. Use validateWithError() throughout — do not define inline Zod schemas elsewhere
│   │   └── utils.ts
│   │
│   └── integrations/supabase/
│       ├── client.ts
│       ├── types.ts                   # Auto-generated — run supabase gen types after migrations
│       └── admin/                     # Admin DB operations (actions, audit, auth, sessions, wallets)
│
├── supabase/functions/
│   ├── secure-wager/    # All wager lifecycle actions (22 actions — see table below)
│   ├── secure-player/   # Player create/update/bindGame
│   ├── secure-bet/      # Spectator side bets: place/counter/accept/cancel/resolveForWager (v1.8.0)
│   ├── admin-action/    # Admin dispute resolution (forceResolve, forceRefund, markDisputed, banPlayer, etc.)
│   ├── resolve-wager/   # Low-level on-chain settlement (called by admin-action + Lichess webhook)
│   ├── check-chess-games/ # Cron-driven: polls active chess wagers every 60s, auto-resolves finished games
│   ├── assign-moderator/  # Fire-and-forget: assigns eligible moderator on dispute creation + timeout retry
│   ├── moderation-timeout/ # pg_cron every 60s: marks expired moderation requests, triggers reassignment
│   ├── process-verdict/   # On-chain settlement + punishment tiers after moderator verdict
│   └── process-concession/ # On-chain settlement for grace period concessions (no mod fee)
│   └── verify-wallet/   # Ed25519 wallet signature → JWT session token
│
├── public/
│   ├── manifest.json    # PWA manifest (shortcuts: Arena, Leaderboard, Dashboard)
│   └── sw.js            # Service worker (caching + push notification handler)
│
├── scripts/migrations/
│   └── 001_create_admin_tables.sql
│
├── bunfig.toml
├── gamegambit-setup.sql   # Single-shot full DB setup
├── next.config.ts
└── package.json
```

### `secure-wager` Actions Reference

All 22 actions handled by the `secure-wager` edge function:

| Action | Auth Required | Description |
|--------|:---:|-------------|
| `create` | ✓ | Create a new wager row |
| `join` | ✓ | Player B joins an open wager |
| `vote` | ✓ | Legacy vote (kept for compatibility) |
| `edit` | ✓ | Edit wager fields directly (pre-join) |
| `applyProposal` | ✓ | Accept a chat proposal and apply the field change |
| `notifyChat` | ✓ | Send push notification for a new chat message |
| `notifyProposal` | ✓ | Send push notification for a new proposal |
| `notifyRematch` | ✓ | Send push notification for a rematch request |
| `delete` | ✓ | Soft-delete an unjoined wager |
| `setReady` | ✓ | Toggle player ready state in the ready room |
| `startGame` | ✓ | Trigger Lichess game creation (chess only) |
| `recordOnChainCreate` | ✓ | Record on-chain create TX in `wager_transactions` |
| `recordOnChainJoin` | ✓ | Record on-chain join TX in `wager_transactions` |
| `checkGameComplete` | ✗ | Poll Lichess API for chess game result; called by `check-chess-games` cron function |
| `cancelWager` | ✓ | Cancel wager and trigger on-chain refund |
| `markGameComplete` | ✓ | Non-chess: player signals game is done; triggers shared countdown when both confirm |
| `submitVote` | ✓ | Non-chess: submit winner vote; resolves or disputes based on both votes |
| `retractVote` | ✓ | Non-chess: retract own vote (only before opponent has voted) |
| `concedeDispute` | ✓ | Phase 6: concede during grace period — resolves on-chain instantly, no moderator fee, logs honesty event to `player_behaviour_log` |
| `finalizeVote` | ✓ | Triggers on-chain `resolve_wager` when wager is in `retractable` status and the 15s retract window has passed without a retraction |
| `voteTimeout` | ✓ | Called when `vote_deadline` has passed with no resolution — sets status → `disputed` and triggers moderator assignment |
| `declineChallenge` | ✓ | Player B declines an open wager (status = `created` only); soft-deletes the wager and fires `wager_declined` notification to Player A |

### `secure-player` Actions Reference

| Action | Description |
|--------|-------------|
| `create` | Register new player row on first wallet connect |
| `update` | Update profile fields (username, bio, avatar, game usernames via direct update) |
| `bindGame` | Dedicated game account binding for PUBG/CODM/Free Fire — checks uniqueness, calls `merge_game_bound_at` RPC, returns `USERNAME_TAKEN` if conflict |

### `admin-action` Actions Reference

| Action | Description |
|--------|-------------|
| `forceResolve` | Force-resolve a disputed wager with a given winner wallet; calls on-chain `resolve_wager` |
| `forceRefund` | Force-refund both players; calls on-chain `close_wager` |
| `markDisputed` | Manually set wager status to `disputed` |
| `banPlayer` | Set `is_banned = true` on a player row |
| `unbanPlayer` | Clear ban on a player row |
| `flagPlayer` | Set `flagged_for_review = true` with a reason |
| `checkPdaBalance` | Inspect the on-chain WagerAccount PDA balance for a wager |
| `unflagPlayer` | Clear `flagged_for_review` and `flag_reason` on a player row |
| `addNote` | Insert a row into `admin_notes` for a player or wager |

> The admin panel's `/api/admin/action` route proxies these to the `admin-action` edge function. It accepts both snake_case (`force_resolve`) and camelCase (`forceResolve`) action names and normalises them before forwarding.

---

## Critical Architecture Pattern: Edge Functions + Next.js API Routes

> ⚠️ **This is the most important pattern to understand before writing any new feature.**

**Player-facing write operations go through Supabase edge functions — NOT Next.js API routes.**

Next.js API routes in this project handle the following things:

1. Lichess OAuth PKCE callback (`/api/auth/lichess/callback`)
2. Admin panel auth and actions (`/api/admin/*`)
3. Wallet signature → session token (`/api/auth/verify-wallet`)
4. PUBG username verification (`/api/pubg/verify-username`) — calls PUBG API server-side so the API key is never exposed to the client
5. Player notification settings (`/api/settings`) — GET/PATCH for `push_notifications_enabled` and `moderation_requests_enabled`
6. Username ownership appeals (`/api/username/appeal`) — file an appeal against another player's held username
7. Appeal response (`/api/username/appeal/respond`) — holder releases or contests a filed appeal
8. Username change requests (`/api/username/change-request`) — formal request to rebind a game account

Everything else — creating wagers, joining, voting, cancelling, chat, proposals, recording on-chain transactions, game account binding — goes through Supabase edge functions.

This is enforced by DB triggers that block direct client writes. See [DB Triggers — Developer Gotchas](#db-triggers--developer-gotchas) below.

---

## Key Design Patterns

### 1. Session Token Authentication

`useWalletAuth` manages an Ed25519-signed JWT stored in `localStorage` under `gg_wallet_session`. It checks expiry on load and fires a `gg:session-expired` DOM event when stale.

All edge function calls require the token in the `X-Session-Token` header:

```typescript
const { sessionToken, verifyWallet } = useWalletAuth()

const result = await invokeSecureWager(
  { action: 'create', ...payload },
  sessionToken
)
```

The Next.js API routes for settings and username operations use the same token format and validate it using `AUTHORITY_WALLET_SECRET` server-side — the same HMAC-SHA256 scheme as the edge functions.

### 2. React Query + GameEventContext for Wager State

The project uses `@tanstack/react-query` (not SWR) for data fetching. `GameEventContext` runs a global Supabase Realtime subscription on `wagers` and calls `queryClient.invalidateQueries(['wagers'])` on any change. This keeps all wager data fresh across the app without per-component polling.

`GameEventContext` also holds a stable ref to `useCheckGameComplete` (from `useWagers`) and uses it to forward chess game checks triggered by Realtime updates — avoiding duplicate polling from individual components.

```typescript
// Don't set up your own wager subscription in a component
// GameEventContext already handles it globally
const { data: wagers } = useQuery(['wagers', 'open'], fetchOpenWagers)
// This auto-refreshes when any wager changes — no extra setup needed
```

### 3. Non-Chess Peer Voting Flow

CODM, PUBG, and Free Fire wagers use a two-phase flow after the external game ends.

**Phase 1 — Game Complete Confirmation:**
Each player calls `markGameComplete` via `useMarkGameComplete()`. When both players confirm, `secure-wager` stamps `game_complete_deadline` (NOW + 10s) and `vote_deadline` (NOW + 5m 10s). The `GameCompleteModal` component drives this phase and shows the shared countdown.

**Phase 2 — Voting:**
`VotingModal` opens automatically once the countdown fires. Each player calls `submitVote` via `useSubmitVote()`. `deriveVoteOutcome()` in `useVoting.ts` derives the UI state from the wager's vote fields without an extra query.

```typescript
// Derive vote state from wager data you already have
const outcome = deriveVoteOutcome(wager, myWallet)
// Returns: 'waiting' | 'pending' | 'agree' | 'disagree'
```

Players can retract a vote with `useRetractVote()` only while the opponent hasn't voted yet. Do not allow retraction once both votes are in — the outcome is final at that point.

### 4. Game Account Binding

PUBG, CODM, and Free Fire accounts are bound via `GameAccountCard`. The flow differs by game:

- **PUBG**: Calls `/api/pubg/verify-username` first (server-side PUBG API lookup). If `PUBG_API_KEY` is not configured, returns `valid: null` and the UI falls back to a manual confirmation flow identical to CODM.
- **CODM / Free Fire**: Manual bind only — player confirms the username is theirs via four consent checkboxes.

After user confirmation, `secure-player` `bindGame` action is called. If the username is already taken by another wallet, the edge function returns `USERNAME_TAKEN` and the UI enters the **appeal flow**:

1. Player clicks "File Appeal" → `/api/username/appeal` creates a `username_appeals` row and notifies the holder
2. Holder sees a notification and responds at `/api/username/appeal/respond` with `release` or `contest`
3. If contested, it enters moderator review in the admin panel

Players can also submit a formal change request (to rebind an already-linked account) via the "Request Change" flow in `GameAccountCard`, which calls `/api/username/change-request`. A max of 2 approved/pending requests per game per rolling 12-month window is enforced server-side.

### 5. Player Settings

`usePlayerSettings` manages the two notification toggles (`push_notifications_enabled`, `moderation_requests_enabled`) via `/api/settings`. The hook uses optimistic updates and is gated on `!!sessionToken` to avoid a flood of 401s before the user has signed the verification message.

```typescript
const { settings, updateSettings, isUpdating } = usePlayerSettings()

await updateSettings({ pushNotificationsEnabled: false })
```

The hook translates between camelCase (TypeScript) and snake_case (API/DB) automatically.

### 6. Player B Deposit Ordering — `runDepositFlow` in `ReadyRoomModal`

> ⚠️ **Player B must never call `join_wager` before Player A's `create_wager` has confirmed on-chain.**

The `join_wager` instruction reads `stake_lamports` directly from the `WagerAccount` PDA that `create_wager` initialises. If that PDA doesn't exist yet, the Solana program falls back to the minimum rent value (~0.00008 SOL) — Player B deposits the wrong amount regardless of what the frontend passes.

**How it's handled:** Inside `runDepositFlow`, Player B polls `wagerRef.current.deposit_player_a` every 2 seconds before calling `joinWagerOnChain`. `wagerRef` stays in sync with the live Supabase Realtime wager object, so the poll resolves as soon as `recordOnChainCreate` writes `deposit_player_a = true`. The countdown and Ready button are unaffected — Player B still marks ready and the countdown fires normally; the wait happens silently inside the deposit flow.

**If you move deposit logic:** Any future refactor that calls `join_wager` must preserve this ordering guarantee.

---

### 7. Dispute Grace Period + Punishment System (Phase 6)

When `submitVote` detects a vote mismatch (both votes in but they disagree), it sets `status = 'disputed'` and calls `assign-moderator` fire-and-forget. Simultaneously, the frontend shows `DisputeGraceModal` to both players.

**Grace period concession flow:**
```typescript
// Either player can concede — this triggers process-concession on-chain
await invokeSecureWager({ action: 'concedeDispute', wagerId }, sessionToken)
// No moderator fee. Honesty logged to player_behaviour_log.
// Moderator search continues silently in background — process-concession wins the race.
```

If nobody concedes, the moderator accepts and submits a verdict. `process-verdict` then calls `applyPunishment()` on the losing player, incrementing their `dispute_loss` offense count in `punishment_log` and applying the appropriate tier:

| Offense # | Punishment applied |
|-----------|-------------------|
| 1 | Warning (no suspension, `is_suspended` stays false) |
| 2 | 24h suspension |
| 3 | 72h suspension |
| 4 | 7-day (168h) suspension |
| 5+ | Indefinite ban (`suspension_ends_at` = null) |

`applyPunishment` is intentionally non-critical — it catches its own exceptions and never fails the verdict settlement. If you add new offense types, mirror the same `punishment_log` insert + `player_behaviour_log` insert pattern.

**`cannot_determine` verdicts:** Skip on-chain action and punishment. The wager stays `disputed` and escalates to admin review. The moderator earns no fee.

---

### 8. Supabase Realtime — Avoid Duplicate Channels

Four tables have Realtime enabled: `wagers`, `wager_transactions`, `notifications`, `wager_messages`.

> ⚠️ **Never mount `useWagerChat` (or any hook that creates a named channel) for the same `wagerId` from both a parent and child component.** Supabase silently drops duplicate channel subscriptions — one of the listeners will simply never fire.

```typescript
// ❌ Wrong: both ReadyRoomModal and WagerChat create the same channel
<ReadyRoomModal wagerId={id} />  // creates wager-chat:{id}
  <WagerChat wagerId={id} />     // also tries to create wager-chat:{id} — DROPPED

// ✓ Correct: only one component owns the channel
<ReadyRoomModal wagerId={id} />  // owns and manages the channel
  <WagerChat messages={messages} onSend={sendMessage} />  // receives props
```

### 10. Follow vs Friends — Two Separate Systems

`useFollows` and `useFriends` are **not interchangeable**. They read from separate tables and have different semantics:

- **`useFollows`** — Asymmetric. No approval needed. Player A can follow Player B without B following back. Writes to the `follows` table. Powers the feed's "Friends & Following" tab and the `FollowButton` component. Fires `new_follower` notification.
- **`useFriends`** — Mutual. Requires acceptance. Both players must agree before a friendship is recorded. Powers DMs (`useDirectMessages`) and challenge invites. Fires `friend_request` / `friend_accepted` notifications.

Do NOT conflate them. The feed tab is intentionally called "Friends & Following" because it merges both graphs — mutual friends and one-way follows — but each is queried separately.

---

### 11. `AdminAuthContext` — Don't Call `verify()` Directly

`AdminAuthContext` (`src/contexts/AdminAuthContext.tsx`) is mounted once in `src/app/itszaadminlogin/layout.tsx`. It is the single source of truth for admin session state — it calls `/api/admin/auth/verify` on mount and on tab focus.

All admin hooks (`useAdminAuth`, `useAdminSession`) read from this context. They do **not** each make their own verify call.

```typescript
// ✓ Correct — read from context via the hook
const { admin, isAuthenticated } = useAdminAuth()

// ❌ Wrong — bypasses context, causes duplicate verify calls and stale state
const res = await fetch('/api/admin/auth/verify', { ... })
```

If you add a new admin page, wrap it in `ProtectedRoute` (which reads `isAuthenticated` from this context). Never call `verify()` manually from a page or component.

---

### 12. `useWalletReady` — Gate Wallet-Dependent UI Without Hydration Flicker

`useWalletReady()` (exported from `src/providers.tsx`) returns `true` once the wallet adapter is connected, or after an 800ms timeout — whichever comes first.

Use this to gate UI that depends on wallet state rather than checking `connected` directly:

```typescript
// ✓ Correct — no flicker, no SSR mismatch
const walletReady = useWalletReady()
if (!walletReady) return <Skeleton />

// ❌ Avoid — `connected` is false on first SSR render, causes layout shift
if (!connected) return null
```

The 800ms timeout ensures that if the user isn't connecting a wallet, wallet-gated UI still renders (in its disconnected state) rather than staying blank indefinitely.

---

### 9. Type Safety

Types have two sources:

- `src/integrations/supabase/types.ts` — auto-generated from the live DB schema
- Manual interfaces in individual hooks — because v1.5.0 tables (`wager_messages`, `moderation_requests`, `username_appeals`, `username_change_requests`, `punishment_log`, `player_behaviour_log`) and new columns on `players`/`wagers` are not yet in the generated types

**Tables/columns with `as any` workarounds (until types are regenerated):**

| Location | Reason |
|----------|--------|
| `useWagerChat.ts` — `WagerMessage` interface | `wager_messages` not in generated types |
| `src/app/api/settings/route.ts` | `push_notifications_enabled`, `moderation_requests_enabled` new columns |
| `usePlayerSettings.ts` | Same new columns |
| `useWagers.ts` — `Wager` interface | New v1.5.0 wager columns (game_complete_*, vote_deadline, dispute_created_at) |
| `src/app/api/username/appeal/route.ts` | `username_appeals`, `player_behaviour_log` new tables |
| `src/app/api/username/change-request/route.ts` | `username_change_requests`, `player_behaviour_log`, `is_suspended` column |

After any DB migration, regenerate to clear all gaps:

```bash
supabase gen types typescript --project-id your_project_ref > src/integrations/supabase/types.ts
```

---

## DB Triggers — Developer Gotchas

Four triggers fire automatically on DML. They **cannot be bypassed by the anon key** — only the service role (used by edge functions) can write the protected fields.

### `protect_wager_sensitive_fields` (BEFORE UPDATE on `wagers`)

Blocks direct client writes to: `status`, `winner_wallet`, `vote_player_a/b`, `deposit_player_a/b`, `resolved_at`, `cancelled_at`, `cancelled_by`.

**Symptom if you hit this:** Wager status update silently returns the old value. No error is thrown.

**Fix:** All wager state transitions must go through `secure-wager`. Never update wager status from the client directly.

### `protect_player_sensitive_fields` (BEFORE UPDATE on `players`)

Blocks direct client writes to: `is_banned`, `ban_reason`, `flagged_*`, `lichess_access_token`, `lichess_user_id`, `lichess_token_expires_at`.

**Symptom:** Player field update silently doesn't stick.

**Fix:** Use `secure-player` edge function for profile updates, or the Lichess OAuth callback route for Lichess fields.

### `validate_player_insert` / `validate_wager_insert`

Enforce wallet address format, required fields, and business rules on INSERT. If you see an unexpected error on creation, check these conditions first.

### `update_updated_at` / `update_updated_at_column`

Auto-refresh `updated_at` on any UPDATE. Two variants exist from migration history — both active, both harmless.

---

## Development Workflow

### Adding a New Feature

1. **Create the database migration** (if needed)
   ```bash
   supabase migration new add_feature_table
   supabase db push
   ```

2. **Regenerate TypeScript types**
   ```bash
   supabase gen types typescript --project-id your_project_ref > src/integrations/supabase/types.ts
   ```

3. **Add the edge function action** (for any write operation)

   Add a new `if (action === 'myNewAction')` block to `secure-wager/index.ts` or create a new function in `supabase/functions/`:
   ```typescript
   if (action === 'myNewAction') {
     // Validate session token (already done by the function wrapper)
     // Perform DB operation with service role client
     // Return result
     return respond({ ok: true })
   }
   ```

4. **Call from the frontend via `invokeSecureWager`**
   ```typescript
   const result = await invokeSecureWager<{ ok: boolean }>(
     { action: 'myNewAction', ...payload },
     sessionToken
   )
   ```

5. **For new Next.js API routes** (settings, username ops, PUBG-style server-side calls): validate the session token using the HMAC-SHA256 pattern from `src/app/api/settings/route.ts`. The `validateSessionToken` function is copy-pasted across these routes — if you need to change the token scheme, update all of them.

6. **Update documentation**
   - Update this guide's structure tree and action tables
   - Update `API_REFERENCE.md` if adding endpoints

### `next.config.ts` — Things to Know

- **Webpack fallbacks** — `fs: false, net: false, tls: false` are required for Solana Web3.js in the Next.js browser bundle. Don't remove them.
- **Image domains** — `lichess.org`, `*.lichess.org`, `*.supabase.co` (for avatars), and `gateway.pinata.cloud` (for NFT images via IPFS/Pinata) are whitelisted. Add new domains here when needed.
- **Service worker headers** — `sw.js` is served with `Cache-Control: no-cache` and `manifest.json` with `Content-Type: application/manifest+json`. These are required for PWA install prompts to work correctly.

### `solana-config.ts` — Things to Know

This file is the single source of truth for all on-chain constants:

```typescript
PROGRAM_ID         // E2Vd3U91kMrgwp8JCXcLSn7bt3NowDmGwoBYsVRhGfMR
AUTHORITY_PUBKEY   // Ec7XfHbeDw1YmHzcGo3WrK73QnqQ3GL9VBczYGPCQJha
PLATFORM_WALLET_PUBKEY  // 3hwPwugeuZ33HWJ3SoJkDN2JT3Be9fH62r19ezFiCgYY
PLATFORM_FEE_BPS   // 1000 (10%)
RETRACT_WINDOW_SECONDS  // 15 (matches lib.rs)
MODERATOR_POPUP_SECONDS // 30 (auto-reject window for moderation requests)
MODERATOR_FEE_SHARE_PERCENT // 30 (moderator gets 30% of platform fee)
```

The instruction discriminators are also here — if you ever redeploy the Anchor program, update these from the new IDL. Using a stale discriminator will cause silent transaction failures.

### Code Standards

#### TypeScript

- Use strict mode: `"strict": true`
- Avoid `any` — the intentional exceptions are documented in the type safety table above. Don't add new `as any` casts without a comment explaining why and a note that types need regenerating.
- Export types from a single location
- The `Wager` interface in `useWagers.ts` and `WagerMessage` in `useWagerChat.ts` are the authoritative TypeScript shapes for those tables until generated types catch up

#### React

- Functional components only
- Use React Query for data fetching, not SWR (`@tanstack/react-query` v5)
- Avoid prop drilling — use context for shared state
- Don't create Supabase Realtime channels in components — use the existing hooks
- `GameCompleteModal` and `VotingModal` receive the wager as a prop and rely on `GameEventContext` for live updates — they do not create their own subscriptions

#### Edge Functions

- All player write operations must go through edge functions (see architecture pattern above)
- Always validate the `X-Session-Token` header — the function wrapper handles this, don't skip it
- `checkGameComplete` is the only unauthenticated action — it's called by the `check-chess-games` cron function which doesn't have a user session token
- Use the service role client for DB writes, not the anon client

---

## Testing

```bash
# Run linter
pnpm lint

# Type check (no test suite — verify types instead)
pnpm tsc --noEmit

# Build check
pnpm build
```

> There is no automated test suite. Before committing, confirm: no TypeScript errors, no lint warnings, build succeeds.

---

## Performance Optimization

### Database Queries

```typescript
// ✓ Good: Selective fields, indexed lookup
supabase.from('players').select('id, username, total_wins').eq('wallet_address', wallet)

// ❌ Avoid: Full scan or wildcard select on large tables
supabase.from('players').select('*').ilike('username', `%${q}%`)
```

### Realtime — Use GameEventContext

Don't subscribe to `wagers` Realtime in individual components. `GameEventContext` already handles this globally and invalidates the React Query cache for all wager queries. `GameCompleteModal` and `VotingModal` both rely on the parent passing a live wager object rather than subscribing themselves.

### Caching Strategy

```typescript
// Wager list — invalidated automatically by GameEventContext
useQuery(['wagers', 'open'], fetchOpenWagers, { staleTime: 30_000 })

// Leaderboard — changes slowly
useQuery(['leaderboard'], fetchLeaderboard, { staleTime: 60_000 })

// Player profile — changes infrequently
useQuery(['player', wallet], fetchPlayer, { staleTime: 120_000 })

// Player settings — stable, poll rarely
useQuery(['playerSettings', wallet], fetchSettings, { staleTime: 300_000 })
```

---

## Git Workflow

### Branch Naming

- Feature: `feature/short-description`
- Bug fix: `fix/short-description`
- Documentation: `docs/short-description`

### Commit Messages

```
feat: add peer voting flow for non-chess wagers
feat: add PUBG username verification via API
fix: prevent duplicate wager chat channel subscriptions
docs: update API reference for username appeal routes
refactor: extract GameAccountCard from profile page
```

---

## Debugging

### Console Logging

Structured logging pattern used throughout:

```typescript
console.log('[secure-wager] Action: markGameComplete', { wagerId })
console.error('[usePlayerSettings] PATCH error:', error.message)
console.log('[check-chess-games] wager {id}: gameComplete=true resultType=mate')
```

### Solana Transactions

```bash
# Check a devnet transaction
solana config set --url https://api.devnet.solana.com
solana confirm <tx_signature>
```

Or use the Solana Explorer: `https://explorer.solana.com/tx/<sig>?cluster=devnet`

### Edge Function Logs

```bash
supabase functions logs secure-wager --tail
supabase functions logs resolve-wager --tail
supabase functions logs check-chess-games --tail
```

### Session Token Issues

If edge function calls return 401 unexpectedly, the session token may be expired. Listen for the `gg:session-expired` DOM event:

```typescript
window.addEventListener('gg:session-expired', () => {
  // Re-trigger verifyWallet()
})
```

The same 401 → `gg:session-expired` dispatch is in `invokeSecureWager`. The Next.js API routes (`/api/settings`, `/api/username/*`) return a 401 JSON response but do not dispatch the event — handle them separately in the calling hook.

### DB Write Not Sticking

If a DB update appears to succeed but the field doesn't change, you've hit a trigger. Check:
1. Is the field in `protect_wager_sensitive_fields` or `protect_player_sensitive_fields`?
2. Are you using the anon client? Triggers only allow the service role to write protected fields.

Route the write through the appropriate edge function instead.

---

## Common Issues & Solutions

### Wallet not connecting
Check `NEXT_PUBLIC_SOLANA_RPC_URL` is accessible and `NEXT_PUBLIC_SOLANA_NETWORK` matches the deployed program network (currently `devnet`).

### Edge function returns 401
Session token is missing or expired. Call `verifyWallet()` from `useWalletAuth` to re-authenticate, or check that `X-Session-Token` is being passed in the request header.

### Next.js API route returns 401 (settings / username routes)
`AUTHORITY_WALLET_SECRET` is missing from `.env.local`. These routes use the same HMAC-SHA256 validation as edge functions but run in the Next.js server process, not Supabase — so the secret must be in both places.

### Wager status update silently fails
You're writing directly to a protected field. Route through `secure-wager` edge function. See [DB Triggers — Developer Gotchas](#db-triggers--developer-gotchas).

### VotingModal never opens
Check `game_complete_a` and `game_complete_b` on the wager. Both must be true and `game_complete_deadline` must be stamped before the countdown and voting flow begin. If one player's confirmation didn't register, check edge function logs for a `markGameComplete` error.

### `usePlayerSettings` always returns defaults, never loads real data
The query is gated on `!!sessionToken`. If the user hasn't signed the verification message yet, it will use placeholder data. The query fires automatically once a session token exists in cache.

### PUBG username verification always returns `valid: null`
`PUBG_API_KEY` is not set in the environment. This is intentional — the UI falls back to a manual confirmation flow. Set the key if you want live API verification.

### Username bind returns `USERNAME_TAKEN`
The username is already linked to another wallet. The client should enter the appeal flow — call `/api/username/appeal`. Do not allow the bind to proceed silently.

### Push notifications not working
Check that `NEXT_PUBLIC_VAPID_PUBLIC_KEY` has no leading/trailing whitespace (Vercel's env UI can inject it silently). `useNotifications` logs a format warning if it detects this.

### `wager_messages` missing from types
This table (and all v1.5.0 tables) isn't in the generated types yet. Use the manually typed interfaces until `supabase gen types` is re-run. See the type safety table above.

### Realtime channel not firing
You likely have a duplicate channel name. Check that no two mounted components subscribe to the same `wager-chat:{wagerId}` or `notifications:{wallet}` channel simultaneously.

### Rate limiting errors
Application-level rate limits are enforced in edge functions. `notifyChat` is capped at 1 push notification per wager per 5 minutes. For general API rate limits, implement exponential backoff.

---

## Resources

- [Next.js Docs](https://nextjs.org/docs)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Supabase Realtime](https://supabase.com/docs/guides/realtime)
- [Anchor Docs](https://www.anchor-lang.com)
- [Solana Web3.js](https://solana-labs.github.io/solana-web3.js/)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [TanStack Query v5](https://tanstack.com/query/latest)
- [PUBG API Docs](https://documentation.pubg.com/en/introduction.html)

---

**Last Updated**: April 2026 — v1.8.0