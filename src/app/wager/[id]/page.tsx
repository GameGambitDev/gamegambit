'use client'

import { use, useEffect, useState } from 'react'
import { useWagerById } from '@/hooks/useWagers'
import { usePlayerByWallet } from '@/hooks/usePlayer'
import { getSupabaseClient } from '@/integrations/supabase/client'
import { GAMES, formatSol, calculatePlatformFee } from '@/lib/constants'
import { getTxExplorerUrl } from '@/lib/solana-config'
import { PlayerLink } from '@/components/PlayerLink'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
    Crown, Swords, Trophy, Clock, Copy, Check,
    ExternalLink, ArrowRight, Loader2, AlertCircle,
    User, Minus, Share2,
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import type { Wager } from '@/hooks/useWagers'
import { useQueryClient } from '@tanstack/react-query'

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

                {/* ── Lichess Live Board ── */}
                {isChess && wager.lichess_game_id && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                        <LichessEmbed gameId={wager.lichess_game_id} />
                    </motion.div>
                )}

                {/* ── Match Details ── */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
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
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground">Stream</span>
                                    <a
                                        href={wager.stream_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-primary hover:underline flex items-center gap-1 text-xs"
                                    >
                                        Watch Live <ExternalLink className="h-3 w-3" />
                                    </a>
                                </div>
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
                    transition={{ delay: 0.25 }}
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