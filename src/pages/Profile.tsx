import { useState } from 'react';
import { motion } from 'framer-motion';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { User, Trophy, Swords, Clock, ExternalLink, CheckCircle, Link2, Copy, Check } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/landing/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GAMES, truncateAddress } from '@/lib/constants';
import { toast } from '@/hooks/use-toast';

export default function Profile() {
  const { connected, publicKey } = useWallet();
  const [lichessUsername, setLichessUsername] = useState('');
  const [activisionId, setActivisionId] = useState('');
  const [pubgName, setPubgName] = useState('');
  const [copiedAddress, setCopiedAddress] = useState(false);

  const linkedAccounts = [
    { game: GAMES.CHESS, linked: true, username: 'chessmaster2024' },
    { game: GAMES.CODM, linked: false, username: null },
    { game: GAMES.PUBG, linked: false, username: null },
  ];

  const copyAddress = () => {
    if (publicKey) {
      navigator.clipboard.writeText(publicKey.toBase58());
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2000);
      toast({ title: 'Address copied!' });
    }
  };

  if (!connected) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-24 pb-16">
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
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-24 pb-16">
        <div className="container px-4 max-w-4xl">
          {/* Profile Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <Card variant="gaming" className="p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center border border-primary/30">
                  <User className="h-10 w-10 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-2xl font-bold font-gaming">
                      {publicKey && truncateAddress(publicKey.toBase58(), 6)}
                    </h1>
                    <Button variant="ghost" size="icon" onClick={copyAddress}>
                      {copiedAddress ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Trophy className="h-4 w-4 text-accent" />
                      47 Wins
                    </span>
                    <span className="flex items-center gap-1">
                      <Swords className="h-4 w-4" />
                      68% Win Rate
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      Joined Nov 2024
                    </span>
                  </div>
                </div>
                <Badge variant="gold" className="text-base px-4 py-2">
                  +12.5 SOL
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
                  {linkedAccounts.map((account) => (
                    <div
                      key={account.game.id}
                      className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border/50"
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
                        <Button variant="outline" size="sm">
                          Link Account
                        </Button>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
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
                      { label: 'Total Matches', value: '69' },
                      { label: 'Wins', value: '47' },
                      { label: 'Losses', value: '22' },
                      { label: 'Win Rate', value: '68%' },
                      { label: 'Total Wagered', value: '45.2 SOL' },
                      { label: 'Total Earned', value: '57.7 SOL' },
                      { label: 'Best Streak', value: '8 wins' },
                      { label: 'Favorite Game', value: '♟️ Chess' },
                    ].map((stat) => (
                      <div key={stat.label} className="p-3 rounded-lg bg-muted/30">
                        <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                          {stat.label}
                        </div>
                        <div className="font-gaming text-lg">{stat.value}</div>
                      </div>
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
                  <CardTitle>Link a New Account</CardTitle>
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
                        <Button variant="outline" disabled={!lichessUsername}>
                          Verify
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="codm">Call of Duty Username</Label>
                      <div className="flex gap-2">
                        <Input
                          id="codm"
                          placeholder="Your CODM username"
                          value={activisionId}
                          onChange={(e) => setActivisionId(e.target.value)}
                          className="bg-muted/50"
                        />
                        <Button variant="outline" disabled={!activisionId}>
                          Link
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
                        <Button variant="outline" disabled={!pubgName}>
                          Link
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
