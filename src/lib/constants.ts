export const PROGRAM_ID = "CPS82nShfYFBdJPLs4kLMYEUrTwvxieqSrkw6VYRopzx";

// ── Supported games ───────────────────────────────────────────────────────────
// live: true  → game is active and wagers can be created
// live: false → "Coming Soon" in the UI
// apiVerify: true → we call an external API at bind time to confirm the username exists
// apiVerify: false → manual bind only (no public API available)

export const GAMES = {
  CHESS: {
    id: 'chess' as const,
    name: 'Chess',
    platform: 'Lichess',
    icon: '♟️',
    color: 'primary',
    live: true,
    apiVerify: true,    // Lichess OAuth
    usernameKey: 'lichess_username' as const,
    playerIdKey: null,
  },
  CODM: {
    id: 'codm' as const,
    name: 'Call of Duty Mobile',
    platform: 'Activision',
    icon: '🎯',
    color: 'destructive',
    live: false,
    apiVerify: false,   // No public API
    usernameKey: 'codm_username' as const,
    playerIdKey: 'codm_player_id' as const,
  },
  PUBG: {
    id: 'pubg' as const,
    name: 'PUBG Mobile',
    platform: 'PUBG',
    icon: '🔫',
    color: 'accent',
    live: false,
    apiVerify: true,    // PUBG API — verify username exists + get accountId
    usernameKey: 'pubg_username' as const,
    playerIdKey: 'pubg_player_id' as const,
  },
  FREE_FIRE: {
    id: 'free_fire' as const,
    name: 'Free Fire',
    platform: 'Garena',
    icon: '🔥',
    color: 'secondary',
    live: false,
    apiVerify: false,   // No public API
    usernameKey: 'free_fire_username' as const,
    playerIdKey: 'free_fire_uid' as const,
  },
} as const;

// Derive a union type from the games object — used for type-safe game IDs
export type GameId = typeof GAMES[keyof typeof GAMES]['id'];
// → 'chess' | 'codm' | 'pubg' | 'free_fire'

// Non-chess games that use the manual binding system
export const MANUAL_GAMES = [GAMES.PUBG, GAMES.CODM, GAMES.FREE_FIRE] as const;

// ── Wager status ──────────────────────────────────────────────────────────────

export const WAGER_STATUS = {
  Created: 'created',
  Joined: 'joined',
  Voting: 'voting',
  Retractable: 'retractable',
  Disputed: 'disputed',
  Resolved: 'resolved',
  Cancelled: 'cancelled',
} as const;

export const STATUS_LABELS: Record<string, string> = {
  created: 'Waiting for Opponent',
  joined: 'In Progress',
  voting: 'Voting',
  retractable: 'Pending Confirmation',
  disputed: 'Disputed',
  resolved: 'Resolved',
  cancelled: 'Cancelled',
};

// ── Fees ──────────────────────────────────────────────────────────────────────

export const PLATFORM_FEE_BPS = 1000;   // 10% — must match PLATFORM_FEE_BPS in lib.rs
export const MODERATOR_FEE_PERCENT = 3;      // 3% of pot goes to player-moderator
export const MODERATOR_FEE_CAP_USD = 2.00;   // Hard cap in USD — never pay more than this
export const WINNER_PAYOUT_PERCENT = 87;     // When moderator involved (90 - 3)

// ── Timers (milliseconds unless noted) ───────────────────────────────────────

export const GAME_COMPLETE_WAIT_MS = 15 * 60 * 1000;  // 15 min for opponent to confirm
export const GAME_COMPLETE_COUNTDOWN_SEC = 10;               // 10s shared countdown after both confirm
export const VOTE_WINDOW_MS = 5 * 60 * 1000;  // 5 min to vote after game confirmed
export const RETRACT_WINDOW_SEC = 15;               // 15s to retract after both agree (matches chain)
export const MOD_REQUEST_ACCEPT_SEC = 20;               // 20s for mod to accept/decline
export const MOD_INVESTIGATION_MIN = 10;               // 10 min for mod to investigate
export const USERNAME_APPEAL_RESPONSE_HOURS = 48;               // Hours holder has to respond to appeal

// ── Solana ────────────────────────────────────────────────────────────────────

export const LAMPORTS_PER_SOL = 1_000_000_000;

// ── Helpers ───────────────────────────────────────────────────────────────────

export const formatSol = (lamports: number): string => {
  return (lamports / LAMPORTS_PER_SOL).toFixed(4);
};

export const truncateAddress = (address: string, chars = 4): string => {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
};

/**
 * Look up a GAMES entry by its id string.
 * Returns undefined if the id doesn't match any game.
 */
export function getGameById(id: string) {
  return Object.values(GAMES).find(g => g.id === id);
}