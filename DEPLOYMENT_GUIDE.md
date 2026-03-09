---
title: Game Gambit Deployment Guide
description: Production deployment and infrastructure setup
---

# Deployment Guide

Complete guide for deploying Game Gambit to production with Vercel, Supabase, and Solana.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Production Stack                      │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────┐     ┌──────────────┐                  │
│  │   Vercel     │────▶│  Upstash     │                  │
│  │  (Frontend)  │     │   Redis      │                  │
│  └──────┬───────┘     └──────────────┘                  │
│         │                                                │
│         ▼                                                │
│  ┌──────────────────────────────────┐                  │
│  │   Supabase PostgreSQL             │                  │
│  │  - Hot data (real-time)           │                  │
│  │  - Row-level security             │                  │
│  │  - Connection pooling             │                  │
│  └──────────────────────────────────┘                  │
│         ▲                                                │
│         │                                                │
│  ┌──────┴──────────────────────────┐                   │
│  │   Solana RPC Endpoints            │                  │
│  │  - Mainnet-beta (production)      │                  │
│  │  - Backup RPC providers           │                  │
│  └───────────────────────────────────┘                 │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

## Pre-Deployment Checklist

### Code Readiness
- [ ] All tests passing
- [ ] Zero TypeScript errors
- [ ] No linting warnings
- [ ] Production build successful
- [ ] Environment variables documented

### Database Readiness
- [ ] All migrations tested on staging
- [ ] Database backups enabled
- [ ] Row-level security policies reviewed
- [ ] Indexes verified for performance
- [ ] Connection pool configured

### Solana Program
- [ ] Program deployed to mainnet
- [ ] IDL files updated and deployed
- [ ] Program ID correct in config
- [ ] Transaction fees estimated
- [ ] Error handling verified

### Infrastructure
- [ ] Vercel project created
- [ ] Supabase project configured
- [ ] Redis cache provisioned
- [ ] Custom domain configured
- [ ] SSL certificates installed

## Step 1: Prepare Supabase Database

### Create Production Project

1. Go to [supabase.com](https://supabase.com)
2. Create new project with following specs:
   - Database version: Latest PostgreSQL
   - Region: Closest to majority of users
   - Plan: Pro or higher for production

### Apply Migrations

```bash
# Install Supabase CLI
npm install -g supabase

# Link to project
supabase link --project-ref <project_ref>

# Apply all migrations
supabase db push

# Verify migrations
supabase migration list
```

### Configure Row-Level Security

Enable RLS on all tables:

```sql
-- Players table
ALTER TABLE players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view public player profiles"
  ON players FOR SELECT
  USING (verified = true);

CREATE POLICY "Users can update own profile"
  ON players FOR UPDATE
  USING (auth.uid()::text = wallet_address);

-- Wagers table
ALTER TABLE wagers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view public wagers"
  ON wagers FOR SELECT
  USING (is_public = true);

CREATE POLICY "Players can view own wagers"
  ON wagers FOR SELECT
  USING (
    player_a_wallet = auth.uid()::text 
    OR player_b_wallet = auth.uid()::text
  );

-- Similar policies for other tables...
```

### Connection Pooling

Configure connection pooling for high traffic:

```
Supabase Dashboard → Project Settings → Database → Connection Pooling
- Mode: Transaction
- Max connections: 100
- Min connections: 10
```

### Backups

Enable automatic backups:

```
Supabase Dashboard → Project Settings → Backups
- Backup frequency: Daily
- Backup retention: 30 days
```

## Step 2: Setup Vercel Deployment

### Create Vercel Project

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy project
vercel

# Link to Git repository
vercel link
```

### Configure Environment Variables

In Vercel dashboard → Project Settings → Environment Variables:

```env
# Solana Configuration
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta
NEXT_PUBLIC_PROGRAM_ID=E2Vd3U91kMrgwp8JCXcLSn7bt3NowDmGwoBYsVRhGfMR

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxxx

# Upstash Redis (Optional)
REDIS_URL=redis://default:xxxxx@xxxxx.upstash.io:12345

# Feature Flags
NEXT_PUBLIC_MAINTENANCE_MODE=false
NEXT_PUBLIC_MAX_WAGER_STAKE=1000000000000  # 1000 SOL

# Logging
NEXT_PUBLIC_LOG_LEVEL=info
```

### Configure Domains

1. Add custom domain in Vercel dashboard
2. Update DNS records:
   ```
   CNAME: www → cname.vercel.com
   A: @ → 76.76.19.20
   ```
3. Enable automatic SSL certificate

### Build Configuration

Update `vercel.json`:

```json
{
  "buildCommand": "pnpm build",
  "devCommand": "pnpm dev",
  "installCommand": "pnpm install",
  "env": {
    "NODE_ENV": "production",
    "NEXT_TELEMETRY_DISABLED": "1"
  },
  "redirects": [
    {
      "source": "/docs/:path*",
      "destination": "/api/docs/:path*",
      "permanent": false
    }
  ]
}
```

## Step 3: Configure Cache & Rate Limiting

### Upstash Redis Setup

1. Create Upstash Redis database at [upstash.com](https://console.upstash.com)
2. Configure in Vercel environment variables
3. Test connection:

```typescript
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.REDIS_URL!,
  token: process.env.REDIS_TOKEN!,
})

