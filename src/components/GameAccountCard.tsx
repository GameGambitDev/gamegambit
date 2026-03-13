import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Edit2, ExternalLink, Loader2, X, AlertCircle, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useLichessUser } from '@/hooks/useLichess';
import { useWallet } from '@solana/wallet-adapter-react';

interface GameAccountCardProps {
  game: {
    id: string;
    name: string;
    icon: string;
    platform: string;
  };
  linkedUsername: string | null;
  onLink: (username: string) => Promise<void>;
  onUnlink?: () => Promise<void>;
  isPending?: boolean;
  isOwnProfile?: boolean;
}

type VerificationStep = 'input' | 'verify' | 'done';

export function GameAccountCard({
  game,
  linkedUsername,
  onLink,
  isPending = false,
  isOwnProfile = true,
}: GameAccountCardProps) {
  const { publicKey } = useWallet();
  const [isEditing, setIsEditing] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [error, setError] = useState('');
  const [step, setStep] = useState<VerificationStep>('input');
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [copied, setCopied] = useState(false);

  const isLichess = game.id === 'chess';

  // Verification code tied to wallet
  const verificationCode = publicKey
    ? `GG-${publicKey.toBase58().slice(0, 8).toUpperCase()}`
    : 'GG-CONNECT-WALLET';

  // Check if username exists on Lichess (step 1 only)
  const { data: lichessUser, isLoading: checking } = useLichessUser(
    isLichess && step === 'input' && newUsername.length >= 2 ? newUsername : undefined
  );

  const usernameExists =
    isLichess &&
    lichessUser &&
    lichessUser.username.toLowerCase() === newUsername.toLowerCase();

  const showNotFound =
    isLichess &&
    newUsername.length >= 2 &&
    !checking &&
    !lichessUser &&
    newUsername !== '';

  const handleCopyCode = () => {
    navigator.clipboard.writeText(verificationCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleProceedToVerify = () => {
    if (!usernameExists) return;
    setStep('verify');
  };

  const handleVerifyBio = async () => {
    if (!newUsername.trim()) return;
    setVerifying(true);
    setError('');

    try {
      // Fetch Lichess user bio directly from API
      const res = await fetch(`https://lichess.org/api/user/${newUsername}`);
      if (!res.ok) throw new Error('User not found');
      const data = await res.json();

      const bio: string = data?.profile?.bio || '';
      if (!bio.includes(verificationCode)) {
        setError(
          `Code not found in bio. Make sure you added "${verificationCode}" to your Lichess bio at lichess.org/account/profile`
        );
        setVerifying(false);
        return;
      }

      // Verified — save
      setVerified(true);
      await onLink(newUsername.trim());
      setStep('done');
      setIsEditing(false);
      setNewUsername('');
      setStep('input');
      setVerified(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setNewUsername('');
    setError('');
    setStep('input');
    setVerified(false);
  };

  const getExternalLink = () => {
    if (!linkedUsername) return null;
    if (game.id === 'chess') return `https://lichess.org/@/${linkedUsername}`;
    return null;
  };

  const externalLink = getExternalLink();

  // For non-Lichess games: simple submit
  const handleSimpleSubmit = async () => {
    if (!newUsername.trim()) {
      setError('Username is required');
      return;
    }
    setError('');
    try {
      await onLink(newUsername.trim());
      setIsEditing(false);
      setNewUsername('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to link account');
    }
  };

  return (
    <motion.div
      layout
      className="relative overflow-hidden rounded-lg bg-muted/30 border border-border/50 transition-all hover:border-primary/30"
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-2xl flex-shrink-0">{game.icon}</span>
            <div className="min-w-0">
              <div className="font-medium truncate">{game.name}</div>
              <div className="text-sm text-muted-foreground">{game.platform}</div>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {linkedUsername && !isEditing ? (
              <motion.div
                key="linked"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex items-center gap-2 flex-shrink-0"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-success flex-shrink-0" />
                  {externalLink ? (
                    <a
                      href={externalLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-success hover:underline flex items-center gap-1"
                    >
                      {linkedUsername}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <span className="text-sm text-success">{linkedUsername}</span>
                  )}
                </div>
                {isOwnProfile && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      setIsEditing(true);
                      setNewUsername(linkedUsername);
                    }}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                )}
              </motion.div>
            ) : !isEditing ? (
              <motion.div
                key="not-linked"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
              >
                {isOwnProfile ? (
                  <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                    Link Account
                  </Button>
                ) : (
                  <Badge variant="outline">Not Linked</Badge>
                )}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        {/* Edit Mode */}
        <AnimatePresence>
          {isEditing && isOwnProfile && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 pt-4 border-t border-border/50"
            >
              {/* STEP 1: Enter username */}
              {step === 'input' && (
                <div className="space-y-3">
                  <div className="relative">
                    <Input
                      placeholder={`Enter your ${game.name} username`}
                      value={newUsername}
                      onChange={(e) => {
                        setNewUsername(e.target.value);
                        setError('');
                      }}
                      className="bg-background/50 pr-10"
                      autoFocus
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {checking && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                      {usernameExists && <CheckCircle className="h-4 w-4 text-success" />}
                      {showNotFound && <AlertCircle className="h-4 w-4 text-destructive" />}
                    </div>
                  </div>

                  {isLichess && usernameExists && lichessUser && (
                    <div className="p-2 rounded bg-success/10 border border-success/20 text-xs">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-3 w-3 text-success" />
                        <span className="text-success font-medium">Found: {lichessUser.username}</span>
                        {lichessUser.online && (
                          <Badge variant="live" className="text-[10px] px-1.5 py-0">Online</Badge>
                        )}
                      </div>
                      {lichessUser.perfs?.blitz && (
                        <div className="mt-1 text-muted-foreground">
                          Blitz: {lichessUser.perfs.blitz.rating} • {lichessUser.perfs.blitz.games} games
                        </div>
                      )}
                    </div>
                  )}

                  {showNotFound && (
                    <div className="p-2 rounded bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-center gap-2">
                      <AlertCircle className="h-3 w-3" />
                      <span>User not found on Lichess</span>
                    </div>
                  )}

                  {error && <p className="text-xs text-destructive">{error}</p>}

                  <div className="flex gap-2">
                    {isLichess ? (
                      <Button
                        variant="neon"
                        size="sm"
                        onClick={handleProceedToVerify}
                        disabled={!usernameExists}
                        className="flex-1"
                      >
                        Next: Verify Ownership →
                      </Button>
                    ) : (
                      <Button
                        variant="neon"
                        size="sm"
                        onClick={handleSimpleSubmit}
                        disabled={isPending || !newUsername.trim()}
                        className="flex-1"
                      >
                        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={handleCancel}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* STEP 2: Bio verification */}
              {step === 'verify' && (
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 space-y-2">
                    <p className="text-xs font-medium text-foreground">
                      Prove you own <span className="text-primary">{newUsername}</span>
                    </p>
                    <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                      <li>
                        Go to{' '}
                        <a
                          href="https://lichess.org/account/profile"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline"
                        >
                          lichess.org/account/profile
                        </a>
                      </li>
                      <li>Add this code anywhere in your bio:</li>
                    </ol>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="flex-1 text-xs bg-background/60 border border-border rounded px-3 py-2 font-mono text-primary">
                        {verificationCode}
                      </code>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCopyCode}>
                        {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      You can remove it after verification.
                    </p>
                  </div>

                  {error && (
                    <div className="p-2 rounded bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-center gap-2">
                      <AlertCircle className="h-3 w-3 flex-shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      variant="neon"
                      size="sm"
                      onClick={handleVerifyBio}
                      disabled={verifying}
                      className="flex-1"
                    >
                      {verifying ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Checking bio...
                        </>
                      ) : (
                        "I've added the code — Verify"
                      )}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setStep('input')}>
                      Back
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}