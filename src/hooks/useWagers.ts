// src/hooks/useWagers.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { getSupabaseClient } from '@/integrations/supabase/client';
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

async function invokeSecureWager<T>(
  payload: Record<string, unknown>,
  sessionToken: string
): Promise<T> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const res = await fetch(`${supabaseUrl}/functions/v1/secure-wager`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseAnonKey}`,
      'X-Session-Token': sessionToken,
    },
    body: JSON.stringify(payload),
  });

  const json = await res.json().catch(() => ({ error: res.statusText }));
  if (!res.ok) throw new Error((json as { error?: string }).error || 'secure-wager request failed');
  return json as T;
}

// ─── READ QUERIES ─────────────────────────────────────────────────────────────

export function useWagers() {
  return useQuery({
    queryKey: ['wagers'],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('wagers')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Wager[];
    },
  });
}

export function useOpenWagers() {
  return useQuery({
    queryKey: ['wagers', 'open'],
    queryFn: async () => {
      const supabase = getSupabaseClient();
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

export function useLiveWagers() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const supabase = getSupabaseClient();
    const channel = supabase
      .channel('live-wagers-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'wagers',
        },
        (payload) => {
          const updated = payload.new as Wager;
          queryClient.setQueryData(['wagers', updated.id], updated);

          // If the wager just resolved, remove it from the live list immediately
          if (updated.status === 'resolved') {
            queryClient.setQueryData<Wager[]>(['wagers', 'live'], (old) =>
              old ? old.filter((w) => w.id !== updated.id) : old
            );
          } else {
            queryClient.invalidateQueries({ queryKey: ['wagers', 'live'] });
          }

          // Always refresh recent winners when something resolves
          if (updated.status === 'resolved') {
            queryClient.invalidateQueries({ queryKey: ['wagers', 'winners'] });
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return useQuery({
    queryKey: ['wagers', 'live'],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('wagers')
        .select('*')
        .in('status', ['joined', 'voting', 'disputed'])
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Wager[];
    },
    refetchInterval: 10000, // also tightened from 30s to 10s
  });
}

export function useMyWagers() {
  const { publicKey } = useWallet();
  const walletAddress = publicKey?.toBase58();

  return useQuery({
    queryKey: ['wagers', 'my', walletAddress],
    queryFn: async () => {
      const supabase = getSupabaseClient();
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

export function useRecentWagers(limit: number = 10) {
  return useQuery({
    queryKey: ['wagers', 'recent', limit],
    queryFn: async () => {
      const supabase = getSupabaseClient();
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

export function useRecentWinners(limit: number = 5) {
  return useQuery({
    queryKey: ['wagers', 'winners', limit],
    queryFn: async () => {
      const supabase = getSupabaseClient();
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

export function useWagerById(wagerId: string | null) {
  return useQuery({
    queryKey: ['wagers', wagerId],
    queryFn: async () => {
      const supabase = getSupabaseClient();
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
    refetchInterval: 2000,
  });
}

// ─── SECURE MUTATIONS ─────────────────────────────────────────────────────────

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
      const sessionToken = await getSessionToken();
      if (!sessionToken) throw new Error('Wallet verification required. Please sign the message to continue.');
      const data = await invokeSecureWager<{ wager: Wager }>({ action: 'create', ...wager }, sessionToken);
      return data.wager;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['wagers'] }); },
  });
}

export function useJoinWager() {
  const queryClient = useQueryClient();
  const { getSessionToken } = useWalletAuth();

  return useMutation({
    mutationFn: async ({ wagerId }: { wagerId: string; playerBWallet?: string }) => {
      const sessionToken = await getSessionToken();
      if (!sessionToken) throw new Error('Wallet verification required. Please sign the message to continue.');
      const data = await invokeSecureWager<{ wager: Wager }>({ action: 'join', wagerId }, sessionToken);
      return data.wager;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['wagers'] }); },
  });
}

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
      if (!sessionToken) throw new Error('Wallet verification required. Please sign the message to continue.');
      const data = await invokeSecureWager<{ wager: Wager }>({ action: 'vote', wagerId, votedWinner }, sessionToken);
      return data.wager;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['wagers'] }); },
  });
}

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
      if (!sessionToken) throw new Error('Wallet verification required.');
      const data = await invokeSecureWager<{ wager: Wager }>(
        { action: 'edit', wagerId, stake_lamports, lichess_game_id, stream_url, is_public },
        sessionToken
      );
      return data.wager;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['wagers'] }); },
  });
}

export function useDeleteWager() {
  const queryClient = useQueryClient();
  const { getSessionToken } = useWalletAuth();

  return useMutation({
    mutationFn: async ({ wagerId }: { wagerId: string }) => {
      const sessionToken = await getSessionToken();
      if (!sessionToken) throw new Error('Wallet verification required.');
      return invokeSecureWager<{ success: boolean }>({ action: 'delete', wagerId }, sessionToken);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['wagers'] }); },
  });
}

export function useSetReady() {
  const queryClient = useQueryClient();
  const { getSessionToken } = useWalletAuth();

  return useMutation({
    mutationFn: async ({ wagerId, ready }: { wagerId: string; ready: boolean }) => {
      const sessionToken = await getSessionToken();
      if (!sessionToken) throw new Error('Wallet verification required.');
      const data = await invokeSecureWager<{ wager: Wager }>({ action: 'setReady', wagerId, ready }, sessionToken);
      return data.wager;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['wagers'] }); },
  });
}

export function useStartGame() {
  const queryClient = useQueryClient();
  const { getSessionToken } = useWalletAuth();

  return useMutation({
    mutationFn: async ({ wagerId }: { wagerId: string }) => {
      const sessionToken = await getSessionToken();
      if (!sessionToken) throw new Error('Wallet verification required.');
      const data = await invokeSecureWager<{ wager: Wager }>({ action: 'startGame', wagerId }, sessionToken);
      return data.wager;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['wagers'] }); },
  });
}

export function useCheckGameComplete() {
  const queryClient = useQueryClient();
  const { getSessionToken } = useWalletAuth();

  return useMutation({
    mutationFn: async ({ wagerId }: { wagerId: string }) => {
      const sessionToken = await getSessionToken();
      if (!sessionToken) throw new Error('Wallet verification required.');
      return invokeSecureWager<{
        gameComplete: boolean;
        status?: string;
        winner?: string;
        winnerWallet?: string;
        resultType?: 'playerA' | 'playerB' | 'draw' | 'unknown';
        message?: string;
        wager?: Wager;
      }>({ action: 'checkGameComplete', wagerId }, sessionToken);
    },
    onSuccess: (data) => {
      if (data.gameComplete) {
        queryClient.invalidateQueries({ queryKey: ['wagers'] });
      }
    },
  });
}

export function useCancelWager() {
  const queryClient = useQueryClient();
  const { getSessionToken } = useWalletAuth();

  return useMutation({
    mutationFn: async ({ wagerId, reason }: { wagerId: string; reason?: string }) => {
      const sessionToken = await getSessionToken();
      if (!sessionToken) throw new Error('Wallet verification required.');
      const data = await invokeSecureWager<{ 
        wager: Wager; 
        message: string;
        refundInitiated: boolean;
      }>({ action: 'cancelWager', wagerId, reason }, sessionToken);
      return data;
    },
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ['wagers'] }); 
    },
  });
}
