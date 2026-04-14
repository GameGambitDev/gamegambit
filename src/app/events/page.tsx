'use client'

import { Suspense } from 'react'
import { motion } from 'framer-motion'
import { useWallet } from '@solana/wallet-adapter-react'
import {
    Sparkles, Shield, Zap, Users, Trophy, Swords,
    GamepadIcon, Star, TrendingUp, Lock, ChevronRight,
    CircleDot, Flame, Target, Crown
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { usePlayer } from '@/hooks/usePlayer'
import { truncateAddress, formatSol } from '@/lib/constants'
import Link from 'next/link'
import { AirdropShareButton } from '@/components/ShareCards'

// ── Skeleton ──────────────────────────────────────────────────────────────────
function EventsPageSkeleton() {
    return (
        <div className="min-h-screen pt-20 pb-16 px-4">
            <div className="max-w-4xl mx-auto space-y-8 animate-pulse">
                <div className="h-48 rounded-2xl bg-muted/40" />
                <div className="h-64 rounded-2xl bg-muted/40" />
                <div className="h-48 rounded-2xl bg-muted/40" />
            </div>
        </div>
    )
}

// ── Activity stat tile ────────────────────────────────────────────────────────
function StatTile({
    icon: Icon,
    label,
    value,
    sub,
    color = 'text-primary',
}: {
    icon: React.ElementType
    label: string
    value: string | number
    sub?: string
    color?: string
}) {
    return (
        <div className="flex flex-col gap-1 p-4 rounded-xl bg-muted/40 border border-border/50">
            <div className="flex items-center gap-2 mb-1">
                <Icon className={`h-4 w-4 ${color}`} />
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{label}</span>
            </div>
            <div className={`font-gaming text-2xl ${color}`}>{value}</div>
            {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
        </div>
    )
}

// ── Engagement pillar card ────────────────────────────────────────────────────
function PillarCard({
    icon: Icon,
    title,
    body,
    delay,
    color = 'text-primary',
    bg = 'bg-primary/10',
}: {
    icon: React.ElementType
    title: string
    body: string
    delay: number
    color?: string
    bg?: string
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay, duration: 0.4 }}
        >
            <Card className="h-full border-border/60 hover:border-primary/30 transition-colors">
                <CardContent className="p-5 flex gap-4">
                    <div className={`flex-shrink-0 w-10 h-10 rounded-xl ${bg} flex items-center justify-center mt-0.5`}>
                        <Icon className={`h-5 w-5 ${color}`} />
                    </div>
                    <div>
                        <h3 className="font-gaming text-sm mb-1.5 text-foreground">{title}</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    )
}

