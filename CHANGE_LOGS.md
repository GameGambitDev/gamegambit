---
title: Game Gambit Changelog
description: Version history and release notes
---

# Changelog

All notable changes to Game Gambit are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased] — In Progress (March 28, 2026)

### Step 4 — Dispute Grace Period
- `raiseDispute` action in `secure-wager` — either player can formally open a dispute after vote disagreement
- 24-hour window before moderator is auto-assigned — allows players to resolve informally
- Grace period concession flow (`grace_conceded_by`, `grace_conceded_at`)

### Step 5 — Moderator System
- Moderator assignment queue — candidate pulled from eligible player pool
- 20s accept window per candidate, `moderation_skipped_count` increments on timeout/decline
- Screenshot upload + moderator verdict UI
- Moderator payout on decision

### Step 6 — Punishment System
- Strike tracking (`false_vote_count`, `false_claim_count`, `moderator_abuse_count`)
- Auto-suspend thresholds
- `punishment_log` entries for every penalty
- Admin escalation path

### Planned Admin Features
- Batch operations on wagers/players
- Advanced admin analytics dashboard
- Automated dispute resolution (AI-assisted)

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

### Current (v1.6.0)

- `wager_messages`, v1.5.0/v1.6.0 player/wager columns, and `free_fire` game type are not reflected in auto-generated `src/integrations/supabase/types.ts` — worked around with `as any` casts and local interface definitions. Re-run `supabase gen types typescript` after any schema change.
- `retractable` wager status exists in DB enum but is unused in the current flow.
- High latency on leaderboard queries with > 100k players (requires sharding).
- Occasional delays in Lichess game data synchronization.
- Admin analytics need optimization for large datasets.
- 2FA implementation requires email service integration.

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
- [ ] Step 4–6 completion (dispute grace period, moderator system, punishments)
- [ ] Mobile application (React Native)
- [ ] Tournament mode with brackets
- [ ] Advanced admin analytics dashboard
- [ ] Automated dispute resolution (AI-assisted)
- [ ] Streaming integration (Twitch)

### Q3 2026
- [ ] Additional games (Fortnite, Valorant)
- [ ] Cross-chain settlement (Ethereum, Polygon)
- [ ] Multi-signature admin wallet for mainnet
- [ ] Advanced KYC/AML integration
- [ ] Referral program

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

**Last Updated:** March 28, 2026