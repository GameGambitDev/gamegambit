---
title: Game Gambit Changelog
description: Version history and release notes
---

# Changelog

All notable changes to Game Gambit are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.8.0] — April 2026

### Hackathon Sprint — Social, Sharing & Spectator Economy

---

### Bug Fixes

**Bug 1 — Free Fire broken in `WagerDetailsModal`**
Free Fire game data was missing from the `getGameData` switch in `WagerDetailsModal.tsx`, causing the modal to render empty for Free Fire wagers.
Fix: Added `free_fire` case returning `GAMES.FREE_FIRE`.

**Bug 2 — Chat starts open by default**
Ready room chat panel initialised as open, pushing layout content down on load.
Fix: `chatOpen` initial state changed to `false`.

**Bug 3 — OG image was just the logo**
`layout.tsx` root metadata used a static logo PNG for all pages.
Fix: Dynamic per-wager OG image via `src/app/wager/[id]/opengraph-image.tsx` (see Task 11). Root layout still uses the static logo; wager pages now override it.

**Bug 4 — TS2882 CSS import errors**
CSS module imports in several components triggered TS2882 type errors during build.
Fix: Moved global CSS imports to `app/layout.tsx`; converted affected components to Tailwind-only styling.

**Bug 5 — Spectator page `RealtimeChannel` type error**
`ReturnType<ReturnType<typeof supabase.channel>>` produced a TS constraint error in `wager/[id]/page.tsx`.
Fix: Channel variable typed as `any`.

**Bug 6 — `useSideBets` `RealtimeChannel` type error**
Same constraint error as Bug 5, in `src/hooks/useSideBets.ts`.
Fix: Channel variable typed as `any`.

---

### TASK 1 — Live Platform Stats Bar

Real-time stats bar on the landing page showing live platform activity:
- Total wagers created, total SOL wagered, active players online
- Supabase Realtime subscription — updates without polling
- Platform stats computed from `players` + `wagers` tables

---

### TASK 2 — Free Fire Fully Wired

- Free Fire icon, name, and platform data correctly resolved across all modals
- `WagerDetailsModal`, arena page, `getGameData` helpers updated
- Free Fire wagers now display correctly end-to-end

---

### TASK 3 — Spectator / Share Links

- Public spectator page at `/wager/[id]` — shareable, no login required
- Shows: game, players, stake, pot, status, Lichess live board (chess), result banner
- Supabase Realtime live updates for wager status changes
- Copy Link button on spectator page and in arena wager cards

---

### TASK 4 — Social Feed Page

**New Page — `/feed`**
Three-tab feed: For You, Friends, Live Now.

- Win cards, stream cards, live wager cards with inline Twitch/YouTube embeds
- Gaming reactions (🔥💀🐐👀) via `feed_reactions` table
- Spectator count via Supabase Realtime presence per wager channel
- Feed + Messages links added to navbar
- Landing page LiveFeed "View All" → `/feed`

**New DB Tables**
- `feed_reactions` — per-post reaction counts and user reactions
- `friendships` — bidirectional friendship graph
- `direct_messages` — DM messages per conversation
- `spectator_bets` — spectator side bet records (see Task 10)

**New Types** — all added to `src/integrations/supabase/types.ts`.

---

### TASK 5 — Rematch System

- `handleRematch` on arena page — creates a new wager pre-filled with same game/stake
- `GameResultModal` Rematch button with loading state + disabled-after-click
- On rematch: navigates to `/arena?wager=ID&modal=details` to pre-open wager details

---

### TASK 5b — Feed Like/Unlike + Reaction Notifications

- Unlike correctly toggles delete when `alreadyReacted` is true
- 10-minute digest notification guard in `useToggleReaction` — prevents spam
- `feed_reaction` notification type added to `AppNotification` + `NotificationsDropdown`
- `wagerOwnerWallet` passed to all three `ReactionsBar` instances in `FeedView`

---

### TASK 9 — Friends System

**Part A — Core Hooks + DB**
- `src/hooks/useFriends.ts` — `sendRequest`, `accept`, `decline`, `remove`, `friendsList`, `pendingRequests`
- `useDirectMessages` + `getDmChannelId` exported
- `useUnreadDmCount` exported
- SQL migration: `friendships` + `direct_messages` tables with RLS

**Part B — UI Components**
- `src/components/FriendButton.tsx` — four states: add / pending / accept / friends+remove
- Wired into: FeedView player names, leaderboard rows, public profile header
- `friend_request` + `friend_accepted` notification types added

**Part C — Messages Page**
- `src/app/messages/page.tsx` — split-pane inbox + realtime DM chat
- Wrapped in `Suspense`
- Auto-opens from `?with=WALLET` query param
- Challenge button in DM header → `/arena?challenge=WALLET`
- Header unread DM badge via `useUnreadDmCount`

---

### TASK 6 — Referral / Invite System

