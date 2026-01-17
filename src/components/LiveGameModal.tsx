import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Trophy, Loader2, RefreshCw, Clock, Play } from 'lucide-react';
import { Wager, useCheckGameComplete } from '@/hooks/useWagers';
import { GAMES, formatSol } from '@/lib/constants';
import { usePlayerByWallet } from '@/hooks/usePlayer';
import { PlayerLink } from '@/components/PlayerLink';
import { useLichessGameStream, getLichessGameUrl, getLichessEmbedUrl, isGameFinished as checkIsGameFinished, getGameStatusText } from '@/hooks/useLichess';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { useQueryClient } from '@tanstack/react-query';

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

const getStatusDisplay = (status: string | undefined, wagerStatus?: string) => {
  if (wagerStatus === 'resolved') {
    return { label: 'Match Complete', color: 'bg-success' };
  }
  if (!status) return { label: 'Unknown', color: 'bg-muted' };
  
  if (checkIsGameFinished(status)) {
    return { label: 'Game Ended', color: 'bg-success' };
  }
  
  switch (status) {
    case 'created': return { label: 'Waiting', color: 'bg-warning' };
    case 'started': return { label: 'Live', color: 'bg-destructive animate-pulse' };
    default: return { label: status, color: 'bg-muted' };
  }
};

