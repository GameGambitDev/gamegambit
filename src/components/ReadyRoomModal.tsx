/**
 * ReadyRoomModal.tsx
 *
 * FIXED Flow (v2):
 *  1. Both players click "Ready" → Supabase updated
 *  2. Server sets countdown_started_at → 10s countdown begins
 *  3. At zero:
 *     a. startGame API is called first to transition wager to 'voting' status
 *     b. ONLY AFTER startGame succeeds:
 *        - Player A's wallet popup: signs create_wager (deposits stake into PDA escrow)
 *        - Player B's wallet popup: signs join_wager   (deposits matching stake)
 *  4. Confirmed → game link shown
 *  5. If ANY step fails → Cancel button available → refunds both players
 *
 * ⚠️  React Rules of Hooks: ALL hooks must be called unconditionally at the top.
 *     The `if (!wager) return null` guard lives AFTER all hooks.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Check, X, Clock, ExternalLink, Swords,
  Loader2, AlertCircle, ShieldCheck, Ban,
} from 'lucide-react';
import { Wager, useStartGame, useCancelWager } from '@/hooks/useWagers';
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

type TxState = 'idle' | 'starting_game' | 'signing' | 'confirmed' | 'error';

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
  // ── ALL hooks unconditionally first ────────────────────────────────────────

  const { data: playerA } = usePlayerByWallet(wager?.player_a_wallet ?? null);
  const { data: playerB } = usePlayerByWallet(wager?.player_b_wallet ?? null);

  const [countdown, setCountdown] = useState<number | null>(null);
  const [localReady, setLocalReady] = useState(false);
  const [txState, setTxState] = useState<TxState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [otherPlayerInError, setOtherPlayerInError] = useState(false);

  const hasTriggeredTx = useRef(false);

  const createWagerOnChain = useCreateWagerOnChain();
  const joinWagerOnChain = useJoinWagerOnChain();
  const startGameMutation = useStartGame();
  const cancelWagerMutation = useCancelWager();

  // Derived — optional chaining because wager may be null before hooks resolve
  const isPlayerA = currentWallet === wager?.player_a_wallet;
  const isPlayerB = currentWallet === wager?.player_b_wallet;
  const bothReady = !!(wager?.ready_player_a && wager?.ready_player_b);
  const myReady = isPlayerA ? wager?.ready_player_a : wager?.ready_player_b;

  useEffect(() => {
    setLocalReady(myReady ?? false);
  }, [myReady]);

  useEffect(() => {
    if (!open) {
      setTxState('idle');
      setErrorMessage(null);
      setOtherPlayerInError(false);
      hasTriggeredTx.current = false;
    }
  }, [open]);

  // Reset otherPlayerInError when wager status changes or countdown resets
  useEffect(() => {
    if (wager?.status === 'voting' || !bothReady) {
      setOtherPlayerInError(false);
    }
  }, [wager?.status, bothReady]);

  // Monitor if other player has hit an error (wager stuck in 'joined' status after countdown)
  useEffect(() => {
    if (!wager || !bothReady || !wager.countdown_started_at) return;
    
    const checkCountdownExpired = () => {
      const startTime = new Date(wager.countdown_started_at!).getTime();
      const elapsed = Date.now() - startTime;
      // If 12 seconds have passed and wager is still in 'joined', the other player hit an error
      if (elapsed > 12000 && wager.status === 'joined' && txState === 'idle') {
        setOtherPlayerInError(true);
      }
    };
    
    const interval = setInterval(checkCountdownExpired, 1000);
    return () => clearInterval(interval);
  }, [wager, bothReady, wager?.countdown_started_at, txState]);

  useEffect(() => {
    const startedAt = wager?.countdown_started_at;
    if (!bothReady || !startedAt) {
      setCountdown(null);
      return;
    }
    const startTime = new Date(startedAt).getTime();
    const tick = () => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const remaining = COUNTDOWN_SECONDS - elapsed;
      setCountdown(remaining <= 0 ? 0 : remaining);
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [bothReady, wager?.countdown_started_at]);

  useEffect(() => {
    if (countdown !== 0 || hasTriggeredTx.current) return;
    if (!isPlayerA && !isPlayerB) return;
    if (txState !== 'idle') return;
    // If wager is already in voting/resolved status, skip startGame but still do deposit if needed
    if (wager?.status === 'voting') {
      // Wager already started, just do on-chain deposit
      hasTriggeredTx.current = true;
      triggerOnChainDeposit();
      return;
    }
    if (wager?.status === 'resolved' || wager?.status === 'cancelled') return;
    
    // NEW FLOW: Call startGame FIRST, then on-chain deposit
    hasTriggeredTx.current = true;
    triggerGameStartThenDeposit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown]);

  // NEW: Start game first (transitions wager to 'voting'), then deposit
  const triggerGameStartThenDeposit = useCallback(async () => {
    if (!wager) return;
    setTxState('starting_game');
    setErrorMessage(null);
    
    try {
      // Step 1: Call startGame to transition wager status to 'voting'
      // This MUST succeed before we ask the user to deposit funds
      await startGameMutation.mutateAsync({ wagerId: wager.id });
      
      // Step 2: Now do the on-chain deposit
      await triggerOnChainDeposit();
    } catch (err: any) {
      console.error('Game start failed:', err);
      setTxState('error');
      setErrorMessage(err.message || 'Failed to start game. Please try again or cancel.');
      hasTriggeredTx.current = false;
      toast.error('Failed to start game', { description: err.message });
    }
  }, [wager, startGameMutation]);

  const triggerOnChainDeposit = useCallback(async () => {
    if (!wager) return;
    setTxState('signing');
    setErrorMessage(null);
    
    try {
      if (isPlayerA) {
        await createWagerOnChain.mutateAsync({
          matchId: wager.match_id,
          stakeLamports: wager.stake_lamports,
          lichessGameId: wager.lichess_game_id ?? '',
          requiresModerator: wager.requires_moderator,
        });
      } else if (isPlayerB) {
        await joinWagerOnChain.mutateAsync({
          playerAWallet: wager.player_a_wallet,
          matchId: wager.match_id,
          stakeLamports: wager.stake_lamports,
          wagerId: wager.id,
        });
      }
      setTxState('confirmed');
      toast.success('Stake locked in escrow! Game starting…');
    } catch (err: any) {
      setTxState('error');
      setErrorMessage(err.message || 'Transaction failed. Your funds are safe - you can retry or cancel.');
      hasTriggeredTx.current = false;
      console.error('On-chain deposit failed:', err);
    }
  }, [wager, isPlayerA, isPlayerB, createWagerOnChain, joinWagerOnChain]);

  const handleCancelWager = useCallback(async () => {
    if (!wager) return;
    try {
      await cancelWagerMutation.mutateAsync({ 
        wagerId: wager.id, 
        reason: errorMessage ? 'transaction_failed' : 'user_cancelled' 
      });
      toast.success('Wager cancelled. Any deposited funds will be refunded.');
      onOpenChange(false);
    } catch (err: any) {
      toast.error('Failed to cancel wager', { description: err.message });
    }
  }, [wager, cancelWagerMutation, errorMessage, onOpenChange]);

  const handleReadyClick = useCallback(() => {
    const next = !localReady;
    setLocalReady(next);
    onReady(next);
  }, [localReady, onReady]);

  // ── Early return AFTER all hooks ────────────────────────────────────────────
  if (!wager) return null;

  const game = getGameData(wager.game);
  const gameLink = getGameLink(wager.game, wager.lichess_game_id);

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
            {bothReady && countdown !== null && (txState === 'idle' || txState === 'starting_game') && (
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
                      strokeDasharray={`${(countdown / COUNTDOWN_SECONDS) * 276.46} 276.46`}
                      className="transition-all duration-250"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl sm:text-3xl font-gaming font-bold text-primary">
                      {txState === 'starting_game' ? <Loader2 className="h-8 w-8 animate-spin" /> : countdown}
                    </span>
                  </div>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {txState === 'starting_game' 
                    ? 'Starting game...' 
                    : countdown === 0 
                      ? 'Confirm transaction in your wallet…' 
                      : 'Game starting in…'}
                </p>
                {countdown > 0 && txState === 'idle' && (
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
                <p className="text-sm text-muted-foreground">Waiting for wallet signature…</p>
                <p className="text-xs text-muted-foreground">
                  Your SOL is being deposited into the escrow contract.
                </p>
              </motion.div>
            )}

            {txState === 'confirmed' && (
              <motion.div key="confirmed" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-2 py-4"
              >
                <ShieldCheck className="h-8 w-8 text-success" />
                <p className="text-sm font-medium text-success">Stake locked in escrow!</p>
                <p className="text-xs text-muted-foreground">
                  Funds release automatically to the winner after the game.
                </p>
              </motion.div>
            )}

            {(txState === 'error' || otherPlayerInError) && (
              <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 space-y-3"
              >
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-destructive">
                      {otherPlayerInError ? 'Waiting for other player...' : 'Transaction Failed'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {otherPlayerInError 
                        ? 'The other player encountered an error. You can retry the game start or cancel the wager.'
                        : errorMessage || 'Make sure you have enough SOL and try again.'
                      }
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {txState === 'error' && !otherPlayerInError && (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="flex-1 text-xs" 
                      onClick={() => {
                        hasTriggeredTx.current = false;
                        setTxState('idle');
                        setErrorMessage(null);
                        triggerGameStartThenDeposit();
                      }}
                    >
                      <Loader2 className="h-3 w-3 mr-1" />
                      Retry
                    </Button>
                  )}
                  <Button 
                    size="sm" 
                    variant="destructive" 
                    className={otherPlayerInError ? 'w-full text-xs' : 'flex-1 text-xs'}
                    onClick={handleCancelWager}
                    disabled={cancelWagerMutation.isPending}
                  >
                    {cancelWagerMutation.isPending ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <Ban className="h-3 w-3 mr-1" />
                    )}
                    Cancel & Refund
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground text-center">
                  Cancelling will refund all deposited funds to both players.
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

          {/* ── Players ──────────────────────────────────────────────────── */}
          <div className="space-y-2 sm:space-y-3">
            {[
              { wallet: wager.player_a_wallet, ready: wager.ready_player_a, player: playerA, label: 'Challenger', isMe: isPlayerA },
              { wallet: wager.player_b_wallet ?? '', ready: wager.ready_player_b, player: playerB, label: 'Opponent', isMe: isPlayerB },
            ].map((p, i) => (
              <div key={i}>
                {i === 1 && <div className="flex items-center justify-center my-2"><Swords className="h-5 w-5 text-primary" /></div>}
                <div className={`flex items-center justify-between p-3 sm:p-4 rounded-lg border-2 transition-colors ${p.ready ? 'bg-success/10 border-success/30' : 'bg-muted/30 border-border'
                  }`}>
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className={`p-1.5 sm:p-2 rounded-full ${p.ready ? 'bg-success/20' : 'bg-muted'}`}>
                      {p.ready
                        ? <Check className="h-4 w-4 sm:h-5 sm:w-5 text-success" />
                        : <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                      }
                    </div>
                    <div>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">{p.label} {p.isMe && '(You)'}</p>
                      <PlayerLink walletAddress={p.wallet} username={p.player?.username} className="font-medium text-xs sm:text-sm" />
                    </div>
                  </div>
                  <Badge variant={p.ready ? 'success' : 'secondary'} className="text-[10px] sm:text-xs">
                    {p.ready ? 'Ready' : 'Waiting'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>

          {/* ── Game link ────────────────────────────────────────────────── */}
          {gameLink && txState === 'confirmed' && (
            <div className="p-2 sm:p-3 rounded-lg bg-muted/30 border border-border">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs sm:text-sm text-muted-foreground">Game Link</span>
                <a href={gameLink} target="_blank" rel="noopener noreferrer"
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
                <p className="text-muted-foreground">The challenger must add a Lichess game ID before the countdown starts.</p>
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
              {(txState === 'signing' || txState === 'starting_game') ? (
                <Button
                  variant="destructive"
                  className="flex-1 text-xs sm:text-sm"
                  onClick={handleCancelWager}
                  disabled={cancelWagerMutation.isPending}
                >
                  {cancelWagerMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Ban className="h-4 w-4 mr-2" />
                  )}
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
