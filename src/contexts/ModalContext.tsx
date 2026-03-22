'use client'

import { createContext, useContext, useCallback, useState, ReactNode } from 'react'
import type { Wager } from '@/hooks/useWagers'

// ─── Modal types & priorities ─────────────────────────────────────────────────

export type ModalType =
    | 'game-result'   // priority 5 — highest
    | 'ready-room'    // priority 4
    | 'live-game'     // priority 3
    | 'details'       // priority 2
    | 'edit'          // priority 1
    | 'create'        // priority 0

const PRIORITY: Record<ModalType, number> = {
    'game-result': 5,
    'ready-room': 4,
    'live-game': 3,
    'details': 2,
    'edit': 1,
    'create': 0,
}

// ─── Payloads ─────────────────────────────────────────────────────────────────

export interface GameResultPayload {
    wager: Wager
    walletAddress: string
}

export interface WagerPayload {
    wager: Wager
}

export interface WagerIdPayload {
    wagerId: string
}

export type ModalPayload =
    | { type: 'game-result'; data: GameResultPayload }
    | { type: 'ready-room'; data: WagerIdPayload }
    | { type: 'live-game'; data: WagerIdPayload }
    | { type: 'details'; data: WagerPayload }
    | { type: 'edit'; data: WagerPayload }
    | { type: 'create'; data: Record<string, never> }

// Map from modal type to its payload data type — avoids the conditional type
// intersection problem that TypeScript struggles with on discriminated unions.
export type ModalDataMap = {
    'game-result': GameResultPayload
    'ready-room': WagerIdPayload
    'live-game': WagerIdPayload
    'details': WagerPayload
    'edit': WagerPayload
    'create': Record<string, never>
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface ModalContextValue {
    activeModal: ModalPayload | null
    openModal: (modal: ModalPayload) => void
    closeModal: (type?: ModalType) => void
    closeAll: () => void
    isOpen: (type: ModalType) => boolean
    getPayload: <T extends ModalType>(type: T) => ModalDataMap[T] | null
}

const ModalContext = createContext<ModalContextValue | null>(null)

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ModalProvider({ children }: { children: ReactNode }) {
    const [activeModal, setActiveModal] = useState<ModalPayload | null>(null)

    const openModal = useCallback((modal: ModalPayload) => {
        setActiveModal(prev => {
            if (!prev) return modal
            if (PRIORITY[modal.type] >= PRIORITY[prev.type]) return modal
            return prev
        })
    }, [])

    const closeModal = useCallback((type?: ModalType) => {
        setActiveModal(prev => {
            if (!prev) return null
            if (!type || prev.type === type) return null
            return prev
        })
    }, [])

    const closeAll = useCallback(() => setActiveModal(null), [])

    const isOpen = useCallback((type: ModalType) => {
        return activeModal?.type === type
    }, [activeModal])

    const getPayload = useCallback(<T extends ModalType>(type: T): ModalDataMap[T] | null => {
        if (activeModal?.type !== type) return null
        return (activeModal.data as ModalDataMap[T])
    }, [activeModal])

    return (
        <ModalContext.Provider value={{ activeModal, openModal, closeModal, closeAll, isOpen, getPayload }}>
            {children}
        </ModalContext.Provider>
    )
}

export function useModal() {
    const ctx = useContext(ModalContext)
    if (!ctx) throw new Error('useModal must be used within ModalProvider')
    return ctx
}