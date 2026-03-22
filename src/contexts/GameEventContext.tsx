'use client'

import {
    createContext, useContext, useEffect, useRef, useCallback,
    ReactNode, useState
} from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useQueryClient } from '@tanstack/react-query'
import { getSupabaseClient } from '@/integrations/supabase/client'
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