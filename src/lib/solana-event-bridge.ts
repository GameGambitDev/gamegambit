/**
 * Event Integration Layer
 * Bridges Solana program events with Supabase database updates
 */

import { Connection, PublicKey, logs } from '@solana/web3.js'
import { createClient } from '@/integrations/supabase/client'

// Event type definitions
interface WagerCreatedEvent {
  wagerId: string
  playerA: string
  matchId: number
  stakeLamports: number
}

interface WagerJoinedEvent {
  wagerId: string
  playerB: string
  stakeLamports: number
}

interface WagerResolvedEvent {
  wagerId: string
  winner: string
  playerA: string
  playerB: string
  totalPayout: number
  platformFee: number
}

interface WagerClosedEvent {
  wagerId: string
  closedBy: string
}

interface VoteSubmittedEvent {
  wagerId: string
  player: string
  votedWinner: string
}

interface VoteRetractedEvent {
  wagerId: string
  player: string
}

interface PlayerBannedEvent {
  player: string
  isBanned: boolean
  banExpiresAt: number
}

const PROGRAM_ADDRESS = 'E2Vd3U91kMrgwp8JCXcLSn7bt3NowDmGwoBYsVRhGfMR'

const EVENT_DISCRIMINATORS = {
  wager_created: [177, 41, 34, 111, 170, 96, 157, 62],
  wager_joined: [74, 213, 37, 114, 201, 144, 6, 12],
  wager_resolved: [166, 83, 14, 127, 130, 175, 204, 13],
  wager_closed: [157, 212, 28, 112, 6, 143, 187, 185],
  vote_submitted: [21, 54, 43, 190, 87, 214, 250, 218],
  vote_retracted: [48, 194, 255, 216, 156, 13, 121, 241],
  player_banned: [164, 0, 117, 147, 4, 138, 149, 196],
} as const

export interface SolanaEventListener {
  eventName: string
  discriminator: number[]
  handler: (data: any) => Promise<void>
}

export class GameGambitEventBridge {
  private connection: Connection
  private supabase = createClient()
  private listeners: Map<string, SolanaEventListener> = new Map()

  constructor(connection: Connection) {
    this.connection = connection
    this.setupEventListeners()
  }

  /**
   * Setup all event listeners
   */
  private setupEventListeners() {
    this.registerListener({
      eventName: 'WagerCreated',
      discriminator: EVENT_DISCRIMINATORS.wager_created,
      handler: this.handleWagerCreated.bind(this),
    })

    this.registerListener({
      eventName: 'WagerJoined',
      discriminator: EVENT_DISCRIMINATORS.wager_joined,
      handler: this.handleWagerJoined.bind(this),
    })

    this.registerListener({
      eventName: 'WagerResolved',
      discriminator: EVENT_DISCRIMINATORS.wager_resolved,
      handler: this.handleWagerResolved.bind(this),
    })

    this.registerListener({
      eventName: 'WagerClosed',
      discriminator: EVENT_DISCRIMINATORS.wager_closed,
      handler: this.handleWagerClosed.bind(this),
    })

    this.registerListener({
      eventName: 'VoteSubmitted',
      discriminator: EVENT_DISCRIMINATORS.vote_submitted,
      handler: this.handleVoteSubmitted.bind(this),
    })

    this.registerListener({
      eventName: 'VoteRetracted',
      discriminator: EVENT_DISCRIMINATORS.vote_retracted,
      handler: this.handleVoteRetracted.bind(this),
    })

    this.registerListener({
      eventName: 'PlayerBanned',
      discriminator: EVENT_DISCRIMINATORS.player_banned,
      handler: this.handlePlayerBanned.bind(this),
    })
  }

  /**
   * Register an event listener
   */
  private registerListener(listener: SolanaEventListener) {
    this.listeners.set(listener.eventName, listener)
  }

  /**
   * Start listening to Solana logs for program events
   */
  public async startListening() {
    const programId = new PublicKey(PROGRAM_ADDRESS)

    this.connection.onLogs(
      programId,
      async (logs) => {
        await this.processLogs(logs)
      },
      'confirmed'
    )
  }

  /**
   * Process incoming logs and dispatch to appropriate handlers
   */
  private async processLogs(logs: logs.ConfirmedTransactionMeta | logs.LogsNotification) {
    // Implementation depends on Solana logs structure
    // This is a placeholder for actual log parsing
    for (const listener of this.listeners.values()) {
      try {
        // Parse and dispatch events
        // await listener.handler(parsedEvent);
      } catch (error) {
        console.error(`Error handling ${listener.eventName}:`, error)
      }
    }
  }

