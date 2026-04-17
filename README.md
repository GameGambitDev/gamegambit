# GameGambit — Trustless P2P Gaming Escrow on Solana

| **Smart Contract Repo** | https://github.com/Web3ProdigyDev/gamegambit-sol |
[![Live on Devnet](https://img.shields.io/badge/Solana-Devnet-9945FF?logo=solana)](https://explorer.solana.com/address/E2Vd3U91kMrgwp8JCXcLSn7bt3NowDmGwoBYsVRhGfMR?cluster=devnet)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org)
[![Anchor](https://img.shields.io/badge/Anchor-0.30-512BD4)](https://anchor-lang.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-2D79C7)](https://typescriptlang.org)
[![Live App](https://img.shields.io/badge/Live%20App-thegamegambit.vercel.app-00C7B7)](https://thegamegambit.vercel.app)

> **Bounty Submission:** [Superteam Poland — Rebuild Production Backend Systems as On-Chain Rust Programs](https://earn.superteam.fun/listings/bounties/rebuild-production-backend-systems-as-on-chain-rust-programs/)

**GameGambit** is a fully deployed, production-grade **payment escrow engine** built on Solana. Two players stake SOL on a gaming match. Funds lock in a program-derived account (PDA). The winner is verified automatically and the pot releases trustlessly — no middleman, no custody risk. Moderators resolve disputes via on-chain settlement with a complete audit trail.

This project demonstrates how a traditional centralized payment escrow backend is replaced entirely by an Anchor program on Solana, with role-based admin controls, automatic chess result resolution via the Lichess API, and full compliance logging.

---

## Live Links

| | |
|---|---|
| **Deployed App** | https://thegamegambit.vercel.app |
| **Admin Panel** | https://thegamegambit.vercel.app/itszaadminlogin |
| **Program (Devnet)** | [`E2Vd3U91kMrgwp8JCXcLSn7bt3NowDmGwoBYsVRhGfMR`](https://explorer.solana.com/address/E2Vd3U91kMrgwp8JCXcLSn7bt3NowDmGwoBYsVRhGfMR?cluster=devnet) |
| **UI Repo** | https://github.com/GameGambitDev/gamegambit |
| **Smart Contract Repo** | https://github.com/Web3ProdigyDev/gamegambit-sol |

---

## Devnet Transaction Proof

Real, finalized transactions from the deployed program on Solana Devnet:

| Instruction | Transaction | What Happened |
|---|---|---|
| `create_wager` | [`3rUc3SbENp5UcnsLYs5AdZkPuknte4dhUYRFusxueFon7LRaSZxJvN3mBrzkQpcZEFHrJcVsHWdfcZrgLDbzG1Qf`](https://explorer.solana.com/tx/3rUc3SbENp5UcnsLYs5AdZkPuknte4dhUYRFusxueFon7LRaSZxJvN3mBrzkQpcZEFHrJcVsHWdfcZrgLDbzG1Qf?cluster=devnet) | Player A staked 0.5 SOL into escrow PDA |
| `join_wager` | [`3tB5F8wZMkvFrfUqTw4WhrAmrohsktaxsHT7Z8iDc3wXjB54RbrDrBFt32boBRvnwek6bBVMRteachqPnMHuxnwf`](https://explorer.solana.com/tx/3tB5F8wZMkvFrfUqTw4WhrAmrohsktaxsHT7Z8iDc3wXjB54RbrDrBFt32boBRvnwek6bBVMRteachqPnMHuxnwf?cluster=devnet) | Player B matched the stake — 1 SOL total locked |
| `resolve_wager` | [`4amRCjEFo3NwfExitnbf5F8x9asyxaxYW1tjjG8AHBznHuxER4LjyDXXMeQnTraxYMLoXJGfgprZbDrGvRZwjPBu`](https://explorer.solana.com/tx/4amRCjEFo3NwfExitnbf5F8x9asyxaxYW1tjjG8AHBznHuxER4LjyDXXMeQnTraxYMLoXJGfgprZbDrGvRZwjPBu?cluster=devnet) | Winner received 0.9 SOL, platform took 0.1 SOL fee |
| `resolve_wager` | [`33Te8VjmqXkKJ9U3MfHRtEyVUC6TTE3H96YvyHZA6drswYw7g1RhbLRtMXskfbRQezvsiTQsP6h4p8YCcJ5v9k1n`](https://explorer.solana.com/tx/33Te8VjmqXkKJ9U3MfHRtEyVUC6TTE3H96YvyHZA6drswYw7g1RhbLRtMXskfbRQezvsiTQsP6h4p8YCcJ5v9k1n?cluster=devnet) | Additional resolved wager — 0.9 SOL payout |
| `close_wager` (draw) | [`63Z4uvPFpYdsMScowXQhfSk4uvfVs3hB2zBNrr2f7Jsst3odEUADFnsWXUV1TfGdu1yRWDmZ6USeGVjjYGdG3xhx`](https://explorer.solana.com/tx/63Z4uvPFpYdsMScowXQhfSk4uvfVs3hB2zBNrr2f7Jsst3odEUADFnsWXUV1TfGdu1yRWDmZ6USeGVjjYGdG3xhx?cluster=devnet) | Draw — both players refunded in full |
| `close_wager` (cancel) | [`2VyA5SFMqWSKeG68aY73aYQ4gd4zFe6C2W37zAMoXPtaevpdJAyudNfSwXhnBmpVaDvMXZ9B3ScxaoHKvrA3TDyM`](https://explorer.solana.com/tx/2VyA5SFMqWSKeG68aY73aYQ4gd4zFe6C2W37zAMoXPtaevpdJAyudNfSwXhnBmpVaDvMXZ9B3ScxaoHKvrA3TDyM?cluster=devnet) | Cancelled wager — on-chain refund to both players |

The `resolve_wager` transaction emits a `WagerResolved` event on-chain with `total_payout: 900,000,000` lamports and `platform_fee: 100,000,000` lamports — exactly matching the 10% fee configured in program constants.

---

## What Was Built

### On-Chain Program (Anchor / Rust)

A fully deployed Anchor program implementing a stateful escrow engine with 8 instructions:

| Instruction | Description |
|---|---|
| `initialize_player` | Creates a PlayerProfile PDA — one-time on-chain registration |
| `create_wager` | Player A locks stake in a WagerAccount PDA |
| `join_wager` | Player B matches the stake — escrow is now fully funded |
| `submit_vote` | Each player submits their claimed winner |
| `retract_vote` | Either player can retract within the 15-second window |
| `resolve_wager` | Authority releases 90–95% to winner, 5–10% to platform (tiered) |
| `close_wager` | On draw or cancel — returns funds to both players |
| `ban_player` | Authority can ban a player's profile |

### Admin Dashboard (Next.js)

A comprehensive admin panel with role-based access control (RBAC) at `/itszaadminlogin`:

| Feature | Description |
|---|---|
| **Admin Authentication** | Email/password auth with PBKDF2 hashing and JWT sessions |
| **Wallet Binding** | Solana wallet signature verification for admin actions |
| **Dispute Resolution** | Interface for moderators to resolve voting conflicts |
| **Player Management** | Ban/flag players, view profiles, see full stats |
| **Wager Oversight** | Complete wager history, transaction ledger, status tracking |
| **Audit Logging** | Complete audit trail with before/after state changes |
| **Role Hierarchy** | Superadmin → Admin → Moderator with granular permissions |

### On-Chain Account Model

Two program-derived accounts hold all financial state:

**PlayerProfile PDA** — seeds: `["player", player_pubkey]`
```
discriminator: [u8; 8]
player:        Pubkey
is_banned:     bool
ban_expires_at: i64
bump:          u8
```

**WagerAccount PDA** — seeds: `["wager", player_a_pubkey, match_id_le_bytes]`
```
discriminator:   [u8; 8]
player_a:        Pubkey
player_b:        Pubkey
match_id:        u64
stake_lamports:  u64
status:          WagerStatus   // Created|Joined|Voting|Retractable|Disputed|Closed|Resolved
vote_a:          Option<Pubkey>
vote_b:          Option<Pubkey>
winner:          Option<Pubkey>
bump:            u8
```

### Full-Stack Client

A Next.js 15 application providing complete player and admin interfaces:

- Real-time wager lobby with live status updates via Supabase Realtime
- Ready Room with countdown timer, on-chain deposit confirmation, in-room chat, and wager edit proposals
- Lichess OAuth (PKCE) — players verify ownership of their Lichess account; platform token auto-creates locked games server-side with per-color play links; automatic result verification triggers `resolve_wager`
- Transaction history with Solana Explorer links for every on-chain event
- PWA with Web Push notifications for match events (wager joined, game started, win/loss/draw)
- Admin panel for dispute resolution, player management, and audit logging
- **Moderator dispute system** — real-time popup when assigned as moderator, 5-step guided verdict workflow, on-chain settlement with 30% of platform fee (capped at $10) incentive
- **Phase 6 — Punishment system** — dispute grace period with concession flow, auto-escalating strike tiers (warning → 24h → 72h → 7d → indefinite ban), `punishment_log` audit trail, behaviour flags dashboard, admin escalation path
- **Username binding system** — bind/appeal/change-request flows for PUBG, CODM, and Free Fire usernames with admin review queues
- **Player settings** — push notification preferences and moderation opt-in/out controls

### Social Layer (v1.8.0)

| Feature | Description |
|---|---|
| **Social Feed** | `/feed` page — For You / Friends / Live Now tabs with win cards, stream cards, live wager cards |
| **Reactions** | 🔥💀🐐👀 reactions via `feed_reactions` table with like/unlike + notifications |
| **Follow System** | Asymmetric follow/unfollow (no mutual approval required). `useFollows` + `FollowButton`. Follower/following counts on profile pages. Fires `new_follower` notification. Entirely separate from the mutual Friends system — follows power the feed "Friends & Following" tab, friends power DMs and challenge invites. |
| **Friends System** | Send/accept/decline/remove, FriendButton component, pending requests |
| **Direct Messages** | Split-pane DM inbox at `/messages`, realtime chat, auto-open from `?with=WALLET` |
| **Referral System** | Invite codes, referral tracking, `/invite/[code]` landing page |
| **Airdrop / Events Page** | `/events` — campaign hero, qualify section, live activity card per user |
| **Share Cards** | Canvas-based 1200×630 PNG share cards — Win card + Airdrop campaign card |
| **Spectator Side Bets** | Bet on match outcomes from the spectator page, counter-offer flow, auto-resolve on wager end |
| **Dynamic OG Images** | Per-wager 1200×630 OG preview via `next/og` — game icon, players, stake, status |

---

## Architecture: Web2 Escrow → Solana

### The Backend Pattern

A payment escrow is one of the most common Web2 backend patterns: two parties deposit funds into a neutral holding account, a condition is verified, and funds release to the appropriate party. Traditional implementations rely entirely on a trusted intermediary — a bank, a payment processor, or a centralized server. GameGambit replaces this entirely with a Solana program.

---

### How This Works in Web2

```
Player A ──funds──▶ Bank/Stripe account (custody)
Player B ──funds──▶ Bank/Stripe account (custody)
                         │
                    Server verifies winner
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
         Winner gets 93%       Platform keeps 7–10%
```

A traditional escrow backend requires:

1. **Custody** — The platform holds user funds in a bank or payment processor. Users must trust the platform not to run off with their money.
2. **A centralized database** — Wager state lives in a PostgreSQL table. A single server controls all state transitions.
3. **Manual settlement** — A server process triggers fund release. If the server goes down, funds are stuck. If compromised, funds can be stolen.
4. **KYC/AML compliance** — Holding user funds requires financial licensing in most jurisdictions.
5. **Human dispute resolution** — No cryptographic proof of who won. Disputes are resolved by customer support.

Critical weaknesses: the platform is a single point of failure, users have no guarantee funds release correctly, regulatory overhead is enormous, and chargebacks are possible.

---

### How This Works on Solana

```
Player A ──SOL──▶ WagerAccount PDA (program-owned)
Player B ──SOL──▶ WagerAccount PDA (program-owned)
                         │
                 Program verifies conditions
                 (authority signature + winner arg)
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
         Winner gets 93%       Platform gets 7–10%
         (SystemProgram transfer)  (SystemProgram transfer)
```

Key differences from Web2:

1. **No custody** — Funds live in a PDA that only the program can spend. Not the platform, not the authority wallet — only valid program instructions can move the lamports.
2. **State is on-chain** — The `WagerAccount` struct is the canonical source of truth. Its `status` field is a Rust enum enforced by the program. Invalid state transitions are rejected at the VM level.
3. **Atomic settlement** — `resolve_wager` is a single transaction that simultaneously closes the PDA and transfers lamports to winner and platform. No window where funds can be stuck mid-transfer.
4. **No chargebacks** — SOL transfers are irreversible. Once deposited into the PDA, a player cannot reverse it unilaterally.
5. **Cryptographic authorization** — `resolve_wager` requires a signature from the authority keypair, enforced by the Solana runtime.

For Chess, settlement is fully automatic with no human in the loop:

```
Lichess game ends → Supabase Edge Function polls Lichess API
       → Matches usernames to wallet addresses
       → Calls resolve_wager with authority keypair
       → SOL releases to winner in ~400ms
```

---

### Account Model

**WagerAccount PDA seeds:** `["wager", player_a_pubkey (32 bytes), match_id (8 bytes little-endian)]`

Every wager has a unique, deterministic address derivable by anyone — no centralized registry needed. The frontend derives the PDA client-side using the same seeds.

**PlayerProfile PDA seeds:** `["player", player_pubkey (32 bytes)]`

One profile per wallet, globally unique, derivable without a lookup.

The WagerAccount holds actual SOL lamports (not a token), so settlement is a simple `SystemProgram::transfer`. No token mints, no associated token accounts, no approval steps. Gas costs are minimal (~6,725 compute units for `resolve_wager`).

---

### State Machine

```rust
pub enum WagerStatus {
    Created,      // PDA exists, only Player A has deposited
    Joined,       // Both players deposited, game about to start
    Voting,       // Game in progress, awaiting vote submission
    Retractable,  // Both votes agree — 15-second retract window
    Disputed,     // Votes disagree — moderator required
    Closed,       // Draw or cancelled — funds returned
    Resolved,     // Winner paid out — PDA closed
}
```

The program rejects any instruction that produces an invalid transition — enforced by the Solana runtime, not application logic that could be bypassed.

---

### Instruction Flow

```
initialize_player  →  Creates PlayerProfile PDA
        ↓
create_wager       →  Creates WagerAccount PDA, transfers stake from Player A
        ↓
join_wager         →  Player B transfers matching stake into PDA
        ↓
   [game is played]
        ↓
submit_vote        →  Each player submits winner claim (CODM/PUBG)
   OR
[Lichess API auto-resolves for Chess]
        ↓
resolve_wager      →  Authority signs, 90–95% → winner, 5–10% → platform (tiered)
   OR
close_wager        →  Draw or cancel: 100% → both players equally
```

---

### Tradeoffs & Constraints

| | Web2 | Solana |
|---|---|---|
| Fund custody | Platform holds funds | Program-owned PDA — trustless |
| Settlement speed | Days (ACH) / seconds (Stripe) | ~400ms, ~0.000005 SOL fee |
| Chargebacks | Possible | Irreversible by design |
| State integrity | Database (mutable by admin) | On-chain (program-enforced) |
| Licensing | Required to hold funds | Anyone can deploy this |
| Audit trail | Trust the platform | Public, permanent, on-chain |

**What Solana sacrifices:**

1. **Key management complexity** — The authority keypair must stay secure. A lost key means permanently locked funds in open PDAs. In Web2 you'd just reset a password.
2. **Account rent** — Every on-chain account costs ~0.00224 SOL (~320 bytes). Returned on close, but an upfront cost Web2 doesn't have.
3. **No free queries** — High-frequency reads are served from Supabase to avoid RPC overload, creating a dual-state architecture that must stay in sync.
4. **Irreversibility cuts both ways** — Bugs in the deployed program cannot be retroactively corrected for existing accounts the way a database migration can.
5. **Transaction ordering** — Parallel execution means two players could simultaneously attempt `join_wager`. The program handles this with a status check (`require!(wager.status == WagerStatus::Created)`), rejecting the second.
6. **Mobile wallet complexity** — `sendTransaction` from mobile requires Phantom's dApp browser or WalletConnect; standard `window.phantom` injection is unavailable in external browsers.

---

### The Dual-State Architecture

GameGambit uses Solana for financial settlement and Supabase for game state:

```
Solana (source of truth for funds)         Supabase (source of truth for game state)
  WagerAccount PDA holds lamports             Wager metadata (game type, Lichess ID)
  resolve_wager releases funds                Real-time updates via Postgres Realtime
  All financial events are on-chain           Vote tracking for CODM/PUBG
                                              Off-chain mirror of on-chain deposit status
                                              Ready room chat (wager_messages)
                                              Push notification subscriptions
                                              Moderation request queue
```

Storing game metadata on-chain would cost significant rent for string data (game IDs, usernames), and real-time updates would require constant RPC polling. Supabase handles high-frequency read/write while Solana handles the financial layer where trustlessness matters.

---

### Security Model

**What the program enforces (cannot be bypassed):**
- Only the depositing player can create/join a wager
- Stake amounts must match exactly on join
- Status transitions are validated at the VM level
- Only the authority can call `resolve_wager`
- Only participants can call `submit_vote`

**What the off-chain layer enforces:**
- Session token auth (Ed25519 wallet signature → JWT)
- DB triggers block direct writes to sensitive fields (`protect_player_sensitive_fields`, `protect_wager_sensitive_fields`)
- Lichess username verification before auto-resolution
- Rate limiting on wager creation and notifications
- Admin-only dispute resolution for non-chess games
- Moderator assignment with deadline enforcement and fee incentive

**What the user must trust:**
- Authority keypair is kept secure (multi-sig planned for mainnet)
- Lichess API result is accurate (public API, independently verifiable)
- Supabase mirror reflects on-chain state correctly

---

## Tech Stack

| Layer | Technology |
|---|---|
| Smart Contract | Rust, Anchor 0.30, Solana Devnet |
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS |
| Database | Supabase PostgreSQL (off-chain game state) |
| Auth | Wallet signature verification (Ed25519) + Lichess OAuth PKCE |
| Chess | Lichess Public API + Platform Token game creation |
| Push Notifications | Web Push API (VAPID), PWA Service Worker |
| Hosting | Vercel |

---

## Games Supported

| Game | Resolution Method |
|---|---|
| ♟ Chess | Automatic — Lichess API detects result and triggers on-chain payout |
| 🎮 Call of Duty Mobile | Peer voting — both players confirm winner after match |
| 🪖 PUBG | Peer voting |
| 🔥 Free Fire | Peer voting |

Voting flow for non-chess games:
```
voting → both confirm game complete → 10s sync → vote (5 min window)
       → agree    = auto-resolve on-chain
       → disagree = dispute → moderator assigned → 5-step verdict workflow
```

---

## Program Addresses

| | Address |
|---|---|
| **Program ID** | `E2Vd3U91kMrgwp8JCXcLSn7bt3NowDmGwoBYsVRhGfMR` |
| **Authority** | `Ec7XfHbeDw1YmHzcGo3WrK73QnqQ3GL9VBczYGPCQJha` |
| **Platform Wallet** | `3hwPwugeuZ33HWJ3SoJkDN2JT3Be9fH62r19ezFiCgYY` |
| **Network** | Solana Devnet |

> ⚠️ **Stale `PROGRAM_ID` in `src/lib/constants.ts`:** This file exports `PROGRAM_ID = "CPS82nShfYFBdJPLs4kLMYEUrTwvxieqSrkw6VYRopzx"` which is an old, incorrect address. Nothing in the codebase imports it (all Solana-interacting code imports `PROGRAM_ID` from `src/lib/solana-config.ts` which has the correct address above), but if you add a new file and accidentally import from `constants.ts` instead of `solana-config.ts`, your transactions will target the wrong program and fail silently. Always import `PROGRAM_ID` from `@/lib/solana-config`.

---

## Local Development

### UI

```bash
git clone https://github.com/GameGambitDev/gamegambit.git
cd gamegambit
npm install

cp .env.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY

npm run dev
```

### Smart Contract

```bash
git clone https://github.com/Web3ProdigyDev/gamegambit-sol.git
cd gamegambit-sol
anchor build
anchor test
anchor deploy --provider.cluster devnet
```

---

## Repository Structure

```
GameGambitDev/gamegambit       ← UI (Next.js 15)
Web3ProdigyDev/gamegambit-sol  ← Solana smart contract (Anchor/Rust)
```

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

# Twitch stream embeds — sets the `parent` domain param in the iframe URL.
# Without this, Twitch iframes silently fail on custom domains and Vercel preview URLs.
# Falls back to window.location.hostname for local dev.
NEXT_PUBLIC_APP_DOMAIN=thegamegambit.vercel.app

# WalletConnect (optional) — required if you want WalletConnect wallet support.
# Without it the WalletConnectWalletAdapter is not initialised and WalletConnect
# wallets won't appear in the connect modal. Get a project ID at cloud.walletconnect.com.
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id
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
│   │   │   ├── moderation/             # Moderation API routes
│   │   │   │   ├── accept/             # POST — moderator accepts assignment
│   │   │   │   ├── decline/            # POST — moderator declines assignment
│   │   │   │   └── verdict/            # POST — moderator submits final verdict
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
│   │   │   ├── behaviour-flags/   # Phase 6 — player risk scores, false vote/dispute loss tracking
│   │   │   ├── username-appeals/  # Phase 6 — review username appeal requests
│   │   │   ├── username-changes/  # Phase 6 — review username change requests
│   │   │   ├── on-chain/          # Live on-chain wager/player inspector — PDA lookup by wager UUID, match ID, or wallet
│   │   │   ├── pda-scanner/       # Bulk PDA scanner — classifies each as STUCK_FUNDS / ACTIVE_FUNDED / DISTRIBUTED / NOT_FOUND / PENDING_DEPOSIT / RPC_ERROR; batch recovery UI
│   │   │   ├── stuck-wagers/      # Filtered view of wagers with funds stuck on-chain; configurable age threshold (1h–7d); bulk force-resolve/refund
│   │   │   └── unauthorized/
│   │   ├── arena/                 # Wager creation & matching
│   │   ├── dashboard/             # User statistics
│   │   ├── feed/                  # Social feed — For You / Friends & Following / Live Now tabs
│   │   ├── messages/              # Split-pane DM inbox with realtime chat
│   │   ├── invite/[code]/         # Referral invite landing page
│   │   ├── events/                # Airdrop/campaign page with per-user activity card
│   │   ├── wager/[id]/            # Per-wager detail page with dynamic OG metadata
│   │   ├── leaderboard/           # Rankings
│   │   ├── my-wagers/             # Player's wager history
│   │   ├── profile/[walletAddress]/ # Public player profiles
│   │   ├── settings/              # Phase 6 — push notification + moderation prefs
│   │   ├── faq/                   # FAQ accordion page
│   │   ├── privacy/               # Privacy policy
│   │   ├── terms/                 # Terms of service
│   │   ├── not-found.tsx          # Custom 404 page
│   │   └── page.tsx               # Landing page
│   │
│   ├── components/
│   │   ├── admin/                 # Admin UI components
│   │   ├── landing/               # Landing page sections
│   │   ├── layout/                # Navbar, footer, layout shells
│   │   ├── feed/                  # Feed card components (win card, stream card, live wager card)
│   │   ├── CreateWagerModal.tsx   # Wager creation (chess time controls, game picker)
│   │   ├── ReadyRoomModal.tsx     # Ready room + deposits + chat + proposals
│   │   ├── EditWagerModal.tsx     # Wager edit proposals UI
│   │   ├── LiveGameModal.tsx      # Lichess game embed (chess only)
│   │   ├── GameCompleteModal.tsx  # Step 3 — non-chess "confirm game done" + sync countdown
│   │   ├── VotingModal.tsx        # Step 3 — vote on winner (agree → resolve, disagree → dispute)
│   │   ├── GameResultModal.tsx    # Win/loss/draw result screen; calls BalanceAnimationContext.queueAnimation before navigating
│   │   ├── ModerationOrchestrator.tsx  # Mounts once in Providers; coordinates popup → panel state
│   │   ├── ModerationRequestModal.tsx  # 30s accept/decline popup with countdown ring
│   │   ├── ModerationPanel.tsx         # 5-step guided verdict workflow
│   │   ├── DisputeGraceModal.tsx       # Phase 6 — concession prompt shown before moderator search
│   │   ├── PunishmentNoticeModal.tsx   # Phase 6 — shown to dispute loser; displays offense count, tier, escalation ladder; "Report unfair verdict" button
│   │   ├── ReportModeratorModal.tsx    # Phase 6 — files POST /api/moderation/report; min 10 chars; 409 treated as success
│   │   ├── SuspensionBanner.tsx        # Phase 6 — sticky top banner when player.is_suspended === true; shows time remaining; session-dismissible
│   │   ├── FollowButton.tsx            # Follow / Following (hover to unfollow) button; uses useFollows
│   │   ├── PlayerLink.tsx              # Renders wallet address as /profile/[wallet] link with username or truncated address
│   │   ├── ShareCards.tsx             # Canvas-based 1200×630 PNG share cards (Win card + Airdrop card)
│   │   ├── PageTransition.tsx         # Framer Motion page-level fade-in wrapper
│   │   ├── ScrollToTop.tsx            # Auto-scrolls to top on route change
│   │   ├── ThemeToggle.tsx            # Dark/light mode toggle (app defaults to dark)
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
│   │   ├── useDisputeGrace.ts      # Phase 6 — useConcede mutation for grace period concession
│   │   ├── useFollows.ts           # Asymmetric follow graph — follow/unfollow, follower/following counts, Realtime sync on follows:{wallet} channel. Distinct from useFriends (mutual). Powers feed "Friends & Following" tab
│   │   ├── useGameComplete.ts      # useMarkGameComplete mutation (Step 3)
│   │   ├── useLichess.ts           # OAuth PKCE flow, connect/disconnect
│   │   ├── useModeration.ts        # ModerationRequest queries + accept/decline/verdict mutations
│   │   ├── useNFTs.ts
│   │   ├── useNotifications.ts     # Bell dropdown + Web Push subscription
│   │   ├── usePlayer.ts
│   │   ├── usePlayerSettings.ts    # Phase 6 — push/moderation preference toggles
│   │   ├── useQuickMatch.ts
│   │   ├── useSolanaProgram.ts     # Anchor program interaction
│   │   ├── useTransactions.ts      # wager_transactions queries
│   │   ├── useUsernameBinding.ts   # Phase 6 — bind/appeal/change-request for game usernames
│   │   ├── useVoting.ts            # useSubmitVote, useRetractVote, deriveVoteOutcome (Step 3)
│   │   ├── useWagerChat.ts         # Ready room chat + proposals (wager_messages)
│   │   ├── useWagers.ts            # Wager CRUD + invokeSecureWager helper
│   │   ├── useWalletAuth.ts        # Ed25519 session token management
│   │   └── useWalletBalance.ts
│   │
│   ├── contexts/
│   │   ├── AdminAuthContext.tsx    # Single source of truth for admin session state — mounted once in admin layout; all admin hooks read from here. Never call /api/admin/auth/verify directly; use useAdminAuth() which reads this context
│   │   ├── GameEventContext.tsx    # Global Realtime listener — wager cache + moderation popup
│   │   ├── WalletContext.tsx
│   │   ├── ModalContext.tsx
│   │   ├── PWAContext.tsx
│   │   └── BalanceAnimationContext.tsx  # Queues win/loss SOL delta to sessionStorage for wallet balance flash animation on result. GameResultModal calls queueAnimation({ delta, wagerId, type }) before navigating; wallet balance display consumes it on next mount
│   │
│   ├── lib/
│   │   ├── admin/
│   │   │   ├── auth.ts             # JWT sign/verify
│   │   │   ├── password.ts         # PBKDF2 hashing
│   │   │   ├── permissions.ts      # RBAC matrix
│   │   │   ├── validators.ts       # Input validation
│   │   │   └── wallet-verify.ts    # Ed25519 signature verification
│   │   ├── idl/                    # Solana IDL (gamegambit.json + gamegambit.ts)
│   │   ├── constants.ts            # GAMES config, WAGER_STATUS enum, STATUS_LABELS, MANUAL_GAMES, fee helpers (calculatePlatformFee, getPlatformFeeBps, getFeeTierLabel), formatSol, truncateAddress. ⚠️ Also exports a stale PROGRAM_ID — never import it; use solana-config.ts instead
│   │   ├── data-consistency.ts
│   │   ├── database-utils.ts
│   │   ├── performance-tradeoffs.ts
│   │   ├── rate-limiting.ts        # Sliding-window rate limiter. ⚠️ Uses an in-memory Map store — resets on every Vercel cold start. Under burst traffic or multiple concurrent function instances, counts won't be shared. Replace with Upstash Redis for production-grade distributed limiting (tracked as C1 in fix plan)
│   │   ├── solana-config.ts        # Canonical PROGRAM_ID, PDA derivation helpers, INSTRUCTION_DISCRIMINATORS, EVENT_DISCRIMINATORS, ACCOUNT_DISCRIMINATORS, WAGER_JOIN_EXPIRY_SECONDS
│   │   ├── streamEmbed.ts          # Converts YouTube (full + youtu.be) and Twitch channel URLs into embeddable iframe URLs. Twitch requires NEXT_PUBLIC_APP_DOMAIN for the parent param — falls back to window.location.hostname
│   │   ├── confetti.ts             # triggerConfetti() (3s interval burst from both sides) and triggerCelebration() (big burst + two side bursts). Used in GameResultModal, LiveGameModal, UsernameSetupModal
│   │   ├── utils.ts
│   │   └── validation.ts           # All Zod schemas: usernameSchema, walletAddressSchema, gameTypeSchema, createWagerSchema, submitVoteSchema, bindUsernameSchema, usernameAppealSchema, appealResponseSchema, usernameChangeRequestSchema, updateSettingsSchema. Use validateWithError() helper throughout — do not define inline Zod schemas elsewhere
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
│   ├── secure-wager/       # All wager actions + Lichess game creation
│   ├── secure-player/      # Player create/update
│   ├── admin-action/       # Admin moderation actions (forceResolve, forceRefund, markDisputed, banPlayer, unbanPlayer, flagPlayer, unflagPlayer, checkPdaBalance, addNote)
│   ├── resolve-wager/      # On-chain settlement (called by admin-action + Lichess webhook)
│   ├── assign-moderator/   # Assigns moderator from eligible pool on dispute
│   ├── moderation-timeout/ # pg_cron — marks expired requests, triggers reassignment
│   ├── process-verdict/    # On-chain settlement after moderator verdict + punishment tiers
│   ├── process-concession/ # On-chain settlement for grace period concessions (no mod fee)
│   ├── check-chess-games/  # Polls Lichess API for completed games
│   └── verify-wallet/      # Ed25519 wallet signature → session token
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
| `players` | ❌ | User accounts, stats, invite codes, referral tracking |
| `wagers` | ✅ | Gaming matches with full lifecycle state |
| `wager_transactions` | ✅ | On-chain transaction ledger |
| `wager_messages` | ✅ | Ready room chat and wager edit proposals |
| `notifications` | ✅ | In-app event notifications |
| `push_subscriptions` | ❌ | VAPID Web Push endpoint + keys per player |
| `feed_reactions` | ❌ | Per-post reaction counts and user reactions (v1.8.0) |
| `friendships` | ❌ | Bidirectional friendship graph (v1.8.0) |
| `follows` | ✅ (channel: `follows:{wallet}`) | Asymmetric follow graph — powers feed "Friends & Following" tab. Distinct from `friendships` (mutual/approval-required) |
| `direct_messages` | ✅ | DM messages per conversation channel (v1.8.0) |
| `spectator_bets` | ✅ | Spectator side bet records (v1.8.0) |
| `nfts` | ❌ | Victory NFTs minted to Solana |
| `achievements` | ❌ | Player achievement badges |
| `rate_limit_logs` | ❌ | Sliding-window rate limiter |
| `admin_users` | ❌ | Admin portal accounts |
| `admin_sessions` | ❌ | Admin JWT session store |
| `admin_wallet_bindings` | ❌ | Admin Solana wallet bindings |
| `admin_audit_logs` | ❌ | Full RBAC audit trail with before/after state |
| `admin_logs` | ❌ | Wager-specific admin action log |
| `admin_notes` | ❌ | Admin free-text notes on players/wagers |
| `moderation_requests` | ✅ | Moderator assignment queue per dispute — Realtime INSERT triggers popup |
| `username_appeals` | ❌ | Player appeals for taken usernames (v1.5.0) |
| `username_change_requests` | ❌ | Formal username rebind requests (v1.5.0) |
| `punishment_log` | ❌ | Immutable punishment audit trail (v1.5.0) |
| `player_behaviour_log` | ❌ | Soft behavioural events for admin review (v1.5.0) |

> **`moderation_requests` Realtime:** The channel `moderation_requests:{walletAddress}` is subscribed in `GameEventContext` with a `moderator_wallet=eq.{walletAddress}` filter. On INSERT, if the new row is `status: 'pending'` and not already seen in this session, it sets `activeModerationRequest` which triggers `ModerationOrchestrator` to show the popup. The `seenModerationRequestIds` ref prevents duplicate popups across re-renders.

---

## Known Type Gaps

| Table / Column | Status | Workaround |
|-------|--------|------------|
| `wager_messages` | ❌ Not in `types.ts` | `as any` cast in `useWagerChat.ts`; `WagerMessage` + `ProposalData` interfaces defined there |
| `moderation_requests` | ❌ Not in `types.ts` | `ModerationRequest` interface defined in `useModeration.ts` and imported where needed |
| `feed_reactions` | ❌ Not in `types.ts` | Local interface in `useFeed.ts` (v1.8.0) |
| `friendships` | ❌ Not in `types.ts` | Local interface in `useFriends.ts` (v1.8.0) |
| `follows` | ❌ Not in `types.ts` | Local interface inlined in `useFollows.ts` (v1.8.0) |
| `direct_messages` | ❌ Not in `types.ts` | Local interface in `useDirectMessages.ts` (v1.8.0) |
| `spectator_bets` | ❌ Not in `types.ts` | Local interface in `useSideBets.ts` (v1.8.0) |
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

Eleven edge functions handle all server-side operations. All run on Supabase's Deno runtime.

### `secure-wager`
All wager lifecycle actions. Requires `X-Session-Token` header (Ed25519 wallet session token) for auth. Called via `invokeSecureWager()` in `src/hooks/useWagers.ts`.

| Action | Auth Required | Who Can Call | Description |
|--------|---------------|--------------|-------------|
| `create` | ✅ | Any player | INSERT new wager, create on-chain PDA |
| `join` | ✅ | Any player (not owner) | UPDATE status → joined |
| `vote` | ✅ | Either participant | UPDATE vote_player_a/b (legacy — kept for compatibility; use `submitVote` for all new code) |
| `edit` | ✅ | Player A only | UPDATE stake/stream_url/is_public (status = created only) |
| `applyProposal` | ✅ | Either participant | Apply an accepted proposal — bypasses owner-only edit restriction |
| `notifyChat` | ✅ | Either participant | INSERT notification to opponent (rate-limited: 1 per 5 min per wager) |
| `notifyProposal` | ✅ | Either participant | INSERT notification to opponent about new proposals |
| `notifyRematch` | ✅ | Either participant | Send `rematch_challenge` push notification to opponent with wager details |
| `delete` | ✅ | Player A only | DELETE wager (status = created only) |
| `setReady` | ✅ | Either participant | Calls `set_player_ready` DB RPC |
| `startGame` | ✅ | Either participant | UPDATE status → voting; creates Lichess game via platform token |
| `recordOnChainCreate` | ✅ | Player A only | UPDATE deposit_player_a = true, tx_signature_a |
| `recordOnChainJoin` | ✅ | Player B only | UPDATE deposit_player_b = true, tx_signature_b |
| `checkGameComplete` | ❌ | Either participant (unauthenticated) | Poll Lichess API — if game ended, trigger resolve. Only unauthenticated action; called by `check-chess-games` cron with no user session |
| `cancelWager` | ✅ | Either participant | UPDATE status → cancelled; trigger on-chain refund |
| `concedeDispute` | ✅ | Either participant | **Phase 6** — concede during grace period; resolves on-chain instantly, no mod fee, logs honesty event |
| `markGameComplete` | ✅ | Either participant | **Step 3** — sets `game_complete_a` or `game_complete_b`; when both set, writes `game_complete_deadline` (+10s) and `vote_deadline` (+5m 10s) |
| `submitVote` | ✅ | Either participant | **Step 3** — sets `vote_player_a` or `vote_player_b`; if both match → auto-resolve on-chain; if mismatch → status = `disputed` |
| `retractVote` | ✅ | Either participant | **Step 3** — clears caller's vote (only allowed while opponent hasn't voted yet) |
| `finalizeVote` | ✅ | Either participant | Triggers on-chain `resolve_wager` when wager is in `retractable` status and the 15s retract window has passed without a retraction |
| `voteTimeout` | ✅ | Either participant | Called when `vote_deadline` has passed with no resolution — sets status → `disputed` |
| `declineChallenge` | ✅ | Player B only | DELETE wager (status = created only); sends `wager_declined` notification to Player A |

> **`applyProposal` vs `edit`:** `edit` is owner-only and blocked when status = `joined`. `applyProposal` accepts auth from either participant and applies the change regardless of status. Always use `applyProposal` when responding to a proposal acceptance — never `edit`.

> **`vote` vs `submitVote`:** The legacy `vote` action is kept for compatibility. All new code should use `submitVote` for the Step 3 peer voting flow.

---

### `secure-player`
Player profile management. Requires `X-Session-Token` header.

| Action | Description |
|--------|-------------|
| `create` | INSERT new player row (accepts optional `referrerCode` — looks up referrer, links `referred_by_wallet`, increments `referral_count`) |
| `update` | UPDATE player profile fields (username, bio, avatar, game usernames) |
| `bindGame` | Dedicated game username binding for PUBG, CODM, and Free Fire. Checks uniqueness across all players, updates username + player ID + `game_username_bound_at` JSONB via `merge_game_bound_at` RPC. Returns `USERNAME_TAKEN` (409) if another player holds the username — client should enter appeal flow |

---

### `secure-bet`
Spectator side bet actions. Requires `X-Session-Token`. New in v1.8.0.

| Action | Description |
|--------|-------------|
| `place` | Transfer SOL to platform wallet on-chain; INSERT bet row with 30-min expiry. Blocked if wager is `voting`/`resolved`/`cancelled`. Players cannot bet on their own match. |
| `counter` | Propose different amount on an open bet; status → `countered` |
| `accept` | Second party sends SOL to platform wallet; status → `matched` |
| `cancel` | Owner cancels open (unmatched) bet; platform wallet refunds SOL |
| `resolveForWager` | Called after wager resolves. Pays winners 95% of pot, refunds all unmatched open bets, marks all bets as `resolved` or `expired`. |

> **`PLATFORM_WALLET_PRIVATE_KEY` secret:** Must be set in Supabase Edge Function Secrets as a JSON byte array. Same format as `AUTHORITY_WALLET_SECRET`. Required for all `secure-bet` payout and refund operations.

---

### `admin-action`
Admin dispute resolution and moderation. Requires admin JWT (not a player session token). Called via Next.js API routes at `/api/admin/action`.

| Action | Min Role | Description |
|--------|----------|-------------|
| `forceResolve` | moderator | UPDATE wager status → resolved with given winner; calls on-chain `resolve_wager` |
| `forceRefund` | moderator | UPDATE wager status → cancelled; calls on-chain `close_wager` to refund both players |
| `markDisputed` | moderator | Manually set wager status → disputed and `requires_moderator = true` |
| `banPlayer` | admin | UPDATE player `is_banned = true` with reason |
| `unbanPlayer` | admin | UPDATE player `is_banned = false` |
| `flagPlayer` | admin | Set `flagged_for_review = true` on player with reason |
| `unflagPlayer` | admin | Clear `flagged_for_review` flag on player |
| `checkPdaBalance` | admin | Derive wager PDA and fetch live on-chain lamport balance |
| `addNote` | admin | INSERT free-text note into `admin_notes` for a player or wager |

All actions write to both `admin_logs` and `admin_audit_logs` with before/after state.

> **Cold-start fix:** `admin-action` uses lazy Solana SDK import (`getSolana()`) and HTTP-polling transaction confirmation instead of `sendAndConfirmTransaction()` / `connection.confirmTransaction()`. Eager SDK import exhausted Deno worker memory budget; WebSocket-based confirmation drained CPU budget past the ~2s limit. The HTTP-polling approach polls `getSignatureStatuses` over plain fetch with a 30s deadline and zero WebSocket usage.

---

### `resolve-wager`
Low-level on-chain settlement. Called by `admin-action` and by the Lichess webhook after a chess game completes. Not called directly by the frontend.

Performs:
1. Derives the WagerAccount PDA from `player_a_wallet` + `match_id`
2. Builds and sends `resolve_wager` instruction (90–95% → winner, 5–10% → platform, tiered)
3. Or `close_wager` instruction for draws/cancels (100% → both players)
4. Calls `update_winner_stats` / `update_loser_stats` DB RPCs
5. INSERTs `wager_transactions` records for the payout

### `process-verdict` (Phase 6)
Called after a moderator submits a verdict via `/api/moderation/verdict`. Self-contained — Solana helpers inlined.

Performs:
1. Validates wager isn't already resolved
2. On-chain settlement: `resolve_wager` (winner) | `close_wager` (draw) | skip (`cannot_determine` → admin escalation)
3. Updates wager status + `wager_transactions`
4. Updates winner/loser stats
5. Applies auto-escalating punishment tier to the dispute loser (see [Punishment System](#phase-6--punishment-system))
6. Notifies both players + moderator

### `process-concession` (Phase 6)
Called when a player concedes during the dispute grace period. Does NOT charge a moderator fee. Performs the same on-chain `resolve_wager` settlement but skips punishment tier logic — concession is rewarded, not penalised. Logs a positive honesty event to `player_behaviour_log`.

---

## Phase 6 — Punishment System

### Dispute Grace Period (Step 4)

When a dispute is raised, `DisputeGraceModal` is immediately shown to both players before any moderator is assigned. Either player can tap "I was wrong" to concede — this triggers `concedeDispute` in `secure-wager`, which calls `process-concession` for on-chain resolution with no moderator fee. The concession is logged as a positive honesty event in `player_behaviour_log`. The moderator search runs silently in the background during the grace window.

```
status = 'disputed'
    → DisputeGraceModal shown to both players
    → Either player concedes → process-concession → resolved on-chain (no mod fee)
    → Nobody concedes → assign-moderator → ModerationRequestModal (Step 5)
```

### Auto-Escalating Strike Tiers

When a moderator verdict is submitted, `process-verdict` applies a punishment to the dispute loser based on their `punishment_log` offense count:

| Offense # | Punishment |
|-----------|-----------|
| 1 | Warning (no suspension) |
| 2 | 24h suspension |
| 3 | 72h suspension |
| 4 | 7-day suspension |
| 5+ | Indefinite ban |

Every punishment is written to `punishment_log` (immutable) and reflected on the player row (`is_suspended`, `suspension_ends_at`). `cannot_determine` verdicts escalate to admin with no punishment applied.

### Behaviour Flags Dashboard

Admin page at `/itszaadminlogin/behaviour-flags` aggregates `player_behaviour_log` entries per player into a risk score:

| Event Type | Weight |
|------------|--------|
| `false_vote` | High |
| `dispute_loss` | Medium |
| `moderator_reported` | High |

Admins can see per-player false vote counts, dispute losses, moderator reports, full event history, and risk score. Used to identify repeat bad actors for manual review or escalation.

### Username Binding System

Players can bind their game usernames (PUBG, CODM, Free Fire) via `/api/username/bind`. If a username is taken by another player, they can file an appeal via `/api/username/appeal`. Existing bindings can be changed via `/api/username/change-request`. All appeals and change requests appear in their respective admin review queues.

| Route | Description |
|-------|-------------|
| `POST /api/username/bind` | Bind a game username to wallet |
| `POST /api/username/appeal` | File appeal on a taken username |
| `POST /api/username/appeal/respond` | Admin responds to appeal |
| `POST /api/username/change-request` | Request a username change |

### Player Settings

`/settings` page lets players control:
- Push notification preferences (per event type)
- Whether they appear in the moderator assignment pool (`moderation_requests_enabled`)

Settings are stored on the `players` row and managed via `GET/PATCH /api/settings` with session token auth.

---

## Moderation System (Step 5)

When a dispute is raised (votes disagree or `vote_deadline` expires), the backend assigns a moderator from the eligible player pool and inserts a row into `moderation_requests`. The entire moderator-facing UI is self-contained — nothing outside `ModerationOrchestrator` needs to know about it.

### Flow

```
dispute detected → assign-moderator inserts moderation_requests row
                 → Supabase Realtime INSERT fires on moderator's client
                 → GameEventContext sets activeModerationRequest
                   (seen IDs persisted to sessionStorage — no re-show on refresh)
                 → ModerationOrchestrator renders ModerationRequestModal (30s popup)
                 → moderator clicks Accept → POST /api/moderation/accept
                 → ModerationPanel opens (5-step workflow, 10-min decision window)
                 → moderator selects verdict → POST /api/moderation/verdict
                 → on-chain settlement + 30% of platform fee (capped at $10) to moderator wallet

timeout path → pg_cron fires moderation-timeout every minute
             → marks expired pending/accepted requests as timed_out
             → increments moderation_skipped_count atomically via RPC
             → fires assign-moderator again for next candidate
```

### pg_cron Setup (run once in Supabase SQL Editor)

```sql
-- Required for HTTP calls from pg_cron
create extension if not exists pg_net;

-- Schedule the timeout handler (runs every minute)
select cron.schedule(
  'moderation-timeout', '* * * * *',
  $$ select net.http_post(
       url := 'https://vqgtwalwvalbephvpxap.supabase.co/functions/v1/moderation-timeout',
       headers := jsonb_build_object('Content-Type','application/json',
                    'Authorization','Bearer ' || current_setting('app.service_role_key')),
       body := '{}'::jsonb) $$);

-- Verify
select jobname, schedule from cron.job where jobname = 'moderation-timeout';
```

> The 30s popup window is enforced by the `deadline` column in `moderation_requests`, not the cron frequency. Running every minute is safe — the queries inside the function filter by `deadline < NOW()`.

### API Routes

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/moderation/accept` | Player session token | Moderator accepts assignment; sets status → `accepted`, writes `decision_deadline` |
| `POST` | `/api/moderation/decline` | Player session token | Moderator declines; sets status → `declined`; increments skip count atomically; triggers reassignment |
| `POST` | `/api/moderation/verdict` | Player session token | Submits verdict (`player_wallet \| 'draw' \| 'cannot_determine'`); triggers on-chain settlement and moderator fee payout |
| `POST` | `/api/moderation/report` | Player session token | Player reports an unfair verdict after dispute resolves |

### `useModeration.ts` Exports

| Export | Type | Description |
|--------|------|-------------|
| `ModerationRequest` | interface | Full `moderation_requests` row shape |
| `ModerationWager` | interface | Wager fields needed by the moderation UI |
| `useActiveModerationRequest` | query | Polls every 5s for pending/accepted request assigned to this wallet |
| `useModerationWager` | query | Fetches wager details for a given `wager_id` |
| `usePlayerDisplayNames` | query | Resolves wallet addresses → usernames for display |
| `useAcceptModeration` | mutation | `POST /api/moderation/accept` |
| `useDeclineModeration` | mutation | `POST /api/moderation/decline` |
| `useSubmitVerdict` | mutation | `POST /api/moderation/verdict` |

### ModerationPanel Steps

| Step | Label | What the moderator does |
|------|-------|------------------------|
| 1 | Overview | Sees dispute context, stake, players, time remaining, fee earned |
| 2 | Evidence | Reviews each player's vote + stream URL if provided |
| 3 | Research | Per-game verification links (Lichess, COD Mobile, PUBG, Free Fire) |
| 4 | Decision | Picks winner / draw / cannot_determine; adds optional notes |
| 5 | Confirm | Reviews selection and submits — irreversible |

### Fee Calculation

- Platform fee is tiered: **10%** (stake < 0.5 SOL) · **7%** (0.5–5 SOL) · **5%** (> 5 SOL)
- Moderator earns **30% of the platform fee, capped at $10 USD** on a fair verdict
- `cannot_determine` escalates to admin and earns no fee
- Fee formula: `calculatePlatformFee(stake_lamports)` — mirrors `calculate_platform_fee()` in `lib.rs`

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

Eight tables/channels are used for Realtime (confirmed live):

| Table | Channel Pattern | Used By |
|-------|----------------|---------|
| `wagers` | `game-events:player_a:{wallet}` | `GameEventContext` — player A's wager updates |
| `wagers` | `game-events:player_b:{wallet}` | `GameEventContext` — player B's wager updates |
| `wagers` | `game-events:public` | `GameEventContext` — public INSERT for open wager list |
| `wager_transactions` | `wager-transactions:{wagerId}` | Ready Room deposit confirmation |
| `notifications` | `notifications:{walletAddress}` | `useNotifications` — bell icon dropdown |
| `wager_messages` | `wager-chat:{wagerId}` | `useWagerChat` — ready room chat + proposals |
| `moderation_requests` | `moderation_requests:{walletAddress}` | `GameEventContext` — moderator assignment popup |
| `follows` | `follows:{walletAddress}` | `useFollows` — invalidates follower/following query cache on INSERT/DELETE |

> ⚠️ **Duplicate channel warning:** Never call `useWagerChat` for the same `wagerId` from both a parent and child component — Supabase silently drops duplicate channel names. The channel is created inside `useWagerChat` and must only exist once per wager per client session. Same applies to any other filtered channel. `GameCompleteModal` and `VotingModal` receive the live wager object from the React Query cache (kept fresh by `GameEventContext`) — they do NOT create their own Supabase subscriptions.

---

## Notification Types

`AppNotification['type']` union — all values that can appear in the `notifications` table and must be handled by `NotificationsDropdown`:

| Type | Icon | Routes to |
|------|------|-----------|
| `wager_joined` | Swords (primary) | `/arena?modal=ready-room` |
| `game_started` | Clock (green) | `/arena?modal=ready-room` |
| `wager_won` | Trophy (yellow) | `/my-wagers?modal=result` |
| `wager_lost` | Swords (destructive) | `/my-wagers?modal=result` |
| `wager_draw` | Wallet (muted) | `/my-wagers?modal=result` |
| `wager_cancelled` | Wallet (orange) | `/my-wagers?modal=details` |
| `rematch_challenge` | RefreshCw (primary) | `/arena?modal=details` |
| `wager_vote` | Trophy (blue) | `/arena?modal=ready-room` |
| `chat_message` | MessageSquare (muted) | `/arena?modal=ready-room` |
| `wager_proposal` | FileEdit (amber) | `/arena?modal=ready-room` |
| `wager_disputed` | Swords (orange) | `/my-wagers?modal=details` |
| `moderation_request` | Scale (amber) | `/dashboard` |
| `feed_reaction` | Heart (pink) | `/my-wagers?modal=details` |
| `friend_request` | UserPlus (primary) | `/profile/[actor_wallet]` |
| `friend_accepted` | Users (green) | `/profile/[actor_wallet]` |
| `new_follower` | UserPlus (accent) | `/profile/[actor_wallet]` (v1.8.0) |

> The `NotificationRoute` type in `NotificationsDropdown` is `'arena' | 'my-wagers' | 'dashboard' | 'profile'` — all routes must be valid Next.js pages.

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

**Notification types supported for push:** `wager_joined`, `game_started`, `wager_won`, `wager_lost`, `wager_draw`, `wager_cancelled`, `wager_disputed`, `moderation_request`.

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
          → disagree = status: disputed
                     → DisputeGraceModal shown (Phase 6 — either player can concede instantly)
                     │   → concede = process-concession on-chain (no mod fee, honesty logged)
                     └── nobody concedes → moderator assigned → ModerationRequestModal popup
                             → moderator accepts → ModerationPanel (5-step) → verdict
                             → process-verdict on-chain + punishment tier applied to loser
```

### Deposit Ordering — Player B waits for Player A

> ⚠️ `join_wager` reads `stake_lamports` from the on-chain PDA created by `create_wager`. If Player A's transaction hasn't confirmed when Player B's fires, the PDA doesn't exist and the program uses minimum rent (~0.00008 SOL) instead of the agreed stake.

**Fix (in `ReadyRoomModal.runDepositFlow`):** Player B polls `deposit_player_a` on the live wager object every 2s before calling `joinWagerOnChain`. The countdown and Ready button are unchanged.

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
| `GET` | `/api/admin/wagers/inspect` | Fetch wager by UUID, match ID (numeric), or wallet address — query param: `q` |
| `GET` | `/api/admin/wagers/pda-scan` | Bulk on-chain PDA scanner — query params: `status`, `limit` (default 200, max 500), `offset`. Returns per-wager verdict: STUCK_FUNDS / ACTIVE_FUNDED / DISTRIBUTED / NOT_FOUND / PENDING_DEPOSIT / RPC_ERROR |
| `POST` | `/api/admin/wallet/bind` | Bind Solana wallet to admin |
| `POST` | `/api/admin/wallet/verify` | Verify admin wallet signature |
| `POST` | `/api/moderation/accept` | Moderator accepts assignment |
| `POST` | `/api/moderation/decline` | Moderator declines assignment |
| `POST` | `/api/moderation/verdict` | Moderator submits verdict |
| `POST` | `/api/moderation/report` | Player reports unfair verdict |
| `GET/PATCH` | `/api/settings` | Get/update player notification + moderation prefs |
| `POST` | `/api/username/bind` | Bind game username to wallet |
| `POST` | `/api/username/appeal` | File appeal on taken username |
| `POST` | `/api/username/appeal/respond` | Admin responds to username appeal |
| `POST` | `/api/username/change-request` | Request a username rebind |
| `GET` | `/api/pubg/verify-username` | Verify PUBG username exists |

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

`GameEventContext` handles all wager Realtime subscriptions globally, keeping the React Query cache for `['wagers']` and `['wagers', 'open']` current without per-component polling. Chess game completion is polled app-wide every 10s from `GameEventContext` (previously only ran on the arena page — now survives navigation).

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

### Moderation Security
- All moderation API routes require a valid player session token
- Moderator wallet is verified server-side against the `moderation_requests` row before any mutation
- `seenModerationRequestIds` ref in `GameEventContext` prevents duplicate popups within a session
- Verdict is irreversible once submitted — enforced at the DB level

---

## Deployment

```bash
# Deploy all edge functions
supabase link --project-ref your_project_ref
supabase functions deploy secure-wager
supabase functions deploy secure-player
supabase functions deploy secure-bet
supabase functions deploy admin-action
supabase functions deploy resolve-wager
supabase functions deploy assign-moderator
supabase functions deploy moderation-timeout
supabase functions deploy process-verdict
supabase functions deploy process-concession
supabase functions deploy check-chess-games
supabase functions deploy verify-wallet

# Frontend deploys automatically via Vercel on push to main
```

Set all edge function secrets in Supabase Dashboard → Edge Functions → Secrets before deploying. Includes `PLATFORM_WALLET_PRIVATE_KEY` (required for `secure-bet`).

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
| [`ADMIN_FILES_CREATED.md`](./ADMIN_FILES_CREATED.md) | Admin panel file manifest — all pages, API routes, hooks, components |

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
- [x] Moderator dispute system — real-time assignment popup, 5-step guided verdict workflow, on-chain settlement
- [x] Phase 6 — Punishment system (strike tracking, auto-suspend/ban, behaviour flags, dispute grace period + concession flow, username binding/appeals/change-requests, player settings)
- [x] Social feed — For You / Friends / Live Now tabs, win cards, stream cards, live wager cards
- [x] Friends system — send/accept/decline/remove, FriendButton, pending requests
- [x] Direct messages — split-pane DM inbox, realtime chat
- [x] Referral / invite system — invite codes, `/invite/[code]` landing page, referral tracking
- [x] Airdrop / events page — campaign hero, qualify section, per-user activity card
- [x] Share cards — Win card + Airdrop campaign card (canvas PNG, share on X / copy / download)
- [x] Spectator side bets — place/counter/accept/cancel, auto-resolve, platform wallet escrow
- [x] Dynamic OG images — per-wager 1200×630 preview via `next/og`

**Planned**
- [ ] Suspension auto-lift pg_cron job
- [ ] `resolveForWager` auto-hook in `resolve-wager` edge function
- [ ] Tournament / bracket mode
- [ ] Weekly leaderboard rewards
- [ ] Mainnet deployment + multi-sig authority wallet
- [ ] Mobile app (React Native)
- [ ] Streaming integration (Twitch, YouTube) — embed support + CSP config
- [ ] Cross-chain settlement

---

**Made with ❤️ by Web3ProdigyDev**