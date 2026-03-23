---
title: Game Gambit Deployment Guide
description: Production deployment and infrastructure setup
---

# Deployment Guide

Complete guide for deploying Game Gambit to production with Vercel, Supabase, and Solana.

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                      Production Stack                         │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐     ┌──────────────┐                      │
│  │   Vercel     │────▶│  Upstash     │                      │
│  │  (Frontend)  │     │   Redis      │                      │
│  └──────┬───────┘     └──────────────┘                      │
│         │                                                     │
│         ▼                                                     │
│  ┌─────────────────────────────────────────────────┐        │
│  │              Supabase                            │        │
│  │  - PostgreSQL (15 tables, RLS, triggers)         │        │
│  │  - Edge Functions (5 deployed)                   │        │
│  │  - Realtime (4 tables)                           │        │
│  │  - Row-level security                            │        │
│  └─────────────────────────────────────────────────┘        │
│         ▲                                                     │
│         │                                                     │
│  ┌──────┴──────────────────────────────────────────┐        │
│  │   Solana (currently Devnet)                      │        │
│  │  - Program: E2Vd3U91kMrgwp8JCXcLSn7bt3NowDmGw.. │        │
│  │  - Authority wallet holds settlement keypair     │        │
│  └──────────────────────────────────────────────────┘       │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

> **Network note:** The program is currently deployed on **Solana Devnet**. Moving to mainnet requires redeploying the Anchor program and updating `NEXT_PUBLIC_SOLANA_NETWORK`, `NEXT_PUBLIC_SOLANA_RPC_URL`, and the authority keypair.

## Pre-Deployment Checklist

### Code Readiness
- [ ] Zero TypeScript errors (`pnpm tsc --noEmit`)
- [ ] No linting warnings (`pnpm lint`)
- [ ] Production build successful (`pnpm build`)
- [ ] Environment variables documented

### Database Readiness
- [ ] `gamegambit-setup.sql` tested on staging
- [ ] `001_create_admin_tables.sql` applied
- [ ] Database backups enabled
- [ ] Realtime publication verified (4 tables)
- [ ] Connection pool configured

### Solana Program
- [ ] Program deployed and IDL confirmed
- [ ] `AUTHORITY_WALLET_SECRET` keypair secured (see format note below)
- [ ] Program ID matches `solana-config.ts`
- [ ] Instruction discriminators match current IDL

### Edge Functions
- [ ] All 5 functions deployed
- [ ] All 8 edge function secrets configured
- [ ] `verify-wallet` smoke-tested

### Infrastructure
- [ ] Vercel project created
- [ ] Supabase project configured
- [ ] Custom domain configured
- [ ] SSL certificate installed

---

## Step 1: Prepare Supabase Database

### Create Production Project

