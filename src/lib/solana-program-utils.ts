/**
 * Solana Program Utilities
 * Helper functions for interacting with the Game Gambit Solana program
 */

import { PublicKey, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js'
import * as anchor from '@coral-xyz/anchor'
import type { Gamegambit } from '@/lib/idl/gamegambit'
import IDL from '@/lib/idl/gamegambit.json'

const PROGRAM_ADDRESS = 'E2Vd3U91kMrgwp8JCXcLSn7bt3NowDmGwoBYsVRhGfMR'

const INSTRUCTION_DISCRIMINATORS = {
  initialize_player: [79, 249, 88, 177, 220, 62, 56, 128],
  create_wager: [210, 82, 178, 75, 253, 34, 84, 120],
  join_wager: [119, 81, 120, 160, 80, 8, 75, 239],
  resolve_wager: [31, 179, 1, 228, 83, 224, 1, 123],
  close_wager: [167, 240, 85, 147, 127, 50, 69, 203],
  submit_vote: [115, 242, 100, 0, 49, 178, 242, 133],
  retract_vote: [227, 0, 85, 234, 243, 42, 133, 162],
  ban_player: [20, 123, 183, 191, 29, 55, 244, 21],
} as const

// Instruction argument types
interface CreateWagerInstructionArgs {
  matchId: number
  stakeLamports: number
  lichessGameId: string
  requiresModerator: boolean
}

interface JoinWagerInstructionArgs {
  stakeLamports: number
}

interface SubmitVoteInstructionArgs {
  votedWinner: string
}

interface ResolveWagerInstructionArgs {
  winner: string
}

interface BanPlayerInstructionArgs {
  banDuration: number
}

/**
 * Get the Program instance for interacting with Game Gambit
 */
export function getGameGambitProgram(
  provider: anchor.AnchorProvider
): anchor.Program<Gamegambit> {
  return new anchor.Program(
    IDL as unknown as Gamegambit,
    new PublicKey(PROGRAM_ADDRESS),
    provider
  )
}

/**
 * Derive Player Profile PDA
 */
export function derivePlayerProfilePDA(playerPublicKey: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('player'), playerPublicKey.toBuffer()],
    new PublicKey(PROGRAM_ADDRESS)
  )
}

/**
 * Derive Wager Account PDA
 */
export function deriveWagerAccountPDA(playerA: PublicKey, matchId: number): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from('wager'),
      playerA.toBuffer(),
      new anchor.BN(matchId).toBuffer('le', 8),
    ],
    new PublicKey(PROGRAM_ADDRESS)
  )
}

/**
 * Build CreateWager Instruction
 */
export async function buildCreateWagerInstruction(
  program: anchor.Program<Gamegambit>,
  playerA: PublicKey,
  args: CreateWagerInstructionArgs
): Promise<TransactionInstruction> {
  const [playerAProfile] = derivePlayerProfilePDA(playerA)
  const [wager] = deriveWagerAccountPDA(playerA, args.matchId)

  return await program.methods
    .createWager(new anchor.BN(args.matchId), new anchor.BN(args.stakeLamports), args.lichessGameId, args.requiresModerator)
    .accounts({
      wager,
      playerAProfile,
      playerA,
      systemProgram: SystemProgram.programId,
    })
    .instruction()
}

/**
 * Build JoinWager Instruction
 */
export async function buildJoinWagerInstruction(
  program: anchor.Program<Gamegambit>,
  playerA: PublicKey,
  playerB: PublicKey,
  matchId: number,
  stakeLamports: number
): Promise<TransactionInstruction> {
  const [playerBProfile] = derivePlayerProfilePDA(playerB)
  const [wager] = deriveWagerAccountPDA(playerA, matchId)

  return await program.methods
    .joinWager(new anchor.BN(stakeLamports))
    .accounts({
      wager,
      playerBProfile,
      playerB,
      systemProgram: SystemProgram.programId,
    })
    .instruction()
}

/**
 * Build ResolveWager Instruction
 */
export async function buildResolveWagerInstruction(
  program: anchor.Program<Gamegambit>,
  playerA: PublicKey,
  playerB: PublicKey,
  matchId: number,
  winner: PublicKey,
  authorizer: PublicKey,
  platformWallet: PublicKey
): Promise<TransactionInstruction> {
  const [wager] = deriveWagerAccountPDA(playerA, matchId)

  return await program.methods
    .resolveWager(winner)
    .accounts({
      wager,
      winner,
      authorizer,
      platformWallet,
      systemProgram: SystemProgram.programId,
    })
    .instruction()
}

/**
 * Build SubmitVote Instruction
 */
export async function buildSubmitVoteInstruction(
  program: anchor.Program<Gamegambit>,
  voter: PublicKey,
  playerA: PublicKey,
  matchId: number,
  votedWinner: PublicKey
): Promise<TransactionInstruction> {
  const [wager] = deriveWagerAccountPDA(playerA, matchId)

  return await program.methods
    .submitVote(votedWinner)
    .accounts({
      wager,
      player: voter,
      systemProgram: SystemProgram.programId,
    })
    .instruction()
}

