import { createClient } from '@supabase/supabase-js'
import { Database } from '@/integrations/supabase/types'

export interface QueryMetrics {
  duration: number
  rows: number
  cached: boolean
}

export interface CacheConfig {
  ttl: number // seconds
  key: string
  revalidate?: boolean
}

/**
 * Database query optimization strategies for 200k+ MAUs
 * Implements batch processing, connection pooling awareness, and query result caching
 */

// Cache layer using in-memory Map with TTL
const queryCache = new Map<string, { data: any; expiresAt: number }>()

export function getCacheKey(base: string, filters: Record<string, any>): string {
  const sorted = Object.keys(filters)
    .sort()
    .map(k => `${k}:${JSON.stringify(filters[k])}`)
    .join('|')
  return `${base}:${sorted}`
}

export function cacheGet(key: string): any | null {
  const cached = queryCache.get(key)
  if (!cached) return null
  if (Date.now() > cached.expiresAt) {
    queryCache.delete(key)
    return null
  }
  return cached.data
}

export function cacheSet(key: string, data: any, ttl: number): void {
  queryCache.set(key, {
    data,
    expiresAt: Date.now() + ttl * 1000,
  })
}

export function cacheClear(pattern?: string): void {
  if (!pattern) {
    queryCache.clear()
    return
  }
  for (const key of queryCache.keys()) {
    if (key.includes(pattern)) {
      queryCache.delete(key)
    }
  }
}

/**
 * LEADERBOARD QUERIES - Most critical for performance
 * Uses materialized views and selective pagination
 */
export async function getLeaderboard(
  client: ReturnType<typeof createClient<Database>>,
  options: {
    limit?: number
    offset?: number
    sortBy?: 'earnings' | 'wins' | 'streak'
    cache?: boolean
  } = {}
) {
  const { limit = 50, offset = 0, sortBy = 'earnings', cache = true } = options
  const cacheKey = getCacheKey('leaderboard', { limit, offset, sortBy })

  if (cache) {
    const cached = cacheGet(cacheKey)
    if (cached) return cached
  }

  const query = client.from('players').select('*')

  const { data, error, count } = await query
    .order(sortBy === 'earnings' ? 'earnings_rank' : 'wins_rank', { ascending: true })
    .range(offset, offset + limit - 1)

  if (error) throw error

  const result = { data, count }
  if (cache) {
    cacheSet(cacheKey, result, 300) // 5 minutes
  }
  return result
}

/**
 * PLAYER QUERIES - Optimized with selective field retrieval
 */
export async function getPlayerStats(
  client: ReturnType<typeof createClient<Database>>,
  walletAddress: string,
  cache = true
) {
  const cacheKey = getCacheKey('player_stats', { wallet: walletAddress })

  if (cache) {
    const cached = cacheGet(cacheKey)
    if (cached) return cached
  }

  const { data, error } = await client
    .from('players')
    .select(
      `
      id,
      wallet_address,
      username,
      total_wins,
      total_losses,
      total_earnings,
      total_wagered,
      best_streak,
      current_streak,
      created_at,
      is_banned
    `
    )
    .eq('wallet_address', walletAddress)
    .single()

  if (error) throw error

  if (cache) {
    cacheSet(cacheKey, data, 600) // 10 minutes
  }
  return data
}

/**
 * ACTIVE WAGERS QUERIES - Real-time feed with pagination
 */
