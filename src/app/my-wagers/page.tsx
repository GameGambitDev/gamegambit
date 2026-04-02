'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useWallet } from '@solana/wallet-adapter-react'
import { useWalletReady } from '@/app/providers'
import { useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'

const WalletMultiButton = dynamic(
  () => import('@solana/wallet-adapter-react-ui').then(m => ({ default: m.WalletMultiButton })),
  { ssr: false }
)
import { Swords, Clock, Trophy, XCircle, CheckCircle, Filter, Loader2, Play, ExternalLink, Link2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { GAMES, formatSol, truncateAddress } from '@/lib/constants'
import { useMyWagers, useSetReady, useStartGame, useWagerById, Wager } from '@/hooks/useWagers'
import { usePlayer, usePlayerByWallet } from '@/hooks/usePlayer'
import { useWagerTransactionsBulk } from '@/hooks/useTransactions'
import { getExplorerUrl } from '@/lib/solana-config'
import { ReadyRoomModal } from '@/components/ReadyRoomModal'
import { GameResultModal } from '@/components/GameResultModal'
import { EditWagerModal, EditWagerData } from '@/components/EditWagerModal'
import { GameCompleteModal } from '@/components/GameCompletemodal'
import { VotingModal } from '@/components/Votingmodal'
import { DisputeGraceModal } from '@/components/DisputeGraceModal'
import { PunishmentNoticeModal } from '@/components/PunishmentNoticeModal'
import { ReportModeratorModal } from '@/components/ReportModeratorModal'
import { useEditWager } from '@/hooks/useWagers'
import { staggerContainer, staggerItem } from '@/components/PageTransition'
import { useGameEvents } from '@/contexts/GameEventContext'
import { useWagerChat } from '@/hooks/useWagerChat'
import { useBalanceAnimation } from '@/contexts/BalanceAnimationContext'
import { getSupabaseClient } from '@/integrations/supabase/client'
import { toast } from 'sonner'

// ── Types ─────────────────────────────────────────────────────────────────────

interface PunishmentLogEntry {
  id: string
  offense_count: number
  offense_type: string
  punishment: string
  punishment_ends_at: string | null
  created_at: string
  wager_id: string | null
  notes: string | null
}

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

const getStatusBadge = (status: string, won?: boolean) => {
  switch (status) {
    case 'created': return <Badge variant="created">Waiting</Badge>
    case 'joined': return <Badge variant="joined">Ready Room</Badge>
    case 'voting': return <Badge variant="voting">In Progress</Badge>
    case 'disputed': return <Badge variant="disputed">Disputed</Badge>
    case 'resolved': return won ? <Badge variant="success">Won</Badge> : <Badge variant="destructive">Lost</Badge>
    case 'cancelled': return <Badge variant="glass">Cancelled</Badge>
    default: return <Badge variant="glass">{status}</Badge>
  }
}

function WagerRow({
  wager,
  myWallet,
  txSig,
  onEnterReadyRoom,
  onViewResult,
  onOpenGameComplete,
  onOpenVoting,
  onOpenGrace,
}: {
  wager: Wager
  myWallet: string
  txSig?: string | null
  onEnterReadyRoom?: (wagerId: string) => void
  onViewResult?: (wagerId: string) => void
  onOpenGameComplete?: (wager: Wager) => void
  onOpenVoting?: (wager: Wager) => void
  onOpenGrace?: (wager: Wager) => void
}) {
  const game = getGameData(wager.game)
  const isChallenger = wager.player_a_wallet === myWallet
  const opponent = isChallenger ? wager.player_b_wallet : wager.player_a_wallet
  const won = wager.winner_wallet === myWallet
  const timeDiff = Math.floor((Date.now() - new Date(wager.created_at).getTime()) / 60000)
  const gameLink =
    wager.game === 'chess' && wager.lichess_game_id
      ? `https://lichess.org/${wager.lichess_game_id}`
      : null

  const isResolved = wager.status === 'resolved' || wager.status === 'cancelled'

  const isNonChessVoting = wager.status === 'voting' && wager.game !== 'chess'
  const myConfirmed = wager.player_a_wallet === myWallet
    ? !!(wager as any).game_complete_a
    : !!(wager as any).game_complete_b
  const opponentConfirmed = wager.player_a_wallet === myWallet
    ? !!(wager as any).game_complete_b
    : !!(wager as any).game_complete_a
  const bothConfirmed = myConfirmed && opponentConfirmed
  const iVoted = wager.player_a_wallet === myWallet
    ? !!(wager as any).vote_player_a
    : !!(wager as any).vote_player_b

  const getVotingActionLabel = () => {
    if (!myConfirmed) return 'Confirm Done'
    if (!bothConfirmed) return 'Waiting…'
    if (!iVoted) return 'Vote Now'
    return 'Voting'
  }

  return (
    <Card
      variant="wager"
      className={`group hover:border-primary/40 transition-all ${isResolved && onViewResult ? 'cursor-pointer' : ''}`}
      onClick={isResolved && onViewResult ? () => onViewResult(wager.id) : undefined}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="text-2xl sm:text-3xl flex-shrink-0">{game.icon}</div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-gaming text-sm text-foreground">You</span>
                <Swords className="h-4 w-4 text-muted-foreground" />
                <span className="font-gaming text-sm text-foreground">
                  {opponent ? truncateAddress(opponent) : 'Waiting...'}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <span>{game.name}</span>
                <span>•</span>
                <Clock className="h-3 w-3" />
                <span>{timeDiff}m ago</span>
                <span>•</span>
                <span>{isChallenger ? 'Challenger' : 'Opponent'}</span>
                {gameLink && (
                  <>
                    <span>•</span>
                    <a
                      href={gameLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Game <ExternalLink className="h-3 w-3" />
                    </a>
                  </>
                )}
                {txSig && (
                  <>
                    <span>•</span>
                    <a
                      href={getExplorerUrl('tx', txSig)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:underline flex items-center gap-1 font-medium"
                      onClick={(e) => e.stopPropagation()}
                      title={txSig}
                    >
                      <Link2 className="h-3 w-3" />
                      {truncateAddress(txSig)}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 sm:gap-4 flex-shrink-0">
            <div className="font-gaming text-sm sm:text-lg font-bold text-accent whitespace-nowrap">
              {formatSol(wager.stake_lamports)} SOL
            </div>
            {getStatusBadge(wager.status, won)}

            {wager.status === 'joined' && onEnterReadyRoom && (
              <Button
                variant="neon" size="sm"
                onClick={(e) => { e.stopPropagation(); onEnterReadyRoom(wager.id) }}
                className="whitespace-nowrap"
              >
                <Play className="h-4 w-4 mr-1" />
                Ready Room
              </Button>
            )}

            {wager.status === 'disputed' && !wager.grace_conceded_by && (
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => { e.stopPropagation(); onOpenGrace?.(wager) }}
                className="whitespace-nowrap border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10"
              >
                View Dispute
              </Button>
            )}

            {isNonChessVoting && (
              <Button
                variant={bothConfirmed && !iVoted ? 'gold' : 'outline'}
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  if (bothConfirmed) {
                    onOpenVoting?.(wager)
                  } else {
                    onOpenGameComplete?.(wager)
                  }
                }}
                className="whitespace-nowrap"
              >
                {getVotingActionLabel()}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-12">
      <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
        <Swords className="h-8 w-8 text-muted-foreground" />
      </div>
      <p className="text-muted-foreground">{message}</p>
    </div>
  )
}

function MyWagersInner() {
  const { connected, publicKey } = useWallet()
  const walletReady = useWalletReady()
  const walletAddress = publicKey?.toBase58() || ''
  const searchParams = useSearchParams()

  // ── Contexts ────────────────────────────────────────────────────────────────
  const { onWagerResolved, clearPendingResult } = useGameEvents()
  const { queueAnimation } = useBalanceAnimation()

  // ── Modal state ─────────────────────────────────────────────────────────────
  const [readyRoomWagerId, setReadyRoomWagerId] = useState<string | null>(null)
  const [resultWager, setResultWager] = useState<Wager | null>(null)
  const [resultOpen, setResultOpen] = useState(false)
  const [deepLinkResultId, setDeepLinkResultId] = useState<string | null>(null)
  const [editWager, setEditWager] = useState<Wager | null>(null)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [visibleAll, setVisibleAll] = useState(10)
  const [visibleCompleted, setVisibleCompleted] = useState(10)
  const PAGE_SIZE = 10

  // ── Step 3: Game Complete + Voting modal state ───────────────────────────
  const [gameCompleteWager, setGameCompleteWager] = useState<Wager | null>(null)
  const [gameCompleteOpen, setGameCompleteOpen] = useState(false)
  const [votingWager, setVotingWager] = useState<Wager | null>(null)
  const [votingOpen, setVotingOpen] = useState(false)

  // ── Step 6: Punishment notice modal state ────────────────────────────────
  const [punishmentWager, setPunishmentWager] = useState<Wager | null>(null)
  const [punishmentOpen, setPunishmentOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)

  // punishment_log entry for the current punishmentWager — fetched on demand
  const [punishmentLog, setPunishmentLog] = useState<PunishmentLogEntry | null>(null)
  const [punishmentLogLoading, setPunishmentLogLoading] = useState(false)

  // Fetch the latest punishment_log row for the wager that just resolved against us
  const fetchPunishmentLog = async (wager: Wager) => {
    if (!walletAddress) return
    setPunishmentLogLoading(true)
    try {
      const { data } = await getSupabaseClient()
        .from('punishment_log')
        .select('*')
        .eq('player_wallet', walletAddress)
        .eq('wager_id', wager.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      if (data) setPunishmentLog(data as PunishmentLogEntry)
    } catch {
      // no punishment log row — modal still shows with defaults
    } finally {
      setPunishmentLogLoading(false)
    }
  }

  // Called when GameResultModal closes — opens PunishmentNoticeModal if applicable
  const maybeOpenPunishment = (wager: Wager | null) => {
    if (!wager || !walletAddress) return
    const isModeratorDecided = !!(wager as any).moderator_wallet
    const isLoser = wager.winner_wallet !== null && wager.winner_wallet !== walletAddress
    if (isModeratorDecided && isLoser) {
      setPunishmentWager(wager)
      fetchPunishmentLog(wager)
      setPunishmentOpen(true)
    }
  }

  // ── Step 4: Dispute Grace Period modal state ──────────────────────────────
  const [graceWager, setGraceWager] = useState<Wager | null>(null)
  const [graceOpen, setGraceOpen] = useState(false)
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

  const readyRoomWagerIdRef = useRef(readyRoomWagerId)
  useEffect(() => { readyRoomWagerIdRef.current = readyRoomWagerId }, [readyRoomWagerId])

  // ── GameEventContext: real-time result detection ─────────────────────────
  useEffect(() => {
    if (!walletAddress) return
    const unsub = onWagerResolved((wager) => {
      const isParticipant =
        wager.player_a_wallet === walletAddress ||
        wager.player_b_wallet === walletAddress
      if (!isParticipant) return

      if (readyRoomWagerIdRef.current === wager.id) setReadyRoomWagerId(null)

      if (gameCompleteWager?.id === wager.id) { setGameCompleteOpen(false); setGameCompleteWager(null) }
      if (votingWager?.id === wager.id) { setVotingOpen(false); setVotingWager(null) }

      const won = wager.winner_wallet === walletAddress
      const isDraw = !wager.winner_wallet
      const payout = Math.floor(wager.stake_lamports * 2 * 0.9)
      queueAnimation({
        delta: isDraw ? 0 : won ? payout : -wager.stake_lamports,
        wagerId: wager.id,
        type: isDraw ? 'draw' : won ? 'win' : 'lose',
      })

      setResultWager(wager)
      setResultOpen(true)
      clearPendingResult(wager.id)
    })
    return unsub
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddress, onWagerResolved, queueAnimation, clearPendingResult])

  const { data: wagers, isLoading } = useMyWagers()
  const { data: player } = usePlayer()
  const { data: readyRoomWager } = useWagerById(readyRoomWagerId)
  const { data: deepLinkResultWager } = useWagerById(deepLinkResultId)

  const { data: gameCompleteWagerLive } = useWagerById(gameCompleteOpen ? gameCompleteWager?.id ?? null : null)
  const { data: votingWagerLive } = useWagerById(votingOpen ? votingWager?.id ?? null : null)

  const resultWinnerWallet = resultWager?.winner_wallet ?? null
  const { data: resultWinnerPlayerA } = usePlayerByWallet(resultWager?.player_a_wallet ?? null)
  const { data: resultWinnerPlayerB } = usePlayerByWallet(resultWager?.player_b_wallet ?? null)
  const resultWinnerUsername = resultWinnerWallet === resultWager?.player_a_wallet
    ? resultWinnerPlayerA?.username
    : resultWinnerPlayerB?.username

  const setReadyMutation = useSetReady()
  const startGameMutation = useStartGame()
  const editWagerMutation = useEditWager()

  const myWagerIds = useMemo(() => wagers?.map(w => w.id) ?? [], [wagers])
  const { data: myTransactions } = useWagerTransactionsBulk(myWagerIds)

  const txSigByWagerId = useMemo(() => {
    const map: Record<string, string> = {}
    myTransactions?.forEach((tx) => {
      if (tx.tx_signature && tx.status === 'confirmed' && !map[tx.wager_id]) {
        map[tx.wager_id] = tx.tx_signature
      }
    })
    return map
  }, [myTransactions])

  const activeWagers = wagers?.filter((w) => ['created', 'joined', 'voting', 'disputed'].includes(w.status)) || []
  const completedWagers = wagers?.filter((w) => w.status === 'resolved') || []
  const winsCount = completedWagers.filter((w) => w.winner_wallet === walletAddress).length
  const lossesCount = completedWagers.filter((w) => w.winner_wallet && w.winner_wallet !== walletAddress).length

  const handleSetReady = async (ready: boolean) => {
    if (!readyRoomWagerId) return
    try {
      await setReadyMutation.mutateAsync({ wagerId: readyRoomWagerId, ready })
    } catch (err: any) {
      toast.error(err.message || 'Failed to set ready status')
    }
  }

  const handleSaveEditWager = async (updates: EditWagerData) => {
    if (!editWager) return
    try {
      if (editWager.status === 'joined' && Object.keys(updates).some(k => k !== 'stream_url')) {
        await sendProposal(editWager, updates)
        toast.success('Proposals sent — waiting for opponent approval')
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

  const handleViewResult = (wagerId: string) => {
    const w = wagers?.find(x => x.id === wagerId)
    if (w) { setResultWager(w); setResultOpen(true) }
  }

  const handleOpenGameComplete = (wager: Wager) => {
    setGameCompleteWager(wager)
    setGameCompleteOpen(true)
  }

  const handleOpenVoting = (wager: Wager) => {
    setVotingWager(wager)
    setVotingOpen(true)
  }

  const handleOpenGrace = (wager: Wager) => {
    setGraceWager(wager)
    setGraceOpen(true)
  }

  const handleBothConfirmed = () => {
    const w = gameCompleteWagerLive ?? gameCompleteWager
    setGameCompleteOpen(false)
    if (w) {
      setVotingWager(w)
      setVotingOpen(true)
    }
  }

  useEffect(() => {
    if (
      readyRoomWager?.ready_player_a &&
      readyRoomWager?.ready_player_b &&
      readyRoomWager?.countdown_started_at &&
      readyRoomWager?.status === 'joined'
    ) {
      const startTime = new Date(readyRoomWager.countdown_started_at).getTime()
      if (Date.now() - startTime >= 13000) {
        startGameMutation.mutate(
          { wagerId: readyRoomWager.id },
          {
            onSuccess: () => {
              toast.success('Game started! Good luck!')
              setReadyRoomWagerId(null)
            },
          }
        )
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readyRoomWager?.id, readyRoomWager?.status, readyRoomWager?.ready_player_a, readyRoomWager?.ready_player_b, readyRoomWager?.countdown_started_at])

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
                <Trophy className="h-10 w-10 text-primary" />
              </div>
              <h1 className="text-3xl font-bold mb-4 font-gaming">View Your Wagers</h1>
              <p className="text-muted-foreground mb-8">
                Connect your wallet to see your active and completed wagers.
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

  const resultType = (w: Wager | null): 'win' | 'lose' | 'draw' => {
    if (!w || !w.winner_wallet) return 'draw'
    return w.winner_wallet === walletAddress ? 'win' : 'lose'
  }

  return (
    <div className="py-8 pb-16">
      <div className="container px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold mb-2 font-gaming">
            <span className="text-foreground">My </span>
            <span className="text-primary">Wagers</span>
          </h1>
          <p className="text-muted-foreground">Track all your active and completed matches</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
        >
          {[
            { label: 'Active', value: activeWagers.length, icon: Swords, color: 'text-primary' },
            { label: 'Won', value: winsCount, icon: Trophy, color: 'text-success' },
            { label: 'Lost', value: lossesCount, icon: XCircle, color: 'text-destructive' },
            { label: 'Total Earned', value: player ? `+${formatSol(player.total_earnings)} SOL` : '+0 SOL', icon: CheckCircle, color: 'text-accent' },
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
                  <div className={`p-2 rounded-lg bg-muted ${stat.color}`}>
                    <stat.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider">{stat.label}</div>
                    <div className="font-gaming text-base sm:text-xl text-foreground truncate">{stat.value}</div>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        <Tabs defaultValue="all" className="space-y-6">
          <div className="flex items-center justify-between">
            <TabsList className="bg-muted/50">
              <TabsTrigger value="all" className="font-gaming">All</TabsTrigger>
              <TabsTrigger value="active" className="font-gaming">Active</TabsTrigger>
              <TabsTrigger value="completed" className="font-gaming">Completed</TabsTrigger>
            </TabsList>
            <Button variant="ghost" size="icon">
              <Filter className="h-4 w-4" />
            </Button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <TabsContent value="all" className="space-y-3">
                {wagers && wagers.length > 0 ? (
                  <>
                    <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-3">
                      {wagers.slice(0, visibleAll).map((wager) => (
                        <motion.div key={wager.id} variants={staggerItem}>
                          <WagerRow
                            wager={wager}
                            myWallet={walletAddress}
                            txSig={txSigByWagerId[wager.id]}
                            onEnterReadyRoom={setReadyRoomWagerId}
                            onViewResult={handleViewResult}
                            onOpenGameComplete={handleOpenGameComplete}
                            onOpenVoting={handleOpenVoting}
                            onOpenGrace={handleOpenGrace}
                          />
                        </motion.div>
                      ))}
                    </motion.div>
                    {wagers.length > visibleAll && (
                      <div className="flex justify-center pt-2">
                        <Button variant="outline" size="sm" onClick={() => setVisibleAll(v => v + PAGE_SIZE)}>
                          Show {Math.min(PAGE_SIZE, wagers.length - visibleAll)} more
                        </Button>
                      </div>
                    )}
                  </>
                ) : (
                  <EmptyState message="You haven't created or joined any wagers yet." />
                )}
              </TabsContent>

              <TabsContent value="active" className="space-y-3">
                {activeWagers.length > 0 ? (
                  <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-3">
                    {activeWagers.map((wager) => (
                      <motion.div key={wager.id} variants={staggerItem}>
                        <WagerRow
                          wager={wager}
                          myWallet={walletAddress}
                          txSig={txSigByWagerId[wager.id]}
                          onEnterReadyRoom={setReadyRoomWagerId}
                          onViewResult={handleViewResult}
                          onOpenGameComplete={handleOpenGameComplete}
                          onOpenVoting={handleOpenVoting}
                          onOpenGrace={handleOpenGrace}
                        />
                      </motion.div>
                    ))}
                  </motion.div>
                ) : (
                  <EmptyState message="No active wagers. Create or join one!" />
                )}
              </TabsContent>

              <TabsContent value="completed" className="space-y-3">
                {completedWagers.length > 0 ? (
                  <>
                    <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-3">
                      {completedWagers.slice(0, visibleCompleted).map((wager) => (
                        <motion.div key={wager.id} variants={staggerItem}>
                          <WagerRow
                            wager={wager}
                            myWallet={walletAddress}
                            txSig={txSigByWagerId[wager.id]}
                            onViewResult={handleViewResult}
                          />
                        </motion.div>
                      ))}
                    </motion.div>
                    {completedWagers.length > visibleCompleted && (
                      <div className="flex justify-center pt-2">
                        <Button variant="outline" size="sm" onClick={() => setVisibleCompleted(v => v + PAGE_SIZE)}>
                          Show {Math.min(PAGE_SIZE, completedWagers.length - visibleCompleted)} more
                        </Button>
                      </div>
                    )}
                  </>
                ) : (
                  <EmptyState message="No completed wagers yet." />
                )}
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────────── */}

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

      <DisputeGraceModal
        wager={graceWager}
        open={graceOpen}
        onOpenChange={(open) => { setGraceOpen(open); if (!open) setGraceWager(null) }}
        currentWallet={walletAddress}
      />

      <GameCompleteModal
        wager={gameCompleteWagerLive ?? gameCompleteWager}
        open={gameCompleteOpen}
        onOpenChange={(open) => { setGameCompleteOpen(open); if (!open) setGameCompleteWager(null) }}
        currentWallet={walletAddress}
        onBothConfirmed={handleBothConfirmed}
      />

      <VotingModal
        wager={votingWagerLive ?? votingWager}
        open={votingOpen}
        onOpenChange={(open) => { setVotingOpen(open); if (!open) setVotingWager(null) }}
        currentWallet={walletAddress}
      />

      <GameResultModal
        open={resultOpen}
        onOpenChange={(open) => {
          if (!open) { maybeOpenPunishment(resultWager); setResultWager(null) }
          setResultOpen(open)
        }}
        result={resultType(resultWager)}
        winnerWallet={resultWinnerWallet}
        winnerUsername={resultWinnerUsername ?? null}
        totalPot={(resultWager?.stake_lamports ?? 0) * 2}
        platformFee={Math.floor((resultWager?.stake_lamports ?? 0) * 2 * 0.1)}
        winnerPayout={Math.floor((resultWager?.stake_lamports ?? 0) * 2 * 0.9)}
        refundAmount={resultWager?.stake_lamports}
      />

      <GameResultModal
        open={!!deepLinkResultId && !!deepLinkResultWager}
        onOpenChange={(open) => {
          if (!open) { maybeOpenPunishment(deepLinkResultWager ?? null); setDeepLinkResultId(null) }
        }}
        result={resultType(deepLinkResultWager ?? null)}
        winnerWallet={(deepLinkResultWager as any)?.winner_wallet ?? null}
        winnerUsername={null}
        totalPot={(deepLinkResultWager?.stake_lamports ?? 0) * 2}
        platformFee={Math.floor((deepLinkResultWager?.stake_lamports ?? 0) * 2 * 0.1)}
        winnerPayout={Math.floor((deepLinkResultWager?.stake_lamports ?? 0) * 2 * 0.9)}
        refundAmount={deepLinkResultWager?.stake_lamports}
      />

      {/* ── Step 6: Punishment Notice — shown after GameResultModal for mod-decided losses */}
      {!punishmentLogLoading && (
        <PunishmentNoticeModal
          open={punishmentOpen}
          onOpenChange={(open) => {
            setPunishmentOpen(open)
            if (!open) { setPunishmentWager(null); setPunishmentLog(null) }
          }}
          wagerId={punishmentWager?.id ?? ''}
          offenseCount={punishmentLog?.offense_count ?? 1}
          punishment={punishmentLog?.punishment ?? 'warning'}
          onReport={() => setReportOpen(true)}
        />
      )}

      <ReportModeratorModal
        open={reportOpen}
        onOpenChange={setReportOpen}
        wagerId={punishmentWager?.id ?? ''}
      />

      <EditWagerModal
        wager={editWager}
        open={editModalOpen}
        onOpenChange={(open) => { setEditModalOpen(open); if (!open) setEditWager(null) }}
        onSave={handleSaveEditWager}
        isSaving={editWagerMutation.isPending}
        canEditGameId={editWager?.status === 'created'}
      />
    </div>
  )
}

import { Suspense } from 'react'
import { Loader2 as _L2 } from 'lucide-react'

export default function MyWagersPage() {
  return (
    <Suspense fallback={
      <div className="py-8 pb-16">
        <div className="container px-4 flex justify-center items-center py-20">
          <_L2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    }>
      <MyWagersInner />
    </Suspense>
  )
}