/**
 * Build BanPlayer Instruction
 */
export async function buildBanPlayerInstruction(
  program: anchor.Program<Gamegambit>,
  playerToBan: PublicKey,
  authorizer: PublicKey,
  banDuration: number
): Promise<TransactionInstruction> {
  const [playerProfile] = derivePlayerProfilePDA(playerToBan)

  return await program.methods
    .banPlayer(new anchor.BN(banDuration))
    .accounts({
      playerProfile,
      authorizer,
      systemProgram: SystemProgram.programId,
    })
    .instruction()
}

/**
 * Build CloseWager Instruction
 */
export async function buildCloseWagerInstruction(
  program: anchor.Program<Gamegambit>,
  playerA: PublicKey,
  playerB: PublicKey,
  matchId: number,
  authorizer: PublicKey
): Promise<TransactionInstruction> {
  const [wager] = deriveWagerAccountPDA(playerA, matchId)

  return await program.methods
    .closeWager()
    .accounts({
      wager,
      playerA,
      playerB,
      authorizer,
      systemProgram: SystemProgram.programId,
    })
    .instruction()
}

/**
 * Build RetractVote Instruction
 */
export async function buildRetractVoteInstruction(
  program: anchor.Program<Gamegambit>,
  voter: PublicKey,
  playerA: PublicKey,
  matchId: number
): Promise<TransactionInstruction> {
  const [wager] = deriveWagerAccountPDA(playerA, matchId)

  return await program.methods
    .retractVote()
    .accounts({
      wager,
      player: voter,
      systemProgram: SystemProgram.programId,
    })
    .instruction()
}

/**
 * Parse Discriminator to Instruction Name
 */
export function parseDiscriminator(discriminator: number[]): string | null {
  for (const [name, disc] of Object.entries(INSTRUCTION_DISCRIMINATORS)) {
    if (JSON.stringify(disc) === JSON.stringify(discriminator)) {
      return name
    }
  }
  return null
}

/**
 * Constants for program interactions
 */
export const PROGRAM_CONSTANTS = {
  RETRACT_PERIOD_SECONDS: 3600, // 1 hour
  WAGER_EXPIRY_SECONDS: 604800, // 7 days
  VOTING_PERIOD_SECONDS: 86400, // 24 hours
  PLATFORM_FEE_BASIS_POINTS: 500, // 5%
  MIN_STAKE_LAMPORTS: 1_000_000, // 0.001 SOL
  MAX_STAKE_LAMPORTS: 1_000_000_000_000, // 1M SOL
} as const

/**
 * Helper to validate instruction args
 */
export function validateWagerArgs(args: CreateWagerInstructionArgs): boolean {
  if (args.matchId < 0) return false
  if (args.stakeLamports < PROGRAM_CONSTANTS.MIN_STAKE_LAMPORTS) return false
  if (args.stakeLamports > PROGRAM_CONSTANTS.MAX_STAKE_LAMPORTS) return false
  if (args.lichessGameId.length > 100) return false
  return true
}

/**
 * Convert lamports to SOL for display
 */
export function lamportsToSol(lamports: number): number {
  return lamports / 1_000_000_000
}

/**
 * Convert SOL to lamports
 */
export function solToLamports(sol: number): number {
  return Math.round(sol * 1_000_000_000)
}


/**
 * Get the Program instance for interacting with Game Gambit
 */
export function getGameGambitProgram(
  provider: anchor.AnchorProvider
): anchor.Program<GameGambitIDL> {
  return new anchor.Program(
    IDL as unknown as GameGambitIDL,
    new PublicKey(PROGRAM_ADDRESS),
    provider
  )
}

/**
 * Derive Player Profile PDA
 */
export function derivePlayerProfilePDA(playerPublicKey: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('player'), playerPublicKey.toBuffer()],
    new PublicKey(PROGRAM_ADDRESS)
  )
}

/**
 * Derive Wager Account PDA
 */
export function deriveWagerAccountPDA(playerA: PublicKey, matchId: number): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from('wager'),
      playerA.toBuffer(),
      new anchor.BN(matchId).toBuffer('le', 8),
    ],
    new PublicKey(PROGRAM_ADDRESS)
  )
}

/**
 * Build CreateWager Instruction
 */
export async function buildCreateWagerInstruction(
  program: anchor.Program<GameGambitIDL>,
  playerA: PublicKey,
  args: CreateWagerInstructionArgs
): Promise<TransactionInstruction> {
  const [playerAProfile] = derivePlayerProfilePDA(playerA)
  const [wager] = deriveWagerAccountPDA(playerA, args.matchId)

  return await program.methods
    .createWager(new anchor.BN(args.matchId), new anchor.BN(args.stakeLamports), args.lichessGameId, args.requiresModerator)
    .accounts({
      wager,
      playerAProfile,
      playerA,
      systemProgram: SystemProgram.programId,
    })
    .instruction()
}

/**
 * Build JoinWager Instruction
 */
