import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Zap, AlertCircle } from 'lucide-react';
import { GAMES } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { GameType } from '@/hooks/useWagers';

interface QuickMatchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Returns a promise — the arena page awaits it so it can open the ready room on success */
  onMatch: (game?: GameType) => Promise<void>;
  isPending: boolean;
}

const GAME_OPTIONS: { value: GameType | 'any'; label: string; icon: string }[] = [
  { value: 'any', label: 'Any Game', icon: '🎲' },
  { value: 'chess', label: GAMES.CHESS.name, icon: GAMES.CHESS.icon },
  { value: 'codm', label: GAMES.CODM.name, icon: GAMES.CODM.icon },
  { value: 'pubg', label: GAMES.PUBG.name, icon: GAMES.PUBG.icon },
];

export function QuickMatchModal({ open, onOpenChange, onMatch, isPending }: QuickMatchModalProps) {
  const [selectedGame, setSelectedGame] = useState<GameType | 'any'>('any');
  const [error, setError] = useState('');

  const handleMatch = async () => {
    setError('');
    try {
      await onMatch(selectedGame === 'any' ? undefined : selectedGame as GameType);
      // success: arena page closes this modal after routing to ready room
    } catch (err: any) {
      setError(err.message || 'No open wagers found. Try a different game or create one!');
    }
  };

  const handleOpenChange = (val: boolean) => {
    if (!isPending) {
      setError('');
      onOpenChange(val);
    }
  };

  const selectedLabel = GAME_OPTIONS.find(g => g.value === selectedGame)?.label;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md border-primary/30 bg-card">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/20">
              <Zap className="h-6 w-6 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl font-gaming">Quick Match</DialogTitle>
              <DialogDescription>
                Jump into a random open wager instantly
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">Select Game Type</p>
            <div className="grid grid-cols-2 gap-2">
              {GAME_OPTIONS.map((game) => (
                <button
                  key={game.value}
                  type="button"
                  onClick={() => { setSelectedGame(game.value); setError(''); }}
                  disabled={isPending}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left',
                    selectedGame === game.value
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-background hover:border-primary/50',
                    isPending && 'opacity-50 cursor-not-allowed',
                  )}
                >
                  <span className="text-2xl">{game.icon}</span>
                  <span className="text-sm font-medium">{game.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 rounded-lg bg-muted/30 border border-border text-sm text-muted-foreground">
            Quick Match finds a random open wager
            {selectedGame !== 'any' ? ` for ${selectedLabel}` : ''}{' '}
            and automatically joins it. You'll be taken straight to the ready room.
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Button
            variant="neon"
            className="w-full h-12 text-lg font-gaming"
            onClick={handleMatch}
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Finding Match...
              </>
            ) : (
              <>
                <Zap className="h-5 w-5 mr-2" />
                Find Match
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}