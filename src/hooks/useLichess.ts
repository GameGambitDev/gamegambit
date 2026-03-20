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

// ── PKCE helpers ──────────────────────────────────────────────────────────────

function generateRandomString(length = 64): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => chars[b % chars.length]).join('');
}

async function sha256Base64Url(plain: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// ── Initiate Lichess OAuth PKCE flow ─────────────────────────────────────────
// Stores state + verifier in cookies, redirects user to Lichess.
// No server registration needed — PKCE is purely client-driven.

export async function startLichessOAuth(walletAddress: string): Promise<void> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://gamegambit-auth.vercel.app';
  const clientId = new URL(siteUrl).hostname; // e.g. "gamegambit-auth.vercel.app"
  const redirectUri = `${siteUrl}/api/auth/lichess/callback`;

  const state = generateRandomString(32);
  const codeVerifier = generateRandomString(64);
  const codeChallenge = await sha256Base64Url(codeVerifier);

  // Store state, verifier and wallet in cookies for the callback to verify
  const cookieOpts = 'Path=/; SameSite=Lax; Max-Age=600'; // 10 min expiry
  document.cookie = `gg_lichess_state=${state}; ${cookieOpts}`;
  document.cookie = `gg_lichess_verifier=${codeVerifier}; ${cookieOpts}`;
  document.cookie = `gg_lichess_wallet=${walletAddress}; ${cookieOpts}`;

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: '',               // No scopes needed — we only need identity verification
    state,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
  });

  window.location.href = `https://lichess.org/oauth?${params.toString()}`;
}

// ── Check if current player has Lichess connected ─────────────────────────────

export function useLichessConnected() {
  const { publicKey } = useWallet();
  const walletAddress = publicKey?.toBase58();

  return useQuery({
    queryKey: ['lichess', 'connected', walletAddress],
    queryFn: async () => {
      if (!walletAddress) return null;
      const { data } = await getSupabaseClient()
        .from('players')
        .select('lichess_username, lichess_user_id')
        .eq('wallet_address', walletAddress)
        .maybeSingle();
      return (data as any) ?? null;
    },
    enabled: !!walletAddress,
  });
}

// ── Disconnect Lichess ────────────────────────────────────────────────────────

export function useDisconnectLichess() {
  const queryClient = useQueryClient();
  const { getSessionToken } = useWalletAuth();

  return useMutation({
    mutationFn: async () => {
      const sessionToken = await getSessionToken();
      if (!sessionToken) throw new Error('Wallet verification required');

      const { error } = await getSupabaseClient().functions.invoke('secure-player', {
        body: {
          action: 'update',
          updates: {
            lichess_access_token: null,
            lichess_username: null,
            lichess_user_id: null,
          },
        },
        headers: { 'X-Session-Token': sessionToken },
      });
      if (error) throw new Error('Failed to disconnect Lichess');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lichess'] });
      queryClient.invalidateQueries({ queryKey: ['player'] });
    },
  });
}

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