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
│  │  - PostgreSQL (20 tables, RLS, triggers)         │        │
│  │  - Edge Functions (6 deployed)                   │        │
│  │  - Realtime (4 tables)                           │        │
│  │  - Row-level security                            │        │
│  └─────────────────────────────────────────────────┘        │
│         ▲                ▲                                    │
│         │                │                                    │
│         │          ┌─────┴──────────────┐                   │
│         │          │  cron-job.org      │                   │
│         │          │  (60s interval)    │                   │
│         │          │  → check-chess-    │                   │
│         │          │    games function  │                   │
│         │          └────────────────────┘                   │
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
- [ ] v1.5.0 migrations (001–005) applied in order
- [ ] All 20 tables confirmed in `pg_tables`
- [ ] Database backups enabled
- [ ] Realtime publication verified (4 tables)
- [ ] `merge_game_bound_at` RPC confirmed live
- [ ] Connection pool configured

### Solana Program
- [ ] Program deployed and IDL confirmed
- [ ] `AUTHORITY_WALLET_SECRET` keypair secured (see format note below)
- [ ] Program ID matches `solana-config.ts`
- [ ] Instruction discriminators match current IDL

### Edge Functions
- [ ] All 6 functions deployed
- [ ] All secrets configured (see table below)
- [ ] `verify-wallet` smoke-tested
- [ ] `check-chess-games` cron job configured at cron-job.org

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

The repo includes a single-shot SQL file that creates all core tables, indexes, RLS policies, DB functions, and triggers:

```
Supabase Dashboard → SQL Editor → paste gamegambit-setup.sql → Run
```

Then run the admin tables migration:

```
Supabase Dashboard → SQL Editor → paste scripts/migrations/001_create_admin_tables.sql → Run
```

Then run the v1.5.0 migrations **in order** (blocks 001 through 005 from `DB_SCHEMA.md`):

```
Supabase Dashboard → SQL Editor → run each block in sequence
```

> **Do not** use `supabase db push` for initial setup — run the SQL files directly in the dashboard.

### Verify Database Setup

After running the SQL files, confirm the schema is correct:

```sql
-- Confirm all 20 tables exist
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
-- Expected: achievements, admin_audit_logs, admin_logs, admin_notes,
-- admin_sessions, admin_users, admin_wallet_bindings, moderation_requests,
-- nfts, notifications, player_behaviour_log, players, punishment_log,
-- push_subscriptions, rate_limit_logs, username_appeals,
-- username_change_requests, wager_messages, wager_transactions, wagers

-- Confirm all triggers are active
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table;

-- Confirm all DB functions exist (should include merge_game_bound_at)
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public' ORDER BY routine_name;

-- Confirm Realtime is enabled on the right tables
SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
-- Expected: wagers, wager_transactions, notifications, wager_messages

-- Confirm free_fire is in the game_type enum (v1.5.0 migration 004)
SELECT enumlabel FROM pg_enum
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'game_type');
-- Expected: chess, codm, pubg, free_fire

-- Confirm merge_game_bound_at is service-role only
SELECT routine_name, security_type FROM information_schema.routines
WHERE routine_name = 'merge_game_bound_at';
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

All 6 edge functions must be deployed before the frontend.

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
supabase functions deploy check-chess-games
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
> If the format is wrong, the function will throw a silent parse error on every on-chain call. The same secret must also be set in Vercel (see Step 3) because Next.js API routes use it for session token validation.

### Smoke Test Edge Functions

After deploying, verify each function is reachable:

```bash
# Test verify-wallet (expects 400 with missing fields — that means it's running)
curl -X POST https://<project>.supabase.co/functions/v1/verify-wallet \
  -H "Content-Type: application/json" \
  -d '{}'
# Expected: {"error":"Missing required fields","success":false}

# Test check-chess-games (expects 200 with checked count)
curl -X POST https://<project>.supabase.co/functions/v1/check-chess-games \
  -H "Authorization: Bearer <your-anon-key>" \
  -H "Content-Type: application/json"
# Expected: {"checked":0,"message":"No active chess wagers"} (or similar)
```

---

## Step 3: Setup Cron Job for Chess Games

The `check-chess-games` function must be triggered externally every 60 seconds. It polls all active chess wagers and auto-resolves finished Lichess games — including sending push notifications to both players when a result is detected.

1. Go to [cron-job.org](https://cron-job.org) and create a free account
2. Create a new cron job:
   - **URL:** `https://<your-project-ref>.supabase.co/functions/v1/check-chess-games`
   - **Method:** POST
   - **Headers:** `Authorization: Bearer <your-supabase-anon-key>`
   - **Execution schedule:** Every minute (select "Every minute" or use cron expression `* * * * *`)
3. Enable the job and verify the first execution returns 200

> **Why cron-job.org and not Supabase cron?** Supabase's built-in pg_cron operates on the database layer and cannot invoke edge functions directly. An external HTTP trigger is the simplest approach.

> **Alternative:** You can also use GitHub Actions, a simple VPS, Vercel Cron (requires Pro), or any other HTTP scheduler that can POST to a URL every minute.

---

## Step 4: Setup Vercel Deployment

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

