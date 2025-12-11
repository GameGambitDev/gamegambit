import { useState } from 'react';
import { motion } from 'framer-motion';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Swords, Clock, Trophy, XCircle, CheckCircle, Filter, Loader2, Play, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GAMES, formatSol, truncateAddress } from '@/lib/constants';
import { useMyWagers, useSetReady, useStartGame, useWagerById, Wager } from '@/hooks/useWagers';
import { usePlayer } from '@/hooks/usePlayer';
import { ReadyRoomModal } from '@/components/ReadyRoomModal';
import { EditWagerModal, EditWagerData } from '@/components/EditWagerModal';
import { useEditWager } from '@/hooks/useWagers';
import { staggerContainer, staggerItem } from '@/components/PageTransition';
import { toast } from 'sonner';

const getGameData = (game: string) => {
  switch (game) {
    case 'chess': return GAMES.CHESS;
    case 'codm': return GAMES.CODM;
    case 'pubg': return GAMES.PUBG;
    default: return GAMES.CHESS;
  }
};

const getStatusBadge = (status: string, won?: boolean) => {
  switch (status) {
    case 'created':
      return <Badge variant="created">Waiting</Badge>;
    case 'joined':
      return <Badge variant="joined">Ready Room</Badge>;
    case 'voting':
      return <Badge variant="voting">In Progress</Badge>;
    case 'disputed':
      return <Badge variant="disputed">Disputed</Badge>;
    case 'resolved':
      return won ? <Badge variant="success">Won</Badge> : <Badge variant="destructive">Lost</Badge>;
    default:
      return <Badge variant="glass">{status}</Badge>;
  }
};

