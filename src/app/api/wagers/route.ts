/**
 * API Route Example: Create Wager
 * Demonstrates proper type usage with IDL and database
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/integrations/supabase/client'
import {
  CreateWagerInstructionArgs,
  type Wager,
  type Player,
  GameGambitError,
  ERROR_CODES,
  lamportsToSol,
} from '@/types'
import {
  getGameGambitProgram,
  deriveWagerAccountPDA,
  buildCreateWagerInstruction,
  validateWagerArgs,
} from '@/lib/solana-program-utils'
import { withRateLimit } from '@/lib/rate-limiting'
import { withDatabaseOptimization } from '@/lib/database-optimization'
import { withDataConsistency } from '@/lib/data-consistency'

/**
 * POST /api/wagers/create
 * Create a new wager on-chain and sync to database
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { playerWallet, matchId, stakeAmount, lichessGameId, requiresModerator } = body

    // Validate inputs
    if (!playerWallet || typeof matchId !== 'number' || typeof stakeAmount !== 'number') {
      throw new GameGambitError(
        ERROR_CODES.INVALID_WALLET.code,
        ERROR_CODES.INVALID_WALLET.statusCode,
        'Invalid wallet or match parameters'
      )
    }

    // Convert SOL to lamports for Solana
    const stakeLamports = Math.round(stakeAmount * 1_000_000_000)

    // Validate wager args
    const wagerArgs: CreateWagerInstructionArgs = {
      matchId,
      stakeLamports,
      lichessGameId: lichessGameId || '',
      requiresModerator: requiresModerator || false,
    }

    if (!validateWagerArgs(wagerArgs)) {
      throw new GameGambitError(
        ERROR_CODES.INSUFFICIENT_FUNDS.code,
        ERROR_CODES.INSUFFICIENT_FUNDS.statusCode,
        'Stake amount is outside acceptable range'
      )
    }

    // Check player exists and is not banned
    const supabase = createClient()
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('wallet_address, is_banned, username')
      .eq('wallet_address', playerWallet)
      .single()

    if (playerError || !player) {
      throw new GameGambitError(
        ERROR_CODES.INVALID_PLAYER.code,
        ERROR_CODES.INVALID_PLAYER.statusCode,
        'Player not found'
      )
    }

    if (player.is_banned) {
      throw new GameGambitError(
        ERROR_CODES.PLAYER_BANNED.code,
        ERROR_CODES.PLAYER_BANNED.statusCode,
        'Player is banned'
      )
    }

    // Derive wager PDA (this would happen on-chain, shown here for reference)
    // const [wagerPDA] = deriveWagerAccountPDA(new PublicKey(playerWallet), matchId)

    // Create database record (will be updated after on-chain confirmation)
    const { data: newWager, error: wagerError } = await supabase
      .from('wagers')
      .insert({
        player_a_wallet: playerWallet,
        match_id: matchId.toString(),
        stake_amount: stakeAmount,
        status: 'created',
        lichess_game_id: lichessGameId,
        requires_moderator: requiresModerator,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (wagerError) {
      throw new GameGambitError(
        ERROR_CODES.DATABASE_ERROR.code,
        ERROR_CODES.DATABASE_ERROR.statusCode,
        'Failed to create wager'
      )
    }

    // Return response with wager data and Solana instruction data for client to sign
    return NextResponse.json(
      {
        success: true,
        data: {
          wagerId: newWager.id,
          playerWallet,
          stakeAmount,
          stakeLamports,
          matchId,
          lichessGameId,
          requiresModerator,
          // Client will use this to build and sign the transaction
          instructionData: {
            programId: 'E2Vd3U91kMrgwp8JCXcLSn7bt3NowDmGwoBYsVRhGfMR',
            matchId,
            stakeLamports,
            lichessGameId,
            requiresModerator,
          },
        },
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof GameGambitError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      )
    }

    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * GET /api/wagers/[wagerId]
 * Fetch wager details with proper type safety
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { wagerId: string } }
) {
  try {
    const supabase = createClient()

    const { data: wager, error } = await supabase
      .from('wagers')
      .select(`
        *,
        players!player_a_wallet(username, avatar),
        player_b:players!player_b_wallet(username, avatar)
      `)
      .eq('id', params.wagerId)
      .single()

    if (error || !wager) {
      throw new GameGambitError(
        ERROR_CODES.WAGER_NOT_FOUND.code,
        ERROR_CODES.WAGER_NOT_FOUND.statusCode,
        'Wager not found'
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        wager,
        displayData: {
          stakeInSol: lamportsToSol(wager.stake_amount),
          status: wager.status,
          playerA: wager.players?.username || wager.player_a_wallet,
          playerB: wager.player_b?.username || wager.player_b_wallet,
        },
      },
    })
  } catch (error) {
    if (error instanceof GameGambitError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      )
    }

    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
