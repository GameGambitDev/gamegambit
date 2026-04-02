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

import {
  Search, Zap, Filter, Plus, Swords, Clock, Trophy,
  Loader2, Wallet, Eye, Pencil, Trash2, Play, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { GAMES, formatSol, truncateAddress } from '@/lib/constants'
import {
  useOpenWagers, useLiveWagers, useRecentWinners,
  useJoinWager, useEditWager, useDeleteWager, useSetReady,
  useWagerById, invokeSecureWager, Wager, GameType,
} from '@/hooks/useWagers'
import {
  usePlayer, useSearchPlayers, usePlayerByWallet, usePlayersByWallets,
} from '@/hooks/usePlayer'
import { useWalletBalance } from '@/hooks/useWalletBalance'
import { useQuickMatch } from '@/hooks/useQuickMatch'
import { useIsProfileComplete } from '@/components/UsernameEnforcer'
import { CreateWagerModal } from '@/components/CreateWagerModal'
import { WagerDetailsModal } from '@/components/WagerDetailsModal'
import { QuickMatchModal } from '@/components/QuickMatchModal'
import { ReadyRoomModal } from '@/components/ReadyRoomModal'
import { EditWagerModal, EditWagerData } from '@/components/EditWagerModal'
import { LiveGameModal } from '@/components/LiveGameModal'
import { GameCompleteModal } from '@/components/GameCompletemodal'
import { VotingModal } from '@/components/Votingmodal'
import { DisputeGraceModal } from '@/components/DisputeGraceModal'
import { SuspensionBanner } from '@/components/SuspensionBanner'
import { GameResultModal } from '@/components/GameResultModal'
import { PlayerLink } from '@/components/PlayerLink'
import { staggerContainer, staggerItem } from '@/components/PageTransition'
import { useGameEvents } from '@/contexts/GameEventContext'
import { useWagerChat } from '@/hooks/useWagerChat'
import { useBalanceAnimation } from '@/contexts/BalanceAnimationContext'
import { useWalletAuth } from '@/hooks/useWalletAuth'
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

// ── Open Wager Card ───────────────────────────────────────────────────────────

function OpenWagerCard({
  wager, onJoin, onViewDetails, onEdit, onDelete,
  isJoining, isOwner, creatorUsername,
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

  return (
    <motion.div
      whileHover={{ y: -2, scale: 1.01 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      <Card
        variant="wager"
        className="group cursor-pointer hover:border-primary/40 hover:shadow-[0_0_18px_0px_hsl(var(--primary)/0.18)] transition-all duration-300"
        onClick={() => onViewDetails(wager)}
      >
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <div className="text-2xl sm:text-3xl flex-shrink-0 group-hover:scale-110 transition-transform duration-300">{game.icon}</div>
              <div className="min-w-0">
                <div className="font-gaming text-sm truncate">
                  <PlayerLink
                    walletAddress={wager.player_a_wallet}
                    username={creatorUsername}
                    className="font-gaming"
                  />
                  {isOwner && <span className="ml-1 text-xs text-primary">(You)</span>}
                </div>
                <div className="flex items-center gap-1 sm:gap-2 text-xs text-muted-foreground">
                  <span>{game.name}</span>
                  <span>•</span>
                  <Clock className="h-3 w-3 flex-shrink-0" />
                  <span>{formatTimeAgo(wager.created_at)}</span>
                </div>
              </div>
            </div>
            <div className="font-gaming text-sm sm:text-lg font-bold text-accent whitespace-nowrap flex-shrink-0 group-hover:text-primary transition-colors duration-200">
              {formatSol(wager.stake_lamports)} SOL
            </div>
          </div>

          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
            {isOwner ? (
              <>
                <Button
                  variant="outline" size="sm" className="flex-1"
                  onClick={() => onEdit?.(wager)}
                >
                  <Pencil className="h-4 w-4 sm:mr-1" />
                  <span className="hidden sm:inline">Edit</span>
                </Button>
                <Button
                  variant="destructive" size="sm" className="flex-1"
                  onClick={() => onDelete?.(wager)}
                >
                  <Trash2 className="h-4 w-4 sm:mr-1" />
                  <span className="hidden sm:inline">Delete</span>
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline" size="sm" className="flex-1"
                  onClick={() => onViewDetails(wager)}
                >
                  <Eye className="h-4 w-4 sm:mr-1" />
                  <span className="hidden sm:inline">Details</span>
                </Button>
                <Button
                  variant="neon" size="sm" className="flex-1"
                  onClick={() => onJoin(wager.id)}
                  disabled={isJoining}
                >
                  {isJoining
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : 'Accept Challenge'
                  }
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ── Live Match Card ───────────────────────────────────────────────────────────

function LiveMatchCard({
  wager, onEnterReadyRoom, onWatchGame, onViewDetails, onOpenGrace, currentWallet,
}: {
  wager: Wager
  onEnterReadyRoom?: (wagerId: string) => void
  onWatchGame?: (wager: Wager) => void
  onViewDetails?: (wager: Wager) => void
  onOpenGrace?: (wager: Wager) => void
  currentWallet?: string
}) {
  const game = getGameData(wager.game)
  const isParticipant = currentWallet === wager.player_a_wallet || currentWallet === wager.player_b_wallet
  const isResolved = wager.status === 'resolved' || (wager.status as string) === 'closed'
  const canEnterReadyRoom = wager.status === 'joined' && isParticipant
  const isInProgress = wager.status === 'voting'
  const isDisputed = wager.status === 'disputed' && isParticipant && !wager.grace_conceded_by

  const handleClick = () => {
    if (isResolved) onViewDetails?.(wager)
    else if (canEnterReadyRoom) onEnterReadyRoom?.(wager.id)
    else if (isDisputed) onOpenGrace?.(wager)
    else if (isInProgress) onWatchGame?.(wager)
  }

  return (
    <motion.div
      whileHover={{ y: -2, scale: 1.01 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      <Card
        variant="wager"
        className="cursor-pointer border-primary/20 hover:border-primary/40 hover:shadow-[0_0_18px_0px_hsl(var(--primary)/0.18)] transition-all duration-300"
        onClick={handleClick}
      >
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="relative flex-shrink-0">
                <div className="text-2xl sm:text-3xl group-hover:scale-110 transition-transform duration-300">{game.icon}</div>
                {!isResolved && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-destructive" />
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1 sm:gap-2 mb-1 flex-wrap">
                  <span className="font-gaming text-xs sm:text-sm truncate max-w-[70px] sm:max-w-none">
                    {truncateAddress(wager.player_a_wallet)}
                  </span>
                  <Swords className="h-3 w-3 sm:h-4 sm:w-4 text-primary flex-shrink-0" />
                  <span className="font-gaming text-xs sm:text-sm truncate max-w-[70px] sm:max-w-none">
                    {wager.player_b_wallet ? truncateAddress(wager.player_b_wallet) : '???'}
                  </span>
                </div>
                <div className="flex items-center gap-1 sm:gap-2 text-xs text-muted-foreground">
                  <span>{game.name}</span>
                  <span>•</span>
                  <span>{formatTimeAgo(wager.created_at)}</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1 sm:gap-3 flex-shrink-0">
              <div className="font-gaming text-sm sm:text-base text-accent whitespace-nowrap">
                {formatSol(wager.stake_lamports * 2)} SOL
              </div>
              {isResolved ? (
                <Badge variant="outline" className="cursor-pointer text-xs whitespace-nowrap">
                  {wager.winner_wallet ? '🏆 View' : '🤝 Draw'}
                </Badge>
              ) : canEnterReadyRoom ? (
                <Badge variant="joined" className="cursor-pointer text-xs whitespace-nowrap">Ready Room</Badge>
              ) : isDisputed ? (
                <Badge variant="outline" className="cursor-pointer text-xs whitespace-nowrap border-yellow-500/50 text-yellow-400">
                  ⚠️ Disputed
                </Badge>
              ) : isInProgress && isParticipant ? (
                <Badge variant="voting" className="cursor-pointer flex items-center gap-1 text-xs whitespace-nowrap">
                  <Play className="h-3 w-3" /> Watch
                </Badge>
              ) : (
                <Badge variant={wager.status === 'voting' ? 'voting' : 'joined'} className="text-xs whitespace-nowrap">
                  {wager.status === 'voting' ? 'In Progress' : 'Ready Room'}
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ── Empty State ───────────────────────────────────────────────────────────────

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

// ── Arena Inner ───────────────────────────────────────────────────────────────

function ArenaInner() {
  const { connected, publicKey } = useWallet()
  const walletReady = useWalletReady()
  const walletAddress = publicKey?.toBase58()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const { getSessionToken } = useWalletAuth()

  const { onWagerResolved, clearPendingResult } = useGameEvents()
  const { queueAnimation } = useBalanceAnimation()
  const { data: player } = usePlayer()

  // ── Search state — debounced so we don't hammer the DB ──────────────────
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSearchChange = (value: string) => {
    setSearchInput(value)
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    searchDebounceRef.current = setTimeout(() => {
      setSearchQuery(value.trim())
    }, 300)
  }

  const clearSearch = () => {
    setSearchInput('')
    setSearchQuery('')
  }

  // ── Modal state ──────────────────────────────────────────────────────────
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [quickMatchOpen, setQuickMatchOpen] = useState(false)
  const [selectedWager, setSelectedWager] = useState<Wager | null>(null)
  const [detailsModalOpen, setDetailsModalOpen] = useState(false)
  const [readyRoomWagerId, setReadyRoomWagerId] = useState<string | null>(null)
  const [editWager, setEditWager] = useState<Wager | null>(null)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [liveGameWagerId, setLiveGameWagerId] = useState<string | null>(null)
  const [liveGameModalOpen, setLiveGameModalOpen] = useState(false)
  const [gameResultWager, setGameResultWager] = useState<Wager | null>(null)
  const [gameResultOpen, setGameResultOpen] = useState(false)
  const [deepLinkResultId, setDeepLinkResultId] = useState<string | null>(null)
  const [rematchPending, setRematchPending] = useState(false)

  // ── Step 3: Game Complete + Voting for non-chess wagers ─────────────────
  const [gameCompleteWager, setGameCompleteWager] = useState<Wager | null>(null)
  const [gameCompleteOpen, setGameCompleteOpen] = useState(false)
  const [votingWager, setVotingWager] = useState<Wager | null>(null)
  const [votingOpen, setVotingOpen] = useState(false)

  // ── Step 4: Dispute Grace Period ────────────────────────────────────────
  const [graceWager, setGraceWager] = useState<Wager | null>(null)
  const [graceOpen, setGraceOpen] = useState(false)
  const handleOpenGrace = (wager: Wager) => { setGraceWager(wager); setGraceOpen(true) }

  const pendingModalRef = useRef<Wager | null>(null)

  const { sendProposal } = useWagerChat(editWager?.id ?? null)

  // ── Deep-link from notification ──────────────────────────────────────────
  useEffect(() => {
    const wagerId = searchParams.get('wager')
    const modal = searchParams.get('modal')
    if (!wagerId || !modal) return
    if (modal === 'ready-room') setReadyRoomWagerId(wagerId)
    else if (modal === 'result') setDeepLinkResultId(wagerId)
    const url = new URL(window.location.href)
    url.searchParams.delete('wager')
    url.searchParams.delete('modal')
    window.history.replaceState({}, '', url.pathname)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  // Stable refs so the resolved-wager callback never captures stale IDs
  const readyRoomWagerIdRef = useRef(readyRoomWagerId)
  const liveGameWagerIdRef = useRef(liveGameWagerId)
  useEffect(() => { readyRoomWagerIdRef.current = readyRoomWagerId }, [readyRoomWagerId])
  useEffect(() => { liveGameWagerIdRef.current = liveGameWagerId }, [liveGameWagerId])

  // ── Listen for resolved wagers ───────────────────────────────────────────
  useEffect(() => {
    if (!walletAddress) return
    const unsub = onWagerResolved((wager) => {
      const isParticipant =
        wager.player_a_wallet === walletAddress ||
        wager.player_b_wallet === walletAddress
      if (!isParticipant) return

      if (readyRoomWagerIdRef.current === wager.id) setReadyRoomWagerId(null)
      if (liveGameWagerIdRef.current === wager.id) {
        setLiveGameModalOpen(false)
        setLiveGameWagerId(null)
      }

      const won = wager.winner_wallet === walletAddress
      const isDraw = !wager.winner_wallet
      const payout = Math.floor(wager.stake_lamports * 2 * 0.9)
      queueAnimation({
        delta: isDraw ? 0 : won ? payout : -wager.stake_lamports,
        wagerId: wager.id,
        type: isDraw ? 'draw' : won ? 'win' : 'lose',
      })

      clearPendingResult(wager.id)

      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        pendingModalRef.current = wager
        return
      }
      setGameResultWager(wager)
      setGameResultOpen(true)
    })
    return unsub
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddress, onWagerResolved, queueAnimation, clearPendingResult])

  // Show deferred result modal when user returns to tab
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && pendingModalRef.current) {
        const w = pendingModalRef.current
        pendingModalRef.current = null
        setGameResultWager(w)
        setGameResultOpen(true)
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  // ── Data queries ─────────────────────────────────────────────────────────
  const { data: openWagers, isLoading: openLoading } = useOpenWagers()
  const { data: liveWagers, isLoading: liveLoading } = useLiveWagers()
  const { data: recentWinners, isLoading: winnersLoading } = useRecentWinners(5)
  const { data: walletBalance, isLoading: balanceLoading } = useWalletBalance()
  const { data: readyRoomWager } = useWagerById(readyRoomWagerId)
  const { data: deepLinkResultWager } = useWagerById(deepLinkResultId)

  // Only fire the search query when there's actual input
  const { data: searchedPlayers, isLoading: searchLoading } = useSearchPlayers(
    searchQuery.length >= 2 ? searchQuery : ''
  )

  const liveGameWager = useMemo(() => {
    if (!liveGameWagerId) return null
    return liveWagers?.find(w => w.id === liveGameWagerId) ?? null
  }, [liveGameWagerId, liveWagers])

  const quickMatch = useQuickMatch()
  const joinWager = useJoinWager()
  const editWagerMutation = useEditWager()
  const deleteWagerMutation = useDeleteWager()
  const setReadyMutation = useSetReady()
  const { needsSetup } = useIsProfileComplete()

  const { data: winnerPlayerA } = usePlayerByWallet(gameResultWager?.player_a_wallet || null)
  const { data: winnerPlayerB } = usePlayerByWallet(gameResultWager?.player_b_wallet || null)
  const gameResultWinnerUsername =
    gameResultWager?.winner_wallet === gameResultWager?.player_a_wallet
      ? winnerPlayerA?.username
      : winnerPlayerB?.username

  // Build the wallet → username map from all visible wagers + search results
  const wagerWalletAddresses = useMemo(() => {
    const addresses = new Set<string>()
    openWagers?.forEach(w => {
      addresses.add(w.player_a_wallet)
      if (w.player_b_wallet) addresses.add(w.player_b_wallet)
    })
    liveWagers?.forEach(w => {
      addresses.add(w.player_a_wallet)
      if (w.player_b_wallet) addresses.add(w.player_b_wallet)
    })
    return Array.from(addresses)
  }, [openWagers, liveWagers])

  const { data: wagerPlayers } = usePlayersByWallets(wagerWalletAddresses)

  const playerUsernameMap = useMemo(() => {
    const map: Record<string, string | null> = {}
    wagerPlayers?.forEach(p => { map[p.wallet_address.toLowerCase()] = p.username })
    searchedPlayers?.forEach(p => { map[p.wallet_address.toLowerCase()] = p.username })
    return map
  }, [wagerPlayers, searchedPlayers])

  // ── Filtering ────────────────────────────────────────────────────────────
  const matchedWalletSet = useMemo(() => {
    if (!searchQuery || !searchedPlayers) return new Set<string>()
    return new Set(searchedPlayers.map(p => p.wallet_address.toLowerCase()))
  }, [searchQuery, searchedPlayers])

  const filteredOpenWagers = useMemo(() => {
    if (!openWagers) return []
    if (!searchQuery) return openWagers
    const q = searchQuery.toLowerCase()
    return openWagers.filter(w =>
      w.player_a_wallet.toLowerCase().includes(q) ||
      (playerUsernameMap[w.player_a_wallet.toLowerCase()] ?? '').toLowerCase().includes(q) ||
      matchedWalletSet.has(w.player_a_wallet.toLowerCase())
    )
  }, [openWagers, searchQuery, playerUsernameMap, matchedWalletSet])

  const filteredLiveWagers = useMemo(() => {
    if (!liveWagers) return []
    if (!searchQuery) return liveWagers
    const q = searchQuery.toLowerCase()
    return liveWagers.filter(w => {
      const aWallet = w.player_a_wallet.toLowerCase()
      const bWallet = w.player_b_wallet?.toLowerCase() ?? ''
      return (
        aWallet.includes(q) || bWallet.includes(q) ||
        (playerUsernameMap[aWallet] ?? '').toLowerCase().includes(q) ||
        (playerUsernameMap[bWallet] ?? '').toLowerCase().includes(q) ||
        matchedWalletSet.has(aWallet) || matchedWalletSet.has(bWallet)
      )
    })
  }, [liveWagers, searchQuery, playerUsernameMap, matchedWalletSet])

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleQuickMatch = () => {
    if (needsSetup) { toast.error('Please set up your username first'); return }
    setQuickMatchOpen(true)
  }

  const handleQuickMatchSubmit = async (game?: GameType) => {
    try {
      const wager = await quickMatch.mutateAsync(game)
      setQuickMatchOpen(false)
      if (wager?.id) setReadyRoomWagerId(wager.id)
    } catch (err: any) {
      throw err
    }
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
      if (editWager.status === 'joined' && Object.keys(updates).some(k => k !== 'stream_url')) {
        await sendProposal(editWager, updates)
        toast.success('Proposal sent — waiting for opponent approval')
      } else {
        await editWagerMutation.mutateAsync({ wagerId: editWager.id, ...updates })
        toast.success('Wager updated successfully')
      }
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
      return
    }
    // Non-chess wagers in voting state: show game complete / voting flow
    if (wager.game !== 'chess' && wager.status === 'voting') {
      const bothConfirmed = !!wager.game_complete_a && !!wager.game_complete_b
      if (bothConfirmed) {
        setVotingWager(wager)
        setVotingOpen(true)
      } else {
        setGameCompleteWager(wager)
        setGameCompleteOpen(true)
      }
      return
    }
    setLiveGameWagerId(wager.id)
    setLiveGameModalOpen(true)
  }

  // ── ReadyRoom → non-chess game started → open GameCompleteModal ──────────
  // Called by ReadyRoomModal via onOpenGameComplete prop once both stakes
  // are locked and the player taps "Game Complete — Vote Now"
  const handleOpenGameComplete = (wager: Wager) => {
    setGameCompleteWager(wager)
    setGameCompleteOpen(true)
  }

  // ── GameCompleteModal → both confirmed → open VotingModal ────────────────
  const handleBothConfirmedArena = () => {
    const w = gameCompleteWager
    setGameCompleteOpen(false)
    if (w) {
      setVotingWager(w)
      setVotingOpen(true)
    }
  }

  // ── Rematch ───────────────────────────────────────────────────────────────
  const handleRematch = useCallback(async () => {
    if (!gameResultWager || !walletAddress) return
    if (needsSetup) { toast.error('Please set up your username first'); return }

    const opponentWallet =
      gameResultWager.player_a_wallet === walletAddress
        ? gameResultWager.player_b_wallet
        : gameResultWager.player_a_wallet

    if (!opponentWallet) return

    setRematchPending(true)
    try {
      const sessionToken = await getSessionToken()
      if (!sessionToken) throw new Error('Wallet verification required')

      const createResult = await invokeSecureWager<{ wager: Wager }>(
        {
          action: 'create',
          game: gameResultWager.game,
          stake_lamports: gameResultWager.stake_lamports,
        },
        sessionToken,
      )

      const newWagerId: string = createResult.wager.id

      await invokeSecureWager<{ ok: boolean }>(
        {
          action: 'notifyRematch',
          wagerId: newWagerId,
          opponentWallet,
          fromUsername: player?.username ?? truncateAddress(walletAddress),
          game: gameResultWager.game,
          stake: gameResultWager.stake_lamports,
        },
        sessionToken,
      )

      toast.success('Rematch challenge sent!')
      setGameResultOpen(false)
      setGameResultWager(null)
      queryClient.invalidateQueries({ queryKey: ['wagers'] })
    } catch (err: any) {
      toast.error(err.message || 'Failed to send rematch challenge')
    } finally {
      setRematchPending(false)
    }
  }, [gameResultWager, walletAddress, player, needsSetup, getSessionToken, queryClient])

  // ── Derived result state ─────────────────────────────────────────────────
  const gameResultTotalPot = (gameResultWager?.stake_lamports ?? 0) * 2
  const gameResultPlatformFee = Math.floor(gameResultTotalPot * 0.1)
  const gameResultPayout = gameResultTotalPot - gameResultPlatformFee
  const gameResultIsDraw = gameResultWager?.status === 'resolved' && !gameResultWager?.winner_wallet
  const gameResultType: 'win' | 'lose' | 'draw' = gameResultIsDraw
    ? 'draw'
    : gameResultWager?.winner_wallet === walletAddress ? 'win' : 'lose'

  // ── Loading / disconnected states ────────────────────────────────────────
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

  // ── Main UI ───────────────────────────────────────────────────────────────
  return (
    <div className="py-6 pb-16">
      <SuspensionBanner player={player} />
      <div className="container px-3 sm:px-4">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6"
        >
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold mb-1 font-gaming">
              <span className="text-primary">Arena</span>
            </h1>
            <p className="text-muted-foreground text-sm">Find opponents and stake your claim</p>
          </div>
          <Button variant="neon" className="w-full sm:w-auto" onClick={handleCreateWager} disabled={!!player?.is_suspended}>
            <Plus className="h-4 w-4 mr-2" />Create Wager
          </Button>
        </motion.div>

        {/* Search + actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col sm:flex-row gap-3 mb-6"
        >
          <div className="relative flex-1">
            {searchLoading && searchQuery.length >= 2
              ? <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              : <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            }
            <Input
              placeholder="Search by username or wallet..."
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10 pr-8 bg-card border-border"
            />
            {searchInput && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleQuickMatch}
              disabled={quickMatch.isPending || !!player?.is_suspended}
              className="flex-1 sm:flex-none hover:border-primary/50 hover:shadow-neon transition-all"
            >
              {quickMatch.isPending
                ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                : <Zap className="h-4 w-4 mr-2" />
              }
              Quick Match
            </Button>
            <Button variant="ghost" size="icon"><Filter className="h-4 w-4" /></Button>
          </div>
        </motion.div>

        {/* Search results hint */}
        {searchQuery && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mb-4 text-xs text-muted-foreground"
          >
            {searchLoading
              ? 'Searching...'
              : `${filteredOpenWagers.length + filteredLiveWagers.length} result${filteredOpenWagers.length + filteredLiveWagers.length !== 1 ? 's' : ''} for "${searchQuery}"`
            }
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          <div className="lg:col-span-2 space-y-6">

            {/* Live Matches */}
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
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
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
                        onOpenGrace={handleOpenGrace}
                      />
                    </motion.div>
                  ))}
                </motion.div>
              ) : (
                <Card variant="gaming" className="p-6 text-center text-muted-foreground">
                  {searchQuery ? `No live matches found for "${searchQuery}"` : 'No live matches right now'}
                </Card>
              )}
            </motion.div>

            {/* Open Wagers */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <div className="flex items-center gap-2 mb-4">
                <h2 className="font-gaming text-lg">Open Wagers</h2>
                <Badge variant="outline" className="ml-auto">{filteredOpenWagers.length}</Badge>
              </div>
              {openLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
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
                <EmptyState
                  title={searchQuery ? 'No Results' : 'No Open Wagers'}
                  description={
                    searchQuery
                      ? `No open wagers found for "${searchQuery}"`
                      : 'Be the first to create a wager and challenge others!'
                  }
                />
              )}
            </motion.div>
          </div>

          {/* Sidebar */}
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
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    </div>
                  ) : recentWinners && recentWinners.length > 0 ? (
                    <div className="space-y-3">
                      {recentWinners.map((wager) => {
                        const game = getGameData(wager.game)
                        return (
                          <div key={wager.id} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <span>{game.icon}</span>
                              <span className="font-gaming text-xs truncate max-w-[120px]">
                                {wager.winner_wallet
                                  ? (playerUsernameMap[wager.winner_wallet.toLowerCase()] || truncateAddress(wager.winner_wallet))
                                  : 'Unknown'}
                              </span>
                            </div>
                            <span className="text-accent font-gaming flex-shrink-0">
                              +{formatSol(wager.stake_lamports)}
                            </span>
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

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      <CreateWagerModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onSuccess={() => {
          setCreateModalOpen(false)
          queryClient.invalidateQueries({ queryKey: ['wagers'] })
        }}
      />

      <QuickMatchModal
        open={quickMatchOpen}
        onOpenChange={setQuickMatchOpen}
        onMatch={handleQuickMatchSubmit}
        isPending={quickMatch.isPending}
      />

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
        onOpenGameComplete={handleOpenGameComplete}
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

      {/* Dispute Grace — shown when wager is disputed and not yet conceded */}
      <DisputeGraceModal
        wager={graceWager}
        open={graceOpen}
        onOpenChange={(open) => { setGraceOpen(open); if (!open) setGraceWager(null) }}
        currentWallet={walletAddress || ''}
      />

      {/* Game Complete — non-chess wagers */}
      <GameCompleteModal
        wager={gameCompleteWager}
        open={gameCompleteOpen}
        onOpenChange={(open) => { setGameCompleteOpen(open); if (!open) setGameCompleteWager(null) }}
        currentWallet={walletAddress || ''}
        onBothConfirmed={handleBothConfirmedArena}
      />

      {/* Voting — opens after both confirm */}
      <VotingModal
        wager={votingWager}
        open={votingOpen}
        onOpenChange={(open) => { setVotingOpen(open); if (!open) setVotingWager(null) }}
        currentWallet={walletAddress || ''}
      />

      {/* Primary game result (realtime / polling) */}
      <GameResultModal
        open={gameResultOpen}
        onOpenChange={(open) => {
          setGameResultOpen(open)
          if (!open) setGameResultWager(null)
        }}
        result={gameResultType}
        winnerWallet={gameResultWager?.winner_wallet}
        winnerUsername={gameResultWinnerUsername}
        totalPot={gameResultTotalPot}
        platformFee={gameResultPlatformFee}
        winnerPayout={gameResultPayout}
        refundAmount={gameResultWager?.stake_lamports}
        onRematch={handleRematch}
        isRematchPending={rematchPending}
        onViewDetails={() => {
          setGameResultOpen(false)
          if (gameResultWager) handleViewDetails(gameResultWager)
        }}
      />

      {/* Deep-link result: notification tapped while already on arena page */}
      <GameResultModal
        open={!!deepLinkResultId && !!deepLinkResultWager}
        onOpenChange={(open) => !open && setDeepLinkResultId(null)}
        result={
          !deepLinkResultWager ? 'draw'
            : !(deepLinkResultWager as any)?.winner_wallet ? 'draw'
              : (deepLinkResultWager as any).winner_wallet === walletAddress ? 'win' : 'lose'
        }
        winnerWallet={(deepLinkResultWager as any)?.winner_wallet ?? null}
        winnerUsername={null}
        totalPot={(deepLinkResultWager?.stake_lamports ?? 0) * 2}
        platformFee={Math.floor((deepLinkResultWager?.stake_lamports ?? 0) * 2 * 0.1)}
        winnerPayout={Math.floor((deepLinkResultWager?.stake_lamports ?? 0) * 2 * 0.9)}
        refundAmount={deepLinkResultWager?.stake_lamports}
      />
    </div>
  )
}

// ── Page export ───────────────────────────────────────────────────────────────

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