  /**
   * Handle WagerCreated event
   */
  private async handleWagerCreated(event: WagerCreatedEvent) {
    const { wagerId, playerA, matchId, stakeLamports } = event

    try {
      await this.supabase.from('wagers').insert({
        id: wagerId,
        player_a_wallet: playerA,
        match_id: matchId,
        stake_lamports: stakeLamports,
        game: 'chess',
        status: 'created',
      })

      // Update player stats
      await this.supabase.rpc('update_player_wager_count', {
        p_wallet: playerA,
        increment_amount: 1,
      })
    } catch (error) {
      console.error('Error syncing WagerCreated:', error)
      throw error
    }
  }

  /**
   * Handle WagerJoined event
   */
  private async handleWagerJoined(event: WagerJoinedEvent) {
    const { wagerId, playerB, stakeLamports } = event

    try {
      await this.supabase.from('wagers').update({ status: 'joined', player_b_wallet: playerB }).eq('id', wagerId)

      // Sync transaction
      await this.supabase.from('wager_transactions').insert({
        wager_id: wagerId,
        wallet_address: playerB,
        tx_type: 'wager_stake',
        amount_lamports: stakeLamports,
        status: 'confirmed',
      })
    } catch (error) {
      console.error('Error syncing WagerJoined:', error)
      throw error
    }
  }

  /**
   * Handle WagerResolved event
   */
  private async handleWagerResolved(event: WagerResolvedEvent) {
    const { wagerId, winner, playerA, playerB, totalPayout, platformFee } = event

    try {
      // Update wager status
      await this.supabase
        .from('wagers')
        .update({ status: 'resolved', winner_wallet: winner, resolved_at: new Date().toISOString() })
        .eq('id', wagerId)

      // Record winner's earnings
      await this.supabase.from('wager_transactions').insert({
        wager_id: wagerId,
        wallet_address: winner,
        tx_type: 'wager_payout',
        amount_lamports: totalPayout,
        status: 'confirmed',
      })

      // Record platform fee
      if (platformFee > 0) {
        await this.supabase.from('wager_transactions').insert({
          wager_id: wagerId,
          wallet_address: PROGRAM_ADDRESS,
          tx_type: 'platform_fee',
          amount_lamports: platformFee,
          status: 'confirmed',
        })
      }

      // Update winner stats (win count, earnings, streak)
      await this.supabase.rpc('increment_player_wins', {
        p_wallet: winner,
        earnings: totalPayout,
      })

      // Reset loser streak
      const loser = winner === playerA ? playerB : playerA
      await this.supabase.rpc('reset_player_streak', {
        p_wallet: loser,
      })
    } catch (error) {
      console.error('Error syncing WagerResolved:', error)
      throw error
    }
  }

  /**
   * Handle WagerClosed event
   */
  private async handleWagerClosed(event: WagerClosedEvent) {
    const { wagerId } = event

    try {
      await this.supabase
        .from('wagers')
        .update({ status: 'resolved', resolved_at: new Date().toISOString() })
        .eq('id', wagerId)
    } catch (error) {
      console.error('Error syncing WagerClosed:', error)
      throw error
    }
  }

  /**
   * Handle VoteSubmitted event
   */
  private async handleVoteSubmitted(event: VoteSubmittedEvent) {
    const { wagerId, player, votedWinner } = event

    try {
      // Update wager with vote
      await this.supabase
        .from('wagers')
        .update({ vote_player_a: player === 'A' ? votedWinner : null, vote_player_b: player === 'B' ? votedWinner : null, vote_timestamp: new Date().toISOString() })
        .eq('id', wagerId)
    } catch (error) {
      console.error('Error syncing VoteSubmitted:', error)
      throw error
    }
  }

  /**
   * Handle VoteRetracted event
   */
  private async handleVoteRetracted(event: VoteRetractedEvent) {
    const { wagerId, player } = event

    try {
      await this.supabase
        .from('wagers')
        .update({ vote_player_a: player === 'A' ? null : undefined, vote_player_b: player === 'B' ? null : undefined })
        .eq('id', wagerId)
    } catch (error) {
      console.error('Error syncing VoteRetracted:', error)
      throw error
    }
  }

