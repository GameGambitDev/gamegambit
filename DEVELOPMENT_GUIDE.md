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

# Required for admin panel
ADMIN_JWT_SECRET=<min_32_char_secret>
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Required for push notifications
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<your_vapid_public_key>
```

> Edge function secrets (`AUTHORITY_WALLET_SECRET`, `LICHESS_PLATFORM_TOKEN`, `VAPID_PRIVATE_KEY`, etc.) are set in Supabase Dashboard → Edge Functions → Secrets — not in `.env.local`. See [`DEPLOYMENT_GUIDE.md`](./DEPLOYMENT_GUIDE.md) for the full list.

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
│   │   │   └── lichess/webhook/       # Lichess game result webhook
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
│   │   │   └── unauthorized/
│   │   ├── arena/                     # Wager creation & lobby
│   │   ├── dashboard/
│   │   ├── leaderboard/
│   │   ├── my-wagers/
│   │   ├── profile/[walletAddress]/
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
│   │   ├── WagerChat.tsx
│   │   ├── NotificationsDropdown.tsx
│   │   ├── NFTGallery.tsx
│   │   ├── TransactionHistory.tsx
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
│   │   ├── useLichess.ts              # OAuth PKCE flow
│   │   ├── useNFTs.ts
│   │   ├── useNotifications.ts        # Bell dropdown + Web Push subscription
│   │   ├── usePlayer.ts
│   │   ├── useQuickMatch.ts
│   │   ├── useSolanaProgram.ts        # Anchor program interaction
│   │   ├── useTransactions.ts         # wager_transactions queries
│   │   ├── useWagerChat.ts            # Ready room chat + proposals
│   │   ├── useWagers.ts               # Wager queries + invokeSecureWager helper
│   │   ├── useWalletAuth.ts           # Ed25519 session token management
│   │   └── useWalletBalance.ts
│   │
│   ├── contexts/
│   │   ├── GameEventContext.tsx       # Global Realtime listener — keeps wager cache fresh
│   │   ├── WalletContext.tsx
│   │   ├── ModalContext.tsx
│   │   ├── PWAContext.tsx
│   │   └── BalanceAnimationContext.tsx
│   │
│   ├── lib/
│   │   ├── admin/
│   │   │   ├── auth.ts                # JWT sign/verify
│   │   │   ├── password.ts            # PBKDF2 hashing
│   │   │   ├── permissions.ts         # RBAC matrix
│   │   │   ├── validators.ts
│   │   │   └── wallet-verify.ts       # Ed25519 signature verification
│   │   ├── idl/                       # Solana IDL (gamegambit.json + gamegambit.ts)
│   │   ├── solana-config.ts           # Program IDs, discriminators, fee config
│   │   ├── constants.ts
│   │   ├── rate-limiting.ts
│   │   └── utils.ts
│   │
│   └── integrations/supabase/
│       ├── client.ts
│       ├── types.ts                   # Auto-generated — run supabase gen types after migrations
│       └── admin/                     # Admin DB operations (actions, audit, auth, sessions, wallets)
│
├── supabase/functions/
│   ├── secure-wager/    # All wager lifecycle actions (14 actions)
│   ├── secure-player/   # Player create/update
│   ├── admin-action/    # Admin dispute resolution (forceResolve, forceDraw, forceCancel, ban)
│   ├── resolve-wager/   # Low-level on-chain settlement (called by admin-action + Lichess webhook)
│   └── verify-wallet/   # Ed25519 wallet signature → JWT session token
│
├── public/
│   ├── manifest.json    # PWA manifest (shortcuts: Arena, Leaderboard, Dashboard)
│   └── sw.js            # Service worker (caching + push notification handler)
│
├── scripts/migrations/
│   └── 001_create_admin_tables.sql
│
├── gamegambit-setup.sql   # Single-shot full DB setup
├── next.config.ts
└── package.json
```

### Critical Architecture Pattern: Edge Functions for All Write Operations

> ⚠️ **This is the most important pattern to understand before writing any new feature.**

**All player-facing write operations go through Supabase edge functions — NOT Next.js API routes.**

Next.js API routes in this project handle only three things:
1. Lichess OAuth PKCE callback (`/api/auth/lichess/callback`)
2. Admin panel auth and actions (`/api/admin/*`)
3. Wallet signature → session token (`/api/auth/verify-wallet`)

Everything else — creating wagers, joining, voting, cancelling, chat, proposals, recording on-chain transactions — goes through the Supabase edge functions via `invokeSecureWager()` in `src/hooks/useWagers.ts`.

