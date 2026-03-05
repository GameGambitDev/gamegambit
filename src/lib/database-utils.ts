import { createClient } from '@supabase/supabase-js'
import { Database } from '@/integrations/supabase/types'

/**
 * BATCH OPERATIONS - Essential for handling 200k+ MAUs
 * Retrieves multiple players by wallet addresses in a single query
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
 * Returns the query keys to invalidate based on entity type
 * Let React Query manage caching, we just provide invalidation patterns
 */
export function getInvalidationQueries(type: 'player' | 'wager', identifier: string) {
    if (type === 'player') {
        return [
            { queryKey: ['player', identifier] },
            { queryKey: ['players', 'search'] },
            { queryKey: ['leaderboard'] },
            { queryKey: ['wagers', 'my'] },
        ]
    }

    if (type === 'wager') {
        return [
            { queryKey: ['wagers'] },
            { queryKey: ['wagers', 'live'] },
            { queryKey: ['wagers', 'recent'] },
        ]
    }

    return []
}

/**
 * MATERIALIZED VIEW REFRESH - Production scheduled job
 * Should be called by a cron job (e.g., Vercel Cron, Supabase Scheduled Functions)
 * NOT on every request - this is expensive and should run infrequently
 * 
 * Example usage (in a scheduled function):
 * - Supabase: Create a scheduled function that calls this hourly
 * - Vercel: Use vercel.json with crons
 * - Node: Use node-cron or similar
 */
export async function refreshMaterializedViews(
    client: ReturnType<typeof createClient<Database>>
): Promise<void> {
    try {
        await client.rpc('refresh_materialized_views')
        console.log('[database] Materialized views refreshed successfully')
    } catch (error) {
        console.error('[database] Failed to refresh materialized views:', error)
        // Don't throw - this is a background task that shouldn't break the app
    }
}

/**
 * PLAYER STATS - Quick access to essential player data
 * Useful for profile pages, leaderboards, etc.
 */
export async function getPlayerStats(
    client: ReturnType<typeof createClient<Database>>,
    walletAddress: string
) {
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
    return data
}

/**
 * WAGER STATISTICS - Get wager counts and stats
 * Useful for dashboard summaries
 */
export async function getWagerStats(
    client: ReturnType<typeof createClient<Database>>,
    walletAddress: string
) {
    const { data, error } = await client
        .from('wagers')
        .select('status, id')
        .or(`player_a_wallet.eq.${walletAddress},player_b_wallet.eq.${walletAddress}`)

    if (error) throw error

    // Count by status
    const stats = {
        total: data.length,
        created: data.filter(w => w.status === 'created').length,
        joined: data.filter(w => w.status === 'joined').length,
        voting: data.filter(w => w.status === 'voting').length,
        resolved: data.filter(w => w.status === 'resolved').length,
    }

    return stats
}

/**
 * ACTIVE GAMES - Get currently active wagers
 * Used for real-time dashboard and notifications
 */
export async function getActiveGames(
    client: ReturnType<typeof createClient<Database>>,
    limit: number = 50
) {
    const { data, error } = await client
        .from('wagers')
        .select('*')
        .in('status', ['joined', 'voting'])
        .order('created_at', { ascending: false })
        .limit(limit)

    if (error) throw error
    return data
}