# Authority keypair — required for Next.js API route session validation
# Must be the same JSON byte array as AUTHORITY_WALLET_SECRET in Supabase secrets
AUTHORITY_WALLET_SECRET=[12,34,56,78,...]

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

# PUBG API (optional — enables live username verification in GameAccountCard)
# If not set, PUBG binding falls back to manual confirmation (same as CODM/Free Fire)
PUBG_API_KEY=<your_pubg_api_key>

# Upstash Redis (optional — for rate limiting cache)
REDIS_URL=redis://default:xxxxx@xxxxx.upstash.io:12345
REDIS_TOKEN=xxxxx
```

> ⚠️ **`AUTHORITY_WALLET_SECRET` in Vercel:** This is the same keypair as the Supabase edge function secret, but it must also exist in Vercel because `/api/settings`, `/api/username/appeal`, `/api/username/appeal/respond`, and `/api/username/change-request` validate session tokens using it in the Next.js server process. If this is missing, those routes will return 401 for every request.

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

## Step 5: Deploy Application

```bash
# Build locally first to catch errors
pnpm build

# Deploy to production
vercel --prod
```

---

## Step 6: Post-Deployment Verification

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

### Next.js API Routes

```bash
# Test settings route (expects 401 — means it's running and token validation is working)
curl https://yourdomain.com/api/settings
# Expected: {"error":"Unauthorised"}

# Test PUBG verify route (expects 400 — means it's running)
curl -X POST https://yourdomain.com/api/pubg/verify-username \
  -H "Content-Type: application/json" \
  -d '{}'
# Expected: {"valid":false,"error":"Username is required"}

# Test username appeal route (expects 401)
curl -X POST https://yourdomain.com/api/username/appeal
# Expected: {"error":"Unauthorised"}
```

### Edge Functions

```bash
# Verify verify-wallet is running
curl -X POST https://<project>.supabase.co/functions/v1/verify-wallet \
  -H "Content-Type: application/json" -d '{}'
# Expect: {"error":"Missing required fields","success":false}

# Verify check-chess-games is running
curl -X POST https://<project>.supabase.co/functions/v1/check-chess-games \
  -H "Authorization: Bearer <anon-key>"
# Expect: {"checked":0} or checked count with results
```

### Database

```sql
-- Confirm Realtime is active on the 4 required tables
SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
-- Must return: wager_messages, wager_transactions, notifications, wagers

-- Confirm all 20 tables exist
SELECT count(*) FROM pg_tables WHERE schemaname = 'public';
-- Expected: 20

-- Confirm free_fire enum value is present
SELECT enumlabel FROM pg_enum
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'game_type');

-- Confirm merge_game_bound_at RPC exists
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_name = 'merge_game_bound_at';
```

### Cron Job

Check the cron-job.org dashboard confirms the `check-chess-games` job is firing every minute and returning HTTP 200. Allow 2–3 minutes after enabling before diagnosing failures.

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
4. Confirm the disputes page loads and shows the moderation queue

---

## Step 7: Monitoring & Alerts

### Edge Function Logs

```bash
supabase functions logs secure-wager --tail
supabase functions logs resolve-wager --tail
supabase functions logs admin-action --tail
supabase functions logs check-chess-games --tail
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

### Disputed Wager Monitoring

```sql
-- Active disputes awaiting moderator
SELECT id, match_id, game, dispute_created_at, moderation_skipped_count
FROM wagers
WHERE status = 'disputed'
ORDER BY dispute_created_at ASC;

-- Moderation requests pending response (should be picked up within 20s)
SELECT id, wager_id, moderator_wallet, deadline, status
FROM moderation_requests
WHERE status = 'pending' AND deadline < NOW()
ORDER BY deadline ASC;
```

### Username Appeal Monitoring

```sql
-- Open appeals nearing their 48-hour response deadline
SELECT id, claimant_wallet, holder_wallet, game, username, response_deadline, status
FROM username_appeals
WHERE status = 'pending_response'
  AND response_deadline < NOW() + INTERVAL '6 hours'
ORDER BY response_deadline ASC;

-- Pending username change requests (admin review queue)
SELECT id, player_wallet, game, old_username, new_username, reason_category, created_at
FROM username_change_requests
WHERE status = 'pending_review'
ORDER BY created_at ASC;
```

### Alert Thresholds

| Metric | Threshold | Action |
|--------|-----------|--------|
| API response time P99 | > 1s | Investigate |
| Error rate | > 1% | Page on-call |
| Database CPU | > 80% | Scale up |
| `error_*` tx_type rows | Any new ones | Investigate settlement failures |
| Solana RPC failures | > 5 in 5 min | Switch RPC URL |
| `check-chess-games` cron | Missing > 5 min | Check cron-job.org status |
| Disputes with `moderation_skipped_count` > 5 | Any | Review moderator pool availability |

### Supabase Monitoring

```
Project Settings → Database → Database Usage
- Monitor connection count
- Track query performance
- Review slow query logs
```

---

## Step 8: Scaling Strategy

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

