import { useQuery, useMutation } from '@tanstack/react-query';

const LICHESS_API = 'https://lichess.org/api';

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
}

// Fetch user profile by username
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
    staleTime: 60000, // 1 minute
  });
}

// Fetch user's recent games
export function useLichessGames(username: string | null | undefined, limit = 10) {
  return useQuery({
    queryKey: ['lichessGames', username, limit],
    queryFn: async (): Promise<LichessGame[]> => {
      if (!username) return [];
      const response = await fetch(
        `${LICHESS_API}/games/user/${username}?max=${limit}&pgnInJson=false`,
        {
          headers: { Accept: 'application/x-ndjson' },
        }
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

// Check if a specific game exists and get its details
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
    staleTime: 5000, // Refresh frequently for live games
  });
}

// Verify game result between two players
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
    }): Promise<{ winner: 'playerA' | 'playerB' | 'draw' | null; valid: boolean }> => {
      const response = await fetch(`${LICHESS_API}/game/${gameId}`);
      if (!response.ok) return { winner: null, valid: false };
      
      const game: LichessGame = await response.json();
      
      // Check if both players participated
      const whiteUser = game.players.white.user?.name?.toLowerCase();
      const blackUser = game.players.black.user?.name?.toLowerCase();
      const playerALower = playerAUsername.toLowerCase();
      const playerBLower = playerBUsername.toLowerCase();
      
      const playerAIsWhite = whiteUser === playerALower;
      const playerAIsBlack = blackUser === playerALower;
      const playerBIsWhite = whiteUser === playerBLower;
      const playerBIsBlack = blackUser === playerBLower;
      
      // Both players must be in the game
      if (!((playerAIsWhite && playerBIsBlack) || (playerAIsBlack && playerBIsWhite))) {
        return { winner: null, valid: false };
      }
      
      if (game.status !== 'mate' && game.status !== 'resign' && game.status !== 'outoftime' && game.status !== 'draw' && game.status !== 'stalemate') {
        // Game not finished
        return { winner: null, valid: false };
      }
      
      if (game.status === 'draw' || game.status === 'stalemate') {
        return { winner: 'draw', valid: true };
      }
      
      // Determine winner
      if (game.winner === 'white') {
        return { winner: playerAIsWhite ? 'playerA' : 'playerB', valid: true };
      } else if (game.winner === 'black') {
        return { winner: playerAIsBlack ? 'playerA' : 'playerB', valid: true };
      }
      
      return { winner: null, valid: false };
    },
  });
}

// Get online status of a user
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
    refetchInterval: 30000, // Check every 30 seconds
  });
}
