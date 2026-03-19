import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSupabaseClient } from '@/integrations/supabase/client';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletAuth } from './useWalletAuth';

const LICHESS_API = 'https://lichess.org/api';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LichessUser {
  id: string;
  username: string;
  online: boolean;
  perfs?: {
    bullet?: { rating: number; games: number };
    blitz?: { rating: number; games: number };
    rapid?: { rating: number; games: number };
    classical?: { rating: number; games: number };
  };
  count?: {
    all: number;
    win: number;
    loss: number;
    draw: number;
  };
  createdAt?: number;
}

export interface LichessGame {
  id: string;
  rated: boolean;
  status: string;
  winner?: 'white' | 'black';
  players: {
    white: { user?: { id: string; name: string }; rating?: number };
    black: { user?: { id: string; name: string }; rating?: number };
  };
  createdAt: number;
  lastMoveAt: number;
  speed?: string;
  perf?: string;
  moves?: string;
  clock?: {
    initial: number;
    increment: number;
  };
}

export interface LichessChallenge {
  id: string;
  url: string;
  urlWhite: string;
  urlBlack: string;
  color: 'random' | 'white' | 'black';
  direction: 'out' | 'in';
  timeControl: {
    type: string;
    limit?: number;
    increment?: number;
  };
}

// ── Pre-filled token generation URL ──────────────────────────────────────────

export const LICHESS_TOKEN_URL =
  'https://lichess.org/account/oauth/token/create?scopes[]=challenge:write&description=GameGambit';

// ── Fetch user profile by username ────────────────────────────────────────────

export function useLichessUser(username: string | null | undefined) {
  return useQuery({
    queryKey: ['lichessUser', username],
    queryFn: async (): Promise<LichessUser | null> => {
      if (!username) return null;
      const response = await fetch(`${LICHESS_API}/user/${username}`);
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error('Failed to fetch Lichess user');
      }
      return response.json();
    },
    enabled: !!username,
    staleTime: 60000,
  });
}

// ── Fetch user's recent games ─────────────────────────────────────────────────

export function useLichessGames(username: string | null | undefined, limit = 10) {
  return useQuery({
    queryKey: ['lichessGames', username, limit],
    queryFn: async (): Promise<LichessGame[]> => {
      if (!username) return [];
      const response = await fetch(
        `${LICHESS_API}/games/user/${username}?max=${limit}&pgnInJson=false`,
        { headers: { Accept: 'application/x-ndjson' } }
      );
      if (!response.ok) throw new Error('Failed to fetch games');
      const text = await response.text();
      const lines = text.trim().split('\n').filter(Boolean);
      return lines.map(line => JSON.parse(line));
    },
    enabled: !!username,
    staleTime: 30000,
  });
}

// ── Check if a specific game exists and get its details ───────────────────────

export function useLichessGame(gameId: string | null | undefined) {
  return useQuery({
    queryKey: ['lichessGame', gameId],
    queryFn: async (): Promise<LichessGame | null> => {
      if (!gameId) return null;
      const response = await fetch(`${LICHESS_API}/game/${gameId}`);
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error('Failed to fetch game');
      }
      return response.json();
    },
    enabled: !!gameId,
    staleTime: 5000,
  });
}

// ── Stream game updates in real-time ──────────────────────────────────────────

