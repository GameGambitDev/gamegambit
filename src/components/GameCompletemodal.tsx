'use client'

/**
 * GameCompleteModal.tsx
 *
 * Shown when a non-chess wager is in 'voting' status.
 * Step 1: Player marks their game as done.
 * Step 2: Both confirmed → shared 10s countdown → VotingModal opens.
 *
 * Uses Realtime via the parent wager object (kept alive by GameEventContext)
 * so no second Supabase subscription is needed here.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { motion, AnimatePresence } from 'framer-motion'
import {
    CheckCircle2, Clock, Loader2, Swords, Shield, Hourglass,
} from 'lucide-react'
import { Wager } from '@/hooks/useWagers'
import { useMarkGameComplete } from '@/hooks/useGameComplete'
import { GAMES, formatSol } from '@/lib/constants'
import { PlayerLink } from '@/components/PlayerLink'
import { usePlayerByWallet } from '@/hooks/usePlayer'
import { toast } from 'sonner'

// ─── Types ────────────────────────────────────────────────────────────────────

interface GameCompleteModalProps {
    wager: Wager | null
    open: boolean
    onOpenChange: (open: boolean) => void
    currentWallet: string
    /** Called when the 10-second sync countdown finishes — parent opens VotingModal */
    onBothConfirmed: () => void
}

const SYNC_COUNTDOWN = 10

