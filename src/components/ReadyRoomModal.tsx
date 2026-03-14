/**
 * ReadyRoomModal.tsx  (v5)
 *
 * Correct Flow:
 *  1. Both players click "Ready" → Supabase updated
 *  2. Server sets countdown_started_at → 10s countdown
 *  3. At zero → wallet popup appears → player signs deposit tx
 *  4. On-chain deposit confirmed → server records deposit_player_a / deposit_player_b
 *  5. When BOTH deposits confirmed server auto-flips wager to 'voting'
 *  6. While waiting for other player → "Waiting for <name> to deposit…" shown
 *  7. txState → 'confirmed' once wager.status === 'voting'
 *
 * Key changes vs v4:
 *  - startGame NEVER called from client — server owns that transition
 *  - Both players can deposit in any order
 *  - wagerId passed to on-chain hooks so server can record deposit flag
 *  - "waiting_other" txState shows while one player deposited, other hasn't
 *  - Mobile fixed: useSolanaProgram now uses sendTransaction (adapter handles deep links)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Check, X, Clock, ExternalLink, Swords,
  Loader2, AlertCircle, ShieldCheck, Ban, Hourglass,
} from 'lucide-react';
import { Wager, useCancelWager } from '@/hooks/useWagers';
import { GAMES, formatSol } from '@/lib/constants';
import { usePlayerByWallet } from '@/hooks/usePlayer';
import { PlayerLink } from '@/components/PlayerLink';
import { motion, AnimatePresence } from 'framer-motion';
import { useCreateWagerOnChain, useJoinWagerOnChain } from '@/hooks/useSolanaProgram';
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

// idle           = waiting for countdown
// signing        = wallet popup open / waiting for on-chain confirmation
// waiting_other  = my deposit confirmed, waiting for other player to deposit
// confirmed      = both deposits in, wager is 'voting'
// error          = something failed
type TxState = 'idle' | 'signing' | 'waiting_other' | 'confirmed' | 'error';

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

function parseWalletError(err: unknown): string {
  if (!err) return 'Unknown error';
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  if (
    lower.includes('user rejected') ||
    lower.includes('rejected the request') ||
    lower.includes('transaction cancelled') ||
    lower.includes('cancelled') ||
    lower.includes('denied')
  ) {
    return 'Transaction cancelled — you rejected the wallet request.';
  }
  return msg || 'Transaction failed. Your funds are safe.';
}

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
  // ── ALL hooks unconditionally first ────────────────────────────────────────

  const { data: playerA } = usePlayerByWallet(wager?.player_a_wallet ?? null);
  const { data: playerB } = usePlayerByWallet(wager?.player_b_wallet ?? null);

  const [countdown, setCountdown] = useState<number | null>(null);
  const [localReady, setLocalReady] = useState(false);
  const [txState, setTxState] = useState<TxState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const wagerRef = useRef<Wager | null>(wager);
  useEffect(() => { wagerRef.current = wager; }, [wager]);

  const hasTriggeredTx = useRef(false);
  const depositConfirmedRef = useRef(false);

  const createWagerOnChain = useCreateWagerOnChain();
  const joinWagerOnChain = useJoinWagerOnChain();
  const cancelWagerMutation = useCancelWager();

  const isPlayerA = currentWallet === wager?.player_a_wallet;
  const isPlayerB = currentWallet === wager?.player_b_wallet;
  const bothReady = !!(wager?.ready_player_a && wager?.ready_player_b);
  const myReady = isPlayerA ? wager?.ready_player_a : wager?.ready_player_b;

  // Deposit flags from DB (set by server after on-chain confirmation recorded)
  const myDeposit = isPlayerA
    ? (wager as any)?.deposit_player_a
    : (wager as any)?.deposit_player_b;
  const otherDeposit = isPlayerA
    ? (wager as any)?.deposit_player_b
    : (wager as any)?.deposit_player_a;
  const otherPlayer = isPlayerA ? playerB : playerA;
  const otherWallet = isPlayerA ? wager?.player_b_wallet : wager?.player_a_wallet;

  useEffect(() => { setLocalReady(myReady ?? false); }, [myReady]);

  // Reset when modal closes
  useEffect(() => {
    if (!open) {
      setTxState('idle');
      setErrorMessage(null);
      hasTriggeredTx.current = false;
      depositConfirmedRef.current = false;
    }
  }, [open]);

  // Watch for wager flipping to 'voting' — that means both deposits confirmed
  useEffect(() => {
    if (wager?.status === 'voting' && txState === 'waiting_other') {
      setTxState('confirmed');
      toast.success('Both stakes locked! Game is starting…');
    }
    // Also handle case where we land here after a refresh and game already started
    if (wager?.status === 'voting' && txState === 'idle' && depositConfirmedRef.current) {
      setTxState('confirmed');
    }
  }, [wager?.status, txState]);

  // Countdown ticker
  useEffect(() => {
    const startedAt = wager?.countdown_started_at;
    if (!bothReady || !startedAt) { setCountdown(null); return; }
    const startTime = new Date(startedAt).getTime();
    const tick = () => {
      const remaining = COUNTDOWN_SECONDS - Math.floor((Date.now() - startTime) / 1000);
      setCountdown(remaining <= 0 ? 0 : remaining);
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [bothReady, wager?.countdown_started_at]);

  // Fire deposit flow when countdown hits 0
  useEffect(() => {
    if (countdown !== 0) return;
    if (hasTriggeredTx.current) return;
    if (!isPlayerA && !isPlayerB) return;
    if (txState !== 'idle') return;

    const w = wagerRef.current;
    if (!w) return;
    if (w.status === 'resolved' || w.status === 'cancelled' || w.status === 'voting') return;

    hasTriggeredTx.current = true;
    runDepositFlow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown]);

  const runDepositFlow = useCallback(async () => {
    const w = wagerRef.current;
    if (!w) return;

    setErrorMessage(null);

    try {
      // ── Step 1: On-chain deposit (skip if already confirmed on a prior attempt)
      if (!depositConfirmedRef.current) {
        setTxState('signing');

        if (isPlayerA) {
          await createWagerOnChain.mutateAsync({
            matchId: w.match_id,
            stakeLamports: w.stake_lamports,
            lichessGameId: w.lichess_game_id ?? '',
            requiresModerator: w.requires_moderator,
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

      // ── Step 2: My deposit is confirmed.
      // The server will auto-flip to 'voting' when both deposits are in.
      // If the other player already deposited, the server already did it — wager
      // will be 'voting' in the next realtime tick and the useEffect above catches it.
      // If not, show "waiting for other player" — wager still 'joined'.
      if (wagerRef.current?.status === 'voting') {
        setTxState('confirmed');
        toast.success('Both stakes locked! Game is starting…');
      } else {
        setTxState('waiting_other');
      }

    } catch (err: unknown) {
      const message = parseWalletError(err);
      console.error('[ReadyRoomModal] runDepositFlow error:', err);
      setTxState('error');
      setErrorMessage(message);
    }
  }, [isPlayerA, isPlayerB, createWagerOnChain, joinWagerOnChain]);

  const handleRetry = useCallback(() => {
    hasTriggeredTx.current = false;
    setTxState('idle');
    setErrorMessage(null);
    hasTriggeredTx.current = true;
    runDepositFlow();
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
      toast.error('Failed to cancel wager', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }, [cancelWagerMutation, errorMessage, onOpenChange]);

  const handleReadyClick = useCallback(() => {
    const next = !localReady;
    setLocalReady(next);
    onReady(next);
  }, [localReady, onReady]);

  // ── Early return AFTER all hooks ────────────────────────────────────────────
  if (!wager) return null;

  const game = getGameData(wager.game);
  const gameLink = getGameLink(wager.game, wager.lichess_game_id);

  const showCountdown =
    bothReady &&
    countdown !== null &&
    (txState === 'idle' || txState === 'signing');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-lg border-primary/30 bg-card max-h-[90vh] overflow-y-auto"
        aria-describedby={undefined}
      >
        <DialogHeader>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="text-3xl sm:text-4xl">{game.icon}</div>
            <div>
              <DialogTitle className="text-lg sm:text-xl font-gaming">Ready Room</DialogTitle>
              <Badge variant="joined">Match Found</Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 sm:space-y-6 mt-4">

          {/* ── Countdown Timer ──────────────────────────────────────────── */}
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
                      strokeDasharray={`${(Math.max(countdown ?? 0, 0) / COUNTDOWN_SECONDS) * 276.46} 276.46`}
                      className="transition-all duration-250"
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
                    : countdown === 0
                      ? 'Opening wallet…'
                      : 'Deposit your stake in…'
                  }
                </p>
                {countdown !== null && countdown > 0 && txState === 'idle' && (
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                    Click "Not Ready" to cancel
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Tx state feedback ────────────────────────────────────────── */}
          <AnimatePresence>
            {txState === 'signing' && (
              <motion.div key="signing" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex flex-col items-center gap-2 py-4"
              >
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Waiting for on-chain confirmation…</p>
                <p className="text-xs text-muted-foreground">
                  Your SOL is being deposited into the escrow contract.
                </p>
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

            {txState === 'confirmed' && (
              <motion.div key="confirmed" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-2 py-4"
              >
                <ShieldCheck className="h-8 w-8 text-success" />
                <p className="text-sm font-medium text-success">Both stakes locked in escrow!</p>
                <p className="text-xs text-muted-foreground">
                  Funds release automatically to the winner after the game.
                </p>
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
                    <Loader2 className="h-3 w-3 mr-1" />
                    Retry
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="flex-1 text-xs"
                    onClick={handleCancelWager}
                    disabled={cancelWagerMutation.isPending}
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

          {/* ── Stake info ───────────────────────────────────────────────── */}
          <div className="p-3 sm:p-4 rounded-lg bg-primary/10 border border-primary/20 text-center">
            <p className="text-xs sm:text-sm text-muted-foreground mb-1">Total Pool</p>
            <p className="text-xl sm:text-2xl font-gaming font-bold text-primary">
              {formatSol(wager.stake_lamports * 2)} SOL
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Each player stakes {formatSol(wager.stake_lamports)} SOL — winner gets 90%
            </p>
          </div>

          {/* ── Players — show deposit status ────────────────────────────── */}
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
              const showDepositStatus = txState === 'waiting_other' || txState === 'confirmed' || wager.status === 'voting';
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

          {/* ── Game link ────────────────────────────────────────────────── */}
          {gameLink && txState === 'confirmed' && (
            <div className="p-2 sm:p-3 rounded-lg bg-muted/30 border border-border">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs sm:text-sm text-muted-foreground">Game Link</span>
                <a
                  href={gameLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-center gap-1 text-xs sm:text-sm font-medium truncate max-w-[150px] sm:max-w-none"
                >
                  {wager.lichess_game_id} <ExternalLink className="h-3 w-3 flex-shrink-0" />
                </a>
              </div>
            </div>
          )}

          {/* ── No game link warning ─────────────────────────────────────── */}
          {!gameLink && wager.game === 'chess' && txState !== 'confirmed' && (
            <div className="p-2 sm:p-3 rounded-lg bg-warning/10 border border-warning/30 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
              <div className="text-xs sm:text-sm">
                <p className="font-medium text-warning">No Lichess game linked</p>
                <p className="text-muted-foreground">
                  The challenger must add a Lichess game ID before the countdown starts.
                </p>
              </div>
            </div>
          )}

          {/* ── Actions ──────────────────────────────────────────────────── */}
          {txState !== 'confirmed' && txState !== 'error' && (
            <div className="flex gap-2 pt-2">
              {isPlayerA && !bothReady && (
                <Button variant="outline" className="flex-1 text-xs sm:text-sm" onClick={onEditWager}>
                  Edit Wager
                </Button>
              )}
              {txState === 'signing' || txState === 'waiting_other' ? (
                <Button
                  variant="destructive"
                  className="flex-1 text-xs sm:text-sm"
                  onClick={handleCancelWager}
                  disabled={cancelWagerMutation.isPending}
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
                  disabled={isSettingReady || countdown === 0}
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
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
}