1. Go to [supabase.com](https://supabase.com)
2. Create a new project:
   - Database version: Latest PostgreSQL
   - Region: Closest to majority of users
   - Plan: Pro or higher for production

### Run Database Setup

The repo includes a single-shot SQL file that creates all 15 tables, indexes, RLS policies, DB functions, and triggers:

```
Supabase Dashboard → SQL Editor → paste gamegambit-setup.sql → Run
```

Then run the admin tables migration separately:

```
Supabase Dashboard → SQL Editor → paste scripts/migrations/001_create_admin_tables.sql → Run
```

> **Do not** use `supabase db push` for initial setup — run the SQL files directly in the dashboard.

### Verify Database Setup

After running the SQL files, confirm the schema is correct:

```sql
-- Confirm all 15 tables exist
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- Confirm all triggers are active
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table;

-- Confirm all 9 DB functions exist
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public' ORDER BY routine_name;

-- Confirm Realtime is enabled on the right tables
SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
-- Expected: wagers, wager_transactions, notifications, wager_messages
```

### Connection Pooling

```
Supabase Dashboard → Project Settings → Database → Connection Pooling
- Mode: Transaction
- Max connections: 100
```

### Backups

```
Supabase Dashboard → Project Settings → Backups
- Backup frequency: Daily
- Backup retention: 30 days
```

---

## Step 2: Deploy Edge Functions

All 5 edge functions must be deployed before the frontend.

```bash
# Install Supabase CLI
npm install -g supabase

# Link to your project
supabase link --project-ref <project_ref>

# Deploy all functions
supabase functions deploy secure-wager
supabase functions deploy secure-player
supabase functions deploy admin-action
supabase functions deploy resolve-wager
supabase functions deploy verify-wallet
```

### Configure Edge Function Secrets

Set all secrets in **Supabase Dashboard → Edge Functions → Secrets** (not in `.env.local`):

| Secret | Description |
|--------|-------------|
| `AUTHORITY_WALLET_SECRET` | Authority keypair as a JSON byte array — see format note below |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (not the anon key) |
| `SOLANA_RPC_URL` | `https://api.devnet.solana.com` (or your RPC provider) |
| `LICHESS_PLATFORM_TOKEN` | Platform token from the GameGambit Lichess account |
| `VAPID_PRIVATE_KEY` | VAPID private key for Web Push |
| `VAPID_PUBLIC_KEY` | VAPID public key (must match `NEXT_PUBLIC_VAPID_PUBLIC_KEY`) |
| `ADMIN_WALLET` | Admin wallet address used by `admin-action` |

> ⚠️ **`AUTHORITY_WALLET_SECRET` format:** Must be a JSON array of bytes — e.g. `[12,34,56,78,...]` — **not** a base58 string or hex. The edge functions parse it as:
> ```typescript
> Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secret)))
> ```
> If the format is wrong, the function will throw a silent parse error on every on-chain call.

### Smoke Test Edge Functions

After deploying, verify each function is reachable:

```bash
# Test verify-wallet (expects 400 with missing fields — that means it's running)
curl -X POST https://<project>.supabase.co/functions/v1/verify-wallet \
  -H "Content-Type: application/json" \
  -d '{}'

# Expected: {"error":"Missing required fields","success":false}
```

---

## Step 3: Setup Vercel Deployment

### Create Vercel Project

```bash
# Install Vercel CLI
npm i -g vercel

# Login and link
vercel login
vercel link
```

### Configure Environment Variables

In **Vercel Dashboard → Project Settings → Environment Variables**:

```env
# Solana (currently Devnet — update both when moving to mainnet)
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_PROGRAM_ID=E2Vd3U91kMrgwp8JCXcLSn7bt3NowDmGwoBYsVRhGfMR

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxxx
SUPABASE_SERVICE_ROLE_KEY=xxxxx

# App URL (used for Lichess OAuth PKCE redirect)
NEXT_PUBLIC_SITE_URL=https://yourdomain.com

# Admin panel
ADMIN_JWT_SECRET=<min_32_char_random_string>
ADMIN_SESSION_TIMEOUT=3600000
ADMIN_REFRESH_TIMEOUT=604800000
NEXT_PUBLIC_ADMIN_SOLANA_NETWORK=devnet
ADMIN_SMTP_HOST=smtp.your-email.com
ADMIN_SMTP_PORT=587
ADMIN_SMTP_USER=your-email@example.com
ADMIN_SMTP_PASSWORD=your-app-password

# PWA Push Notifications
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<your_vapid_public_key>

# Upstash Redis (optional — for rate limiting cache)
REDIS_URL=redis://default:xxxxx@xxxxx.upstash.io:12345
REDIS_TOKEN=xxxxx
```

> ⚠️ **VAPID key format:** Copy `NEXT_PUBLIC_VAPID_PUBLIC_KEY` carefully — Vercel's env var UI can silently inject leading/trailing whitespace or quote characters. `useNotifications.ts` validates the key format on subscription and logs a warning if it detects invalid characters. If push notifications silently fail to subscribe, this is the first thing to check.

> Generate a new JWT secret with: `openssl rand -base64 32`

### Generate VAPID Keys (if needed)

```bash
npx web-push generate-vapid-keys
# Copy the output Public Key → NEXT_PUBLIC_VAPID_PUBLIC_KEY (Vercel) + VAPID_PUBLIC_KEY (Supabase secrets)
# Copy the output Private Key → VAPID_PRIVATE_KEY (Supabase secrets only — never expose this)
```

### Build Configuration

`vercel.json` (if not already present):

```json
{
  "buildCommand": "pnpm build",
  "devCommand": "pnpm dev",
  "installCommand": "pnpm install",
  "env": {
    "NODE_ENV": "production",
    "NEXT_TELEMETRY_DISABLED": "1"
  }
}
```

### Configure Domains

1. Add custom domain in Vercel dashboard
2. Update DNS:
   ```
   CNAME: www → cname.vercel.com
   A: @ → 76.76.19.20
   ```
3. Update `NEXT_PUBLIC_SITE_URL` to your production domain (needed for Lichess OAuth callback)

---

## Step 4: Deploy Application

```bash
# Build locally first to catch errors
pnpm build

# Deploy to production
vercel --prod
```

---

## Step 5: Post-Deployment Verification

### Frontend

```bash
# Confirm the app loads
curl -I https://yourdomain.com

# Confirm service worker is served with correct headers
curl -I https://yourdomain.com/sw.js
# Expect: Cache-Control: public, max-age=0, must-revalidate

# Confirm manifest
curl -I https://yourdomain.com/manifest.json
# Expect: Content-Type: application/manifest+json
```

### Edge Functions

```bash
# Verify verify-wallet is running
curl -X POST https://<project>.supabase.co/functions/v1/verify-wallet \
  -H "Content-Type: application/json" -d '{}'
# Expect: {"error":"Missing required fields","success":false}
```

### Database

```sql
-- Confirm Realtime is active on the 4 required tables
SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
-- Must return: wager_messages, wager_transactions, notifications, wagers

-- Confirm triggers are firing (check a protected field can't be bypassed)
-- Just try updating wager.status directly with anon key — it should silently fail
```

### Solana Program

```bash
# Confirm the program account exists on-chain
solana program show E2Vd3U91kMrgwp8JCXcLSn7bt3NowDmGwoBYsVRhGfMR \
  --url https://api.devnet.solana.com
```

### Admin Panel

1. Navigate to `https://yourdomain.com/itszaadminlogin/login`
2. Log in with superadmin credentials
3. Confirm wager list loads and dispute resolution is accessible

---

## Step 6: Monitoring & Alerts

### Edge Function Logs

```bash
supabase functions logs secure-wager --tail
supabase functions logs resolve-wager --tail
supabase functions logs admin-action --tail
```

### Failed Transaction Monitoring

```sql
-- Monitor for failed on-chain settlements
SELECT tx_type, count(*), max(created_at)
FROM wager_transactions
WHERE tx_type LIKE 'error_%'
GROUP BY tx_type
ORDER BY max(created_at) DESC;
```

### Alert Thresholds

| Metric | Threshold | Action |
|--------|-----------|--------|
| API response time P99 | > 1s | Investigate |
| Error rate | > 1% | Page on-call |
| Database CPU | > 80% | Scale up |
| `error_*` tx_type rows | Any new ones | Investigate settlement failures |
| Solana RPC failures | > 5 in 5 min | Switch RPC URL |

### Supabase Monitoring

```
Project Settings → Database → Database Usage
- Monitor connection count
- Track query performance
- Review slow query logs
```

---

## Step 7: Scaling Strategy

### Vertical Scaling

```
Supabase Dashboard → Project Settings → Billing
- Upgrade machine size when DB grows > 10GB
```

### Horizontal Scaling

For high traffic:

1. **Increase connection pool**
   ```
   Supabase → Connection Pooling → Max connections: 200+
   ```

2. **Add indexes for new query patterns**
   ```sql
   CREATE INDEX CONCURRENTLY idx_wagers_status_created
   ON wagers (status, created_at DESC);
   ```

3. **Use caching aggressively** — leaderboard, player stats, and open wager lists are the highest read volume and can be cached for 30-60 seconds without user impact

---

## Disaster Recovery

### Database Restore

```bash
# List available backups
supabase db backup list

# Restore from specific backup
supabase db restore --backup-id <id>
```

### Solana RPC Failover

1. Update `NEXT_PUBLIC_SOLANA_RPC_URL` in Vercel env vars to a backup provider (Helius, QuickNode, etc.)
2. Update `SOLANA_RPC_URL` in Supabase edge function secrets
3. Redeploy both

### Authority Keypair Loss

> ⚠️ If the authority keypair is lost, all open WagerAccount PDAs are permanently locked — there is no recovery path. Back up `AUTHORITY_WALLET_SECRET` to a secure secrets manager (AWS Secrets Manager, HashiCorp Vault, etc.) before going to mainnet. Multi-sig is planned for mainnet to mitigate this.

---

## Common Issues

### Edge function returns 500 on resolve/close
Check `AUTHORITY_WALLET_SECRET` format — must be a JSON byte array `[12,34,...]`, not a base58 string. Check edge function logs for parse errors.

### Lichess game not auto-creating
`LICHESS_PLATFORM_TOKEN` is missing or expired. Generate a new one from the GameGambit Lichess account at `https://lichess.org/account/oauth/token`.

### Push notifications not delivering
1. Confirm `NEXT_PUBLIC_VAPID_PUBLIC_KEY` has no whitespace
2. Confirm `VAPID_PUBLIC_KEY` in Supabase secrets matches exactly
3. Check `push_subscriptions` table for the player's endpoint
4. Check edge function logs for VAPID errors

### Wager status not updating after resolve
The `protect_wager_sensitive_fields` trigger is blocking a direct DB write somewhere. All status changes must go through `secure-wager` or `admin-action` edge functions using the service role key.

### Database Connection Timeout
- Increase connection pool size in Supabase dashboard
- Check that edge functions are reusing the Supabase client (not creating a new one per request)

---

## Maintenance

### Regular Tasks

- [ ] Review edge function error logs weekly
- [ ] Check `wager_transactions` for `error_*` rows weekly
- [ ] Monitor Solana authority wallet balance (needs SOL for transaction fees)
- [ ] Update dependencies quarterly
- [ ] Run security audit quarterly

### Updating the Anchor Program

If the Solana program is redeployed:

1. Update `NEXT_PUBLIC_PROGRAM_ID` in Vercel env vars
2. Update `PROGRAM_ID` in `src/lib/solana-config.ts`
3. Update all instruction discriminators in `src/lib/solana-config.ts` from the new IDL
4. Update discriminators in all 3 edge functions that build raw instructions (`secure-wager`, `admin-action`, `resolve-wager`)
5. Redeploy all edge functions
6. Redeploy frontend

---

## Resources

- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Supabase Realtime](https://supabase.com/docs/guides/realtime)
- [Vercel Environment Variables](https://vercel.com/docs/projects/environment-variables)
- [Web Push / VAPID](https://web.dev/push-notifications-overview/)
- [Anchor Deploy Docs](https://www.anchor-lang.com/docs/cli#deploy)
- [Solana Explorer (Devnet)](https://explorer.solana.com/?cluster=devnet)

---

**Last Updated**: March 2026