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
      // Get verified session token
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