function WagerRow({ 
  wager, 
  myWallet,
  onEnterReadyRoom 
}: { 
  wager: Wager; 
  myWallet: string;
  onEnterReadyRoom?: (wagerId: string) => void;
}) {
  const game = getGameData(wager.game);
  const isChallenger = wager.player_a_wallet === myWallet;
  const opponent = isChallenger ? wager.player_b_wallet : wager.player_a_wallet;
  const won = wager.winner_wallet === myWallet;
  const timeDiff = Math.floor((Date.now() - new Date(wager.created_at).getTime()) / 60000);
  const gameLink = wager.game === 'chess' && wager.lichess_game_id 
    ? `https://lichess.org/${wager.lichess_game_id}` 
    : null;
  
  return (
    <Card variant="wager" className="group">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-3xl">{game.icon}</div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-gaming text-sm">You</span>
                <Swords className="h-4 w-4 text-muted-foreground" />
                <span className="font-gaming text-sm">
                  {opponent ? truncateAddress(opponent) : 'Waiting...'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{game.name}</span>
                <span>•</span>
                <Clock className="h-3 w-3" />
                <span>{timeDiff}m ago</span>
                <span>•</span>
                <span>{isChallenger ? 'Challenger' : 'Opponent'}</span>
                {gameLink && (
                  <>
                    <span>•</span>
                    <a 
                      href={gameLink} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Game <ExternalLink className="h-3 w-3" />
                    </a>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="font-gaming text-lg font-bold text-accent">
                {formatSol(wager.stake_lamports)} SOL
              </div>
            </div>
            {getStatusBadge(wager.status, won)}
            {wager.status === 'joined' && onEnterReadyRoom && (
              <Button 
                variant="neon" 
                size="sm"
                onClick={() => onEnterReadyRoom(wager.id)}
              >
                <Play className="h-4 w-4 mr-1" />
                Ready Room
              </Button>
            )}
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

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-12">
      <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
        <Swords className="h-8 w-8 text-muted-foreground" />
      </div>
      <p className="text-muted-foreground">{message}</p>
    </div>
  );
}

export default function MyWagers() {
  const { connected, publicKey } = useWallet();
  const walletAddress = publicKey?.toBase58() || '';
  const [readyRoomWagerId, setReadyRoomWagerId] = useState<string | null>(null);
  const [editWager, setEditWager] = useState<Wager | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  
  const { data: wagers, isLoading } = useMyWagers();
  const { data: player } = usePlayer();
  const { data: readyRoomWager } = useWagerById(readyRoomWagerId);
  const setReadyMutation = useSetReady();
  const startGameMutation = useStartGame();
  const editWagerMutation = useEditWager();

  const activeWagers = wagers?.filter(w => ['created', 'joined', 'voting', 'disputed'].includes(w.status)) || [];
  const completedWagers = wagers?.filter(w => w.status === 'resolved') || [];
  
  const winsCount = completedWagers.filter(w => w.winner_wallet === walletAddress).length;
  const lossesCount = completedWagers.filter(w => w.winner_wallet && w.winner_wallet !== walletAddress).length;

  const handleSetReady = async (ready: boolean) => {
    if (!readyRoomWagerId) return;
    try {
      await setReadyMutation.mutateAsync({ wagerId: readyRoomWagerId, ready });
    } catch (err: any) {
      toast.error(err.message || 'Failed to set ready status');
    }
  };

  const handleSaveEditWager = async (updates: EditWagerData) => {
    if (!editWager) return;
    try {
      await editWagerMutation.mutateAsync({ wagerId: editWager.id, ...updates });
      toast.success('Wager updated successfully');
      setEditModalOpen(false);
      setEditWager(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update wager');
    }
  };

  // Effect to handle game start when countdown completes
  if (readyRoomWager?.ready_player_a && readyRoomWager?.ready_player_b && readyRoomWager?.countdown_started_at) {
    const startTime = new Date(readyRoomWager.countdown_started_at).getTime();
    const now = Date.now();
    if (now - startTime >= 10000 && readyRoomWager.status === 'joined') {
      startGameMutation.mutate({ wagerId: readyRoomWager.id }, {
        onSuccess: () => {
          toast.success('Game started! Good luck!');
          setReadyRoomWagerId(null);
        }
      });
    }
  }

  if (!connected) {
    return (
      <div className="py-8 pb-16">
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
      </div>
    );
  }

  return (
    <div className="py-8 pb-16">
      <div className="container px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold mb-2">
            My <span className="gradient-text">Wagers</span>
          </h1>
          <p className="text-muted-foreground">Track all your active and completed matches</p>
        </motion.div>

        {/* Stats Overview */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
        >
          {[
            { label: 'Active', value: activeWagers.length, icon: Swords, color: 'text-primary' },
            { label: 'Won', value: winsCount, icon: Trophy, color: 'text-success' },
            { label: 'Lost', value: lossesCount, icon: XCircle, color: 'text-destructive' },
            { label: 'Total Earned', value: player ? `+${formatSol(player.total_earnings)} SOL` : '+0 SOL', icon: CheckCircle, color: 'text-accent' },
          ].map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + index * 0.05 }}
              whileHover={{ scale: 1.02, y: -2 }}
            >
              <Card variant="gaming" className="p-4 transition-all hover:border-primary/30">
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
            </motion.div>
          ))}
        </motion.div>

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

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <TabsContent value="all" className="space-y-3">
                {wagers && wagers.length > 0 ? (
                  <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-3">
                    {wagers.map((wager) => (
                      <motion.div key={wager.id} variants={staggerItem}>
                        <WagerRow 
                          wager={wager} 
                          myWallet={walletAddress} 
                          onEnterReadyRoom={setReadyRoomWagerId}
                        />
                      </motion.div>
                    ))}
                  </motion.div>
                ) : (
                  <EmptyState message="You haven't created or joined any wagers yet." />
                )}
              </TabsContent>

              <TabsContent value="active" className="space-y-3">
                {activeWagers.length > 0 ? (
                  <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-3">
                    {activeWagers.map((wager) => (
                      <motion.div key={wager.id} variants={staggerItem}>
                        <WagerRow 
                          wager={wager} 
                          myWallet={walletAddress}
                          onEnterReadyRoom={setReadyRoomWagerId}
                        />
                      </motion.div>
                    ))}
                  </motion.div>
                ) : (
                  <EmptyState message="No active wagers. Create or join one!" />
                )}
              </TabsContent>

              <TabsContent value="completed" className="space-y-3">
                {completedWagers.length > 0 ? (
                  <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-3">
                    {completedWagers.map((wager) => (
                      <motion.div key={wager.id} variants={staggerItem}>
                        <WagerRow wager={wager} myWallet={walletAddress} />
                      </motion.div>
                    ))}
                  </motion.div>
                ) : (
                  <EmptyState message="No completed wagers yet." />
                )}
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>

      <ReadyRoomModal
        wager={readyRoomWager || null}
        open={!!readyRoomWagerId}
        onOpenChange={(open) => !open && setReadyRoomWagerId(null)}
        onReady={handleSetReady}
        onEditWager={() => {
          if (readyRoomWager) {
            setEditWager(readyRoomWager);
            setEditModalOpen(true);
          }
        }}
        isSettingReady={setReadyMutation.isPending}
        currentWallet={walletAddress}
      />

      <EditWagerModal
        wager={editWager}
        open={editModalOpen}
        onOpenChange={(open) => {
          setEditModalOpen(open);
          if (!open) setEditWager(null);
        }}
        onSave={handleSaveEditWager}
        isSaving={editWagerMutation.isPending}
        canEditGameId={editWager?.status === 'created'}
      />
    </div>
  );
}