'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useWallet } from '@solana/wallet-adapter-react'
import { useWalletReady } from '@/app/providers'
import { useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'

const WalletMultiButton = dynamic(
  () => import('@solana/wallet-adapter-react-ui').then(m => ({ default: m.WalletMultiButton })),
  { ssr: false }
)
import { Search, Zap, Filter, Plus, Swords, Clock, Trophy, Loader2, Wallet, Eye, Pencil, Trash2, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { GAMES, formatSol, truncateAddress } from '@/lib/constants'
import { useOpenWagers, useLiveWagers, useRecentWinners, useJoinWager, useEditWager, useDeleteWager, useSetReady, useWagerById, useCheckGameComplete, Wager, GameType } from '@/hooks/useWagers'
import { usePlayer, useSearchPlayers, usePlayerByWallet, usePlayersByWallets } from '@/hooks/usePlayer'
import { useWalletBalance } from '@/hooks/useWalletBalance'
import { useQuickMatch } from '@/hooks/useQuickMatch'
import { useIsProfileComplete } from '@/components/UsernameEnforcer'
import { CreateWagerModal } from '@/components/CreateWagerModal'
import { WagerDetailsModal } from '@/components/WagerDetailsModal'
import { QuickMatchModal } from '@/components/QuickMatchModal'
import { ReadyRoomModal } from '@/components/ReadyRoomModal'
import { EditWagerModal, EditWagerData } from '@/components/EditWagerModal'
import { LiveGameModal } from '@/components/LiveGameModal'
import { GameResultModal } from '@/components/GameResultModal'
import { PlayerLink } from '@/components/PlayerLink'
import { staggerContainer, staggerItem } from '@/components/PageTransition'
import { toast } from 'sonner'

const getGameData = (game: string) => {
  switch (game) {
    case 'chess': return GAMES.CHESS
    case 'codm': return GAMES.CODM
    case 'pubg': return GAMES.PUBG
    default: return GAMES.CHESS
  }
}

function OpenWagerCard({
  wager, onJoin, onViewDetails, onEdit, onDelete, isJoining, isOwner, creatorUsername
}: {
  wager: Wager
  onJoin: (id: string) => void
  onViewDetails: (wager: Wager) => void
  onEdit?: (wager: Wager) => void
  onDelete?: (wager: Wager) => void
  isJoining?: boolean
  isOwner?: boolean
  creatorUsername?: string | null
}) {
  const game = getGameData(wager.game)
  const timeDiff = Math.floor((Date.now() - new Date(wager.created_at).getTime()) / 60000)

  return (
    <Card variant="wager" className="group cursor-pointer hover:border-primary/40 transition-all duration-300" onClick={() => onViewDetails(wager)}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-3xl">{game.icon}</div>
            <div>
              <div className="font-gaming text-sm mb-1">
                <PlayerLink walletAddress={wager.player_a_wallet} username={creatorUsername} className="font-gaming" />
                {isOwner && <span className="ml-2 text-xs text-primary">(You)</span>}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{game.name}</span>
                <span>•</span>
                <Clock className="h-3 w-3" />
                <span>{timeDiff}m ago</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="font-gaming text-sm sm:text-lg font-bold text-accent whitespace-nowrap">{formatSol(wager.stake_lamports)} SOL</div>
            </div>
            <div className="flex gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
              {isOwner ? (
                <>
                  <Button variant="outline" size="sm" onClick={() => onEdit?.(wager)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="destructive" size="sm" onClick={() => onDelete?.(wager)}><Trash2 className="h-4 w-4" /></Button>
                </>
              ) : (
                <>
                  <Button variant="outline" size="sm" onClick={() => onViewDetails(wager)}><Eye className="h-4 w-4" /></Button>
                  <Button variant="neon" size="sm" onClick={() => onJoin(wager.id)} disabled={isJoining}>
                    {isJoining ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Accept'}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function LiveMatchCard({
  wager, onEnterReadyRoom, onWatchGame, onViewDetails, currentWallet
}: {
  wager: Wager
  onEnterReadyRoom?: (wagerId: string) => void
  onWatchGame?: (wager: Wager) => void
  onViewDetails?: (wager: Wager) => void
  currentWallet?: string
}) {
  const game = getGameData(wager.game)
  const timeDiff = Math.floor((Date.now() - new Date(wager.created_at).getTime()) / 60000)
  const isParticipant = currentWallet === wager.player_a_wallet || currentWallet === wager.player_b_wallet
  const isResolved = wager.status === 'resolved' || (wager.status as string) === 'closed'
  const canEnterReadyRoom = wager.status === 'joined' && isParticipant
  const isInProgress = wager.status === 'voting'

  const handleClick = () => {
    if (isResolved) onViewDetails?.(wager)
    else if (canEnterReadyRoom) onEnterReadyRoom?.(wager.id)
    else if (isInProgress) onWatchGame?.(wager)
  }

  return (
    <Card variant="wager" className="cursor-pointer border-primary/20 hover:border-primary/40 transition-all duration-300" onClick={handleClick}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative flex-shrink-0">
              <div className="text-2xl sm:text-3xl">{game.icon}</div>
              {!isResolved && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-destructive" />
                </span>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1 sm:gap-2 mb-1 flex-wrap">
                <span className="font-gaming text-xs sm:text-sm truncate max-w-[80px] sm:max-w-none">{truncateAddress(wager.player_a_wallet)}</span>
                <Swords className="h-3 w-3 sm:h-4 sm:w-4 text-primary flex-shrink-0" />
                <span className="font-gaming text-xs sm:text-sm truncate max-w-[80px] sm:max-w-none">{wager.player_b_wallet ? truncateAddress(wager.player_b_wallet) : '???'}</span>
              </div>
              <div className="flex items-center gap-1 sm:gap-2 text-xs text-muted-foreground">
                <span>{game.name}</span>
                <span>•</span>
                <span>{timeDiff}m</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1 sm:gap-3 flex-shrink-0">
            <div className="font-gaming text-sm sm:text-base text-accent whitespace-nowrap">{formatSol(wager.stake_lamports * 2)} SOL</div>
            {isResolved ? (
              <Badge variant="outline" className="cursor-pointer text-xs whitespace-nowrap">{wager.winner_wallet ? '🏆 View Result' : '🤝 Draw'}</Badge>
            ) : canEnterReadyRoom ? (
              <Badge variant="joined" className="cursor-pointer text-xs whitespace-nowrap">Ready Room</Badge>
            ) : isInProgress && isParticipant ? (
              <Badge variant="voting" className="cursor-pointer flex items-center gap-1 text-xs whitespace-nowrap"><Play className="h-3 w-3" /> Watch</Badge>
            ) : (
              <Badge variant={wager.status === 'voting' ? 'voting' : 'joined'} className="text-xs whitespace-nowrap">
                {wager.status === 'voting' ? 'In Progress' : 'Ready Room'}
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="text-center py-12 px-4">
      <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
        <Swords className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="font-gaming text-lg mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm">{description}</p>
    </div>
  )
}

function ArenaInner() {
  const { connected, publicKey } = useWallet()
  const walletReady = useWalletReady()
  const walletAddress = publicKey?.toBase58()
  const searchParams = useSearchParams()
  const [searchQuery, setSearchQuery] = useState('')
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [quickMatchModalOpen, setQuickMatchModalOpen] = useState(false)
  const [selectedWager, setSelectedWager] = useState<Wager | null>(null)
  const [detailsModalOpen, setDetailsModalOpen] = useState(false)
  const [readyRoomWagerId, setReadyRoomWagerId] = useState<string | null>(null)
  const [editWager, setEditWager] = useState<Wager | null>(null)
  const [editModalOpen, setEditModalOpen] = useState(false)

  const [liveGameWagerId, setLiveGameWagerId] = useState<string | null>(null)
  const [liveGameModalOpen, setLiveGameModalOpen] = useState(false)

  const [gameResultOpen, setGameResultOpen] = useState(false)
  const [gameResultWager, setGameResultWager] = useState<Wager | null>(null)
  const shownResultForRef = useRef<Set<string>>(new Set())

  const queryClient = useQueryClient()
  const checkGameComplete = useCheckGameComplete()


  // ── Deep-link from notification: ?wager=<id>&modal=ready-room ─────────────
  useEffect(() => {
    const wagerId = searchParams.get('wager')
    const modal = searchParams.get('modal')
    if (!wagerId || !modal) return
    if (modal === 'ready-room') {
      setReadyRoomWagerId(wagerId)
    } else if (modal === 'details') {
      // wager data loads via useWagerById when id is set
      setReadyRoomWagerId(null)
    }
    // Clear the params from URL without reload
    const url = new URL(window.location.href)
    url.searchParams.delete('wager')
    url.searchParams.delete('modal')
    window.history.replaceState({}, '', url.pathname)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { data: openWagers, isLoading: openLoading } = useOpenWagers()
  const { data: liveWagers, isLoading: liveLoading } = useLiveWagers()

  const liveGameWager = useMemo(() => {
    if (!liveGameWagerId) return null
    return liveWagers?.find(w => w.id === liveGameWagerId) ?? null
  }, [liveGameWagerId, liveWagers])

  const showResult = useCallback((w: Wager) => {
    if (!walletAddress) return
    if (shownResultForRef.current.has(w.id)) return

    const isParticipant = w.player_a_wallet === walletAddress || w.player_b_wallet === walletAddress
    if (!isParticipant) return

    shownResultForRef.current.add(w.id)

    if (liveGameWagerId === w.id) {
      setLiveGameModalOpen(false)
      setLiveGameWagerId(null)
    }

    setGameResultWager(w)
    setGameResultOpen(true)
  }, [walletAddress, liveGameWagerId])

  const inFlightChecksRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    const votingWagers = liveWagers?.filter(w => w.status === 'voting') ?? []
    if (votingWagers.length === 0) return

    const interval = setInterval(() => {
      votingWagers.forEach(w => {
        if (inFlightChecksRef.current.has(w.id)) return
        inFlightChecksRef.current.add(w.id)

        checkGameComplete.mutate({ wagerId: w.id }, {
          onSuccess: (result: any) => {
            if (result?.gameComplete && result?.wager && result.wager.status === 'resolved') {
              showResult(result.wager)
            }
            queryClient.invalidateQueries({ queryKey: ['wagers'] })
          },
          onSettled: () => {
            inFlightChecksRef.current.delete(w.id)
          }
        })
      })
    }, 8000)

    return () => clearInterval(interval)
  }, [liveWagers, showResult, queryClient])

  useEffect(() => {
    return queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== 'updated') return
      const key = event.query.queryKey
      if (!Array.isArray(key) || key[0] !== 'wagers' || key[1] !== 'last-resolved') return

      const w = event.query.state.data as Wager | undefined
      if (!w) return

      showResult(w)
      queryClient.removeQueries({ queryKey: ['wagers', 'last-resolved'] })
    })
  }, [queryClient, showResult])

  const prevLiveWagersRef = useRef<Wager[]>([])
  useEffect(() => {
    if (!liveWagers || !walletAddress) return
    const prev = prevLiveWagersRef.current

    liveWagers.forEach(w => {
      if (w.status !== 'resolved' && (w.status as string) !== 'closed') return
      const wasLive = prev.find(p => p.id === w.id && p.status !== 'resolved' && (p.status as string) !== 'closed')
      if (wasLive) showResult(w)
    })

    prevLiveWagersRef.current = liveWagers
  }, [liveWagers, walletAddress, showResult])

  const { data: recentWinners, isLoading: winnersLoading } = useRecentWinners(5)
  const { data: player } = usePlayer()
  const { data: walletBalance, isLoading: balanceLoading } = useWalletBalance()
  const { data: readyRoomWager } = useWagerById(readyRoomWagerId)
  const quickMatch = useQuickMatch()
  const joinWager = useJoinWager()
  const editWagerMutation = useEditWager()
  const deleteWagerMutation = useDeleteWager()
  const setReadyMutation = useSetReady()
  const { isComplete: profileComplete, needsSetup } = useIsProfileComplete()
  const { data: searchedPlayers } = useSearchPlayers(searchQuery)

  const { data: winnerPlayerA } = usePlayerByWallet(gameResultWager?.player_a_wallet || null)
  const { data: winnerPlayerB } = usePlayerByWallet(gameResultWager?.player_b_wallet || null)
  const gameResultWinnerUsername = gameResultWager?.winner_wallet === gameResultWager?.player_a_wallet
    ? winnerPlayerA?.username
    : winnerPlayerB?.username

  const wagerWalletAddresses = useMemo(() => {
    const addresses = new Set<string>()
    openWagers?.forEach(w => { addresses.add(w.player_a_wallet); if (w.player_b_wallet) addresses.add(w.player_b_wallet) })
    liveWagers?.forEach(w => { addresses.add(w.player_a_wallet); if (w.player_b_wallet) addresses.add(w.player_b_wallet) })
    return Array.from(addresses)
  }, [openWagers, liveWagers])

  const { data: wagerPlayers } = usePlayersByWallets(wagerWalletAddresses)

  const playerUsernameMap = useMemo(() => {
    const map: Record<string, string | null> = {}
    wagerPlayers?.forEach(p => { map[p.wallet_address.toLowerCase()] = p.username })
    searchedPlayers?.forEach(p => { map[p.wallet_address.toLowerCase()] = p.username })
    return map
  }, [wagerPlayers, searchedPlayers])

  const filteredOpenWagers = useMemo(() => {
    if (!openWagers) return []
    if (!searchQuery.trim()) return openWagers
    const query = searchQuery.toLowerCase()
    const matchedWallets = searchedPlayers?.map(p => p.wallet_address.toLowerCase()) || []
    return openWagers.filter(wager =>
      wager.player_a_wallet.toLowerCase().includes(query) ||
      matchedWallets.includes(wager.player_a_wallet.toLowerCase())
    )
  }, [openWagers, searchQuery, searchedPlayers])

  const filteredLiveWagers = useMemo(() => {
    if (!liveWagers) return []
    if (!searchQuery.trim()) return liveWagers
    const query = searchQuery.toLowerCase()
    const matchedWallets = searchedPlayers?.map(p => p.wallet_address.toLowerCase()) || []
    return liveWagers.filter(wager =>
      wager.player_a_wallet.toLowerCase().includes(query) ||
      wager.player_b_wallet?.toLowerCase().includes(query) ||
      matchedWallets.includes(wager.player_a_wallet.toLowerCase()) ||
      (wager.player_b_wallet && matchedWallets.includes(wager.player_b_wallet.toLowerCase()))
    )
  }, [liveWagers, searchQuery, searchedPlayers])

  const handleQuickMatch = () => {
    if (needsSetup) { toast.error('Please set up your username first'); return }
    setQuickMatchModalOpen(true)
  }

  const handleQuickMatchSubmit = (game?: GameType) => {
    quickMatch.mutate(game, { onSuccess: () => setQuickMatchModalOpen(false) })
  }

  const handleViewDetails = (wager: Wager) => {
    setSelectedWager(wager)
    setDetailsModalOpen(true)
  }

  const handleEditWager = (wager: Wager) => {
    setEditWager(wager)
    setEditModalOpen(true)
  }

  const handleDeleteWager = async (wager: Wager) => {
    if (!confirm('Are you sure you want to delete this wager?')) return
    try {
      await deleteWagerMutation.mutateAsync({ wagerId: wager.id })
      toast.success('Wager deleted successfully')
      setDetailsModalOpen(false)
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete wager')
    }
  }

  const handleSaveEditWager = async (updates: EditWagerData) => {
    if (!editWager) return
    try {
      await editWagerMutation.mutateAsync({ wagerId: editWager.id, ...updates })
      toast.success('Wager updated successfully')
      setEditModalOpen(false)
      setEditWager(null)
    } catch (err: any) {
      toast.error(err.message || 'Failed to update wager')
    }
  }

  const handleSetReady = async (ready: boolean) => {
    if (!readyRoomWagerId) return
    try {
      await setReadyMutation.mutateAsync({ wagerId: readyRoomWagerId, ready })
    } catch (err: any) {
      toast.error(err.message || 'Failed to set ready status')
    }
  }

  const handleCreateWager = () => {
    if (needsSetup) { toast.error('Please set up your username first'); return }
    setCreateModalOpen(true)
  }

  const handleJoinWager = async (wagerId: string) => {
    if (needsSetup) { toast.error('Please set up your username first'); return }
    try {
      await joinWager.mutateAsync({ wagerId })
      toast.success('Wager joined! Entering ready room...')
      setReadyRoomWagerId(wagerId)
      setDetailsModalOpen(false)
    } catch (err: any) {
      toast.error(err.message || 'Failed to join wager')
    }
  }

  const handleWatchGame = (wager: Wager) => {
    if (wager.status === 'resolved' || (wager.status as string) === 'closed') {
      handleViewDetails(wager)
    } else {
      setLiveGameWagerId(wager.id)
      setLiveGameModalOpen(true)
    }
  }

  const gameResultTotalPot = (gameResultWager?.stake_lamports ?? 0) * 2
  const gameResultPlatformFee = Math.floor(gameResultTotalPot * 0.1)
  const gameResultPayout = gameResultTotalPot - gameResultPlatformFee
  const gameResultIsDraw = gameResultWager?.status === 'resolved' && !gameResultWager?.winner_wallet
  const gameResultType: 'win' | 'lose' | 'draw' = gameResultIsDraw
    ? 'draw'
    : gameResultWager?.winner_wallet === walletAddress
      ? 'win'
      : 'lose'

  // Still waiting for autoConnect to resolve — don't flash the connect screen
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
                <Swords className="h-10 w-10 text-primary" />
              </div>
              <h1 className="text-3xl font-bold mb-4 font-gaming">Connect to Enter Arena</h1>
              <p className="text-muted-foreground mb-8">
                Connect your Solana wallet to browse wagers, challenge opponents, and start winning.
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

  return (
    <div className="py-8 pb-16">
      <div className="container px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8"
        >
          <div>
            <h1 className="text-3xl font-bold mb-2 font-gaming"><span className="text-primary">Arena</span></h1>
            <p className="text-muted-foreground">Find opponents and stake your claim</p>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="w-full md:w-auto">
              <Button variant="neon" className="group w-full md:w-auto" onClick={handleCreateWager}>
                <Plus className="h-4 w-4 mr-2" />Create Wager
              </Button>
            </motion.div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col sm:flex-row gap-4 mb-8"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by wallet address or username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-card border-border"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleQuickMatch} disabled={quickMatch.isPending} className="hover:border-primary/50 hover:shadow-neon transition-all">
              {quickMatch.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
              Quick Match
            </Button>
            <Button variant="ghost" size="icon"><Filter className="h-4 w-4" /></Button>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <div className="flex items-center gap-2 mb-4">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive" />
                </span>
                <h2 className="font-gaming text-lg">Live Matches</h2>
                <Badge variant="outline" className="ml-auto">{filteredLiveWagers.length}</Badge>
              </div>
              {liveLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : filteredLiveWagers.length > 0 ? (
                <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-3">
                  {filteredLiveWagers.map((wager) => (
                    <motion.div key={wager.id} variants={staggerItem}>
                      <LiveMatchCard
                        wager={wager}
                        currentWallet={walletAddress}
                        onEnterReadyRoom={setReadyRoomWagerId}
                        onWatchGame={handleWatchGame}
                        onViewDetails={handleViewDetails}
                      />
                    </motion.div>
                  ))}
                </motion.div>
              ) : (
                <Card variant="gaming" className="p-6 text-center text-muted-foreground">No live matches right now</Card>
              )}
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <div className="flex items-center gap-2 mb-4">
                <h2 className="font-gaming text-lg">Open Wagers</h2>
                <Badge variant="outline" className="ml-auto">{filteredOpenWagers.length}</Badge>
              </div>
              {openLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : filteredOpenWagers.length > 0 ? (
                <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-3">
                  {filteredOpenWagers.map((wager) => (
                    <motion.div key={wager.id} variants={staggerItem}>
                      <OpenWagerCard
                        wager={wager}
                        onJoin={handleJoinWager}
                        onViewDetails={handleViewDetails}
                        onEdit={handleEditWager}
                        onDelete={handleDeleteWager}
                        isJoining={joinWager.isPending}
                        isOwner={wager.player_a_wallet === walletAddress}
                        creatorUsername={playerUsernameMap[wager.player_a_wallet.toLowerCase()]}
                      />
                    </motion.div>
                  ))}
                </motion.div>
              ) : (
                <EmptyState title="No Open Wagers" description="Be the first to create a wager and challenge others!" />
              )}
            </motion.div>
          </div>

          <div className="space-y-6">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
              <Card variant="gaming" className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-primary/20">
                    <Wallet className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground uppercase">Your Balance</div>
                    <div className="font-gaming text-xl text-primary">
                      {balanceLoading ? '...' : `${walletBalance?.toFixed(4) || '0'} SOL`}
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
              <Card variant="gaming">
                <div className="p-4 border-b border-border/50">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-accent" />
                    <h3 className="font-gaming">Recent Winners</h3>
                  </div>
                </div>
                <div className="p-4">
                  {winnersLoading ? (
                    <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
                  ) : recentWinners && recentWinners.length > 0 ? (
                    <div className="space-y-3">
                      {recentWinners.map((wager) => {
                        const game = getGameData(wager.game)
                        return (
                          <div key={wager.id} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <span>{game.icon}</span>
                              <span className="font-gaming text-xs">
                                {wager.winner_wallet
                                  ? (playerUsernameMap[wager.winner_wallet.toLowerCase()] || truncateAddress(wager.winner_wallet))
                                  : 'Unknown'}
                              </span>
                            </div>
                            <span className="text-accent font-gaming">+{formatSol(wager.stake_lamports)}</span>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground text-sm py-4">No winners yet</p>
                  )}
                </div>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>

      <CreateWagerModal open={createModalOpen} onOpenChange={setCreateModalOpen} onSuccess={() => { setCreateModalOpen(false); queryClient.invalidateQueries({ queryKey: ['wagers'] }) }} />
      <QuickMatchModal open={quickMatchModalOpen} onOpenChange={setQuickMatchModalOpen} onMatch={handleQuickMatchSubmit} isPending={quickMatch.isPending} />
      <WagerDetailsModal
        wager={selectedWager}
        open={detailsModalOpen}
        onOpenChange={setDetailsModalOpen}
        onJoin={handleJoinWager}
        onEdit={handleEditWager}
        onDelete={handleDeleteWager}
        isJoining={joinWager.isPending}
      />
      <ReadyRoomModal
        wager={readyRoomWager || null}
        open={!!readyRoomWagerId}
        onOpenChange={(open) => !open && setReadyRoomWagerId(null)}
        onReady={handleSetReady}
        onEditWager={() => {
          if (readyRoomWager) { setEditWager(readyRoomWager); setEditModalOpen(true) }
        }}
        isSettingReady={setReadyMutation.isPending}
        currentWallet={walletAddress}
      />
      <EditWagerModal
        wager={editWager}
        open={editModalOpen}
        onOpenChange={(open) => { setEditModalOpen(open); if (!open) setEditWager(null) }}
        onSave={handleSaveEditWager}
        isSaving={editWagerMutation.isPending}
        canEditGameId={editWager?.status === 'created'}
      />
      <LiveGameModal
        wager={liveGameWager}
        open={liveGameModalOpen}
        onOpenChange={(open) => {
          setLiveGameModalOpen(open)
          if (!open) setLiveGameWagerId(null)
        }}
        currentWallet={walletAddress}
      />
      <GameResultModal
        open={gameResultOpen}
        onOpenChange={setGameResultOpen}
        result={gameResultType}
        winnerWallet={gameResultWager?.winner_wallet}
        winnerUsername={gameResultWinnerUsername}
        totalPot={gameResultTotalPot}
        platformFee={gameResultPlatformFee}
        winnerPayout={gameResultPayout}
        refundAmount={gameResultWager?.stake_lamports}
        onViewDetails={() => {
          setGameResultOpen(false)
          if (gameResultWager) handleViewDetails(gameResultWager)
        }}
      />
    </div>
  )
}
import { Suspense } from 'react'
import { Loader2 as _L2 } from 'lucide-react'

export default function ArenaPage() {
  return (
    <Suspense fallback={
      <div className="py-8 pb-16">
        <div className="container px-4 flex justify-center items-center py-20">
          <_L2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    }>
      <ArenaInner />
    </Suspense>
  )
}