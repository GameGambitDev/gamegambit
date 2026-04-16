"use client";
import { useState, useCallback, useEffect } from 'react';
import { getAllWagers, getAllDisputedWagers, getWagerDetails, getStuckWagers } from '@/integrations/supabase/admin/actions';

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
// ── PAGE_SIZE options exposed to the UI ──────────────────────────────────────
export const STUCK_PAGE_SIZE_OPTIONS = [5, 10, 25, 50] as const;
export type StuckPageSize = typeof STUCK_PAGE_SIZE_OPTIONS[number];

// ── THRESHOLD options (hours) ────────────────────────────────────────────────
export const STUCK_THRESHOLD_OPTIONS: { label: string; hours: number }[] = [
    { label: '1 hour', hours: 1 },
    { label: '2 hours', hours: 2 },
    { label: '6 hours', hours: 6 },
    { label: '12 hours', hours: 12 },
    { label: '24 hours', hours: 24 },
    { label: '3 days', hours: 72 },
    { label: '7 days', hours: 168 },
    { label: '30 days', hours: 720 },
];

export function useStuckWagers(
    initialPageSize: StuckPageSize = 10,
    initialThresholdHours = 2
) {
    const [wagers, setWagers] = useState<AdminWager[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [total, setTotal] = useState(0);
    const [offset, setOffset] = useState(0);
    const [pageSize, setPageSize] = useState<StuckPageSize>(initialPageSize);
    const [thresholdHours, setThresholdHours] = useState(initialThresholdHours);

    const fetch = useCallback(
        async (pageOffset = 0, size = pageSize, threshold = thresholdHours) => {
            setLoading(true);
            setError(null);
            try {
                const result = await getStuckWagers(size, pageOffset, threshold);
                setWagers(result.data as AdminWager[]);
                setTotal(result.total);
                setOffset(pageOffset);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to fetch stuck wagers');
            } finally {
                setLoading(false);
            }
        },
        [pageSize, thresholdHours]
    );

    // Re-fetch whenever pageSize or threshold changes
    useEffect(() => { fetch(0, pageSize, thresholdHours); }, [pageSize, thresholdHours]); // eslint-disable-line react-hooks/exhaustive-deps

    const nextPage = useCallback(() => {
        if (offset + pageSize < total) fetch(offset + pageSize);
    }, [offset, pageSize, total, fetch]);

    const prevPage = useCallback(() => {
        if (offset >= pageSize) fetch(offset - pageSize);
    }, [offset, pageSize, fetch]);

    const refresh = useCallback(() => fetch(0), [fetch]);

    const changePageSize = useCallback((size: StuckPageSize) => {
        setPageSize(size);
        setOffset(0);
        // useEffect above will re-fetch
    }, []);

    const changeThreshold = useCallback((hours: number) => {
        setThresholdHours(hours);
        setOffset(0);
        // useEffect above will re-fetch
    }, []);

    const currentPage = Math.floor(offset / pageSize) + 1;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return {
        wagers, loading, error,
        total, offset, pageSize, thresholdHours,
        currentPage, totalPages,
        hasNextPage: offset + pageSize < total,
        hasPrevPage: offset > 0,
        nextPage, prevPage, refresh,
        changePageSize, changeThreshold,
    };
}