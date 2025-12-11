import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Trophy, Loader2, RefreshCw, Clock } from 'lucide-react';
import { Wager, useCheckGameComplete } from '@/hooks/useWagers';
import { GAMES, formatSol } from '@/lib/constants';
import { usePlayerByWallet } from '@/hooks/usePlayer';
import { PlayerLink } from '@/components/PlayerLink';
import { useLichessGame } from '@/hooks/useLichess';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';

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

const getGameLink = (game: string, gameId: string | null) => {
  if (!gameId) return null;
  switch (game) {
    case 'chess': return `https://lichess.org/${gameId}`;
    default: return null;
  }
};

const getStatusDisplay = (status: string | undefined) => {
  switch (status) {
    case 'started': return { label: 'In Progress', color: 'bg-primary' };
    case 'mate': return { label: 'Checkmate', color: 'bg-success' };
    case 'resign': return { label: 'Resignation', color: 'bg-success' };
    case 'outoftime': return { label: 'Time Out', color: 'bg-success' };
    case 'draw': return { label: 'Draw', color: 'bg-warning' };
    case 'stalemate': return { label: 'Stalemate', color: 'bg-warning' };
    default: return { label: status || 'Unknown', color: 'bg-muted' };
  }
};

export function LiveGameModal({ 
  wager, 
  open, 
  onOpenChange, 
  currentWallet
}: LiveGameModalProps) {
  const { data: playerA } = usePlayerByWallet(wager?.player_a_wallet || null);
  const { data: playerB } = usePlayerByWallet(wager?.player_b_wallet || null);
  const { data: lichessGame, refetch: refetchGame } = useLichessGame(wager?.lichess_game_id);
  const checkGameComplete = useCheckGameComplete();
  
  const [isChecking, setIsChecking] = useState(false);
  const [gameResult, setGameResult] = useState<{
    complete: boolean;
    winner?: string;
    winnerWallet?: string;
  } | null>(null);

  const isPlayerA = currentWallet === wager?.player_a_wallet;
  const isPlayerB = currentWallet === wager?.player_b_wallet;
  const isParticipant = isPlayerA || isPlayerB;

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
          
          // Fire confetti if current user won
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
      } catch (error) {
        console.error('Error checking game:', error);
      } finally {
        setIsChecking(false);
      }
    };

    checkGame();
    const interval = setInterval(checkGame, 5000);
    return () => clearInterval(interval);
  }, [open, wager?.id, wager?.status, currentWallet, isParticipant]);

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
        toast.success('Game result detected!');
      } else {
        toast.info('Game still in progress');
      }
    } catch (error) {
      toast.error('Error checking game status');
    } finally {
      setIsChecking(false);
    }
  }, [wager, refetchGame, checkGameComplete]);

  if (!wager) return null;

  const game = getGameData(wager.game);
  const gameLink = getGameLink(wager.game, wager.lichess_game_id);
  const statusDisplay = getStatusDisplay(lichessGame?.status);
  const isGameFinished = gameResult?.complete || wager.status === 'resolved';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg border-primary/30 bg-card">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-4xl">{game.icon}</div>
              <div>
                <DialogTitle className="text-xl font-gaming">
                  {isGameFinished ? 'Match Complete' : 'Live Match'}
                </DialogTitle>
                <Badge className={statusDisplay.color}>
                  {statusDisplay.label}
                </Badge>
              </div>
            </div>
            {!isGameFinished && (
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

        <div className="space-y-6 mt-4">
          {/* Winner Display */}
          {isGameFinished && gameResult?.winnerWallet && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-6 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 text-center"
            >
              <Trophy className="h-12 w-12 text-primary mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-1">Winner</p>
              <PlayerLink 
                walletAddress={gameResult.winnerWallet}
                username={gameResult.winnerWallet === wager.player_a_wallet ? playerA?.username : playerB?.username}
                className="text-xl font-gaming font-bold text-primary"
              />
              <p className="text-lg font-bold text-success mt-2">
                +{formatSol(wager.stake_lamports * 2)} SOL
              </p>
            </motion.div>
          )}

          {/* Draw Display */}
          {isGameFinished && !gameResult?.winnerWallet && gameResult?.winner === undefined && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-6 rounded-lg bg-warning/10 border border-warning/30 text-center"
            >
              <p className="text-xl font-gaming font-bold text-warning">Draw</p>
              <p className="text-sm text-muted-foreground mt-1">Stakes will be returned</p>
            </motion.div>
          )}

          {/* Stake Info */}
          <div className="p-4 rounded-lg bg-primary/10 border border-primary/20 text-center">
            <p className="text-sm text-muted-foreground mb-1">Total Pool</p>
            <p className="text-2xl font-gaming font-bold text-primary">
              {formatSol(wager.stake_lamports * 2)} SOL
            </p>
          </div>

          {/* Players */}
          <div className="grid grid-cols-2 gap-4">
            <div className={`p-4 rounded-lg border ${
              gameResult?.winnerWallet === wager.player_a_wallet 
                ? 'bg-success/10 border-success/30' 
                : 'bg-muted/30 border-border'
            }`}>
              <p className="text-xs text-muted-foreground mb-1">Challenger</p>
              <PlayerLink 
                walletAddress={wager.player_a_wallet}
                username={playerA?.username}
                className="font-medium"
              />
              {lichessGame?.players?.white?.user?.name?.toLowerCase() === playerA?.lichess_username?.toLowerCase() && (
                <Badge variant="outline" className="mt-2">White ♔</Badge>
              )}
              {lichessGame?.players?.black?.user?.name?.toLowerCase() === playerA?.lichess_username?.toLowerCase() && (
                <Badge variant="outline" className="mt-2">Black ♚</Badge>
              )}
            </div>
            <div className={`p-4 rounded-lg border ${
              gameResult?.winnerWallet === wager.player_b_wallet 
                ? 'bg-success/10 border-success/30' 
                : 'bg-muted/30 border-border'
            }`}>
              <p className="text-xs text-muted-foreground mb-1">Opponent</p>
              <PlayerLink 
                walletAddress={wager.player_b_wallet || ''}
                username={playerB?.username}
                className="font-medium"
              />
              {lichessGame?.players?.white?.user?.name?.toLowerCase() === playerB?.lichess_username?.toLowerCase() && (
                <Badge variant="outline" className="mt-2">White ♔</Badge>
              )}
              {lichessGame?.players?.black?.user?.name?.toLowerCase() === playerB?.lichess_username?.toLowerCase() && (
                <Badge variant="outline" className="mt-2">Black ♚</Badge>
              )}
            </div>
          </div>

          {/* Game Link */}
          {gameLink && (
            <div className="p-3 rounded-lg bg-muted/30 border border-border">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Watch Game</span>
                <a 
                  href={gameLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-center gap-1 text-sm font-medium"
                >
                  Open in Lichess <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          )}

          {/* Polling indicator */}
          {!isGameFinished && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Auto-detecting game result...</span>
              {isChecking && <Loader2 className="h-4 w-4 animate-spin" />}
            </div>
          )}

          {/* Close button */}
          <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
            {isGameFinished ? 'Close' : 'Minimize'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
