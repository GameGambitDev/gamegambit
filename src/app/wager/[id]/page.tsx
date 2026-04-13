'use client'

import { use, useEffect, useState } from 'react'
import { useWagerById } from '@/hooks/useWagers'
import { usePlayerByWallet } from '@/hooks/usePlayer'
import { getSupabaseClient } from '@/integrations/supabase/client'
import { GAMES, formatSol, calculatePlatformFee, truncateAddress } from '@/lib/constants'
import { getTxExplorerUrl } from '@/lib/solana-config'
import { PlayerLink } from '@/components/PlayerLink'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
    Crown, Swords, Trophy, Clock, Copy, Check,
    ExternalLink, ArrowRight, Loader2, AlertCircle,
    User, Minus, Share2, Coins, ChevronDown, ChevronUp, Lock,
    TrendingUp, X, Tv2,
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import type { Wager } from '@/hooks/useWagers'
import { useQueryClient } from '@tanstack/react-query'
import { useWallet } from '@solana/wallet-adapter-react'
import { getStreamEmbed } from '@/lib/streamEmbed'
import {
    useSideBets,
    usePlaceSideBet,
    useCounterSideBet,
    useAcceptSideBet,
    useCancelSideBet,
    type SideBet,
} from '@/hooks/useSideBets'
import { LAMPORTS_PER_SOL } from '@solana/web3.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getGameData = (game: string) => {
    switch (game) {
        case 'chess': return GAMES.CHESS
        case 'codm': return GAMES.CODM
        case 'pubg': return GAMES.PUBG
        case 'free_fire': return GAMES.FREE_FIRE
        default: return GAMES.CHESS
    }
}

const STATUS_CONFIG: Record<string, { label: string; variant: string; dot: string }> = {
    created: { label: 'Open — waiting for opponent', variant: 'created', dot: 'bg-yellow-400' },
    joined: { label: 'Live — in progress', variant: 'joined', dot: 'bg-green-400 animate-pulse' },
    voting: { label: 'Voting on result', variant: 'voting', dot: 'bg-blue-400 animate-pulse' },
    retractable: { label: 'Pending confirmation', variant: 'joined', dot: 'bg-orange-400' },
    disputed: { label: 'Disputed', variant: 'disputed', dot: 'bg-red-400 animate-pulse' },
    resolved: { label: 'Resolved', variant: 'resolved', dot: 'bg-muted-foreground' },
    cancelled: { label: 'Cancelled', variant: 'glass', dot: 'bg-muted-foreground' },
}

