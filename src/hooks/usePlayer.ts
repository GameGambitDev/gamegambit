import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSupabaseClient } from '@/integrations/supabase/client';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletAuth } from './useWalletAuth';
import type { Tables } from '@/integrations/supabase/types';

export type Player = Tables<'players'>;

// ── Column lists ──────────────────────────────────────────────────────────────
// Centralise select strings so adding a column is a one-line change.

// Full own-profile row — everything the profile page, settings page, and
// GameUsernameBindModal need.
const OWN_PROFILE_COLS = [
  'wallet_address',
  'username',
  'avatar_url',
  'bio',
  'total_wins',
  'total_losses',
  'total_earnings',
  'total_wagered',
  'current_streak',
  'best_streak',
  'created_at',
  'updated_at',
  // game accounts
  'lichess_username',
  'lichess_user_id',
  'codm_username',
  'codm_player_id',
  'pubg_username',
  'pubg_player_id',
  'free_fire_username',
  'free_fire_uid',
  'game_username_bound_at',
  // punishment
  'is_banned',
  'ban_reason',
  'is_suspended',
  'suspension_ends_at',
  'false_vote_count',
  // settings
  'push_notifications_enabled',
  'moderation_requests_enabled',
].join(', ');

// Public profile view — no sensitive or private-settings fields
const PUBLIC_PROFILE_COLS = [
  'wallet_address',
  'username',
  'avatar_url',
  'bio',
  'total_wins',
  'total_losses',
  'total_earnings',
  'current_streak',
  'best_streak',
  'created_at',
  'updated_at',
  // game accounts — shown on public profiles
  'codm_username',
  'pubg_username',
  'free_fire_username',
].join(', ');

// Leaderboard row — rank display only
const LEADERBOARD_COLS = [
  'wallet_address',
  'username',
  'avatar_url',
  'total_wins',
  'total_losses',
  'total_earnings',
  'current_streak',
  'best_streak',
].join(', ');

// Wager-card player chips — avatar, name, basic stats
const WAGER_CARD_COLS = [
  'wallet_address',
  'username',
  'avatar_url',
  'total_wins',
  'total_losses',
  'current_streak',
].join(', ');

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function usePlayer() {
  const { publicKey } = useWallet();
  const walletAddress = publicKey?.toBase58();

  return useQuery({
    queryKey: ['player', walletAddress],
    queryFn: async () => {
      if (!walletAddress) return null;

      const { data, error } = await getSupabaseClient()
        .from('players')
        .select(OWN_PROFILE_COLS)
        .eq('wallet_address', walletAddress)
        .maybeSingle();

      if (error) throw error;
      return data as unknown as Player | null;
    },
    enabled: !!walletAddress,
  });
}

export function useCreatePlayer() {
  const queryClient = useQueryClient();
  const { publicKey } = useWallet();
  const { getSessionToken } = useWalletAuth();

  return useMutation({
    mutationFn: async (referrerCode?: string) => {
      if (!publicKey) throw new Error('Wallet not connected');

      const sessionToken = await getSessionToken();
      if (!sessionToken) {
        throw new Error('Wallet verification required. Please sign the message to continue.');
      }

      const { data, error } = await getSupabaseClient().functions.invoke('secure-player', {
        body: { action: 'create', ...(referrerCode ? { referrerCode } : {}) },
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
      const orderColumn =
        sortBy === 'earnings' ? 'total_earnings' :
          sortBy === 'wins' ? 'total_wins' : 'current_streak';

      const { data, error } = await getSupabaseClient()
        .from('players')
        .select(LEADERBOARD_COLS)
        .order(orderColumn, { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as unknown as Player[];
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
        .select('wallet_address, username, avatar_url, total_wins, total_losses, lichess_username')
        .or(`username.ilike.%${searchQuery}%,wallet_address.ilike.%${searchQuery}%`)
        .limit(20);

      if (error) throw error;
      return data as unknown as Player[];
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
        .select(PUBLIC_PROFILE_COLS)
        .eq('wallet_address', walletAddress)
        .maybeSingle();

      if (error) throw error;
      return data as unknown as Player | null;
    },
    enabled: !!walletAddress,
  });
}

export function usePlayersByWallets(walletAddresses: string[]) {
  const stableKey = [...walletAddresses].sort().join(',');

  return useQuery({
    queryKey: ['players', 'byWallets', stableKey],
    queryFn: async () => {
      if (!walletAddresses.length) return [];

      const { data, error } = await getSupabaseClient()
        .from('players')
        .select(WAGER_CARD_COLS)
        .in('wallet_address', walletAddresses);

      if (error) throw error;
      return data as unknown as Player[];
    },
    enabled: walletAddresses.length > 0,
  });
}