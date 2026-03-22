'use client'

import {
    createContext, useContext, useEffect, useRef, useCallback,
    ReactNode, useState
} from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useQueryClient } from '@tanstack/react-query'
import { getSupabaseClient } from '@/integrations/supabase/client'
import { useWalletAuth } from '@/hooks/useWalletAuth'
import type { Wager } from '@/hooks/useWagers'

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
}

const GameEventContext = createContext<GameEventContextValue | null>(null)
const STORAGE_KEY = 'gg:pending_results'

// ─── Provider ─────────────────────────────────────────────────────────────────

export function GameEventProvider({ children }: { children: ReactNode }) {
    const { publicKey } = useWallet()
    const walletAddress = publicKey?.toBase58()
    const queryClient = useQueryClient()
    const listenersRef = useRef<Set<(wager: Wager) => void>>(new Set())

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
        catch { /* ignore */ }
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

    useEffect(() => {
        if (!walletAddress) return
        const supabase = getSupabaseClient()

        const channel = supabase
            .channel(`game-events:${walletAddress}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'wagers' }, (payload) => {
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
            })
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [walletAddress, queryClient, fireResolved])

    // ── Poll Lichess for voting wagers ────────────────────────────────────────
    // GameEventContext Realtime only fires when the DB changes — but chess games
    // end on Lichess, not on-chain. Someone has to call checkGameComplete to
    // detect the result and update the DB. This polling loop does it automatically
    // every 8 seconds for any wager in 'voting' status that the user is in.
    const { getSessionToken } = useWalletAuth()
    const inFlightRef = useRef<Set<string>>(new Set())

    useEffect(() => {
        if (!walletAddress) return

        const checkVotingWagers = async () => {
            // Get voting wagers from cache
            const liveWagers = queryClient.getQueryData<Wager[]>(['wagers', 'live']) ?? []
            const votingWagers = liveWagers.filter(w =>
                w.status === 'voting' &&
                (w.player_a_wallet === walletAddress || w.player_b_wallet === walletAddress)
            )
            if (votingWagers.length === 0) return

            const sessionToken = await getSessionToken().catch(() => null)
            if (!sessionToken) return

            const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL)!
            const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!

            for (const wager of votingWagers) {
                if (inFlightRef.current.has(wager.id)) continue
                inFlightRef.current.add(wager.id)

                fetch(`${supabaseUrl}/functions/v1/secure-wager`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${supabaseAnonKey}`,
                        'X-Session-Token': sessionToken,
                    },
                    body: JSON.stringify({ action: 'checkGameComplete', wagerId: wager.id }),
                })
                    .then(r => r.json())
                    .then(result => {
                        if (result?.gameComplete && result?.wager?.status === 'resolved') {
                            // Realtime will pick this up — but also fire directly as backup
                            fireResolved(result.wager)
                        }
                    })
                    .catch(() => { })
                    .finally(() => inFlightRef.current.delete(wager.id))
            }
        }

        const interval = setInterval(checkVotingWagers, 8000)
        return () => clearInterval(interval)
    }, [walletAddress, queryClient, getSessionToken, fireResolved])

    return (
        <GameEventContext.Provider value={{ onWagerResolved, pendingResults, markResultSeen, clearPendingResult }}>
            {children}
        </GameEventContext.Provider>
    )
}

export function useGameEvents() {
    const ctx = useContext(GameEventContext)
    if (!ctx) throw new Error('useGameEvents must be used within GameEventProvider')
    return ctx
}