- `supabase/migrations/task6_referral.sql` — adds `invite_code`, `referred_by_wallet`, `referral_count` + indexes
- `invite_code` auto-generated on player create (wallet prefix + random hex suffix)
- `useAutoCreatePlayer` reads `gg_referrer` cookie, passes `referrerCode` to create, clears after use
- `secure-player` create action: looks up referrer by `invite_code`, links `referred_by_wallet`, increments `referral_count`
- `src/app/invite/[code]/page.tsx` — public landing page, shows referrer stats, sets cookie, redirects to `/arena`
- Profile "Invite Friends" section: invite link + copy button, referral count, qualify messaging
- Supabase types updated: `invite_code`, `referred_by_wallet`, `referral_count` on `players` table
- `secure-player` edge function redeployed

---

### TASK 7 — Airdrop / Events Page

**New Page — `/events`**

- Hero: "GameGambit Airdrop Campaign" + "Active" badge + tagline
- How to Qualify section — engagement-focused, intentionally vague (no thresholds, amounts, or dates)
- Your Activity card — user's own stats (total wagered, wins, referrals, game linked). Only visible when wallet connected
- AirdropShareCard button (see Task 8)
- No countdown timer, no spots counter, no reward amounts, no external CTA links
- "Events" added to header nav and footer

---

### TASK 8 — Share Cards

**New Component — `src/components/ShareCards.tsx`**

Canvas-based 1200×630 PNG generation, client-side. Three actions on each card: Share on X (Twitter intent), Copy Image (clipboard), Download (PNG file).

**Win Share Card** (triggered from `GameResultModal` on victory only)
- Design: GameGambit logo, "I just won X SOL on GameGambit", game icon, opponent username, date, platform URL + invite code
- `GameResultModal` updated: `game`, `opponentUsername`, `winnerUsername`, `inviteCode` props added; `shareOpen` state; "Share Your Win" button in claimed actions section

**Airdrop/Campaign Card**
- Design: logo, username, key stats (wagers, wins, referrals), "I'm competing in the GameGambit Airdrop", invite link
- `AirdropShareButton` wired into `/events` activity card and `/profile` invite section

**Arena page** updated to pass `game`, `opponentUsername`, `inviteCode` into `GameResultModal`.

---

### TASK 10 — Spectator Side Bets

**New Migration — `supabase/migrations/task10_side_bets.sql`**
`spectator_bets` table with RLS. Schema: `id`, `wager_id`, `bettor_wallet`, `backer_wallet`, `backed_player`, `amount_lamports`, `status`, `counter_amount`, `tx_signature`, timestamps.

**New Edge Function — `supabase/functions/secure-bet/index.ts`**
Five actions:
- `place` — validates wager status, blocks players from betting on own match, records on-chain SOL transfer to platform wallet, inserts bet row with 30-min expiry
- `counter` — proposed alternative amount, sets status → `countered`
- `accept` — second party sends SOL to platform wallet, status → `matched`
- `cancel` — owner cancels open bet, platform wallet refunds original amount
- `resolveForWager` — called after main wager resolves; pays winners (95% of pot), refunds unmatched open bets, expires remainder

**New Hook — `src/hooks/useSideBets.ts`**
- `useSideBets(wagerId)` — query + Realtime subscription
- `usePlaceSideBet(wagerId)` — SOL transfer + `place` action
- `useCounterSideBet(wagerId)` — `counter` action
- `useAcceptSideBet(wagerId)` — SOL transfer + `accept` action
- `useCancelSideBet(wagerId)` — `cancel` action

**Spectator Page — `src/app/wager/[id]/page.tsx`** updated:
- `SideBetsPanel` component added — collapsible, realtime, full bet lifecycle UI
- Place bet: pick a side (player A or B), enter SOL amount
- Open bets list: accept at stated amount, or submit counter-offer
- Matched bets shown as locked-in pairs with pot total
- Resolved/settled bets shown for history
- Login required, players blocked from betting on their own match
- Betting locked once wager reaches `voting`/`resolved`/`cancelled`

---

### TASK 11 — Dynamic OG Preview Per Wager

**New File — `src/app/wager/[id]/opengraph-image.tsx`**
Next.js `ImageResponse` (edge runtime) generates a 1200×630 PNG per wager:
- Dark gradient background with purple glow
- Game icon + name + match ID
- Player A vs Player B cards (winner gets crown + gold border on resolved wagers)
- Each player stakes + total pot cards
- Status badge
- `thegamegambit.vercel.app` branding footer

**New File — `src/app/wager/[id]/layout.tsx`**
Server component — `generateMetadata` function provides dynamic per-wager:
- `og:title` — "PlayerA vs PlayerB — X SOL Chess Wager" or "PlayerName won X SOL on GameGambit"
- `og:description` — stake, game, players, winner
- `og:image` — points to `/wager/[id]/opengraph-image`
- `twitter:card: summary_large_image`
- Graceful fallback to static branding if wager not found

---

### Added (v1.8.0 summary)

