// src/hooks/useFollows.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { getSupabaseClient } from '@/integrations/supabase/client'
import { useWallet } from '@solana/wallet-adapter-react'

// ── useFollows ────────────────────────────────────────────────────────────────
// Asymmetric follow graph — follow anyone without mutual approval.
// Separate from the mutual friends system (useFriends) which handles DMs +
// challenge invites. Follows power the feed "Friends & Following" tab.

export function useFollows() {
    const { publicKey } = useWallet()
    const myWallet = publicKey?.toBase58() ?? null
    const queryClient = useQueryClient()
    const supabase = getSupabaseClient()

    // ── Who I follow ─────────────────────────────────────────────────────────
    const { data: followingList = [] } = useQuery({
        queryKey: ['follows_following', myWallet],
        enabled: !!myWallet,
        staleTime: 30_000,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('follows')
                .select('following_wallet')
                .eq('follower_wallet', myWallet!)
            if (error) throw error
            return (data ?? []).map(r => r.following_wallet) as string[]
        },
    })

    // ── Who follows me ────────────────────────────────────────────────────────
    const { data: followersList = [] } = useQuery({
        queryKey: ['follows_followers', myWallet],
        enabled: !!myWallet,
        staleTime: 30_000,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('follows')
                .select('follower_wallet')
                .eq('following_wallet', myWallet!)
            if (error) throw error
            return (data ?? []).map(r => r.follower_wallet) as string[]
        },
    })

    // ── Follower/following counts for ANY wallet (for profile pages) ──────────
    function useFollowCounts(wallet: string | null) {
        const followersQuery = useQuery({
            queryKey: ['follow_count_followers', wallet],
            enabled: !!wallet,
            staleTime: 60_000,
            queryFn: async () => {
                const { count, error } = await supabase
                    .from('follows')
                    .select('id', { count: 'exact', head: true })
                    .eq('following_wallet', wallet!)
                if (error) throw error
                return count ?? 0
            },
        })
        const followingQuery = useQuery({
            queryKey: ['follow_count_following', wallet],
            enabled: !!wallet,
            staleTime: 60_000,
            queryFn: async () => {
                const { count, error } = await supabase
                    .from('follows')
                    .select('id', { count: 'exact', head: true })
                    .eq('follower_wallet', wallet!)
                if (error) throw error
                return count ?? 0
            },
        })
        return {
            followers: followersQuery.data ?? 0,
            following: followingQuery.data ?? 0,
        }
    }

    // ── isFollowing (fast local check against my following list) ─────────────
    function isFollowing(targetWallet: string): boolean {
        if (!myWallet || targetWallet === myWallet) return false
        return followingList.includes(targetWallet)
    }

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ['follows_following', myWallet] })
        queryClient.invalidateQueries({ queryKey: ['follows_followers', myWallet] })
        queryClient.invalidateQueries({ queryKey: ['follow_count_followers'] })
        queryClient.invalidateQueries({ queryKey: ['follow_count_following'] })
    }

    // ── Follow ────────────────────────────────────────────────────────────────
    const follow = useMutation({
        mutationFn: async (targetWallet: string) => {
            if (!myWallet) throw new Error('Wallet not connected')
            const { error } = await supabase
                .from('follows')
                .insert({ follower_wallet: myWallet, following_wallet: targetWallet })
            if (error) throw error
            // Notify the person being followed — actor_wallet = who followed them
            await supabase.from('notifications').insert({
                player_wallet: targetWallet,
                type: 'new_follower',
                title: 'New Follower',
                message: 'Someone started following you.',
                actor_wallet: myWallet,
            })
        },
        onSuccess: invalidate,
    })

    // ── Unfollow ──────────────────────────────────────────────────────────────
    const unfollow = useMutation({
        mutationFn: async (targetWallet: string) => {
            if (!myWallet) throw new Error('Wallet not connected')
            const { error } = await supabase
                .from('follows')
                .delete()
                .eq('follower_wallet', myWallet)
                .eq('following_wallet', targetWallet)
            if (error) throw error
        },
        onSuccess: invalidate,
    })

    // ── Realtime — update following list when I follow/unfollow ──────────────
    useEffect(() => {
        if (!myWallet) return
        const channel = supabase
            .channel(`follows:${myWallet}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'follows',
                    filter: `follower_wallet=eq.${myWallet}`,
                },
                () => invalidate(),
            )
            .subscribe()
        return () => { supabase.removeChannel(channel) }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [myWallet])

    return {
        followingList,
        followersList,
        isFollowing,
        follow,
        unfollow,
        useFollowCounts,
    }
}