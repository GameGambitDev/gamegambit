'use client'

/**
 * VotingModal.tsx
 *
 * Shown immediately after GameCompleteModal's 10s countdown fires.
 * Both players select the winner (or draw).
 *
 * Outcomes:
 *   - Agree → wager enters 'retractable' for 15s → shows countdown ring
 *     → after 15s, calls finalizeVote → resolves on-chain
 *   - Disagree → wager becomes 'disputed'
 *   - 5-min vote timer expires → server marks wager 'disputed'
 *
 * Timer behaviour:
 *   - Timer only starts once vote_deadline is set by the server (which happens
 *     when the SECOND player confirms game complete via markGameComplete).
 *     This prevents the timer running before voting is actually open.
 *   - Timer stops if the wager reaches retractable / disputed / resolved.
 *   - If timer hits 0 and the local player has NOT voted, we call voteTimeout
 *     on the server to mark the wager disputed. The server guards against
 *     double-fire so this is safe to call from either client.
 *
 * Close guard:
 *   - Blocks close ONLY if the player hasn't voted yet AND no error occurred.
 *   - Once voted (even waiting on opponent), modal can be closed.
 *   - On submit error the close guard is lifted so the user can always exit.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Trophy, Scale, Swords, Loader2, Clock, CheckCircle2,
    AlertTriangle, Hourglass, RotateCcw, ShieldCheck, Zap,
} from 'lucide-react'
import { Wager, useFinalizeVote, invokeSecureWager } from '@/hooks/useWagers'
import { useSubmitVote, useRetractVote, deriveVoteOutcome } from '@/hooks/useVoting'
import { useWalletAuth } from '@/hooks/useWalletAuth'
import { GAMES, formatSol, calculatePlatformFee } from '@/lib/constants'
import { PlayerLink } from '@/components/PlayerLink'
import { usePlayerByWallet } from '@/hooks/usePlayer'
import { toast } from 'sonner'

interface VotingModalProps {
    wager: Wager | null
    open: boolean
    onOpenChange: (open: boolean) => void
    currentWallet: string
}

const RETRACT_WINDOW_MS = 15_000

const getGameData = (game: string) => {
    switch (game) {
        case 'codm': return GAMES.CODM
        case 'pubg': return GAMES.PUBG
        case 'free_fire': return GAMES.FREE_FIRE
        default: return GAMES.CHESS
    }
}

export function VotingModal({ wager, open, onOpenChange, currentWallet }: VotingModalProps) {
    const { data: playerA } = usePlayerByWallet(wager?.player_a_wallet ?? null)
    const { data: playerB } = usePlayerByWallet(wager?.player_b_wallet ?? null)

    const submitVote = useSubmitVote()
    const retractVote = useRetractVote()
    const finalizeVote = useFinalizeVote()
    const { getSessionToken } = useWalletAuth()

    const [timeLeft, setTimeLeft] = useState<number | null>(null)
    const [retractLeft, setRetractLeft] = useState<number | null>(null)
    // Tracks whether a vote submission errored so we unlock the close guard
    const [hasSubmitError, setHasSubmitError] = useState(false)
    const finalizeCalledRef = useRef(false)
    const timeoutDisputeCalledRef = useRef(false)

    const isPlayerA = currentWallet === wager?.player_a_wallet
    const isPlayerB = currentWallet === wager?.player_b_wallet
    const myVote = isPlayerA ? wager?.vote_player_a : wager?.vote_player_b
    const opponentVoted = isPlayerA ? !!wager?.vote_player_b : !!wager?.vote_player_a
    const outcome = deriveVoteOutcome(wager, currentWallet)

    const isRetractable = wager?.status === 'retractable'
    const isDisputed = wager?.status === 'disputed'
    const isResolved = wager?.status === 'resolved'

    // ── 5-min vote deadline countdown ────────────────────────────────────────
    // IMPORTANT: only starts once vote_deadline exists on the wager object.
    // vote_deadline is set by the server only when BOTH players have confirmed
    // game complete — so the timer can never run before voting is open.
    useEffect(() => {
        if (!wager?.vote_deadline || !open || isRetractable || isResolved || isDisputed) {
            setTimeLeft(null)
            return
        }
        const deadline = new Date(wager.vote_deadline).getTime()
        const tick = () => setTimeLeft(Math.max(0, deadline - Date.now()))
        tick()
        const id = setInterval(tick, 1000)
        return () => clearInterval(id)
    }, [wager?.vote_deadline, open, isRetractable, isResolved, isDisputed])

    // ── Timer expiry → trigger dispute on server ──────────────────────────────
    // When the timer hits 0 and the current player still hasn't voted, we
    // call the voteTimeout action. The server checks if both players have voted
    // and, if not, marks the wager as disputed. Fire-and-forget — the realtime
    // subscription will push the status update back.
    useEffect(() => {
        if (timeLeft !== 0 || !wager || myVote || timeoutDisputeCalledRef.current) return
        timeoutDisputeCalledRef.current = true
            ; (async () => {
                try {
                    const sessionToken = await getSessionToken()
                    if (!sessionToken) return
                    await invokeSecureWager(
                        { action: 'voteTimeout', wagerId: wager.id },
                        sessionToken,
                    )
                } catch {
                    // Server may have already handled it — safe to ignore
                }
            })()
    }, [timeLeft, wager, myVote, getSessionToken])

    // Reset timeout ref when wager changes so each wager gets a fresh attempt
    useEffect(() => { timeoutDisputeCalledRef.current = false }, [wager?.id])

    // ── 15s retractable countdown + auto-finalize ─────────────────────────────
    useEffect(() => {
        if (!wager || !isRetractable) { setRetractLeft(null); return }
        const deadline = wager.retract_deadline
            ? new Date(wager.retract_deadline).getTime()
            : Date.now() + RETRACT_WINDOW_MS

        const tick = async () => {
            const remaining = Math.max(0, deadline - Date.now())
            setRetractLeft(remaining)
            if (remaining === 0 && !finalizeCalledRef.current) {
                finalizeCalledRef.current = true
                try { await finalizeVote.mutateAsync({ wagerId: wager.id }) } catch { /* server guards double-fire */ }
            }
        }
        tick()
        const id = setInterval(tick, 500)
        return () => clearInterval(id)
    }, [wager?.id, isRetractable, wager?.retract_deadline])

    useEffect(() => { finalizeCalledRef.current = false }, [wager?.id])

    // Clear error state when modal opens fresh for a wager
    useEffect(() => {
        if (open) setHasSubmitError(false)
    }, [open, wager?.id])

    const formatTime = (ms: number) => {
        const s = Math.ceil(ms / 1000)
        return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
    }

    const handleVote = useCallback(async (votedWinner: string) => {
        if (!wager) return
        setHasSubmitError(false)
        try {
            await submitVote.mutateAsync({ wagerId: wager.id, votedWinner })
            toast.success('Vote submitted — waiting for opponent')
        } catch (err: unknown) {
            setHasSubmitError(true)
            toast.error(err instanceof Error ? err.message : 'Failed to submit vote')
        }
    }, [wager, submitVote])

    const handleRetract = useCallback(async () => {
        if (!wager) return
        try {
            await retractVote.mutateAsync({ wagerId: wager.id })
            toast.success('Vote retracted')
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Failed to retract vote')
        }
    }, [wager, retractVote])

    if (!wager) return null

    const game = getGameData(wager.game)
    const pot = wager.stake_lamports * 2
    const platformFee = calculatePlatformFee(wager.stake_lamports)
    const payout = pot - platformFee

    // Allow closing if: already voted, resolved/disputed/retractable, or submit errored
    const canClose = !!myVote || isResolved || isDisputed || isRetractable || hasSubmitError

    return (
        <Dialog open={open} onOpenChange={(v) => {
            if (!v && !canClose) { toast.warning('Please vote before closing'); return }
            onOpenChange(v)
        }}>
            <DialogContent className="sm:max-w-md border-border bg-card" aria-describedby={undefined}>
                <DialogHeader>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="text-3xl">{game.icon}</div>
                            <div>
                                <DialogTitle className="font-gaming">Who Won?</DialogTitle>
                                <p className="text-xs text-muted-foreground mt-0.5">{formatSol(pot)} SOL pool</p>
                            </div>
                        </div>
                        {timeLeft !== null && !isRetractable && !isDisputed && !isResolved && (
                            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border ${timeLeft < 60000 ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-muted/40 border-border text-muted-foreground'}`}>
                                <Clock className="h-3 w-3" />
                                <span className="font-gaming text-xs">{formatTime(timeLeft)}</span>
                            </div>
                        )}
                    </div>
                </DialogHeader>

                <div className="space-y-4 mt-2">
                    <AnimatePresence mode="wait">

                        {/* ── Retractable — 15s countdown ring ── */}
                        {isRetractable && (
                            <motion.div key="retractable" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                                className="p-4 rounded-xl bg-success/10 border border-success/30 text-center space-y-3"
                            >
                                <ShieldCheck className="h-10 w-10 text-success mx-auto" />
                                <p className="font-gaming text-lg text-success">Votes Agree!</p>
                                <p className="text-xs text-muted-foreground">
                                    Funds lock in{' '}
                                    <span className="font-gaming text-foreground text-sm">
                                        {retractLeft !== null ? Math.ceil(retractLeft / 1000) : 15}s
                                    </span>
                                    {' '}— retract now if it was a mistake
                                </p>

                                {retractLeft !== null && (
                                    <div className="flex justify-center">
                                        <div className="relative w-16 h-16">
                                            <svg className="w-full h-full -rotate-90" viewBox="0 0 64 64">
                                                <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="4" className="text-muted/30" />
                                                <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="4"
                                                    strokeDasharray="175.9"
                                                    strokeDashoffset={175.9 * (1 - retractLeft / RETRACT_WINDOW_MS)}
                                                    className="text-success transition-all duration-500"
                                                />
                                            </svg>
                                            <span className="absolute inset-0 flex items-center justify-center font-gaming text-sm text-success">
                                                {Math.ceil(retractLeft / 1000)}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                <Button variant="outline" size="sm" className="w-full border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
                                    onClick={handleRetract} disabled={retractVote.isPending || finalizeVote.isPending}>
                                    <RotateCcw className="h-3 w-3 mr-2" />
                                    Retract vote
                                </Button>
                            </motion.div>
                        )}

                        {/* ── Resolved ── */}
                        {isResolved && (
                            <motion.div key="resolved" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                                className={`p-4 rounded-xl border text-center space-y-2 ${wager.winner_wallet === currentWallet ? 'bg-success/10 border-success/30' : wager.winner_wallet ? 'bg-muted/30 border-border' : 'bg-yellow-500/10 border-yellow-500/30'}`}
                            >
                                {!wager.winner_wallet ? (
                                    <><Scale className="h-10 w-10 text-yellow-400 mx-auto" /><p className="font-gaming text-lg text-yellow-400">Draw!</p><p className="text-xs text-muted-foreground">Each stake refunded</p></>
                                ) : wager.winner_wallet === currentWallet ? (
                                    <><Trophy className="h-10 w-10 text-accent mx-auto" /><p className="font-gaming text-lg text-success">You Won!</p><p className="text-xl font-gaming text-success">+{formatSol(payout)} SOL</p></>
                                ) : (
                                    <><Swords className="h-10 w-10 text-muted-foreground mx-auto" /><p className="font-gaming text-lg text-muted-foreground">You Lost</p><p className="text-sm text-muted-foreground">-{formatSol(wager.stake_lamports)} SOL</p></>
                                )}
                                <Button variant="outline" size="sm" className="mt-2" onClick={() => onOpenChange(false)}>Close</Button>
                            </motion.div>
                        )}

                        {/* ── Disputed ── */}
                        {isDisputed && (
                            <motion.div key="disputed" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2"
                            >
                                <div className="flex items-center gap-2">
                                    <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0" />
                                    <p className="text-sm font-medium text-amber-300">Dispute Initiated</p>
                                </div>
                                <p className="text-xs text-muted-foreground">Votes didn't match or time expired. A moderator will be assigned shortly.</p>
                                <Button variant="outline" size="sm" className="w-full mt-1" onClick={() => onOpenChange(false)}>Close</Button>
                            </motion.div>
                        )}

                        {/* ── Active voting ── */}
                        {!isResolved && !isDisputed && !isRetractable && (
                            <motion.div key="voting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">

                                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                                    <p className="text-[10px] text-amber-300">
                                        ⚠️ <span className="font-medium">Vote honestly.</span> False votes increase your dispute risk.
                                        {timeLeft !== null && timeLeft < 60000 && <span className="text-red-400 font-medium"> Time running out!</span>}
                                    </p>
                                </div>

                                {/* Prompt shown when opponent already voted but you haven't */}
                                {opponentVoted && !myVote && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -4 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/30"
                                    >
                                        <Zap className="h-4 w-4 text-primary flex-shrink-0" />
                                        <p className="text-xs text-primary font-medium">
                                            Your opponent has voted — your vote decides the result!
                                        </p>
                                    </motion.div>
                                )}

                                {/* Submit error state — always allow close */}
                                {hasSubmitError && (
                                    <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                                        <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
                                        <div className="flex-1">
                                            <p className="text-xs text-destructive font-medium">Vote failed to submit</p>
                                            <p className="text-[10px] text-muted-foreground">You can retry below or close and reopen to try again.</p>
                                        </div>
                                        <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => onOpenChange(false)}>
                                            Close
                                        </Button>
                                    </div>
                                )}

                                {/* Vote status rows */}
                                <div className="space-y-2">
                                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Vote Status</p>
                                    {[
                                        { wallet: wager.player_a_wallet, player: playerA, voted: !!wager.vote_player_a, isMe: isPlayerA, label: 'Challenger' },
                                        { wallet: wager.player_b_wallet ?? '', player: playerB, voted: !!wager.vote_player_b, isMe: isPlayerB, label: 'Opponent' },
                                    ].map((p, i) => (
                                        <div key={i} className={`flex items-center justify-between p-2.5 rounded-lg border ${p.voted ? 'bg-success/10 border-success/30' : 'bg-muted/30 border-border'}`}>
                                            <div className="flex items-center gap-2">
                                                <div className={`p-1 rounded-full ${p.voted ? 'bg-success/20' : 'bg-muted'}`}>
                                                    {p.voted ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : <Hourglass className="h-3.5 w-3.5 text-muted-foreground" />}
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-muted-foreground">{p.label} {p.isMe && '(You)'}</p>
                                                    <PlayerLink walletAddress={p.wallet} username={p.player?.username} className="text-xs font-medium" />
                                                </div>
                                            </div>
                                            <Badge variant={p.voted ? 'success' : 'secondary'} className="text-[10px]">
                                                {p.voted
                                                    ? 'Voted ✓'
                                                    : (p.isMe ? 'Your turn' : 'Waiting…')}
                                            </Badge>
                                        </div>
                                    ))}
                                </div>

                                {/* Waiting for opponent (I already voted) */}
                                {outcome === 'pending' && (
                                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                        className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border border-border"
                                    >
                                        <Loader2 className="h-4 w-4 animate-spin text-primary flex-shrink-0" />
                                        <p className="text-xs text-muted-foreground">Waiting for opponent to vote…</p>
                                        <Button variant="ghost" size="sm" className="ml-auto h-6 text-[10px] text-muted-foreground hover:text-foreground"
                                            onClick={handleRetract} disabled={retractVote.isPending}>
                                            <RotateCcw className="h-3 w-3 mr-1" />Retract
                                        </Button>
                                    </motion.div>
                                )}

                                {/* Vote picker — shown when I haven't voted yet */}
                                {outcome === 'waiting' && (
                                    <div className="space-y-3">
                                        <p className="text-xs text-muted-foreground text-center">Select the winner</p>

                                        {[
                                            { wallet: wager.player_a_wallet, player: playerA, label: 'Challenger', isMe: isPlayerA },
                                            null, // draw spacer
                                            { wallet: wager.player_b_wallet ?? '', player: playerB, label: 'Opponent', isMe: isPlayerB },
                                        ].map((p, i) => p === null ? (
                                            <button key="draw" onClick={() => handleVote('draw')} disabled={submitVote.isPending}
                                                className={`w-full p-2.5 rounded-xl border-2 transition-all ${myVote === 'draw' ? 'border-yellow-500 bg-yellow-500/10' : 'border-border hover:border-yellow-500/50 hover:bg-yellow-500/5'}`}>
                                                <div className="flex items-center justify-center gap-2">
                                                    <Scale className="h-4 w-4 text-yellow-400" />
                                                    <span className="text-sm font-gaming text-muted-foreground">Draw</span>
                                                </div>
                                            </button>
                                        ) : (
                                            <button key={p.wallet} onClick={() => handleVote(p.wallet)} disabled={submitVote.isPending || !p.wallet}
                                                className={`w-full p-3 rounded-xl border-2 transition-all text-left ${myVote === p.wallet ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50 hover:bg-primary/5'}`}>
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <Trophy className="h-4 w-4 text-accent" />
                                                        <div>
                                                            <p className="text-[10px] text-muted-foreground">{p.label} {p.isMe && '(You)'}</p>
                                                            <PlayerLink walletAddress={p.wallet} username={p.player?.username} className="text-sm font-gaming font-bold" />
                                                        </div>
                                                    </div>
                                                    {p.isMe && <Badge variant="outline" className="text-[10px]">You</Badge>}
                                                </div>
                                            </button>
                                        ))}

                                        {submitVote.isPending && (
                                            <div className="flex items-center justify-center gap-2 py-1">
                                                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                                <p className="text-xs text-muted-foreground">Submitting…</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </DialogContent>
        </Dialog>
    )
}