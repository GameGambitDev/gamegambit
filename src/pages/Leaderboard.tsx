import { motion } from 'framer-motion';
import { Trophy, Medal, TrendingUp, Crown, Flame } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/landing/Footer';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { truncateAddress } from '@/lib/constants';

// Mock leaderboard data
const mockLeaderboard = [
  { rank: 1, address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU', wins: 147, losses: 23, earnings: 89.5, winRate: 86.5, streak: 12 },
  { rank: 2, address: '9mT2k3JxYB7nUqXWD6PzKqZ5Y8hLpV4B2Q8nMxX3Y9Cw', wins: 132, losses: 28, earnings: 72.3, winRate: 82.5, streak: 8 },
  { rank: 3, address: '5xLXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU', wins: 118, losses: 32, earnings: 64.1, winRate: 78.7, streak: 5 },
  { rank: 4, address: '3tK9FEkPBz8sB7rJdKdAYHHBNSYKLQV5D5mK3dZ9TwoW', wins: 105, losses: 35, earnings: 52.8, winRate: 75.0, streak: 3 },
  { rank: 5, address: '2tK9FEkPBz8sB7rJdKdAYHHBNSYKLQV5D5mK3dZ9TwoW', wins: 98, losses: 38, earnings: 45.2, winRate: 72.1, streak: 6 },
  { rank: 6, address: '4vK9YEkJHz8nR7kFeDaYEJJRNSZKLSK5E5oL3eY9UwoX', wins: 92, losses: 41, earnings: 38.9, winRate: 69.2, streak: 2 },
  { rank: 7, address: '8nS2m3JxYB7nUqXWD6PzKqZ5Y8hLpV4B2Q8nMxX3Y9Dw', wins: 87, losses: 43, earnings: 34.5, winRate: 66.9, streak: 4 },
  { rank: 8, address: '6mT2k3JxYB7nUqXWD6PzKqZ5Y8hLpV4B2Q8nMxX3Y9Ew', wins: 81, losses: 46, earnings: 29.7, winRate: 63.8, streak: 1 },
  { rank: 9, address: '1xLXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgBsV', wins: 76, losses: 48, earnings: 25.3, winRate: 61.3, streak: 2 },
  { rank: 10, address: '0tK9FEkPBz8sB7rJdKdAYHHBNSYKLQV5D5mK3dZ9UwoY', wins: 71, losses: 51, earnings: 21.8, winRate: 58.2, streak: 0 },
];

const getRankIcon = (rank: number) => {
  switch (rank) {
    case 1:
      return <Crown className="h-6 w-6 text-accent" />;
    case 2:
      return <Medal className="h-6 w-6 text-muted-foreground" />;
    case 3:
      return <Medal className="h-6 w-6 text-amber-700" />;
    default:
      return <span className="font-gaming text-lg text-muted-foreground">#{rank}</span>;
  }
};

const getRankStyle = (rank: number) => {
  switch (rank) {
    case 1:
      return 'border-accent/50 bg-gradient-to-r from-accent/10 via-transparent to-transparent';
    case 2:
      return 'border-muted-foreground/30 bg-gradient-to-r from-muted-foreground/5 via-transparent to-transparent';
    case 3:
      return 'border-amber-700/30 bg-gradient-to-r from-amber-700/5 via-transparent to-transparent';
    default:
      return '';
  }
};

export default function Leaderboard() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-24 pb-16">
        <div className="container px-4">
          <div className="text-center mb-12">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl font-bold mb-4"
            >
              <span className="gradient-text-gold">Leaderboard</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-muted-foreground"
            >
              Top players ranked by earnings and win rate
            </motion.p>
          </div>

          {/* Top 3 Podium */}
          <div className="flex justify-center items-end gap-4 mb-12">
            {[mockLeaderboard[1], mockLeaderboard[0], mockLeaderboard[2]].map((player, index) => {
              const heights = ['h-32', 'h-40', 'h-28'];
              const positions = [2, 1, 3];
              return (
                <motion.div
                  key={player.address}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + index * 0.1 }}
                  className="text-center"
                >
                  <div className="mb-2">
                    {getRankIcon(positions[index])}
                  </div>
                  <div className="font-gaming text-sm mb-2">
                    {truncateAddress(player.address)}
                  </div>
                  <div className={`${heights[index]} w-24 rounded-t-lg bg-gradient-to-t from-card to-muted/50 border border-border/50 flex items-center justify-center`}>
                    <div className="text-center">
                      <div className="font-gaming text-lg text-accent">{player.earnings} SOL</div>
                      <div className="text-xs text-muted-foreground">{player.winRate}% WR</div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Tabs */}
          <Tabs defaultValue="earnings" className="max-w-4xl mx-auto">
            <TabsList className="bg-muted/50 mb-6 grid grid-cols-3 w-full max-w-md mx-auto">
              <TabsTrigger value="earnings" className="font-gaming">
                <TrendingUp className="h-4 w-4 mr-2" />
                Earnings
              </TabsTrigger>
              <TabsTrigger value="wins" className="font-gaming">
                <Trophy className="h-4 w-4 mr-2" />
                Wins
              </TabsTrigger>
              <TabsTrigger value="streak" className="font-gaming">
                <Flame className="h-4 w-4 mr-2" />
                Streak
              </TabsTrigger>
            </TabsList>

            <TabsContent value="earnings">
              <div className="space-y-2">
                {mockLeaderboard.map((player, index) => (
                  <motion.div
                    key={player.address}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card variant="wager" className={`${getRankStyle(player.rank)}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-10 flex justify-center">
                              {getRankIcon(player.rank)}
                            </div>
                            <div>
                              <div className="font-gaming text-sm">{truncateAddress(player.address)}</div>
                              <div className="text-xs text-muted-foreground">
                                {player.wins}W - {player.losses}L
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="text-right">
                              <div className="text-xs text-muted-foreground">Win Rate</div>
                              <div className="font-gaming text-success">{player.winRate}%</div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs text-muted-foreground">Earnings</div>
                              <div className="font-gaming text-lg text-accent">{player.earnings} SOL</div>
                            </div>
                            {player.streak > 0 && (
                              <Badge variant="gold" className="flex items-center gap-1">
                                <Flame className="h-3 w-3" />
                                {player.streak}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="wins">
              <div className="space-y-2">
                {[...mockLeaderboard].sort((a, b) => b.wins - a.wins).map((player, index) => (
                  <motion.div
                    key={player.address}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card variant="wager">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-10 flex justify-center">
                              <span className="font-gaming text-lg text-muted-foreground">#{index + 1}</span>
                            </div>
                            <div>
                              <div className="font-gaming text-sm">{truncateAddress(player.address)}</div>
                              <div className="text-xs text-muted-foreground">{player.winRate}% Win Rate</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <Trophy className="h-5 w-5 text-accent" />
                            <span className="font-gaming text-xl">{player.wins}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="streak">
              <div className="space-y-2">
                {[...mockLeaderboard].sort((a, b) => b.streak - a.streak).map((player, index) => (
                  <motion.div
                    key={player.address}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card variant="wager">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-10 flex justify-center">
                              <span className="font-gaming text-lg text-muted-foreground">#{index + 1}</span>
                            </div>
                            <div>
                              <div className="font-gaming text-sm">{truncateAddress(player.address)}</div>
                              <div className="text-xs text-muted-foreground">{player.wins}W - {player.losses}L</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Flame className="h-5 w-5 text-destructive" />
                            <span className="font-gaming text-xl">{player.streak}</span>
                            <span className="text-sm text-muted-foreground">wins</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <Footer />
    </div>
  );
}