- `src/app/feed/page.tsx` — social feed (For You / Friends / Live Now)
- `src/app/messages/page.tsx` — split-pane DM inbox
- `src/app/invite/[code]/page.tsx` — referral landing page
- `src/app/events/page.tsx` — airdrop / events page
- `src/app/wager/[id]/opengraph-image.tsx` — dynamic OG image
- `src/app/wager/[id]/layout.tsx` — dynamic wager metadata
- `src/components/ShareCards.tsx` — WinShareCard + AirdropShareCard + AirdropShareButton
- `src/components/FriendButton.tsx` — four-state friend action button
- `src/hooks/useFriends.ts` — friends system hooks
- `src/hooks/useFollows.ts` — follow/unfollow, follower/following counts, Realtime subscription on `follows:{walletAddress}`
- `src/hooks/useSideBets.ts` — side bet hooks + realtime
- `supabase/functions/secure-bet/index.ts` — side bet edge function
- `supabase/migrations/task6_referral.sql` — referral columns + indexes
- `supabase/migrations/task10_side_bets.sql` — spectator_bets table + RLS
- `feed_reactions`, `friendships`, `direct_messages`, `spectator_bets`, `follows` DB tables
- `invite_code`, `referred_by_wallet`, `referral_count` columns on `players`
- "Events" + "Feed" + "Messages" added to header nav
- `notifyRematch` action in `secure-wager` — sends push notification to opponent for a rematch request
- `new_follower` notification type — in-app only (bell dropdown); fired when a player gains a new follower
- `NEXT_PUBLIC_APP_DOMAIN` env var — required in Vercel config; used as Twitch embed `parent` parameter (no `https://`, no trailing slash)
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` env var — required in Vercel config for WalletConnect modal

### Changed (v1.8.0)

- `GameResultModal` — share props added, Win Share Card dialog mounted in VictoryContent
- `arena/page.tsx` — rematch handler, share props passed to GameResultModal
- `src/app/wager/[id]/page.tsx` — SideBetsPanel added, new imports
- `src/app/profile/page.tsx` — AirdropShareButton added to invite section
- `src/app/events/page.tsx` — AirdropShareButton wired into activity card
- Total edge functions: 10 → 11
- Total DB tables: 20 → 25
- Navbar: Feed + Messages + Events links added

### Known Issues (v1.8.0)

- `spectator_bets`, `feed_reactions`, `friendships`, `direct_messages`, `follows` tables and new `players` columns (`invite_code`, `referred_by_wallet`, `referral_count`) not yet in auto-generated `types.ts` — use local interface definitions until next `supabase gen types` run.
- `secure-bet` `resolveForWager` must be called manually from `resolve-wager` edge function after main wager settlement — wire-up between the two functions is a pending integration step.
- Suspension auto-lift (planned pg_cron job) still pending from v1.7.0.

---

## [1.7.0] — April 3, 2026

### Phase 6 — Punishment System + Dispute Grace Period

---

#### Dispute Grace Period (Step 4 — Completed)

**New Component — `DisputeGraceModal`**

Shown to both players immediately when `wager.status === 'disputed'` and `grace_conceded_by` is null. Gives players a chance to admit they voted wrong before a moderator is pulled in. No countdown — the moderator search runs silently in the background.

If either player taps "I was wrong", `concedeDispute` is called on `secure-wager`. The concession is resolved on-chain instantly via `process-concession` with no moderator fee. The honesty event is logged to `player_behaviour_log` positively. The moderator popup is never shown if concession wins the race.

**New Edge Function — `process-concession`**

Handles on-chain resolution for grace period concessions. Calls `resolve_wager` (90/10 split) or `close_wager` (draw). Does NOT apply punishment tiers — concession rewards honesty. Logs a positive `honesty_concession` event to `player_behaviour_log`.

**New `secure-wager` action — `concedeDispute`**

Validates `status === 'disputed'`, stamps `grace_conceded_by` and `grace_conceded_at`, triggers `process-concession`, and notifies both players.

---

#### Auto-Escalating Punishment Tiers (Step 6 — Completed)

**New Edge Function — `process-verdict`**

Called after a moderator submits a verdict. Handles full on-chain settlement and applies punishment to the dispute loser based on their `dispute_loss` offense count in `punishment_log`:

| Offense # | Punishment |
|-----------|-----------|
| 1 | Warning — no suspension |
| 2 | 24h suspension |
| 3 | 72h suspension |
| 4 | 7-day (168h) suspension |
| 5+ | Indefinite ban (`suspension_ends_at` = null) |

Punishment is written to `punishment_log` (immutable) and reflected on the player row (`is_suspended`, `suspension_ends_at`). `cannot_determine` verdicts skip punishment and escalate to admin. `applyPunishment` catches its own exceptions — a punishment failure never blocks verdict settlement.

Also handles: on-chain `resolve_wager` or `close_wager`, winner/loser stats update, `wager_transactions` ledger entries, and notifications to both players + moderator.

**New Hook — `useDisputeGrace`**

Exports `useConcede()` — mutation that calls `concedeDispute` via `invokeSecureWager`. Allows 30s timeout for on-chain resolution.

---

#### New Admin Pages

- **`/itszaadminlogin/behaviour-flags`** — Aggregates `player_behaviour_log` per player into risk scores. Tracks false votes, dispute losses, and moderator reports with per-event weights. Admins can drill into full event history per player.
- **`/itszaadminlogin/username-appeals`** — Review queue for username ownership appeals filed by players.
- **`/itszaadminlogin/username-changes`** — Review queue for formal username change/rebind requests.

---

#### New Edge Functions — Moderation Infrastructure

**`assign-moderator`**

Called fire-and-forget from `secure-wager/actions.ts` (`handleSubmitVote`) when a dispute is created, and by `moderation-timeout` on retry. Finds the eligible moderator with the lowest `moderation_skipped_count` (not a participant, not suspended, has `moderation_requests_enabled = true`, not already tried on this wager). Inserts a `moderation_requests` row with `deadline = now + 30s` and sends an in-app notification.

**`moderation-timeout`**

Triggered by pg_cron every minute. Handles two cases:
- **Pending timeout** — moderator didn't accept within 30s → `status = 'timed_out'` → `assign-moderator` retried
- **Accepted timeout** — moderator accepted but didn't submit verdict within decision window → `status = 'timed_out'` → skip count incremented atomically via `increment_moderation_skip_count` RPC → `assign-moderator` retried

Skip count updates run concurrently with `Promise.all` — no sequential blocking in loops.

---

#### New Player-Facing Features

**Player Settings Page (`/settings`)**
- Push notification toggle (per event type)
- Moderation assignment opt-in/opt-out (`moderation_requests_enabled`)
- Managed via `GET/PATCH /api/settings` with session token auth
- `usePlayerSettings` hook with optimistic updates and camelCase↔snake_case mapping

**Username Binding System**
- `GameAccountCard` updated with bind/appeal/change-request flows for PUBG, CODM, Free Fire
- `useUsernameBinding` hook — `useBindUsername`, `useUsernameAppeal`, `useSubmitChangeRequest` mutations
- `/api/username/bind` — bind game username; returns `USERNAME_TAKEN` if conflict → triggers appeal flow
- `/api/username/appeal` — file ownership appeal; notifies current holder
- `/api/username/appeal/respond` — holder releases or contests; contested appeals go to admin queue
- `/api/username/change-request` — formal rebind request; max 2 approved/pending per game per 12 months enforced server-side
- PUBG binding calls `/api/pubg/verify-username` first (live PUBG API lookup); falls back to manual confirmation if `PUBG_API_KEY` not configured

---

### Bug Fixes (April 2, 2026 — Moderation System Hardening)

**Bug 1 — `ModerationRequestModal` stale closure on countdown auto-dismiss**
Fix: `onDismissed` and `onAccepted` stored in `useRef`, synced via `useEffect`. Handlers call `ref.current()` instead of the raw prop.
File: `src/components/ModerationRequestModal.tsx`

**Bug 2 — `moderation-timeout` pg_cron job was never activated**
Fix: pg_cron job now documented and required in the deployment checklist.

**Bug 3 — Hard refresh re-showed already-dismissed moderation popup**
Fix: `seenModerationRequestIds` now initialises from `sessionStorage` (key `gg:seen_mod_requests`) and writes back on every addition.
File: `src/contexts/GameEventContext.tsx`

**Bug 4 — Skip count increment in `moderation-timeout` was not atomic**
Fix: Replaced with `increment_moderation_skip_count(p_wallet)` Postgres RPC.
File: `supabase/functions/moderation-timeout/index.ts`

**Bug 5 — Same race condition in `decline/route.ts`**
Fix: Same `increment_moderation_skip_count` RPC.
File: `src/app/api/moderation/decline/route.ts`

**Bug 6 — `increment_moderation_skip_count` RPC did not exist**
Fix:
```sql
CREATE OR REPLACE FUNCTION increment_moderation_skip_count(p_wallet text)
RETURNS void LANGUAGE sql AS $$
  UPDATE players SET moderation_skipped_count = moderation_skipped_count + 1
  WHERE wallet_address = p_wallet;
