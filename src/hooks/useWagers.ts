import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletAuth } from './useWalletAuth';

export type WagerStatus = 'created' | 'joined' | 'voting' | 'retractable' | 'disputed' | 'resolved';
export type GameType = 'chess' | 'codm' | 'pubg';

export interface Wager {
  id: string;
  match_id: number;
  player_a_wallet: string;
  player_b_wallet: string | null;
  game: GameType;
  stake_lamports: number;
  lichess_game_id: string | null;
  status: WagerStatus;
  requires_moderator: boolean;
  vote_player_a: string | null;
  vote_player_b: string | null;
  winner_wallet: string | null;
  is_public: boolean;
  stream_url: string | null;
  vote_timestamp: string | null;
  retract_deadline: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  ready_player_a: boolean | null;
  ready_player_b: boolean | null;
  countdown_started_at: string | null;
}

// Fetch all public wagers
export function useWagers() {
  return useQuery({
    queryKey: ['wagers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wagers')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Wager[];
    },
  });
}

// Fetch open wagers (status = 'created')
export function useOpenWagers() {
  return useQuery({
    queryKey: ['wagers', 'open'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wagers')
        .select('*')
        .eq('status', 'created')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Wager[];
    },
  });
}

// Fetch live wagers (status = 'joined' or 'voting')
export function useLiveWagers() {
  return useQuery({
    queryKey: ['wagers', 'live'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wagers')
        .select('*')
        .in('status', ['joined', 'voting', 'disputed'])
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Wager[];
    },
  });
}

// Fetch user's wagers
export function useMyWagers() {
  const { publicKey } = useWallet();
  const walletAddress = publicKey?.toBase58();

  return useQuery({
    queryKey: ['wagers', 'my', walletAddress],
    queryFn: async () => {
      if (!walletAddress) return [];
      
      const { data, error } = await supabase
        .from('wagers')
        .select('*')
        .or(`player_a_wallet.eq.${walletAddress},player_b_wallet.eq.${walletAddress}`)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Wager[];
    },
    enabled: !!walletAddress,
  });
}

// Fetch recent resolved wagers (for feed)
export function useRecentWagers(limit: number = 10) {
  return useQuery({
    queryKey: ['wagers', 'recent', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wagers')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return data as Wager[];
    },
  });
}

