import { motion } from 'framer-motion';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { 
  Trophy, Swords, TrendingUp, Wallet, Clock, Target, 
  ChevronRight, Flame, Star, Activity
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/landing/Footer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { truncateAddress } from '@/lib/constants';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { connected, publicKey } = useWallet();

  // Mock data - replace with real data later
  const stats = {
    balance: 12.5,
    totalEarnings: 57.7,
    totalWagered: 45.2,
    wins: 47,
    losses: 22,
    winRate: 68,
    currentStreak: 3,
    bestStreak: 8,
  };

  const recentMatches = [
    { id: 1, game: '♟️', opponent: 'ChessMaster99', result: 'win', amount: 0.5, time: '2h ago' },
    { id: 2, game: '🎮', opponent: 'ProGamer_X', result: 'win', amount: 1.0, time: '5h ago' },
    { id: 3, game: '♟️', opponent: 'KnightRider', result: 'loss', amount: -0.25, time: '1d ago' },
    { id: 4, game: '🔫', opponent: 'HeadshotKing', result: 'win', amount: 2.0, time: '2d ago' },
  ];

  const activeWagers = [
    { id: 1, game: '♟️', opponent: 'Waiting...', stake: 0.5, status: 'open' },
    { id: 2, game: '🎮', opponent: 'MobileKing', stake: 1.0, status: 'live' },
  ];

  if (!connected) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-24 pb-16">
          <div className="container px-4">
            <div className="max-w-md mx-auto text-center py-20">
              <div className="mb-8">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                  <Activity className="h-10 w-10 text-primary" />
                </div>
                <h1 className="text-3xl font-bold mb-4">Your Dashboard</h1>
                <p className="text-muted-foreground mb-8">
                  Connect your wallet to view your dashboard.
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
          {/* Welcome Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1 className="text-3xl font-bold font-gaming mb-2">
              Welcome back, <span className="text-primary">{publicKey && truncateAddress(publicKey.toBase58(), 4)}</span>
            </h1>
            <p className="text-muted-foreground">Here's your gaming overview</p>
          </motion.div>

          {/* Quick Stats Row */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
          >
            <Card variant="gaming" className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/20">
                  <Wallet className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Balance</p>
                  <p className="text-xl font-gaming font-bold text-primary">{stats.balance} SOL</p>
                </div>
              </div>
            </Card>

            <Card variant="gaming" className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-success/20">
                  <TrendingUp className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Total Earned</p>
                  <p className="text-xl font-gaming font-bold text-success">+{stats.totalEarnings} SOL</p>
                </div>
              </div>
            </Card>

            <Card variant="gaming" className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-accent/20">
                  <Trophy className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Wins</p>
                  <p className="text-xl font-gaming font-bold">{stats.wins}</p>
                </div>
              </div>
            </Card>

            <Card variant="gaming" className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500/20">
                  <Flame className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Streak</p>
                  <p className="text-xl font-gaming font-bold">{stats.currentStreak} 🔥</p>
                </div>
              </div>
            </Card>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content - Left Side */}
            <div className="lg:col-span-2 space-y-6">
              {/* Win Rate Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Card variant="gaming">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="h-5 w-5 text-primary" />
                      Performance
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between mb-2">
                          <span className="text-sm text-muted-foreground">Win Rate</span>
                          <span className="font-gaming text-primary">{stats.winRate}%</span>
                        </div>
                        <Progress value={stats.winRate} className="h-3" />
                      </div>
                      <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border/50">
                        <div className="text-center">
                          <p className="text-2xl font-gaming text-success">{stats.wins}</p>
                          <p className="text-xs text-muted-foreground">Wins</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-gaming text-destructive">{stats.losses}</p>
                          <p className="text-xs text-muted-foreground">Losses</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-gaming text-accent">{stats.bestStreak}</p>
                          <p className="text-xs text-muted-foreground">Best Streak</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Recent Matches */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Card variant="gaming">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-primary" />
                      Recent Matches
                    </CardTitle>
                    <Link to="/my-wagers">
                      <Button variant="ghost" size="sm" className="text-primary">
                        View All <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </Link>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {recentMatches.map((match) => (
                        <div
                          key={match.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{match.game}</span>
                            <div>
                              <p className="font-medium">vs {match.opponent}</p>
                              <p className="text-xs text-muted-foreground">{match.time}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge variant={match.result === 'win' ? 'success' : 'destructive'}>
                              {match.result === 'win' ? 'WIN' : 'LOSS'}
                            </Badge>
                            <p className={`text-sm font-gaming mt-1 ${match.amount > 0 ? 'text-success' : 'text-destructive'}`}>
                              {match.amount > 0 ? '+' : ''}{match.amount} SOL
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Sidebar - Right Side */}
            <div className="space-y-6">
              {/* Active Wagers */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <Card variant="gaming">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Swords className="h-5 w-5 text-primary" />
                      Active Wagers
                    </CardTitle>
                    <Badge variant="outline">{activeWagers.length}</Badge>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {activeWagers.map((wager) => (
                        <div
                          key={wager.id}
                          className="p-3 rounded-lg bg-muted/30 border border-border/50"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xl">{wager.game}</span>
                              <span className="text-sm">{wager.opponent}</span>
                            </div>
                            <Badge variant={wager.status === 'live' ? 'live' : 'secondary'}>
                              {wager.status === 'live' ? '🔴 LIVE' : 'OPEN'}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Stake: <span className="text-primary font-gaming">{wager.stake} SOL</span>
                          </p>
                        </div>
                      ))}
                    </div>
                    <Link to="/arena" className="block mt-4">
                      <Button variant="neon" className="w-full">
                        Find Match
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Quick Actions */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <Card variant="gaming">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Star className="h-5 w-5 text-accent" />
                      Quick Actions
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Link to="/arena" className="block">
                      <Button variant="outline" className="w-full justify-start">
                        <Swords className="h-4 w-4 mr-2" /> Create Wager
                      </Button>
                    </Link>
                    <Link to="/leaderboard" className="block">
                      <Button variant="outline" className="w-full justify-start">
                        <Trophy className="h-4 w-4 mr-2" /> View Leaderboard
                      </Button>
                    </Link>
                    <Link to="/profile" className="block">
                      <Button variant="outline" className="w-full justify-start">
                        <Activity className="h-4 w-4 mr-2" /> Edit Profile
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