  /**
   * Handle PlayerBanned event
   */
  private async handlePlayerBanned(event: PlayerBannedEvent) {
    const { player, isBanned, banExpiresAt } = event

    try {
      await this.supabase
        .from('players')
        .update({
          is_banned: isBanned,
          ban_expires_at: isBanned ? new Date(banExpiresAt * 1000).toISOString() : null,
        })
        .eq('wallet_address', player)
    } catch (error) {
      console.error('Error syncing PlayerBanned:', error)
      throw error
    }
  }

  /**
   * Manual sync of wager state from Solana to DB
   */
  public async syncWagerState(wagerId: string) {
    try {
      // Fetch wager account from Solana
      // Parse and sync to database
      // This would involve fetching the account data and updating Supabase
    } catch (error) {
      console.error('Error syncing wager state:', error)
      throw error
    }
  }

  /**
   * Manual sync of player state from Solana to DB
   */
  public async syncPlayerState(playerWallet: string) {
    try {
      // Fetch player profile from Solana
      // Parse and sync to database
    } catch (error) {
      console.error('Error syncing player state:', error)
      throw error
    }
  }
}


export interface SolanaEventListener {
  eventName: string
  discriminator: number[]
  handler: (data: any) => Promise<void>
}

export class GameGambitEventBridge {
  private connection: Connection
  private supabase = createClient()
  private listeners: Map<string, SolanaEventListener> = new Map()

  constructor(connection: Connection) {
    this.connection = connection
    this.setupEventListeners()
  }

  /**
   * Setup all event listeners
   */
  private setupEventListeners() {
    this.registerListener({
      eventName: 'WagerCreated',
      discriminator: EVENT_DISCRIMINATORS.wager_created,
      handler: this.handleWagerCreated.bind(this),
    })

    this.registerListener({
      eventName: 'WagerJoined',
      discriminator: EVENT_DISCRIMINATORS.wager_joined,
      handler: this.handleWagerJoined.bind(this),
    })

    this.registerListener({
      eventName: 'WagerResolved',
      discriminator: EVENT_DISCRIMINATORS.wager_resolved,
      handler: this.handleWagerResolved.bind(this),
    })

    this.registerListener({
      eventName: 'WagerClosed',
      discriminator: EVENT_DISCRIMINATORS.wager_closed,
      handler: this.handleWagerClosed.bind(this),
    })

    this.registerListener({
      eventName: 'VoteSubmitted',
      discriminator: EVENT_DISCRIMINATORS.vote_submitted,
      handler: this.handleVoteSubmitted.bind(this),
    })

    this.registerListener({
      eventName: 'VoteRetracted',
      discriminator: EVENT_DISCRIMINATORS.vote_retracted,
      handler: this.handleVoteRetracted.bind(this),
    })

    this.registerListener({
      eventName: 'PlayerBanned',
      discriminator: EVENT_DISCRIMINATORS.player_banned,
      handler: this.handlePlayerBanned.bind(this),
    })
  }

  /**
   * Register an event listener
   */
  private registerListener(listener: SolanaEventListener) {
    this.listeners.set(listener.eventName, listener)
  }

  /**
   * Start listening to Solana logs for program events
   */
  public async startListening() {
    const programId = new PublicKey(PROGRAM_ADDRESS)

    this.connection.onLogs(
      programId,
      async (logs) => {
        await this.processLogs(logs)
      },
      'confirmed'
    )
  }

  /**
   * Process incoming logs and dispatch to appropriate handlers
   */
  private async processLogs(logs: logs.ConfirmedTransactionMeta | logs.LogsNotification) {
    // Implementation depends on Solana logs structure
    // This is a placeholder for actual log parsing
    for (const listener of this.listeners.values()) {
      try {
        // Parse and dispatch events
        // await listener.handler(parsedEvent);
      } catch (error) {
        console.error(`Error handling ${listener.eventName}:`, error)
      }
    }
  }

  /**
   * Handle WagerCreated event
   */
  private async handleWagerCreated(event: WagerCreatedEvent) {
    const { wagerId, playerA, matchId, stakeLamports } = event

    try {
      await this.supabase.from('wagers').insert({
        solana_wager_id: wagerId,
        player_a_wallet: playerA,
        match_id: matchId.toString(),
        stake_amount: stakeLamports,
        status: 'created',
        created_at: new Date().toISOString(),
      })

      // Update player stats
      await this.supabase.rpc('update_player_wager_count', {
        p_wallet: playerA,
        increment_amount: 1,
      })
    } catch (error) {
      console.error('Error syncing WagerCreated:', error)
      throw error
    }
  }