export function useLichessGameStream(gameId: string | null | undefined) {
  return useQuery({
    queryKey: ['lichessGameStream', gameId],
    queryFn: async (): Promise<LichessGame | null> => {
      if (!gameId) return null;
      const response = await fetch(`${LICHESS_API}/game/${gameId}`, {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error('Failed to fetch game');
      }
      return response.json();
    },
    enabled: !!gameId,
    refetchInterval: 3000,
    staleTime: 1000,
  });
}

// ── Verify game result between two players ────────────────────────────────────

export function useVerifyLichessGame() {
  return useMutation({
    mutationFn: async ({
      gameId,
      playerAUsername,
      playerBUsername,
    }: {
      gameId: string;
      playerAUsername: string;
      playerBUsername: string;
    }): Promise<{ winner: 'playerA' | 'playerB' | 'draw' | null; valid: boolean; status?: string }> => {
      const response = await fetch(`${LICHESS_API}/game/${gameId}`);
      if (!response.ok) return { winner: null, valid: false };

      const game: LichessGame = await response.json();

      const whiteUser = game.players.white.user?.name?.toLowerCase();
      const blackUser = game.players.black.user?.name?.toLowerCase();
      const playerALower = playerAUsername.toLowerCase();
      const playerBLower = playerBUsername.toLowerCase();

      const playerAIsWhite = whiteUser === playerALower;
      const playerAIsBlack = blackUser === playerALower;
      const playerBIsWhite = whiteUser === playerBLower;
      const playerBIsBlack = blackUser === playerBLower;

      if (!((playerAIsWhite && playerBIsBlack) || (playerAIsBlack && playerBIsWhite))) {
        return { winner: null, valid: false, status: 'players_not_matched' };
      }

      const finishedStatuses = ['mate', 'resign', 'outoftime', 'draw', 'stalemate', 'timeout', 'cheat', 'aborted'];
      if (!finishedStatuses.includes(game.status)) {
        return { winner: null, valid: false, status: game.status };
      }

      if (game.status === 'aborted') return { winner: null, valid: false, status: 'aborted' };
      if (game.status === 'draw' || game.status === 'stalemate') return { winner: 'draw', valid: true, status: game.status };

      if (game.winner === 'white') {
        return { winner: playerAIsWhite ? 'playerA' : 'playerB', valid: true, status: game.status };
      } else if (game.winner === 'black') {
        return { winner: playerAIsBlack ? 'playerA' : 'playerB', valid: true, status: game.status };
      }

      return { winner: null, valid: false, status: game.status };
    },
  });
}

// ── Get online status of a user ───────────────────────────────────────────────

export function useLichessOnlineStatus(username: string | null | undefined) {
  return useQuery({
    queryKey: ['lichessOnline', username],
    queryFn: async (): Promise<boolean> => {
      if (!username) return false;
      const response = await fetch(`${LICHESS_API}/user/${username}`);
      if (!response.ok) return false;
      const user: LichessUser = await response.json();
      return user.online;
    },
    enabled: !!username,
    refetchInterval: 30000,
  });
}

// ── Create an open challenge link (no auth required) ──────────────────────────

export function useCreateOpenChallenge() {
  return useMutation({
    mutationFn: async ({
      timeControl = '10+0',
      rated = false,
    }: {
      timeControl?: string;
      rated?: boolean;
    } = {}): Promise<{ url: string; gameId: string | null }> => {
      const [minutes, increment] = timeControl.split('+').map(Number);
      const params = new URLSearchParams({
        variant: 'standard',
        timeMode: 'realTime',
        time: minutes.toString(),
        increment: increment.toString(),
        mode: rated ? 'rated' : 'casual',
      });
      const url = `https://lichess.org/setup/friend?${params.toString()}`;
      return { url, gameId: null };
    },
  });
}

// ── Fetch current player's stored Lichess token from DB ───────────────────────

export function useLichessToken() {
  const { publicKey } = useWallet();
  const walletAddress = publicKey?.toBase58();

  return useQuery({
    queryKey: ['lichess', 'token', walletAddress],
    queryFn: async () => {
      if (!walletAddress) return null;
      const { data } = await getSupabaseClient()
        .from('players')
        .select('lichess_access_token, lichess_username')
        .eq('wallet_address', walletAddress)
        .maybeSingle();
      // Cast to any — Supabase types not yet regenerated after migration
      return (data as any)?.lichess_access_token ?? null;
    },
    enabled: !!walletAddress,
  });
}

// ── Save Lichess token — verifies it by calling /api/account first ────────────

export function useSaveLichessToken() {
  const queryClient = useQueryClient();
  const { publicKey } = useWallet();
  const { getSessionToken } = useWalletAuth();

  return useMutation({
    mutationFn: async (token: string) => {
      if (!publicKey) throw new Error('Wallet not connected');
      const trimmed = token.trim();
      if (!trimmed) throw new Error('Token cannot be empty');

      const verifyRes = await fetch('https://lichess.org/api/account', {
        headers: {
          Authorization: `Bearer ${trimmed}`,
          Accept: 'application/json',
        },
      });
      if (!verifyRes.ok) throw new Error('Invalid Lichess token — please check and try again');
      const account = await verifyRes.json() as LichessUser;

      const sessionToken = await getSessionToken();
      if (!sessionToken) throw new Error('Wallet verification required');

      const { error } = await getSupabaseClient().functions.invoke('secure-player', {
        body: {
          action: 'update',
          updates: {
            lichess_access_token: trimmed,
            lichess_username: account.username,
          },
        },
        headers: { 'X-Session-Token': sessionToken },
      });
      if (error) throw new Error('Failed to save token');
      return account;
    },
    onSuccess: (account) => {
      queryClient.invalidateQueries({ queryKey: ['lichess', 'token'] });
      queryClient.invalidateQueries({ queryKey: ['player'] });
      queryClient.invalidateQueries({ queryKey: ['lichessUser', account.username] });
    },
  });
}

// ── Remove stored Lichess token ───────────────────────────────────────────────

export function useRemoveLichessToken() {
  const queryClient = useQueryClient();
  const { getSessionToken } = useWalletAuth();

  return useMutation({
    mutationFn: async () => {
      const sessionToken = await getSessionToken();
      if (!sessionToken) throw new Error('Wallet verification required');
      const { error } = await getSupabaseClient().functions.invoke('secure-player', {
        body: { action: 'update', updates: { lichess_access_token: null } },
        headers: { 'X-Session-Token': sessionToken },
      });
      if (error) throw new Error('Failed to remove token');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lichess', 'token'] });
      queryClient.invalidateQueries({ queryKey: ['player'] });
    },
  });
}

// ── Create Lichess challenge using stored token ───────────────────────────────
// opponentLichessUsername = null → open challenge (anyone can accept)
// opponentLichessUsername = string → direct challenge to that user

export function useCreateLichessChallenge() {
  return useMutation({
    mutationFn: async ({
      token,
      params,
    }: {
      token: string;
      params: {
        opponentLichessUsername: string | null;
        rated?: boolean;
        clockLimit?: number;
        clockIncrement?: number;
        color?: 'white' | 'black' | 'random';
      };
    }) => {
      const {
        opponentLichessUsername,
        rated = false,
        clockLimit = 300,
        clockIncrement = 3,
        color = 'random',
      } = params;

      const body = new URLSearchParams({
        rated: String(rated),
        'clock.limit': String(clockLimit),
        'clock.increment': String(clockIncrement),
        color,
      });

      const url = opponentLichessUsername
        ? `https://lichess.org/api/challenge/${opponentLichessUsername}`
        : 'https://lichess.org/api/challenge/open';

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: body.toString(),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error || `Lichess API error: ${res.status}`);
      }

      const data = await res.json() as { challenge?: LichessChallenge } & LichessChallenge;
      return data.challenge ?? data;
    },
  });
}

