import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { User, Trophy, Swords, Clock, CheckCircle, Link2, Copy, Check, Loader2, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GAMES, truncateAddress, formatSol } from '@/lib/constants';
import { toast } from '@/hooks/use-toast';
import { usePlayer, useCreatePlayer, useUpdatePlayer } from '@/hooks/usePlayer';
import { useWalletBalance } from '@/hooks/useWalletBalance';
import { useLichessUser } from '@/hooks/useLichess';

export default function Profile() {
  const { connected, publicKey } = useWallet();
  const { data: player, isLoading } = usePlayer();
  const { data: walletBalance, isLoading: balanceLoading } = useWalletBalance();
  const createPlayer = useCreatePlayer();
  const updatePlayer = useUpdatePlayer();
  
  // Get Lichess user data when linked
  const { data: lichessUserData } = useLichessUser(player?.lichess_username);
  
  const [lichessUsername, setLichessUsername] = useState('');
  const [codmUsername, setCodmUsername] = useState('');
  const [pubgName, setPubgName] = useState('');
  const [copiedAddress, setCopiedAddress] = useState(false);

  // Auto-create player profile if doesn't exist
  useEffect(() => {
    if (connected && !isLoading && !player && publicKey) {
      createPlayer.mutate();
    }
  }, [connected, isLoading, player, publicKey]);

  // Load existing usernames
  useEffect(() => {
    if (player) {
      setLichessUsername(player.lichess_username || '');
      setCodmUsername(player.codm_username || '');
      setPubgName(player.pubg_username || '');
    }
  }, [player]);

  const linkedAccounts = [
    { game: GAMES.CHESS, linked: !!player?.lichess_username, username: player?.lichess_username },
    { game: GAMES.CODM, linked: !!player?.codm_username, username: player?.codm_username },
    { game: GAMES.PUBG, linked: !!player?.pubg_username, username: player?.pubg_username },
  ];

  const copyAddress = () => {
    if (publicKey) {
      navigator.clipboard.writeText(publicKey.toBase58());
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2000);
      toast({ title: 'Address copied!' });
    }
  };

  const handleLinkLichess = async () => {
    if (!lichessUsername) return;
    try {
      await updatePlayer.mutateAsync({ lichess_username: lichessUsername });
      toast({ title: 'Lichess account linked!' });
    } catch (error) {
      toast({ title: 'Failed to link account', variant: 'destructive' });
    }
  };

  const handleLinkCodm = async () => {
    if (!codmUsername) return;
    try {
      await updatePlayer.mutateAsync({ codm_username: codmUsername });
      toast({ title: 'Call of Duty account linked!' });
    } catch (error) {
      toast({ title: 'Failed to link account', variant: 'destructive' });
    }
  };

  const handleLinkPubg = async () => {
    if (!pubgName) return;
    try {
      await updatePlayer.mutateAsync({ pubg_username: pubgName });
      toast({ title: 'PUBG account linked!' });
    } catch (error) {
      toast({ title: 'Failed to link account', variant: 'destructive' });
    }
  };

  const winRate = player && (player.total_wins + player.total_losses) > 0 
    ? Math.round((player.total_wins / (player.total_wins + player.total_losses)) * 100) 
    : 0;

  if (!connected) {
    return (
      <div className="py-8 pb-16">
        <div className="container px-4">
          <div className="max-w-md mx-auto text-center py-20">
            <div className="mb-8">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <User className="h-10 w-10 text-primary" />
              </div>
              <h1 className="text-3xl font-bold mb-4">Your Profile</h1>
              <p className="text-muted-foreground mb-8">
                Connect your wallet to view and manage your profile.
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

  if (isLoading) {
    return (
      <div className="py-8 pb-16">
        <div className="container px-4 flex justify-center items-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="py-8 pb-16">
      <div className="container px-4 max-w-4xl">
        {/* Profile Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Card variant="gaming" className="p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
              <motion.div 
                whileHover={{ scale: 1.05 }}
                className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center border border-primary/30"
              >
                <User className="h-10 w-10 text-primary" />
              </motion.div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-2xl font-bold font-gaming">
                    {publicKey && truncateAddress(publicKey.toBase58(), 6)}
                  </h1>
                  <Button variant="ghost" size="icon" onClick={copyAddress}>
                    {copiedAddress ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Wallet className="h-4 w-4 text-primary" />
                    {balanceLoading ? '...' : `${walletBalance?.toFixed(4) || '0'} SOL`}
                  </span>
                  <span className="flex items-center gap-1">
                    <Trophy className="h-4 w-4 text-accent" />
                    {player?.total_wins || 0} Wins
                  </span>
                  <span className="flex items-center gap-1">
                    <Swords className="h-4 w-4" />
                    {winRate}% Win Rate
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    Joined {player ? new Date(player.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Recently'}
                  </span>
                </div>
              </div>
              <Badge variant="gold" className="text-base px-4 py-2">
                +{player ? formatSol(player.total_earnings) : '0'} SOL
              </Badge>
            </div>
          </Card>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Linked Accounts */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card variant="gaming">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Link2 className="h-5 w-5 text-primary" />
                  Linked Game Accounts
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {linkedAccounts.map((account, index) => (
                  <motion.div
                    key={account.game.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15 + index * 0.05 }}
                    whileHover={{ scale: 1.01 }}
                    className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border/50 transition-all hover:border-primary/30"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{account.game.icon}</span>
                      <div>
                        <div className="font-medium">{account.game.name}</div>
                        <div className="text-sm text-muted-foreground">{account.game.platform}</div>
                      </div>
                    </div>
                    {account.linked ? (
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-success" />
                        <span className="text-sm text-success">{account.username}</span>
                      </div>
                    ) : (
                      <Badge variant="outline">Not Linked</Badge>
                    )}
                  </motion.div>
                ))}
              </CardContent>
            </Card>

            {/* Lichess Stats */}
            {lichessUserData && (
              <Card variant="gaming" className="mt-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="text-xl">♟️</span>
                    Lichess Stats
                    {lichessUserData.online && (
                      <Badge variant="live" className="ml-2">Online</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {lichessUserData.perfs?.bullet && (
                      <div className="p-3 rounded-lg bg-muted/30 text-center">
                        <div className="text-xs text-muted-foreground uppercase">Bullet</div>
                        <div className="font-gaming text-lg text-primary">{lichessUserData.perfs.bullet.rating}</div>
                        <div className="text-xs text-muted-foreground">{lichessUserData.perfs.bullet.games} games</div>
                      </div>
                    )}
                    {lichessUserData.perfs?.blitz && (
                      <div className="p-3 rounded-lg bg-muted/30 text-center">
                        <div className="text-xs text-muted-foreground uppercase">Blitz</div>
                        <div className="font-gaming text-lg text-primary">{lichessUserData.perfs.blitz.rating}</div>
                        <div className="text-xs text-muted-foreground">{lichessUserData.perfs.blitz.games} games</div>
                      </div>
                    )}
                    {lichessUserData.perfs?.rapid && (
                      <div className="p-3 rounded-lg bg-muted/30 text-center">
                        <div className="text-xs text-muted-foreground uppercase">Rapid</div>
                        <div className="font-gaming text-lg text-primary">{lichessUserData.perfs.rapid.rating}</div>
                        <div className="text-xs text-muted-foreground">{lichessUserData.perfs.rapid.games} games</div>
                      </div>
                    )}
                    {lichessUserData.perfs?.classical && (
                      <div className="p-3 rounded-lg bg-muted/30 text-center">
                        <div className="text-xs text-muted-foreground uppercase">Classical</div>
                        <div className="font-gaming text-lg text-primary">{lichessUserData.perfs.classical.rating}</div>
                        <div className="text-xs text-muted-foreground">{lichessUserData.perfs.classical.games} games</div>
                      </div>
                    )}
                  </div>
                  {lichessUserData.count && (
                    <div className="mt-4 pt-4 border-t border-border/50 flex justify-around text-center">
                      <div>
                        <div className="font-gaming text-success">{lichessUserData.count.win}</div>
                        <div className="text-xs text-muted-foreground">Wins</div>
                      </div>
                      <div>
                        <div className="font-gaming text-destructive">{lichessUserData.count.loss}</div>
                        <div className="text-xs text-muted-foreground">Losses</div>
                      </div>
                      <div>
                        <div className="font-gaming text-muted-foreground">{lichessUserData.count.draw}</div>
                        <div className="text-xs text-muted-foreground">Draws</div>
                      </div>
                      <div>
                        <div className="font-gaming">{lichessUserData.count.all}</div>
                        <div className="text-xs text-muted-foreground">Total</div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card variant="gaming">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-accent" />
                  Statistics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Total Matches', value: player ? player.total_wins + player.total_losses : 0 },
                    { label: 'Wins', value: player?.total_wins || 0 },
                    { label: 'Losses', value: player?.total_losses || 0 },
                    { label: 'Win Rate', value: `${winRate}%` },
                    { label: 'Total Wagered', value: `${player ? formatSol(player.total_wagered) : '0'} SOL` },
                    { label: 'Total Earned', value: `${player ? formatSol(player.total_earnings) : '0'} SOL` },
                    { label: 'Best Streak', value: `${player?.best_streak || 0} wins` },
                    { label: 'Current Streak', value: `${player?.current_streak || 0} wins` },
                  ].map((stat, index) => (
                    <motion.div 
                      key={stat.label} 
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.25 + index * 0.03 }}
                      className="p-3 rounded-lg bg-muted/30"
                    >
                      <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                        {stat.label}
                      </div>
                      <div className="font-gaming text-lg">{stat.value}</div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Link New Account Form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-2"
          >
            <Card variant="gaming">
              <CardHeader>
                <CardTitle>Link a Game Account</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="lichess">Lichess Username</Label>
                    <div className="flex gap-2">
                      <Input
                        id="lichess"
                        placeholder="Your Lichess username"
                        value={lichessUsername}
                        onChange={(e) => setLichessUsername(e.target.value)}
                        className="bg-muted/50"
                      />
                      <Button 
                        variant="outline" 
                        disabled={!lichessUsername || updatePlayer.isPending}
                        onClick={handleLinkLichess}
                      >
                        {updatePlayer.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Link'}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="codm">Call of Duty Username</Label>
                    <div className="flex gap-2">
                      <Input
                        id="codm"
                        placeholder="Your CODM username"
                        value={codmUsername}
                        onChange={(e) => setCodmUsername(e.target.value)}
                        className="bg-muted/50"
                      />
                      <Button 
                        variant="outline" 
                        disabled={!codmUsername || updatePlayer.isPending}
                        onClick={handleLinkCodm}
                      >
                        {updatePlayer.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Link'}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pubg">PUBG Name</Label>
                    <div className="flex gap-2">
                      <Input
                        id="pubg"
                        placeholder="Your PUBG username"
                        value={pubgName}
                        onChange={(e) => setPubgName(e.target.value)}
                        className="bg-muted/50"
                      />
                      <Button 
                        variant="outline" 
                        disabled={!pubgName || updatePlayer.isPending}
                        onClick={handleLinkPubg}
                      >
                        {updatePlayer.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Link'}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
