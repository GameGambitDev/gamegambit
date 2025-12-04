import { motion } from 'framer-motion';
import { ExternalLink, Trophy, Clock, Swords, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { GAMES, formatSol, truncateAddress } from '@/lib/constants';
import { useRecentWagers, Wager } from '@/hooks/useWagers';
import { Link } from 'react-router-dom';

const getGameData = (game: string) => {
  switch (game) {
    case 'chess': return GAMES.CHESS;
    case 'codm': return GAMES.CODM;
    case 'pubg': return GAMES.PUBG;
    default: return GAMES.CHESS;
  }
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'created':
      return <Badge variant="created">Open</Badge>;
    case 'joined':
      return <Badge variant="joined">Live</Badge>;
    case 'voting':
      return <Badge variant="voting">Voting</Badge>;
    case 'disputed':
      return <Badge variant="disputed">Disputed</Badge>;
    case 'resolved':
      return <Badge variant="resolved">Resolved</Badge>;
    default:
      return <Badge variant="glass">{status}</Badge>;
  }
};

function WagerCard({ wager, index }: { wager: Wager; index: number }) {
  const game = getGameData(wager.game);
  const isLive = wager.status === 'joined';
  const timeDiff = Math.floor((Date.now() - new Date(wager.created_at).getTime()) / 60000);
  
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      <Card variant="wager" className="cursor-pointer group">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            {/* Left: Game & Players */}
            <div className="flex items-center gap-4">
              {/* Game Icon */}
              <div className="relative">
                <div className={`text-3xl ${isLive ? 'animate-pulse' : ''}`}>
                  {game.icon}
                </div>
                {isLive && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-destructive" />
                  </span>
                )}
              </div>

              {/* Match Info */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-gaming text-sm text-foreground">
                    {truncateAddress(wager.player_a_wallet)}
                  </span>
                  <Swords className="h-4 w-4 text-muted-foreground" />
                  <span className="font-gaming text-sm text-foreground">
                    {wager.player_b_wallet ? truncateAddress(wager.player_b_wallet) : '???'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{game.name}</span>
                  <span>•</span>
                  <Clock className="h-3 w-3" />
                  <span>{timeDiff}m ago</span>
                </div>
              </div>
            </div>

            {/* Right: Stake & Status */}
            <div className="flex items-center gap-4">
              {/* Stake */}
              <div className="text-right">
                <div className="font-gaming text-lg font-bold text-accent">
                  {formatSol(wager.stake_lamports)} SOL
                </div>
                <div className="text-xs text-muted-foreground">
                  Total Pot: {formatSol(wager.stake_lamports * 2)}
                </div>
              </div>

              {/* Status */}
              <div className="flex flex-col items-end gap-2">
                {getStatusBadge(wager.status)}
                {wager.status === 'created' && (
                  <Button variant="neon" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                    Join
                  </Button>
                )}
                {wager.winner_wallet && (
                  <div className="flex items-center gap-1 text-xs text-success">
                    <Trophy className="h-3 w-3" />
                    {truncateAddress(wager.winner_wallet)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function EmptyFeed() {
  return (
    <div className="text-center py-12">
      <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
        <Swords className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="font-gaming text-lg mb-2">No wagers yet</h3>
      <p className="text-muted-foreground text-sm mb-4">Be the first to create a wager!</p>
      <Link to="/arena">
        <Button variant="neon">Enter Arena</Button>
      </Link>
    </div>
  );
}

export function LiveFeed() {
  const { data: wagers, isLoading } = useRecentWagers(10);
  const activeCount = wagers?.filter(w => ['created', 'joined', 'voting'].includes(w.status)).length || 0;

  return (
    <section className="py-20 relative">
      <div className="container px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold mb-2">
              <span className="text-foreground">Live</span>{' '}
              <span className="gradient-text">Arena</span>
            </h2>
            <p className="text-muted-foreground">
              Watch matches unfold in real-time
            </p>
          </div>
          <Link to="/arena">
            <Button variant="outline" className="group">
              View All
              <ExternalLink className="h-4 w-4 ml-2 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </Button>
          </Link>
        </div>

        {/* Feed */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : wagers && wagers.length > 0 ? (
          <div className="space-y-3">
            {wagers.map((wager, index) => (
              <WagerCard key={wager.id} wager={wager} index={index} />
            ))}
          </div>
        ) : (
          <EmptyFeed />
        )}

        {/* Live Count */}
        <div className="mt-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-card/50 border border-border/50">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            <span className="text-sm text-muted-foreground">
              <span className="font-gaming text-primary">{activeCount}</span> active wagers right now
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
