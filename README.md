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
| `create_wager` | [`3rUc3Sb...`](https://explorer.solana.com/tx/3rUc3SbENp5UcnsLYs5AdZkPuknte4dhUYRFusxueFon7LRaSZxJvN3mBrzkQpcZEFHrJcVsHWdfcZrgLDbzG1Qf?cluster=devnet) | Player A staked 0.5 SOL into escrow PDA |
| `join_wager` | [`3tB5F8w...`](https://explorer.solana.com/tx/3tB5F8wZMkvFrfUqTw4WhrAmrohsktaxsHT7Z8iDc3wXjB54RbrDrBFt32boBRvnwek6bBVMRteachqPnMHuxnwf?cluster=devnet) | Player B matched the stake — 1 SOL total locked |
| `resolve_wager` | [`4amRCjE...`](https://explorer.solana.com/tx/4amRCjEFo3NwfExitnbf5F8x9asyxaxYW1tjjG8AHBznHuxER4LjyDXXMeQnTraxYMLoXJGfgprZbDrGvRZwjPBu?cluster=devnet) | Winner received 0.9 SOL, platform took 0.1 SOL fee |
| `resolve_wager` | [`33Te8Vj...`](https://explorer.solana.com/tx/33Te8VjmqXkKJ9U3MfHRtEyVUC6TTE3H96YvyHZA6drswYw7g1RhbLRtMXskfbRQezvsiTQsP6h4p8YCcJ5v9k1n?cluster=devnet) | Additional resolved wager — 0.9 SOL payout |
| `close_wager` (draw) | [`63Z4uvP...`](https://explorer.solana.com/tx/63Z4uvPFpYdsMScowXQhfSk4uvfVs3hB2zBNrr2f7Jsst3odEUADFnsWXUV1TfGdu1yRWDmZ6USeGVjjYGdG3xhx?cluster=devnet) | Draw — both players refunded in full |
| `close_wager` (cancel) | [`2VyA5SF...`](https://explorer.solana.com/tx/2VyA5SFMqWSKeG68aY73aYQ4gd4zFe6C2W37zAMoXPtaevpdJAyudNfSwXhnBmpVaDvMXZ9B3ScxaoHKvrA3TDyM?cluster=devnet) | Cancelled wager — on-chain refund to both players |

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
- Automatic chess result verification via Lichess API → triggers `resolve_wager`
- Transaction history with Solana Explorer links for every on-chain event
- Admin panel for dispute resolution, player management and audit logging

---

## Tech Stack

| Layer | Technology |
|---|---|
| Smart Contract | Rust, Anchor 0.30, Solana Devnet |
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS |
| Database | Supabase PostgreSQL (off-chain game state) |
| Auth | Wallet signature verification (Ed25519) |
| Chess Verification | Lichess Public API |
| Hosting | Vercel |

---

## Documentation

| File | Description |
|---|---|
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | Web2 → Solana design analysis, tradeoffs, constraints |
| [`DB_SCHEMA.md`](./DB_SCHEMA.md) | Complete database schema with all tables and relationships |
| [`API_REFERENCE.md`](./API_REFERENCE.md) | Full REST API reference including admin endpoints |
| [`DEPLOYMENT_GUIDE.md`](./DEPLOYMENT_GUIDE.md) | Production deployment guide |
| [`DEVELOPMENT_GUIDE.md`](./DEVELOPMENT_GUIDE.md) | Local development setup and workflows |
| [`CHANGE_LOGS.md`](./CHANGE_LOGS.md) | Version history and release notes |

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

## Program Addresses

| | Address |
|---|---|
| Program ID | `E2Vd3U91kMrgwp8JCXcLSn7bt3NowDmGwoBYsVRhGfMR` |
| Authority | `Ec7XfHbeDw1YmHzcGo3WrK73QnqQ3GL9VBczYGPCQJha` |
| Platform Wallet | `3hwPwugeuZ33HWJ3SoJkDN2JT3Be9fH62r19ezFiCgYY` |
| Network | Solana Devnet |

---

*Built by [@Web3ProdigyDev](https://github.com/Web3ProdigyDev) · March 2026*