$$;
```

### Bug Fixes (March 30, 2026)

**Bug — Player B Deposit Ordering (`ReadyRoomModal`)**
Fix: Player B polls `wagerRef.current.deposit_player_a` every 2s (up to 2 min) before calling `joinWagerOnChain`.

---

### Added (v1.7.0 summary)

- `DisputeGraceModal` component
- `process-concession` edge function
- `process-verdict` edge function
- `assign-moderator` edge function
- `moderation-timeout` edge function
- `useDisputeGrace` hook
- `usePlayerSettings` hook
- `useUsernameBinding` hook
- `/settings` player settings page
- `/api/settings` GET/PATCH route
- `/api/username/bind`, `/api/username/appeal`, `/api/username/appeal/respond`, `/api/username/change-request` routes
- `/itszaadminlogin/behaviour-flags` admin page
- `/itszaadminlogin/username-appeals` admin page
- `/itszaadminlogin/username-changes` admin page
- `/api/admin/wagers/inspect` — fetch wager by UUID, match ID, or wallet; min role: moderator
- `/api/admin/wagers/pda-scan` — bulk PDA scanner returning per-wager on-chain verdict; params: `status`, `limit` (max 500), `offset`; min role: moderator
- `concedeDispute` action in `secure-wager`
- `bindGame` action in `secure-player` — validates and binds game username after PUBG/CODM/Free Fire verification; checks uniqueness, calls `merge_game_bound_at` RPC; returns `USERNAME_TAKEN` (409) if already linked
- `increment_moderation_skip_count` Postgres RPC
- `punishment_log` offense tracking with 5-tier auto-escalation
- `player_behaviour_log` events

### Changed (v1.7.0)

- Total edge functions: 6 → 10
- `moderation-timeout` skip count increment made atomic via RPC
- `GameEventContext` `seenModerationRequestIds` now persisted in `sessionStorage`
- `ModerationRequestModal` stale closure fixed via `useRef`
- Wager lifecycle now includes dispute grace period step before moderator assignment

---

## [1.6.0] — March 28, 2026

### Step 3 — Peer Voting Flow (CODM / PUBG / Free Fire)

**New Components**
- `GameCompleteModal` — both players confirm match is done; shows live 10s countdown synced to `game_complete_deadline` once both confirmed; non-dismissable during countdown
- `VotingModal` — 5-minute vote window; player picks winner or draw; shows opponent vote status via Realtime; retract button available while opponent hasn't voted; resolves or disputes automatically when both votes in

**New Hooks**
- `useGameComplete.ts` — `useMarkGameComplete` mutation calling `markGameComplete` in `secure-wager`
- `useVoting.ts` — `useSubmitVote`, `useRetractVote`, `deriveVoteOutcome` utility

**New Edge Function Actions** (in `secure-wager`)
- `markGameComplete` — sets `game_complete_a/b`; when both true: stamps `game_complete_deadline` (NOW+10s) and `vote_deadline` (NOW+5m10s)
- `submitVote` — sets `vote_player_a/b`; if votes agree → on-chain resolve; if mismatch → `disputed`
- `retractVote` — clears caller's vote (only while opponent hasn't voted)
- `finalizeVote` — triggers on-chain `resolve_wager` once the 15s retract window expires without a retraction
- `voteTimeout` — called when `vote_deadline` passes with no resolution; sets status → `disputed` and triggers moderator assignment
- `declineChallenge` — soft-deletes an open wager (status `created` only); fires `wager_declined` notification to Player A
- `checkGameComplete` — polls Lichess API for chess game result; called by `check-chess-games` cron only, no auth required

**Page Wiring**
- `my-wagers/page.tsx` — `GameCompleteModal` + `VotingModal` imported, state managed, `handleBothConfirmed` chains the two modals; `WagerRow` Vote button label changes dynamically based on confirmation state
- `arena/page.tsx` — same wiring; `handleWatchGame` now routes non-chess wagers in `voting` state to `GameCompleteModal` or `VotingModal` instead of `LiveGameModal`

**Wager Type Extensions** (`useWagers.ts`)
- `game_complete_a`, `game_complete_b`, `game_complete_deadline` on `Wager` interface
- `vote_a_at`, `vote_b_at`, `vote_deadline` on `Wager` interface

**Other**
- Free Fire (`free_fire`) added to `getGameData` in both pages
- `GameCompleteModal` and `VotingModal` receive live wager from React Query cache — no second Supabase subscription created inside either modal

---

## [1.5.0] — March 25, 2026

### Database Schema v1.5.0

**Player columns added**
- Game account binding: `pubg_player_id`, `free_fire_username`, `free_fire_uid`, `codm_player_id`, `game_username_bound_at` (JSONB)
- Punishment tracking: `is_suspended`, `suspension_ends_at`, `false_vote_count`, `false_claim_count`, `moderator_abuse_count`
- Settings: `push_notifications_enabled`, `moderation_requests_enabled`

**Wager columns added**
- Game complete: `game_complete_a/b`, `game_complete_a/b_at`, `game_complete_deadline`
- Vote timestamps: `vote_a_at`, `vote_b_at`, `vote_deadline`
- Dispute/moderation: `dispute_created_at`, `moderator_wallet`, `moderator_assigned_at`, `moderator_deadline`, `moderator_decision`, `moderator_decided_at`, `moderation_skipped_count`
- Grace period: `grace_conceded_by`, `grace_conceded_at`

**New tables**
- `moderation_requests` — moderator assignment queue per dispute
- `username_appeals` — player appeals for taken usernames
- `username_change_requests` — username change request tracking
- `punishment_log` — immutable punishment record per player
- `player_behaviour_log` — soft behavioural events for admin pattern review

**New enum value**
- `game_type` extended with `free_fire`

**New RPC**
- `merge_game_bound_at(wallet, game, ts)` — JSONB-merges a single game's bound timestamp without overwriting others (service role only)

### Major Features
- **Complete Admin Dashboard**: Full-featured admin portal with authentication, role-based access control, and comprehensive dispute management
- **Extended Database Schema**: 12+ core tables plus 6 admin-specific tables for complete audit trails and compliance
- **Admin Wallet Verification**: On-chain wallet signature verification for admin actions
- **Comprehensive Audit Logging**: Every admin action logged with before/after state changes
- **Dispute Management Interface**: Admin tools for resolving voting disputes and moderating wagers
- **Session Management**: JWT-based admin sessions with expiration and activity tracking

### Admin Role Hierarchy
- **Superadmin**: Full system access, user/admin management
- **Admin**: Dispute resolution, player management, wager oversight
- **Moderator**: Dispute resolution only, view-only access to other areas

### Notifications + Push

- `notifications` table + Realtime subscription — in-app bell dropdown
- `push_subscriptions` table — VAPID Web Push endpoint + keys per player
- `useNotifications.ts` hook — subscribe/unsubscribe, badge count, mark read
- `NotificationsDropdown.tsx` component
- Edge function `notifyChat` action — push notification to opponent (rate-limited: 1 per wager per 5 min)
- Notification types: `wager_joined`, `game_started`, `wager_won`, `wager_lost`, `wager_draw`, `wager_cancelled`

### PWA

- `public/manifest.json` — PWA manifest
- `public/sw.js` — service worker (caching + push notification handler)
- `PWAContext.tsx` — install prompt management

### Added
- Admin dashboard at `/itszaadminlogin/` with authentication
- Multi-level admin roles with granular permissions
- Wallet binding system for admin verification
- Complete audit logging system
- Dual deposit confirmation tracking for on-chain verification
- Error transaction types for comprehensive error handling
- Transaction signature uniqueness to prevent duplicate processing
- Admin-only dispute resolution workflow
- Player flagging and review system
- Administrative notes and annotations on players/wagers

### Changed
- Database schema significantly expanded (now 12 core tables + admin tables)
- Wager status flow updated to support moderator-reviewed disputes
- Transaction types enum extended with error tracking variants
- Admin authentication completely redesigned with modern security
- Deposit tracking split into separate confirmations per player
- Match ID now integral to PDA derivation strategy
- `admin-action` edge function expanded: `forceDraw` and `forceCancel` replaced by `forceRefund`, `markDisputed`, `flagPlayer`, `unflagPlayer`, `checkPdaBalance`, `addNote` — see API_REFERENCE for full action/role matrix

### Documentation Updates
- **DB_SCHEMA.md**: Complete rewrite with admin tables, design decisions, and query examples
- **API_REFERENCE.md**: Added admin endpoint documentation
- All README files updated with new admin features

---

## [1.4.0] — March 22, 2026

### Lichess OAuth PKCE Integration

- `useLichess.ts` — OAuth PKCE flow, connect/disconnect
- `startLichessOAuth()` — generates code verifier/challenge, redirects to Lichess
- `/api/auth/lichess/callback` — exchanges code for token, saves `lichess_username`, `lichess_user_id`, `lichess_access_token`
- `startGame` action in `secure-wager` — calls Lichess API with platform token to auto-create a locked game; saves `lichess_url_white`, `lichess_url_black`, `lichess_game_id` to wager row
- `/api/lichess/webhook` — receives Lichess game result, triggers `resolve-wager`
- `LiveGameModal.tsx` — embeds Lichess game board for chess wagers

### Real-time Chat + Proposals (Ready Room)

- `wager_messages` table — chat + proposal messages with `proposal_data` JSONB and `proposal_status`
- `useWagerChat.ts` — send messages, send proposals, respond to proposals
- `WagerChat.tsx` — ready room chat UI with proposal cards
- `applyProposal` action in `secure-wager` — applies accepted proposal to wager row (bypasses owner-only edit restriction)
- `notifyProposal` action — push notification to opponent for new proposals

---

## [1.3.0] — March 21, 2026

### Admin Panel

- `/itszaadminlogin/` — admin portal with login, signup, dashboard
- Admin tables: `admin_users`, `admin_sessions`, `admin_wallet_bindings`, `admin_audit_logs`, `admin_logs`, `admin_notes`
- Three-tier RBAC: moderator → admin → superadmin
- `admin-action` edge function — `forceResolve`, `forceDraw`, `forceCancel`, `banPlayer`, `unbanPlayer`
- PBKDF2 password hashing (100k iterations)
- httpOnly session cookies with JWT, auto-refresh
- Ed25519 wallet binding + signature verification for admin actions
- Full audit trail — every action logged with before/after state, IP, user agent
- Two-factor authentication support (2FA framework in place)

---

## [1.2.0] — March 21, 2026

### On-Chain Wager Settlement

- `resolve-wager` edge function — derives PDA, builds `resolve_wager` (90/10 split) or `close_wager` (draw/cancel refund) instruction, signs and sends
- `update_winner_stats` / `update_loser_stats` DB RPCs
- `wager_transactions` table — full on-chain payout ledger
- Dual deposit tracking: `deposit_player_a`, `deposit_player_b`, `tx_signature_a/b`
- `recordOnChainCreate` / `recordOnChainJoin` actions in `secure-wager`
- `tx_signature` UNIQUE constraint — prevents duplicate transaction records

### Security & Compliance
- Admin authentication via email/password with PBKDF2 hashing
- Wallet signature verification for admin actions
- Complete audit trail of all admin activities
- IP address and user-agent logging
- Transaction signature uniqueness constraints (prevents duplicates)
- Row-level security policies for sensitive data

---

## [1.1.0] — March 2026

### Ready Room + Game Flow

- `ReadyRoomModal.tsx` — countdown, deposit status, ready toggle, chat, edit proposals
- `setReady` / `startGame` actions in `secure-wager`
- `set_player_ready` DB RPC — atomic ready toggle + countdown start
- Mobile wallet signing via `sendTransaction` (wallet adapter)
- `cancelWager` action + on-chain refund

### Realtime

- `GameEventContext.tsx` — global wager Realtime subscription; keeps React Query cache fresh without per-component polling
- `BalanceAnimationContext.tsx` — animates SOL balance changes on win/loss

---

## [1.0.0] — March 9, 2026 — Initial Release

### Core

- Next.js 15 App Router + React 18 + TypeScript
- Tailwind CSS dark mode UI, shadcn/ui components
- Solana wallet adapter (Phantom, Magic Eden, etc.)
- `verify-wallet` edge function — Ed25519 session token issuance
- `useWalletAuth.ts` — session token management, `gg:session-expired` event
- `secure-wager` — `create`, `join`, `vote` actions
- `secure-player` — `create`, `update` actions
- `useAutoCreatePlayer.ts` — auto-registers player on first wallet connect
- Arena page, My Wagers page, Dashboard, Leaderboard, Profile

### Database v0.9

- `players`, `wagers`, `wager_transactions`, `nfts`, `achievements`, `rate_limit_logs`
- RLS policies on all tables
- DB triggers: `protect_player_sensitive_fields`, `protect_wager_sensitive_fields`, `validate_player_insert`, `validate_wager_insert`, `update_updated_at`
- Materialized view for leaderboard
- Composite indexes for common query patterns

### Smart Contract (Anchor)

- Program ID: `E2Vd3U91kMrgwp8JCXcLSn7bt3NowDmGwoBYsVRhGfMR`
- Instructions: `initialize_wager`, `join_wager`, `resolve_wager`, `close_wager`
- PDA seed: `["wager", player_a_wallet, match_id_le_bytes]`

### API Endpoints (v1.0)

- `POST /api/wagers` — Create wager
- `GET /api/wagers` — List wagers
- `GET /api/wagers/{id}` — Get wager details
- `POST /api/wagers/{id}/join` — Join wager
- `GET /api/players/{wallet}` — Get player profile
- `GET /api/leaderboard` — Get rankings

### Performance Optimizations

- Materialized views for leaderboard (O(1) lookups)
- Composite indexes for common queries
- In-memory caching for hot data
- Query result pagination
- Connection pooling
- Edge caching with CDN

### Security Features

- Solana wallet signature verification
- Row-level security (RLS) policies
- SQL injection prevention via parameterized queries
- Rate limiting per wallet address
- Input validation with Zod schemas

---

## Version Timeline

### v1.0.0 Release Timeline (March 9, 2026)

**Phase 1: Foundation** (Jan 2026)
- Next.js 15 setup with TypeScript
- Supabase integration and schema
- Solana wallet connection

**Phase 2: Core Features** (Feb 2026)
- Wager creation and joining
- Player profile system
- Transaction tracking
- Voting mechanism

**Phase 3: Optimization** (Mar 2026)
- Database indexing and optimization
- Caching layer implementation
- Rate limiting system
- Performance benchmarking

**Phase 4: Polish & Launch** (Mar 9, 2026)
- UI/UX refinement
- Documentation completion
- Testing and QA
- Production deployment

---

## Migration Guides

### Upgrading from v1.0 → v1.5

**Breaking Changes**: None. v1.5 is fully backward compatible.

**New Tables Added**:
- `admin_users` — Admin accounts
- `admin_sessions` — Session tracking
- `admin_wallet_bindings` — Wallet verification
- `admin_audit_logs` — Action audit trail
- `admin_logs` — Wager admin logs
- `admin_notes` — Admin annotations

**Migration Steps**:
1. Deploy database schema updates (new admin tables)
2. Update `.env.local` with new admin endpoint URLs
3. Deploy updated API routes
4. Access admin panel at `/itszaadminlogin/`

### Upgrading to Mainnet

When deploying to Solana Mainnet:
1. Generate new admin keypairs with multi-sig wallet
2. Update `SOLANA_ADMIN_WALLET` in environment
3. Deploy new program instance to Mainnet
4. Migrate all active wagers (or start fresh with new environment)
5. Update docs with new program addresses

---

## Known Issues

### Current (April 2026 — v1.8.0)

- `spectator_bets`, `feed_reactions`, `friendships`, `direct_messages` and new `players` columns (v1.8.0) are not in auto-generated `src/integrations/supabase/types.ts` — use local interfaces until next `supabase gen types` run.
- `secure-bet` `resolveForWager` not yet auto-called from `resolve-wager` — requires manual call or future wire-up.
- Suspension auto-lift pg_cron job still pending — `is_suspended` must be cleared manually when `suspension_ends_at` is reached.
- `retractable` wager status exists in DB enum but is unused in the current flow.
- High latency on leaderboard queries with > 100k players (requires sharding).
- Occasional delays in Lichess game data synchronization.
- 2FA implementation requires email service integration.

### Fixed (April 2026 — v1.8.0)

- [x] Free Fire icon/data missing from `WagerDetailsModal` (`getGameData` switch)
- [x] Chat panel open by default in ready room
- [x] Static logo OG image on all pages — replaced with dynamic per-wager `opengraph-image.tsx`
- [x] TS2882 CSS import errors — moved global CSS to `app/layout.tsx`
- [x] Spectator page `RealtimeChannel` type constraint error — typed as `any`
- [x] `useSideBets` `RealtimeChannel` type constraint error — typed as `any`

### Fixed (April 3, 2026 — v1.7.0)

- [x] `ModerationRequestModal` — stale closure on `onDismissed`/`onAccepted` refs
- [x] `GameEventContext` — `seenModerationRequestIds` not persisted across hard refresh
- [x] `moderation-timeout` — skip count read-then-write race condition
- [x] `decline/route.ts` — skip count read-then-write race condition
- [x] `increment_moderation_skip_count` SQL RPC — created and live
- [x] pg_cron job `moderation-timeout` — scheduled and verified active
- [x] Player B deposit ordering race — polling guard added in `runDepositFlow`

### Fixed (v1.6.0)

- [x] Race condition in `secure-wager` — atomic DB status guard prevents duplicate tx processing
- [x] Mobile wallet signing — switched to `sendTransaction` via wallet adapter
- [x] `useAutoCreatePlayer` deduplication — prevents double player creation on reconnect
- [x] `game_complete_deadline` comment in DB_SCHEMA.md incorrectly said "15 min" — corrected to 10s

### Fixed (v1.5.0)

- [x] Admin authentication and session management
- [x] Wallet verification for admin actions
- [x] Audit logging for compliance
- [x] Dispute resolution workflow
- [x] Duplicate transaction prevention via unique tx signatures

### Fixed (v1.0.0)

- [x] Wallet connection timeout on slow networks
- [x] Database connection pool exhaustion under peak load
- [x] Race condition in concurrent wager joins
- [x] Funds not distributed after game ended
- [x] GameResultModal not appearing
- [x] Stale wager state in UI

---

## Performance Metrics

### v1.0.0 Benchmarks (Production)

| Metric | Target | Achieved |
|--------|--------|----------|
| API response time (p50) | < 50ms | 35ms |
| API response time (p95) | < 200ms | 180ms |
| API response time (p99) | < 500ms | 420ms |
| Leaderboard query | < 50ms | 45ms |
| Wager creation | 100–300ms | 220ms |
| Database connection time | < 10ms | 8ms |
| Cache hit rate | > 85% | 87% |
| Uptime | > 99.9% | 99.95% |

---

## Roadmap

### Q2 2026
- [x] Phase 6 — punishment system (strike tracking, auto-suspend/ban, behaviour flags, grace period concession, username binding/appeals)
- [x] Social feed, friends system, DMs
- [x] Referral / invite system
- [x] Airdrop / events page
- [x] Share cards (win card + campaign card)
- [x] Spectator side bets
- [x] Dynamic OG images per wager
- [ ] Suspension auto-lift pg_cron job
- [ ] `resolveForWager` auto-hook in `resolve-wager`
- [ ] Mainnet deployment + multi-sig authority wallet

### Q3 2026
- [ ] Tournament / bracket mode
- [ ] Mobile app (React Native)
- [ ] Streaming integration (Twitch, YouTube)
- [ ] Cross-chain settlement (Ethereum, Polygon)
- [ ] Additional games (Fortnite, Valorant)
- [ ] Multi-signature admin wallet for mainnet

### Q4 2026
- [ ] International support (multiple languages)
- [ ] VIP tier system with badges
- [ ] Sponsorship marketplace
- [ ] Public API SDK

### 2027
- [ ] AI-powered matchmaking
- [ ] Live streaming platform integration
- [ ] Esports tournament platform
- [ ] Community marketplace
- [ ] Decentralized governance (DAO)

---

## Contributors

- **Web3ProdigyDev** — Lead development
- **Vercel** — Infrastructure and deployment
- **Supabase** — Database and authentication
- **Solana Labs** — Blockchain integration

---

## License

Game Gambit is licensed under the MIT License. See LICENSE file for details.

---

## Support

For issues or feature requests:
- GitHub Issues: [github.com/GameGambitDev/gamegambit/issues](https://github.com/GameGambitDev/gamegambit/issues)
- Email: [support@gamegambit.com](mailto:support@gamegambit.com)
- Discord: [Game Gambit Community](https://discord.gg/gamegambit)

---

**Last Updated:** April 2026 — v1.8.0