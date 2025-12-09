import { z } from 'zod';

// Username validation schema - allows alphanumeric, underscore, hyphen
export const usernameSchema = z.string()
  .trim()
  .min(1, 'Username is required')
  .max(50, 'Username must be less than 50 characters')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens');

// Wallet address validation - Solana base58 format
export const walletAddressSchema = z.string()
  .trim()
  .min(32, 'Invalid wallet address')
  .max(44, 'Invalid wallet address')
  .regex(/^[1-9A-HJ-NP-Za-km-z]+$/, 'Invalid wallet address format');

// Wager creation validation
export const createWagerSchema = z.object({
  game: z.enum(['chess', 'codm', 'pubg']),
  stake_lamports: z.number().positive('Stake must be positive').int('Stake must be a whole number'),
  lichess_game_id: z.string().optional(),
  is_public: z.boolean().optional(),
  stream_url: z.string().url('Invalid URL').optional().or(z.literal('')),
});

// Vote submission validation
export const submitVoteSchema = z.object({
  wagerId: z.string().uuid('Invalid wager ID'),
  votedWinner: z.string().min(32, 'Invalid wallet address'),
});

// Validate and return result with error message
export function validateWithError<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error.errors[0]?.message || 'Validation failed' };
}
