/**
 * API Route: Wagers
 * Create and fetch wagers with proper Supabase types
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/integrations/supabase/client'
import type { Database } from '@/integrations/supabase/types'

type WagerInsert = Database['public']['Tables']['wagers']['Insert']

/**
 * POST /api/wagers
 * Create a new wager
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { playerWallet, matchId, stakeLamports, game, lichessGameId, requiresModerator } = body

    // Validate required fields
    if (!playerWallet || typeof matchId !== 'number' || typeof stakeLamports !== 'number' || !game) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const supabase = createClient()

    // Check if player exists
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('wallet_address, is_banned')
      .eq('wallet_address', playerWallet)
      .single()

    if (playerError || !player) {
      return NextResponse.json(
        { success: false, error: 'Player not found' },
        { status: 404 }
      )
    }

    if (player.is_banned) {
      return NextResponse.json(
        { success: false, error: 'Player is banned' },
        { status: 403 }
      )
    }

    // Create wager with correct field names from Supabase schema
    const wagerData: WagerInsert = {
      player_a_wallet: playerWallet,
      match_id: matchId,
      stake_lamports: stakeLamports,
      game: game as Database['public']['Enums']['game_type'],
      status: 'created' as const,
      lichess_game_id: lichessGameId || null,
      requires_moderator: requiresModerator || false,
    }

    const { data: newWager, error: wagerError } = await supabase
      .from('wagers')
      .insert(wagerData)
      .select()
      .single()

    if (wagerError) {
      console.error('Wager creation error:', wagerError)
      return NextResponse.json(
        { success: false, error: 'Failed to create wager' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        data: newWager,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/wagers
 * Fetch wagers with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100)
    const offset = parseInt(searchParams.get('offset') || '0')
    const playerWallet = searchParams.get('playerWallet')
    const status = searchParams.get('status')

    const supabase = createClient()

    let query = supabase
      .from('wagers')
      .select('*')

    if (playerWallet) {
      query = query.or(
        `player_a_wallet.eq.${playerWallet},player_b_wallet.eq.${playerWallet}`
      )
    }

    if (status) {
      query = query.eq('status', status)
    }

    const { data: wagers, error } = await query
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Fetch error:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch wagers' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: wagers || [],
    })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
