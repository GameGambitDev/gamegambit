'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { useWallet } from '@solana/wallet-adapter-react'
import { useWalletReady } from '@/app/providers'
import dynamic from 'next/dynamic'

const WalletMultiButton = dynamic(
  () => import('@solana/wallet-adapter-react-ui').then(m => ({ default: m.WalletMultiButton })),
  { ssr: false }
)
import {
  User, Trophy, Swords, Clock, Copy, Check, Loader2,
  Wallet, Edit2, Save, Link2, CheckCircle2,
  LogOut as Unlink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { GAMES, truncateAddress, formatSol } from '@/lib/constants'
import { toast } from '@/hooks/use-toast'
import { usePlayer, useCreatePlayer, useUpdatePlayer } from '@/hooks/usePlayer'
import { useWalletBalance } from '@/hooks/useWalletBalance'
import {
  useLichessUser,
  useLichessConnected,
  useDisconnectLichess,
  startLichessOAuth,
} from '@/hooks/useLichess'
import { GameAccountCard } from '@/components/GameAccountCard'
import { NFTGallery } from '@/components/NFTGallery'
import { AchievementBadges } from '@/components/AchievementBadges'

// ── Inner component — uses useSearchParams, must be inside Suspense ──────────
function ProfilePageInner() {
  const { connected, publicKey } = useWallet()
  const walletReady = useWalletReady()
  const searchParams = useSearchParams()
  const currentUserWallet = publicKey?.toBase58()
  const viewingWallet = currentUserWallet

  const { data: player, isLoading } = usePlayer()
  const { data: walletBalance, isLoading: balanceLoading } = useWalletBalance()
  const createPlayer = useCreatePlayer()
  const updatePlayer = useUpdatePlayer()

  const { data: lichessConnected, isLoading: lichessLoading } = useLichessConnected()
  const disconnectLichess = useDisconnectLichess()
  const lichessUsername = (lichessConnected as any)?.lichess_username ?? null
  const isLichessConnected = !!lichessUsername

  const { data: lichessUserData } = useLichessUser(lichessUsername)

  const [platformUsername, setPlatformUsername] = useState('')
  const [isEditingUsername, setIsEditingUsername] = useState(false)
  const [copiedAddress, setCopiedAddress] = useState(false)
  const [isConnectingLichess, setIsConnectingLichess] = useState(false)

  // ── Handle return from Lichess OAuth callback ─────────────────────────────
  useEffect(() => {
    const lichessParam = searchParams?.get('lichess')
    const username = searchParams?.get('username')
    if (lichessParam === 'connected' && username) {
      toast({ title: `Lichess connected as @${username}! ✓` })
      window.history.replaceState({}, '', '/profile')
    } else if (lichessParam === 'denied') {
      toast({ title: 'Lichess connection cancelled', variant: 'destructive' })
      window.history.replaceState({}, '', '/profile')
    } else if (lichessParam === 'error') {
      const reason = searchParams?.get('reason') || 'unknown'
      toast({ title: `Lichess connection failed (${reason})`, variant: 'destructive' })
      window.history.replaceState({}, '', '/profile')
    }
  }, [searchParams])

  useEffect(() => {
    if (connected && !isLoading && !player && publicKey) {
      createPlayer.mutate()
    }
  }, [connected, isLoading, player, publicKey])

  useEffect(() => {
    if (player) setPlatformUsername(player.username || '')
  }, [player])

  const nonChessAccounts = [
    { game: GAMES.CODM, linkedUsername: player?.codm_username || null, key: 'codm_username' },
    { game: GAMES.PUBG, linkedUsername: player?.pubg_username || null, key: 'pubg_username' },
  ]

  const copyAddress = () => {
    if (viewingWallet) {
      navigator.clipboard.writeText(viewingWallet)
      setCopiedAddress(true)
      setTimeout(() => setCopiedAddress(false), 2000)
      toast({ title: 'Address copied!' })
    }
  }

  const handleUpdateUsername = async () => {
    if (!platformUsername.trim()) {
      toast({ title: 'Username cannot be empty', variant: 'destructive' })
      return
    }
    if (platformUsername.length < 3 || platformUsername.length > 20) {
      toast({ title: 'Username must be 3-20 characters', variant: 'destructive' })
      return
    }
    if (!/^[a-zA-Z0-9_]+$/.test(platformUsername)) {
      toast({ title: 'Only letters, numbers, and underscores allowed', variant: 'destructive' })
      return
    }
    try {
      await updatePlayer.mutateAsync({ username: platformUsername.trim() })
      toast({ title: 'Username updated!' })
      setIsEditingUsername(false)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update username'
      toast({ title: message, variant: 'destructive' })
    }
  }

  const handleLinkAccount = async (key: string, username: string) => {
    try {
      await updatePlayer.mutateAsync({ [key]: username })
      toast({ title: 'Account linked successfully!' })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to link account'
      toast({ title: message, variant: 'destructive' })
      throw error
    }
  }

  const handleConnectLichess = async () => {
    if (!publicKey) {
      toast({ title: 'Connect your wallet first', variant: 'destructive' })
      return
    }
    setIsConnectingLichess(true)
    try {
      await startLichessOAuth(publicKey.toBase58())
    } catch {
      setIsConnectingLichess(false)
      toast({ title: 'Failed to start Lichess authentication', variant: 'destructive' })
    }
  }

  const handleDisconnectLichess = async () => {
    try {
      await disconnectLichess.mutateAsync()
      toast({ title: 'Lichess account disconnected' })
    } catch {
      toast({ title: 'Failed to disconnect', variant: 'destructive' })
    }
  }

  const winRate = player && (player.total_wins + player.total_losses) > 0
    ? Math.round((player.total_wins / (player.total_wins + player.total_losses)) * 100)
    : 0

  if (!walletReady) {
    return (
      <div className="py-8 pb-16">
        <div className="container px-4 flex justify-center items-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  if (!connected) {
    return (
      <div className="py-8 pb-16">
        <div className="container px-4">
          <div className="max-w-md mx-auto text-center py-20">
            <div className="mb-8">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6 animate-glow-pulse">
                <User className="h-10 w-10 text-primary" />
              </div>
              <h1 className="text-3xl font-bold mb-4 font-gaming">Your Profile</h1>
              <p className="text-muted-foreground mb-8">
                Connect your wallet to view and manage your profile.
              </p>
            </div>
            <div className="[&_.wallet-adapter-button]:!bg-primary [&_.wallet-adapter-button]:!text-primary-foreground [&_.wallet-adapter-button]:!font-gaming [&_.wallet-adapter-button]:!rounded-xl [&_.wallet-adapter-button]:!h-12 [&_.wallet-adapter-button]:!px-8 [&_.wallet-adapter-button]:hover:!shadow-neon">
              <WalletMultiButton />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (isLoading) {
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
                    {player?.username || (viewingWallet && truncateAddress(viewingWallet, 6))}
                  </h1>
                  {player?.username && viewingWallet && (
                    <span className="text-sm text-muted-foreground">({truncateAddress(viewingWallet, 4)})</span>
                  )}
                  <Button variant="ghost" size="icon" onClick={copyAddress}>
                    {copiedAddress ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Wallet className="h-4 w-4 text-primary" />
                    {balanceLoading ? '...' : `${walletBalance?.toFixed(4) || '0'} SOL`}
                  </span>
                  <span className="flex items-center gap-1">
                    <Trophy className="h-4 w-4 text-accent" />
                    {player?.total_wins || 0} Wins
                  </span>
                  <span className="flex items-center gap-1">
                    <Swords className="h-4 w-4" />
                    {winRate}% Win Rate
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    Joined {player ? new Date(player.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Recently'}
                  </span>
                </div>
              </div>
              <Badge variant="gold" className="text-base px-4 py-2">
                +{player ? formatSol(player.total_earnings) : '0'} SOL
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
                  <Link2 className="h-5 w-5 text-primary" />
                  Linked Game Accounts
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">

                {/* ── Chess / Lichess — OAuth ── */}
                <div className="p-3 rounded-lg border border-border bg-muted/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">♟️</span>
                      <div>
                        <p className="font-medium text-sm">Chess (Lichess)</p>
                        {lichessLoading ? (
                          <p className="text-xs text-muted-foreground">Checking…</p>
                        ) : isLichessConnected ? (
                          <p className="text-xs text-success">@{lichessUsername}</p>
                        ) : (
                          <p className="text-xs text-muted-foreground">Not connected</p>
                        )}
                      </div>
                    </div>

                    {!lichessLoading && (
                      isLichessConnected ? (
                        <div className="flex items-center gap-2">
                          <Badge variant="success" className="text-xs">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Verified
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={handleDisconnectLichess}
                            disabled={disconnectLichess.isPending}
                            title="Disconnect Lichess"
                          >
                            {disconnectLichess.isPending
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : <Unlink className="h-3.5 w-3.5" />
                            }
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs border-primary/40 hover:border-primary"
                          onClick={handleConnectLichess}
                          disabled={isConnectingLichess}
                        >
                          {isConnectingLichess
                            ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Connecting…</>
                            : '♟ Connect'
                          }
                        </Button>
                      )
                    )}
                  </div>

                  {isLichessConnected && (
                    <div className="flex items-start gap-2 p-2 rounded bg-success/5 border border-success/10">
                      <CheckCircle2 className="h-3.5 w-3.5 text-success mt-0.5 flex-shrink-0" />
                      <p className="text-[11px] text-muted-foreground">
                        Identity verified via Lichess OAuth. GameGambit can create games on your behalf but cannot access your password or account settings.
                      </p>
                    </div>
                  )}

                  {!lichessLoading && !isLichessConnected && (
                    <div className="space-y-1">
                      <p className="text-[11px] text-muted-foreground">
                        Connecting via OAuth proves you own this Lichess account. Required to play chess wagers.
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        No account?{' '}
                        <a
                          href="https://lichess.org/signup"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline"
                        >
                          Create one free on Lichess
                        </a>
                      </p>
                    </div>
                  )}
                </div>

                {/* CODM + PUBG */}
                {nonChessAccounts.map((account, index) => (
                  <motion.div
                    key={account.game.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15 + index * 0.05 }}
                  >
                    <GameAccountCard
                      game={account.game}
                      linkedUsername={account.linkedUsername}
                      onLink={(username) => handleLinkAccount(account.key, username)}
                      isPending={updatePlayer.isPending}
                      isOwnProfile={true}
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
                    <span className="text-xl">♟️</span>
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
                    { label: 'Total Matches', value: player ? player.total_wins + player.total_losses : 0 },
                    { label: 'Wins', value: player?.total_wins || 0 },
                    { label: 'Losses', value: player?.total_losses || 0 },
                    { label: 'Win Rate', value: `${winRate}%` },
                    { label: 'Total Wagered', value: `${player ? formatSol(player.total_wagered) : '0'} SOL` },
                    { label: 'Total Earned', value: `${player ? formatSol(player.total_earnings) : '0'} SOL` },
                    { label: 'Best Streak', value: `${player?.best_streak || 0} wins` },
                    { label: 'Current Streak', value: `${player?.current_streak || 0} wins` },
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

            <NFTGallery walletAddress={viewingWallet || null} />
            <AchievementBadges walletAddress={viewingWallet || null} />
          </motion.div>

          {/* Account Settings */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-2"
          >
            <Card variant="gaming">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Edit2 className="h-5 w-5 text-primary" />
                  Account Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="platform-username">Platform Username</Label>
                  <div className="flex gap-2">
                    <Input
                      id="platform-username"
                      placeholder="Your platform username"
                      value={platformUsername}
                      onChange={(e) => setPlatformUsername(e.target.value)}
                      className="bg-muted/50 max-w-xs"
                      disabled={!isEditingUsername && !!player?.username}
                    />
                    {player?.username && !isEditingUsername ? (
                      <Button
                        variant="outline"
                        onClick={() => setIsEditingUsername(true)}
                        className="hover:border-primary/50 hover:shadow-neon transition-all"
                      >
                        <Edit2 className="h-4 w-4 mr-2" /> Edit
                      </Button>
                    ) : (
                      <Button
                        variant="neon"
                        disabled={!platformUsername.trim() || updatePlayer.isPending}
                        onClick={handleUpdateUsername}
                      >
                        {updatePlayer.isPending
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <><Save className="h-4 w-4 mr-2" /> Save</>
                        }
                      </Button>
                    )}
                    {isEditingUsername && (
                      <Button
                        variant="ghost"
                        onClick={() => { setIsEditingUsername(false); setPlatformUsername(player?.username || '') }}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Your username will be visible to other players
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

// ── Page export — Suspense required by Next.js 15 for useSearchParams ────────
export default function ProfilePage() {
  return (
    <Suspense fallback={
      <div className="py-8 pb-16">
        <div className="container px-4 flex justify-center items-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    }>
      <ProfilePageInner />
    </Suspense>
  )
}