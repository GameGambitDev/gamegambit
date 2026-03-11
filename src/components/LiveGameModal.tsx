import { useState, useEffect, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Trophy, Loader2, RefreshCw, Clock, Play, Crown, Minus } from 'lucide-react';
import { Wager, useCheckGameComplete } from '@/hooks/useWagers';
import { GAMES, formatSol, truncateAddress } from '@/lib/constants';
import { usePlayerByWallet } from '@/hooks/usePlayer';
import { PlayerLink } from '@/components/PlayerLink';
import { useLichessGameStream, getLichessGameUrl, getLichessEmbedUrl, isGameFinished as checkIsGameFinished, getGameStatusText } from '@/hooks/useLichess';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { useQueryClient } from '@tanstack/react-query';
import { TransactionHistory } from '@/components/TransactionHistory';

interface LiveGameModalProps {
  wager: Wager | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentWallet?: string;
}

const getGameData = (game: string) => {
  switch (game) {
    case 'chess': return GAMES.CHESS;
    case 'codm': return GAMES.CODM;
    case 'pubg': return GAMES.PUBG;
    default: return GAMES.CHESS;
  }
};

export function LiveGameModal({ wager, open, onOpenChange, currentWallet }: LiveGameModalProps) {
  const queryClient = useQueryClient();
  const { data: playerA } = usePlayerByWallet(wager?.player_a_wallet || null);
  const { data: playerB } = usePlayerByWallet(wager?.player_b_wallet || null);
  const { data: lichessGame, refetch: refetchGame } = useLichessGameStream(wager?.lichess_game_id);
  const checkGameComplete = useCheckGameComplete();

  const [showEmbed, setShowEmbed] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const isCheckingRef = useRef(false);
  const [hasShownResult, setHasShownResult] = useState(false);

  const resolvedWinnerWallet = wager?.winner_wallet ?? null;
  const isWagerResolved = wager?.status === 'resolved' || (wager?.status as string) === 'closed';
  const gameFinished = isWagerResolved;
  const isDraw = gameFinished && !resolvedWinnerWallet;

  const isCurrentPlayerWinner = !!resolvedWinnerWallet && currentWallet === resolvedWinnerWallet;
  const isCurrentPlayerLoser =
    gameFinished && !isDraw && !!currentWallet &&
    (currentWallet === wager?.player_a_wallet || currentWallet === wager?.player_b_wallet) &&
    currentWallet !== resolvedWinnerWallet;
  const isParticipant = currentWallet === wager?.player_a_wallet || currentWallet === wager?.player_b_wallet;

  const PLATFORM_FEE = 0.10;
  const totalPot = (wager?.stake_lamports ?? 0) * 2;
  const winnerPayout = Math.floor(totalPot * (1 - PLATFORM_FEE));
  const platformFee = totalPot - winnerPayout;

  const winnerUsername =
    resolvedWinnerWallet === wager?.player_a_wallet ? playerA?.username :
      resolvedWinnerWallet === wager?.player_b_wallet ? playerB?.username : undefined;

  // Reset when wager changes
  useEffect(() => {
    if (wager?.id) {
      setHasShownResult(false);
      setShowEmbed(false);
    }
  }, [wager?.id]);

  // Confetti + toast when result first detected
  useEffect(() => {
    if (!gameFinished || hasShownResult) return;
    setHasShownResult(true);

    if (isCurrentPlayerWinner) {
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
      toast.success('🎉 You won! Funds are being sent to your wallet.');
    } else if (isDraw) {
      toast.info('Game ended in a draw — stakes will be returned.');
    } else if (isCurrentPlayerLoser) {
      toast.error('Game over. Better luck next time!');
    }
  }, [gameFinished, hasShownResult, isCurrentPlayerWinner, isDraw, isCurrentPlayerLoser]);

  // Poll every 8s while game is active — fire-and-forget, result arrives via realtime
  const runCheck = useCallback(() => {
    if (!wager || isCheckingRef.current || gameFinished) return;
    isCheckingRef.current = true;
    setIsChecking(true);
    checkGameComplete.mutate({ wagerId: wager.id }, {
      onSettled: () => {
        isCheckingRef.current = false;
        setIsChecking(false);
      }
    });
  }, [wager, gameFinished, checkGameComplete]);

  useEffect(() => {
    if (!open || !wager || wager.status !== 'voting') return;
    // Initial check after a short delay
    const initial = setTimeout(runCheck, 2000);
    const interval = setInterval(runCheck, 8000);
    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, [open, wager?.id, wager?.status]);

  const handleManualCheck = useCallback(() => {
    if (!wager) return;
    refetchGame();
    runCheck();
    toast.info('Checking game status...');
  }, [wager, refetchGame, runCheck]);

  if (!wager) return null;

  const game = getGameData(wager.game);
  const gameLink = wager.lichess_game_id ? getLichessGameUrl(wager.lichess_game_id) : null;
  const embedUrl = wager.lichess_game_id ? getLichessEmbedUrl(wager.lichess_game_id) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-2xl border-primary/30 bg-card max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-3xl sm:text-4xl">{game.icon}</div>
              <div>
                <DialogTitle className="text-lg sm:text-xl font-gaming">
                  {gameFinished ? 'Match Complete' : 'Live Match'}
                </DialogTitle>
                <Badge className={gameFinished ? 'bg-success' : 'bg-destructive animate-pulse'}>
                  {gameFinished ? 'Game Ended' : 'Live'}
                </Badge>
              </div>
            </div>
            {!gameFinished && (
              <Button variant="ghost" size="icon" onClick={handleManualCheck} disabled={isChecking}>
                <RefreshCw className={`h-4 w-4 ${isChecking ? 'animate-spin' : ''}`} />
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-4 sm:space-y-5 mt-4">

          {/* ── RESULT BANNER ── */}
          {gameFinished && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`p-4 sm:p-6 rounded-lg border text-center ${isDraw
                ? 'bg-muted/30 border-border'
                : isCurrentPlayerWinner
                  ? 'bg-success/10 border-success/40'
                  : isCurrentPlayerLoser
                    ? 'bg-destructive/10 border-destructive/30'
                    : 'bg-accent/10 border-accent/30'
                }`}
            >
              {isDraw ? (
                <>
                  <Minus className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-xl font-gaming font-bold">Draw</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Each player receives {formatSol(wager.stake_lamports)} SOL back
                  </p>
                </>
              ) : (
                <>
                  <Crown className={`h-10 w-10 mx-auto mb-3 ${isCurrentPlayerWinner ? 'text-accent' : 'text-muted-foreground'}`} />
                  <p className="text-xl font-gaming font-bold">
                    {isCurrentPlayerWinner ? '🎉 You Won!' : isCurrentPlayerLoser ? 'You Lost' : 'Match Over'}
                  </p>
                  {resolvedWinnerWallet && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Winner: <PlayerLink
                        walletAddress={resolvedWinnerWallet}
                        username={winnerUsername}
                        className="text-primary font-medium"
                      />
                    </p>
                  )}
                  <p className={`text-lg font-gaming font-bold mt-2 ${isCurrentPlayerWinner ? 'text-accent' : 'text-muted-foreground'}`}>
                    {isCurrentPlayerWinner
                      ? `+${formatSol(winnerPayout)} SOL`
                      : `Winner received ${formatSol(winnerPayout)} SOL`
                    }
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Platform fee: {formatSol(platformFee)} SOL (10%)
                  </p>
                </>
              )}
            </motion.div>
          )}

          {/* ── LIVE EMBED (only while in progress) ── */}
          {embedUrl && wager.game === 'chess' && !gameFinished && (
            <div className="space-y-2">
              {showEmbed ? (
                <div className="rounded-lg overflow-hidden border border-border">
                  <iframe
                    src={embedUrl}
                    className="w-full aspect-square sm:aspect-video"
                    allowFullScreen
                    title="Lichess Game"
                  />
                </div>
              ) : (
                <Button variant="outline" className="w-full" onClick={() => setShowEmbed(true)}>
                  <Play className="h-4 w-4 mr-2" /> Watch Game Live
                </Button>
              )}
            </div>
          )}

          {/* ── STAKE INFO ── */}
          <div className="p-3 sm:p-4 rounded-lg bg-primary/10 border border-primary/20 text-center">
            <p className="text-xs sm:text-sm text-muted-foreground mb-1">Total Pool</p>
            <p className="text-xl sm:text-2xl font-gaming font-bold text-primary">
              {formatSol(totalPot)} SOL
            </p>
          </div>

          {/* ── PLAYERS ── */}
          <div className="grid grid-cols-2 gap-2 sm:gap-4">
            {[
              { wallet: wager.player_a_wallet, player: playerA, label: 'Challenger' },
              { wallet: wager.player_b_wallet || '', player: playerB, label: 'Opponent' },
            ].map(({ wallet, player, label }) => {
              const isWinner = resolvedWinnerWallet === wallet;
              return (
                <div key={wallet} className={`p-3 sm:p-4 rounded-lg border relative ${isWinner ? 'bg-accent/10 border-accent/40' : 'bg-muted/30 border-border'
                  }`}>
                  {isWinner && (
                    <Crown className="h-3 w-3 text-accent absolute top-2 right-2" />
                  )}
                  <p className="text-[10px] sm:text-xs text-muted-foreground mb-1">{label}</p>
                  <PlayerLink
                    walletAddress={wallet}
                    username={player?.username}
                    className="font-medium text-xs sm:text-sm"
                  />
                  {lichessGame?.players?.white?.user?.name?.toLowerCase() === player?.lichess_username?.toLowerCase() && (
                    <Badge variant="outline" className="mt-2 text-[10px] sm:text-xs">White ♔</Badge>
                  )}
                  {lichessGame?.players?.black?.user?.name?.toLowerCase() === player?.lichess_username?.toLowerCase() && (
                    <Badge variant="outline" className="mt-2 text-[10px] sm:text-xs">Black ♚</Badge>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── LICHESS LINK ── */}
          {gameLink && (
            <div className="p-2 sm:p-3 rounded-lg bg-muted/30 border border-border flex items-center justify-between">
              <span className="text-xs sm:text-sm text-muted-foreground">Lichess Game</span>
              <a
                href={gameLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline flex items-center gap-1 text-xs sm:text-sm font-medium"
              >
                Open <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}

          {/* ── LICHESS STATUS TEXT ── */}
          {lichessGame?.status && (
            <p className="text-center text-xs sm:text-sm text-muted-foreground">
              {getGameStatusText(lichessGame.status, lichessGame.winner)}
            </p>
          )}

          {/* ── TRANSACTION HISTORY ── */}
          {gameFinished && <TransactionHistory wagerId={wager.id} maxHeight="200px" />}

          {/* ── POLLING INDICATOR ── */}
          {!gameFinished && (
            <div className="flex items-center justify-center gap-2 text-xs sm:text-sm text-muted-foreground">
              <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
              <span>Auto-detecting game result...</span>
              {isChecking && <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />}
            </div>
          )}

          {/* ── ACTIONS ── */}
          <div className="flex gap-2">
            {gameFinished && isCurrentPlayerWinner && (
              <Button
                variant="neon"
                className="flex-1"
                onClick={() => {
                  toast.success('Funds have been automatically sent to your wallet!');
                  onOpenChange(false);
                }}
              >
                <Trophy className="h-4 w-4 mr-2" />
                Claim Victory
              </Button>
            )}
            <Button
              variant="outline"
              className={gameFinished && isCurrentPlayerWinner ? 'flex-1' : 'w-full'}
              onClick={() => onOpenChange(false)}
            >
              {gameFinished ? 'Close' : 'Minimize'}
            </Button>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}