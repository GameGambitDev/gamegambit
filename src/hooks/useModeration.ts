// src/hooks/useModeration.ts
//
// All moderation-related queries and mutations.
//
// Exports:
//   useActiveModerationRequest  — polls for a pending/accepted request assigned to this wallet
//   useAcceptModeration         — POST /api/moderation/accept
//   useDeclineModeration        — POST /api/moderation/decline
//   useSubmitVerdict            — POST /api/moderation/verdict
//   useModerationWager          — fetches wager + player names for an active moderation request

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletAuth } from '@/hooks/useWalletAuth';
import { getSupabaseClient } from '@/integrations/supabase/client';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ModerationRequest {
    id: string;
    wager_id: string;
    moderator_wallet: string;
    status: 'pending' | 'accepted' | 'declined' | 'completed' | 'timed_out' | 'escalated';
    request_type: string;
    deadline: string;
    decision_deadline: string | null;
    assigned_at: string;
    responded_at: string | null;
    decided_at: string | null;
    decision: string | null;
    decision_notes: string | null;
}

export interface ModerationWager {
    id: string;
    game: string;
    stake_lamports: number;
    player_a_wallet: string;
    player_b_wallet: string | null;
    vote_player_a: string | null;
    vote_player_b: string | null;
    stream_url: string | null;
    match_id: number;
    dispute_created_at: string | null;
    status: string;
}

// ── useActiveModerationRequest ────────────────────────────────────────────────
//
// Returns the most recent pending or accepted moderation_request for this wallet.
// Polls every 5s so the 30s popup window is reliably caught.

export function useActiveModerationRequest() {
    const { publicKey } = useWallet();
    const wallet = publicKey?.toBase58();

    return useQuery<ModerationRequest | null>({
        queryKey: ['moderation_request', 'active', wallet],
        queryFn: async () => {
            if (!wallet) return null;
            const supabase = getSupabaseClient();
            const { data, error } = await supabase
                .from('moderation_requests')
                .select('*')
                .eq('moderator_wallet', wallet)
                .in('status', ['pending', 'accepted'])
                .order('assigned_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (error) {
                console.error('[useActiveModerationRequest] error:', error.message);
                return null;
            }
            return data as ModerationRequest | null;
        },
        enabled: !!wallet,
        refetchInterval: 5_000,
        staleTime: 4_000,
    });
}

// ── useModerationWager ────────────────────────────────────────────────────────

export function useModerationWager(wagerId: string | null | undefined) {
    return useQuery<ModerationWager | null>({
        queryKey: ['wager', 'moderation', wagerId],
        queryFn: async () => {
            if (!wagerId) return null;
            const supabase = getSupabaseClient();
            const { data, error } = await supabase
                .from('wagers')
                .select('id, game, stake_lamports, player_a_wallet, player_b_wallet, vote_player_a, vote_player_b, stream_url, match_id, dispute_created_at, status')
                .eq('id', wagerId)
                .single();
            if (error) return null;
            return data as ModerationWager;
        },
        enabled: !!wagerId,
        staleTime: 10_000,
    });
}

// ── usePlayerDisplayNames ─────────────────────────────────────────────────────

export function usePlayerDisplayNames(wallets: (string | null | undefined)[]) {
    const validWallets = wallets.filter(Boolean) as string[];
    return useQuery<Record<string, string>>({
        queryKey: ['player_names', ...validWallets],
        queryFn: async () => {
            if (validWallets.length === 0) return {};
            const supabase = getSupabaseClient();
            const { data } = await supabase
                .from('players')
                .select('wallet_address, username')
                .in('wallet_address', validWallets);
            const map: Record<string, string> = {};
            for (const w of validWallets) {
                const player = data?.find((p: { wallet_address: string; username: string | null }) => p.wallet_address === w);
                map[w] = player?.username ?? (w.slice(0, 4) + '...' + w.slice(-4));
            }
            return map;
        },
        enabled: validWallets.length > 0,
        staleTime: 30_000,
    });
}

// ── useAcceptModeration ───────────────────────────────────────────────────────

export function useAcceptModeration() {
    const { getSessionToken } = useWalletAuth();
    const queryClient = useQueryClient();
    const { publicKey } = useWallet();
    const wallet = publicKey?.toBase58();

    return useMutation({
        mutationFn: async ({ requestId }: { requestId: string }) => {
            const sessionToken = await getSessionToken();
            if (!sessionToken) throw new Error('Wallet verification required');

            const res = await fetch('/api/moderation/accept', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Session-Token': sessionToken },
                body: JSON.stringify({ requestId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? 'Failed to accept');
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['moderation_request', 'active', wallet] });
        },
    });
}

// ── useDeclineModeration ──────────────────────────────────────────────────────

export function useDeclineModeration() {
    const { getSessionToken } = useWalletAuth();
    const queryClient = useQueryClient();
    const { publicKey } = useWallet();
    const wallet = publicKey?.toBase58();

    return useMutation({
        mutationFn: async ({ requestId }: { requestId: string }) => {
            const sessionToken = await getSessionToken();
            if (!sessionToken) throw new Error('Wallet verification required');

            const res = await fetch('/api/moderation/decline', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Session-Token': sessionToken },
                body: JSON.stringify({ requestId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? 'Failed to decline');
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['moderation_request', 'active', wallet] });
        },
    });
}

// ── useSubmitVerdict ──────────────────────────────────────────────────────────

export function useSubmitVerdict() {
    const { getSessionToken } = useWalletAuth();
    const queryClient = useQueryClient();
    const { publicKey } = useWallet();
    const wallet = publicKey?.toBase58();

    return useMutation({
        mutationFn: async ({
            requestId,
            verdict,
            notes,
        }: {
            requestId: string;
            verdict: string; // player wallet | 'draw' | 'cannot_determine'
            notes?: string;
        }) => {
            const sessionToken = await getSessionToken();
            if (!sessionToken) throw new Error('Wallet verification required');

            const res = await fetch('/api/moderation/verdict', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Session-Token': sessionToken },
                body: JSON.stringify({ requestId, verdict, notes }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? 'Failed to submit verdict');
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['moderation_request', 'active', wallet] });
            queryClient.invalidateQueries({ queryKey: ['wagers'] });
        },
    });
}