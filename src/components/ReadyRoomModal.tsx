/**
 * ReadyRoomModal.tsx (v8)
 *
 * Changes vs v7:
 *  - Removed iframe (Lichess blocks embedding for live games)
 *  - Board tab now shows colored play links (urlWhite / urlBlack) from the wager
 *    so each player gets their specific color URL — they click and play on Lichess
 *  - Shows which color each player is assigned
 *  - Keeps Board/Details tab switcher
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Check, X, Clock, ExternalLink, Swords,
  Loader2, AlertCircle, ShieldCheck, Ban, Hourglass,
  Monitor, LayoutGrid, Trophy, Scale, Pencil, Info,
  Shuffle,
} from 'lucide-react';
import { Wager, useCancelWager } from '@/hooks/useWagers';
import { GAMES, formatSol } from '@/lib/constants';
import { usePlayerByWallet } from '@/hooks/usePlayer';
import { PlayerLink } from '@/components/PlayerLink';
import { motion, AnimatePresence } from 'framer-motion';
import { WagerChat } from '@/components/WagerChat';
import { useWagerChat } from '@/hooks/useWagerChat';
import { useCreateWagerOnChain, useJoinWagerOnChain, normalizeSolanaError } from '@/hooks/useSolanaProgram';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReadyRoomModalProps {
  wager: Wager | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReady: (ready: boolean) => void;
  onEditWager: () => void;
  isSettingReady?: boolean;
  currentWallet?: string;
}

type TxState = 'idle' | 'signing' | 'waiting_other' | 'confirmed' | 'error';
type ActiveTab = 'board' | 'details';

const COUNTDOWN_SECONDS = 10;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getGameData = (game: string) => {
  switch (game) {
    case 'chess': return GAMES.CHESS;
    case 'codm': return GAMES.CODM;
    case 'pubg': return GAMES.PUBG;
    default: return GAMES.CHESS;
  }
};

const getGameLink = (game: string, gameId: string | null) => {
  if (!gameId) return null;
  if (game === 'chess') return `https://lichess.org/${gameId}`;
  return null;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function ReadyRoomModal({
  wager,
  open,
  onOpenChange,
  onReady,
  onEditWager,
  isSettingReady,
  currentWallet,
}: ReadyRoomModalProps) {

  const { data: playerA } = usePlayerByWallet(wager?.player_a_wallet ?? null);
  const { data: playerB } = usePlayerByWallet(wager?.player_b_wallet ?? null);

  const [countdown, setCountdown] = useState<number | null>(null);
  const [localReady, setLocalReady] = useState(false);
  const [txState, setTxState] = useState<TxState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('details');

  const wagerRef = useRef<Wager | null>(wager);
  useEffect(() => { wagerRef.current = wager; }, [wager]);

  // ── Wager update notification state ─────────────────────────────────────
  const [updateNotice, setUpdateNotice] = useState<{ message: string; countdown: number } | null>(null);
  const updateNoticeRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevStakeRef = useRef<number | null>(null);

  // Detect when wager details change while in ready room — alert both players
  useEffect(() => {
    if (!wager || prevStakeRef.current === null) {
      if (wager) prevStakeRef.current = wager.stake_lamports;
      return;
    }
    if (wager.stake_lamports !== prevStakeRef.current) {
      prevStakeRef.current = wager.stake_lamports;
      // Reset both players' ready status happens server-side
      let secs = 5;
      setUpdateNotice({ message: `Wager updated — stake changed to ${(wager.stake_lamports / 1e9).toFixed(4)} SOL. Review before marking ready.`, countdown: secs });
      if (updateNoticeRef.current) clearInterval(updateNoticeRef.current);
      updateNoticeRef.current = setInterval(() => {
        secs--;
        if (secs <= 0) {
          clearInterval(updateNoticeRef.current!);
          setUpdateNotice(null);
        } else {
          setUpdateNotice(prev => prev ? { ...prev, countdown: secs } : null);
        }
      }, 1000);
    }
  }, [wager?.stake_lamports]);

  const hasTriggeredTx = useRef(false);
  const depositConfirmedRef = useRef(false);

  const createWagerOnChain = useCreateWagerOnChain();
  const joinWagerOnChain = useJoinWagerOnChain();
  const cancelWagerMutation = useCancelWager();
  const { sendProposal, respondToProposal } = useWagerChat(wager?.id ?? null);

  const isPlayerA = currentWallet === wager?.player_a_wallet;
  const isPlayerB = currentWallet === wager?.player_b_wallet;
  const bothReady = !!(wager?.ready_player_a && wager?.ready_player_b);
  const myReady = isPlayerA ? wager?.ready_player_a : wager?.ready_player_b;

  const otherPlayer = isPlayerA ? playerB : playerA;
  const otherWallet = isPlayerA ? wager?.player_b_wallet : wager?.player_a_wallet;

  const isVoting = wager?.status === 'voting';
  const hasLichessGame = isVoting && !!wager?.lichess_game_id && wager.game === 'chess';
  const lichessGameUrl = hasLichessGame ? `https://lichess.org/${wager.lichess_game_id}` : null;
  const gameLink = getGameLink(wager?.game ?? '', wager?.lichess_game_id ?? null);

  // Per-color URLs saved by secure-wager when platform token creates the game.
  const urlWhite = (wager as any)?.lichess_url_white as string | null;
  const urlBlack = (wager as any)?.lichess_url_black as string | null;
  const sidePreference = (wager as any)?.chess_side_preference as string | null;

  // Derive actual color from which URL this player got.
  // urlWhite/urlBlack are player-specific Lichess links — if urlWhite contains
  // a player-specific token, the player with that URL is white.
  // Fallback: use chess_side_preference if game hasn't started yet.
  const deriveMyColor = (): 'white' | 'black' | 'random' => {
    if (urlWhite && urlBlack) {
      // Once game is created, the URLs are definitive
      // Player A gets urlWhite unless creator chose black
      if (sidePreference === 'black') return isPlayerA ? 'black' : 'white';
      if (sidePreference === 'white') return isPlayerA ? 'white' : 'black';
      // Random: Player A always gets white in our Lichess API call
      return isPlayerA ? 'white' : 'black';
    }
    // Before game starts — show the preference
    if (sidePreference === 'black') return isPlayerA ? 'black' : 'white';
    if (sidePreference === 'white') return isPlayerA ? 'white' : 'black';
    return 'random';
  };

  const myColorResult = deriveMyColor();
  const myPlayUrl = isPlayerA
    ? (urlWhite || lichessGameUrl)
    : (urlBlack || lichessGameUrl);

  const myColor = myColorResult === 'white' ? 'White ♔' : myColorResult === 'black' ? 'Black ♚' : 'Random 🎲';
  const myColorClass = myColorResult === 'white' ? 'text-foreground font-semibold' : myColorResult === 'black' ? 'text-muted-foreground font-semibold' : 'text-primary';

  useEffect(() => { setLocalReady(myReady ?? false); }, [myReady]);

  // Auto-switch to board tab when game starts
  useEffect(() => {
    if (hasLichessGame && activeTab === 'details') {
      setActiveTab('board');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasLichessGame]);

  useEffect(() => {
    if (!open) {
      setTxState('idle');
      setErrorMessage(null);
      hasTriggeredTx.current = false;
      depositConfirmedRef.current = false;
      setActiveTab('details');
    }
  }, [open]);

  useEffect(() => {
    if (wager?.status === 'voting' && txState === 'waiting_other') {
      setTxState('confirmed');
      toast.success('Both stakes locked! Game is starting…');
    }
    if (wager?.status === 'voting' && txState === 'idle' && depositConfirmedRef.current) {
      setTxState('confirmed');
    }
  }, [wager?.status, txState]);

  // Server-authoritative countdown
  useEffect(() => {
    const startedAt = wager?.countdown_started_at;
    if (!bothReady || !startedAt) { setCountdown(null); return; }
    const startTime = new Date(startedAt).getTime();
    const tick = () => {
      const remaining = COUNTDOWN_SECONDS - Math.floor((Date.now() - startTime) / 1000);
      setCountdown(remaining <= 0 ? 0 : remaining);
    };
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [bothReady, wager?.countdown_started_at]);

  useEffect(() => {
    if (countdown === null || countdown > 0) return;
    if (hasTriggeredTx.current) return;
    if (!isPlayerA && !isPlayerB) return;
    if (txState !== 'idle') return;
    const w = wagerRef.current;
    if (!w) return;
    if (['resolved', 'cancelled', 'voting'].includes(w.status)) return;
    hasTriggeredTx.current = true;
    runDepositFlow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown]);

  const runDepositFlow = useCallback(async () => {
    const w = wagerRef.current;
    if (!w || txState === 'signing') return;
    setErrorMessage(null);
    setTxState('signing');
    try {
      if (!depositConfirmedRef.current) {
        if (isPlayerA) {
          await createWagerOnChain.mutateAsync({
            matchId: w.match_id,
            stakeLamports: w.stake_lamports,
            lichessGameId: w.lichess_game_id ?? '',
            requiresModerator: (w as any).requires_moderator,
            wagerId: w.id,
          });
        } else if (isPlayerB) {
          await joinWagerOnChain.mutateAsync({
            playerAWallet: w.player_a_wallet,
            matchId: w.match_id,
            stakeLamports: w.stake_lamports,
            wagerId: w.id,
          });
        }
        depositConfirmedRef.current = true;
      }
      if (wagerRef.current?.status === 'voting') {
        setTxState('confirmed');
        toast.success('Both stakes locked! Game is starting…');
      } else {
        setTxState('waiting_other');
      }
    } catch (err: unknown) {
      const message = normalizeSolanaError(err);
      console.error('[ReadyRoom] deposit failed:', message);
      setTxState('error');
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  }, [isPlayerA, isPlayerB, createWagerOnChain, joinWagerOnChain, txState]);

  const handleRetry = useCallback(() => {
    hasTriggeredTx.current = false;
    depositConfirmedRef.current = false;
    setTxState('idle');
    setErrorMessage(null);
    setTimeout(() => { hasTriggeredTx.current = true; runDepositFlow(); }, 300);
  }, [runDepositFlow]);

  const handleCancelWager = useCallback(async () => {
    const w = wagerRef.current;
    if (!w) return;
    try {
      await cancelWagerMutation.mutateAsync({
        wagerId: w.id,
        reason: errorMessage ? 'transaction_failed' : 'user_cancelled',
      });
      toast.success('Wager cancelled. Any deposited funds will be refunded.');
      onOpenChange(false);
    } catch (err: unknown) {
      toast.error('Failed to cancel wager', { description: normalizeSolanaError(err) });
    }
  }, [cancelWagerMutation, errorMessage, onOpenChange]);

  const handleReadyClick = useCallback(() => {
    const next = !localReady;
    setLocalReady(next);
    onReady(next);
  }, [localReady, onReady]);


  // ── Resolved / Cancelled state ────────────────────────────────────────────
  const isResolved = wager?.status === 'resolved';
  const isCancelled = wager?.status === 'cancelled';
  const isEnded = isResolved || isCancelled;
  const winnerWallet = isResolved ? (wager as any)?.winner_wallet as string | null : null;
  const isDraw = isResolved && !winnerWallet;
  const currentUserWon = !!winnerWallet && winnerWallet === currentWallet;
  const winnerPlayer = winnerWallet === wager?.player_a_wallet ? playerA : playerB;
  const winnerUsername = winnerPlayer?.username ?? null;
  const totalPot = (wager?.stake_lamports ?? 0) * 2;
  const winnerPayout = Math.floor(totalPot * 0.9);

  if (!wager) return null;

  // Declare game early — needed in both ended overlay and main render
  const game = getGameData(wager.game);

  // ── Render resolved/cancelled overlay ─────────────────────────────────────
  if (isEnded) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md border-border bg-card" aria-describedby={undefined}>
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="text-3xl">{game.icon}</div>
              <div>
                <DialogTitle className="font-gaming">
                  {isCancelled ? 'Wager Cancelled' : isDraw ? 'Game Ended — Draw' : 'Game Ended'}
                </DialogTitle>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {isCancelled && (
              <div className="p-4 rounded-lg bg-muted/30 border border-border text-center space-y-2">
                <Ban className="h-10 w-10 text-muted-foreground mx-auto" />
                <p className="text-sm font-medium">This wager was cancelled.</p>
                <p className="text-xs text-muted-foreground">All deposited funds were refunded to each player.</p>
              </div>
            )}
            {isDraw && (
              <div className="p-4 rounded-lg bg-muted/30 border border-border text-center space-y-2">
                <Scale className="h-10 w-10 text-muted-foreground mx-auto" />
                <p className="text-sm font-medium">The match ended in a draw.</p>
                <p className="text-xs text-muted-foreground">Each player's stake was refunded.</p>
                <p className="text-lg font-gaming text-foreground">{formatSol(wager.stake_lamports)} SOL returned</p>
              </div>
            )}
            {isResolved && !isDraw && (
              <div className={`p-4 rounded-lg border text-center space-y-2 ${currentUserWon ? 'bg-success/10 border-success/30' : 'bg-muted/30 border-border'}`}>
                {currentUserWon ? (
                  <Trophy className="h-10 w-10 text-accent mx-auto" />
                ) : (
                  <Swords className="h-10 w-10 text-muted-foreground mx-auto" />
                )}
                <p className={`text-lg font-gaming font-bold ${currentUserWon ? 'text-success' : 'text-muted-foreground'}`}>
                  {currentUserWon ? 'You Won!' : 'You Lost'}
                </p>
                {winnerWallet && (
                  <div>
                    <p className="text-xs text-muted-foreground">Winner</p>
                    <PlayerLink walletAddress={winnerWallet} username={winnerUsername} className="font-medium text-sm" />
                  </div>
                )}
                <p className={`text-xl font-gaming ${currentUserWon ? 'text-success' : 'text-muted-foreground'}`}>
                  {currentUserWon ? `+${formatSol(winnerPayout)} SOL` : `-${formatSol(wager.stake_lamports)} SOL`}
                </p>
              </div>
            )}
            {/* Lichess game link if available */}
            {wager.lichess_game_id && (
              <a
                href={`https://lichess.org/${wager.lichess_game_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border hover:border-primary/40 transition-colors"
              >
                <span className="text-sm text-muted-foreground">View game on Lichess</span>
                <div className="flex items-center gap-1 text-primary text-sm">
                  {wager.lichess_game_id} <ExternalLink className="h-3 w-3" />
                </div>
              </a>
            )}
            <Button variant="default" className="w-full" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const showCountdown = bothReady && countdown !== null && (txState === 'idle' || txState === 'signing');
  const countdownFraction = Math.max(0, Math.min(1, (countdown ?? 0) / COUNTDOWN_SECONDS));
  const ringCircumference = 276.46;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`border-primary/30 bg-card max-h-[90vh] overflow-y-auto ${hasLichessGame ? 'sm:max-w-2xl' : 'sm:max-w-lg'}`}
        aria-describedby={undefined}
      >
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="text-3xl sm:text-4xl">{game.icon}</div>
              <div>
                <DialogTitle className="text-lg sm:text-xl font-gaming">Ready Room</DialogTitle>
                <Badge variant="joined">Match Found</Badge>
              </div>
            </div>
            {/* Tab switcher — only visible once game starts */}
            {hasLichessGame && (
              <div className="flex rounded-lg border border-border overflow-hidden">
                <button
                  onClick={() => setActiveTab('board')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors ${activeTab === 'board' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                >
                  <Monitor className="h-3.5 w-3.5" />
                  Play
                </button>
                <button
                  onClick={() => setActiveTab('details')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors ${activeTab === 'details' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  Details
                </button>
              </div>
            )}
          </div>
        </DialogHeader>

        {/* ── PLAY TAB — shown when game is live ────────────────────────── */}
        {hasLichessGame && activeTab === 'board' && (
          <div className="mt-4 space-y-4">

            {/* Your color + play button */}
            <div className="p-4 rounded-lg border border-primary/20 bg-primary/5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">You are playing as</p>
                  <p className={`text-lg font-gaming font-bold ${myColorClass}`}>{myColor}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">vs</p>
                  <p className="text-sm font-medium">
                    {otherPlayer?.username || (otherWallet ? `${otherWallet.slice(0, 4)}…${otherWallet.slice(-4)}` : 'Opponent')}
                  </p>
                </div>
              </div>

              <a
                href={myPlayUrl!}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <Button variant="neon" className="w-full h-12 text-base font-gaming">
                  ♟ Play on Lichess <ExternalLink className="h-4 w-4 ml-2" />
                </Button>
              </a>

              <p className="text-[11px] text-muted-foreground text-center">
                Opens Lichess in a new tab — your color is pre-assigned, just click the link and make your move.
              </p>
            </div>

            {/* Both player links */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium">Both player links</p>
              <div className="grid grid-cols-2 gap-2">
                <a
                  href={urlWhite || lichessGameUrl!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-2.5 rounded-lg border border-border hover:border-primary/50 transition-colors bg-muted/20"
                >
                  <div>
                    <p className="text-[10px] text-muted-foreground">
                      {playerA?.username || wager.player_a_wallet.slice(0, 6) + '…'}
                    </p>
                    <p className="text-xs font-medium">White ♔</p>
                  </div>
                  <ExternalLink className="h-3 w-3 text-muted-foreground" />
                </a>
                <a
                  href={urlBlack || lichessGameUrl!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-2.5 rounded-lg border border-border hover:border-primary/50 transition-colors bg-muted/20"
                >
                  <div>
                    <p className="text-[10px] text-muted-foreground">
                      {playerB?.username || (wager.player_b_wallet?.slice(0, 6) + '…')}
                    </p>
                    <p className="text-xs font-medium">Black ♚</p>
                  </div>
                  <ExternalLink className="h-3 w-3 text-muted-foreground" />
                </a>
              </div>
            </div>

            {/* Game ID */}
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/20 border border-border">
              <span className="text-xs text-muted-foreground">Game ID</span>
              <a
                href={lichessGameUrl!}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs text-primary hover:underline flex items-center gap-1"
              >
                {wager.lichess_game_id} <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            <p className="text-[11px] text-center text-muted-foreground">
              GameGambit polls Lichess every few seconds — winner is paid out automatically when the game ends.
            </p>
          </div>
        )}

        {/* ── DETAILS TAB (or default when no board) ────────────────────── */}
        {(!hasLichessGame || activeTab === 'details') && (
          <div className="space-y-4 sm:space-y-6 mt-4">

            {/* Countdown */}
            <AnimatePresence>
              {showCountdown && (
                <motion.div
                  key="countdown"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="text-center"
                >
                  <div className="relative w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-3">
                    <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
                    <svg className="w-20 h-20 sm:w-24 sm:h-24 transform -rotate-90" viewBox="0 0 96 96">
                      <circle
                        cx="48" cy="48" r="44"
                        fill="none"
                        stroke="hsl(var(--primary))"
                        strokeWidth="4"
                        strokeDasharray={`${countdownFraction * ringCircumference} ${ringCircumference}`}
                        className="transition-all duration-200"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-2xl sm:text-3xl font-gaming font-bold text-primary">
                        {countdown}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    {txState === 'signing'
                      ? 'Confirm the transaction in your wallet…'
                      : (countdown ?? 1) <= 0 ? 'Opening wallet…' : 'Deposit your stake in…'
                    }
                  </p>
                  {(countdown ?? 0) > 0 && txState === 'idle' && (
                    <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                      Click "Not Ready" to cancel
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Tx state feedback */}
            <AnimatePresence>
              {txState === 'signing' && (
                <motion.div key="signing" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="flex flex-col items-center gap-2 py-4"
                >
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Waiting for on-chain confirmation…</p>
                  <p className="text-xs text-muted-foreground">Your SOL is being deposited into the escrow contract.</p>
                </motion.div>
              )}

              {txState === 'waiting_other' && (
                <motion.div key="waiting_other" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center gap-3 py-4"
                >
                  <div className="relative">
                    <ShieldCheck className="h-10 w-10 text-success" />
                    <Hourglass className="h-4 w-4 text-muted-foreground absolute -bottom-1 -right-1" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-success">Your stake is locked ✓</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Waiting for{' '}
                      <span className="font-medium text-foreground">
                        {otherPlayer?.username || (otherWallet ? `${otherWallet.slice(0, 4)}…${otherWallet.slice(-4)}` : 'opponent')}
                      </span>
                      {' '}to deposit their stake…
                    </p>
                  </div>
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </motion.div>
              )}

              {txState === 'confirmed' && !hasLichessGame && (
                <motion.div key="confirmed" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center gap-2 py-4"
                >
                  <ShieldCheck className="h-8 w-8 text-success" />
                  <p className="text-sm font-medium text-success">Both stakes locked in escrow!</p>
                  <p className="text-xs text-muted-foreground">Funds release automatically to the winner after the game.</p>
                </motion.div>
              )}

              {txState === 'confirmed' && hasLichessGame && (
                <motion.div key="confirmed-chess" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center gap-2 py-3 px-4 rounded-lg bg-success/10 border border-success/30"
                >
                  <ShieldCheck className="h-7 w-7 text-success" />
                  <p className="text-sm font-medium text-success">Stakes locked! Switch to the Play tab to start.</p>
                </motion.div>
              )}

              {txState === 'error' && (
                <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 space-y-3"
                >
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-destructive">Transaction Failed</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {errorMessage || 'Make sure you have enough SOL and try again.'}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={handleRetry}>
                      <Loader2 className="h-3 w-3 mr-1" /> Retry
                    </Button>
                    <Button
                      size="sm" variant="destructive" className="flex-1 text-xs"
                      onClick={handleCancelWager} disabled={cancelWagerMutation.isPending}
                    >
                      {cancelWagerMutation.isPending
                        ? <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        : <Ban className="h-3 w-3 mr-1" />
                      }
                      Cancel & Refund
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground text-center">
                    Your funds are safe. Cancelling refunds both players.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Stake info */}
            <div className="p-3 sm:p-4 rounded-lg bg-primary/10 border border-primary/20 text-center">
              <p className="text-xs sm:text-sm text-muted-foreground mb-1">Total Pool</p>
              <p className="text-xl sm:text-2xl font-gaming font-bold text-primary">
                {formatSol(wager.stake_lamports * 2)} SOL
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Each player stakes {formatSol(wager.stake_lamports)} SOL — winner gets 90%
              </p>
              {/* Chess side preference — shown to both players */}
              {wager.game === 'chess' && sidePreference && !hasLichessGame && (
                <div className="mt-2 pt-2 border-t border-primary/20 flex items-center justify-center gap-2">
                  {sidePreference === 'random' ? (
                    <><Shuffle className="h-3 w-3 text-muted-foreground" /><span className="text-[10px] text-muted-foreground">Sides assigned randomly</span></>
                  ) : sidePreference === 'white' ? (
                    <><span className="text-[10px] text-muted-foreground">Creator plays</span><span className="text-[10px] font-medium text-foreground">White ♔</span></>
                  ) : (
                    <><span className="text-[10px] text-muted-foreground">Creator plays</span><span className="text-[10px] font-medium text-muted-foreground">Black ♚</span></>
                  )}
                </div>
              )}
            </div>

            {/* Players */}
            <div className="space-y-2 sm:space-y-3">
              {[
                {
                  wallet: wager.player_a_wallet,
                  ready: wager.ready_player_a,
                  deposited: (wager as any).deposit_player_a,
                  player: playerA,
                  label: 'Challenger',
                  isMe: isPlayerA,
                },
                {
                  wallet: wager.player_b_wallet ?? '',
                  ready: wager.ready_player_b,
                  deposited: (wager as any).deposit_player_b,
                  player: playerB,
                  label: 'Opponent',
                  isMe: isPlayerB,
                },
              ].map((p, i) => {
                const showDepositStatus =
                  txState === 'waiting_other' || txState === 'confirmed' || wager.status === 'voting';
                return (
                  <div key={i}>
                    {i === 1 && (
                      <div className="flex items-center justify-center my-2">
                        <Swords className="h-5 w-5 text-primary" />
                      </div>
                    )}
                    <div className={`flex items-center justify-between p-3 sm:p-4 rounded-lg border-2 transition-colors ${showDepositStatus
                      ? p.deposited ? 'bg-success/10 border-success/30' : 'bg-muted/30 border-border'
                      : p.ready ? 'bg-success/10 border-success/30' : 'bg-muted/30 border-border'
                      }`}>
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className={`p-1.5 sm:p-2 rounded-full ${showDepositStatus
                          ? p.deposited ? 'bg-success/20' : 'bg-muted'
                          : p.ready ? 'bg-success/20' : 'bg-muted'
                          }`}>
                          {showDepositStatus
                            ? p.deposited
                              ? <ShieldCheck className="h-4 w-4 sm:h-5 sm:w-5 text-success" />
                              : <Hourglass className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                            : p.ready
                              ? <Check className="h-4 w-4 sm:h-5 sm:w-5 text-success" />
                              : <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                          }
                        </div>
                        <div>
                          <p className="text-[10px] sm:text-xs text-muted-foreground">
                            {p.label} {p.isMe && '(You)'}
                          </p>
                          <PlayerLink
                            walletAddress={p.wallet}
                            username={p.player?.username}
                            className="font-medium text-xs sm:text-sm"
                          />
                        </div>
                      </div>
                      <Badge
                        variant={
                          showDepositStatus
                            ? p.deposited ? 'success' : 'secondary'
                            : p.ready ? 'success' : 'secondary'
                        }
                        className="text-[10px] sm:text-xs"
                      >
                        {showDepositStatus
                          ? p.deposited ? 'Deposited ✓' : 'Pending…'
                          : p.ready ? 'Ready' : 'Waiting'
                        }
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Game link — shown once confirmed */}
            {gameLink && txState === 'confirmed' && (
              <div className="p-2 sm:p-3 rounded-lg bg-muted/30 border border-border">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs sm:text-sm text-muted-foreground">Game Link</span>
                  <a
                    href={gameLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline flex items-center gap-1 text-xs sm:text-sm font-medium"
                  >
                    {wager.lichess_game_id} <ExternalLink className="h-3 w-3 flex-shrink-0" />
                  </a>
                </div>
              </div>
            )}

            {/* Waiting for game to be created */}
            {!wager.lichess_game_id && wager.game === 'chess' && wager.status === 'voting' && (
              <div className="p-2 sm:p-3 rounded-lg bg-muted/30 border border-border flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary flex-shrink-0" />
                <p className="text-xs text-muted-foreground">
                  Creating your Lichess game…
                </p>
              </div>
            )}

            {/* Wager update notice — shown when creator edits wager mid-ready-room */}
            {updateNotice && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/40 flex items-start gap-2"
              >
                <Info className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-amber-300 font-medium">{updateNotice.message}</p>
                </div>
                <span className="text-xs text-amber-400 font-gaming flex-shrink-0">{updateNotice.countdown}s</span>
              </motion.div>
            )}

            {/* ── Chat ───────────────────────────────────────────────── */}
            {wager.status === 'joined' && wager.player_b_wallet && (
              <WagerChat
                wager={wager}
                currentWallet={currentWallet ?? ''}
                opponentWallet={isPlayerA ? (wager.player_b_wallet ?? '') : wager.player_a_wallet}
              />
            )}

            {/* Actions */}
            {txState !== 'confirmed' && txState !== 'error' && (
              <div className="space-y-2 pt-2">
                {/* Creator controls — always visible, even when opponent is ready */}
                {isPlayerA && wager.status !== 'voting' && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={onEditWager}>
                      <Pencil className="h-3 w-3 mr-1" /> Edit Wager
                    </Button>
                    <Button
                      variant="destructive" size="sm" className="flex-1 text-xs"
                      onClick={handleCancelWager} disabled={cancelWagerMutation.isPending}
                    >
                      {cancelWagerMutation.isPending
                        ? <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        : <Ban className="h-3 w-3 mr-1" />
                      }
                      Delete Wager
                    </Button>
                  </div>
                )}
                <div className="flex gap-2">
                  {txState === 'signing' || txState === 'waiting_other' ? (
                    <Button
                      variant="destructive" className="flex-1 text-xs sm:text-sm"
                      onClick={handleCancelWager} disabled={cancelWagerMutation.isPending}
                    >
                      {cancelWagerMutation.isPending
                        ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        : <Ban className="h-4 w-4 mr-2" />
                      }
                      Cancel Wager
                    </Button>
                  ) : (
                    <Button
                      variant={localReady ? 'destructive' : 'neon'}
                      className="flex-1 text-xs sm:text-sm"
                      onClick={handleReadyClick}
                      disabled={isSettingReady || (countdown !== null && countdown <= 0)}
                    >
                      {isSettingReady
                        ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        : localReady
                          ? <X className="h-4 w-4 mr-2" />
                          : <Check className="h-4 w-4 mr-2" />
                      }
                      {localReady ? 'Not Ready' : 'Ready'}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}