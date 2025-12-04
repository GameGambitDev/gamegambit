import { useState } from 'react';
import { motion } from 'framer-motion';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Search, MapPin, Zap, Filter, Plus, Swords, Clock, Trophy, Loader2 } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/landing/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { GAMES, formatSol, truncateAddress } from '@/lib/constants';
import { useOpenWagers, useLiveWagers, Wager } from '@/hooks/useWagers';
import { usePlayer } from '@/hooks/usePlayer';

const getGameData = (game: string) => {
  switch (game) {
    case 'chess': return GAMES.CHESS;
    case 'codm': return GAMES.CODM;
    case 'pubg': return GAMES.PUBG;
    default: return GAMES.CHESS;
  }
};

function OpenWagerCard({ wager }: { wager: Wager }) {
  const game = getGameData(wager.game);
  const timeDiff = Math.floor((Date.now() - new Date(wager.created_at).getTime()) / 60000);
  
  return (
    <Card variant="wager" className="group cursor-pointer">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-3xl">{game.icon}</div>
            <div>
              <div className="font-gaming text-sm mb-1">
                {truncateAddress(wager.player_a_wallet)}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{game.name}</span>
                <span>•</span>
                <Clock className="h-3 w-3" />
                <span>{timeDiff}m ago</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="font-gaming text-lg font-bold text-accent">
                {formatSol(wager.stake_lamports)} SOL
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

function LiveMatchCard({ wager }: { wager: Wager }) {
  const game = getGameData(wager.game);
  const timeDiff = Math.floor((Date.now() - new Date(wager.created_at).getTime()) / 60000);
  
  return (
    <Card variant="wager" className="cursor-pointer border-primary/20">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="text-3xl">{game.icon}</div>
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-destructive" />
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-gaming text-sm">{truncateAddress(wager.player_a_wallet)}</span>
                <Swords className="h-4 w-4 text-primary" />
                <span className="font-gaming text-sm">{wager.player_b_wallet ? truncateAddress(wager.player_b_wallet) : '???'}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{game.name}</span>
                <span>•</span>
                <span>{timeDiff}m</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="font-gaming text-accent">{formatSol(wager.stake_lamports * 2)} SOL</div>
            <Badge variant={wager.status === 'voting' ? 'voting' : 'joined'}>
              {wager.status === 'voting' ? 'Voting' : 'Live'}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="text-center py-12 px-4">
      <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
        <Swords className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="font-gaming text-lg mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm">{description}</p>
    </div>
  );
}

export default function Arena() {
  const { connected } = useWallet();
  const [searchQuery, setSearchQuery] = useState('');
  
  const { data: openWagers, isLoading: openLoading } = useOpenWagers();
  const { data: liveWagers, isLoading: liveLoading } = useLiveWagers();
  const { data: player } = usePlayer();

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
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive" />
                  </span>
                  <h2 className="font-gaming text-lg">Live Matches</h2>
                </div>
                {liveLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : liveWagers && liveWagers.length > 0 ? (
                  <div className="space-y-3">
                    {liveWagers.map((wager) => (
                      <motion.div
                        key={wager.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                      >
                        <LiveMatchCard wager={wager} />
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <Card variant="gaming" className="p-6">
                    <p className="text-center text-muted-foreground text-sm">No live matches right now</p>
                  </Card>
                )}
              </div>

              {/* Open Wagers */}
              <div>
                <h2 className="font-gaming text-lg mb-4">Open Wagers</h2>
                {openLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : openWagers && openWagers.length > 0 ? (
                  <div className="space-y-3">
                    {openWagers.map((wager, index) => (
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
                ) : (
                  <EmptyState 
                    title="No open wagers" 
                    description="Be the first to create a wager and challenge opponents!" 
                  />
                )}
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
                      <span className="font-gaming text-success">
                        +{player ? formatSol(player.total_earnings) : '0'} SOL
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Win Rate</span>
                      <span className="font-gaming text-accent">
                        {player && (player.total_wins + player.total_losses) > 0 
                          ? Math.round((player.total_wins / (player.total_wins + player.total_losses)) * 100) 
                          : 0}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Matches Played</span>
                      <span className="font-gaming">
                        {player ? player.total_wins + player.total_losses : 0}
                      </span>
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
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No recent winners yet
                  </p>
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
