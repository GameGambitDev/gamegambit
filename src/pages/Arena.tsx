import { useState } from 'react';
import { motion } from 'framer-motion';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Search, MapPin, Zap, Filter, Plus, Swords, Clock, Trophy } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/landing/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { GAMES, formatSol, truncateAddress } from '@/lib/constants';

// Mock data
const mockOpenWagers = [
  {
    id: '1',
    playerA: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    game: GAMES.CHESS,
    stake: 500000000,
    createdAt: Date.now() - 1000 * 60 * 2,
  },
  {
    id: '2',
    playerA: '9mT2k3JxYB7nUqXWD6PzKqZ5Y8hLpV4B2Q8nMxX3Y9Cw',
    game: GAMES.CODM,
    stake: 1000000000,
    createdAt: Date.now() - 1000 * 60 * 5,
  },
  {
    id: '3',
    playerA: '5xLXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    game: GAMES.PUBG,
    stake: 2500000000,
    createdAt: Date.now() - 1000 * 60 * 8,
  },
  {
    id: '4',
    playerA: '2tK9FEkPBz8sB7rJdKdAYHHBNSYKLQV5D5mK3dZ9TwoW',
    game: GAMES.CHESS,
    stake: 100000000,
    createdAt: Date.now() - 1000 * 60 * 1,
  },
];

const mockLiveMatches = [
  {
    id: 'l1',
    playerA: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    playerB: '3tK9FEkPBz8sB7rJdKdAYHHBNSYKLQV5D5mK3dZ9TwoW',
    game: GAMES.CHESS,
    stake: 500000000,
    status: 'joined',
    startedAt: Date.now() - 1000 * 60 * 12,
  },
  {
    id: 'l2',
    playerA: '9mT2k3JxYB7nUqXWD6PzKqZ5Y8hLpV4B2Q8nMxX3Y9Cw',
    playerB: '4vK9YEkJHz8nR7kFeDaYEJJRNSZKLSK5E5oL3eY9UwoX',
    game: GAMES.CODM,
    stake: 1500000000,
    status: 'voting',
    startedAt: Date.now() - 1000 * 60 * 25,
  },
];

function OpenWagerCard({ wager }: { wager: typeof mockOpenWagers[0] }) {
  return (
    <Card variant="wager" className="group cursor-pointer">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-3xl">{wager.game.icon}</div>
            <div>
              <div className="font-gaming text-sm mb-1">
                {truncateAddress(wager.playerA)}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{wager.game.name}</span>
                <span>•</span>
                <Clock className="h-3 w-3" />
                <span>{Math.floor((Date.now() - wager.createdAt) / 60000)}m ago</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="font-gaming text-lg font-bold text-accent">
                {formatSol(wager.stake)} SOL
              </div>
            </div>
            <Button variant="neon" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
              Accept
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LiveMatchCard({ match }: { match: typeof mockLiveMatches[0] }) {
  return (
    <Card variant="wager" className="cursor-pointer border-primary/20">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="text-3xl">{match.game.icon}</div>
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-destructive" />
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-gaming text-sm">{truncateAddress(match.playerA)}</span>
                <Swords className="h-4 w-4 text-primary" />
                <span className="font-gaming text-sm">{truncateAddress(match.playerB)}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{match.game.name}</span>
                <span>•</span>
                <span>{Math.floor((Date.now() - match.startedAt) / 60000)}m</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="font-gaming text-accent">{formatSol(match.stake * 2)} SOL</div>
            <Badge variant={match.status === 'voting' ? 'voting' : 'joined'}>
              {match.status === 'voting' ? 'Voting' : 'Live'}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Arena() {
  const { connected } = useWallet();
  const [searchQuery, setSearchQuery] = useState('');

  if (!connected) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-24 pb-16">
          <div className="container px-4">
            <div className="max-w-md mx-auto text-center py-20">
              <div className="mb-8">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                  <Swords className="h-10 w-10 text-primary" />
                </div>
                <h1 className="text-3xl font-bold mb-4">Connect to Enter Arena</h1>
                <p className="text-muted-foreground mb-8">
                  Connect your Solana wallet to browse wagers, challenge opponents, and start winning.
                </p>
              </div>
              <div className="[&_.wallet-adapter-button]:!bg-primary [&_.wallet-adapter-button]:!text-primary-foreground [&_.wallet-adapter-button]:!font-gaming [&_.wallet-adapter-button]:!rounded-lg [&_.wallet-adapter-button]:!h-12 [&_.wallet-adapter-button]:!px-8 [&_.wallet-adapter-button]:hover:!shadow-neon">
                <WalletMultiButton />
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-24 pb-16">
        <div className="container px-4">
          {/* Top Actions */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold mb-2">
                <span className="gradient-text">Arena</span>
              </h1>
              <p className="text-muted-foreground">Find opponents and stake your claim</p>
            </div>
            <div className="flex gap-3">
              <Button variant="neon" className="group">
                <Plus className="h-4 w-4 mr-2" />
                Create Wager
              </Button>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-8">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by wallet address or username..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-card border-border"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="icon">
                <MapPin className="h-4 w-4" />
              </Button>
              <Button variant="outline">
                <Zap className="h-4 w-4 mr-2" />
                Quick Match
              </Button>
              <Button variant="ghost" size="icon">
                <Filter className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Content - Open Wagers */}
            <div className="lg:col-span-2 space-y-6">
              {/* Live Matches */}
              {mockLiveMatches.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive" />
                    </span>
                    <h2 className="font-gaming text-lg">Live Matches</h2>
                  </div>
                  <div className="space-y-3">
                    {mockLiveMatches.map((match) => (
                      <motion.div
                        key={match.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                      >
                        <LiveMatchCard match={match} />
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Open Wagers */}
              <div>
                <h2 className="font-gaming text-lg mb-4">Open Wagers</h2>
                <div className="space-y-3">
                  {mockOpenWagers.map((wager, index) => (
                    <motion.div
                      key={wager.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <OpenWagerCard wager={wager} />
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Quick Stats */}
              <Card variant="gaming">
                <CardContent className="p-6">
                  <h3 className="font-gaming text-sm uppercase tracking-wider text-muted-foreground mb-4">
                    Your Stats
                  </h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Total Won</span>
                      <span className="font-gaming text-success">+12.5 SOL</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Win Rate</span>
                      <span className="font-gaming text-accent">68%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Matches Played</span>
                      <span className="font-gaming">47</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Recent Winners */}
              <Card variant="gaming">
                <CardContent className="p-6">
                  <h3 className="font-gaming text-sm uppercase tracking-wider text-muted-foreground mb-4">
                    Recent Winners
                  </h3>
                  <div className="space-y-3">
                    {[
                      { address: '7xKX...sAsU', amount: 2.5, game: '♟️' },
                      { address: '9mT2...Y9Cw', amount: 1.0, game: '🎯' },
                      { address: '5xLX...sAsU', amount: 4.0, game: '🔫' },
                    ].map((winner, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span>{winner.game}</span>
                          <span className="text-sm">{winner.address}</span>
                        </div>
                        <div className="flex items-center gap-1 text-sm text-success">
                          <Trophy className="h-3 w-3" />
                          +{winner.amount} SOL
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