  /**
   * Handle WagerJoined event
   */
  private async handleWagerJoined(event: WagerJoinedEvent) {
    const { wagerId, playerB, stakeLamports } = event

    try {
      await this.supabase.from('wagers').update({ status: 'joined', player_b_wallet: playerB }).eq('solana_wager_id', wagerId)

      // Sync transaction
      await this.supabase.from('wager_transactions').insert({
        wager_id: wagerId,
        player_wallet: playerB,
        transaction_type: 'wager_stake',
        amount: stakeLamports,
        status: 'confirmed',
      })
    } catch (error) {
      console.error('Error syncing WagerJoined:', error)
      throw error
    }
  }

  /**
   * Handle WagerResolved event
   */
  private async handleWagerResolved(event: WagerResolvedEvent) {
    const { wagerId, winner, playerA, playerB, totalPayout, platformFee } = event

    try {
      // Update wager status
      await this.supabase.from('wagers').update({ status: 'resolved', winner_wallet: winner, resolved_at: new Date().toISOString() }).eq('solana_wager_id', wagerId)

      // Record winner's earnings
      await this.supabase.from('wager_transactions').insert({
        wager_id: wagerId,
        player_wallet: winner,
        transaction_type: 'wager_payout',
        amount: totalPayout,
        status: 'confirmed',
      })

      // Record platform fee
      if (platformFee > 0) {
        await this.supabase.from('wager_transactions').insert({
          wager_id: wagerId,
          player_wallet: PROGRAM_ADDRESS,
          transaction_type: 'platform_fee',
          amount: platformFee,
          status: 'confirmed',
        })
      }

      // Update winner stats (win count, earnings, streak)
      await this.supabase.rpc('increment_player_wins', {
        p_wallet: winner,
        earnings: totalPayout,
      })

      // Reset loser streak
      const loser = winner === playerA ? playerB : playerA
      await this.supabase.rpc('reset_player_streak', {
        p_wallet: loser,
      })
    } catch (error) {
      console.error('Error syncing WagerResolved:', error)
      throw error
    }
  }

  /**
   * Handle WagerClosed event
   */
  private async handleWagerClosed(event: WagerClosedEvent) {
    const { wagerId } = event

    try {
      await this.supabase.from('wagers').update({ status: 'closed', resolved_at: new Date().toISOString() }).eq('solana_wager_id', wagerId)
    } catch (error) {
      console.error('Error syncing WagerClosed:', error)
      throw error
    }
  }

  /**
   * Handle VoteSubmitted event
   */
  private async handleVoteSubmitted(event: VoteSubmittedEvent) {
    const { wagerId, player, votedWinner } = event

    try {
      // Record vote in database
      await this.supabase.from('wager_votes').insert({
        wager_id: wagerId,
        voter_wallet: player,
        voted_winner: votedWinner,
        created_at: new Date().toISOString(),
      })
    } catch (error) {
      console.error('Error syncing VoteSubmitted:', error)
      throw error
    }
  }

  /**
   * Handle VoteRetracted event
   */
  private async handleVoteRetracted(event: VoteRetractedEvent) {
    const { wagerId, player } = event

    try {
      await this.supabase.from('wager_votes').delete().eq('wager_id', wagerId).eq('voter_wallet', player)
    } catch (error) {
      console.error('Error syncing VoteRetracted:', error)
      throw error
    }
  }

  /**
   * Handle PlayerBanned event
   */
  private async handlePlayerBanned(event: PlayerBannedEvent) {
    const { player, isBanned, banExpiresAt } = event

    try {
      await this.supabase
        .from('players')
        .update({
          is_banned: isBanned,
          banned_until: isBanned ? new Date(banExpiresAt * 1000).toISOString() : null,
        })
        .eq('wallet_address', player)
    } catch (error) {
      console.error('Error syncing PlayerBanned:', error)
      throw error
    }
  }

  /**
   * Manual sync of wager state from Solana to DB
   */
  public async syncWagerState(wagerId: string) {
    try {
      // Fetch wager account from Solana
      // Parse and sync to database
      // This would involve fetching the account data and updating Supabase
    } catch (error) {
      console.error('Error syncing wager state:', error)
      throw error
    }
  }

  /**
   * Manual sync of player state from Solana to DB
   */
  public async syncPlayerState(playerWallet: string) {
    try {
      // Fetch player profile from Solana
      // Parse and sync to database
    } catch (error) {
      console.error('Error syncing player state:', error)
      throw error
    }
  }
}
