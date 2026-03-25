'use client'

import { use } from 'react'
import { motion } from 'framer-motion'
import { useWallet } from '@solana/wallet-adapter-react'
import { User, Trophy, Swords, Clock, Copy, Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { GAMES, truncateAddress, formatSol } from '@/lib/constants'
import { toast } from 'sonner'  // ✅ was: import { toast } from '@/hooks/use-toast'
import { usePlayerByWallet } from '@/hooks/usePlayer'
import { useLichessUser } from '@/hooks/useLichess'
import { GameAccountCard } from '@/components/GameAccountCard'
import { NFTGallery } from '@/components/NFTGallery'
import { AchievementBadges } from '@/components/AchievementBadges'
import { useState } from 'react'
import { redirect } from 'next/navigation'

interface ProfilePageProps {
  params: Promise<{ walletAddress: string }>
}

export default function ProfileByWalletPage({ params }: ProfilePageProps) {
  const { walletAddress } = use(params)
  const { publicKey } = useWallet()
  const currentUserWallet = publicKey?.toBase58()

  if (walletAddress === currentUserWallet) {
    redirect('/profile')
  }

  const { data: player, isLoading } = usePlayerByWallet(walletAddress)
  const { data: lichessUserData } = useLichessUser(player?.lichess_username)

  const [copiedAddress, setCopiedAddress] = useState(false)

  const gameAccounts = [
    { game: GAMES.CHESS, linkedUsername: player?.lichess_username || null, key: 'lichess_username' },
    { game: GAMES.CODM, linkedUsername: player?.codm_username || null, key: 'codm_username' },
    { game: GAMES.PUBG, linkedUsername: player?.pubg_username || null, key: 'pubg_username' },
  ]

  const copyAddress = () => {
    navigator.clipboard.writeText(walletAddress)
    setCopiedAddress(true)
    setTimeout(() => setCopiedAddress(false), 2000)
    toast.success('Address copied!')  // ✅ fixed
  }

  const totalWins = player?.total_wins ?? 0
  const totalLosses = player?.total_losses ?? 0
  const winRate = (totalWins + totalLosses) > 0
    ? Math.round((totalWins / (totalWins + totalLosses)) * 100)
    : 0

  if (isLoading) {
    return (
      <div className="py-8 pb-16">
        <div className="container px-4 flex justify-center items-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  if (!player) {
    return (
      <div className="py-8 pb-16">
        <div className="container px-4">
          <div className="max-w-md mx-auto text-center py-20">
            <div className="mb-8">
              <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-6">
                <User className="h-10 w-10 text-muted-foreground" />
              </div>
              <h1 className="text-3xl font-bold mb-4 font-gaming">Player Not Found</h1>
              <p className="text-muted-foreground mb-8">
                {"This player hasn't joined the platform yet."}
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="py-8 pb-16">
      <div className="container px-4 max-w-4xl">
        {/* Profile Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <Card variant="gaming" className="p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
              <motion.div
                whileHover={{ scale: 1.05 }}
                className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center border border-primary/30"
              >
                <User className="h-10 w-10 text-primary" />
              </motion.div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-2xl font-bold font-gaming">
                    {player.username || truncateAddress(walletAddress, 6)}
                  </h1>
                  {player.username && (
                    <span className="text-sm text-muted-foreground">
                      ({truncateAddress(walletAddress, 4)})
                    </span>
                  )}
                  <Badge variant="outline" className="ml-2">Viewing Profile</Badge>
                  <Button variant="ghost" size="icon" onClick={copyAddress}>
                    {copiedAddress ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Trophy className="h-4 w-4 text-accent" />
                    {totalWins} Wins
                  </span>
                  <span className="flex items-center gap-1">
                    <Swords className="h-4 w-4" />
                    {winRate}% Win Rate
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    Joined {new Date(player.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </span>
                </div>
              </div>
              <Badge variant="gold" className="text-base px-4 py-2">
                +{formatSol(player.total_earnings ?? 0)} SOL
              </Badge>
            </div>
          </Card>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Linked Accounts */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card variant="gaming">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-xl">{'🎮'}</span>
                  Game Accounts
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {gameAccounts.map((account, index) => (
                  <motion.div
                    key={account.game.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15 + index * 0.05 }}
                  >
                    <GameAccountCard
                      game={account.game}
                      linkedUsername={account.linkedUsername}
                      onLink={async (_username: string) => { }}
                      onAppeal={async (_game: string, _username: string) => { }}
                      onChangeRequest={async (_payload) => { }}
                    />
                  </motion.div>
                ))}
              </CardContent>
            </Card>

            {/* Lichess Stats */}
            {lichessUserData && (
              <Card variant="gaming" className="mt-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="text-xl">{'♟️'}</span>
                    Lichess Stats
                    {lichessUserData.online && (
                      <Badge variant="live" className="ml-2">Online</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {lichessUserData.perfs?.bullet && (
                      <div className="p-3 rounded-lg bg-muted/30 text-center">
                        <div className="text-xs text-muted-foreground uppercase">Bullet</div>
                        <div className="font-gaming text-lg text-primary">{lichessUserData.perfs.bullet.rating}</div>
                        <div className="text-xs text-muted-foreground">{lichessUserData.perfs.bullet.games} games</div>
                      </div>
                    )}
                    {lichessUserData.perfs?.blitz && (
                      <div className="p-3 rounded-lg bg-muted/30 text-center">
                        <div className="text-xs text-muted-foreground uppercase">Blitz</div>
                        <div className="font-gaming text-lg text-primary">{lichessUserData.perfs.blitz.rating}</div>
                        <div className="text-xs text-muted-foreground">{lichessUserData.perfs.blitz.games} games</div>
                      </div>
                    )}
                    {lichessUserData.perfs?.rapid && (
                      <div className="p-3 rounded-lg bg-muted/30 text-center">
                        <div className="text-xs text-muted-foreground uppercase">Rapid</div>
                        <div className="font-gaming text-lg text-primary">{lichessUserData.perfs.rapid.rating}</div>
                        <div className="text-xs text-muted-foreground">{lichessUserData.perfs.rapid.games} games</div>
                      </div>
                    )}
                    {lichessUserData.perfs?.classical && (
                      <div className="p-3 rounded-lg bg-muted/30 text-center">
                        <div className="text-xs text-muted-foreground uppercase">Classical</div>
                        <div className="font-gaming text-lg text-primary">{lichessUserData.perfs.classical.rating}</div>
                        <div className="text-xs text-muted-foreground">{lichessUserData.perfs.classical.games} games</div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </motion.div>

          {/* Stats */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card variant="gaming">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-accent" />
                  Statistics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Total Matches', value: totalWins + totalLosses },
                    { label: 'Wins', value: totalWins },
                    { label: 'Losses', value: totalLosses },
                    { label: 'Win Rate', value: `${winRate}%` },
                    { label: 'Total Wagered', value: `${formatSol(player.total_wagered ?? 0)} SOL` },
                    { label: 'Total Earned', value: `${formatSol(player.total_earnings ?? 0)} SOL` },
                    { label: 'Best Streak', value: `${player.best_streak ?? 0} wins` },
                    { label: 'Current Streak', value: `${player.current_streak ?? 0} wins` },
                  ].map((stat, index) => (
                    <motion.div
                      key={stat.label}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.25 + index * 0.03 }}
                      className="p-3 rounded-lg bg-muted/30"
                    >
                      <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                        {stat.label}
                      </div>
                      <div className="font-gaming text-lg">{stat.value}</div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <NFTGallery walletAddress={walletAddress} />
            <AchievementBadges walletAddress={walletAddress} />
          </motion.div>
        </div>
      </div>
    </div>
  )
}