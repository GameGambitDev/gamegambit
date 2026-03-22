import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Save, Info, Send } from 'lucide-react';
import { Wager } from '@/hooks/useWagers';
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

const STAKE_PRESETS = [0.01, 0.05, 0.1, 0.25, 0.5, 1];

export function EditWagerModal({
  wager,
  open,
  onOpenChange,
  onSave,
  isSaving,
  canEditGameId = true,
}: EditWagerModalProps) {
  const [stakeAmount, setStakeAmount] = useState('');
  const [lichessGameId, setLichessGameId] = useState('');
  const [streamUrl, setStreamUrl] = useState('');
  const [isPublic, setIsPublic] = useState(true);

  const isJoined = wager?.status === 'joined';

  useEffect(() => {
    if (wager) {
      setStakeAmount((wager.stake_lamports / LAMPORTS_PER_SOL).toFixed(4));
      setLichessGameId(wager.lichess_game_id || '');
      setStreamUrl(wager.stream_url || '');
      setIsPublic(wager.is_public ?? true);
    }
  }, [wager]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updates: EditWagerData = {};

    const newStakeLamports = Math.floor(parseFloat(stakeAmount) * LAMPORTS_PER_SOL);
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

  // Parse lichess game ID from a full URL or raw ID input
  const handleLichessInput = (value: string) => {
    const match = value.match(/lichess\.org\/([a-zA-Z0-9]{8})/);
    if (match) {
      setLichessGameId(match[1]);
    } else {
      setLichessGameId(value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8));
    }
  };

  if (!wager) return null;

  const game = GAMES[wager.game.toUpperCase() as keyof typeof GAMES];
  const currentStakeLamports = Math.floor(parseFloat(stakeAmount || '0') * LAMPORTS_PER_SOL);
  const stakeChanged = canEditGameId && currentStakeLamports !== wager.stake_lamports;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-primary/30 bg-card max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="text-3xl">{game?.icon || '🎮'}</div>
            <div>
              <DialogTitle className="text-xl font-gaming">Edit Wager</DialogTitle>
              {isJoined && (
                <p className="text-xs text-amber-400 mt-0.5">Changes require opponent approval</p>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Joined warning banner */}
        {isJoined && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <Info className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-300">
              Your opponent is already in the ready room. Changes are sent as proposals —
              your opponent must accept each one. Both players' ready status will reset.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5 mt-2">
          {/* Stake Amount — only editable for 'created' wagers */}
          {canEditGameId && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="stake">Stake Amount (SOL)</Label>
                <span className="text-xs text-muted-foreground">
                  Current: {formatSol(wager.stake_lamports)} SOL
                </span>
              </div>
              <Input
                id="stake"
                type="number"
                step="0.001"
                min="0.01"
                value={stakeAmount}
                onChange={(e) => setStakeAmount(e.target.value)}
                className="bg-muted/50 border-border h-11 text-base"
              />
              {/* Quick-pick presets */}
              <div className="flex flex-wrap gap-1.5">
                {STAKE_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setStakeAmount(preset.toString())}
                    className={`px-2.5 py-1 rounded text-xs border transition-all ${parseFloat(stakeAmount) === preset
                      ? 'border-primary bg-primary/15 text-primary'
                      : 'border-border hover:border-primary/50 text-muted-foreground'
                      }`}
                  >
                    {preset} SOL
                  </button>
                ))}
              </div>
              {/* Stake change diff */}
              {stakeChanged && (
                <p className="text-xs text-amber-400">
                  {currentStakeLamports > wager.stake_lamports ? '↑' : '↓'}{' '}
                  {formatSol(wager.stake_lamports)} → {formatSol(currentStakeLamports)} SOL
                  {isJoined && ' · pending opponent approval'}
                </p>
              )}
            </div>
          )}

          {/* Lichess Game ID — chess only, 'created' status only */}
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
                  Link:{' '}
                  <a
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

          {/* Public toggle — 'created' status only */}
          {canEditGameId && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
              <div>
                <Label htmlFor="public">Public Wager</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Visible to all players in the arena
                </p>
              </div>
              <Switch id="public" checked={isPublic} onCheckedChange={setIsPublic} />
            </div>
          )}

          {/* Stream URL — always editable */}
          <div className="space-y-2">
            <Label htmlFor="stream">
              Stream URL{' '}
              <span className="text-muted-foreground text-xs">(optional)</span>
            </Label>
            <Input
              id="stream"
              type="url"
              value={streamUrl}
              onChange={(e) => setStreamUrl(e.target.value)}
              placeholder="https://twitch.tv/yourstream"
              className="bg-muted/50 border-border"
            />
          </div>

          {/* Locked-fields notice for joined wagers */}
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
            <Button type="submit" variant="neon" className="flex-1" disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : isJoined ? (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Proposal
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}