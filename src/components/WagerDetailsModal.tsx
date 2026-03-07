import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, ExternalLink, Swords, Trophy, User, Crown, Minus } from 'lucide-react';
import { Wager } from '@/hooks/useWagers';
import { GAMES, formatSol, truncateAddress } from '@/lib/constants';
import { usePlayerByWallet } from '@/hooks/usePlayer';
import { PlayerLink } from '@/components/PlayerLink';
import { useWallet } from '@solana/wallet-adapter-react';

interface WagerDetailsModalProps {
  wager: Wager | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJoin?: (wagerId: string) => Promise<void> | void;
  onEdit?: (wager: Wager) => void;
  onDelete?: (wager: Wager) => void;
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

const STATUS_BADGE: Record<string, string> = {
  created: 'default',
  joined: 'joined',
  voting: 'voting',
  retractable: 'joined',
  disputed: 'destructive',
  resolved: 'success',
  closed: 'outline',
};

const STATUS_LABEL: Record<string, string> = {
  created: 'Open',
  joined: 'Ready Room',
  voting: 'In Progress',
  retractable: 'Retractable',
  disputed: 'Disputed',
  resolved: 'Resolved',
  closed: 'Closed',
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
  const { publicKey } = useWallet();
  const currentWallet = publicKey?.toBase58();

  const { data: playerA } = usePlayerByWallet(wager?.player_a_wallet || null);
  const { data: playerB } = usePlayerByWallet(wager?.player_b_wallet || null);

  if (!wager) return null;

  const game = getGameData(wager.game);
  const timeDiff = Math.floor((Date.now() - new Date(wager.created_at).getTime()) / 60000);
  const isResolved = wager.status === 'resolved' || wager.status === 'closed';
  const isDraw = isResolved && !wager.winner_wallet;
  const winnerWallet = wager.winner_wallet;

  const isCurrentPlayerWinner = winnerWallet && currentWallet === winnerWallet;
  const isCurrentPlayerLoser = isResolved && !isDraw && currentWallet &&
    (currentWallet === wager.player_a_wallet || currentWallet === wager.player_b_wallet) &&
    currentWallet !== winnerWallet;

  const winnerUsername = winnerWallet === wager.player_a_wallet
    ? playerA?.username
    : playerB?.username;

  const platformFee = Math.floor(wager.stake_lamports * 2 * 0.10);
  const winnerPayout = wager.stake_lamports * 2 - platformFee;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-md border-primary/30 bg-card">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="text-4xl">{game.icon}</div>
            <div>
              <DialogTitle className="text-xl font-gaming">{game.name} Wager</DialogTitle>
              <Badge variant={(STATUS_BADGE[wager.status] || 'default') as any}>
                {STATUS_LABEL[wager.status] || wager.status}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 mt-4">

          {/* ── RESULT BANNER (resolved/closed only) ── */}
          {isResolved && (
            <div className={`p-4 rounded-lg border text-center ${isDraw
              ? 'bg-muted/30 border-border'
              : isCurrentPlayerWinner
                ? 'bg-success/10 border-success/40'
                : isCurrentPlayerLoser
                  ? 'bg-destructive/10 border-destructive/30'
                  : 'bg-accent/10 border-accent/30'
              }`}>
              {isDraw ? (
                <>
                  <Minus className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="font-gaming text-lg">Draw</p>
                  <p className="text-sm text-muted-foreground mt-1">Stakes returned to both players</p>
                </>
              ) : (
                <>
                  <Crown className={`h-8 w-8 mx-auto mb-2 ${isCurrentPlayerWinner ? 'text-accent' : 'text-muted-foreground'
                    }`} />
                  <p className="font-gaming text-lg">
                    {isCurrentPlayerWinner
                      ? '🎉 You Won!'
                      : isCurrentPlayerLoser
                        ? 'You Lost'
                        : `${winnerUsername || truncateAddress(winnerWallet!)} Wins`
                    }
                  </p>
                  {winnerWallet && (
                    <p className="text-xs text-muted-foreground mt-1">
                      <PlayerLink walletAddress={winnerWallet} username={winnerUsername} />
                    </p>
                  )}
                  <p className={`text-sm font-gaming mt-2 ${isCurrentPlayerWinner ? 'text-accent' : 'text-muted-foreground'}`}>
                    {isCurrentPlayerWinner
                      ? `+${formatSol(winnerPayout)} SOL`
                      : `Winner received ${formatSol(winnerPayout)} SOL`
                    }
                  </p>
                </>
              )}
            </div>
          )}

          {/* ── STAKE INFO ── */}
          <div className="p-4 rounded-lg bg-primary/10 border border-primary/20 text-center">
            <p className="text-sm text-muted-foreground mb-1">
              {isResolved ? 'Total Pool' : 'Stake Amount'}
            </p>
            <p className="text-3xl font-gaming font-bold text-primary">
              {isResolved
                ? `${formatSol(wager.stake_lamports * 2)} SOL`
                : `${formatSol(wager.stake_lamports)} SOL`
              }
            </p>
            {!isResolved && wager.player_b_wallet && (
              <p className="text-sm text-muted-foreground mt-1">
                Total Pool: {formatSol(wager.stake_lamports * 2)} SOL
              </p>
            )}
            {isResolved && !isDraw && (
              <p className="text-xs text-muted-foreground mt-1">
                Winner: {formatSol(winnerPayout)} SOL · Platform fee: {formatSol(platformFee)} SOL
              </p>
            )}
          </div>

          {/* ── PLAYERS ── */}
          <div className="space-y-3">
            {/* Player A */}
            <div className={`flex items-center justify-between p-3 rounded-lg ${winnerWallet === wager.player_a_wallet
              ? 'bg-accent/10 border border-accent/30'
              : 'bg-muted/30'
              }`}>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-primary/20 relative">
                  <User className="h-4 w-4 text-primary" />
                  {winnerWallet === wager.player_a_wallet && (
                    <Crown className="h-3 w-3 text-accent absolute -top-1 -right-1" />
                  )}
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

            {/* VS divider */}
            <div className="flex items-center gap-2 px-2">
              <div className="h-px flex-1 bg-border" />
              <Swords className="h-4 w-4 text-muted-foreground" />
              <div className="h-px flex-1 bg-border" />
            </div>

            {/* Player B */}
            {wager.player_b_wallet ? (
              <div className={`flex items-center justify-between p-3 rounded-lg ${winnerWallet === wager.player_b_wallet
                ? 'bg-accent/10 border border-accent/30'
                : 'bg-muted/30'
                }`}>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-accent/20 relative">
                    <User className="h-4 w-4 text-accent" />
                    {winnerWallet === wager.player_b_wallet && (
                      <Crown className="h-3 w-3 text-accent absolute -top-1 -right-1" />
                    )}
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

          {/* ── MATCH DETAILS ── */}
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
            {wager.resolved_at && (
              <div className="flex justify-between">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Trophy className="h-4 w-4" /> Resolved
                </span>
                <span>{new Date(wager.resolved_at).toLocaleTimeString()}</span>
              </div>
            )}
          </div>

          {/* ── ACTIONS ── */}
          <div className="flex gap-2 pt-2">
            {isResolved ? (
              <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            ) : isOwner && wager.status === 'created' ? (
              <>
                <Button variant="outline" className="flex-1" onClick={() => wager && onEdit?.(wager)}>
                  Edit
                </Button>
                <Button variant="destructive" className="flex-1" onClick={() => wager && onDelete?.(wager)}>
                  Delete
                </Button>
              </>
            ) : canJoin && wager.status === 'created' ? (
              <Button
                variant="neon"
                className="w-full"
                onClick={() => wager && onJoin?.(wager.id)}
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