// Fetch recent winners (resolved wagers with winner)
export function useRecentWinners(limit: number = 5) {
  return useQuery({
    queryKey: ['wagers', 'winners', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wagers')
        .select('*')
        .eq('status', 'resolved')
        .not('winner_wallet', 'is', null)
        .order('resolved_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return data as Wager[];
    },
  });
}

// Secure wager creation via edge function with wallet verification
export function useCreateWager() {
  const queryClient = useQueryClient();
  const { getSessionToken } = useWalletAuth();

  return useMutation({
    mutationFn: async (wager: {
      game: GameType;
      stake_lamports: number;
      lichess_game_id?: string;
      is_public?: boolean;
      stream_url?: string;
    }) => {
      // Get verified session token
      const sessionToken = await getSessionToken();
      if (!sessionToken) {
        throw new Error('Wallet verification required. Please sign the message to continue.');
      }

      const { data, error } = await supabase.functions.invoke('secure-wager', {
        body: { action: 'create', ...wager },
        headers: { 'x-wallet-session': sessionToken },
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data.wager as Wager;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wagers'] });
    },
  });
}

// Secure wager join via edge function with wallet verification
export function useJoinWager() {
  const queryClient = useQueryClient();
  const { getSessionToken } = useWalletAuth();

  return useMutation({
    mutationFn: async ({ wagerId }: { wagerId: string; playerBWallet?: string }) => {
      // Get verified session token
      const sessionToken = await getSessionToken();
      if (!sessionToken) {
        throw new Error('Wallet verification required. Please sign the message to continue.');
      }

      const { data, error } = await supabase.functions.invoke('secure-wager', {
        body: { action: 'join', wagerId },
        headers: { 'x-wallet-session': sessionToken },
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data.wager as Wager;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wagers'] });
    },
  });
}

// Secure vote submission via edge function with wallet verification
export function useSubmitVote() {
  const queryClient = useQueryClient();
  const { getSessionToken } = useWalletAuth();

  return useMutation({
    mutationFn: async ({ 
      wagerId, 
      votedWinner,
    }: { 
      wagerId: string; 
      voterWallet?: string; 
      votedWinner: string;
      isPlayerA?: boolean;
    }) => {
      const sessionToken = await getSessionToken();
      if (!sessionToken) {
        throw new Error('Wallet verification required. Please sign the message to continue.');
      }

      const { data, error } = await supabase.functions.invoke('secure-wager', {
        body: { action: 'vote', wagerId, votedWinner },
        headers: { 'x-wallet-session': sessionToken },
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data.wager as Wager;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wagers'] });
    },
  });
}

// Secure wager edit via edge function
export function useEditWager() {
  const queryClient = useQueryClient();
  const { getSessionToken } = useWalletAuth();

  return useMutation({
    mutationFn: async ({ 
      wagerId, 
      stake_lamports,
      lichess_game_id,
      stream_url,
      is_public,
    }: { 
      wagerId: string;
      stake_lamports?: number;
      lichess_game_id?: string;
      stream_url?: string;
      is_public?: boolean;
    }) => {
      const sessionToken = await getSessionToken();
      if (!sessionToken) {
        throw new Error('Wallet verification required.');
      }

      const { data, error } = await supabase.functions.invoke('secure-wager', {
        body: { action: 'edit', wagerId, stake_lamports, lichess_game_id, stream_url, is_public },
        headers: { 'x-wallet-session': sessionToken },
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data.wager as Wager;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wagers'] });
    },
  });
}

// Secure wager delete via edge function
export function useDeleteWager() {
  const queryClient = useQueryClient();
  const { getSessionToken } = useWalletAuth();

  return useMutation({
    mutationFn: async ({ wagerId }: { wagerId: string }) => {
      const sessionToken = await getSessionToken();
      if (!sessionToken) {
        throw new Error('Wallet verification required.');
      }

      const { data, error } = await supabase.functions.invoke('secure-wager', {
        body: { action: 'delete', wagerId },
        headers: { 'x-wallet-session': sessionToken },
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wagers'] });
    },
  });
}

// Set ready status for a wager
export function useSetReady() {
  const queryClient = useQueryClient();
  const { getSessionToken } = useWalletAuth();

  return useMutation({
    mutationFn: async ({ wagerId, ready }: { wagerId: string; ready: boolean }) => {
      const sessionToken = await getSessionToken();
      if (!sessionToken) {
        throw new Error('Wallet verification required.');
      }

      const { data, error } = await supabase.functions.invoke('secure-wager', {
        body: { action: 'setReady', wagerId, ready },
        headers: { 'x-wallet-session': sessionToken },
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data.wager as Wager;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wagers'] });
    },
  });
}

// Start game after countdown
export function useStartGame() {
  const queryClient = useQueryClient();
  const { getSessionToken } = useWalletAuth();

  return useMutation({
    mutationFn: async ({ wagerId }: { wagerId: string }) => {
      const sessionToken = await getSessionToken();
      if (!sessionToken) {
        throw new Error('Wallet verification required.');
      }

      const { data, error } = await supabase.functions.invoke('secure-wager', {
        body: { action: 'startGame', wagerId },
        headers: { 'x-wallet-session': sessionToken },
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data.wager as Wager;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wagers'] });
    },
  });
}

// Fetch a single wager by ID with realtime updates
export function useWagerById(wagerId: string | null) {
  return useQuery({
    queryKey: ['wagers', wagerId],
    queryFn: async () => {
      if (!wagerId) return null;
      const { data, error } = await supabase
        .from('wagers')
        .select('*')
        .eq('id', wagerId)
        .single();
      
      if (error) throw error;
      return data as Wager;
    },
    enabled: !!wagerId,
    refetchInterval: 2000, // Poll every 2 seconds for ready state updates
  });
}

// Check if game is complete via Lichess API
export function useCheckGameComplete() {
  const queryClient = useQueryClient();
  const { getSessionToken } = useWalletAuth();

  return useMutation({
    mutationFn: async ({ wagerId }: { wagerId: string }) => {
      const sessionToken = await getSessionToken();
      if (!sessionToken) {
        throw new Error('Wallet verification required.');
      }

      const { data, error } = await supabase.functions.invoke('secure-wager', {
        body: { action: 'checkGameComplete', wagerId },
        headers: { 'x-wallet-session': sessionToken },
      });
      
      if (error) throw error;
      return data as {
        gameComplete: boolean;
        status?: string;
        winner?: string;
        winnerWallet?: string;
        resultType?: 'playerA' | 'playerB' | 'draw' | 'unknown';
        message?: string;
        wager?: Wager;
      };
    },
    onSuccess: (data) => {
      if (data.gameComplete) {
        queryClient.invalidateQueries({ queryKey: ['wagers'] });
      }
    },
  });
}
