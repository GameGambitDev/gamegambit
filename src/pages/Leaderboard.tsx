import { motion } from 'framer-motion';
import { Trophy, Medal, TrendingUp, Crown, Flame, Loader2 } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/landing/Footer';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { truncateAddress, formatSol } from '@/lib/constants';
import { useLeaderboard, Player } from '@/hooks/usePlayer';
import { PageTransition, staggerContainer, staggerItem } from '@/components/PageTransition';

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

function EmptyLeaderboard() {
  return (
    <div className="text-center py-16">
      <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
        <Trophy className="h-10 w-10 text-muted-foreground" />
      </div>
      <h3 className="font-gaming text-xl mb-2">No players yet</h3>
      <p className="text-muted-foreground">Be the first to compete and claim the top spot!</p>
    </div>
  );
}

function LeaderboardRow({ player, rank, sortBy }: { player: Player; rank: number; sortBy: string }) {
  const winRate = player.total_wins + player.total_losses > 0 
    ? Math.round((player.total_wins / (player.total_wins + player.total_losses)) * 100) 
    : 0;
    
  return (
    <Card variant="wager" className={getRankStyle(rank)}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 flex justify-center">
              {getRankIcon(rank)}
            </div>
            <div>
              <div className="font-gaming text-sm">{truncateAddress(player.wallet_address)}</div>
              <div className="text-xs text-muted-foreground">
                {player.total_wins}W - {player.total_losses}L
              </div>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Win Rate</div>
              <div className="font-gaming text-success">{winRate}%</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">
                {sortBy === 'earnings' ? 'Earnings' : sortBy === 'wins' ? 'Wins' : 'Streak'}
              </div>
              <div className="font-gaming text-lg text-accent">
                {sortBy === 'earnings' 
                  ? `${formatSol(player.total_earnings)} SOL`
                  : sortBy === 'wins' 
                    ? player.total_wins
                    : player.current_streak}
              </div>
            </div>
            {player.current_streak > 0 && (
              <Badge variant="gold" className="flex items-center gap-1">
                <Flame className="h-3 w-3" />
                {player.current_streak}
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Podium({ players }: { players: Player[] }) {
  if (players.length < 3) return null;
  
  const top3 = [players[1], players[0], players[2]];
  const heights = ['h-32', 'h-40', 'h-28'];
  const positions = [2, 1, 3];
  
  return (
    <div className="flex justify-center items-end gap-4 mb-12">
      {top3.map((player, index) => {
        if (!player) return null;
        const winRate = player.total_wins + player.total_losses > 0 
          ? Math.round((player.total_wins / (player.total_wins + player.total_losses)) * 100) 
          : 0;
          
        return (
          <motion.div
            key={player.wallet_address}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + index * 0.1 }}
            className="text-center"
          >
            <div className="mb-2">
              {getRankIcon(positions[index])}
            </div>
            <div className="font-gaming text-sm mb-2">
              {truncateAddress(player.wallet_address)}
            </div>
            <div className={`${heights[index]} w-24 rounded-t-lg bg-gradient-to-t from-card to-muted/50 border border-border/50 flex items-center justify-center`}>
              <div className="text-center">
                <div className="font-gaming text-lg text-accent">{formatSol(player.total_earnings)} SOL</div>
                <div className="text-xs text-muted-foreground">{winRate}% WR</div>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

export default function Leaderboard() {
  const { data: earningsData, isLoading: earningsLoading } = useLeaderboard('earnings');
  const { data: winsData, isLoading: winsLoading } = useLeaderboard('wins');
  const { data: streakData, isLoading: streakLoading } = useLeaderboard('streak');

  return (
    <PageTransition>
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
            {earningsData && earningsData.length >= 3 && <Podium players={earningsData} />}

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
                {earningsLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : earningsData && earningsData.length > 0 ? (
                  <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-2">
                    {earningsData.map((player, index) => (
                      <motion.div key={player.wallet_address} variants={staggerItem}>
                        <LeaderboardRow player={player} rank={index + 1} sortBy="earnings" />
                      </motion.div>
                    ))}
                  </motion.div>
                ) : (
                  <EmptyLeaderboard />
                )}
              </TabsContent>

              <TabsContent value="wins">
                {winsLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : winsData && winsData.length > 0 ? (
                  <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-2">
                    {winsData.map((player, index) => (
                      <motion.div key={player.wallet_address} variants={staggerItem}>
                        <LeaderboardRow player={player} rank={index + 1} sortBy="wins" />
                      </motion.div>
                    ))}
                  </motion.div>
                ) : (
                  <EmptyLeaderboard />
                )}
              </TabsContent>

              <TabsContent value="streak">
                {streakLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : streakData && streakData.length > 0 ? (
                  <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-2">
                    {streakData.map((player, index) => (
                      <motion.div key={player.wallet_address} variants={staggerItem}>
                        <LeaderboardRow player={player} rank={index + 1} sortBy="streak" />
                      </motion.div>
                    ))}
                  </motion.div>
                ) : (
                  <EmptyLeaderboard />
                )}
              </TabsContent>
            </Tabs>
          </div>
        </main>
        <Footer />
      </div>
    </PageTransition>
  );
}
