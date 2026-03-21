import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, ExternalLink, Swords, Trophy, User, Crown, Minus } from 'lucide-react';
import { Wager } from '@/hooks/useWagers';
import { GAMES, formatSol, truncateAddress } from '@/lib/constants';
import { usePlayerByWallet } from '@/hooks/usePlayer';
import { PlayerLink } from '@/components/PlayerLink';
import { useWallet } from '@solana/wallet-adapter-react';
import { cn } from '@/lib/utils';
import { TimeControlCategory } from '@/components/CreateWagerModal';

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


// Derives time control category from clock limit (seconds)
function getTimeCategory(limitSeconds: number): TimeControlCategory {
  if (limitSeconds < 180) return 'Bullet';
  if (limitSeconds < 600) return 'Blitz';
  if (limitSeconds < 2700) return 'Rapid';
  return 'Classical';
}

const CATEGORY_STYLES: Record<TimeControlCategory, { dot: string; text: string; bg: string; border: string }> = {
  Bullet: { dot: 'bg-red-500', text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' },
  Blitz: { dot: 'bg-orange-400', text: 'text-orange-400', bg: 'bg-orange-400/10', border: 'border-orange-400/30' },
  Rapid: { dot: 'bg-green-500', text: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30' },
  Classical: { dot: 'bg-blue-500', text: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
};

function formatTimeControl(limitSeconds: number, increment: number): string {
  const mins = Math.floor(limitSeconds / 60);
  return `${mins}+${increment}`;
}

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
  const isResolved = wager.status === 'resolved' || (wager.status as string) === 'closed';
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

  // Chess metadata
  const isChess = wager.game === 'chess';
  const clockLimit = (wager as any).chess_clock_limit as number | undefined;
  const clockIncrement = (wager as any).chess_clock_increment as number | undefined;
  const isRated = (wager as any).chess_rated as boolean | undefined;
  const sidePreference = (wager as any).chess_side_preference as string | undefined;

  const hasTimeControl = isChess && clockLimit != null && clockIncrement != null;
  const timeCategory = hasTimeControl ? getTimeCategory(clockLimit!) : null;
  const categoryStyle = timeCategory ? CATEGORY_STYLES[timeCategory] : null;
  const timeLabel = hasTimeControl ? formatTimeControl(clockLimit!, clockIncrement!) : null;

  // Is the current user the creator (Player A)?
  const isCreator = currentWallet === wager.player_a_wallet;

  // Which side does the current user play?
  const mySide = (() => {
    if (!sidePreference || sidePreference === 'random') return null;
    if (isCreator) return sidePreference;
    return sidePreference === 'white' ? 'black' : 'white';
  })();

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

          {/* ── CHESS TIME CONTROL BADGE (open/active wagers) ── */}
          {isChess && hasTimeControl && !isResolved && categoryStyle && (
            <div className={cn(
              "flex items-center justify-between px-3 py-2 rounded-lg border",
              categoryStyle.bg,
              categoryStyle.border,
            )}>
              <div className="flex items-center gap-2">
                <span className={cn("w-2 h-2 rounded-full flex-shrink-0", categoryStyle.dot)} />
                <span className={cn("text-sm font-semibold", categoryStyle.text)}>
                  {timeLabel} · {timeCategory}
                </span>
                {isRated && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-medium">Rated</span>
                )}
              </div>
              {sidePreference && sidePreference !== 'random' && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {mySide ? (
                    <>
                      <span>You play</span>
                      <span className="font-medium text-foreground capitalize">
                        {mySide === 'white' ? '⬜ White' : '⬛ Black'}
                      </span>
                    </>
                  ) : (
                    <>
                      <span>Creator plays</span>
                      <span className="font-medium text-foreground capitalize">
                        {sidePreference === 'white' ? '⬜ White' : '⬛ Black'}
                      </span>
                    </>
                  )}
                </div>
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
                  {isChess && sidePreference && sidePreference !== 'random' && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Plays {sidePreference === 'white' ? '⬜ White' : '⬛ Black'}
                    </p>
                  )}
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
              <div className="flex flex-col items-center justify-center p-3 rounded-lg border-2 border-dashed border-border gap-1">
                <p className="text-muted-foreground text-sm">Waiting for opponent...</p>
                {isChess && sidePreference && sidePreference !== 'random' && (
                  <p className="text-[11px] text-muted-foreground">
                    Joiner plays {sidePreference === 'white' ? '⬛ Black' : '⬜ White'}
                  </p>
                )}
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