function formatTimeAgo(ts: string) {
    const diff = Date.now() - new Date(ts).getTime()
    const mins = Math.floor(diff / 60_000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StreamEmbed({
    streamUrl,
    embed,
}: {
    streamUrl: string
    embed: ReturnType<typeof getStreamEmbed>
}) {
    const [expanded, setExpanded] = useState(false)
    return (
        <div className="space-y-2">
            <div className="flex justify-between items-center">
                <span className="text-muted-foreground flex items-center gap-1">
                    <Tv2 className="h-3 w-3 text-primary" /> Stream
                </span>
                <button
                    onClick={() => setExpanded(v => !v)}
                    className="text-primary hover:underline flex items-center gap-1 text-xs"
                >
                    {expanded ? 'Hide' : 'Watch Live'}
                    <ChevronDown className={cn('h-3 w-3 transition-transform', expanded && 'rotate-180')} />
                </button>
            </div>
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                    >
                        {embed ? (
                            <iframe
                                src={embed.embedUrl}
                                className="w-full rounded-lg border border-border/50"
                                style={{ height: 280 }}
                                allowFullScreen
                                allow="autoplay; encrypted-media"
                                sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
                                referrerPolicy="no-referrer-when-downgrade"
                            />
                        ) : (
                            <div className="flex items-center justify-center h-14 rounded-lg border border-border/50 bg-muted/30 gap-2 text-sm text-muted-foreground">
                                <Tv2 className="h-4 w-4" />
                                <span>Can&apos;t embed this stream.</span>
                                <a
                                    href={streamUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline flex items-center gap-1"
                                >
                                    Open externally <ExternalLink className="h-3 w-3" />
                                </a>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

function PlayerCard({
    wallet,
    label,
    isWinner,
    isDraw,
}: {
    wallet: string
    label: string
    isWinner: boolean
    isDraw: boolean
}) {
    const { data: player } = usePlayerByWallet(wallet)

    return (
        <div className={cn(
            'flex items-center justify-between p-4 rounded-xl border transition-colors',
            isWinner
                ? 'bg-accent/10 border-accent/40'
                : isDraw
                    ? 'bg-muted/30 border-border/50'
                    : 'bg-muted/20 border-border/40',
        )}>
            <div className="flex items-center gap-3 min-w-0">
                <div className={cn(
                    'p-2 rounded-full relative flex-shrink-0',
                    isWinner ? 'bg-accent/20' : 'bg-primary/10',
                )}>
                    <User className={cn('h-5 w-5', isWinner ? 'text-accent' : 'text-primary')} />
                    {isWinner && (
                        <Crown className="h-3 w-3 text-accent absolute -top-1 -right-1" />
                    )}
                </div>
                <div className="min-w-0">
                    <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
                    <PlayerLink
                        walletAddress={wallet}
                        username={player?.username}
                        className="font-medium text-sm font-gaming"
                    />
                </div>
            </div>
            {player && (
                <div className="text-right text-xs text-muted-foreground flex-shrink-0 ml-2">
                    <span>{player.total_wins ?? 0}W</span>
                    <span className="mx-1 opacity-40">/</span>
                    <span>{player.total_losses ?? 0}L</span>
                </div>
            )}
        </div>
    )
}

function LichessEmbed({ gameId }: { gameId: string }) {
    return (
        <div className="rounded-xl overflow-hidden border border-border/50 bg-black">
            <div className="flex items-center justify-between px-4 py-2 bg-card/60 border-b border-border/40">
                <span className="text-xs text-muted-foreground font-gaming">Live Chess Board</span>
                <a
                    href={`https://lichess.org/${gameId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                    Open on Lichess <ExternalLink className="h-3 w-3" />
                </a>
            </div>
            <iframe
                src={`https://lichess.org/embed/game/${gameId}?theme=brown&bg=dark`}
                className="w-full"
                style={{ height: '380px', border: 'none' }}
                allowTransparency
                title="Live Chess Game"
            />
        </div>
    )
}

function ShareButton({ wagerId }: { wagerId: string }) {
    const [copied, setCopied] = useState(false)
    const url = typeof window !== 'undefined'
        ? `${window.location.origin}/wager/${wagerId}`
        : `/wager/${wagerId}`

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(url)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch {
            // fallback
        }
    }

    return (
        <Button variant="outline" size="sm" onClick={handleCopy} className="gap-2">
            {copied
                ? <><Check className="h-4 w-4 text-green-400" /> Copied!</>
                : <><Copy className="h-4 w-4" /> Copy Link</>
            }
        </Button>
    )
}

// ─── Side Bets Panel ──────────────────────────────────────────────────────────

function SideBetsPanel({
    wagerId,
    playerAWallet,
    playerBWallet,
    wagerStatus,
}: {
    wagerId: string
    playerAWallet: string
    playerBWallet: string | null
    wagerStatus: string
}) {
    const { publicKey } = useWallet()
    const myWallet = publicKey?.toBase58() ?? null

    const { data: bets = [], isLoading } = useSideBets(wagerId)
    const placeBet = usePlaceSideBet(wagerId)
    const counterBet = useCounterSideBet(wagerId)
    const acceptBet = useAcceptSideBet(wagerId)
    const cancelBet = useCancelSideBet(wagerId)

    const [expanded, setExpanded] = useState(true)
    const [placeSide, setPlaceSide] = useState<'player_a' | 'player_b' | null>(null)
    const [placeAmount, setPlaceAmount] = useState('')
    const [counterBetId, setCounterBetId] = useState<string | null>(null)
    const [counterAmount, setCounterAmount] = useState('')

    const bettingClosed = ['voting', 'resolved', 'cancelled'].includes(wagerStatus)
    const isPlayer = myWallet === playerAWallet || myWallet === playerBWallet

    const openBets = bets.filter(b => b.status === 'open' || b.status === 'countered')
    const matchedBets = bets.filter(b => b.status === 'matched')
    const resolvedBets = bets.filter(b => b.status === 'resolved')

    const handlePlace = () => {
        if (!placeSide || !placeAmount) return
        const lamports = Math.round(parseFloat(placeAmount) * LAMPORTS_PER_SOL)
        if (isNaN(lamports) || lamports <= 0) return
        placeBet.mutate({ backedPlayer: placeSide, amountLamports: lamports }, {
            onSuccess: () => { setPlaceSide(null); setPlaceAmount('') }
        })
    }

    const handleCounter = (betId: string) => {
        if (!counterAmount) return
        const lamports = Math.round(parseFloat(counterAmount) * LAMPORTS_PER_SOL)
        if (isNaN(lamports) || lamports <= 0) return
        counterBet.mutate({ betId, counterAmountLamports: lamports }, {
            onSuccess: () => { setCounterBetId(null); setCounterAmount('') }
        })
    }

    const handleAccept = (bet: SideBet) => {
        const amountToSend = bet.counter_amount ?? bet.amount_lamports
        acceptBet.mutate({ betId: bet.id, amountLamports: amountToSend })
    }

    const playerALabel = truncateAddress(playerAWallet)
    const playerBLabel = playerBWallet ? truncateAddress(playerBWallet) : 'TBD'

    return (
        <Card className="border-primary/20">
            <CardContent className="p-0">
                {/* Header */}
                <button
                    onClick={() => setExpanded(v => !v)}
                    className="w-full flex items-center justify-between p-4 hover:bg-muted/20 transition-colors rounded-t-xl"
                >
                    <div className="flex items-center gap-2">
                        <Coins className="h-4 w-4 text-primary" />
                        <span className="font-gaming text-sm font-semibold">Side Bets</span>
                        {bets.length > 0 && (
                            <Badge variant="outline" className="text-xs px-1.5 py-0">
                                {bets.length}
                            </Badge>
                        )}
                        {bettingClosed && (
                            <Badge variant="glass" className="text-xs px-1.5 py-0 gap-1">
                                <Lock className="h-2.5 w-2.5" /> Closed
                            </Badge>
                        )}
                    </div>
                    {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </button>

                <AnimatePresence initial={false}>
                    {expanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                        >
                            <div className="px-4 pb-4 space-y-4">

                                {/* Place Bet Form */}
                                {!bettingClosed && !isPlayer && myWallet && playerBWallet && (
                                    <div className="space-y-3 pt-1">
                                        <p className="text-xs text-muted-foreground">Pick a side to back:</p>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                onClick={() => setPlaceSide(s => s === 'player_a' ? null : 'player_a')}
                                                className={cn(
                                                    'p-3 rounded-lg border text-sm font-gaming transition-colors text-left',
                                                    placeSide === 'player_a'
                                                        ? 'border-primary bg-primary/10 text-primary'
                                                        : 'border-border/50 hover:border-border'
                                                )}
                                            >
                                                <TrendingUp className="h-3.5 w-3.5 mb-1" />
                                                {playerALabel}
                                            </button>
                                            <button
                                                onClick={() => setPlaceSide(s => s === 'player_b' ? null : 'player_b')}
                                                className={cn(
                                                    'p-3 rounded-lg border text-sm font-gaming transition-colors text-left',
                                                    placeSide === 'player_b'
                                                        ? 'border-accent bg-accent/10 text-accent'
                                                        : 'border-border/50 hover:border-border'
                                                )}
                                            >
                                                <TrendingUp className="h-3.5 w-3.5 mb-1" />
                                                {playerBLabel}
                                            </button>
                                        </div>

                                        <AnimatePresence>
                                            {placeSide && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: -6 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: -6 }}
                                                    className="flex gap-2"
                                                >
                                                    <Input
                                                        type="number"
                                                        min="0.001"
                                                        step="0.001"
                                                        placeholder="SOL amount"
                                                        value={placeAmount}
                                                        onChange={e => setPlaceAmount(e.target.value)}
                                                        className="flex-1 h-9 text-sm"
                                                    />
                                                    <Button
                                                        size="sm"
                                                        variant="neon"
                                                        onClick={handlePlace}
                                                        disabled={!placeAmount || placeBet.isPending}
                                                        className="h-9 px-4"
                                                    >
                                                        {placeBet.isPending
                                                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                            : 'Bet'
                                                        }
                                                    </Button>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                )}

                                {/* Login prompt */}
                                {!myWallet && !bettingClosed && (
                                    <p className="text-xs text-muted-foreground py-1">
                                        Connect wallet to place side bets.
                                    </p>
                                )}

                                {/* Player can't bet */}
                                {isPlayer && !bettingClosed && (
                                    <p className="text-xs text-muted-foreground py-1 flex items-center gap-1.5">
                                        <Lock className="h-3 w-3" /> Players can't bet on their own match.
                                    </p>
                                )}

                                {/* Loading */}
                                {isLoading && (
                                    <div className="flex justify-center py-3">
                                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                    </div>
                                )}

                                {/* Open / countered bets */}
                                {openBets.length > 0 && (
                                    <div className="space-y-2">
                                        <p className="text-xs text-muted-foreground uppercase tracking-widest">Open Bets</p>
                                        {openBets.map(bet => {
                                            const isOwner = bet.bettor_wallet === myWallet
                                            const canAccept = !isOwner && myWallet && !bettingClosed
                                            const amountToAccept = bet.counter_amount ?? bet.amount_lamports
                                            const backedLabel = bet.backed_player === 'player_a' ? playerALabel : playerBLabel

                                            return (
                                                <div key={bet.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/20 border border-border/30 text-sm">
                                                    <div className="min-w-0">
                                                        <span className="text-muted-foreground text-xs">{truncateAddress(bet.bettor_wallet)}</span>
                                                        <span className="text-muted-foreground text-xs mx-1">→</span>
                                                        <span className="font-gaming text-xs text-primary">{backedLabel}</span>
                                                        <div className="font-gaming font-bold mt-0.5">
                                                            {formatSol(bet.amount_lamports)} SOL
                                                            {bet.counter_amount && bet.counter_amount !== bet.amount_lamports && (
                                                                <span className="text-xs text-muted-foreground ml-1">(counter: {formatSol(bet.counter_amount)} SOL)</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-1.5 flex-shrink-0">
                                                        {isOwner && (
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                                                                onClick={() => cancelBet.mutate({ betId: bet.id })}
                                                                disabled={cancelBet.isPending}
                                                            >
                                                                <X className="h-3 w-3" />
                                                            </Button>
                                                        )}
                                                        {canAccept && (
                                                            <>
                                                                <Button
                                                                    size="sm"
                                                                    variant="neon"
                                                                    className="h-7 px-3 text-xs"
                                                                    onClick={() => handleAccept(bet)}
                                                                    disabled={acceptBet.isPending}
                                                                >
                                                                    Accept {formatSol(amountToAccept)} SOL
                                                                </Button>
                                                                {counterBetId !== bet.id && (
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        className="h-7 px-2 text-xs"
                                                                        onClick={() => setCounterBetId(bet.id)}
                                                                    >
                                                                        Counter
                                                                    </Button>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}

                                {/* Counter-offer input */}
                                <AnimatePresence>
                                    {counterBetId && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="flex gap-2"
                                        >
                                            <Input
                                                type="number"
                                                min="0.001"
                                                step="0.001"
                                                placeholder="Your counter SOL amount"
                                                value={counterAmount}
                                                onChange={e => setCounterAmount(e.target.value)}
                                                className="flex-1 h-9 text-sm"
                                            />
                                            <Button
                                                size="sm"
                                                variant="neon"
                                                className="h-9 px-3"
                                                onClick={() => handleCounter(counterBetId)}
                                                disabled={!counterAmount || counterBet.isPending}
                                            >
                                                {counterBet.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Send'}
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-9 px-2"
                                                onClick={() => { setCounterBetId(null); setCounterAmount('') }}
                                            >
                                                <X className="h-3.5 w-3.5" />
                                            </Button>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* Matched bets */}
                                {matchedBets.length > 0 && (
                                    <div className="space-y-2">
                                        <p className="text-xs text-muted-foreground uppercase tracking-widest">Locked In</p>
                                        {matchedBets.map(bet => (
                                            <div key={bet.id} className="flex items-center justify-between p-3 rounded-lg bg-green-500/5 border border-green-500/20 text-xs">
                                                <div>
                                                    <span className="font-gaming text-green-400">{truncateAddress(bet.bettor_wallet)}</span>
                                                    <span className="text-muted-foreground mx-1">vs</span>
                                                    <span className="font-gaming text-green-400">{bet.backer_wallet ? truncateAddress(bet.backer_wallet) : '?'}</span>
                                                </div>
                                                <span className="font-gaming font-bold">
                                                    {formatSol(bet.amount_lamports + (bet.counter_amount ?? bet.amount_lamports))} SOL pot
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Resolved bets */}
                                {resolvedBets.length > 0 && (
                                    <div className="space-y-2">
                                        <p className="text-xs text-muted-foreground uppercase tracking-widest">Settled</p>
                                        {resolvedBets.map(bet => (
                                            <div key={bet.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/10 border border-border/20 text-xs opacity-60">
                                                <span className="font-gaming">{truncateAddress(bet.bettor_wallet)}</span>
                                                <span className="text-muted-foreground">Resolved</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Empty state */}
                                {!isLoading && bets.length === 0 && (
                                    <p className="text-xs text-muted-foreground text-center py-2">
                                        {bettingClosed ? 'No side bets were placed.' : 'No bets yet — be the first!'}
                                    </p>
                                )}

                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </CardContent>
        </Card>
    )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function WagerSpectatorPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const queryClient = useQueryClient()
    const { data: wager, isLoading, error } = useWagerById(id)

    // Supabase Realtime — live updates without polling
    useEffect(() => {
        let sub: ReturnType<ReturnType<typeof getSupabaseClient>['channel']> | null = null

        try {
            const supabase = getSupabaseClient()
            sub = supabase
                .channel(`spectator:${id}`)
                .on(
                    'postgres_changes',
                    { event: 'UPDATE', schema: 'public', table: 'wagers', filter: `id=eq.${id}` },
                    (payload) => {
                        queryClient.setQueryData(['wagers', id], (old: Wager | null) =>
                            old ? { ...old, ...(payload.new as Partial<Wager>) } : old
                        )
                    }
                )
                .subscribe()
        } catch {
            // Supabase not configured — silently ignore
        }

        return () => { sub?.unsubscribe() }
    }, [id, queryClient])

    // ── Loading ──
    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center space-y-4">
                    <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
                    <p className="text-muted-foreground font-gaming text-sm">Loading wager...</p>
                </div>
            </div>
        )
    }

    // ── Not found / error ──
    if (error || !wager) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center space-y-4 max-w-sm px-4">
                    <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
                    <h2 className="font-gaming text-xl">Wager Not Found</h2>
                    <p className="text-muted-foreground text-sm">
                        This wager doesn't exist or has been removed.
                    </p>
                    <Link href="/arena">
                        <Button variant="neon">
                            Browse Arena <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                    </Link>
                </div>
            </div>
        )
    }

    const game = getGameData(wager.game)
    const status = STATUS_CONFIG[wager.status] ?? STATUS_CONFIG.created
    const isResolved = wager.status === 'resolved'
    const isCancelled = wager.status === 'cancelled'
    const isDraw = isResolved && !wager.winner_wallet
    const pot = wager.stake_lamports * 2
    const platformFee = calculatePlatformFee(wager.stake_lamports)
    const winnerPayout = pot - platformFee
    const isChess = wager.game === 'chess'

    // tx sig for explorer: prefer _a, fall back to _b
    const txSig = (wager as any).tx_signature_a || (wager as any).tx_signature_b || null

    return (
        <div className="min-h-screen" style={{ zIndex: 1 }}>
            {/* Subtle background glow */}
            <div
                className="fixed inset-0 pointer-events-none"
                style={{
                    background: 'radial-gradient(ellipse at top, hsl(270 100% 60% / 0.04), transparent 60%)',
                    zIndex: 0,
                }}
            />

            <div className="relative z-10 container max-w-2xl mx-auto px-4 py-8 space-y-6">

                {/* ── Header ── */}
                <motion.div
                    initial={{ opacity: 0, y: -12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-start justify-between gap-4"
                >
                    <div className="flex items-center gap-4">
                        <div className="text-5xl">{game.icon}</div>
                        <div>
                            <h1 className="font-gaming text-2xl font-bold">{game.name}</h1>
                            <div className="flex items-center gap-2 mt-1">
                                <span className={cn('relative flex h-2 w-2')}>
                                    <span className={cn('absolute inline-flex h-full w-full rounded-full', status.dot)} />
                                    <span className={cn('relative inline-flex rounded-full h-2 w-2', status.dot.replace(' animate-pulse', ''))} />
                                </span>
                                <span className="text-sm text-muted-foreground">{status.label}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Match #{wager.match_id} · {formatTimeAgo(wager.created_at)}
                            </p>
                        </div>
                    </div>
                    <ShareButton wagerId={wager.id} />
                </motion.div>

                {/* ── Result Banner ── */}
                {isResolved && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={cn(
                            'rounded-xl border p-5 text-center',
                            isDraw
                                ? 'bg-muted/30 border-border'
                                : 'bg-accent/10 border-accent/40',
                        )}
                    >
                        {isDraw ? (
                            <>
                                <Minus className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
                                <p className="font-gaming text-xl">Draw</p>
                                <p className="text-sm text-muted-foreground mt-1">Stakes returned to both players</p>
                            </>
                        ) : (
                            <>
                                <Crown className="h-10 w-10 mx-auto mb-2 text-accent" />
                                <p className="font-gaming text-xl mb-1">Winner</p>
                                {wager.winner_wallet && (
                                    <PlayerLink
                                        walletAddress={wager.winner_wallet}
                                        className="text-accent font-gaming text-lg font-bold"
                                    />
                                )}
                                <p className="text-sm text-muted-foreground mt-2">
                                    Received{' '}
                                    <span className="font-gaming text-accent font-bold">{formatSol(winnerPayout)} SOL</span>
                                    {' '}({formatSol(platformFee)} SOL platform fee)
                                </p>
                                {txSig && (
                                    <a
                                        href={getTxExplorerUrl(txSig)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-3"
                                    >
                                        View settlement on Solana Explorer
                                        <ExternalLink className="h-3 w-3" />
                                    </a>
                                )}
                            </>
                        )}
                    </motion.div>
                )}

                {/* ── Stake Card ── */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
                    <Card className="border-primary/20 bg-primary/5">
                        <CardContent className="p-5 text-center">
                            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">
                                {isResolved ? 'Total Pool' : 'Each Player Stakes'}
                            </p>
                            <p className="font-gaming text-4xl font-bold text-primary">
                                {formatSol(isResolved ? pot : wager.stake_lamports)} SOL
                            </p>
                            {!isResolved && wager.player_b_wallet && (
                                <p className="text-sm text-muted-foreground mt-1">
                                    Total pot: {formatSol(pot)} SOL
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </motion.div>

                {/* ── Players ── */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="space-y-3">
                    <PlayerCard
                        wallet={wager.player_a_wallet}
                        label="Challenger"
                        isWinner={!isDraw && wager.winner_wallet === wager.player_a_wallet}
                        isDraw={isDraw}
                    />

                    <div className="flex items-center gap-3 px-2">
                        <div className="h-px flex-1 bg-border" />
                        <Swords className="h-5 w-5 text-muted-foreground" />
                        <div className="h-px flex-1 bg-border" />
                    </div>

                    {wager.player_b_wallet ? (
                        <PlayerCard
                            wallet={wager.player_b_wallet}
                            label="Opponent"
                            isWinner={!isDraw && wager.winner_wallet === wager.player_b_wallet}
                            isDraw={isDraw}
                        />
                    ) : (
                        <div className="flex flex-col items-center justify-center p-4 rounded-xl border-2 border-dashed border-border gap-2">
                            <p className="text-muted-foreground text-sm">Waiting for opponent…</p>
                            <Link href="/arena">
                                <Button variant="neon" size="sm">
                                    Accept This Challenge <ArrowRight className="h-3 w-3 ml-1" />
                                </Button>
                            </Link>
                        </div>
                    )}
                </motion.div>

                {/* ── Side Bets Panel ── */}
                {!isCancelled && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                        <SideBetsPanel
                            wagerId={wager.id}
                            playerAWallet={wager.player_a_wallet}
                            playerBWallet={wager.player_b_wallet ?? null}
                            wagerStatus={wager.status}
                        />
                    </motion.div>
                )}

                {/* ── Lichess Live Board ── */}
                {isChess && wager.lichess_game_id && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                        <LichessEmbed gameId={wager.lichess_game_id} />
                    </motion.div>
                )}

                {/* ── Match Details ── */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                    <Card className="border-border/40">
                        <CardContent className="p-5 space-y-3 text-sm">
                            <h3 className="font-gaming text-xs uppercase tracking-widest text-muted-foreground mb-3">Match Details</h3>

                            <div className="flex justify-between">
                                <span className="text-muted-foreground flex items-center gap-2">
                                    <Clock className="h-4 w-4" /> Created
                                </span>
                                <span>{formatTimeAgo(wager.created_at)}</span>
                            </div>

                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Match ID</span>
                                <span className="font-mono text-xs">#{wager.match_id}</span>
                            </div>

                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Game</span>
                                <span>{game.name} {game.platform !== game.name ? `· ${game.platform}` : ''}</span>
                            </div>

                            {wager.lichess_game_id && (
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground">Lichess</span>
                                    <a
                                        href={`https://lichess.org/${wager.lichess_game_id}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-primary hover:underline flex items-center gap-1 text-xs"
                                    >
                                        {wager.lichess_game_id} <ExternalLink className="h-3 w-3" />
                                    </a>
                                </div>
                            )}

                            {wager.stream_url && (
                                <StreamEmbed
                                    streamUrl={wager.stream_url}
                                    embed={getStreamEmbed(wager.stream_url)}
                                />
                            )}

                            {isResolved && wager.resolved_at && (
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground flex items-center gap-2">
                                        <Trophy className="h-4 w-4" /> Resolved
                                    </span>
                                    <span>{new Date(wager.resolved_at).toLocaleString()}</span>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </motion.div>

                {/* ── CTA ── */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="rounded-xl border border-primary/20 bg-primary/5 p-5 text-center space-y-3"
                >
                    <p className="font-gaming text-base">Want to run your own wager?</p>
                    <p className="text-sm text-muted-foreground">
                        Challenge anyone. Stake real SOL. Winner takes 90%.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <Link href="/arena">
                            <Button variant="neon" className="w-full sm:w-auto">
                                Create a Wager <ArrowRight className="h-4 w-4 ml-2" />
                            </Button>
                        </Link>
                        <ShareButton wagerId={wager.id} />
                    </div>
                </motion.div>

            </div>
        </div>
    )
}