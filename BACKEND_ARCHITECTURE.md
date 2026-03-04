# Game Gambit Backend Architecture & Optimization Guide

## Overview

This document describes Game Gambit's backend architecture for handling 200k+ Monthly Active Users (MAUs) with a focus on performance, scalability, and data consistency.

## Tech Stack

- **Frontend**: Next.js 15 App Router with React 19
- **Database**: Supabase PostgreSQL with row-level security (RLS)
- **Caching**: Redis (Upstash) + in-memory cache
- **Blockchain**: Solana for wagers and transactions
- **Analytics**: DuckDB for historical OLAP queries
- **CDN**: Vercel Edge for static assets

## Database Architecture

### Tables & Indexes

The database includes strategic indexes for high-traffic queries:

#### Players Table
- Primary indexes: `wallet_address`, `username`, `is_banned`, `created_at`
- Composite indexes: `(total_wins, total_losses, total_earnings)`, `(is_banned, last_active)`
- **Benefit**: O(log n) lookup for leaderboard queries vs O(n) full scan

#### Wagers Table
- Primary indexes: `status`, `created_at`, `player_a_wallet`, `player_b_wallet`, `game`
- Composite indexes: `(status, created_at)`, `(is_public, created_at)` for real-time feeds
- **Benefit**: 100-1000x faster queries for active wagers

#### Wager Transactions Table
- Indexes: `wager_id`, `wallet_address`, `status`, `created_at`
- **Benefit**: Fast financial audit trails

### Materialized Views

Denormalized views for frequently accessed data:

```sql
-- Leaderboard rankings (refreshed every 5 minutes)
SELECT wallet_address, username, total_wins, total_earnings, win_rate,
       ROW_NUMBER() OVER (ORDER BY total_earnings DESC) as rank
FROM players WHERE is_banned = false;

-- Active wagers with denormalized player stats
SELECT w.id, w.game, w.stake_lamports, p_a.username, p_b.username,
       COALESCE(p_a.total_wins, 0) as player_a_wins
FROM wagers w
LEFT JOIN players p_a ON w.player_a_wallet = p_a.wallet_address;
```

**Tradeoff**: Slightly stale data (5-minute lag) but instant query response.

## Query Optimization

### Database Optimization Utilities (`src/lib/database-optimization.ts`)

Implements query-level optimizations:

```typescript
// Selective pagination
await getLeaderboard(client, { limit: 50, offset: 0, cache: true });

// Efficient player lookups
await getPlayerStats(client, walletAddress, cache=true);

// Batch operations (1000 players in 1 query vs 1000 separate calls)
await batchGetPlayers(client, [wallet1, wallet2, ...]);
```

**Benefits**:
- Batch queries: 100x fewer network roundtrips
- Cache layer: Most common queries cached for 5-10 minutes
- Selective fields: 50% less bandwidth vs `SELECT *`

### Query Anti-Patterns to Avoid

```typescript
// ❌ DON'T: Fetch all columns
SELECT * FROM wagers;

// ✓ DO: Specify only needed columns
SELECT id, game, stake_lamports, player_a_wallet, status FROM wagers;

// ❌ DON'T: Use OFFSET for pagination on large datasets
SELECT * FROM wagers OFFSET 100000 LIMIT 100;

// ✓ DO: Use keyset pagination
SELECT * FROM wagers WHERE created_at < ? ORDER BY created_at DESC LIMIT 100;

// ❌ DON'T: Subqueries in SELECT
SELECT (SELECT COUNT(*) FROM wagers WHERE player = p.wallet) FROM players p;

// ✓ DO: Use JOIN
SELECT p.*, COUNT(w.id) FROM players p
LEFT JOIN wagers w ON p.wallet_address = w.player_a_wallet GROUP BY p.id;
```

## Rate Limiting

### Rate Limiter Middleware (`src/lib/rate-limiting.ts`)

Prevents abuse and ensures fair resource allocation:

```typescript
// Configuration by endpoint type
const configs = {
  public: { windowMs: 60s, maxRequests: 100 },
  api: { windowMs: 60s, maxRequests: 50 },
  auth: { windowMs: 900s, maxRequests: 5 },
  wagerCreation: { windowMs: 60s, maxRequests: 10 },
  trading: { windowMs: 10s, maxRequests: 3 },
};
```

**For Production (200k+ MAUs)**:
- Use Redis-based rate limiting (Upstash) instead of in-memory
- Implement user-based rate limiting (authenticated users get higher limits)
- Add sliding window algorithm for smooth distribution

## Caching Strategy

### Three-Tier Caching

```
┌─────────────────────┐
│  Edge Cache (CDN)   │ ← Vercel Edge, 5-60 min
├─────────────────────┤
│ Application Cache   │ ← Redis/In-memory, 30s-10min
├─────────────────────┤
│ Database (Views)    │ ← PostgreSQL materialized views
└─────────────────────┘
```

**Cache invalidation strategy**:
- Write-through: Invalidate cache immediately on mutation
- Lazy reload: Rebuild cache on next query if expired