// ── Utility functions ─────────────────────────────────────────────────────────

export function getLichessEmbedUrl(gameId: string, theme: 'auto' | 'light' | 'dark' = 'dark'): string {
  return `https://lichess.org/embed/game/${gameId}?theme=${theme}&bg=dark`;
}

export function getLichessGameUrl(gameId: string): string {
  return `https://lichess.org/${gameId}`;
}

export function isGameInProgress(status: string): boolean {
  return ['created', 'started'].includes(status);
}

export function isGameFinished(status: string): boolean {
  return ['mate', 'resign', 'outoftime', 'draw', 'stalemate', 'timeout', 'cheat', 'aborted'].includes(status);
}

export function getGameStatusText(status: string, winner?: 'white' | 'black'): string {
  switch (status) {
    case 'created': return 'Waiting for players...';
    case 'started': return 'Game in progress';
    case 'mate': return winner ? `Checkmate! ${winner === 'white' ? 'White' : 'Black'} wins` : 'Checkmate';
    case 'resign': return winner ? `${winner === 'white' ? 'Black' : 'White'} resigned` : 'Resigned';
    case 'outoftime':
    case 'timeout': return winner ? `Time out! ${winner === 'white' ? 'White' : 'Black'} wins` : 'Time out';
    case 'draw': return 'Game ended in a draw';
    case 'stalemate': return 'Stalemate - Draw';
    case 'aborted': return 'Game was aborted';
    case 'cheat': return 'Game ended due to violation';
    default: return status;
  }
}