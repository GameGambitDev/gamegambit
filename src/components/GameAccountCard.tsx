import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Edit2, ExternalLink, Loader2, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useLichessUser } from '@/hooks/useLichess';

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

export function GameAccountCard({
  game,
  linkedUsername,
  onLink,
  isPending = false,
  isOwnProfile = true,
}: GameAccountCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [error, setError] = useState('');

  // Verify Lichess username exists
  const { data: lichessUser, isLoading: verifying } = useLichessUser(
    game.id === 'chess' && isEditing && newUsername.length >= 2 ? newUsername : undefined
  );

  const isLichess = game.id === 'chess';
  const isVerified = isLichess && lichessUser && lichessUser.username.toLowerCase() === newUsername.toLowerCase();
  const showNotFound = isLichess && newUsername.length >= 2 && !verifying && !lichessUser && newUsername !== '';

  const handleSubmit = async () => {
    if (!newUsername.trim()) {
      setError('Username is required');
      return;
    }
    if (isLichess && !isVerified) {
      setError('Please enter a valid Lichess username');
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

  const handleCancel = () => {
    setIsEditing(false);
    setNewUsername('');
    setError('');
  };

  const getExternalLink = () => {
    if (!linkedUsername) return null;
    switch (game.id) {
      case 'chess':
        return `https://lichess.org/@/${linkedUsername}`;
      default:
        return null;
    }
  };

  const externalLink = getExternalLink();

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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                  >
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
                    {verifying && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                    {isVerified && <CheckCircle className="h-4 w-4 text-success" />}
                    {showNotFound && <AlertCircle className="h-4 w-4 text-destructive" />}
                  </div>
                </div>

                {isLichess && isVerified && lichessUser && (
                  <div className="p-2 rounded bg-success/10 border border-success/20 text-xs">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-3 w-3 text-success" />
                      <span className="text-success font-medium">
                        Found: {lichessUser.username}
                      </span>
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
                  <div className="p-2 rounded bg-destructive/10 border border-destructive/20 text-xs text-destructive">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-3 w-3" />
                      <span>User not found on Lichess</span>
                    </div>
                  </div>
                )}

                {error && !showNotFound && (
                  <p className="text-xs text-destructive">{error}</p>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="neon"
                    size="sm"
                    onClick={handleSubmit}
                    disabled={isPending || (isLichess && !isVerified)}
                    className="flex-1"
                  >
                    {isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Save'
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCancel}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}