// Test
await redis.set('test-key', 'value')
const value = await redis.get('test-key')
console.log(value) // 'value'
```

### Cache Configuration

Set cache headers for optimal performance:

```typescript
// src/app/api/leaderboard/route.ts
export async function GET(request: Request) {
  // ... fetch data ...
  
  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
    }
  })
}
```

### Rate Limiting Configuration

Production settings in `src/lib/rate-limiting.ts`:

```typescript
const productionConfigs = {
  public: { windowMs: 60_000, maxRequests: 1000 },
  api: { windowMs: 60_000, maxRequests: 500 },
  auth: { windowMs: 900_000, maxRequests: 10 },
  wagerCreation: { windowMs: 60_000, maxRequests: 50 },
  trading: { windowMs: 10_000, maxRequests: 30 },
}
```

## Step 4: Deploy Application

### Initial Deployment

```bash
# Build locally first
pnpm build

# Deploy to production
vercel --prod

# Verify deployment
curl https://yourdomain.com/api/health
```

### Monitoring Deployment

1. **Check Vercel Logs**:
   ```bash
   vercel logs <deployment_url> --since 10m
   ```

2. **Monitor Performance**:
   - Visit Vercel Analytics dashboard
   - Check Core Web Vitals
   - Monitor response times

3. **Verify Database Connection**:
   ```bash
   # Check Supabase logs
   supabase logs show --level error
   ```

## Step 5: Production Verification

### Health Checks

```bash
# Test API health endpoint
curl https://yourdomain.com/api/health

# Expected response:
# {
#   "status": "ok",
#   "database": "connected",
#   "solana": "connected",
#   "timestamp": "2026-03-09T10:30:00Z"
# }
```

### Database Tests

```sql
-- Check table sizes
SELECT tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) 
FROM pg_tables 
WHERE schemaname = 'public';

-- Check slow queries
SELECT query, mean_exec_time, calls 
FROM pg_stat_statements 
ORDER BY mean_exec_time DESC 
LIMIT 10;

-- Check indexes
SELECT * FROM pg_stat_user_indexes 
WHERE idx_scan < 10 
ORDER BY pg_relation_size(indexrelid) DESC;
```

### Solana Program Tests

```typescript
// Test program interaction
const connection = new Connection(rpcUrl)
const program = getGameGambitProgram(provider)

// Get program account info
const accountInfo = await connection.getAccountInfo(programId)
console.log('Program account size:', accountInfo?.data.length)

// Test PDA derivation
const [playerPDA] = await derivePlayerProfilePDA(playerWallet)
console.log('Player PDA:', playerPDA.toString())
```

## Step 6: Monitoring & Alerts

### Setup Monitoring

1. **Vercel Monitoring**:
   - Enable usage insights
   - Configure performance alerts
   - Set up error tracking

2. **Supabase Monitoring**:
   ```
   Project Settings → Database → Database Usage
   - Monitor connection count
   - Track query performance
   - Review slow query logs
   ```

3. **Solana RPC Monitoring**:
   - Monitor RPC endpoint availability
   - Track request latency
   - Set up failover to backup RPC

### Key Metrics to Track

```typescript
// Add to observability platform (e.g., Sentry, Datadog)

