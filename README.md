# GameGambit — Trustless P2P Gaming Escrow on Solana

[![Live on Devnet](https://img.shields.io/badge/Solana-Devnet-9945FF?logo=solana)](https://explorer.solana.com/address/E2Vd3U91kMrgwp8JCXcLSn7bt3NowDmGwoBYsVRhGfMR?cluster=devnet)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org)
[![Anchor](https://img.shields.io/badge/Anchor-0.30-512BD4)](https://anchor-lang.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-2D79C7)](https://typescriptlang.org)

**GameGambit** is a fully deployed, production-grade escrow engine built on Solana. Two players stake SOL on a gaming match. The funds lock in a program-derived account (PDA) on-chain. The winner is verified automatically and the pot releases trustlessly — no middleman, no custody risk. Moderators resolve disputes via on-chain settlement with complete audit trails.

> Built for the **Superteam Poland: Rebuild Backend Systems as On-Chain Rust Programs** bounty.  
> This project demonstrates how a traditional payment escrow backend is replaced entirely by an Anchor program on Solana, with role-based admin controls and full compliance logging.

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

These are real, finalized transactions from the deployed program on Solana Devnet:

| Instruction | Transaction | What Happened |
|---|---|---|
| `create_wager` | [`3rUc3SbENp5UcnsLYs5AdZkPuknte4dhUYRFusxueFon7LRaSZxJvN3mBrzkQpcZEFHrJcVsHWdfcZrgLDbzG1Qf`](https://explorer.solana.com/tx/3rUc3SbENp5UcnsLYs5AdZkPuknte4dhUYRFusxueFon7LRaSZxJvN3mBrzkQpcZEFHrJcVsHWdfcZrgLDbzG1Qf?cluster=devnet) | Player A staked 0.5 SOL into escrow PDA |
| `join_wager` | [`3tB5F8wZMkvFrfUqTw4WhrAmrohsktaxsHT7Z8iDc3wXjB54RbrDrBFt32boBRvnwek6bBVMRteachqPnMHuxnwf`](https://explorer.solana.com/tx/3tB5F8wZMkvFrfUqTw4WhrAmrohsktaxsHT7Z8iDc3wXjB54RbrDrBFt32boBRvnwek6bBVMRteachqPnMHuxnwf?cluster=devnet) | Player B matched the stake — 1 SOL total locked |
| `resolve_wager` | [`4amRCjEFo3NwfExitnbf5F8x9asyxaxYW1tjjG8AHBznHuxER4LjyDXXMeQnTraxYMLoXJGfgprZbDrGvRZwjPBu`](https://explorer.solana.com/tx/4amRCjEFo3NwfExitnbf5F8x9asyxaxYW1tjjG8AHBznHuxER4LjyDXXMeQnTraxYMLoXJGfgprZbDrGvRZwjPBu?cluster=devnet) | Winner received 0.9 SOL, platform took 0.1 SOL fee |
| `resolve_wager` | [`33Te8VjmqXkKJ9U3MfHRtEyVUC6TTE3H96YvyHZA6drswYw7g1RhbLRtMXskfbRQezvsiTQsP6h4p8YCcJ5v9k1n`](https://explorer.solana.com/tx/33Te8VjmqXkKJ9U3MfHRtEyVUC6TTE3H96YvyHZA6drswYw7g1RhbLRtMXskfbRQezvsiTQsP6h4p8YCcJ5v9k1n?cluster=devnet) | Additional resolved wager — 0.9 SOL payout |
| `close_wager` (draw) | [`63Z4uvPFpYdsMScowXQhfSk4uvfVs3hB2zBNrr2f7Jsst3odEUADFnsWXUV1TfGdu1yRWDmZ6USeGVjjYGdG3xhx`](https://explorer.solana.com/tx/63Z4uvPFpYdsMScowXQhfSk4uvfVs3hB2zBNrr2f7Jsst3odEUADFnsWXUV1TfGdu1yRWDmZ6USeGVjjYGdG3xhx?cluster=devnet) | Draw — both players refunded in full |
| `close_wager` (cancel) | [`2VyA5SFMqWSKeG68aY73aYQ4gd4zFe6C2W37zAMoXPtaevpdJAyudNfSwXhnBmpVaDvMXZ9B3ScxaoHKvrA3TDyM`](https://explorer.solana.com/tx/2VyA5SFMqWSKeG68aY73aYQ4gd4zFe6C2W37zAMoXPtaevpdJAyudNfSwXhnBmpVaDvMXZ9B3ScxaoHKvrA3TDyM?cluster=devnet) | Cancelled wager — on-chain refund to both players |

The `resolve_wager` transaction shows the `WagerResolved` event emitted on-chain with `total_payout: 900,000,000` lamports and `platform_fee: 100,000,000` lamports — exactly matching the 10% fee configured in the program constants.

---

## What Was Built

### On-Chain Program (Anchor/Rust)
A fully deployed Anchor program implementing a stateful escrow engine with 8 instructions:

| Instruction | Description |
|---|---|
| `initialize_player` | Creates a PlayerProfile PDA — one-time on-chain registration |
| `create_wager` | Player A locks stake in a WagerAccount PDA |
| `join_wager` | Player B matches the stake — escrow is now fully funded |
| `submit_vote` | Each player submits their claimed winner |
| `retract_vote` | Either player can retract within the 15-second window |
| `resolve_wager` | Authority releases 90% to winner, 10% to platform |
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
player: Pubkey
is_banned: bool
ban_expires_at: i64
bump: u8
```

**WagerAccount PDA** — seeds: `["wager", player_a_pubkey, match_id_le_bytes]`
```
discriminator: [u8; 8]
player_a: Pubkey
player_b: Pubkey
match_id: u64
stake_lamports: u64
status: WagerStatus   // Created|Joined|Voting|Retractable|Disputed|Closed|Resolved
vote_a: Option<Pubkey>
vote_b: Option<Pubkey>
winner: Option<Pubkey>
bump: u8
```

### Full-Stack Client
A Next.js 15 application providing complete player and admin interfaces:
- Real-time wager lobby with live status updates via Supabase Realtime
- Ready Room with countdown timer and on-chain deposit confirmation
- Lichess OAuth (PKCE) — players verify ownership of their Lichess account; platform token auto-creates locked games server-side with per-color play links; automatic result verification triggers `resolve_wager`
- Transaction history with Solana Explorer links for every on-chain event
- Admin panel for dispute resolution, player management and audit logging

---

## Architecture: Web2 Escrow → Solana

### The Backend Pattern

A payment escrow is one of the most common Web2 backend patterns: two parties deposit funds into a neutral holding account, a condition is verified, and funds release to the appropriate party. Traditional implementations rely entirely on a trusted intermediary — a bank, a payment processor, or a centralized server. GameGambit replaces this entirely with a Solana program.

### How This Works in Web2
```
Player A ──funds──▶ Bank/Stripe account (custody)
Player B ──funds──▶ Bank/Stripe account (custody)
                         │
                    Server verifies winner
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
         Winner gets 90%      Platform keeps 10%
```

A traditional escrow backend requires:

1. **Custody** — The platform holds user funds in a bank or payment processor. Users must trust the platform not to run off with their money.
2. **A centralized database** — Wager state lives in a PostgreSQL table. A single server controls all state transitions.
3. **Manual settlement** — A server process triggers fund release. If the server goes down, funds are stuck. If compromised, funds can be stolen.
4. **KYC/AML compliance** — Holding user funds requires financial licensing in most jurisdictions.
5. **Human dispute resolution** — No cryptographic proof of who won. Disputes are resolved by customer support.

Critical weaknesses: platform is a single point of failure, users have no guarantee funds release correctly, regulatory overhead is enormous, and chargebacks are possible.

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
         Winner gets 90%      Platform gets 10%
         (SystemProgram transfer)  (SystemProgram transfer)
```

Key differences:

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

### Account Model

**WagerAccount PDA seeds:** `["wager", player_a_pubkey (32 bytes), match_id (8 bytes little-endian)]`

Every wager has a unique, deterministic address derivable by anyone — no centralized registry needed. The frontend derives the PDA client-side using the same seeds.

**PlayerProfile PDA seeds:** `["player", player_pubkey (32 bytes)]`

One profile per wallet, globally unique, derivable without a lookup.

The WagerAccount holds actual SOL lamports (not a token), so settlement is a simple `SystemProgram::transfer`. No token mints, no associated token accounts, no approval steps. Gas costs are minimal (~6,725 compute units for `resolve_wager`).

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
resolve_wager      →  Authority signs, 90% → winner, 10% → platform
   OR
close_wager        →  Draw or cancel: 100% → both players equally
```

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

### The Dual-State Architecture

GameGambit uses Solana for financial settlement and Supabase for game state:
```
Solana (source of truth for funds)        Supabase (source of truth for game state)
  - WagerAccount PDA holds lamports          - Wager metadata (game type, Lichess ID)
  - resolve_wager releases funds             - Real-time updates via Postgres Realtime
  - All financial events are on-chain        - Vote tracking for CODM/PUBG
                                             - Off-chain mirror of on-chain deposit status
```

Storing game metadata on-chain would cost significant rent for string data (game IDs, usernames), and real-time updates would require constant RPC polling. Supabase handles high-frequency read/write while Solana handles the financial layer where trustlessness matters.

### Security Model

**What the program enforces (cannot be bypassed):**
- Only the depositing player can create/join a wager
- Stake amounts must match exactly on join
- Status transitions are validated at the VM level
- Only the authority can call `resolve_wager`
- Only participants can call `submit_vote`

**What the off-chain layer enforces:**
- Session token auth (Ed25519 wallet signature → JWT)
- Lichess username verification before auto-resolution
- Rate limiting on wager creation
- Admin-only dispute resolution for non-chess games

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
| Hosting | Vercel |

---

## Local Development
```bash
# Clone the UI repo
git clone https://github.com/GameGambitDev/gamegambit.git
cd gamegambit
npm install

# Set environment variables
cp .env.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY

# Run dev server
npm run dev
```

For the smart contract:
```bash
git clone https://github.com/Web3ProdigyDev/gamegambit-sol.git
cd gamegambit-sol
anchor build
anchor test
anchor deploy --provider.cluster devnet
```

---

## Documentation

| File | Description |
|---|---|
| [`DB_SCHEMA.md`](./DB_SCHEMA.md) | Complete database schema with all tables and relationships |
| [`API_REFERENCE.md`](./API_REFERENCE.md) | Full REST API reference including admin endpoints |
| [`DEPLOYMENT_GUIDE.md`](./DEPLOYMENT_GUIDE.md) | Production deployment guide |
| [`DEVELOPMENT_GUIDE.md`](./DEVELOPMENT_GUIDE.md) | Local development setup and workflows |
| [`CHANGE_LOGS.md`](./CHANGE_LOGS.md) | Version history and release notes |

---

## Program Addresses

| | Address |
|---|---|
| Program ID | `E2Vd3U91kMrgwp8JCXcLSn7bt3NowDmGwoBYsVRhGfMR` |
| Authority | `Ec7XfHbeDw1YmHzcGo3WrK73QnqQ3GL9VBczYGPCQJha` |
| Platform Wallet | `3hwPwugeuZ33HWJ3SoJkDN2JT3Be9fH62r19ezFiCgYY` |
| Network | Solana Devnet |

---

*Built by [@Web3ProdigyDev](https://github.com/Web3ProdigyDev) · March 2026*