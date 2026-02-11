# ♟️ GameGambit

**Wager. Play. Win.**

GameGambit is a decentralized competitive gaming platform where players stake SOL on head-to-head matches and the winner takes the pot. Built on Solana with Lichess integration for provably fair chess wagers.

🌐 **Live:** [gamegambit.lovable.app](https://gamegambit.lovable.app)

---

## 🎮 How It Works

1. **Connect Wallet** — Link your Solana wallet (Phantom, Solflare, etc.)
2. **Create or Join a Wager** — Set your stake in SOL and pick your game
3. **Play the Match** — Complete the game on Lichess (chess) or submit results for other titles
4. **Get Paid** — Winner receives 90% of the pot; 10% platform fee

### Supported Games

| Game | Verification | Status |
|------|-------------|--------|
| ♟️ Chess (Lichess) | Auto-resolved via Lichess API | ✅ Live |
| 🔫 PUBG Mobile | Player vote / moderator | 🔜 Coming Soon |
| 🎯 Call of Duty Mobile | Player vote / moderator | 🔜 Coming Soon |

---

## ✨ Features

- **On-Chain Escrow** — SOL stakes are held in a Solana program escrow until the match resolves
- **Auto-Resolution** — Chess wagers resolve automatically when the Lichess game finishes
- **Draw Handling** — Draws refund both players their full stake (no platform fee)
- **Victory NFTs** — Winners receive a commemorative NFT for each victory
- **Achievement Badges** — Unlock badges for milestones (win streaks, total earnings, etc.)
- **Transaction History** — Full on-chain transaction log with Solana Explorer links
- **Leaderboard** — Global rankings by wins, earnings, and streaks
- **Quick Match** — Instantly find an opponent and start playing
- **Live Game Viewer** — Watch Lichess games in real-time via embedded board

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React · TypeScript · Vite · Tailwind CSS · shadcn/ui · Framer Motion |
| Blockchain | Solana (Devnet) · Anchor Program · `@solana/web3.js` · Wallet Adapter |
| Backend | Lovable Cloud (Supabase) · Edge Functions · PostgreSQL |
| Chess API | Lichess API (game verification, live streaming, user profiles) |

### Solana Program

- **Program ID:** `CPS82nShfYFBdJPLs4kLMYEUrTwvxieqSrkw6VYRopzx`
- **Authority:** `45kmAptt386fRtXzjsbschuvhuEo77vRKA5eyYbH4XFs`
- **Network:** Devnet

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ ([install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating))
- A Solana wallet browser extension (e.g. [Phantom](https://phantom.app))

### Local Development

```sh
# Clone the repo
git clone <YOUR_GIT_URL>
cd gamegambit

# Install dependencies
npm install

# Start dev server
npm run dev
```

### Environment Variables

The following are configured automatically via Lovable Cloud:

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Backend API URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Public API key |

Edge function secrets (configured in Lovable Cloud):

| Secret | Description |
|--------|-------------|
| `AUTHORITY_WALLET_SECRET` | Solana authority wallet keypair (JSON) |
| `SOLANA_RPC_URL` | Solana RPC endpoint |

---

## 📁 Project Structure

```
src/
├── components/          # UI components
│   ├── landing/         # Landing page sections
│   ├── layout/          # Header, Layout
│   └── ui/              # shadcn/ui primitives
├── contexts/            # WalletContext
├── hooks/               # Custom hooks (wagers, Lichess, Solana, transactions)
├── lib/                 # Utils, constants, Solana config
├── pages/               # Route pages (Arena, Dashboard, Leaderboard, etc.)
└── integrations/        # Supabase client & types

supabase/functions/
├── resolve-wager/       # On-chain wager resolution, draw refunds, escrow logging
├── secure-wager/        # Wager CRUD, Lichess game verification & auto-resolution
├── secure-player/       # Player profile management
├── mint-nft/            # Victory NFT minting
└── verify-wallet/       # Wallet verification
```

---

## 🔒 Security

- Authority wallet secret key is **never** exposed to the frontend
- All wager mutations go through authenticated edge functions
- Row Level Security (RLS) policies on all database tables
- Wallet signature verification for sensitive operations

---

## 📄 License

This project is proprietary. All rights reserved.
