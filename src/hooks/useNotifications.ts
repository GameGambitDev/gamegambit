import { useState, useEffect, useCallback, useRef } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { getSupabaseClient } from '@/integrations/supabase/client'

export interface AppNotification {
    id: string
    player_wallet: string
    type:
    | 'wager_joined'
    | 'wager_won'
    | 'wager_lost'
    | 'wager_draw'
    | 'wager_cancelled'
    | 'wager_disputed'
    | 'game_started'
    | 'rematch_challenge'
    | 'wager_vote'
    | 'chat_message'
    | 'wager_proposal'
    | 'moderation_request'
    | 'friend_request'
    | 'friend_accepted'
    | 'feed_reaction'
    | 'new_follower'
    title: string
    message: string
    wager_id: string | null
    actor_wallet: string | null
    read: boolean
    created_at: string
}

const PAGE_SIZE = 10

export function useNotifications() {
    const { publicKey } = useWallet()
    const wallet = publicKey?.toBase58()
    const [notifications, setNotifications] = useState<AppNotification[]>([])
    const [loading, setLoading] = useState(false)
    const [hasMore, setHasMore] = useState(false)
    const [loadingMore, setLoadingMore] = useState(false)
    const offsetRef = useRef(0)

    const fetchPage = useCallback(async (offset: number, append: boolean) => {
        if (!wallet) return
        const supabase = getSupabaseClient()
        if (offset === 0) setLoading(true)
        else setLoadingMore(true)

        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('player_wallet', wallet)
            .order('created_at', { ascending: false })
            .range(offset, offset + PAGE_SIZE - 1)

        if (error) console.error('[notifications] fetch error:', error)

        if (data) {
            setHasMore(data.length === PAGE_SIZE)
            if (append) {
                setNotifications(prev => [...prev, ...data as AppNotification[]])
            } else {
                setNotifications(data as AppNotification[])
            }
            offsetRef.current = offset + data.length
        }

        if (offset === 0) setLoading(false)
        else setLoadingMore(false)
    }, [wallet])

    // Initial fetch
    useEffect(() => {
        offsetRef.current = 0
        fetchPage(0, false)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [wallet])

    const loadMore = useCallback(() => {
        fetchPage(offsetRef.current, true)
    }, [fetchPage])

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
                    const n = payload.new as AppNotification
                    setNotifications(prev => [n, ...prev])
                    offsetRef.current += 1
                    if (typeof document !== 'undefined' && document.hidden) {
                        if ('Notification' in window && Notification.permission === 'granted') {
                            navigator.serviceWorker?.ready.then(reg => {
                                reg.showNotification(n.title, {
                                    body: n.message,
                                    icon: '/logo.png',
                                    badge: '/favicon.png',
                                    tag: n.id,
                                    data: { url: n.wager_id ? '/my-wagers' : '/' },
                                })
                            }).catch(() => { })
                        }
                    }
                }
            )
            .subscribe()
        return () => { supabase.removeChannel(channel) }
    }, [wallet])

    // NOTE: Push subscription is NOT auto-called here anymore.
    // It must be triggered by a real user gesture (the settings toggle).
    // Mobile browsers silently block Notification.requestPermission()
    // unless called directly from a tap/click handler.

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

    return {
        notifications,
        loading,
        loadingMore,
        hasMore,
        loadMore,
        unreadCount,
        markAllRead,
        markRead,
        refetch: () => fetchPage(0, false),
    }
}

// ── Web Push subscription ─────────────────────────────────────────────────────
// Exported so settings/page.tsx can call it directly from a user tap — required
// by mobile browsers to show the permission prompt.
export async function subscribeToPush(wallet: string): Promise<void> {
    try {
        if (typeof window === 'undefined') return
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
        if (Notification.permission === 'denied') return

        const reg = await navigator.serviceWorker.ready

        const existing = await reg.pushManager.getSubscription()
        if (existing) {
            await savePushSubscription(wallet, existing)
            return
        }

        if (Notification.permission !== 'granted') {
            const permission = await Notification.requestPermission()
            if (permission !== 'granted') return
        }

        const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim()
        if (!vapidPublicKey) {
            console.warn('[push] NEXT_PUBLIC_VAPID_PUBLIC_KEY not set')
            return
        }

        if (!/^[A-Za-z0-9\-_+=]+$/.test(vapidPublicKey)) {
            console.warn('[push] VAPID key contains invalid characters')
            return
        }

        const subscription = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        })

        await savePushSubscription(wallet, subscription)
        console.log('[push] subscribed successfully')
    } catch (err) {
        console.warn('[push] subscription failed:', err)
    }
}

async function savePushSubscription(wallet: string, subscription: PushSubscription): Promise<void> {
    try {
        const supabase = getSupabaseClient()
        const sub = subscription.toJSON()
        if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) return
        await supabase.from('push_subscriptions').upsert({
            player_wallet: wallet,
            endpoint: sub.endpoint,
            p256dh: sub.keys.p256dh,
            auth: sub.keys.auth,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'endpoint' })
    } catch (err) {
        console.warn('[push] failed to save subscription:', err)
    }
}

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
    const rawData = atob(base64)
    const arr = Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
    return arr.buffer.slice(arr.byteOffset, arr.byteOffset + arr.byteLength) as ArrayBuffer
}