This is enforced by DB triggers that block direct client writes. See [DB Triggers — Developer Gotchas](#db-triggers--developer-gotchas) below.

### Key Design Patterns

#### 1. Session Token Authentication

`useWalletAuth` manages an Ed25519-signed JWT stored in `localStorage` under `gg_wallet_session`. It checks expiry on load and fires a `gg:session-expired` DOM event when stale.

All edge function calls require the token in the `X-Session-Token` header:

```typescript
// Always pass the session token from useWalletAuth
const { sessionToken, verifyWallet } = useWalletAuth()

const result = await supabase.functions.invoke('secure-wager', {
  body: { action: 'create', ...payload },
  headers: { 'X-Session-Token': sessionToken }
})
```

If a feature needs a new edge function call, use this pattern — never call Supabase directly for writes.

#### 2. React Query + GameEventContext for Wager State

The project uses `@tanstack/react-query` (not SWR) for data fetching. `GameEventContext` runs a global Supabase Realtime subscription on `wagers` and calls `queryClient.invalidateQueries(['wagers'])` on any change. This keeps all wager data fresh across the app without per-component polling.

```typescript
// Don't set up your own wager subscription in a component
// GameEventContext already handles it globally
const { data: wagers } = useQuery(['wagers', 'open'], fetchOpenWagers)
// This auto-refreshes when any wager changes — no extra setup needed
```

#### 3. Supabase Realtime — Avoid Duplicate Channels

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

#### 4. Type Safety

Types have two sources:
- `src/integrations/supabase/types.ts` — auto-generated from the live DB schema
- `src/hooks/useWagerChat.ts` — manually defined `WagerMessage` and `ProposalData` interfaces (because `wager_messages` is not yet in the generated types)

After any DB migration, regenerate:
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
   
   Add a new `case` to `secure-wager/index.ts` or create a new function in `supabase/functions/`:
   ```typescript
   case 'myNewAction': {
     // Validate session token (already done by the function wrapper)
     // Perform DB operation with service role client
     // Return result
   }
   ```

4. **Call from the frontend via `invokeSecureWager`**
   ```typescript
   const result = await invokeSecureWager('myNewAction', { ...payload }, sessionToken)
   ```

5. **Build React components**
   ```typescript
   import { useWagers } from '@/hooks/useWagers'
   ```

6. **Update documentation**
   - Add to `README_DEV.md` edge function actions table
   - Update `API_REFERENCE.md` if adding endpoints

### `next.config.ts` — Things to Know

The config has a few non-obvious settings:

- **Webpack fallbacks** — `fs: false, net: false, tls: false` are required for Solana Web3.js in the Next.js browser bundle. Don't remove them.
- **Image domains** — `lichess.org`, `*.lichess.org`, `*.supabase.co` (for avatars), and `gateway.pinata.cloud` (for NFT images via IPFS/Pinata) are whitelisted. Add new domains here when needed.
- **Service worker headers** — `sw.js` is served with `Cache-Control: no-cache` and `manifest.json` with `Content-Type: application/manifest+json`. These are required for PWA install prompts to work correctly.

### `solana-config.ts` — Things to Know

This file is the single source of truth for all on-chain constants:

```typescript
// These must match lib.rs exactly — do NOT hardcode them elsewhere
PROGRAM_ID         // E2Vd3U91kMrgwp8JCXcLSn7bt3NowDmGwoBYsVRhGfMR
AUTHORITY_PUBKEY   // Ec7XfHbeDw1YmHzcGo3WrK73QnqQ3GL9VBczYGPCQJha
PLATFORM_WALLET_PUBKEY  // 3hwPwugeuZ33HWJ3SoJkDN2JT3Be9fH62r19ezFiCgYY
PLATFORM_FEE_BPS   // 1000 (10%)
RETRACT_WINDOW_SECONDS  // 15 (matches lib.rs)
```

The instruction discriminators are also here — if you ever redeploy the Anchor program, update these from the new IDL. Using a stale discriminator will cause silent transaction failures.

### Code Standards

#### TypeScript
- Use strict mode: `"strict": true`
- Avoid `any` — the one intentional exception is `useWagerChat.ts` which casts to `any` at the Supabase client boundary because `wager_messages` isn't yet in generated types
- Export types from a single location

#### React
- Functional components only
- Use React Query for data fetching, not SWR (the codebase uses `@tanstack/react-query`)
- Avoid prop drilling — use context for shared state
- Don't create Supabase Realtime channels in components — use the existing hooks

#### Edge Functions
- All player write operations must go through edge functions (see architecture pattern above)
- Always validate the `X-Session-Token` header — the function wrapper handles this, don't skip it
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

Don't subscribe to `wagers` Realtime in individual components. `GameEventContext` already handles this globally and invalidates the React Query cache for all wager queries.

### Caching Strategy

```typescript
// Wager list — invalidated automatically by GameEventContext
useQuery(['wagers', 'open'], fetchOpenWagers, { staleTime: 30_000 })

// Leaderboard — changes slowly
useQuery(['leaderboard'], fetchLeaderboard, { staleTime: 60_000 })

// Player profile — changes infrequently
useQuery(['player', wallet], fetchPlayer, { staleTime: 120_000 })
```

---

## Git Workflow

### Branch Naming
- Feature: `feature/short-description`
- Bug fix: `fix/short-description`
- Documentation: `docs/short-description`

### Commit Messages
```
feat: add wager voting system
fix: prevent duplicate wager joins
docs: update API reference for new endpoints
refactor: extract WagerCard component
```

---

## Debugging

### Console Logging

Structured logging pattern used throughout:
```typescript
console.log('[secure-wager] Creating wager:', { wagerId, stake, game })
console.error('[useWagers] Edge function error:', error.message)
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
```

### Session Token Issues

If edge function calls return 401 unexpectedly, the session token may be expired. Listen for the `gg:session-expired` DOM event:
```typescript
window.addEventListener('gg:session-expired', () => {
  // Re-trigger verifyWallet()
})
```

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

### Wager status update silently fails
You're writing directly to a protected field. Route through `secure-wager` edge function. See [DB Triggers — Developer Gotchas](#db-triggers--developer-gotchas).

### Push notifications not working
Check that `NEXT_PUBLIC_VAPID_PUBLIC_KEY` has no leading/trailing whitespace (Vercel's env UI can inject it silently). `useNotifications` logs a format warning if it detects this.

### `wager_messages` missing from types
This table isn't in the generated types yet. Use the manually typed interfaces in `useWagerChat.ts` until the types are regenerated.

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
- [TanStack Query](https://tanstack.com/query/latest)

---

**Last Updated**: March 2026