export async function buildJoinWagerInstruction(
  program: anchor.Program<GameGambitIDL>,
  playerA: PublicKey,
  playerB: PublicKey,
  matchId: number,
  stakeLamports: number
): Promise<TransactionInstruction> {
  const [playerBProfile] = derivePlayerProfilePDA(playerB)
  const [wager] = deriveWagerAccountPDA(playerA, matchId)

  return await program.methods
    .joinWager(new anchor.BN(stakeLamports))
    .accounts({
      wager,
      playerBProfile,
      playerB,
      systemProgram: SystemProgram.programId,
    })
    .instruction()
}

/**
 * Build ResolveWager Instruction
 */
export async function buildResolveWagerInstruction(
  program: anchor.Program<GameGambitIDL>,
  playerA: PublicKey,
  playerB: PublicKey,
  matchId: number,
  winner: PublicKey,
  authorizer: PublicKey,
  platformWallet: PublicKey
): Promise<TransactionInstruction> {
  const [wager] = deriveWagerAccountPDA(playerA, matchId)

  return await program.methods
    .resolveWager(winner)
    .accounts({
      wager,
      winner,
      authorizer,
      platformWallet,
      systemProgram: SystemProgram.programId,
    })
    .instruction()
}

/**
 * Build SubmitVote Instruction
 */
export async function buildSubmitVoteInstruction(
  program: anchor.Program<GameGambitIDL>,
  voter: PublicKey,
  playerA: PublicKey,
  matchId: number,
  votedWinner: PublicKey
): Promise<TransactionInstruction> {
  const [wager] = deriveWagerAccountPDA(playerA, matchId)

  return await program.methods
    .submitVote(votedWinner)
    .accounts({
      wager,
      player: voter,
      systemProgram: SystemProgram.programId,
    })
    .instruction()
}

/**
 * Build BanPlayer Instruction
 */
export async function buildBanPlayerInstruction(
  program: anchor.Program<GameGambitIDL>,
  playerToBan: PublicKey,
  authorizer: PublicKey,
  banDuration: number
): Promise<TransactionInstruction> {
  const [playerProfile] = derivePlayerProfilePDA(playerToBan)

  return await program.methods
    .banPlayer(new anchor.BN(banDuration))
    .accounts({
      playerProfile,
      authorizer,
      systemProgram: SystemProgram.programId,
    })
    .instruction()
}

/**
 * Build CloseWager Instruction
 */
export async function buildCloseWagerInstruction(
  program: anchor.Program<GameGambitIDL>,
  playerA: PublicKey,
  playerB: PublicKey,
  matchId: number,
  authorizer: PublicKey
): Promise<TransactionInstruction> {
  const [wager] = deriveWagerAccountPDA(playerA, matchId)

  return await program.methods
    .closeWager()
    .accounts({
      wager,
      playerA,
      playerB,
      authorizer,
      systemProgram: SystemProgram.programId,
    })
    .instruction()
}

/**
 * Build RetractVote Instruction
 */
export async function buildRetractVoteInstruction(
  program: anchor.Program<GameGambitIDL>,
  voter: PublicKey,
  playerA: PublicKey,
  matchId: number
): Promise<TransactionInstruction> {
  const [wager] = deriveWagerAccountPDA(playerA, matchId)

  return await program.methods
    .retractVote()
    .accounts({
      wager,
      player: voter,
      systemProgram: SystemProgram.programId,
    })
    .instruction()
}

/**
 * Parse Discriminator to Instruction Name
 */
export function parseDiscriminator(discriminator: number[]): string | null {
  for (const [name, disc] of Object.entries(INSTRUCTION_DISCRIMINATORS)) {
    if (JSON.stringify(disc) === JSON.stringify(discriminator)) {
      return name
    }
  }
  return null
}

/**
 * Constants for program interactions
 */
export const PROGRAM_CONSTANTS = {
  RETRACT_PERIOD_SECONDS: 3600, // 1 hour
  WAGER_EXPIRY_SECONDS: 604800, // 7 days
  VOTING_PERIOD_SECONDS: 86400, // 24 hours
  PLATFORM_FEE_BASIS_POINTS: 500, // 5%
  MIN_STAKE_LAMPORTS: 1_000_000, // 0.001 SOL
  MAX_STAKE_LAMPORTS: 1_000_000_000_000, // 1M SOL
} as const

/**
 * Helper to validate instruction args
 */
export function validateWagerArgs(args: CreateWagerInstructionArgs): boolean {
  if (args.matchId < 0) return false
  if (args.stakeLamports < PROGRAM_CONSTANTS.MIN_STAKE_LAMPORTS) return false
  if (args.stakeLamports > PROGRAM_CONSTANTS.MAX_STAKE_LAMPORTS) return false
  if (args.lichessGameId.length > 100) return false
  return true
}

/**
 * Convert lamports to SOL for display
 */
export function lamportsToSol(lamports: number): number {
  return lamports / 1_000_000_000
}

/**
 * Convert SOL to lamports
 */
export function solToLamports(sol: number): number {
  return Math.round(sol * 1_000_000_000)
}
