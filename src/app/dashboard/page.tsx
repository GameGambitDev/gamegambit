'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useWallet } from '@solana/wallet-adapter-react'
import { useWalletReady } from '@/app/providers'
import dynamic from 'next/dynamic'

const WalletMultiButton = dynamic(
  () => import('@solana/wallet-adapter-react-ui').then(m => ({ default: m.WalletMultiButton })),
  { ssr: false }
)
import {
  Trophy, Swords, TrendingUp, Wallet, Clock, Target,
  ChevronRight, Flame, Star, Activity, Zap,
  Shield, Crown, ArrowUpRight, ArrowDownRight, Minus,
  BarChart3, CircleDot
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { truncateAddress, formatSol, GAMES } from '@/lib/constants'
import Link from 'next/link'
import { usePlayer } from '@/hooks/usePlayer'
import { useQueryClient } from '@tanstack/react-query'
import { useMyWagers, useWagerById, type Wager } from '@/hooks/useWagers'
import { useWalletBalance } from '@/hooks/useWalletBalance'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useBalanceAnimation } from '@/contexts/BalanceAnimationContext'
import { useGameEvents } from '@/contexts/GameEventContext'
import { GameCompleteModal } from '@/components/GameCompletemodal'
import { VotingModal } from '@/components/Votingmodal'
import { DisputeGraceModal } from '@/components/DisputeGraceModal'
import { SuspensionBanner } from '@/components/SuspensionBanner'
import {
  DashboardPageSkeleton,
} from '@/components/skeletons/GamingSkeletonLoader'

const getGameData = (game: string) => {
  switch (game) {
    case 'chess': return GAMES.CHESS
    case 'codm': return GAMES.CODM
    case 'pubg': return GAMES.PUBG
    case 'free_fire': return GAMES.FREE_FIRE
    default: return GAMES.CHESS
  }
}

function StreakDisplay({ current, best }: { current: number; best: number }) {
  const isHot = current >= 3
  const isOnFire = current >= 5

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative">
        <motion.div
          animate={isOnFire ? {
            scale: [1, 1.1, 1],
            filter: ['brightness(1)', 'brightness(1.3)', 'brightness(1)'],
          } : {}}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="text-4xl"
        >
          {isOnFire ? '🔥' : isHot ? '⚡' : current > 0 ? '✨' : '💤'}
        </motion.div>
        {isOnFire && (
          <motion.div
            className="absolute inset-0 rounded-full bg-orange-500/20 blur-xl"
            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0.8, 0.5] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
          />
        )}
      </div>
      <div className="font-gaming text-3xl font-bold text-foreground">{current}</div>
      <div className="text-xs text-muted-foreground">Current Streak</div>
      <div className="text-xs text-muted-foreground/60">Best: {best}</div>
    </div>
  )
}

function MatchCard({ match, walletAddress, index }: {
  match: any
  walletAddress: string
  index: number
}) {
  const [hovered, setHovered] = useState(false)
  const game = getGameData(match.game)
  const won = match.winner_wallet === walletAddress
  const isDraw = match.status === 'resolved' && !match.winner_wallet
  const opponent = match.player_a_wallet === walletAddress
    ? match.player_b_wallet
    : match.player_a_wallet
  const timeAgo = Math.floor((Date.now() - new Date(match.created_at).getTime()) / 3600000)

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.07 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className={`
        relative overflow-hidden rounded-xl border transition-all duration-300 p-4
        ${won
          ? 'border-green-500/30 bg-green-500/5 hover:border-green-500/50 hover:bg-green-500/10'
          : isDraw
            ? 'border-yellow-500/30 bg-yellow-500/5 hover:border-yellow-500/50 hover:bg-yellow-500/10'
            : 'border-red-500/20 bg-red-500/5 hover:border-red-500/40 hover:bg-red-500/8'
        }
      `}>
        {/* Glow effect on hover */}
        <AnimatePresence>
          {hovered && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={`absolute inset-0 blur-2xl -z-10 ${won ? 'bg-green-500/10' : isDraw ? 'bg-yellow-500/10' : 'bg-red-500/10'
                }`}
            />
          )}
        </AnimatePresence>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Result icon */}
            <div className={`
              w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0
              ${won ? 'bg-green-500/20' : isDraw ? 'bg-yellow-500/20' : 'bg-red-500/20'}
            `}>
              {won
                ? <ArrowUpRight className="h-5 w-5 text-green-400" />
                : isDraw
                  ? <Minus className="h-5 w-5 text-yellow-400" />
                  : <ArrowDownRight className="h-5 w-5 text-red-400" />
              }
            </div>

            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-lg">{game.icon}</span>
                <span className="font-gaming text-sm text-foreground">
                  vs {opponent ? truncateAddress(opponent, 4) : 'Unknown'}
                </span>
                <Badge
                  variant="outline"
                  className={`text-[10px] px-1.5 py-0 ${won
                    ? 'border-green-500/50 text-green-400'
                    : isDraw
                      ? 'border-yellow-500/50 text-yellow-400'
                      : 'border-red-500/50 text-red-400'
                    }`}
                >
                  {won ? 'WIN' : isDraw ? 'DRAW' : 'LOSS'}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{game.name}</span>
                <span>•</span>
                <Clock className="h-3 w-3" />
                <span>{timeAgo}h ago</span>
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className={`font-gaming text-base font-bold ${won ? 'text-green-400' : isDraw ? 'text-yellow-400' : 'text-red-400'
              }`}>
              {won ? '+' : isDraw ? '' : '-'}{formatSol(match.stake_lamports)} SOL
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function StatBar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <div className="h-2 rounded-full bg-muted overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${max > 0 ? (value / max) * 100 : 0}%` }}
        transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
        className={`h-full rounded-full ${color}`}
      />
    </div>
  )
}

