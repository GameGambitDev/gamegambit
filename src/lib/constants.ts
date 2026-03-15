export const PROGRAM_ID = "CPS82nShfYFBdJPLs4kLMYEUrTwvxieqSrkw6VYRopzx";

export const GAMES = {
  CHESS: {
    id: 'chess',
    name: 'Chess',
    platform: 'Lichess',
    icon: '♟️',
    color: 'primary',
    live: true,
  },
  CODM: {
    id: 'codm',
    name: 'Call of Duty Mobile',
    platform: 'Activision',
    icon: '🎯',
    color: 'destructive',
    live: false,
  },
  PUBG: {
    id: 'pubg',
    name: 'PUBG Mobile',
    platform: 'PUBG',
    icon: '🔫',
    color: 'accent',
    live: false,
  },
} as const;

export const WAGER_STATUS = {
  Created: 'created',
  Joined: 'joined',
  Voting: 'voting',
  Retractable: 'retractable',
  Disputed: 'disputed',
  Resolved: 'resolved',
} as const;

export const STATUS_LABELS: Record<string, string> = {
  created: 'Waiting for Opponent',
  joined: 'In Progress',
  voting: 'Voting',
  retractable: 'Pending Confirmation',
  disputed: 'Disputed',
  resolved: 'Resolved',
};

export const LAMPORTS_PER_SOL = 1_000_000_000;

export const formatSol = (lamports: number): string => {
  return (lamports / LAMPORTS_PER_SOL).toFixed(4);
};

export const truncateAddress = (address: string, chars = 4): string => {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
};