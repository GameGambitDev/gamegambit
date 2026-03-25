import { z } from 'zod';

// ── Platform username ─────────────────────────────────────────────────────────

export const usernameSchema = z.string()
  .trim()
  .min(1, 'Username is required')
  .max(50, 'Username must be less than 50 characters')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens');

// ── Solana wallet address ─────────────────────────────────────────────────────

export const walletAddressSchema = z.string()
  .trim()
  .min(32, 'Invalid wallet address')
  .max(44, 'Invalid wallet address')
  .regex(/^[1-9A-HJ-NP-Za-km-z]+$/, 'Invalid wallet address format');

// ── Game types ────────────────────────────────────────────────────────────────

export const gameTypeSchema = z.enum(['chess', 'codm', 'pubg', 'free_fire']);
export type GameType = z.infer<typeof gameTypeSchema>;

// ── In-game username/ID ───────────────────────────────────────────────────────
// Slightly more permissive than platform usernames — games allow dots, spaces, etc.

export const gameUsernameSchema = z.string()
  .trim()
  .min(1, 'Username is required')
  .max(64, 'Username must be 64 characters or less');

// PUBG specifically tends to have stricter names — keeping the broad schema
// so we don't reject valid usernames the API would accept

// ── Wager creation ────────────────────────────────────────────────────────────

export const createWagerSchema = z.object({
  game: gameTypeSchema,
  stake_lamports: z.number().positive('Stake must be positive').int('Stake must be a whole number'),
  lichess_game_id: z.string().optional(),
  is_public: z.boolean().optional(),
  stream_url: z.string().url('Invalid URL').optional().or(z.literal('')),
});

// ── Vote submission ───────────────────────────────────────────────────────────

export const submitVoteSchema = z.object({
  wagerId: z.string().uuid('Invalid wager ID'),
  votedWinner: z.string().min(32, 'Invalid wallet address'),
});

// ── Game username bind ────────────────────────────────────────────────────────

export const bindUsernameSchema = z.object({
  game: gameTypeSchema.exclude(['chess']),  // Chess uses OAuth, not this flow
  username: gameUsernameSchema,
  accountId: z.string().optional(),              // PUBG accountId from API verification
});

// ── Username appeal ───────────────────────────────────────────────────────────

export const usernameAppealSchema = z.object({
  game: gameTypeSchema.exclude(['chess']),
  username: gameUsernameSchema,
});

export const appealResponseSchema = z.object({
  appealId: z.string().uuid('Invalid appeal ID'),
  response: z.enum(['release', 'contest']),
});

// ── Username change request ───────────────────────────────────────────────────

export const usernameChangeRequestSchema = z.object({
  game: gameTypeSchema.exclude(['chess']),
  oldUsername: gameUsernameSchema,
  newUsername: gameUsernameSchema,
  reason: z.string().trim().min(10, 'Please provide at least 10 characters of explanation').max(500),
  reasonCategory: z.enum([
    'name_changed',
    'account_banned_in_game',
    'entry_error',
    'other',
  ]),
});

// ── Settings ──────────────────────────────────────────────────────────────────

export const updateSettingsSchema = z.object({
  push_notifications_enabled: z.boolean().optional(),
  moderation_requests_enabled: z.boolean().optional(),
}).refine(
  data => Object.keys(data).length > 0,
  { message: 'At least one setting must be provided' }
);

// ── Generic helper ────────────────────────────────────────────────────────────

export function validateWithError<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error.errors[0]?.message || 'Validation failed' };
}