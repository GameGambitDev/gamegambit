import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, ExternalLink, Swords, Trophy, User } from 'lucide-react';
import { Wager } from '@/hooks/useWagers';
import { GAMES, formatSol, truncateAddress } from '@/lib/constants';
import { usePlayerByWallet } from '@/hooks/usePlayer';
import { PlayerLink } from '@/components/PlayerLink';

interface WagerDetailsModalProps {
  wager: Wager | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJoin?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  isOwner?: boolean;
  canJoin?: boolean;
  isJoining?: boolean;
}

const getGameData = (game: string) => {
  switch (game) {
    case 'chess': return GAMES.CHESS;
    case 'codm': return GAMES.CODM;
    case 'pubg': return GAMES.PUBG;
    default: return GAMES.CHESS;
  }
};

export function WagerDetailsModal({ 
  wager, 
  open, 
  onOpenChange, 
  onJoin,
  onEdit,
  onDelete,
  isOwner,
  canJoin,
  isJoining
}: WagerDetailsModalProps) {
  const { data: playerA } = usePlayerByWallet(wager?.player_a_wallet || null);
  const { data: playerB } = usePlayerByWallet(wager?.player_b_wallet || null);

  if (!wager) return null;

  const game = getGameData(wager.game);
  const createdAt = new Date(wager.created_at);
  const timeDiff = Math.floor((Date.now() - createdAt.getTime()) / 60000);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-primary/30 bg-card">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="text-4xl">{game.icon}</div>
            <div>
              <DialogTitle className="text-xl font-gaming">{game.name} Wager</DialogTitle>
              <Badge variant={wager.status === 'created' ? 'default' : wager.status === 'voting' ? 'voting' : 'joined'}>
                {wager.status === 'created' ? 'Open' : wager.status === 'voting' ? 'Voting' : wager.status}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Stake Info */}
          <div className="p-4 rounded-lg bg-primary/10 border border-primary/20 text-center">
            <p className="text-sm text-muted-foreground mb-1">Stake Amount</p>
            <p className="text-3xl font-gaming font-bold text-primary">
              {formatSol(wager.stake_lamports)} SOL
            </p>
            {wager.player_b_wallet && (
              <p className="text-sm text-success mt-1">
                Total Pool: {formatSol(wager.stake_lamports * 2)} SOL
              </p>
            )}
          </div>

          {/* Players */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-primary/20">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Challenger</p>
                  <PlayerLink 
                    walletAddress={wager.player_a_wallet}
                    username={playerA?.username}
                    className="font-medium"
                  />
                </div>
              </div>
              {playerA && (
                <div className="text-right text-xs text-muted-foreground">
                  <p>{playerA.total_wins}W / {playerA.total_losses}L</p>
                </div>
              )}
            </div>

            {wager.player_b_wallet ? (
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-accent/20">
                    <User className="h-4 w-4 text-accent" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Opponent</p>
                    <PlayerLink 
                      walletAddress={wager.player_b_wallet}
                      username={playerB?.username}
                      className="font-medium"
                    />
                  </div>
                </div>
                {playerB && (
                  <div className="text-right text-xs text-muted-foreground">
                    <p>{playerB.total_wins}W / {playerB.total_losses}L</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center p-3 rounded-lg border-2 border-dashed border-border">
                <p className="text-muted-foreground text-sm">Waiting for opponent...</p>
              </div>
            )}
          </div>

          {/* Match Details */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" /> Created
              </span>
              <span>{timeDiff < 60 ? `${timeDiff}m ago` : `${Math.floor(timeDiff / 60)}h ago`}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Match ID</span>
              <span className="font-mono text-xs">#{wager.match_id}</span>
            </div>
            {wager.lichess_game_id && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Lichess Game</span>
                <a 
                  href={`https://lichess.org/${wager.lichess_game_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-center gap-1"
                >
                  View <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
            {wager.stream_url && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Stream</span>
                <a 
                  href={wager.stream_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-center gap-1"
                >
                  Watch <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            {isOwner && wager.status === 'created' ? (
              <>
                <Button variant="outline" className="flex-1" onClick={onEdit}>
                  Edit
                </Button>
                <Button variant="destructive" className="flex-1" onClick={onDelete}>
                  Delete
                </Button>
              </>
            ) : canJoin && wager.status === 'created' ? (
              <Button 
                variant="neon" 
                className="w-full" 
                onClick={onJoin}
                disabled={isJoining}
              >
                {isJoining ? 'Joining...' : 'Accept Challenge'}
              </Button>
            ) : (
              <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}