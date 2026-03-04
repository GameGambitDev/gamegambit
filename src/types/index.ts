/**
 * Centralized type definitions for Game Gambit
 * Consolidates Solana IDL types, Wager types, and application domain types
 */

import { Database } from '@/integrations/supabase/types'
import type { Gamegambit } from '@/lib/idl/gamegambit'

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
 * SOLANA PROGRAM IDL EXPORTS
 * Re-exported for type-safe program interactions
 */
export type GameGambitIDL = Gamegambit
export const PROGRAM_ADDRESS = 'E2Vd3U91kMrgwp8JCXcLSn7bt3NowDmGwoBYsVRhGfMR'

/**
 * INSTRUCTION DISCRIMINATORS (from IDL)
 */
export const INSTRUCTION_DISCRIMINATORS = {
  initialize_player: [79, 249, 88, 177, 220, 62, 56, 128],
  create_wager: [210, 82, 178, 75, 253, 34, 84, 120],
  join_wager: [119, 81, 120, 160, 80, 8, 75, 239],
  resolve_wager: [31, 179, 1, 228, 83, 224, 1, 123],
  close_wager: [167, 240, 85, 147, 127, 50, 69, 203],
  submit_vote: [115, 242, 100, 0, 49, 178, 242, 133],
  retract_vote: [227, 0, 85, 234, 243, 42, 133, 162],
  ban_player: [20, 123, 183, 191, 29, 55, 244, 21],
} as const

/**
 * EVENT DISCRIMINATORS (from IDL)
 */
export const EVENT_DISCRIMINATORS = {
  wager_created: [177, 41, 34, 111, 170, 96, 157, 62],
  wager_joined: [74, 213, 37, 114, 201, 144, 6, 12],
  wager_resolved: [166, 83, 14, 127, 130, 175, 204, 13],
  wager_closed: [157, 212, 28, 112, 6, 143, 187, 185],
  vote_submitted: [21, 54, 43, 190, 87, 214, 250, 218],
  vote_retracted: [48, 194, 255, 216, 156, 13, 121, 241],
  player_banned: [164, 0, 117, 147, 4, 138, 149, 196],
} as const

/**
 * ACCOUNT DISCRIMINATORS (from IDL)
 */
export const ACCOUNT_DISCRIMINATORS = {
  player_profile: [82, 226, 99, 87, 164, 130, 181, 80],
  wager_account: [43, 206, 233, 140, 104, 50, 20, 243],
} as const

/**
 * WAGER STATUS ENUM (from IDL)
 */
export enum SolanaWagerStatus {
  Created = 0,
  Joined = 1,
  Voting = 2,
  Retractable = 3,
  Disputed = 4,
  Closed = 5,
  Resolved = 6,
}

export const WAGER_STATUS_NAMES: Record<SolanaWagerStatus, string> = {
  [SolanaWagerStatus.Created]: 'Created',
  [SolanaWagerStatus.Joined]: 'Joined',
  [SolanaWagerStatus.Voting]: 'Voting',
  [SolanaWagerStatus.Retractable]: 'Retractable',
  [SolanaWagerStatus.Disputed]: 'Disputed',
  [SolanaWagerStatus.Closed]: 'Closed',
  [SolanaWagerStatus.Resolved]: 'Resolved',
}

/**
 * SOLANA PROGRAM ERRORS (from IDL)
 */
export enum SolanaErrorCode {
  InvalidStatus = 6000,
  Unauthorized = 6001,
  RetractPeriodNotExpired = 6002,
  RetractExpired = 6003,
  InvalidAmount = 6004,
  InvalidMatchId = 6005,
  LichessGameIdTooLong = 6006,
  InvalidVote = 6007,
  AlreadyVoted = 6008,
  InvalidWinner = 6009,
  InvalidPlayer = 6010,
  PlayerBanned = 6011,
  WagerExpired = 6012,
  InvalidPlatformWallet = 6013,
  ArithmeticOverflow = 6014,
  InsufficientFunds = 6015,
}

/**
 * SOLANA PROGRAM ACCOUNT TYPES
 */
export interface PlayerProfile {
  player: string // pubkey
  isBanned: boolean
  banExpiresAt: number // i64 (Unix timestamp or 0)
  lastActive: number // i64 (Unix timestamp)
  bump: number
}

export interface WagerAccount {
  bump: number
  playerA: string // pubkey
  playerB: string // pubkey (or system program if not joined)
  matchId: number // u64
  stakeLamports: number // u64
  lichessGameId: string
  status: SolanaWagerStatus
  requiresModerator: boolean
  votePlayerA: string | null // Option<pubkey>
  votePlayerB: string | null // Option<pubkey>
  winner: string | null // Option<pubkey>
  voteTimestamp: number // i64
  retractDeadline: number // i64
  createdAt: number // i64
  expiresAt: number // i64
  resolvedAt: number // i64
}

/**
 * SOLANA EVENT TYPES (from IDL)
 */
export interface WagerCreatedEvent {
  wagerId: string
  playerA: string
  matchId: number
  stakeLamports: number
}

export interface WagerJoinedEvent {
  wagerId: string
  playerB: string
  stakeLamports: number
}

export interface WagerResolvedEvent {
  wagerId: string
  winner: string
  playerA: string
  playerB: string
  totalPayout: number
  platformFee: number
}

export interface WagerClosedEvent {
  wagerId: string
  closedBy: string
}

export interface VoteSubmittedEvent {
  wagerId: string
  player: string
  votedWinner: string
}

export interface VoteRetractedEvent {
  wagerId: string
  player: string
}

export interface PlayerBannedEvent {
  player: string
  isBanned: boolean
  banExpiresAt: number
}

/**
 * SOLANA INSTRUCTION TYPES (from IDL)
 */
export interface InitializePlayerInstruction {
  // No args
}

export interface CreateWagerInstructionArgs {
  matchId: number
  stakeLamports: number
  lichessGameId: string
  requiresModerator: boolean
}

export interface JoinWagerInstructionArgs {
  stakeLamports: number
}

export interface SubmitVoteInstructionArgs {
  votedWinner: string
}

export interface ResolveWagerInstructionArgs {
  winner: string
}

export interface BanPlayerInstructionArgs {
  banDuration: number // i64
}

/**
 * DERIVED / CALCULATED TYPES
 */

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
  INVALID_PLAYER: { code: 'INVALID_PLAYER', statusCode: 404 },
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

/**
 * UTILITY FUNCTIONS
 */

/**
 * Convert lamports (smallest SOL unit) to SOL
 * @param lamports - Amount in lamports
 * @returns Amount in SOL
 */
export function lamportsToSol(lamports: number): number {
  return lamports / 1_000_000_000
}

/**
 * Convert SOL to lamports
 * @param sol - Amount in SOL
 * @returns Amount in lamports
 */
export function solToLamports(sol: number): number {
  return Math.round(sol * 1_000_000_000)
}
