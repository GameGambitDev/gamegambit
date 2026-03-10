'use client'

import { motion } from 'framer-motion'
import { useWallet } from '@solana/wallet-adapter-react'
import dynamic from 'next/dynamic'

const WalletMultiButton = dynamic(
  () => import('@solana/wallet-adapter-react-ui').then(m => ({ default: m.WalletMultiButton })),
  { ssr: false }
)
import {
  Trophy, Swords, TrendingUp, Wallet, Clock, Target,
  ChevronRight, Flame, Star, Activity, Loader2
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { truncateAddress, formatSol, GAMES } from '@/lib/constants'
import Link from 'next/link'
import { usePlayer } from '@/hooks/usePlayer'
import { useMyWagers } from '@/hooks/useWagers'
import { useWalletBalance } from '@/hooks/useWalletBalance'

const getGameData = (game: string) => {
  switch (game) {
    case 'chess': return GAMES.CHESS
    case 'codm': return GAMES.CODM
    case 'pubg': return GAMES.PUBG
    default: return GAMES.CHESS
  }
}

export default function DashboardPage() {
  const { connected, publicKey } = useWallet()
  const { data: player, isLoading: playerLoading } = usePlayer()
  const { data: wagers, isLoading: wagersLoading } = useMyWagers()
  const { data: walletBalance, isLoading: balanceLoading } = useWalletBalance()

  const activeWagers = wagers?.filter(w => ['created', 'joined', 'voting', 'disputed'].includes(w.status)) || []
  const completedWagers = wagers?.filter(w => w.status === 'resolved') || []
  const recentMatches = completedWagers.slice(0, 4)

  const walletAddress = publicKey?.toBase58() || ''
  const winRate = player && (player.total_wins + player.total_losses) > 0
    ? Math.round((player.total_wins / (player.total_wins + player.total_losses)) * 100)
    : 0

  const displayName = player?.username || (publicKey ? truncateAddress(publicKey.toBase58(), 4) : '')

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
            
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <h1 className="text-2xl sm:text-3xl font-bold mb-3 font-gaming">
                Welcome to <span className="text-primary">Game Gambit</span>
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground mb-6">
                Connect your Solana wallet to access your dashboard and start playing competitive matches.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="[&_.wallet-adapter-button]:!bg-primary [&_.wallet-adapter-button]:!text-primary-foreground [&_.wallet-adapter-button]:!font-gaming [&_.wallet-adapter-button]:!rounded-xl [&_.wallet-adapter-button]:!h-12 [&_.wallet-adapter-button]:!px-6 [&_.wallet-adapter-button]:!text-sm [&_.wallet-adapter-button]:sm:!h-14 [&_.wallet-adapter-button]:sm:!px-8 [&_.wallet-adapter-button]:sm:!text-base [&_.wallet-adapter-button]:hover:!shadow-neon [&_.wallet-adapter-button]:!transition-all mb-6"
            >
              <WalletMultiButton />
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="mt-8 p-4 rounded-lg bg-muted/40 border border-border/50"
            >
              <p className="text-xs sm:text-sm text-muted-foreground">
                We support all major Solana wallets including Phantom, Magic Eden, and more.
              </p>
            </motion.div>
          </div>
        </div>
      </div>
    )
  }

  if (playerLoading || wagersLoading) {
    return (
      <div className="py-8 pb-16">
        <div className="container px-4 flex justify-center items-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  return (
    <div className="py-8 pb-16">
      <div className="container px-4">
        {/* Welcome Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold font-gaming mb-2">
            Welcome back, <span className="text-primary">{displayName}</span>
          </h1>
          <p className="text-muted-foreground">{"Here's your gaming overview"}</p>
        </motion.div>

        {/* Quick Stats Row */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
        >
          {[
            { icon: Wallet, label: 'Balance', value: balanceLoading ? '...' : `${walletBalance?.toFixed(4) || '0'} SOL`, color: 'text-primary', bgColor: 'bg-primary/20' },
            { icon: TrendingUp, label: 'Total Earned', value: `+ ${player ? formatSol(player.total_earnings) : '0'} SOL`, color: 'text-success', bgColor: 'bg-success/20' },
            { icon: Trophy, label: 'Wins', value: player?.total_wins || 0, color: 'text-accent', bgColor: 'bg-accent/20' },
            { icon: Flame, label: 'Streak', value: `${player?.current_streak || 0} `, color: 'text-orange-500', bgColor: 'bg-orange-500/20' },
          ].map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + index * 0.05 }}
              whileHover={{ scale: 1.02, y: -2 }}
            >
              <Card variant="gaming" className="p-4 transition-all hover:border-primary/30">
                <div className="flex items-center gap-3">
                  <div className={`p - 2 rounded - lg ${stat.bgColor} `}>
                    <stat.icon className={`h - 5 w - 5 ${stat.color} `} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">{stat.label}</p>
                    <p className={`text - xl font - gaming font - bold ${stat.color} `}>{stat.value}</p>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content - Left Side */}
          <div className="lg:col-span-2 space-y-6">
            {/* Win Rate Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card variant="gaming">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-primary" />
                    Performance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm text-muted-foreground">Win Rate</span>
                        <span className="font-gaming text-primary">{winRate}%</span>
                      </div>
                      <Progress value={winRate} className="h-3" />
                    </div>
                    <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border/50">
                      <div className="text-center">
                        <p className="text-2xl font-gaming text-success">{player?.total_wins || 0}</p>
                        <p className="text-xs text-muted-foreground">Wins</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-gaming text-destructive">{player?.total_losses || 0}</p>
                        <p className="text-xs text-muted-foreground">Losses</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-gaming text-accent">{player?.best_streak || 0}</p>
                        <p className="text-xs text-muted-foreground">Best Streak</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Recent Matches */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card variant="gaming">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-primary" />
                    Recent Matches
                  </CardTitle>
                  <Link href="/my-wagers">
                    <Button variant="ghost" size="sm" className="text-primary">
                      View All <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </Link>
                </CardHeader>
                <CardContent>
                  {recentMatches.length > 0 ? (
                    <div className="space-y-3">
                      {recentMatches.map((match) => {
                        const game = getGameData(match.game)
                        const won = match.winner_wallet === walletAddress
                        const opponent = match.player_a_wallet === walletAddress
                          ? match.player_b_wallet
                          : match.player_a_wallet
                        const amount = won ? match.stake_lamports : -match.stake_lamports

                        return (
                          <div
                            key={match.id}
                            className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50"
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-2xl">{game.icon}</span>
                              <div>
                                <p className="font-medium">vs {opponent ? truncateAddress(opponent) : 'Unknown'}</p>
                                <p className="text-xs text-muted-foreground">{game.name}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <Badge variant={won ? 'success' : 'destructive'}>
                                {won ? 'WIN' : 'LOSS'}
                              </Badge>
                              <p className={`text - sm font - gaming mt - 1 ${amount > 0 ? 'text-success' : 'text-destructive'} `}>
                                {amount > 0 ? '+' : ''}{formatSol(Math.abs(amount))} SOL
                              </p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">No matches yet. Start playing!</p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Sidebar - Right Side */}
          <div className="space-y-6">
            {/* Active Wagers */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card variant="gaming">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Swords className="h-5 w-5 text-primary" />
                    Active Wagers
                  </CardTitle>
                  <Badge variant="outline">{activeWagers.length}</Badge>
                </CardHeader>
                <CardContent>
                  {activeWagers.length > 0 ? (
                    <div className="space-y-3">
                      {activeWagers.slice(0, 3).map((wager) => {
                        const game = getGameData(wager.game)
                        const opponent = wager.player_a_wallet === walletAddress
                          ? wager.player_b_wallet
                          : wager.player_a_wallet

                        return (
                          <div
                            key={wager.id}
                            className="p-3 rounded-lg bg-muted/30 border border-border/50"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xl">{game.icon}</span>
                                <span className="text-sm">{opponent ? truncateAddress(opponent) : 'Waiting...'}</span>
                              </div>
                              <Badge variant={wager.status === 'joined' ? 'live' : 'secondary'}>
                                {wager.status === 'joined' ? 'LIVE' : wager.status.toUpperCase()}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Stake: <span className="text-primary font-gaming">{formatSol(wager.stake_lamports)} SOL</span>
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-4">No active wagers</p>
                  )}
                  <Link href="/arena" className="block mt-4">
                    <Button variant="neon" className="w-full">
                      Find Match
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </motion.div>

            {/* Quick Actions */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <Card variant="gaming">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Star className="h-5 w-5 text-accent" />
                    Quick Actions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Link href="/arena" className="block">
                    <Button variant="outline" className="w-full justify-start hover:border-primary/50 hover:shadow-neon transition-all">
                      <Swords className="h-4 w-4 mr-2" /> Create Wager
                    </Button>
                  </Link>
                  <Link href="/leaderboard" className="block">
                    <Button variant="outline" className="w-full justify-start hover:border-primary/50 hover:shadow-neon transition-all">
                      <Trophy className="h-4 w-4 mr-2" /> View Leaderboard
                    </Button>
                  </Link>
                  <Link href="/profile" className="block">
                    <Button variant="outline" className="w-full justify-start hover:border-primary/50 hover:shadow-neon transition-all">
                      <Activity className="h-4 w-4 mr-2" /> Edit Profile
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}
