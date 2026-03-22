'use client'

import { createContext, useContext, useCallback, ReactNode } from 'react'

interface BalanceChange {
    delta: number  // positive = win, negative = loss (in lamports)
    wagerId: string
    type: 'win' | 'lose' | 'draw'
}

interface BalanceAnimationContextValue {
    queueAnimation: (change: BalanceChange) => void
    consumeAnimation: () => BalanceChange | null
    hasAnimation: () => boolean
}

const BalanceAnimationContext = createContext<BalanceAnimationContextValue | null>(null)
const STORAGE_KEY = 'gg:balance_anim'

export function BalanceAnimationProvider({ children }: { children: ReactNode }) {
    const queueAnimation = useCallback((change: BalanceChange) => {
        try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(change))
        } catch { /* ignore */ }
    }, [])

    const consumeAnimation = useCallback((): BalanceChange | null => {
        try {
            const stored = sessionStorage.getItem(STORAGE_KEY)
            if (!stored) return null
            sessionStorage.removeItem(STORAGE_KEY)
            return JSON.parse(stored)
        } catch { return null }
    }, [])

    const hasAnimation = useCallback((): boolean => {
        try { return !!sessionStorage.getItem(STORAGE_KEY) }
        catch { return false }
    }, [])

    return (
        <BalanceAnimationContext.Provider value={{ queueAnimation, consumeAnimation, hasAnimation }}>
            {children}
        </BalanceAnimationContext.Provider>
    )
}

export function useBalanceAnimation() {
    const ctx = useContext(BalanceAnimationContext)
    if (!ctx) throw new Error('useBalanceAnimation must be used within BalanceAnimationProvider')
    return ctx
}