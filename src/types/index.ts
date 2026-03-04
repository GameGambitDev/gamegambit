/**
 * Centralized type definitions for Game Gambit
 * Consolidates Solana IDL types, Wager types, and application domain types
 */

import { Database } from '@/integrations/supabase/types'

/**
 * SUPABASE TABLE TYPES (auto-generated, re-exported for convenience)
 */
export type Player = Database['public']['Tables']['players']['Row']
export type PlayerInsert = Database['public']['Tables']['players']['Insert']
export type PlayerUpdate = Database['public']['Tables']['players']['Update']

export type Wager = Database['public']['Tables']['wagers']['Row']
export type WagerInsert = Database['public']['Tables']['wagers']['Insert']
export type WagerUpdate = Database['public']['Tables']['wagers']['Update']

export type WagerTransaction = Database['public']['Tables']['wager_transactions']['Row']
export type WagerTransactionInsert = Database['public']['Tables']['wager_transactions']['Insert']

export type NFT = Database['public']['Tables']['nfts']['Row']
export type NFTInsert = Database['public']['Tables']['nfts']['Insert']

export type Achievement = Database['public']['Tables']['achievements']['Row']
export type AchievementInsert = Database['public']['Tables']['achievements']['Insert']

/**
 * ENUMS FROM DATABASE
 */
export type GameType = Database['public']['Enums']['game_type']
export type WagerStatus = Database['public']['Enums']['wager_status']

export const GAME_TYPES = ['chess', 'codm', 'pubg'] as const
export const WAGER_STATUSES = ['created', 'joined', 'voting', 'retractable', 'disputed', 'resolved'] as const

/**
 * SOLANA PROGRAM IDL TYPES
 */
export interface SolanaPlayerAccount {
  wallet: string
  totalWins: number
  totalLosses: number
  totalEarnings: number // in lamports
  totalWagered: number // in lamports
  isBanned: boolean
  banExpiresAt: number | null // Unix timestamp
  createdAt: number // Unix timestamp
  bumps: {
    playerBump: number
  }
}

export interface SolanaWagerAccount {
  id: string
  playerA: string
  playerB: string | null
  game: number // Enum index
  stakeAmount: number // in lamports
  status: number // Enum index (0=Created, 1=Joined, 2=Voting, etc.)
  createdAt: number // Unix timestamp
  countdownStartedAt: number | null
  winner: string | null
  platformFeeCollected: boolean
  bumps: {
    wagerBump: number
  }
}

/**
 * IDL INSTRUCTION TYPES
 */
export interface CreateWagerInstruction {
  wagerId: string
  gameType: number
  stakeAmount: number
}

export interface JoinWagerInstruction {
  wagerId: string
}

export interface SubmitVoteInstruction {
  wagerId: string
  voteForPlayerA: boolean
}

export interface ResolveWagerInstruction {
  wagerId: string
  winner: string
}

/**
 * DOMAIN TYPES - Application-specific models
 */
export interface PlayerStats {
  wallet: string
  username: string | null
  totalWins: number
  totalLosses: number
  totalEarnings: number
  totalWagered: number
  winRate: number // 0-100
  bestStreak: number
  currentStreak: number
  isBanned: boolean
  ranking?: number
  createdAt: string
  lastActive: string | null
}

export interface WagerWithPlayers extends Wager {
  playerAData?: Player
  playerBData?: Player | null
}

export interface LiveWagerFeed {
  id: string
  game: GameType
  stakeAmount: number
  playerAUsername: string
  playerBUsername?: string
  playerAWins: number
  playerBWins?: number
  timeCreated: string
  isPublic: boolean
}

export interface WagerHistoryItem {
  wagerId: string
  opponent: string
  game: GameType
  stake: number
  result: 'won' | 'lost' | 'pending' | 'disputed'
  timestamp: string
}

/**
 * API RESPONSE TYPES
 */
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  meta?: {
    timestamp: string
    version: string
  }
}

export interface PaginatedResponse<T> {
  success: boolean
  data: T[]
  pagination: {
    total: number
    count: number
    limit: number
    offset: number
    hasMore: boolean
  }
}

