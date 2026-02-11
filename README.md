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

## 🔗 Solana Wallet Adapter Integration

GameGambit uses the official [Solana Wallet Adapter](https://github.com/anza-xyz/wallet-adapter) libraries to connect users' wallets. Here's how every layer fits together:

### Packages Used

```
@solana/wallet-adapter-base      # Core types & interfaces
@solana/wallet-adapter-react     # React context hooks (useWallet, useConnection)
@solana/wallet-adapter-react-ui  # Pre-built modal & button components
@solana/web3.js                  # Solana JSON-RPC client & Transaction classes
```

### Provider Setup (`src/contexts/WalletContext.tsx`)

The entire app is wrapped in three nested providers:

```tsx
<ConnectionProvider endpoint={clusterApiUrl('devnet')}>   // ← RPC connection
  <WalletProvider wallets={[]} autoConnect>                // ← wallet detection
    <WalletModalProvider>                                  // ← connect modal UI
      {children}
    </WalletModalProvider>
  </WalletProvider>
</ConnectionProvider>
```

| Provider | Purpose |
|----------|---------|
| `ConnectionProvider` | Establishes a JSON-RPC connection to Solana Devnet via `clusterApiUrl('devnet')`. Every hook that sends transactions uses this connection. |
| `WalletProvider` | Detects installed wallets that implement the [Wallet Standard](https://github.com/wallet-standard/wallet-standard) (Phantom, Solflare, Backpack, etc.). The `wallets` array is empty because standard-compliant wallets are auto-detected. `autoConnect` re-connects the last used wallet on page load. |
| `WalletModalProvider` | Renders the wallet selection modal UI when the user clicks "Select Wallet". |

### How Components Use the Wallet

**1. Connect Button (Header)**

The `<WalletMultiButton />` component from `@solana/wallet-adapter-react-ui` handles the entire connect/disconnect flow out of the box:

```tsx
// src/components/layout/Header.tsx
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

<WalletMultiButton />  // Shows "Select Wallet" → connected address → disconnect
```

Custom CSS overrides style the button to match the GameGambit design system using Tailwind's arbitrary selector syntax (`[&_.wallet-adapter-button]`).

**2. Reading Wallet State**

Any component can access wallet state via the `useWallet()` hook:

```tsx
import { useWallet } from '@solana/wallet-adapter-react';

const { connected, publicKey, signMessage, sendTransaction } = useWallet();

// connected      → boolean, is a wallet connected?
// publicKey      → PublicKey object (the user's address)
// signMessage    → sign arbitrary bytes (used for wallet verification)
// sendTransaction → send a Transaction to the network
```

**3. Wallet Verification (`src/hooks/useWalletAuth.ts`)**

Before performing sensitive actions (creating/joining wagers), the app verifies wallet ownership via a challenge-response flow:

```
Client                          Edge Function (verify-wallet)
  │                                       │
  ├─ generate-nonce(walletAddr) ─────────►│
  │◄───────────── nonce + message ────────┤
  │                                       │
  ├─ signMessage(message) ───► Wallet     │
  │◄──── signature ──────────── Wallet    │
  │                                       │
  ├─ verify-signature(sig, msg) ─────────►│
  │                  │  nacl.sign.detached.verify()
  │◄──── sessionToken (1hr, HMAC) ────────┤
```

- The nonce is **stateless** — generated via HMAC-SHA256 from `wallet + timestamp + secret`, so no database lookup is needed
- The session token is a base64-encoded JSON payload + HMAC signature, valid for 1 hour
- Tokens are cached in `sessionStorage` and reused until expiry

**4. On-Chain Transactions (`src/hooks/useSolanaProgram.ts`)**

For escrow operations, the app builds Anchor-compatible instructions and sends them via `sendTransaction`:

```tsx
import { useConnection, useWallet } from '@solana/wallet-adapter-react';

const { connection } = useConnection();
const { publicKey, sendTransaction } = useWallet();

// Build instruction → create Transaction → sendTransaction(tx, connection)
```

Key on-chain operations:
- `initialize_player` — Create a player profile PDA
- `create_wager` — Deposit SOL into escrow PDA
- `join_wager` — Match deposit into the same escrow
- `resolve_wager` — Authority distributes funds to the winner (server-side)

### Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│                    React App                         │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │         WalletContextProvider                 │   │
│  │  ┌─────────────┐  ┌──────────────────────┐   │   │
│  │  │ Connection   │  │  WalletProvider      │   │   │
│  │  │ Provider     │  │  (auto-detect)       │   │   │
│  │  │ (Devnet RPC) │  │  ┌────────────────┐  │   │   │
│  │  │              │  │  │ WalletModal    │  │   │   │
│  │  │              │  │  │ Provider       │  │   │   │
│  │  └──────┬───────┘  │  └───────┬────────┘  │   │   │
│  │         │          └──────────┼───────────┘   │   │
│  └─────────┼─────────────────────┼───────────────┘   │
│            │                     │                    │
│  ┌─────────▼─────────────────────▼───────────────┐   │
│  │              useWallet() / useConnection()     │   │
│  │                                                │   │
│  │  Header ──► WalletMultiButton (connect UI)     │   │
│  │  useWalletAuth ──► signMessage (verification)  │   │
│  │  useSolanaProgram ──► sendTransaction (escrow) │   │
│  └────────────────────────────────────────────────┘   │
│            │                     │                    │
└────────────┼─────────────────────┼────────────────────┘
             │                     │
             ▼                     ▼
     Solana Devnet RPC      Wallet Extension
     (transactions)         (signing)
```

### Why This Approach?

1. **Zero wallet config** — The empty `wallets` array + Wallet Standard means any compliant wallet works without listing adapters manually
2. **Auto-reconnect** — `autoConnect` provides seamless UX across page reloads
3. **Stateless verification** — HMAC-based nonces avoid database lookups for the challenge-response flow
4. **Separation of concerns** — Wallet connection (adapter), auth verification (edge function), and on-chain logic (program hooks) are cleanly separated

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
├── contexts/            # WalletContext (Solana wallet adapter providers)
├── hooks/
│   ├── useWalletAuth.ts     # Wallet signature verification & session tokens
│   ├── useSolanaProgram.ts  # On-chain escrow instructions (create, join, resolve)
│   ├── useWagers.ts         # Wager CRUD via edge functions
│   ├── useLichess.ts        # Lichess API integration
│   ├── useTransactions.ts   # Transaction history queries
│   ├── useWalletBalance.ts  # SOL balance polling
│   └── usePlayer.ts         # Player profile management
├── lib/
│   ├── solana-config.ts     # Program ID, discriminators, PDA derivation
│   ├── constants.ts         # App-wide constants
│   └── utils.ts             # Utility functions
├── pages/               # Route pages (Arena, Dashboard, Leaderboard, etc.)
└── integrations/        # Supabase client & types

supabase/functions/
├── resolve-wager/       # On-chain wager resolution, draw refunds, escrow logging
├── secure-wager/        # Wager CRUD, Lichess game verification & auto-resolution
├── secure-player/       # Player profile management
├── mint-nft/            # Victory NFT minting
└── verify-wallet/       # Stateless wallet verification (nonce + signature check)
```

---

## 🔒 Security

- Authority wallet secret key is **never** exposed to the frontend
- All wager mutations go through authenticated edge functions
- Row Level Security (RLS) policies on all database tables
- Wallet ownership verified via Ed25519 signature verification (`tweetnacl`)
- Session tokens are HMAC-signed, expire after 1 hour, and cached client-side in `sessionStorage`
- Nonce generation is stateless (HMAC-SHA256) — no database state to manage or expire

---

## 📄 License

This project is proprietary. All rights reserved.