const getGameData = (game: string) => {
    switch (game) {
        case 'codm': return GAMES.CODM
        case 'pubg': return GAMES.PUBG
        case 'free_fire': return GAMES.FREE_FIRE
        default: return GAMES.CHESS
    }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function GameCompleteModal({
    wager,
    open,
    onOpenChange,
    currentWallet,
    onBothConfirmed,
}: GameCompleteModalProps) {
    const { data: playerA } = usePlayerByWallet(wager?.player_a_wallet ?? null)
    const { data: playerB } = usePlayerByWallet(wager?.player_b_wallet ?? null)

    const markComplete = useMarkGameComplete()
    const [countdown, setCountdown] = useState<number | null>(null)
    // Local flag so the button stays disabled even if the cache hasn't updated yet
    const [localConfirmed, setLocalConfirmed] = useState(false)
    const onBothConfirmedRef = useRef(onBothConfirmed)
    useEffect(() => { onBothConfirmedRef.current = onBothConfirmed }, [onBothConfirmed])

    // Reset local state when wager changes (new modal open)
    useEffect(() => {
        if (open) setLocalConfirmed(false)
    }, [open, wager?.id])

    const isPlayerA = currentWallet === wager?.player_a_wallet
    const isPlayerB = currentWallet === wager?.player_b_wallet

    const myConfirmed = wager
        ? isPlayerA
            ? !!(wager as any).game_complete_a
            : !!(wager as any).game_complete_b
        : false

    const opponentConfirmed = wager
        ? isPlayerA
            ? !!(wager as any).game_complete_b
            : !!(wager as any).game_complete_a
        : false

    const bothConfirmed = myConfirmed && opponentConfirmed
    const otherPlayer = isPlayerA ? playerB : playerA

    // ── Sync countdown once both players confirmed ────────────────────────────
    useEffect(() => {
        if (!bothConfirmed) { setCountdown(null); return }

        // Use server timestamp if available, else start from now
        const startedAt = (wager as any)?.game_complete_deadline
            ? new Date((wager as any).game_complete_deadline).getTime() - SYNC_COUNTDOWN * 1000
            : Date.now()

        const tick = () => {
            const elapsed = Math.floor((Date.now() - startedAt) / 1000)
            const remaining = SYNC_COUNTDOWN - elapsed
            setCountdown(remaining <= 0 ? 0 : remaining)
        }
        tick()
        const id = setInterval(tick, 200)
        return () => clearInterval(id)
    }, [bothConfirmed, wager])

    // ── When countdown hits 0, notify parent ─────────────────────────────────
    const firedRef = useRef(false)
    useEffect(() => {
        if (countdown !== 0) return
        if (firedRef.current) return
        firedRef.current = true
        onBothConfirmedRef.current()
    }, [countdown])

    // Reset fired ref when modal opens fresh
    useEffect(() => {
        if (open) firedRef.current = false
    }, [open])

    const handleMarkComplete = useCallback(async () => {
        if (!wager) return
        try {
            await markComplete.mutateAsync({ wagerId: wager.id })
            setLocalConfirmed(true)
            toast.success('Game marked complete — waiting for opponent')
        } catch (err: any) {
            toast.error(err.message || 'Failed to mark game complete')
        }
    }, [wager, markComplete])

    if (!wager) return null

    const game = getGameData(wager.game)
    const ringCircumference = 2 * Math.PI * 44
    const countdownFraction = countdown !== null ? countdown / SYNC_COUNTDOWN : 1

    return (
        <Dialog open={open} onOpenChange={(v) => {
            // Non-dismissable once both have confirmed (countdown running)
            if (!v && bothConfirmed && countdown !== null && countdown > 0) return
            onOpenChange(v)
        }}>
            <DialogContent className="sm:max-w-md border-border bg-card" aria-describedby={undefined}>
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <div className="text-3xl">{game.icon}</div>
                        <div>
                            <DialogTitle className="font-gaming">Game Finished?</DialogTitle>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                {formatSol(wager.stake_lamports * 2)} SOL pool
                            </p>
                        </div>
                    </div>
                </DialogHeader>

                <div className="space-y-5 mt-2">

                    {/* Stake info */}
                    <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-center">
                        <p className="text-xs text-muted-foreground mb-0.5">Total Pool</p>
                        <p className="text-xl font-gaming font-bold text-primary">
                            {formatSol(wager.stake_lamports * 2)} SOL
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                            Winner takes 90% — confirm game done to start voting
                        </p>
                    </div>

                    {/* Sync countdown */}
                    <AnimatePresence>
                        {bothConfirmed && countdown !== null && (
                            <motion.div
                                key="countdown"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="flex flex-col items-center gap-3 py-2"
                            >
                                <div className="relative w-20 h-20 mx-auto">
                                    <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
                                    <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 96 96">
                                        <circle
                                            cx="48" cy="48" r="44"
                                            fill="none"
                                            stroke="hsl(var(--primary))"
                                            strokeWidth="4"
                                            strokeDasharray={`${countdownFraction * ringCircumference} ${ringCircumference}`}
                                            className="transition-all duration-200"
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <span className="text-2xl font-gaming font-bold text-primary">{countdown}</span>
                                    </div>
                                </div>
                                <p className="text-sm text-muted-foreground text-center">
                                    Both confirmed — opening vote screen…
                                </p>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Player status rows */}
                    {!bothConfirmed && (
                        <div className="space-y-2">
                            {[
                                {
                                    wallet: wager.player_a_wallet,
                                    player: playerA,
                                    confirmed: !!(wager as any).game_complete_a,
                                    isMe: isPlayerA,
                                    label: isPlayerA ? 'You' : 'Challenger',
                                },
                                {
                                    wallet: wager.player_b_wallet ?? '',
                                    player: playerB,
                                    confirmed: !!(wager as any).game_complete_b,
                                    isMe: isPlayerB,
                                    label: isPlayerB ? 'You' : 'Opponent',
                                },
                            ].map((p, i) => (
                                <div key={i}>
                                    {i === 1 && (
                                        <div className="flex justify-center my-1">
                                            <Swords className="h-4 w-4 text-primary" />
                                        </div>
                                    )}
                                    <div className={`flex items-center justify-between p-3 rounded-lg border-2 transition-colors ${p.confirmed
                                        ? 'bg-success/10 border-success/30'
                                        : p.isMe ? 'bg-primary/5 border-primary/20' : 'bg-muted/30 border-border'
                                        }`}>
                                        <div className="flex items-center gap-2">
                                            <div className={`p-1.5 rounded-full ${p.confirmed ? 'bg-success/20' : 'bg-muted'}`}>
                                                {p.confirmed
                                                    ? <CheckCircle2 className="h-4 w-4 text-success" />
                                                    : <Hourglass className="h-4 w-4 text-muted-foreground" />
                                                }
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-muted-foreground">{p.label}</p>
                                                <PlayerLink
                                                    walletAddress={p.wallet}
                                                    username={p.player?.username}
                                                    className="font-medium text-xs"
                                                />
                                            </div>
                                        </div>
                                        <Badge
                                            variant={p.confirmed ? 'success' : 'secondary'}
                                            className="text-[10px]"
                                        >
                                            {p.confirmed
                                                ? 'Confirmed ✓'
                                                : p.isMe
                                                    ? (localConfirmed || myConfirmed ? 'Confirmed ✓' : 'Tap below ↓')
                                                    : 'Waiting…'
                                            }
                                        </Badge>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Waiting for opponent — shown after I confirmed */}
                    <AnimatePresence>
                        {(myConfirmed || localConfirmed) && !bothConfirmed && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border border-border"
                            >
                                <Loader2 className="h-4 w-4 animate-spin text-primary flex-shrink-0" />
                                <p className="text-xs text-muted-foreground">
                                    Waiting for{' '}
                                    <span className="text-foreground font-medium">
                                        {otherPlayer?.username ||
                                            (isPlayerA
                                                ? wager.player_b_wallet?.slice(0, 6) + '…'
                                                : wager.player_a_wallet.slice(0, 6) + '…')}
                                    </span>
                                    {' '}to confirm they're done too…
                                </p>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Warning */}
                    {!myConfirmed && !localConfirmed && (
                        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                            <p className="text-xs text-amber-300 font-medium mb-1">⚠️ Only confirm if your game is done</p>
                            <p className="text-[10px] text-muted-foreground">
                                Both players must confirm before voting begins. False confirmations may result in a dispute.
                            </p>
                        </div>
                    )}

                    {/* Actions */}
                    {!myConfirmed && !localConfirmed && (
                        <Button
                            variant="neon"
                            className="w-full"
                            onClick={handleMarkComplete}
                            disabled={markComplete.isPending || localConfirmed}
                        >
                            {markComplete.isPending
                                ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                : <Shield className="h-4 w-4 mr-2" />
                            }
                            Confirm Game Complete
                        </Button>
                    )}

                    {(myConfirmed || localConfirmed) && !bothConfirmed && (
                        <Button variant="outline" className="w-full" disabled>
                            <Clock className="h-4 w-4 mr-2" />
                            Waiting for Opponent to Confirm…
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}