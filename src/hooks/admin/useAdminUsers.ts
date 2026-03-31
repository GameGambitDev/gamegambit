import { useState, useCallback, useEffect } from 'react';
import { getAllUsers, getUserDetails } from '@/integrations/supabase/admin/actions';

export interface AdminUser {
    id: string;
    wallet_address: string;
    username: string;
    is_banned: boolean;
    ban_reason: string;
    is_flagged: boolean;
    flag_reason: string;
    total_wins: number;
    total_losses: number;
    total_earnings: number;
    total_wagered: number;
    created_at: string;
    updated_at: string;
}

export function useAdminUsers() {
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [total, setTotal] = useState(0);
    const [offset, setOffset] = useState(0);

    const limit = 50;

    const fetchUsers = useCallback(async (pageOffset = 0, search?: string) => {
        setLoading(true);
        setError(null);
        try {
            const result = await getAllUsers(limit, pageOffset, search);
            setUsers(result.data || []);
            setTotal(result.total);
            setOffset(pageOffset);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch users');
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchUserDetails = useCallback(async (walletAddress: string) => {
        setLoading(true);
        setError(null);
        try {
            const user = await getUserDetails(walletAddress);
            return user;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to fetch user';
            setError(message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const nextPage = useCallback(() => {
        fetchUsers(offset + limit);
    }, [offset, limit, fetchUsers]);

    const prevPage = useCallback(() => {
        if (offset >= limit) {
            fetchUsers(offset - limit);
        }
    }, [offset, limit, fetchUsers]);

    useEffect(() => {
        fetchUsers(0);
    }, [fetchUsers]);

    return {
        users,
        loading,
        error,
        total,
        offset,
        limit,
        fetchUsers,
        fetchUserDetails,
        nextPage,
        prevPage,
        hasNextPage: offset + limit < total,
        hasPrevPage: offset > 0,
    };
}