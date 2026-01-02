import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { User, Trophy, Swords, Clock, Copy, Check, Loader2, Wallet, Edit2, Save, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GAMES, truncateAddress, formatSol } from '@/lib/constants';
import { toast } from '@/hooks/use-toast';
import { usePlayer, useCreatePlayer, useUpdatePlayer, usePlayerByWallet } from '@/hooks/usePlayer';
import { useWalletBalance } from '@/hooks/useWalletBalance';
import { useLichessUser } from '@/hooks/useLichess';
import { GameAccountCard } from '@/components/GameAccountCard';

export default function Profile() {
  const { walletAddress: urlWalletAddress } = useParams<{ walletAddress?: string }>();
  const { connected, publicKey } = useWallet();
  const currentUserWallet = publicKey?.toBase58();
  
  // Determine if viewing own profile or another user's
  const isOwnProfile = !urlWalletAddress || urlWalletAddress === currentUserWallet;
  const viewingWallet = urlWalletAddress || currentUserWallet;
  
  // Fetch player data based on whose profile we're viewing
  const { data: ownPlayer, isLoading: ownLoading } = usePlayer();
  const { data: otherPlayer, isLoading: otherLoading } = usePlayerByWallet(isOwnProfile ? null : urlWalletAddress || null);
  
  const player = isOwnProfile ? ownPlayer : otherPlayer;
  const isLoading = isOwnProfile ? ownLoading : otherLoading;
  
  const { data: walletBalance, isLoading: balanceLoading } = useWalletBalance();
  const createPlayer = useCreatePlayer();
  const updatePlayer = useUpdatePlayer();
  
  // Get Lichess user data when linked
  const { data: lichessUserData } = useLichessUser(player?.lichess_username);
  
  const [platformUsername, setPlatformUsername] = useState('');
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);

  // Auto-create player profile if doesn't exist (only for own profile)
  useEffect(() => {
    if (isOwnProfile && connected && !isLoading && !player && publicKey) {
      createPlayer.mutate();
    }
  }, [connected, isLoading, player, publicKey, isOwnProfile]);

  // Load existing username (only for own profile editing)
  useEffect(() => {
    if (isOwnProfile && player) {
      setPlatformUsername(player.username || '');
    }
  }, [player, isOwnProfile]);

  const gameAccounts = [
    { game: GAMES.CHESS, linkedUsername: player?.lichess_username || null, key: 'lichess_username' },
    { game: GAMES.CODM, linkedUsername: player?.codm_username || null, key: 'codm_username' },
    { game: GAMES.PUBG, linkedUsername: player?.pubg_username || null, key: 'pubg_username' },
  ];

  const copyAddress = () => {
    if (viewingWallet) {
      navigator.clipboard.writeText(viewingWallet);
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2000);
      toast({ title: 'Address copied!' });
    }
  };

  const handleUpdateUsername = async () => {
    if (!platformUsername.trim()) {
      toast({ title: 'Username cannot be empty', variant: 'destructive' });
      return;
    }
    if (platformUsername.length < 3 || platformUsername.length > 20) {
      toast({ title: 'Username must be 3-20 characters', variant: 'destructive' });
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(platformUsername)) {
      toast({ title: 'Only letters, numbers, and underscores allowed', variant: 'destructive' });
      return;
    }
    try {
      await updatePlayer.mutateAsync({ username: platformUsername.trim() });
      toast({ title: 'Username updated!' });
      setIsEditingUsername(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update username';
      toast({ title: message, variant: 'destructive' });
    }
  };

  const handleLinkAccount = async (key: string, username: string) => {
    try {
      await updatePlayer.mutateAsync({ [key]: username });
      toast({ title: 'Account linked successfully!' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to link account';
      toast({ title: message, variant: 'destructive' });
      throw error;
    }
  };

  const winRate = player && (player.total_wins + player.total_losses) > 0 
    ? Math.round((player.total_wins / (player.total_wins + player.total_losses)) * 100) 
    : 0;

  // Only require wallet connection for own profile
  if (!connected && isOwnProfile) {
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

  // Show not found for non-existent players
  if (!isLoading && !player && !isOwnProfile) {
    return (
      <div className="py-8 pb-16">
        <div className="container px-4">
          <div className="max-w-md mx-auto text-center py-20">
            <div className="mb-8">
              <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-6">
                <User className="h-10 w-10 text-muted-foreground" />
              </div>
              <h1 className="text-3xl font-bold mb-4">Player Not Found</h1>
              <p className="text-muted-foreground mb-8">
                This player hasn't joined the platform yet.
              </p>
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
                    {player?.username || (viewingWallet && truncateAddress(viewingWallet, 6))}
                  </h1>
                  {player?.username && viewingWallet && (
                    <span className="text-sm text-muted-foreground">
                      ({truncateAddress(viewingWallet, 4)})
                    </span>
                  )}
                  {!isOwnProfile && (
                    <Badge variant="outline" className="ml-2">Viewing Profile</Badge>
                  )}
                  <Button variant="ghost" size="icon" onClick={copyAddress}>
                    {copiedAddress ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  {isOwnProfile && (
                    <span className="flex items-center gap-1">
                      <Wallet className="h-4 w-4 text-primary" />
                      {balanceLoading ? '...' : `${walletBalance?.toFixed(4) || '0'} SOL`}
                    </span>
                  )}
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
              <CardContent className="space-y-3">
                {gameAccounts.map((account, index) => (
                  <motion.div
                    key={account.game.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15 + index * 0.05 }}
                  >
                    <GameAccountCard
                      game={account.game}
                      linkedUsername={account.linkedUsername}
                      onLink={(username) => handleLinkAccount(account.key, username)}
                      isPending={updatePlayer.isPending}
                      isOwnProfile={isOwnProfile}
                    />
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

          {/* Account Settings */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-2"
          >
            <Card variant="gaming">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Edit2 className="h-5 w-5 text-primary" />
                  Account Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="platform-username">Platform Username</Label>
                  <div className="flex gap-2">
                    <Input
                      id="platform-username"
                      placeholder="Your platform username"
                      value={platformUsername}
                      onChange={(e) => setPlatformUsername(e.target.value)}
                      className="bg-muted/50 max-w-xs"
                      disabled={!isEditingUsername && !!player?.username}
                    />
                    {player?.username && !isEditingUsername ? (
                      <Button 
                        variant="outline" 
                        onClick={() => setIsEditingUsername(true)}
                      >
                        <Edit2 className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                    ) : (
                      <Button 
                        variant="neon" 
                        disabled={!platformUsername.trim() || updatePlayer.isPending}
                        onClick={handleUpdateUsername}
                      >
                        {updatePlayer.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Save className="h-4 w-4 mr-2" />
                            Save
                          </>
                        )}
                      </Button>
                    )}
                    {isEditingUsername && (
                      <Button 
                        variant="ghost" 
                        onClick={() => {
                          setIsEditingUsername(false);
                          setPlatformUsername(player?.username || '');
                        }}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    3-20 characters. Letters, numbers, and underscores only.
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>

        </div>
      </div>
    </div>
  );
}