export function LiveGameModal({ 
  wager, 
  open, 
  onOpenChange, 
  currentWallet
}: LiveGameModalProps) {
  const queryClient = useQueryClient();
  const { data: playerA } = usePlayerByWallet(wager?.player_a_wallet || null);
  const { data: playerB } = usePlayerByWallet(wager?.player_b_wallet || null);
  const { data: lichessGame, refetch: refetchGame } = useLichessGameStream(wager?.lichess_game_id);
  const checkGameComplete = useCheckGameComplete();
  
  const [showEmbed, setShowEmbed] = useState(false);
  
  const [isChecking, setIsChecking] = useState(false);
  const [gameResult, setGameResult] = useState<{
    complete: boolean;
    winner?: string;
    winnerWallet?: string;
  } | null>(null);
  const [hasShownResult, setHasShownResult] = useState(false);

  const isPlayerA = currentWallet === wager?.player_a_wallet;
  const isPlayerB = currentWallet === wager?.player_b_wallet;
  const isParticipant = isPlayerA || isPlayerB;
  
  // Check if wager is already resolved
  const isWagerResolved = wager?.status === 'resolved';

  // Reset state when wager changes
  useEffect(() => {
    if (wager?.id) {
      setGameResult(null);
      setHasShownResult(false);
    }
  }, [wager?.id]);

  // Set initial game result if wager is already resolved
  useEffect(() => {
    if (isWagerResolved && wager?.winner_wallet && !gameResult) {
      setGameResult({
        complete: true,
        winnerWallet: wager.winner_wallet
      });
    }
  }, [isWagerResolved, wager?.winner_wallet, gameResult]);

  // Poll for game completion every 5 seconds
  useEffect(() => {
    if (!open || !wager || wager.status !== 'voting') return;

    const checkGame = async () => {
      if (isChecking) return;
      
      try {
        setIsChecking(true);
        const result = await checkGameComplete.mutateAsync({ wagerId: wager.id });
        
        if (result.gameComplete) {
          setGameResult({
            complete: true,
            winner: result.winner,
            winnerWallet: result.winnerWallet
          });
          
          // Invalidate queries to refresh wager list
          queryClient.invalidateQueries({ queryKey: ['wagers'] });
          queryClient.invalidateQueries({ queryKey: ['players'] });
          
          // Show toast only once
          if (!hasShownResult) {
            setHasShownResult(true);
            if (result.winnerWallet === currentWallet) {
              confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 }
              });
              toast.success('Congratulations! You won the match!');
            } else if (result.resultType === 'draw') {
              toast.info('The game ended in a draw');
            } else if (result.winnerWallet && isParticipant) {
              toast.info('Game over. Better luck next time!');
            }
          }
        }
      } catch (error) {
        console.error('Error checking game:', error);
      } finally {
        setIsChecking(false);
      }
    };

    checkGame();
    const interval = setInterval(checkGame, 5000);
    return () => clearInterval(interval);
  }, [open, wager?.id, wager?.status, currentWallet, isParticipant, hasShownResult, queryClient]);

  const handleManualCheck = useCallback(async () => {
    if (!wager) return;
    refetchGame();
    
    try {
      setIsChecking(true);
      const result = await checkGameComplete.mutateAsync({ wagerId: wager.id });
      
      if (result.gameComplete) {
        setGameResult({
          complete: true,
          winner: result.winner,
          winnerWallet: result.winnerWallet
        });
        // Invalidate queries to refresh wager list
        queryClient.invalidateQueries({ queryKey: ['wagers'] });
        queryClient.invalidateQueries({ queryKey: ['players'] });
        toast.success('Game result detected!');
      } else {
        toast.info('Game still in progress');
      }
    } catch (error) {
      toast.error('Error checking game status');
    } finally {
      setIsChecking(false);
    }
  }, [wager, refetchGame, checkGameComplete, queryClient]);

  if (!wager) return null;

  const game = getGameData(wager.game);
  const gameLink = wager.lichess_game_id ? getLichessGameUrl(wager.lichess_game_id) : null;
  const embedUrl = wager.lichess_game_id ? getLichessEmbedUrl(wager.lichess_game_id) : null;
  const statusDisplay = getStatusDisplay(lichessGame?.status, wager.status);
  const gameFinished = gameResult?.complete || wager.status === 'resolved';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl border-primary/30 bg-card max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-3xl sm:text-4xl">{game.icon}</div>
              <div>
                <DialogTitle className="text-lg sm:text-xl font-gaming">
                  {gameFinished ? 'Match Complete' : 'Live Match'}
                </DialogTitle>
                <Badge className={statusDisplay.color}>
                  {statusDisplay.label}
                </Badge>
              </div>
            </div>
            {!gameFinished && (
              <Button 
                variant="ghost" 
                size="icon"
                onClick={handleManualCheck}
                disabled={isChecking}
              >
                <RefreshCw className={`h-4 w-4 ${isChecking ? 'animate-spin' : ''}`} />
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-4 sm:space-y-6 mt-4">
          {/* Winner Display */}
          {gameFinished && (gameResult?.winnerWallet || wager.winner_wallet) && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-4 sm:p-6 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 text-center"
            >
              <Trophy className="h-10 w-10 sm:h-12 sm:w-12 text-primary mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-1">Winner</p>
              <PlayerLink 
                walletAddress={(gameResult?.winnerWallet || wager.winner_wallet)!}
                username={(gameResult?.winnerWallet || wager.winner_wallet) === wager.player_a_wallet ? playerA?.username : playerB?.username}
                className="text-lg sm:text-xl font-gaming font-bold text-primary"
              />
              <p className="text-base sm:text-lg font-bold text-success mt-2">
                +{formatSol(wager.stake_lamports * 2)} SOL
              </p>
            </motion.div>
          )}

          {/* Draw Display */}
          {gameFinished && !gameResult?.winnerWallet && !wager.winner_wallet && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-4 sm:p-6 rounded-lg bg-warning/10 border border-warning/30 text-center"
            >
              <p className="text-lg sm:text-xl font-gaming font-bold text-warning">Draw</p>
              <p className="text-sm text-muted-foreground mt-1">Stakes will be returned</p>
            </motion.div>
          )}

          {/* Embedded Chess Viewer */}
          {embedUrl && wager.game === 'chess' && !gameFinished && !checkIsGameFinished(lichessGame?.status || '') && (
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
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => setShowEmbed(true)}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Watch Game Live
                </Button>
              )}
            </div>
          )}

          {/* Stake Info */}
          <div className="p-3 sm:p-4 rounded-lg bg-primary/10 border border-primary/20 text-center">
            <p className="text-xs sm:text-sm text-muted-foreground mb-1">Total Pool</p>
            <p className="text-xl sm:text-2xl font-gaming font-bold text-primary">
              {formatSol(wager.stake_lamports * 2)} SOL
            </p>
          </div>

          {/* Players */}
          <div className="grid grid-cols-2 gap-2 sm:gap-4">
            <div className={`p-3 sm:p-4 rounded-lg border ${
              (gameResult?.winnerWallet || wager.winner_wallet) === wager.player_a_wallet 
                ? 'bg-success/10 border-success/30' 
                : 'bg-muted/30 border-border'
            }`}>
              <p className="text-[10px] sm:text-xs text-muted-foreground mb-1">Challenger</p>
              <PlayerLink 
                walletAddress={wager.player_a_wallet}
                username={playerA?.username}
                className="font-medium text-xs sm:text-sm"
              />
              {lichessGame?.players?.white?.user?.name?.toLowerCase() === playerA?.lichess_username?.toLowerCase() && (
                <Badge variant="outline" className="mt-2 text-[10px] sm:text-xs">White ♔</Badge>
              )}
              {lichessGame?.players?.black?.user?.name?.toLowerCase() === playerA?.lichess_username?.toLowerCase() && (
                <Badge variant="outline" className="mt-2 text-[10px] sm:text-xs">Black ♚</Badge>
              )}
            </div>
            <div className={`p-3 sm:p-4 rounded-lg border ${
              (gameResult?.winnerWallet || wager.winner_wallet) === wager.player_b_wallet 
                ? 'bg-success/10 border-success/30' 
                : 'bg-muted/30 border-border'
            }`}>
              <p className="text-[10px] sm:text-xs text-muted-foreground mb-1">Opponent</p>
              <PlayerLink 
                walletAddress={wager.player_b_wallet || ''}
                username={playerB?.username}
                className="font-medium text-xs sm:text-sm"
              />
              {lichessGame?.players?.white?.user?.name?.toLowerCase() === playerB?.lichess_username?.toLowerCase() && (
                <Badge variant="outline" className="mt-2 text-[10px] sm:text-xs">White ♔</Badge>
              )}
              {lichessGame?.players?.black?.user?.name?.toLowerCase() === playerB?.lichess_username?.toLowerCase() && (
                <Badge variant="outline" className="mt-2 text-[10px] sm:text-xs">Black ♚</Badge>
              )}
            </div>
          </div>

          {/* Game Link */}
          {gameLink && (
            <div className="p-2 sm:p-3 rounded-lg bg-muted/30 border border-border">
              <div className="flex items-center justify-between">
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
            </div>
          )}

          {/* Game Status Text */}
          {lichessGame?.status && (
            <div className="text-center text-xs sm:text-sm text-muted-foreground">
              {getGameStatusText(lichessGame.status, lichessGame.winner)}
            </div>
          )}

          {/* Polling indicator */}
          {!gameFinished && !checkIsGameFinished(lichessGame?.status || '') && (
            <div className="flex items-center justify-center gap-2 text-xs sm:text-sm text-muted-foreground">
              <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
              <span>Auto-detecting game result...</span>
              {isChecking && <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />}
            </div>
          )}

          {/* Close button */}
          <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
            {gameFinished ? 'Close' : 'Minimize'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
