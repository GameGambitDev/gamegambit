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

// Stream game updates in real-time
export function useLichessGameStream(gameId: string | null | undefined) {
  return useQuery({
    queryKey: ['lichessGameStream', gameId],
    queryFn: async (): Promise<LichessGame | null> => {
      if (!gameId) return null;
      const response = await fetch(`${LICHESS_API}/game/${gameId}`, {
        headers: { Accept: 'application/json' }
      });
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error('Failed to fetch game');
      }
      return response.json();
    },
    enabled: !!gameId,
    refetchInterval: 3000, // Poll every 3 seconds for live updates
    staleTime: 1000,
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
    }): Promise<{ winner: 'playerA' | 'playerB' | 'draw' | null; valid: boolean; status?: string }> => {
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
        return { winner: null, valid: false, status: 'players_not_matched' };
      }
      
      // Check if game is finished
      const finishedStatuses = ['mate', 'resign', 'outoftime', 'draw', 'stalemate', 'timeout', 'cheat', 'aborted'];
      if (!finishedStatuses.includes(game.status)) {
        return { winner: null, valid: false, status: game.status };
      }

      if (game.status === 'aborted') {
        return { winner: null, valid: false, status: 'aborted' };
      }
      
      if (game.status === 'draw' || game.status === 'stalemate') {
        return { winner: 'draw', valid: true, status: game.status };
      }
      
      // Determine winner
      if (game.winner === 'white') {
        return { winner: playerAIsWhite ? 'playerA' : 'playerB', valid: true, status: game.status };
      } else if (game.winner === 'black') {
        return { winner: playerAIsBlack ? 'playerA' : 'playerB', valid: true, status: game.status };
      }
      
      return { winner: null, valid: false, status: game.status };
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

// Create an open challenge link (no auth required - uses Lichess open challenge feature)
export function useCreateOpenChallenge() {
  return useMutation({
    mutationFn: async ({
      timeControl = '10+0',
      rated = false,
    }: {
      timeControl?: string;
      rated?: boolean;
    } = {}): Promise<{ url: string; gameId: string | null }> => {
      // Parse time control (format: "minutes+increment" e.g., "10+0", "5+3")
      const [minutes, increment] = timeControl.split('+').map(Number);
      
      // For unrated games, we can use the Lichess open challenge URL format
      // This creates a shareable link where the first person to click becomes the opponent
      const params = new URLSearchParams({
        variant: 'standard',
        timeMode: 'realTime',
        time: minutes.toString(),
        increment: increment.toString(),
        mode: rated ? 'rated' : 'casual',
      });
      
      // Return a play URL that users can share
      const url = `https://lichess.org/setup/friend?${params.toString()}`;
      
      return { url, gameId: null };
    },
  });
}

// Generate a Lichess TV/spectate embed URL for a game
export function getLichessEmbedUrl(gameId: string, theme: 'auto' | 'light' | 'dark' = 'dark'): string {
  return `https://lichess.org/embed/game/${gameId}?theme=${theme}&bg=dark`;
}

// Generate a Lichess game URL
export function getLichessGameUrl(gameId: string): string {
  return `https://lichess.org/${gameId}`;
}

// Check if game is still in progress
export function isGameInProgress(status: string): boolean {
  return ['created', 'started'].includes(status);
}

// Check if game is finished
export function isGameFinished(status: string): boolean {
  return ['mate', 'resign', 'outoftime', 'draw', 'stalemate', 'timeout', 'cheat', 'aborted'].includes(status);
}

// Get readable game status
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
