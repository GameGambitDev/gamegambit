"use client";
import { useState, useCallback, useEffect } from 'react';
import { getAllWagers, getAllDisputedWagers, getWagerDetails } from '@/integrations/supabase/admin/actions';

export interface AdminWager {
    id: string;
    match_id: number;
    player_a_wallet: string;
    player_b_wallet: string | null;
    stake_lamports: number;
    game: string;
    status: string;
    created_at: string;
    updated_at: string;
    winner_wallet: string | null;
    resolved_at: string | null;
    transaction_hash?: string;
}

export function useAdminWagers() {
    const [wagers, setWagers] = useState<AdminWager[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [total, setTotal] = useState(0);
    const [offset, setOffset] = useState(0);

    const limit = 50;

    const fetchWagers = useCallback(async (pageOffset = 0, status?: string) => {
        setLoading(true);
        setError(null);
        try {
            const result = await getAllWagers(status, limit, pageOffset);
            setWagers(result.data || []);
            setTotal(result.total);
            setOffset(pageOffset);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch wagers');
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchWagerDetails = useCallback(async (wagerId: string) => {
        setLoading(true);
        setError(null);
        try {
            const wager = await getWagerDetails(wagerId);
            return wager;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to fetch wager';
            setError(message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const nextPage = useCallback(() => {
        fetchWagers(offset + limit);
    }, [offset, limit, fetchWagers]);

    const prevPage = useCallback(() => {
        if (offset >= limit) {
            fetchWagers(offset - limit);
        }
    }, [offset, limit, fetchWagers]);

    const refreshWagers = useCallback(() => {
        fetchWagers(0);
    }, [fetchWagers]);

    useEffect(() => {
        fetchWagers(0);
    }, [fetchWagers]);

    return {
        wagers,
        loading,
        error,
        total,
        offset,
        limit,
        fetchWagers,
        fetchWagerDetails,
        nextPage,
        prevPage,
        refreshWagers,
        hasNextPage: offset + limit < total,
        hasPrevPage: offset > 0,
    };
}

export function useAdminDisputes() {
    const [disputes, setDisputes] = useState<AdminWager[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [total, setTotal] = useState(0);
    const [offset, setOffset] = useState(0);

    const limit = 50;

    const fetchDisputes = useCallback(async (pageOffset = 0) => {
        setLoading(true);
        setError(null);
        try {
            const result = await getAllDisputedWagers(limit, pageOffset);
            setDisputes(result.data || []);
            setTotal(result.total);
            setOffset(pageOffset);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch disputes');
        } finally {
            setLoading(false);
        }
    }, []);

    const nextPage = useCallback(() => {
        fetchDisputes(offset + limit);
    }, [offset, limit, fetchDisputes]);

    const prevPage = useCallback(() => {
        if (offset >= limit) {
            fetchDisputes(offset - limit);
        }
    }, [offset, limit, fetchDisputes]);

    const refreshDisputes = useCallback(() => {
        fetchDisputes(0);
    }, [fetchDisputes]);

    useEffect(() => {
        fetchDisputes(0);
    }, [fetchDisputes]);

    return {
        disputes,
        loading,
        error,
        total,
        offset,
        limit,
        fetchDisputes,
        nextPage,
        prevPage,
        refreshDisputes,
        hasNextPage: offset + limit < total,
        hasPrevPage: offset > 0,
    };
}