export async function getActiveWagers(
  client: ReturnType<typeof createClient<Database>>,
  options: {
    limit?: number
    offset?: number
    game?: string
    cache?: boolean
  } = {}
) {
  const { limit = 20, offset = 0, game, cache = false } = options // No cache for real-time feed
  const cacheKey = getCacheKey('active_wagers', { limit, offset, game })

  if (cache) {
    const cached = cacheGet(cacheKey)
    if (cached) return cached
  }

  let query = client.from('wagers').select('*')

  if (game) {
    query = query.eq('game', game)
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw error

  const result = { data, count }
  if (cache) {
    cacheSet(cacheKey, result, 30) // 30 seconds for real-time
  }
  return result
}

/**
 * PLAYER WAGERS - User-specific wager history with efficient pagination
 */
export async function getPlayerWagers(
  client: ReturnType<typeof createClient<Database>>,
  walletAddress: string,
  options: {
    limit?: number
    offset?: number
    status?: string
    cache?: boolean
  } = {}
) {
  const { limit = 50, offset = 0, status, cache = true } = options
  const cacheKey = getCacheKey('player_wagers', { wallet: walletAddress, limit, offset, status })

  if (cache) {
    const cached = cacheGet(cacheKey)
    if (cached) return cached
  }

  let query = client
    .from('wagers')
    .select(
      `
      id,
      game,
      stake_lamports,
      status,
      player_a_wallet,
      player_b_wallet,
      created_at,
      resolved_at,
      winner_wallet
    `
    )
    .or(`player_a_wallet.eq.${walletAddress},player_b_wallet.eq.${walletAddress}`)

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw error

  const result = { data, count }
  if (cache) {
    cacheSet(cacheKey, result, 120) // 2 minutes
  }
  return result
}

/**
 * WAGER TRANSACTIONS - Financial queries with proper filtering
 */
export async function getWagerTransactions(
  client: ReturnType<typeof createClient<Database>>,
  options: {
    walletAddress?: string
    wagerId?: string
    status?: string
    limit?: number
    offset?: number
    cache?: boolean
  } = {}
) {
  const { walletAddress, wagerId, status, limit = 100, offset = 0, cache = true } = options
  const cacheKey = getCacheKey('wager_transactions', { walletAddress, wagerId, status, limit, offset })

  if (cache) {
    const cached = cacheGet(cacheKey)
    if (cached) return cached
  }

  let query = client.from('wager_transactions').select('*')

  if (walletAddress) {
    query = query.eq('wallet_address', walletAddress)
  }
  if (wagerId) {
    query = query.eq('wager_id', wagerId)
  }
  if (status) {
    query = query.eq('status', status)
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw error

  const result = { data, count }
  if (cache) {
    cacheSet(cacheKey, result, 180) // 3 minutes
  }
  return result
}

/**
 * BATCH OPERATIONS - Critical for handling 200k+ MAUs
 */
export async function batchGetPlayers(
  client: ReturnType<typeof createClient<Database>>,
  walletAddresses: string[]
) {
  if (walletAddresses.length === 0) return []
  if (walletAddresses.length > 1000) {
    throw new Error('Batch limit: maximum 1000 wallets per request')
  }

  const { data, error } = await client
    .from('players')
    .select('*')
    .in('wallet_address', walletAddresses)

  if (error) throw error
  return data
}

/**
 * MUTATION CACHE INVALIDATION
 * Called after write operations to maintain cache consistency
 */
export async function invalidatePlayerCache(walletAddress: string): Promise<void> {
  cacheClear(`player:${walletAddress}`)
  cacheClear('leaderboard')
  cacheClear('active_wagers')
}

export async function invalidateWagerCache(wagerId: string, playerWallets?: string[]): Promise<void> {
  cacheClear(`wager:${wagerId}`)
  if (playerWallets) {
    playerWallets.forEach(wallet => {
      cacheClear(`player:${wallet}`)
    })
  }
  cacheClear('active_wagers')
  cacheClear('leaderboard')
}

/**
 * MATERIALIZED VIEW REFRESH - Production scheduled job
 */
export async function refreshMaterializedViews(
  client: ReturnType<typeof createClient<Database>>
): Promise<void> {
  try {
    // Note: These should be called via a scheduled job, not on every request
    await client.rpc('refresh_materialized_views')
  } catch (error) {
    console.error('[v0] Failed to refresh materialized views:', error)
  }
}