// ── Inner page ────────────────────────────────────────────────────────────────
function EventsPageInner() {
    const { connected } = useWallet()
    const { data: player } = usePlayer()

    const gameLinked = !!(
        player?.codm_username ||
        player?.pubg_username ||
        player?.free_fire_username ||
        player?.lichess_username
    )

    return (
        <div className="min-h-screen pt-20 pb-24 px-4">
            <div className="max-w-4xl mx-auto space-y-10">

                {/* ── Hero ─────────────────────────────────────────────────────────── */}
                <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <Card className="relative overflow-hidden border-primary/30 bg-card/80">
                        {/* Background glow */}
                        <div className="absolute inset-0 pointer-events-none">
                            <div className="absolute top-0 left-1/3 w-96 h-96 rounded-full bg-primary/8 blur-3xl" />
                            <div className="absolute bottom-0 right-1/4 w-64 h-64 rounded-full bg-secondary/8 blur-3xl" />
                        </div>

                        <CardContent className="relative p-8 md:p-10">
                            <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center">
                                        <Sparkles className="h-6 w-6 text-primary" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <h1 className="font-gaming text-2xl md:text-3xl text-foreground">
                                                Airdrop Campaign
                                            </h1>
                                            <Badge className="bg-green-500/15 text-green-400 border-green-500/30 text-[11px] font-semibold uppercase tracking-wider">
                                                <CircleDot className="h-2.5 w-2.5 mr-1 animate-pulse" />
                                                Active
                                            </Badge>
                                        </div>
                                        <p className="text-sm text-muted-foreground">For the players who showed up first.</p>
                                    </div>
                                </div>
                            </div>

                            <p className="text-base text-muted-foreground leading-relaxed mb-6 max-w-2xl">
                                GameGambit is rewarding the players who were here early and stayed. We track every wager, every win, every referral. All on-chain, all verifiable. If you compete hard and bring others into the arena, this is built for you.
                            </p>

                            <div className="flex flex-wrap gap-3">
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 border border-border/60 text-sm text-muted-foreground">
                                    <Shield className="h-3.5 w-3.5 text-primary" />
                                    On-chain verified activity
                                </div>
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 border border-border/60 text-sm text-muted-foreground">
                                    <Lock className="h-3.5 w-3.5 text-yellow-400" />
                                    Snapshot taken periodically
                                </div>
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 border border-border/60 text-sm text-muted-foreground">
                                    <Star className="h-3.5 w-3.5 text-secondary" />
                                    Early adopters weighted higher
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* ── How to Earn Your Spot ───────────────────────────────────────────────── */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1, duration: 0.4 }}
                >
                    <div className="flex items-center gap-3 mb-5">
                        <Target className="h-5 w-5 text-primary" />
                        <h2 className="font-gaming text-xl text-foreground">How to Earn Your Spot</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <PillarCard
                            icon={Swords}
                            title="Wager Consistently"
                            body="One wager won't cut it. Players who show up regularly across different games build a real footprint. Sustained activity counts far more than a single big bet."
                            delay={0.15}
                            color="text-primary"
                            bg="bg-primary/10"
                        />
                        <PillarCard
                            icon={Trophy}
                            title="Win Your Matches"
                            body="Winning isn't just bragging rights. It's a core signal in our activity model. Players with a strong win record demonstrate skill and commitment to the platform. Consistent wins across different games and opponents carry significant weight."
                            delay={0.2}
                            color="text-yellow-400"
                            bg="bg-yellow-400/10"
                        />
                        <PillarCard
                            icon={Users}
                            title="Grow the Arena"
                            body="Bring your squad. Refer friends, teammates, rivals. Anyone who will actually play. Every person you bring in makes the arena bigger and your standing stronger."
                            delay={0.25}
                            color="text-secondary"
                            bg="bg-secondary/10"
                        />
                        <PillarCard
                            icon={GamepadIcon}
                            title="Link Your Game Accounts"
                            body="Linking your game accounts proves you actually play. It strengthens your profile and shows you're here to compete, not just spectate."
                            delay={0.3}
                            color="text-blue-400"
                            bg="bg-blue-400/10"
                        />
                        <PillarCard
                            icon={Flame}
                            title="Stay Active Over Time"
                            body="Recency and longevity both matter. A wallet that joined early and keeps showing up signals something different than one that appeared last week. We're not looking at a single snapshot. Sustained activity across time is the real qualifier."
                            delay={0.35}
                            color="text-orange-400"
                            bg="bg-orange-400/10"
                        />
                        <PillarCard
                            icon={TrendingUp}
                            title="Engage With the Community"
                            body="React to wins on the feed, spectate live matches, use the messaging system, send challenges to rivals. Platform engagement beyond wagering shows you're here for the ecosystem, not just the transaction. Every interaction builds your footprint."
                            delay={0.4}
                            color="text-green-400"
                            bg="bg-green-400/10"
                        />
                    </div>
                </motion.div>

                {/* ── Important Notes ──────────────────────────────────────────────── */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.45, duration: 0.4 }}
                >
                    <Card className="border-yellow-500/20 bg-yellow-500/5">
                        <CardContent className="p-6">
                            <div className="flex gap-3">
                                <Lock className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                                <div>
                                    <h3 className="font-gaming text-sm text-yellow-400 mb-2">What We Don't Disclose</h3>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        Specific thresholds, reward amounts, distribution timelines, and eligibility
                                        criteria are intentionally kept internal. This is by design. It keeps the
                                        focus on genuine platform engagement rather than farming for a number. If
                                        you're playing real matches, wagering real SOL, and bringing real players in,
                                        you're doing exactly what this program rewards. The rest will be announced
                                        when the time is right.
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* ── Your Activity (wallet connected) ─────────────────────────────── */}
                {connected && player && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5, duration: 0.4 }}
                    >
                        <div className="flex items-center gap-3 mb-5">
                            <Crown className="h-5 w-5 text-primary" />
                            <h2 className="font-gaming text-xl text-foreground">Your Activity</h2>
                            <Badge variant="outline" className="text-[11px] text-muted-foreground">
                                {player.username || truncateAddress(player.wallet_address, 6)}
                            </Badge>
                        </div>

                        <Card className="border-primary/20 bg-card/60">
                            <CardContent className="p-6">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                                    <StatTile
                                        icon={Swords}
                                        label="Total Wagered"
                                        value={formatSol(player.total_wagered ?? 0)}
                                        sub="SOL on-chain"
                                        color="text-primary"
                                    />
                                    <StatTile
                                        icon={Trophy}
                                        label="Wins"
                                        value={player.total_wins ?? 0}
                                        sub={`${player.total_losses ?? 0} losses`}
                                        color="text-yellow-400"
                                    />
                                    <StatTile
                                        icon={Users}
                                        label="Referred"
                                        value={player.referral_count ?? 0}
                                        sub="players invited"
                                        color="text-secondary"
                                    />
                                    <StatTile
                                        icon={GamepadIcon}
                                        label="Game Account"
                                        value={gameLinked ? 'Linked ✓' : 'Not linked'}
                                        sub={gameLinked ? 'verified gamer' : 'link in profile'}
                                        color={gameLinked ? 'text-green-400' : 'text-muted-foreground'}
                                    />
                                </div>

                                <div className="my-5 border-t border-border/50 opacity-50" />

                                <div className="flex flex-wrap gap-3">
                                    <Link href="/arena">
                                        <Button variant="neon" size="sm" className="gap-2 font-gaming">
                                            <Swords className="h-4 w-4" /> Go to Arena
                                        </Button>
                                    </Link>
                                    <Link href="/profile">
                                        <Button variant="outline" size="sm" className="gap-2">
                                            <Users className="h-4 w-4" /> Invite Friends
                                            <ChevronRight className="h-3.5 w-3.5" />
                                        </Button>
                                    </Link>
                                    {!gameLinked && (
                                        <Link href="/profile">
                                            <Button variant="outline" size="sm" className="gap-2 border-blue-500/30 text-blue-400 hover:bg-blue-500/10">
                                                <GamepadIcon className="h-4 w-4" /> Link Game Account
                                            </Button>
                                        </Link>
                                    )}
                                    <AirdropShareButton
                                        username={player?.username ?? null}
                                        totalWagered={player?.total_wagered ?? 0}
                                        wins={player?.total_wins ?? 0}
                                        referrals={player?.referral_count ?? 0}
                                        inviteCode={player?.invite_code ?? null}
                                        className="text-sm h-8"
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}

                {/* ── Connect prompt (not connected) ───────────────────────────────── */}
                {!connected && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5, duration: 0.4 }}
                    >
                        <Card className="border-border/50 bg-muted/20">
                            <CardContent className="p-8 text-center">
                                <Zap className="h-8 w-8 text-primary mx-auto mb-3" />
                                <h3 className="font-gaming text-lg mb-2">See Your Standing</h3>
                                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                                    Connect wallet to see how your wagers, wins, and referrals stack up in the airdrop.
                                </p>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}

            </div>
        </div>
    )
}

// ── Page export ───────────────────────────────────────────────────────────────
export default function EventsPage() {
    return (
        <Suspense fallback={<EventsPageSkeleton />}>
            <EventsPageInner />
        </Suspense>
    )
}