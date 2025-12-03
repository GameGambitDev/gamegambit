import { useState } from 'react';
import { motion } from 'framer-motion';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Swords, Clock, Trophy, AlertTriangle, CheckCircle, XCircle, Filter } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/landing/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GAMES, formatSol, truncateAddress } from '@/lib/constants';

// Mock data
const mockWagers = [
  {
    id: '1',
    opponent: '3tK9FEkPBz8sB7rJdKdAYHHBNSYKLQV5D5mK3dZ9TwoW',
    game: GAMES.CHESS,
    stake: 500000000,
    status: 'joined',
    isChallenger: true,
    createdAt: Date.now() - 1000 * 60 * 15,
  },
  {
    id: '2',
    opponent: '9mT2k3JxYB7nUqXWD6PzKqZ5Y8hLpV4B2Q8nMxX3Y9Cw',
    game: GAMES.CODM,
    stake: 1000000000,
    status: 'voting',
    isChallenger: false,
    createdAt: Date.now() - 1000 * 60 * 45,
  },
  {
    id: '3',
    opponent: '5xLXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    game: GAMES.CHESS,
    stake: 250000000,
    status: 'resolved',
    isChallenger: true,
    won: true,
    createdAt: Date.now() - 1000 * 60 * 120,
  },
  {
    id: '4',
    opponent: '2tK9FEkPBz8sB7rJdKdAYHHBNSYKLQV5D5mK3dZ9TwoW',
    game: GAMES.PUBG,
    stake: 2000000000,
    status: 'resolved',
    isChallenger: false,
    won: false,
    createdAt: Date.now() - 1000 * 60 * 180,
  },
  {
    id: '5',
    opponent: null,
    game: GAMES.CHESS,
    stake: 750000000,
    status: 'created',
    isChallenger: true,
    createdAt: Date.now() - 1000 * 60 * 5,
  },
];

const getStatusBadge = (status: string, won?: boolean) => {
  switch (status) {
    case 'created':
      return <Badge variant="created">Waiting</Badge>;
    case 'joined':
      return <Badge variant="joined">In Progress</Badge>;
    case 'voting':
      return <Badge variant="voting">Voting</Badge>;
    case 'disputed':
      return <Badge variant="disputed">Disputed</Badge>;
    case 'resolved':
      return won ? <Badge variant="success">Won</Badge> : <Badge variant="destructive">Lost</Badge>;
    default:
      return <Badge variant="glass">{status}</Badge>;
  }
};

function WagerRow({ wager }: { wager: typeof mockWagers[0] }) {
  return (
    <Card variant="wager" className="group">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-3xl">{wager.game.icon}</div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-gaming text-sm">You</span>
                <Swords className="h-4 w-4 text-muted-foreground" />
                <span className="font-gaming text-sm">
                  {wager.opponent ? truncateAddress(wager.opponent) : 'Waiting...'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{wager.game.name}</span>
                <span>•</span>
                <Clock className="h-3 w-3" />
                <span>{Math.floor((Date.now() - wager.createdAt) / 60000)}m ago</span>
                <span>•</span>
                <span>{wager.isChallenger ? 'Challenger' : 'Opponent'}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="font-gaming text-lg font-bold text-accent">
                {formatSol(wager.stake)} SOL
              </div>
            </div>
            {getStatusBadge(wager.status, wager.won)}
            {wager.status === 'voting' && (
              <Button variant="gold" size="sm">
                Vote
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MyWagers() {
  const { connected } = useWallet();
  const [activeTab, setActiveTab] = useState('all');

  const activeWagers = mockWagers.filter(w => ['created', 'joined', 'voting', 'disputed'].includes(w.status));
  const completedWagers = mockWagers.filter(w => w.status === 'resolved');

  if (!connected) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-24 pb-16">
          <div className="container px-4">
            <div className="max-w-md mx-auto text-center py-20">
              <div className="mb-8">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                  <Trophy className="h-10 w-10 text-primary" />
                </div>
                <h1 className="text-3xl font-bold mb-4">View Your Wagers</h1>
                <p className="text-muted-foreground mb-8">
                  Connect your wallet to see your active and completed wagers.
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
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">
              My <span className="gradient-text">Wagers</span>
            </h1>
            <p className="text-muted-foreground">Track all your active and completed matches</p>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Active', value: activeWagers.length, icon: Swords, color: 'text-primary' },
              { label: 'Won', value: completedWagers.filter(w => w.won).length, icon: Trophy, color: 'text-success' },
              { label: 'Lost', value: completedWagers.filter(w => !w.won).length, icon: XCircle, color: 'text-destructive' },
              { label: 'Total Earned', value: '+4.5 SOL', icon: CheckCircle, color: 'text-accent' },
            ].map((stat) => (
              <Card key={stat.label} variant="gaming" className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-muted ${stat.color}`}>
                    <stat.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider">{stat.label}</div>
                    <div className="font-gaming text-xl">{stat.value}</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Tabs */}
          <Tabs defaultValue="all" className="space-y-6">
            <div className="flex items-center justify-between">
              <TabsList className="bg-muted/50">
                <TabsTrigger value="all" className="font-gaming">All</TabsTrigger>
                <TabsTrigger value="active" className="font-gaming">Active</TabsTrigger>
                <TabsTrigger value="completed" className="font-gaming">Completed</TabsTrigger>
              </TabsList>
              <Button variant="ghost" size="icon">
                <Filter className="h-4 w-4" />
              </Button>
            </div>

            <TabsContent value="all" className="space-y-3">
              {mockWagers.map((wager, index) => (
                <motion.div
                  key={wager.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <WagerRow wager={wager} />
                </motion.div>
              ))}
            </TabsContent>

            <TabsContent value="active" className="space-y-3">
              {activeWagers.map((wager, index) => (
                <motion.div
                  key={wager.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <WagerRow wager={wager} />
                </motion.div>
              ))}
            </TabsContent>

            <TabsContent value="completed" className="space-y-3">
              {completedWagers.map((wager, index) => (
                <motion.div
                  key={wager.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <WagerRow wager={wager} />
                </motion.div>
              ))}
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <Footer />
    </div>
  );
}
