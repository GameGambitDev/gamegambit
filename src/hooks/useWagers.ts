// src/hooks/useWagers.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSupabaseClient } from '@/integrations/supabase/client';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletAuth } from './useWalletAuth';

export type WagerStatus = 'created' | 'joined' | 'voting' | 'retractable' | 'disputed' | 'resolved' | 'cancelled';
export type GameType = 'chess' | 'pubg' | 'codm' | 'free_fire';

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
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancel_reason: string | null;
  created_at: string;
  updated_at: string;
  ready_player_a: boolean | null;
  ready_player_b: boolean | null;
  countdown_started_at: string | null;
  // ── Step 3: Game Complete + Voting ────────────────────────────────────────
  game_complete_a: boolean | null;
  game_complete_b: boolean | null;
  game_complete_deadline: string | null;
  vote_a_at: string | null;
  vote_b_at: string | null;
  vote_deadline: string | null;
  dispute_created_at: string | null;
  // ── Step 4: Dispute Grace Period ──────────────────────────────────────────
  grace_conceded_by: string | null;
  grace_conceded_at: string | null;
  moderator_wallet: string | null;
  moderator_assigned_at: string | null;
  moderation_skipped_count: number | null;
}

export async function invokeSecureWager<T>(
  payload: Record<string, unknown>,
  sessionToken: string,
  timeoutMs = 25000
): Promise<T> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/secure-wager`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'X-Session-Token': sessionToken,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const json = await res.json().catch(() => ({ error: res.statusText }));

    if (!res.ok) {
      if (res.status === 401) {
        window.dispatchEvent(new CustomEvent('gg:session-expired'));
      }
      throw new Error((json as { error?: string }).error || 'secure-wager request failed');
    }

    return json as T;
  } finally {
    clearTimeout(timer);
  }
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
    // refetchInterval removed: GameEventContext Realtime keeps this cache key
    // up to date on every INSERT/UPDATE — polling is redundant load.
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('wagers')
        // Arena list view: only fields needed for the card display
        .select('id, match_id, player_a_wallet, player_b_wallet, game, stake_lamports, status, is_public, stream_url, created_at, updated_at')
        .eq('status', 'created')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Wager[];
    },
  });
}

// NOTE: The old useLiveWagers had its own Supabase Realtime subscription for
// UPDATE events. That has been REMOVED because GameEventContext now handles all
// realtime wager events (INSERT + UPDATE) and keeps the query cache up to date.
// Keeping a second subscription would cause double cache writes on every event.
export function useLiveWagers() {
  return useQuery({
    queryKey: ['wagers', 'live'],
    // refetchInterval removed: GameEventContext Realtime keeps this cache key
    // up to date on every status transition — polling is redundant load.
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('wagers')
        // Live feed card: same set as open wagers plus lichess_game_id for the stream link
        // game_complete_a/b/deadline are required by the arena recovery effect and
        // GameCompleteModal so they must be included here.
        .select('id, match_id, player_a_wallet, player_b_wallet, game, stake_lamports, status, is_public, stream_url, lichess_game_id, created_at, updated_at, game_complete_a, game_complete_b, game_complete_deadline')
        .in('status', ['joined', 'voting', 'disputed'])
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Wager[];
    },
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
        // Full row — My Wagers page renders WagerDetailsModal inline
        // Step 3 fields added: game_complete_a/b, game_complete_deadline,
        // vote_a/b_at, vote_deadline, dispute_created_at
        .select(`
          id, match_id, player_a_wallet, player_b_wallet, game,
          stake_lamports, lichess_game_id, status, requires_moderator,
          vote_player_a, vote_player_b, winner_wallet, is_public,
          stream_url, vote_timestamp, retract_deadline, resolved_at,
          cancelled_at, cancelled_by, cancel_reason, created_at, updated_at,
          ready_player_a, ready_player_b, countdown_started_at,
          game_complete_a, game_complete_b, game_complete_deadline,
          vote_a_at, vote_b_at, vote_deadline, dispute_created_at,
          grace_conceded_by, grace_conceded_at,
          moderator_wallet, moderator_assigned_at, moderation_skipped_count
        `)
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
        // Landing page live feed — minimal fields for the ticker
        .select('id, match_id, player_a_wallet, player_b_wallet, game, stake_lamports, status, created_at')
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
        // Winner banner: player wallets, game, stake, winner, resolution time
        .select('id, match_id, player_a_wallet, player_b_wallet, game, stake_lamports, winner_wallet, resolved_at, created_at')
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
    // refetchInterval removed: GameEventContext writes directly into
    // ['wagers', wagerId] on every Realtime event, making 2s polling
    // redundant — it was generating ~5 queries/second with 10 concurrent
    // users each having a modal open.
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

// NOTE: useCheckGameComplete is kept because LiveGameModal imports it as a
// manual fallback trigger. Automatic game-completion detection is handled
// server-side via the Lichess webhook — this hook is no longer called
// automatically by GameEventContext.
export function useCheckGameComplete() {
  const queryClient = useQueryClient();
  const { getSessionToken } = useWalletAuth();

  return useMutation({
    mutationFn: async ({ wagerId }: { wagerId: string }) => {
      const sessionToken = await getSessionToken();
      if (!sessionToken) throw new Error('Wallet verification required.');

      const result = await invokeSecureWager<{
        gameComplete: boolean;
        status?: string;
        winner?: string;
        winnerWallet?: string | null;
        resultType?: 'playerA' | 'playerB' | 'draw' | 'unknown';
        isDraw?: boolean;
        message?: string;
        wager?: Wager;
        txSignature?: string | null;
        explorerUrl?: string | null;
      }>({ action: 'checkGameComplete', wagerId }, sessionToken, 30000);

      if (result.gameComplete && result.wager?.status === 'resolved') {
        queryClient.setQueryData(['wagers', 'last-resolved'], result.wager);
      }

      return result;
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

// ─── STEP 3 MUTATIONS ─────────────────────────────────────────────────────────

// Called when a player clicks "Game Done" in GameCompleteModal.
// Sets their game_complete_a / game_complete_b flag on the server.
// When both players confirm, the server sets game_complete_deadline (10 s sync
// window) and vote_deadline (10 s + 5 min).
export function useMarkGameComplete() {
  const queryClient = useQueryClient();
  const { getSessionToken } = useWalletAuth();

  return useMutation({
    mutationFn: async ({ wagerId }: { wagerId: string }) => {
      const sessionToken = await getSessionToken();
      if (!sessionToken) throw new Error('Wallet verification required.');
      const data = await invokeSecureWager<{ wager: Wager }>(
        { action: 'markGameComplete', wagerId },
        sessionToken,
      );
      return data.wager;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['wagers'] }); },
  });
}

// Called when a player picks a winner in VotingModal (Step 3 flow).
// If both votes agree → server resolves the wager (on-chain payout / refund).
// If votes differ → server moves the wager to 'disputed'.
export function useSubmitGameVote() {
  const queryClient = useQueryClient();
  const { getSessionToken } = useWalletAuth();

  return useMutation({
    mutationFn: async ({
      wagerId,
      votedWinner,
    }: {
      wagerId: string;
      votedWinner: string; // player wallet or 'draw'
    }) => {
      const sessionToken = await getSessionToken();
      if (!sessionToken) throw new Error('Wallet verification required.');
      const data = await invokeSecureWager<{ wager: Wager }>(
        { action: 'submitVote', wagerId, votedWinner },
        sessionToken,
      );
      return data.wager;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['wagers'] }); },
  });
}

// Allows a player to clear their vote while the opponent has not yet voted.
// Once both players have voted the outcome is locked — retraction is rejected
// server-side with a 400.
export function useRetractVote() {
  const queryClient = useQueryClient();
  const { getSessionToken } = useWalletAuth();

  return useMutation({
    mutationFn: async ({ wagerId }: { wagerId: string }) => {
      const sessionToken = await getSessionToken();
      if (!sessionToken) throw new Error('Wallet verification required.');
      const data = await invokeSecureWager<{ wager: Wager }>(
        { action: 'retractVote', wagerId },
        sessionToken,
      );
      return data.wager;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['wagers'] }); },
  });
}
// Called by VotingModal after the 15s retractable window expires.
// Resolves the wager on-chain. Server guards against double-fire.
export function useFinalizeVote() {
  const queryClient = useQueryClient();
  const { getSessionToken } = useWalletAuth();

  return useMutation({
    mutationFn: async ({ wagerId }: { wagerId: string }) => {
      const sessionToken = await getSessionToken();
      if (!sessionToken) throw new Error('Wallet verification required.');
      const data = await invokeSecureWager<{ wager: Wager }>(
        { action: 'finalizeVote', wagerId },
        sessionToken,
        30_000,
      );
      return data.wager;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['wagers'] }); },
  });
}