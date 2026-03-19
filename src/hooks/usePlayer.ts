import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSupabaseClient } from '@/integrations/supabase/client';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletAuth } from './useWalletAuth';
import type { Tables } from '@/integrations/supabase/types';

export type Player = Tables<'players'>;

export function usePlayer() {
  const { publicKey } = useWallet();
  const walletAddress = publicKey?.toBase58();

  return useQuery({
    queryKey: ['player', walletAddress],
    queryFn: async () => {
      if (!walletAddress) return null;

      const { data, error } = await getSupabaseClient()
        .from('players')
        .select('*')
        .eq('wallet_address', walletAddress)
        .maybeSingle();

      if (error) throw error;
      return data as Player | null;
    },
    enabled: !!walletAddress,
  });
}

// Secure player creation via edge function with wallet verification
export function useCreatePlayer() {
  const queryClient = useQueryClient();
  const { publicKey } = useWallet();
  const { getSessionToken } = useWalletAuth();

  return useMutation({
    mutationFn: async () => {
      if (!publicKey) throw new Error('Wallet not connected');

      const sessionToken = await getSessionToken();
      if (!sessionToken) {
        throw new Error('Wallet verification required. Please sign the message to continue.');
      }

      const { data, error } = await getSupabaseClient().functions.invoke('secure-player', {
        body: { action: 'create' },
        headers: { 'X-Session-Token': sessionToken },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data.player as Player;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['player'] });
    },
  });
}

// Secure player update via edge function with wallet verification
export function useUpdatePlayer() {
  const queryClient = useQueryClient();
  const { publicKey } = useWallet();
  const { getSessionToken } = useWalletAuth();

  return useMutation({
    mutationFn: async (updates: Partial<Player>) => {
      if (!publicKey) throw new Error('Wallet not connected');

      const sessionToken = await getSessionToken();
      if (!sessionToken) {
        throw new Error('Wallet verification required. Please sign the message to continue.');
      }

      const { data, error } = await getSupabaseClient().functions.invoke('secure-player', {
        body: { action: 'update', updates },
        headers: { 'X-Session-Token': sessionToken },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data.player as Player;
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

      const { data, error } = await getSupabaseClient()
        .from('players')
        .select('*')
        .order(orderColumn, { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as Player[];
    },
  });
}

export function useSearchPlayers(searchQuery: string) {
  return useQuery({
    queryKey: ['players', 'search', searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return [];

      const { data, error } = await getSupabaseClient()
        .from('players')
        .select('*')
        .or(`username.ilike.%${searchQuery}%,wallet_address.ilike.%${searchQuery}%`)
        .limit(20);

      if (error) throw error;
      return data as Player[];
    },
    enabled: searchQuery.length >= 2,
  });
}

export function usePlayerByWallet(walletAddress: string | null) {
  return useQuery({
    queryKey: ['player', walletAddress],
    queryFn: async () => {
      if (!walletAddress) return null;

      const { data, error } = await getSupabaseClient()
        .from('players')
        .select('*')
        .eq('wallet_address', walletAddress)
        .maybeSingle();

      if (error) throw error;
      return data as Player | null;
    },
    enabled: !!walletAddress,
  });
}

export function usePlayersByWallets(walletAddresses: string[]) {
  return useQuery({
    queryKey: ['players', 'byWallets', walletAddresses],
    queryFn: async () => {
      if (!walletAddresses.length) return [];

      const { data, error } = await getSupabaseClient()
        .from('players')
        .select('*')
        .in('wallet_address', walletAddresses);

      if (error) throw error;
      return data as Player[];
    },
    enabled: walletAddresses.length > 0,
  });
}