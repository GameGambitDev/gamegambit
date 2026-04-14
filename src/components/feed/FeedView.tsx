'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useWallet } from '@solana/wallet-adapter-react'
import Link from 'next/link'
import {
    Flame, Eye, Swords, Trophy, Clock, Share2,
    MessageCircle, Users, Radio, Zap, ChevronDown,
    ExternalLink, Loader2, Tv2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { GAMES, formatSol, truncateAddress } from '@/lib/constants'
import { useRecentWagers, type Wager } from '@/hooks/useWagers'
import {
    useFeedReactions,
    useMyReactions,
    useToggleReaction,
    useSpectatorCount,
    REACTIONS,
    type ReactionType,
} from '@/hooks/useFeed'
import { cn } from '@/lib/utils'
import { FriendButton } from '@/components/FriendButton'
import { FollowButton } from '@/components/FollowButton'
import { getStreamEmbed } from '@/lib/streamEmbed'
import { toast } from 'sonner'

// ── Helpers ───────────────────────────────────────────────────────────────────

const getGameData = (game: string) => {
    switch (game) {
        case 'chess': return GAMES.CHESS
        case 'codm': return GAMES.CODM
        case 'pubg': return GAMES.PUBG
        case 'free_fire': return GAMES.FREE_FIRE
        default: return GAMES.CHESS
    }
}

function formatTimeAgo(createdAt: string): string {
    const diffMs = Date.now() - new Date(createdAt).getTime()
    const mins = Math.floor(diffMs / 60_000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    if (days < 7) return `${days}d ago`
    return `${Math.floor(days / 7)}w ago`
}

function getStatusBadge(status: string) {
    switch (status) {
        case 'created': return <Badge variant="created">Open</Badge>
        case 'joined': return <Badge variant="joined">Live</Badge>
        case 'voting': return <Badge variant="voting">Voting</Badge>
        case 'disputed': return <Badge variant="disputed">Disputed</Badge>
        case 'resolved': return <Badge variant="resolved">Resolved</Badge>
        default: return <Badge variant="glass">{status}</Badge>
    }
}

// ── Reactions bar ─────────────────────────────────────────────────────────────

function ReactionsBar({
    wagerId,
    counts,
    myReacted,
    requiresWallet,
    wagerOwnerWallet,
}: {
    wagerId: string
    counts: Record<ReactionType, number>
    myReacted: Set<string>
    requiresWallet: boolean
    wagerOwnerWallet?: string | null
}) {
    const { mutate: toggle } = useToggleReaction()

    const handleReact = (type: ReactionType) => {
        if (requiresWallet) {
            toast.error('Sign in to react')
            return
        }
        const key = `${wagerId}:${type}`
        toggle({ wagerId, reactionType: type, alreadyReacted: myReacted.has(key), wagerOwnerWallet })
    }

    return (
        <div className="flex items-center gap-1">
            {REACTIONS.map(({ type, emoji }) => {
                const active = myReacted.has(`${wagerId}:${type}`)
                const n = counts?.[type] ?? 0
                return (
                    <button
                        key={type}
                        onClick={() => handleReact(type)}
                        className={cn(
                            'flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs transition-all duration-150',
                            'border',
                            active
                                ? 'bg-primary/15 border-primary/40 text-primary'
                                : 'bg-muted/40 border-border/40 text-muted-foreground hover:bg-muted hover:text-foreground'
                        )}
                    >
                        <span>{emoji}</span>
                        {n > 0 && <span className="font-mono">{n}</span>}
                    </button>
                )
            })}
        </div>
    )
}

// ── Spectator count chip ──────────────────────────────────────────────────────

function SpectatorChip({ wagerId, isLive }: { wagerId: string; isLive: boolean }) {
    const count = useSpectatorCount(isLive ? wagerId : null)
    if (!isLive || count === 0) return null
    return (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-destructive" />
            </span>
            <Eye className="h-3 w-3" />
            <span>{count}</span>
        </div>
    )
}

// ── Win Announcement Card ─────────────────────────────────────────────────────

function WinCard({
    wager,
    counts,
    myReacted,
    noWallet,
}: {
    wager: Wager
    counts: Record<ReactionType, number>
    myReacted: Set<string>
    noWallet: boolean
}) {
    const game = getGameData(wager.game)
    const winnerShort = wager.winner_wallet ? truncateAddress(wager.winner_wallet) : '???'

    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
        >
            <Card className="border border-yellow-500/30 bg-gradient-to-r from-yellow-500/5 via-card to-card overflow-hidden">
                <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 text-3xl">{game.icon}</div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                <Trophy className="h-4 w-4 text-yellow-400" />
                                <span className="font-gaming text-sm text-yellow-400">Winner!</span>
                                <span className="text-xs text-muted-foreground">{formatTimeAgo(wager.updated_at ?? wager.created_at)}</span>
                            </div>
                            <p className="text-sm font-medium mb-1">
                                <span className="text-yellow-300 font-gaming">{winnerShort}</span>
                                {' '}won{' '}
                                <span className="text-accent font-gaming">{formatSol(wager.stake_lamports)} SOL</span>
                                {' '}in {game.name}
                            </p>
                            <div className="flex items-center gap-3 mt-2">
                                <ReactionsBar wagerId={wager.id} counts={counts} myReacted={myReacted} requiresWallet={noWallet} wagerOwnerWallet={wager.player_a_wallet} />
                                <Link href={`/wager/${wager.id}`}>
                                    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground">
                                        <Eye className="h-3 w-3 mr-1" /> View
                                    </Button>
                                </Link>
                                <ShareButton wagerId={wager.id} />
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    )
}

// ── Stream Card ───────────────────────────────────────────────────────────────

function StreamCard({
    wager,
    counts,
    myReacted,
    noWallet,
}: {
    wager: Wager
    counts: Record<ReactionType, number>
    myReacted: Set<string>
    noWallet: boolean
}) {
    const game = getGameData(wager.game)
    const [expanded, setExpanded] = useState(false)
    const embed = wager.stream_url ? getStreamEmbed(wager.stream_url) : null

    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3 }}
        >
            <Card className="border border-primary/20 overflow-hidden">
                <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                            <span className="text-xl">{game.icon}</span>
                            <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-gaming text-sm">{truncateAddress(wager.player_a_wallet)}</span>
                                    <FriendButton targetWallet={wager.player_a_wallet} size="sm" />
                                    <FollowButton targetWallet={wager.player_a_wallet} size="sm" />
                                    <Swords className="h-3 w-3 text-muted-foreground" />
                                    <span className="font-gaming text-sm">{wager.player_b_wallet ? truncateAddress(wager.player_b_wallet) : '???'}</span>
                                    {wager.player_b_wallet && <FriendButton targetWallet={wager.player_b_wallet} size="sm" />}
                                    {wager.player_b_wallet && <FollowButton targetWallet={wager.player_b_wallet} size="sm" />}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Tv2 className="h-3 w-3 text-primary" />
                                    <span className="text-primary">Live Stream</span>
                                    <span>·</span>
                                    <SpectatorChip wagerId={wager.id} isLive />
                                    <span>·</span>
                                    <span className="text-accent font-gaming">{formatSol(wager.stake_lamports)} SOL</span>
                                </div>
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => setExpanded(v => !v)}
                        >
                            {expanded ? 'Hide' : 'Watch'}
                            <ChevronDown className={cn('h-3 w-3 ml-1 transition-transform', expanded && 'rotate-180')} />
                        </Button>
                    </div>

                    <AnimatePresence>
                        {expanded && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.3 }}
                                className="overflow-hidden mb-3"
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
                                    // Unsupported platform — graceful fallback
                                    <div className="flex items-center justify-center h-16 rounded-lg border border-border/50 bg-muted/30 gap-2 text-sm text-muted-foreground">
                                        <Tv2 className="h-4 w-4" />
                                        <span>Can&apos;t embed this stream.</span>
                                        <a
                                            href={wager.stream_url!}
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

                    <div className="flex items-center gap-3">
                        <ReactionsBar wagerId={wager.id} counts={counts} myReacted={myReacted} requiresWallet={noWallet} wagerOwnerWallet={wager.player_a_wallet} />
                        <Link href={`/wager/${wager.id}`}>
                            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground">
                                <Eye className="h-3 w-3 mr-1" /> Spectate
                            </Button>
                        </Link>
                        <ShareButton wagerId={wager.id} />
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    )
}

