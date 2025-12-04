import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWallet } from '@solana/wallet-adapter-react';

export interface Player {
  id: string;
  wallet_address: string;
  lichess_username: string | null;
  codm_username: string | null;
  pubg_username: string | null;
  total_wins: number;
  total_losses: number;
  total_earnings: number;
  total_wagered: number;
  current_streak: number;
  best_streak: number;
  is_banned: boolean;
  ban_expires_at: string | null;
  last_active: string;
  created_at: string;
  updated_at: string;
}

export function usePlayer() {
  const { publicKey } = useWallet();
  const walletAddress = publicKey?.toBase58();

  return useQuery({
    queryKey: ['player', walletAddress],
    queryFn: async () => {
      if (!walletAddress) return null;
      
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('wallet_address', walletAddress)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data as Player | null;
    },
    enabled: !!walletAddress,
  });
}

export function useCreatePlayer() {
  const queryClient = useQueryClient();
  const { publicKey } = useWallet();

  return useMutation({
    mutationFn: async () => {
      if (!publicKey) throw new Error('Wallet not connected');
      
      const { data, error } = await supabase
        .from('players')
        .insert({ wallet_address: publicKey.toBase58() })
        .select()
        .single();
      
      if (error) throw error;
      return data as Player;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['player'] });
    },
  });
}

export function useUpdatePlayer() {
  const queryClient = useQueryClient();
  const { publicKey } = useWallet();

  return useMutation({
    mutationFn: async (updates: Partial<Player>) => {
      if (!publicKey) throw new Error('Wallet not connected');
      
      const { data, error } = await supabase
        .from('players')
        .update(updates)
        .eq('wallet_address', publicKey.toBase58())
        .select()
        .single();
      
      if (error) throw error;
      return data as Player;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['player'] });
    },
  });
}

export function useLeaderboard(sortBy: 'earnings' | 'wins' | 'streak' = 'earnings') {
  return useQuery({
    queryKey: ['leaderboard', sortBy],
    queryFn: async () => {
      const orderColumn = sortBy === 'earnings' ? 'total_earnings' : 
                          sortBy === 'wins' ? 'total_wins' : 'current_streak';
      
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .order(orderColumn, { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data as Player[];
    },
  });
}
