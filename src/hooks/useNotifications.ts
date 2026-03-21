import { useState, useEffect, useCallback } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { getSupabaseClient } from '@/integrations/supabase/client'

export interface AppNotification {
    id: string
    player_wallet: string
    type: 'wager_joined' | 'wager_won' | 'wager_lost' | 'wager_draw' | 'wager_cancelled' | 'game_started'
    title: string
    message: string
    wager_id: string | null
    read: boolean
    created_at: string
}

export function useNotifications() {
    const { publicKey } = useWallet()
    const wallet = publicKey?.toBase58()
    const [notifications, setNotifications] = useState<AppNotification[]>([])
    const [loading, setLoading] = useState(false)

    const fetch = useCallback(async () => {
        if (!wallet) return
        const supabase = getSupabaseClient()
        setLoading(true)
        const { data } = await supabase
            .from('notifications')
            .select('*')
            .eq('player_wallet', wallet)
            .order('created_at', { ascending: false })
            .limit(30)
        if (data) setNotifications(data as AppNotification[])
        setLoading(false)
    }, [wallet])

    useEffect(() => {
        fetch()
    }, [fetch])

    // Realtime — new notifications slide in instantly
    useEffect(() => {
        if (!wallet) return
        const supabase = getSupabaseClient()
        const channel = supabase
            .channel(`notifications:${wallet}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `player_wallet=eq.${wallet}`,
                },
                (payload) => {
                    setNotifications(prev => [payload.new as AppNotification, ...prev])
                }
            )
            .subscribe()
        return () => { supabase.removeChannel(channel) }
    }, [wallet])

    const markAllRead = useCallback(async () => {
        if (!wallet) return
        const supabase = getSupabaseClient()
        await supabase
            .from('notifications')
            .update({ read: true })
            .eq('player_wallet', wallet)
            .eq('read', false)
        setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    }, [wallet])

    const markRead = useCallback(async (id: string) => {
        const supabase = getSupabaseClient()
        await supabase.from('notifications').update({ read: true }).eq('id', id)
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    }, [])

    const unreadCount = notifications.filter(n => !n.read).length

    return { notifications, loading, unreadCount, markAllRead, markRead, refetch: fetch }
}