// ── Live / Open / Resolved Wager Card ────────────────────────────────────────

function WagerCard({
    wager,
    counts,
    myReacted,
    noWallet,
}: {
    wager: Wager
    counts: Record<ReactionType, number>
    myReacted: Set<string>
    noWallet: boolean
}) {
    const game = getGameData(wager.game)
    const isLive = wager.status === 'joined'

    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3 }}
        >
            <Card variant="wager" className="group cursor-pointer hover:-translate-y-0.5 transition-transform duration-200">
                <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="relative flex-shrink-0">
                                <span className={cn('text-2xl', isLive && 'animate-pulse')}>{game.icon}</span>
                                {isLive && (
                                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-destructive" />
                                    </span>
                                )}
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-1 sm:gap-2 mb-0.5 flex-wrap">
                                    <span className="font-gaming text-xs sm:text-sm truncate max-w-[70px] sm:max-w-none">
                                        {truncateAddress(wager.player_a_wallet)}
                                    </span>
                                    <FriendButton targetWallet={wager.player_a_wallet} size="sm" />
                                    <FollowButton targetWallet={wager.player_a_wallet} size="sm" />
                                    <Swords className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                    <span className="font-gaming text-xs sm:text-sm truncate max-w-[70px] sm:max-w-none">
                                        {wager.player_b_wallet ? truncateAddress(wager.player_b_wallet) : '???'}
                                    </span>
                                    {wager.player_b_wallet && <FriendButton targetWallet={wager.player_b_wallet} size="sm" />}
                                    {wager.player_b_wallet && <FollowButton targetWallet={wager.player_b_wallet} size="sm" />}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                                    <span>{game.name}</span>
                                    <span>·</span>
                                    <Clock className="h-3 w-3" />
                                    <span>{formatTimeAgo(wager.created_at)}</span>
                                    {isLive && (
                                        <>
                                            <span>·</span>
                                            <SpectatorChip wagerId={wager.id} isLive={isLive} />
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            <span className="font-gaming text-sm font-bold text-accent whitespace-nowrap">
                                {formatSol(wager.stake_lamports)} SOL
                            </span>
                            {getStatusBadge(wager.status)}
                            {wager.status === 'created' && !noWallet && (
                                <Link href="/arena">
                                    <Button variant="neon" size="sm" className="h-6 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                                        Join
                                    </Button>
                                </Link>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border/30">
                        <ReactionsBar wagerId={wager.id} counts={counts} myReacted={myReacted} requiresWallet={noWallet} wagerOwnerWallet={wager.player_a_wallet} />
                        <Link href={`/wager/${wager.id}`}>
                            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground">
                                <Eye className="h-3 w-3 mr-1" /> View
                            </Button>
                        </Link>
                        <ShareButton wagerId={wager.id} />
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    )
}

// ── Share button ──────────────────────────────────────────────────────────────

function ShareButton({ wagerId }: { wagerId: string }) {
    const [copied, setCopied] = useState(false)
    const handle = () => {
        navigator.clipboard.writeText(`${window.location.origin}/wager/${wagerId}`)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }
    return (
        <button onClick={handle} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <Share2 className="h-3 w-3" />
            <span className="hidden sm:inline">{copied ? 'Copied!' : 'Share'}</span>
        </button>
    )
}

// ── Feed card dispatcher ──────────────────────────────────────────────────────

function FeedCard({
    wager,
    allCounts,
    myReacted,
    noWallet,
}: {
    wager: Wager
    allCounts: Record<string, Record<ReactionType, number>>
    myReacted: Set<string>
    noWallet: boolean
}) {
    const counts = allCounts[wager.id] ?? { fire: 0, skull: 0, goat: 0, eyes: 0 }

    // Win card
    if (wager.status === 'resolved' && wager.winner_wallet) {
        return <WinCard wager={wager} counts={counts} myReacted={myReacted} noWallet={noWallet} />
    }
    // Stream card
    if (wager.stream_url && wager.status === 'joined') {
        return <StreamCard wager={wager} counts={counts} myReacted={myReacted} noWallet={noWallet} />
    }
    // Default
    return <WagerCard wager={wager} counts={counts} myReacted={myReacted} noWallet={noWallet} />
}

// ── Tab definitions ───────────────────────────────────────────────────────────

const TABS = [
    { id: 'for-you', label: 'For You', icon: <Zap className="h-3.5 w-3.5" /> },
    { id: 'friends', label: 'Friends', icon: <Users className="h-3.5 w-3.5" /> },
    { id: 'live', label: 'Live Now', icon: <Radio className="h-3.5 w-3.5" /> },
] as const

type TabId = typeof TABS[number]['id']

// ── Main FeedView ─────────────────────────────────────────────────────────────

export function FeedView() {
    const { publicKey } = useWallet()
    const myWallet = publicKey?.toBase58() ?? null
    const noWallet = !myWallet

    const [activeTab, setActiveTab] = useState<TabId>('for-you')

    const { data: allWagers, isLoading } = useRecentWagers(30)

    // Filter by tab
    const wagers = (() => {
        if (!allWagers) return []
        switch (activeTab) {
            case 'live':
                return allWagers.filter(w =>
                    ['joined'].includes(w.status) &&
                    (w.stream_url || true) // show all live, prioritise streams
                )
            case 'friends':
                // TODO: filter by friendship
                // For now show a prompt if no wallet, else show all (placeholder)
                return noWallet ? [] : allWagers
            default:
                return allWagers
        }
    })()

    const wagerIds = wagers.map(w => w.id)
    const { data: allCounts = {} } = useFeedReactions(wagerIds)
    const { data: myReacted = new Set<string>() } = useMyReactions(wagerIds, myWallet)

    return (
        <div className="min-h-screen pt-20 pb-16">
            <div className="container px-4 max-w-2xl mx-auto">

                {/* Header */}
                <div className="mb-6">
                    <h1 className="font-gaming text-2xl sm:text-3xl font-bold mb-1">
                        <span className="text-foreground">Game</span>
                        <span className="gradient-text">Feed</span>
                    </h1>
                    <p className="text-sm text-muted-foreground">Live matches, wins, and streams. No sign-in needed to watch.</p>
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-1 mb-6 p-1 bg-muted/40 rounded-xl border border-border/40 w-fit">
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
                                activeTab === tab.id
                                    ? 'bg-background text-foreground shadow-sm border border-border/60'
                                    : 'text-muted-foreground hover:text-foreground'
                            )}
                        >
                            {tab.icon}
                            {tab.label}
                            {tab.id === 'live' && allWagers && (
                                <span className="ml-0.5 px-1 py-0 rounded-full bg-destructive/20 text-destructive text-[10px] font-mono">
                                    {allWagers.filter(w => w.status === 'joined').length}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Friends tab — wallet gate */}
                {activeTab === 'friends' && noWallet && (
                    <div className="text-center py-16">
                        <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                        <h3 className="font-gaming text-lg mb-2">Sign in to see your crew</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                            Your friends feed is personal. Sign in to see who's playing and follow the action.
                        </p>
                    </div>
                )}

                {/* Feed */}
                {isLoading ? (
                    <div className="flex justify-center py-16">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : wagers.length === 0 && activeTab !== 'friends' ? (
                    <div className="text-center py-16">
                        <Swords className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                        <h3 className="font-gaming text-lg mb-2">
                            {activeTab === 'live' ? 'Nothing live at the moment.' : 'The feed is quiet.'}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-4">Create a wager and kick things off.</p>
                        <Link href="/arena">
                            <Button variant="neon">Enter Arena</Button>
                        </Link>
                    </div>
                ) : (
                    <AnimatePresence initial={false}>
                        <div className="space-y-3">
                            {wagers.map(wager => (
                                <FeedCard
                                    key={wager.id}
                                    wager={wager}
                                    allCounts={allCounts}
                                    myReacted={myReacted}
                                    noWallet={noWallet}
                                />
                            ))}
                        </div>
                    </AnimatePresence>
                )}

                {/* No-wallet CTA strip */}
                {noWallet && (
                    <div className="mt-8 p-4 rounded-xl border border-primary/20 bg-primary/5 text-center">
                        <p className="text-sm text-muted-foreground mb-2">
                            Sign in to react, send challenges, and bet on live matches.
                        </p>
                        <p className="text-xs text-muted-foreground/60">Browsing is always free, no sign-in needed.</p>
                    </div>
                )}
            </div>
        </div>
    )
}