// API Performance
- Response time p50, p95, p99
- Error rate by endpoint
- Request volume

// Database Performance
- Query latency
- Connection pool usage
- Slow query count

// Solana Network
- RPC endpoint availability
- Transaction confirmation time
- Program instruction errors

// User Experience
- Page load time
- Time to interactive
- Cumulative layout shift
```

### Alert Thresholds

| Metric | Threshold | Action |
|--------|-----------|--------|
| API response time P99 | > 1s | Investigate |
| Error rate | > 1% | Page on-call |
| Database CPU | > 80% | Scale up |
| Memory usage | > 85% | Alert |
| Solana RPC failures | > 5 in 5min | Switch RPC |

## Step 7: Scaling Strategy

### Vertical Scaling

For database growth > 10GB:

```
Supabase Dashboard → Project Settings → Billing
- Upgrade to larger machine size
- Increase compute resources
```

### Horizontal Scaling

For high traffic:

1. **Enable read replicas** (Supabase Enterprise)
   ```sql
   CREATE PUBLICATION staging FOR TABLE players, wagers;
   ```

2. **Increase connection pool**
   ```
   Supabase → Connection Pooling → Max connections: 200+
   ```

3. **Optimize queries**
   - Add materialized views
   - Pre-compute aggregations
   - Use caching aggressively

### Database Partitioning

For tables > 100GB:

```sql
-- Partition wagers by created_at
ALTER TABLE wagers 
PARTITION BY RANGE (EXTRACT(YEAR FROM created_at));

CREATE TABLE wagers_2026_q1 PARTITION OF wagers
  FOR VALUES FROM (2026-01-01) TO (2026-04-01);
```

## Disaster Recovery

### Backup & Restore

```bash
# Manual backup
supabase db backup create production

# List backups
supabase db backup list production

# Restore from backup
supabase db restore production --backup-id <id>
```

### Failover Procedures

**Database Failover**:
1. Stop application
2. Restore from backup
3. Verify data integrity
4. Restart application

**Solana RPC Failover**:
1. Update `NEXT_PUBLIC_SOLANA_RPC_URL` to backup RPC
2. Redeploy application
3. Monitor transaction confirmation

## Performance Tuning

### Database Query Optimization

```typescript
// ✓ Good: Batching
const players = await db.query(
  'SELECT * FROM players WHERE wallet_address = ANY($1)',
  [[wallet1, wallet2, wallet3]]
)

// ❌ Avoid: N+1 queries
for (const wallet of wallets) {
  await db.query('SELECT * FROM players WHERE wallet_address = $1', [wallet])
}
```

### API Route Optimization

```typescript
// Add response compression
export async function GET(request: Request) {
  const data = await fetchData()
  
  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Encoding': 'gzip',
      'Cache-Control': 'public, max-age=60'
    }
  })
}
```

### Frontend Optimization

```typescript
// Use dynamic imports for large components
import dynamic from 'next/dynamic'

const HeavyComponent = dynamic(() => import('./Heavy'), {
  loading: () => <div>Loading...</div>,
  ssr: false
})
```

## Maintenance

### Regular Tasks

- [ ] Review error logs weekly
- [ ] Check database performance monthly
- [ ] Update dependencies quarterly
- [ ] Run security audit quarterly
- [ ] Review costs monthly

### Scheduled Maintenance

Plan maintenance windows:
- Off-peak hours (2-4 AM UTC)
- Announce 1 week in advance
- Have rollback plan ready
- Monitor during maintenance

## Support & Debugging

### Getting Help

- **Vercel Support**: [vercel.com/support](https://vercel.com/support)
- **Supabase Docs**: [supabase.com/docs](https://supabase.com/docs)
- **Solana Docs**: [docs.solana.com](https://docs.solana.com)

### Common Issues

**Database Connection Timeout**
- Increase pool size
- Check network connectivity
- Verify connection string

**High Latency**
- Check database CPU/memory
- Enable query caching
- Add indexes to slow queries

**RPC Errors**
- Switch to backup RPC
- Check rate limits
- Verify transaction format

---

**Last Updated**: March 2026