4. **Scale cron frequency carefully** — `check-chess-games` calls the PUBG/chess APIs per active wager. If concurrent chess wager counts exceed ~50, consider batching or staggering the cron interval.

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
3. Redeploy all edge functions
4. Redeploy frontend

### Authority Keypair Loss

> ⚠️ If the authority keypair is lost, all open WagerAccount PDAs are permanently locked — there is no recovery path. Back up `AUTHORITY_WALLET_SECRET` to a secure secrets manager (AWS Secrets Manager, HashiCorp Vault, etc.) before going to mainnet. Multi-sig is planned for mainnet to mitigate this.

### Cron Job Outage

If cron-job.org is down, chess wagers will not auto-resolve until the cron resumes. No data is lost — the Lichess game result persists on-chain and the `check-chess-games` function will pick it up on the next successful run. As a backup, you can manually trigger `checkGameComplete` via the admin panel or by calling the function directly:

```bash
curl -X POST https://<project>.supabase.co/functions/v1/secure-wager \
  -H "Authorization: Bearer <anon-key>" \
  -H "Content-Type: application/json" \
  -d '{"action":"checkGameComplete","wagerId":"<uuid>"}'
```

---

## Common Issues

### Edge function returns 500 on resolve/close
Check `AUTHORITY_WALLET_SECRET` format — must be a JSON byte array `[12,34,...]`, not a base58 string. Check edge function logs for parse errors.

### `/api/settings` or `/api/username/*` returns 401 in production
`AUTHORITY_WALLET_SECRET` is missing from Vercel environment variables. These Next.js API routes validate session tokens using this secret — it must be set in both Vercel and Supabase edge function secrets.

### Lichess game not auto-creating
`LICHESS_PLATFORM_TOKEN` is missing or expired. Generate a new one from the GameGambit Lichess account at `https://lichess.org/account/oauth/token`. Ensure `challenge:write` scope is included.

### Chess games not auto-resolving
Either the `check-chess-games` cron job is not running, or `LICHESS_PLATFORM_TOKEN` is invalid. Check cron-job.org for recent execution history and check edge function logs for `check-chess-games`.

### Push notifications not delivering
1. Confirm `NEXT_PUBLIC_VAPID_PUBLIC_KEY` has no whitespace
2. Confirm `VAPID_PUBLIC_KEY` in Supabase secrets matches exactly
3. Check `push_subscriptions` table for the player's endpoint
4. Check edge function logs for VAPID errors

### PUBG username verification not working
1. Confirm `PUBG_API_KEY` is set in Vercel environment variables
2. Check `/api/pubg/verify-username` logs for API errors
3. If the PUBG API returns a non-404 error (rate limit, server error), the route returns `valid: null` and the UI falls back to manual confirmation — this is intentional

### Username appeal route returns 409 `USERNAME_NOT_TAKEN`
A race condition: the username was freed between the bind attempt and the appeal submission. The client should retry the bind immediately.

### Wager status not updating after resolve
The `protect_wager_sensitive_fields` trigger is blocking a direct DB write somewhere. All status changes must go through `secure-wager` or `admin-action` edge functions using the service role key.

### `game_type` enum missing `free_fire`
Migration 004 from v1.5.0 was not run. Run the `ALTER TYPE game_type ADD VALUE 'free_fire'` block in the Supabase SQL editor.

### `merge_game_bound_at` RPC not found
Migration 005 from v1.5.0 was not run. Run the `CREATE OR REPLACE FUNCTION merge_game_bound_at` block in the Supabase SQL editor.

### Database Connection Timeout
- Increase connection pool size in Supabase dashboard
- Check that edge functions are reusing the Supabase client (not creating a new one per request)

---

## Maintenance

### Regular Tasks

- [ ] Review edge function error logs weekly
- [ ] Check `wager_transactions` for `error_*` rows weekly
- [ ] Check `username_appeals` for expired response deadlines weekly
- [ ] Review `username_change_requests` for `pending_review` items weekly
- [ ] Monitor Solana authority wallet balance (needs SOL for transaction fees)
- [ ] Verify cron-job.org `check-chess-games` is executing every minute
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

### Regenerating Supabase Types After Migrations

After any DB migration, run this to clear `as any` workarounds and restore full type safety:

```bash
npx supabase gen types typescript --project-id <your_project_ref> > src/integrations/supabase/types.ts
```

Currently pending regeneration (v1.5.0 tables and columns are not yet in `types.ts`):
`wager_messages`, `moderation_requests`, `username_appeals`, `username_change_requests`, `punishment_log`, `player_behaviour_log`, plus new columns on `players` and `wagers`.

---

## Resources

- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Supabase Realtime](https://supabase.com/docs/guides/realtime)
- [Vercel Environment Variables](https://vercel.com/docs/projects/environment-variables)
- [Web Push / VAPID](https://web.dev/push-notifications-overview/)
- [Anchor Deploy Docs](https://www.anchor-lang.com/docs/cli#deploy)
- [Solana Explorer (Devnet)](https://explorer.solana.com/?cluster=devnet)
- [PUBG API Docs](https://documentation.pubg.com/en/introduction.html)
- [cron-job.org](https://cron-job.org)

---

**Last Updated**: March 28, 2026 — v1.6.0