```typescript
// After player stats update
await invalidatePlayerCache(walletAddress);
// Clears: player:walletAddress, leaderboard, active_wagers

// After wager status change
await invalidateWagerCache(wagerId, [playerAWallet, playerBWallet]);
```

## Data Consistency Models

### 1. Strong Consistency (Wager Settlement)

Used for critical operations where accuracy is paramount:

```typescript
// Pessimistic locking - prevent concurrent updates
await lockAndUpdate(client, {
  table: 'wagers',
  id: wagerId,
  updates: { status: 'resolved', winner_wallet: winner }
});

// Ensures only one transaction succeeds
```

**Characteristics**:
- Waits for confirmation before returning
- Slightly higher latency (100-300ms)
- 100% accuracy guarantee

### 2. Eventual Consistency (Leaderboard Rankings)

Used for non-critical data that can be slightly stale:

```typescript
// Allows propagation delay
await eventualConsistencyUpdate(client, {
  table: 'players',
  id: playerId,
  updates: { total_wins: total_wins + 1 }
});

// Retries on failure, eventually succeeds
```

**Characteristics**:
- Immediate response
- Data accurate within 5-10 minutes
- Tolerates temporary inconsistencies

### 3. Optimistic Locking (High-Concurrency Updates)

```typescript
// Version-based conflict detection
const result = await updateWithOptimisticLock(client, 
  { table: 'players', id, version: 5 },
  { total_earnings: 1000 }
);

// If version mismatches (concurrent update), automatically retries
```

## Concurrency Handling

### Race Conditions

**Problem**: Two players accept the same wager simultaneously.

**Solution**: Atomic conditional update
```sql
UPDATE wagers 
SET player_b_wallet = $1, status = 'joined'
WHERE id = $2 AND player_b_wallet IS NULL;
```

Only one player_b assignment succeeds.

### Deadlocks

**Problem**: Circular lock waits

**Solution**: Acquire locks in consistent order
```typescript
// Always lock by wallet_address order to prevent cycles
const [wallet1, wallet2] = [walletA, walletB].sort();
```

### Phantom Reads

**Solution**: Use Serializable isolation (Supabase default)
- Prevents reading data that might change within transaction

### Lost Updates

**Solution**: Optimistic or pessimistic locking (as described above)

## SQL vs DuckDB Tradeoff

### Use PostgreSQL When:
✓ Transactional consistency required
✓ Multi-user concurrent access needed
✓ Row-level security required
✓ Real-time data mutations

### Use DuckDB When:
✓ Historical analysis (weekly/monthly reports)
✓ Complex aggregations (win distributions, earnings trends)
✓ OLAP queries (non-transactional reads)
✓ Batch analytics processing

### Recommended Architecture:

```
PostgreSQL (Hot Data)
    ↓ (daily export at 2 AM)
DuckDB (Analytical Processing)
    ↓ (pre-compute reports)
Cache (Redis/Vercel)
    ↓ (serve via API)
Dashboard
```

**Benefits**:
- Analytical queries don't block live transactions
- Pre-computed reports load instantly
- Cost-effective for high-query-volume analytics

## Performance Benchmarks (Target)

| Query | Target | Current |
|-------|--------|---------|
| Single player lookup (cached) | < 10ms | - |
| Leaderboard top 100 | < 50ms | - |
| Wager creation | 100-300ms | - |
| Live feed with pagination | < 30ms (cached) | - |
| Concurrent requests (200k MAUs) | 50k+ QPS | - |
| P99 latency | < 500ms | - |
| Cache hit rate | > 85% | - |

## Monitoring & Observability

### Key Metrics

```typescript
// Query latency percentiles
p50_query_latency: 20ms
p95_query_latency: 100ms
p99_query_latency: 500ms

// Cache performance
cache_hit_rate: 85%+
avg_cache_size: ~100MB

// Database
connection_pool_usage: < 80%
slow_query_count: < 10/day
```

### Alert Thresholds

- Query latency P95 > 500ms
- Cache hit rate < 70%
- Connection pool > 80% capacity
- Database CPU > 75%

## Scaling Path

| MAUs | Recommendation | Key Change |
|------|---------------|-----------| 
| 10k | Single Supabase | Basic indexing |
| 50k | Supabase + Redis | Materialized views |
| 200k | Enterprise Supabase + DuckDB | Partitioning, optimization |
| 1M+ | Read replicas + sharding | Multi-region |

## Implementation Checklist

- [x] Create database indexes
- [x] Define materialized views
- [x] Implement query optimization utilities
- [x] Add rate limiting middleware
- [x] Create cache invalidation patterns
- [x] Implement locking strategies
- [x] Add monitoring/observability
- [ ] Set up automated view refresh (5 min schedule)
- [ ] Configure Upstash Redis for production
- [ ] Set up DuckDB analytics pipeline
- [ ] Implement logging/alerting

## Files Reference

- **Database Optimization**: `src/lib/database-optimization.ts`
- **Rate Limiting**: `src/lib/rate-limiting.ts`
- **Data Consistency**: `src/lib/data-consistency.ts`
- **Performance Guide**: `src/lib/performance-tradeoffs.ts`
- **Type Definitions**: `src/types/index.ts`
- **Migrations**: `supabase/migrations/20260304_optimization.sql`