export interface RateLimitInfo {
  limit: number
  remaining: number
  resetAt: string
}

/**
 * TRANSACTION TYPES
 */
export type TransactionType = 'wager_stake' | 'wager_payout' | 'platform_fee' | 'nft_mint' | 'withdrawal'
export type TransactionStatus = 'pending' | 'confirmed' | 'failed' | 'cancelled'

export interface OnChainTransaction {
  signature: string
  type: TransactionType
  wagerId?: string
  amount: number // in lamports
  timestamp: number // Unix timestamp
  status: TransactionStatus
  error?: string
}

/**
 * ACHIEVEMENT TYPES
 */
export type AchievementType =
  | 'first_wager'
  | 'ten_wins'
  | 'fifty_wins'
  | 'hundred_wins'
  | 'first_checkmate'
  | 'win_streak_5'
  | 'win_streak_10'
  | 'earnings_100_sol'
  | 'earnings_1000_sol'
  | 'nft_earned'

export interface AchievementDefinition {
  id: AchievementType
  name: string
  description: string
  icon: string
  tier: 'bronze' | 'silver' | 'gold' | 'platinum'
  requirement: number
  reward?: number // SOL or XP
}

/**
 * LEADERBOARD TYPES
 */
export interface LeaderboardEntry {
  rank: number
  wallet: string
  username: string
  totalWins: number
  totalEarnings: number
  winRate: number
  currentStreak: number
  verified?: boolean
}

/**
 * NFT TYPES
 */
export interface NFTMetadata {
  name: string
  description: string
  image: string
  attributes: {
    rarity: 'common' | 'rare' | 'epic' | 'legendary'
    game: GameType
    wagerId: string
    earnings: number
    winStreak: number
  }
}

/**
 * PROFILE TYPES
 */
export interface UserProfile {
  wallet: string
  username: string | null
  avatar?: string
  bio?: string
  lichessUsername?: string
  pubgUsername?: string
  codmUsername?: string
  stats: PlayerStats
  achievements: Achievement[]
  recentWagers: WagerHistoryItem[]
  nfts: NFT[]
  createdAt: string
  updatedAt: string
}

/**
 * GAME INTEGRATION TYPES
 */
export interface GameMatchResult {
  gameId: string
  game: GameType
  winner: string // wallet address
  loser: string
  proof: {
    signature?: string // for Lichess, PUBG API response, etc.
    metadata?: Record<string, any>
  }
  timestamp: number
}

/**
 * ERROR TYPES
 */
export class GameGambitError extends Error {
  constructor(
    public code: string,
    public statusCode: number,
    message: string
  ) {
    super(message)
    this.name = 'GameGambitError'
  }
}

export const ERROR_CODES = {
  INVALID_WALLET: { code: 'INVALID_WALLET', statusCode: 400 },
  INSUFFICIENT_FUNDS: { code: 'INSUFFICIENT_FUNDS', statusCode: 400 },
  WAGER_NOT_FOUND: { code: 'WAGER_NOT_FOUND', statusCode: 404 },
  WAGER_ALREADY_JOINED: { code: 'WAGER_ALREADY_JOINED', statusCode: 409 },
  UNAUTHORIZED: { code: 'UNAUTHORIZED', statusCode: 401 },
  PLAYER_BANNED: { code: 'PLAYER_BANNED', statusCode: 403 },
  DATABASE_ERROR: { code: 'DATABASE_ERROR', statusCode: 500 },
  SOLANA_ERROR: { code: 'SOLANA_ERROR', statusCode: 500 },
} as const

/**
 * TYPE GUARDS
 */
export function isPlayer(data: any): data is Player {
  return data && typeof data.wallet_address === 'string'
}

export function isWager(data: any): data is Wager {
  return data && typeof data.id === 'string' && typeof data.status === 'string'
}

export function isValidGameType(game: any): game is GameType {
  return GAME_TYPES.includes(game)
}

export function isValidWagerStatus(status: any): status is WagerStatus {
  return WAGER_STATUSES.includes(status)
}

/**
 * HELPER TYPES
 */
export type Nullable<T> = T | null
export type Optional<T> = T | undefined
export type Async<T> = Promise<T>

export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E }
