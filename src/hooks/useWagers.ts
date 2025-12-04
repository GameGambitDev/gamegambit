import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWallet } from '@solana/wallet-adapter-react';

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

// Create a new wager
export function useCreateWager() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (wager: {
      match_id: number;
      player_a_wallet: string;
      game: GameType;
      stake_lamports: number;
      lichess_game_id?: string;
      is_public?: boolean;
      stream_url?: string;
    }) => {
      const { data, error } = await supabase
        .from('wagers')
        .insert(wager)
        .select()
        .single();
      
      if (error) throw error;
      return data as Wager;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wagers'] });
    },
  });
}

// Join a wager
export function useJoinWager() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ wagerId, playerBWallet }: { wagerId: string; playerBWallet: string }) => {
      const { data, error } = await supabase
        .from('wagers')
        .update({ 
          player_b_wallet: playerBWallet,
          status: 'joined' as WagerStatus
        })
        .eq('id', wagerId)
        .select()
        .single();
      
      if (error) throw error;
      return data as Wager;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wagers'] });
    },
  });
}

// Submit vote
export function useSubmitVote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      wagerId, 
      voterWallet, 
      votedWinner,
      isPlayerA 
    }: { 
      wagerId: string; 
      voterWallet: string; 
      votedWinner: string;
      isPlayerA: boolean;
    }) => {
      const updateData = isPlayerA 
        ? { vote_player_a: votedWinner, status: 'voting' as WagerStatus }
        : { vote_player_b: votedWinner, status: 'voting' as WagerStatus };
      
      const { data, error } = await supabase
        .from('wagers')
        .update(updateData)
        .eq('id', wagerId)
        .select()
        .single();
      
      if (error) throw error;
      return data as Wager;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wagers'] });
    },
  });
}
