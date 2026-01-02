import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Check, X, Clock, ExternalLink, Swords, Loader2, AlertCircle } from 'lucide-react';
import { Wager } from '@/hooks/useWagers';
import { GAMES, formatSol } from '@/lib/constants';
import { usePlayerByWallet } from '@/hooks/usePlayer';
import { PlayerLink } from '@/components/PlayerLink';
import { motion, AnimatePresence } from 'framer-motion';

interface ReadyRoomModalProps {
  wager: Wager | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReady: (ready: boolean) => void;
  onEditWager: () => void;
  isSettingReady?: boolean;
  currentWallet?: string;
}

const COUNTDOWN_SECONDS = 10;

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

export function ReadyRoomModal({ 
  wager, 
  open, 
  onOpenChange, 
  onReady,
  onEditWager,
  isSettingReady,
  currentWallet
}: ReadyRoomModalProps) {
  const { data: playerA } = usePlayerByWallet(wager?.player_a_wallet || null);
  const { data: playerB } = usePlayerByWallet(wager?.player_b_wallet || null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [localReady, setLocalReady] = useState(false);

  const isPlayerA = currentWallet === wager?.player_a_wallet;
  const isPlayerB = currentWallet === wager?.player_b_wallet;
  const myReadyState = isPlayerA ? wager?.ready_player_a : wager?.ready_player_b;
  const opponentReadyState = isPlayerA ? wager?.ready_player_b : wager?.ready_player_a;
  const bothReady = wager?.ready_player_a && wager?.ready_player_b;

  // Handle countdown when both players are ready
  useEffect(() => {
    if (bothReady && wager?.countdown_started_at) {
      const startTime = new Date(wager.countdown_started_at).getTime();
      
      const updateCountdown = () => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const remaining = COUNTDOWN_SECONDS - elapsed;
        
        if (remaining <= 0) {
          setCountdown(0);
        } else {
          setCountdown(remaining);
        }
      };

      updateCountdown();
      const interval = setInterval(updateCountdown, 100);
      return () => clearInterval(interval);
    } else {
      setCountdown(null);
    }
  }, [bothReady, wager?.countdown_started_at]);

  // Sync local ready state with server state
  useEffect(() => {
    setLocalReady(myReadyState || false);
  }, [myReadyState]);

  const handleReadyClick = useCallback(() => {
    const newReadyState = !localReady;
    setLocalReady(newReadyState);
    onReady(newReadyState);
  }, [localReady, onReady]);

  if (!wager) return null;

  const game = getGameData(wager.game);
  const gameLink = getGameLink(wager.game, wager.lichess_game_id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg border-primary/30 bg-card max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="text-3xl sm:text-4xl">{game.icon}</div>
              <div>
                <DialogTitle className="text-lg sm:text-xl font-gaming">Ready Room</DialogTitle>
                <Badge variant="joined">Match Found</Badge>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 sm:space-y-6 mt-4">
          {/* Countdown Timer */}
          <AnimatePresence>
            {bothReady && countdown !== null && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="text-center"
              >
                <div className="relative w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-3">
                  <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
                  <svg className="w-20 h-20 sm:w-24 sm:h-24 transform -rotate-90">
                    <circle
                      cx="40"
                      cy="40"
                      r="36"
                      fill="none"
                      stroke="hsl(var(--primary))"
                      strokeWidth="4"
                      strokeDasharray={`${(countdown / COUNTDOWN_SECONDS) * 226.19} 226.19`}
                      className="transition-all duration-100 sm:hidden"
                    />
                    <circle
                      cx="48"
                      cy="48"
                      r="44"
                      fill="none"
                      stroke="hsl(var(--primary))"
                      strokeWidth="4"
                      strokeDasharray={`${(countdown / COUNTDOWN_SECONDS) * 276.46} 276.46`}
                      className="transition-all duration-100 hidden sm:block"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl sm:text-3xl font-gaming font-bold text-primary">{countdown}</span>
                  </div>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground">Game starting in...</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">Click "Not Ready" to cancel</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Stake Info */}
          <div className="p-3 sm:p-4 rounded-lg bg-primary/10 border border-primary/20 text-center">
            <p className="text-xs sm:text-sm text-muted-foreground mb-1">Total Pool</p>
            <p className="text-xl sm:text-2xl font-gaming font-bold text-primary">
              {formatSol(wager.stake_lamports * 2)} SOL
            </p>
          </div>

          {/* Players Ready Status */}
          <div className="space-y-2 sm:space-y-3">
            {/* Player A */}
            <div className={`flex items-center justify-between p-3 sm:p-4 rounded-lg border-2 transition-colors ${
              wager.ready_player_a 
                ? 'bg-success/10 border-success/30' 
                : 'bg-muted/30 border-border'
            }`}>
              <div className="flex items-center gap-2 sm:gap-3">
                <div className={`p-1.5 sm:p-2 rounded-full ${wager.ready_player_a ? 'bg-success/20' : 'bg-muted'}`}>
                  {wager.ready_player_a ? (
                    <Check className="h-4 w-4 sm:h-5 sm:w-5 text-success" />
                  ) : (
                    <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Challenger {isPlayerA && '(You)'}</p>
                  <PlayerLink 
                    walletAddress={wager.player_a_wallet}
                    username={playerA?.username}
                    className="font-medium text-xs sm:text-sm"
                  />
                </div>
              </div>
              <Badge variant={wager.ready_player_a ? 'success' : 'secondary'} className="text-[10px] sm:text-xs">
                {wager.ready_player_a ? 'Ready' : 'Waiting'}
              </Badge>
            </div>

            {/* VS Divider */}
            <div className="flex items-center justify-center">
              <Swords className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            </div>

            {/* Player B */}
            <div className={`flex items-center justify-between p-3 sm:p-4 rounded-lg border-2 transition-colors ${
              wager.ready_player_b 
                ? 'bg-success/10 border-success/30' 
                : 'bg-muted/30 border-border'
            }`}>
              <div className="flex items-center gap-2 sm:gap-3">
                <div className={`p-1.5 sm:p-2 rounded-full ${wager.ready_player_b ? 'bg-success/20' : 'bg-muted'}`}>
                  {wager.ready_player_b ? (
                    <Check className="h-4 w-4 sm:h-5 sm:w-5 text-success" />
                  ) : (
                    <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Opponent {isPlayerB && '(You)'}</p>
                  <PlayerLink 
                    walletAddress={wager.player_b_wallet || ''}
                    username={playerB?.username}
                    className="font-medium text-xs sm:text-sm"
                  />
                </div>
              </div>
              <Badge variant={wager.ready_player_b ? 'success' : 'secondary'} className="text-[10px] sm:text-xs">
                {wager.ready_player_b ? 'Ready' : 'Waiting'}
              </Badge>
            </div>
          </div>

          {/* Game Link */}
          {gameLink && (
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

          {/* Warning if no game link */}
          {!gameLink && wager.game === 'chess' && (
            <div className="p-2 sm:p-3 rounded-lg bg-warning/10 border border-warning/30 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
              <div className="text-xs sm:text-sm">
                <p className="font-medium text-warning">No Lichess game linked</p>
                <p className="text-muted-foreground">The challenger should add a game link before starting.</p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            {isPlayerA && !bothReady && (
              <Button variant="outline" className="flex-1 text-xs sm:text-sm" onClick={onEditWager}>
                Edit Wager
              </Button>
            )}
            <Button 
              variant={localReady ? 'destructive' : 'neon'}
              className="flex-1 text-xs sm:text-sm"
              onClick={handleReadyClick}
              disabled={isSettingReady}
            >
              {isSettingReady ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : localReady ? (
                <X className="h-4 w-4 mr-2" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              {localReady ? 'Not Ready' : 'Ready'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}