export default function DashboardPage() {
  const { connected, publicKey } = useWallet()
  const walletReady = useWalletReady()
  const { data: player, isLoading: playerLoading } = usePlayer()
  const { data: wagers, isLoading: wagersLoading } = useMyWagers()
  const { data: walletBalance, isLoading: balanceLoading } = useWalletBalance()
  const { onWagerResolved, clearPendingResult } = useGameEvents()
  const walletAddress = publicKey?.toBase58() || ''

  // ── Step 3: Game Complete + Voting modal state ───────────────────────────
  const [gameCompleteWager, setGameCompleteWager] = useState<Wager | null>(null)
  const [gameCompleteOpen, setGameCompleteOpen] = useState(false)
  const [votingWager, setVotingWager] = useState<Wager | null>(null)
  const [votingOpen, setVotingOpen] = useState(false)
  // ── Step 4: Dispute Grace Period modal state ──────────────────────────────
  const [graceWager, setGraceWager] = useState<Wager | null>(null)
  const [graceOpen, setGraceOpen] = useState(false)

  const { data: gameCompleteWagerLive } = useWagerById(gameCompleteOpen ? gameCompleteWager?.id ?? null : null)
  const { data: votingWagerLive } = useWagerById(votingOpen ? votingWager?.id ?? null : null)

  // Close modals when wager resolves
  useEffect(() => {
    if (!walletAddress) return
    const unsub = onWagerResolved((wager) => {
      const isParticipant = wager.player_a_wallet === walletAddress || wager.player_b_wallet === walletAddress
      if (!isParticipant) return
      if (gameCompleteWager?.id === wager.id) { setGameCompleteOpen(false); setGameCompleteWager(null) }
      if (votingWager?.id === wager.id) { setVotingOpen(false); setVotingWager(null) }
      // ── Step 4: close grace modal on resolution ──────────────────────────
      if (graceWager?.id === wager.id) { setGraceOpen(false); setGraceWager(null) }
      clearPendingResult(wager.id)
    })
    return unsub
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddress, onWagerResolved, clearPendingResult])

  const handleOpenGameComplete = (wager: Wager) => {
    setGameCompleteWager(wager)
    setGameCompleteOpen(true)
  }

  const handleOpenVoting = (wager: Wager) => {
    setVotingWager(wager)
    setVotingOpen(true)
  }

  const handleBothConfirmed = () => {
    const w = gameCompleteWagerLive ?? gameCompleteWager
    setGameCompleteOpen(false)
    if (w) { setVotingWager(w); setVotingOpen(true) }
  }

  // ── Step 4: open DisputeGraceModal ───────────────────────────────────────
  const handleOpenGrace = (wager: Wager) => {
    setGraceWager(wager)
    setGraceOpen(true)
  }

  const activeWagers = wagers?.filter(w => ['created', 'joined', 'voting', 'disputed'].includes(w.status)) || []
  const completedWagers = wagers?.filter(w => w.status === 'resolved') || []
  const recentMatches = completedWagers.slice(0, 5)

  const totalGames = (player?.total_wins ?? 0) + (player?.total_losses ?? 0)
  const winRate = totalGames > 0
    ? Math.round((player!.total_wins / totalGames) * 100)
    : 0

  const displayName = player?.username || (publicKey ? truncateAddress(publicKey.toBase58(), 4) : '')

  // Rank tier based on wins
  const getRank = (wins: number) => {
    if (wins >= 50) return { label: 'Grandmaster', icon: Crown, color: 'text-yellow-400', bg: 'bg-yellow-500/20' }
    if (wins >= 20) return { label: 'Master', icon: Shield, color: 'text-purple-400', bg: 'bg-purple-500/20' }
    if (wins >= 10) return { label: 'Expert', icon: Star, color: 'text-blue-400', bg: 'bg-blue-500/20' }
    if (wins >= 5) return { label: 'Skilled', icon: Zap, color: 'text-green-400', bg: 'bg-green-500/20' }
    return { label: 'Rookie', icon: CircleDot, color: 'text-muted-foreground', bg: 'bg-muted' }
  }

  const rank = getRank(player?.total_wins ?? 0)

  // ── Balance animation from BalanceAnimationContext ───────────────────────
  const queryClient = useQueryClient()
  const { consumeAnimation, hasAnimation } = useBalanceAnimation()
  const [balanceDelta, setBalanceDelta] = useState<{ value: number; type: 'win' | 'lose' | 'draw' } | null>(null)
  const [showDeltaBadge, setShowDeltaBadge] = useState(false)
  // Animated balance: starts at current balance, counts up/down to new balance
  const [animatedBalance, setAnimatedBalance] = useState<number | null>(null)
  const deltaTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rafRef = useRef<number | null>(null)
  const startTimeRef = useRef<number | null>(null)

  const runBalanceAnimation = useCallback((startBalance: number, delta: number, type: 'win' | 'lose' | 'draw') => {
    if (type === 'draw' || delta === 0) return
    const duration = 2500
    const endBalance = startBalance + (delta / 1e9) // delta in lamports → SOL
    startTimeRef.current = null
    const animate = (ts: number) => {
      if (startTimeRef.current === null) startTimeRef.current = ts
      const progress = Math.min((ts - startTimeRef.current) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setAnimatedBalance(startBalance + (endBalance - startBalance) * eased)
      if (progress < 1) rafRef.current = requestAnimationFrame(animate)
      else {
        // Animation done — refetch real balance from chain
        queryClient.invalidateQueries({ queryKey: ['walletBalance'] })
      }
    }
    rafRef.current = requestAnimationFrame(animate)
  }, [queryClient])

  useEffect(() => {
    const tryConsume = () => {
      if (!hasAnimation()) return false
      const anim = consumeAnimation()
      if (!anim || anim.delta === 0) return false
      setBalanceDelta({ value: anim.delta, type: anim.type })
      setShowDeltaBadge(true)
      // Start balance animation from current balance
      const currentBal = walletBalance ?? 0
      runBalanceAnimation(currentBal, anim.delta, anim.type)
      if (deltaTimerRef.current) clearTimeout(deltaTimerRef.current)
      deltaTimerRef.current = setTimeout(() => {
        setShowDeltaBadge(false)
        setAnimatedBalance(null)
      }, 5500)
      return true
    }

    if (tryConsume()) return

    let attempts = 0
    const interval = setInterval(() => {
      attempts++
      if (tryConsume() || attempts >= 20) clearInterval(interval)
    }, 500)

    return () => {
      clearInterval(interval)
      if (deltaTimerRef.current) clearTimeout(deltaTimerRef.current)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletBalance])

  if (!walletReady) return <DashboardPageSkeleton />

  if (!connected) {
    return (
      <div className="py-8 pb-16 min-h-screen flex flex-col items-center justify-center">
        <div className="container px-4">
          <div className="max-w-sm mx-auto text-center py-12">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200 }}
              className="mb-8"
            >
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center mx-auto mb-6 animate-pulse border-2 border-primary/50">
                <Activity className="h-12 w-12 text-primary" />
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <h1 className="text-2xl sm:text-3xl font-bold mb-3 font-gaming">
                Welcome to <span className="text-primary">Game Gambit</span>
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground mb-6">
                Connect wallet to see your stats, track active wagers, and jump into a match.
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="[&_.wallet-adapter-button]:!bg-primary [&_.wallet-adapter-button]:!text-primary-foreground [&_.wallet-adapter-button]:!font-gaming [&_.wallet-adapter-button]:!rounded-xl [&_.wallet-adapter-button]:!h-12 [&_.wallet-adapter-button]:!px-6 [&_.wallet-adapter-button]:hover:!shadow-neon [&_.wallet-adapter-button]:!transition-all mb-6"
            >
              <WalletMultiButton />
            </motion.div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="mt-4 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <p className="text-xs sm:text-sm text-amber-400 font-medium mb-1">📱 On mobile?</p>
              <p className="text-xs text-muted-foreground">
                Open in <span className="text-amber-400 font-medium">Phantom's browser</span>, <span className="text-amber-400 font-medium">Mises</span>, or <span className="text-amber-400 font-medium">Kiwi Browser</span>.
              </p>
            </motion.div>
          </div>
        </div>
      </div>
    )
  }

  if (playerLoading || wagersLoading) {
    return <DashboardPageSkeleton />
  }

  return (
    <div className="py-8 pb-16">
      <SuspensionBanner player={player} />
      <div className="container px-4">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex items-start justify-between gap-4"
        >
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-3xl font-bold font-gaming">
                Welcome back, <span className="text-primary">{displayName}</span>
              </h1>
              {/* Rank badge */}
              <div className={`hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full ${rank.bg}`}>
                <rank.icon className={`h-3.5 w-3.5 ${rank.color}`} />
                <span className={`text-xs font-gaming ${rank.color}`}>{rank.label}</span>
              </div>
            </div>
            <p className="text-muted-foreground text-sm">
              {totalGames > 0
                ? `${totalGames} matches played · ${winRate}% win rate`
                : 'Ready to place your first wager?'}
            </p>
          </div>
          <Link href="/arena">
            <Button variant="neon" size="sm" className="flex-shrink-0">
              <Swords className="h-4 w-4 mr-1.5" />
              Find Match
            </Button>
          </Link>
        </motion.div>

        {/* Top Stats Row */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6"
        >
          {[
            {
              icon: Wallet,
              label: 'Balance',
              value: balanceLoading ? '...' : animatedBalance !== null ? `${animatedBalance.toFixed(4)} SOL` : `${walletBalance?.toFixed(3) || '0'} SOL`,
              color: 'text-primary',
              bg: 'bg-primary/15',
              sub: showDeltaBadge && balanceDelta
                ? balanceDelta.type === 'win'
                  ? `+${(balanceDelta.value / 1e9).toFixed(3)} SOL won! 🏆`
                  : balanceDelta.type === 'lose'
                    ? `-${(Math.abs(balanceDelta.value) / 1e9).toFixed(3)} SOL lost`
                    : 'Draw, refunded'
                : 'Available',
              highlight: showDeltaBadge && balanceDelta
                ? balanceDelta.type === 'win' ? 'border-green-500/50' : balanceDelta.type === 'lose' ? 'border-red-500/50' : ''
                : '',
            },
            {
              icon: TrendingUp,
              label: 'Total Earned',
              value: `+${player ? formatSol(player.total_earnings) : '0'} SOL`,
              color: 'text-green-400',
              bg: 'bg-green-500/15',
              sub: 'All time',
              highlight: '',
            },
            {
              icon: Trophy,
              label: 'Wins',
              value: player?.total_wins ?? 0,
              color: 'text-yellow-400',
              bg: 'bg-yellow-500/15',
              sub: `${player?.total_losses ?? 0} losses`,
              highlight: '',
            },
            {
              icon: Flame,
              label: 'Hot Streak',
              value: player?.current_streak ?? 0,
              color: (player?.current_streak ?? 0) >= 3 ? 'text-orange-400' : 'text-muted-foreground',
              bg: (player?.current_streak ?? 0) >= 3 ? 'bg-orange-500/15' : 'bg-muted',
              sub: `Best: ${player?.best_streak ?? 0}`,
              highlight: '',
            },
          ].map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + index * 0.06 }}
              whileHover={{ scale: 1.02, y: -2 }}
            >
              <Card variant="gaming" className={`p-4 transition-all hover:border-primary/30 overflow-hidden relative ${stat.highlight ? `border ${stat.highlight}` : ''}`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${stat.bg} flex-shrink-0`}>
                    <stat.icon className={`h-4 w-4 ${stat.color}`} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground mb-0.5">{stat.label}</div>
                    <div className={`font-gaming text-lg font-bold truncate ${stat.color}`}>{stat.value}</div>
                    <div className={`text-[10px] ${stat.highlight ? 'text-foreground font-medium' : 'text-muted-foreground/60'}`}>{stat.sub}</div>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left — Recent Matches */}
          <div className="lg:col-span-2 space-y-6">

            {/* Recent Matches */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <Card variant="gaming" className="overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between pb-4">
                  <CardTitle className="flex items-center gap-2 font-gaming">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    Recent Matches
                  </CardTitle>
                  <Link href="/my-wagers">
                    <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80 text-xs gap-1">
                      View All <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </CardHeader>
                <CardContent className="pt-0">
                  {recentMatches.length > 0 ? (
                    <div className="space-y-2">
                      {recentMatches.map((match, i) => (
                        <MatchCard
                          key={match.id}
                          match={match}
                          walletAddress={walletAddress}
                          index={i}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-10">
                      <div className="text-4xl mb-3">♟️</div>
                      <p className="text-muted-foreground text-sm mb-4">No matches yet. Your record starts here.</p>
                      <Link href="/arena">
                        <Button variant="neon" size="sm">
                          <Swords className="h-4 w-4 mr-2" />
                          Find Your First Match
                        </Button>
                      </Link>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Performance breakdown */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <Card variant="gaming">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 font-gaming">
                    <Target className="h-5 w-5 text-primary" />
                    Performance
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-4">
                  <div>
                    <div className="flex justify-between mb-2 text-sm">
                      <span className="text-muted-foreground">Win Rate</span>
                      <span className={`font-gaming font-bold ${winRate >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                        {winRate}%
                      </span>
                    </div>
                    <Progress value={winRate} className="h-2" />
                  </div>

                  <div className="grid grid-cols-3 gap-3 pt-2">
                    {[
                      { label: 'Wins', value: player?.total_wins ?? 0, color: 'bg-green-500', textColor: 'text-green-400' },
                      { label: 'Losses', value: player?.total_losses ?? 0, color: 'bg-red-500', textColor: 'text-red-400' },
                      { label: 'Total', value: totalGames, color: 'bg-primary', textColor: 'text-primary' },
                    ].map(s => (
                      <div key={s.label} className="text-center p-3 rounded-xl bg-muted/40">
                        <div className={`font-gaming text-2xl font-bold ${s.textColor}`}>{s.value}</div>
                        <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
                        <StatBar value={s.value} max={Math.max(totalGames, 1)} color={s.color} />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Right sidebar */}
          <div className="space-y-6">

            {/* Streak card */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
              <Card variant="gaming" className="overflow-hidden relative">
                {(player?.current_streak ?? 0) >= 3 && (
                  <div className="absolute inset-0 bg-gradient-to-b from-orange-500/5 to-transparent pointer-events-none" />
                )}
                <CardContent className="pt-6 pb-6 flex flex-col items-center text-center">
                  <StreakDisplay
                    current={player?.current_streak ?? 0}
                    best={player?.best_streak ?? 0}
                  />
                  {(player?.current_streak ?? 0) >= 3 && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="mt-3 text-xs text-orange-400 font-gaming"
                    >
                      {(player?.current_streak ?? 0) >= 5 ? "YOU'RE ON FIRE! 🔥" : "KEEP IT UP! ⚡"}
                    </motion.p>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Active Wagers */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
              <Card variant="gaming">
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <CardTitle className="flex items-center gap-2 font-gaming text-base">
                    <Swords className="h-4 w-4 text-primary" />
                    Active Wagers
                  </CardTitle>
                  <Badge variant="outline" className="font-gaming">{activeWagers.length}</Badge>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  {activeWagers.length > 0 ? (
                    <>
                      {activeWagers.slice(0, 3).map((wager, i) => {
                        const game = getGameData(wager.game)
                        const opponent = wager.player_a_wallet === walletAddress
                          ? wager.player_b_wallet
                          : wager.player_a_wallet
                        const isLive = wager.status === 'joined' || wager.status === 'voting'
                        const isDisputed = wager.status === 'disputed' && !wager.grace_conceded_by
                        const isNonChessVoting = wager.status === 'voting' && wager.game !== 'chess'
                        const needsGameComplete = wager.status === 'voting' && wager.game !== 'chess' &&
                          !(wager.player_a_wallet === walletAddress ? wager.game_complete_a : wager.game_complete_b)

                        return (
                          <motion.div
                            key={wager.id}
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.4 + i * 0.05 }}
                            className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/50 hover:border-primary/30 transition-all"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="text-xl flex-shrink-0">{game.icon}</span>
                              <div className="min-w-0">
                                <div className="text-xs font-gaming truncate text-foreground">
                                  {opponent ? truncateAddress(opponent, 4) : 'Waiting...'}
                                </div>
                                <div className="text-[10px] text-muted-foreground">{formatSol(wager.stake_lamports)} SOL</div>
                              </div>
                            </div>
                            {isDisputed && (
                              <Button size="sm" variant="outline" className="text-[10px] h-6 px-2 flex-shrink-0 border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10"
                                onClick={() => handleOpenGrace(wager)}>
                                Disputed
                              </Button>
                            )}
                            {needsGameComplete && (
                              <Button size="sm" variant="neon" className="text-[10px] h-6 px-2 flex-shrink-0"
                                onClick={() => handleOpenGameComplete(wager)}>
                                Done
                              </Button>
                            )}
                            {isNonChessVoting && !needsGameComplete && (
                              <Button size="sm" variant="outline" className="text-[10px] h-6 px-2 flex-shrink-0"
                                onClick={() => handleOpenVoting(wager)}>
                                Vote
                              </Button>
                            )}
                            {isLive && !isNonChessVoting && !isDisputed && (
                              <span className="flex h-2 w-2 flex-shrink-0">
                                <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-green-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
                              </span>
                            )}
                          </motion.div>
                        )
                      })}
                      {activeWagers.length > 3 && (
                        <p className="text-xs text-center text-muted-foreground pt-1">
                          +{activeWagers.length - 3} more
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-center text-muted-foreground text-sm py-4">Nothing in play right now.</p>
                  )}
                  <Link href="/arena" className="block pt-1">
                    <Button variant="neon" className="w-full" size="sm">
                      <Swords className="h-4 w-4 mr-2" />
                      Find Match
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </motion.div>

            {/* Quick Actions */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
              <Card variant="gaming">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 font-gaming text-base">
                    <Star className="h-4 w-4 text-accent" />
                    Quick Actions
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  {[
                    { href: '/arena', icon: Swords, label: 'Create Wager' },
                    { href: '/leaderboard', icon: Trophy, label: 'Leaderboard' },
                    { href: '/profile', icon: Activity, label: 'Edit Profile' },
                  ].map(({ href, icon: Icon, label }) => (
                    <Link key={href} href={href} className="block">
                      <Button
                        variant="outline"
                        className="w-full justify-between hover:border-primary/50 hover:shadow-neon transition-all group"
                        size="sm"
                      >
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          {label}
                        </div>
                        <ChevronRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </Button>
                    </Link>
                  ))}
                </CardContent>
              </Card>
            </motion.div>

          </div>
        </div>
      </div>

      {/* Game Complete — non-chess wagers in voting state */}
      <GameCompleteModal
        wager={gameCompleteWagerLive ?? gameCompleteWager}
        open={gameCompleteOpen}
        onOpenChange={(open) => { setGameCompleteOpen(open); if (!open) setGameCompleteWager(null) }}
        currentWallet={walletAddress}
        onBothConfirmed={handleBothConfirmed}
      />

      {/* Voting — opens after both confirm, or directly if already confirmed */}
      <VotingModal
        wager={votingWagerLive ?? votingWager}
        open={votingOpen}
        onOpenChange={(open) => { setVotingOpen(open); if (!open) setVotingWager(null) }}
        currentWallet={walletAddress}
      />

      {/* Dispute Grace — shown when wager is disputed and not yet conceded */}
      <DisputeGraceModal
        wager={graceWager}
        open={graceOpen}
        onOpenChange={(open) => { setGraceOpen(open); if (!open) setGraceWager(null) }}
        currentWallet={walletAddress}
      />
    </div>
  )
}