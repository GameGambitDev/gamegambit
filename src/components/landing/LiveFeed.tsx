import { motion } from 'framer-motion';
import { ExternalLink, Trophy, Clock, Swords } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { GAMES, formatSol, truncateAddress } from '@/lib/constants';

// Mock data for demo
const mockWagers = [
  {
    id: '1',
    playerA: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    playerB: '3tK9FEkPBz8sB7rJdKdAYHHBNSYKLQV5D5mK3dZ9TwoW',
    game: GAMES.CHESS,
    stake: 500000000, // 0.5 SOL
    status: 'joined',
    winner: null,
    lichessId: 'abc123',
    createdAt: Date.now() - 1000 * 60 * 5,
  },
  {
    id: '2',
    playerA: '9mT2k3JxYB7nUqXWD6PzKqZ5Y8hLpV4B2Q8nMxX3Y9Cw',
    playerB: '4vK9YEkJHz8nR7kFeDaYEJJRNSZKLSK5E5oL3eY9UwoX',
    game: GAMES.CODM,
    stake: 1000000000, // 1 SOL
    status: 'disputed',
    winner: null,
    lichessId: null,
    createdAt: Date.now() - 1000 * 60 * 15,
  },
  {
    id: '3',
    playerA: '5xLXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    playerB: '2tK9FEkPBz8sB7rJdKdAYHHBNSYKLQV5D5mK3dZ9TwoW',
    game: GAMES.CHESS,
    stake: 250000000, // 0.25 SOL
    status: 'resolved',
    winner: '5xLXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    lichessId: 'xyz789',
    createdAt: Date.now() - 1000 * 60 * 30,
  },
  {
    id: '4',
    playerA: '8nS2m3JxYB7nUqXWD6PzKqZ5Y8hLpV4B2Q8nMxX3Y9Dw',
    playerB: null,
    game: GAMES.PUBG,
    stake: 2000000000, // 2 SOL
    status: 'created',
    winner: null,
    lichessId: null,
    createdAt: Date.now() - 1000 * 60 * 2,
  },
];

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

function WagerCard({ wager, index }: { wager: typeof mockWagers[0]; index: number }) {
  const isLive = wager.status === 'joined';
  
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
                  {wager.game.icon}
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
                    {truncateAddress(wager.playerA)}
                  </span>
                  <Swords className="h-4 w-4 text-muted-foreground" />
                  <span className="font-gaming text-sm text-foreground">
                    {wager.playerB ? truncateAddress(wager.playerB) : '???'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{wager.game.name}</span>
                  <span>•</span>
                  <Clock className="h-3 w-3" />
                  <span>{Math.floor((Date.now() - wager.createdAt) / 60000)}m ago</span>
                </div>
              </div>
            </div>

            {/* Right: Stake & Status */}
            <div className="flex items-center gap-4">
              {/* Stake */}
              <div className="text-right">
                <div className="font-gaming text-lg font-bold text-accent">
                  {formatSol(wager.stake)} SOL
                </div>
                <div className="text-xs text-muted-foreground">
                  Total Pot: {formatSol(wager.stake * 2)}
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
                {wager.winner && (
                  <div className="flex items-center gap-1 text-xs text-success">
                    <Trophy className="h-3 w-3" />
                    {truncateAddress(wager.winner)}
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

export function LiveFeed() {
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
          <Button variant="outline" className="group">
            View All
            <ExternalLink className="h-4 w-4 ml-2 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </Button>
        </div>

        {/* Feed */}
        <div className="space-y-3">
          {mockWagers.map((wager, index) => (
            <WagerCard key={wager.id} wager={wager} index={index} />
          ))}
        </div>

        {/* Live Count */}
        <div className="mt-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-card/50 border border-border/50">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            <span className="text-sm text-muted-foreground">
              <span className="font-gaming text-primary">24</span> active wagers right now
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
