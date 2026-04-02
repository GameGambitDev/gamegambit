'use client'

import {
    createContext, useContext, useEffect, useRef, useCallback,
    ReactNode, useState
} from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useQueryClient } from '@tanstack/react-query'
import { getSupabaseClient } from '@/integrations/supabase/client'
import type { Wager } from '@/hooks/useWagers'
import { useCheckGameComplete } from '@/hooks/useWagers'
import type { ModerationRequest } from '@/hooks/useModeration'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PendingResult {
    wager: Wager
    seenAt: number | null
}

interface GameEventContextValue {
    onWagerResolved: (cb: (wager: Wager) => void) => () => void
    pendingResults: PendingResult[]
    markResultSeen: (wagerId: string) => void
    clearPendingResult: (wagerId: string) => void
    // Moderation request popup
    activeModerationRequest: ModerationRequest | null
    clearModerationRequest: () => void
}

const GameEventContext = createContext<GameEventContextValue | null>(null)
const STORAGE_KEY = 'gg:pending_results'

// ─── Provider ─────────────────────────────────────────────────────────────────

export function GameEventProvider({ children }: { children: ReactNode }) {
    const { publicKey } = useWallet()
    const walletAddress = publicKey?.toBase58()
    const queryClient = useQueryClient()
    const listenersRef = useRef<Set<(wager: Wager) => void>>(new Set())

    // Stable ref so the polling effect never needlessly restarts
    const checkGameComplete = useCheckGameComplete()
    const checkRef = useRef(checkGameComplete)
    useEffect(() => { checkRef.current = checkGameComplete }, [checkGameComplete])
    const inFlightRef = useRef<Set<string>>(new Set())

    // ── Moderation request popup state ────────────────────────────────────────
    const [activeModerationRequest, setActiveModerationRequest] = useState<ModerationRequest | null>(null)

    // Persisted to sessionStorage so a hard refresh doesn't re-show a popup for
    // a pending request the user already saw (but didn't act on) in this tab session.
    const seenModerationRequestIds = useRef<Set<string>>(() => {
        if (typeof window === 'undefined') return new Set<string>()
        try {
            const stored = sessionStorage.getItem('gg:seen_mod_requests')
            return stored ? new Set<string>(JSON.parse(stored)) : new Set<string>()
        } catch {
            return new Set<string>()
        }
    })()

    const clearModerationRequest = useCallback(() => {
        setActiveModerationRequest(null)
    }, [])

    // ── Pending results (persisted to sessionStorage) ─────────────────────────
    const [pendingResults, setPendingResults] = useState<PendingResult[]>(() => {
        if (typeof window === 'undefined') return []
        try {
            const stored = sessionStorage.getItem(STORAGE_KEY)
            return stored ? JSON.parse(stored) : []
        } catch { return [] }
    })

    useEffect(() => {
        if (typeof window === 'undefined') return
        try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(pendingResults)) }
        catch { /* ignore quota errors */ }
    }, [pendingResults])

    const fireResolved = useCallback((wager: Wager) => {
        setPendingResults(prev => {
            if (prev.some(r => r.wager.id === wager.id)) return prev
            return [...prev, { wager, seenAt: null }]
        })
        listenersRef.current.forEach(cb => cb(wager))
    }, [])

    const onWagerResolved = useCallback((cb: (wager: Wager) => void) => {
        listenersRef.current.add(cb)
        return () => { listenersRef.current.delete(cb) }
    }, [])

    const markResultSeen = useCallback((wagerId: string) => {
        setPendingResults(prev =>
            prev.map(r => r.wager.id === wagerId ? { ...r, seenAt: Date.now() } : r)
        )
    }, [])

    const clearPendingResult = useCallback((wagerId: string) => {
        setPendingResults(prev => prev.filter(r => r.wager.id !== wagerId))
    }, [])

    // ── App-wide background polling for chess game completion ─────────────────
    // Lives here (not in ArenaPage) so it keeps working across page navigations.
    useEffect(() => {
        if (!walletAddress) return
        const supabase = getSupabaseClient()

        const poll = async () => {
            const { data, error } = await supabase
                .from('wagers')
                .select('id')
                .or(`player_a_wallet.eq.${walletAddress},player_b_wallet.eq.${walletAddress}`)
                .eq('game', 'chess')
                .in('status', ['voting', 'joined'])
                .not('lichess_game_id', 'is', null)

            if (error || !data || data.length === 0) return

            data.forEach(({ id: wagerId }: { id: string }) => {
                if (inFlightRef.current.has(wagerId)) return
                inFlightRef.current.add(wagerId)

                checkRef.current.mutate({ wagerId }, {
                    onSuccess: (result: any) => {
                        if (result?.gameComplete && result?.wager?.status === 'resolved') {
                            fireResolved(result.wager)
                        }
                        queryClient.invalidateQueries({ queryKey: ['wagers'] })
                    },
                    onSettled: () => {
                        inFlightRef.current.delete(wagerId)
                    },
                })
            })
        }

        const timeout = setTimeout(poll, 3_000)    // first check 3s after wallet connects
        const interval = setInterval(poll, 10_000) // then every 10s

        return () => {
            clearTimeout(timeout)
            clearInterval(interval)
        }
    }, [walletAddress, fireResolved, queryClient])

    // ── Realtime: moderation requests assigned to this wallet ─────────────────
    // When assign-moderator inserts a new row for this wallet, show the popup.
    useEffect(() => {
        if (!walletAddress) return
        const supabase = getSupabaseClient()

        const channel = supabase
            .channel(`moderation_requests:${walletAddress}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'moderation_requests',
                    filter: `moderator_wallet=eq.${walletAddress}`,
                },
                (payload) => {
                    const req = payload.new as ModerationRequest
                    // Only show if pending and not already seen in this session
                    if (req.status === 'pending' && !seenModerationRequestIds.current.has(req.id)) {
                        seenModerationRequestIds.current.add(req.id)
                        // Keep sessionStorage in sync so hard refresh doesn't re-show this request
                        try {
                            sessionStorage.setItem(
                                'gg:seen_mod_requests',
                                JSON.stringify([...seenModerationRequestIds.current])
                            )
                        } catch { /* ignore quota errors */ }
                        setActiveModerationRequest(req)
                    }
                },
            )
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [walletAddress])

    // ── Realtime: wager state changes ─────────────────────────────────────────
    // Two filtered channels (one per player slot) + one public INSERT channel.
    // Supabase Realtime doesn't support OR filters in a single subscription,
    // so we use separate channels to avoid loading the entire wagers table.
    useEffect(() => {
        if (!walletAddress) return
        const supabase = getSupabaseClient()

        const handleEvent = (payload: { eventType: string; new: unknown }) => {
            const updated = payload.new as Wager
            const isParticipant =
                updated.player_a_wallet === walletAddress ||
                updated.player_b_wallet === walletAddress

            // Always update open wager list for INSERTs
            if (payload.eventType === 'INSERT' && updated.status === 'created') {
                queryClient.setQueryData<Wager[]>(['wagers', 'open'], (old) => {
                    if (!old) return [updated]
                    if (old.some(w => w.id === updated.id)) return old
                    return [updated, ...old]
                })
            }

            if (!isParticipant) return

            // Update per-wager cache + my wagers list
            queryClient.setQueryData(['wagers', updated.id], updated)
            queryClient.setQueryData<Wager[]>(['wagers', 'my', walletAddress], (old) => {
                if (!old) return [updated]
                const idx = old.findIndex(w => w.id === updated.id)
                if (idx === -1) return [updated, ...old]
                const next = [...old]; next[idx] = updated; return next
            })

            if (updated.status === 'resolved' || updated.status === 'cancelled') {
                queryClient.setQueryData<Wager[]>(['wagers', 'live'], (old) =>
                    old ? old.filter(w => w.id !== updated.id) : old)
                queryClient.setQueryData<Wager[]>(['wagers', 'open'], (old) =>
                    old ? old.filter(w => w.id !== updated.id) : old)
                queryClient.invalidateQueries({ queryKey: ['wagers', 'winners'] })
                if (updated.status === 'resolved') fireResolved(updated)
            } else if (updated.status === 'joined') {
                queryClient.setQueryData<Wager[]>(['wagers', 'open'], (old) =>
                    old ? old.filter(w => w.id !== updated.id) : old)
                queryClient.setQueryData<Wager[]>(['wagers', 'live'], (old) => {
                    if (!old) return [updated]
                    const exists = old.some(w => w.id === updated.id)
                    return exists ? old.map(w => w.id === updated.id ? updated : w) : [updated, ...old]
                })
            } else {
                queryClient.setQueryData<Wager[]>(['wagers', 'live'], (old) => {
                    if (!old) return old
                    const idx = old.findIndex(w => w.id === updated.id)
                    if (idx === -1) return old
                    const next = [...old]; next[idx] = updated; return next
                })
            }
        }

        // Channel A: wagers where this wallet is player_a
        const channelA = supabase
            .channel(`game-events:player_a:${walletAddress}`)
            .on('postgres_changes', {
                event: '*', schema: 'public', table: 'wagers',
                filter: `player_a_wallet=eq.${walletAddress}`,
            }, handleEvent)
            .subscribe()

        // Channel B: wagers where this wallet is player_b
        const channelB = supabase
            .channel(`game-events:player_b:${walletAddress}`)
            .on('postgres_changes', {
                event: '*', schema: 'public', table: 'wagers',
                filter: `player_b_wallet=eq.${walletAddress}`,
            }, handleEvent)
            .subscribe()

        // Public INSERT channel — open wagers from any player, unfiltered
        // (needed so the arena list updates when others post wagers)
        const channelPublic = supabase
            .channel(`game-events:public`)
            .on('postgres_changes', {
                event: 'INSERT', schema: 'public', table: 'wagers',
            }, handleEvent)
            .subscribe()

        return () => {
            supabase.removeChannel(channelA)
            supabase.removeChannel(channelB)
            supabase.removeChannel(channelPublic)
        }
    }, [walletAddress, queryClient, fireResolved])

    return (
        <GameEventContext.Provider value={{
            onWagerResolved,
            pendingResults,
            markResultSeen,
            clearPendingResult,
            activeModerationRequest,
            clearModerationRequest,
        }}>
            {children}
        </GameEventContext.Provider>
    )
}

export function useGameEvents() {
    const ctx = useContext(GameEventContext)
    if (!ctx) throw new Error('useGameEvents must be used within GameEventProvider')
    return ctx
}