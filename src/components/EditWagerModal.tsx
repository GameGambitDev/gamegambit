import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save } from 'lucide-react';
import { Wager, GameType } from '@/hooks/useWagers';
import { GAMES, LAMPORTS_PER_SOL, formatSol } from '@/lib/constants';

interface EditWagerModalProps {
  wager: Wager | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updates: EditWagerData) => void;
  isSaving?: boolean;
  canEditGameId?: boolean; // Only for wagers in 'created' status
}

export interface EditWagerData {
  stake_lamports?: number;
  lichess_game_id?: string;
  stream_url?: string;
  is_public?: boolean;
}

export function EditWagerModal({ 
  wager, 
  open, 
  onOpenChange, 
  onSave,
  isSaving,
  canEditGameId = true
}: EditWagerModalProps) {
  const [stakeAmount, setStakeAmount] = useState('');
  const [lichessGameId, setLichessGameId] = useState('');
  const [streamUrl, setStreamUrl] = useState('');
  const [isPublic, setIsPublic] = useState(true);

  // Initialize form with wager data
  useEffect(() => {
    if (wager) {
      setStakeAmount((wager.stake_lamports / LAMPORTS_PER_SOL).toString());
      setLichessGameId(wager.lichess_game_id || '');
      setStreamUrl(wager.stream_url || '');
      setIsPublic(wager.is_public ?? true);
    }
  }, [wager]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const updates: EditWagerData = {};
    
    const newStakeLamports = parseFloat(stakeAmount) * LAMPORTS_PER_SOL;
    if (canEditGameId && newStakeLamports !== wager?.stake_lamports) {
      updates.stake_lamports = newStakeLamports;
    }
    
    if (canEditGameId && lichessGameId !== (wager?.lichess_game_id || '')) {
      updates.lichess_game_id = lichessGameId || undefined;
    }
    
    if (streamUrl !== (wager?.stream_url || '')) {
      updates.stream_url = streamUrl || undefined;
    }
    
    if (canEditGameId && isPublic !== wager?.is_public) {
      updates.is_public = isPublic;
    }
    
    onSave(updates);
  };

  // Parse lichess game ID from URL
  const handleLichessInput = (value: string) => {
    const lichessRegex = /lichess\.org\/([a-zA-Z0-9]{8})/;
    const match = value.match(lichessRegex);
    if (match) {
      setLichessGameId(match[1]);
    } else {
      setLichessGameId(value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8));
    }
  };

  if (!wager) return null;

  const game = GAMES[wager.game.toUpperCase() as keyof typeof GAMES];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-primary/30 bg-card max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="text-3xl">{game?.icon || '🎮'}</div>
            <DialogTitle className="text-xl font-gaming">Edit Wager</DialogTitle>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          {/* Stake Amount - Only editable for created wagers */}
          {canEditGameId && (
            <div className="space-y-2">
              <Label htmlFor="stake">Stake Amount (SOL)</Label>
              <Input
                id="stake"
                type="number"
                step="0.01"
                min="0.01"
                value={stakeAmount}
                onChange={(e) => setStakeAmount(e.target.value)}
                placeholder="0.1"
                className="bg-muted/50 border-border"
              />
              <p className="text-xs text-muted-foreground">
                Current: {formatSol(wager.stake_lamports)} SOL
              </p>
            </div>
          )}

          {/* Lichess Game ID - Only editable for created wagers */}
          {wager.game === 'chess' && canEditGameId && (
            <div className="space-y-2">
              <Label htmlFor="lichessId">Lichess Game ID</Label>
              <Input
                id="lichessId"
                value={lichessGameId}
                onChange={(e) => handleLichessInput(e.target.value)}
                placeholder="AbCdEfGh or paste lichess.org/AbCdEfGh"
                className="bg-muted/50 border-border"
              />
              {lichessGameId && (
                <p className="text-xs text-muted-foreground">
                  Link: <a 
                    href={`https://lichess.org/${lichessGameId}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    lichess.org/{lichessGameId}
                  </a>
                </p>
              )}
            </div>
          )}

          {/* Stream URL - Always editable */}
          <div className="space-y-2">
            <Label htmlFor="stream">Stream URL (optional)</Label>
            <Input
              id="stream"
              type="url"
              value={streamUrl}
              onChange={(e) => setStreamUrl(e.target.value)}
              placeholder="https://twitch.tv/yourstream"
              className="bg-muted/50 border-border"
            />
          </div>

          {/* Public Toggle - Only editable for created wagers */}
          {canEditGameId && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
              <div>
                <Label htmlFor="public">Public Wager</Label>
                <p className="text-xs text-muted-foreground">
                  Visible to all players in the arena
                </p>
              </div>
              <Switch
                id="public"
                checked={isPublic}
                onCheckedChange={setIsPublic}
              />
            </div>
          )}

          {/* Info for joined wagers */}
          {!canEditGameId && (
            <div className="p-3 rounded-lg bg-muted/30 border border-border">
              <p className="text-sm text-muted-foreground">
                Stake amount, game ID, and visibility cannot be changed after an opponent has joined.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button 
              type="button" 
              variant="outline" 
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              variant="neon" 
              className="flex-1"
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}