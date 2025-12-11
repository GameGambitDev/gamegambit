import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, AlertCircle, Swords, Search, User, X } from 'lucide-react';
import { useCreateWager, GameType } from '@/hooks/useWagers';
import { useWalletBalance } from '@/hooks/useWalletBalance';
import { useSearchPlayers, Player } from '@/hooks/usePlayer';
import { GAMES, formatSol, truncateAddress } from '@/lib/constants';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface CreateWagerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const GAME_OPTIONS: { value: GameType; label: string; icon: string }[] = [
  { value: 'chess', label: GAMES.CHESS.name, icon: GAMES.CHESS.icon },
  { value: 'codm', label: GAMES.CODM.name, icon: GAMES.CODM.icon },
  { value: 'pubg', label: GAMES.PUBG.name, icon: GAMES.PUBG.icon },
];

const STAKE_PRESETS = [0.01, 0.05, 0.1, 0.25, 0.5, 1];

export function CreateWagerModal({ open, onOpenChange }: CreateWagerModalProps) {
  const [selectedGame, setSelectedGame] = useState<GameType>('chess');
  const [stakeAmount, setStakeAmount] = useState('0.1');
  const [lichessGameId, setLichessGameId] = useState('');
  const [streamUrl, setStreamUrl] = useState('');
  const [error, setError] = useState('');
  const [opponentSearch, setOpponentSearch] = useState('');
  const [selectedOpponent, setSelectedOpponent] = useState<Player | null>(null);
  const [isPublic, setIsPublic] = useState(true);
  
  const createWager = useCreateWager();
  const { data: balance } = useWalletBalance();
  const { data: searchResults, isLoading: searchLoading } = useSearchPlayers(opponentSearch);

  const stakeLamports = Math.floor(parseFloat(stakeAmount || '0') * 1_000_000_000);
  const balanceLamports = (balance || 0) * 1_000_000_000;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!stakeAmount || parseFloat(stakeAmount) <= 0) {
      setError('Please enter a valid stake amount');
      return;
    }

    if (stakeLamports > balanceLamports) {
      setError('Insufficient balance');
      return;
    }

    if (stakeLamports < 10_000_000) { // Minimum 0.01 SOL
      setError('Minimum stake is 0.01 SOL');
      return;
    }

    try {
      await createWager.mutateAsync({
        game: selectedGame,
        stake_lamports: stakeLamports,
        lichess_game_id: selectedGame === 'chess' && lichessGameId ? lichessGameId : undefined,
        stream_url: streamUrl || undefined,
        is_public: isPublic && !selectedOpponent,
        // Note: Challenge specific player would require backend support
      });
      toast.success(selectedOpponent 
        ? `Challenge sent to ${selectedOpponent.username || truncateAddress(selectedOpponent.wallet_address)}!` 
        : 'Wager created! Waiting for an opponent...');
      onOpenChange(false);
      // Reset form
      setStakeAmount('0.1');
      setLichessGameId('');
      setStreamUrl('');
      setSelectedOpponent(null);
      setOpponentSearch('');
      setIsPublic(true);
    } catch (err: any) {
      setError(err.message || 'Failed to create wager');
    }
  };

  const handleSelectOpponent = (player: Player) => {
    setSelectedOpponent(player);
    setOpponentSearch('');
    setIsPublic(false);
  };

  const handleClearOpponent = () => {
    setSelectedOpponent(null);
    setIsPublic(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg border-primary/30 bg-card max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/20">
              <Swords className="h-6 w-6 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl font-gaming">Create Wager</DialogTitle>
              <DialogDescription>
                Challenge a specific player or wait for any challenger
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          {/* Game Selection */}
          <div className="space-y-2">
            <Label>Select Game</Label>
            <div className="grid grid-cols-3 gap-2">
              {GAME_OPTIONS.map((game) => (
                <button
                  key={game.value}
                  type="button"
                  onClick={() => setSelectedGame(game.value)}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all",
                    selectedGame === game.value
                      ? "border-primary bg-primary/10"
                      : "border-border bg-background hover:border-primary/50"
                  )}
                >
                  <span className="text-2xl">{game.icon}</span>
                  <span className="text-sm font-medium">{game.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Challenge Specific Player */}
          <div className="space-y-2">
            <Label>Challenge Player <span className="text-muted-foreground">(optional)</span></Label>
            {selectedOpponent ? (
              <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/30">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-primary/20">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{selectedOpponent.username || 'Anonymous'}</p>
                    <p className="text-xs text-muted-foreground">{truncateAddress(selectedOpponent.wallet_address)}</p>
                  </div>
                </div>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="icon"
                  onClick={handleClearOpponent}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by username or wallet..."
                  value={opponentSearch}
                  onChange={(e) => setOpponentSearch(e.target.value)}
                  className="pl-10 bg-background border-border"
                  disabled={createWager.isPending}
                />
                {opponentSearch.length >= 2 && (
                  <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {searchLoading ? (
                      <div className="p-3 text-center text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                      </div>
                    ) : searchResults && searchResults.length > 0 ? (
                      searchResults.map((player) => (
                        <button
                          key={player.id}
                          type="button"
                          onClick={() => handleSelectOpponent(player)}
                          className="w-full p-3 text-left hover:bg-primary/10 flex items-center gap-3 transition-colors"
                        >
                          <User className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{player.username || 'Anonymous'}</p>
                            <p className="text-xs text-muted-foreground">{truncateAddress(player.wallet_address)}</p>
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="p-3 text-center text-muted-foreground text-sm">
                        No players found
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Leave empty to create an open wager anyone can join
            </p>
          </div>

          {/* Stake Amount */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>Stake Amount (SOL)</Label>
              <span className="text-xs text-muted-foreground">
                Balance: {balance?.toFixed(4) || '0'} SOL
              </span>
            </div>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.1"
              value={stakeAmount}
              onChange={(e) => {
                setStakeAmount(e.target.value);
                setError('');
              }}
              className="bg-background border-border h-12 text-lg"
              disabled={createWager.isPending}
            />
            <div className="flex flex-wrap gap-2">
              {STAKE_PRESETS.map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setStakeAmount(preset.toString())}
                  className={cn(
                    "text-xs",
                    parseFloat(stakeAmount) === preset && "border-primary bg-primary/10"
                  )}
                >
                  {preset} SOL
                </Button>
              ))}
            </div>
          </div>

          {/* Lichess Game ID (only for chess) */}
          {selectedGame === 'chess' && (
            <div className="space-y-2">
              <Label htmlFor="lichessGameId">
                Lichess Game ID <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="lichessGameId"
                placeholder="e.g., AbCdEfGh"
                value={lichessGameId}
                onChange={(e) => setLichessGameId(e.target.value)}
                className="bg-background border-border"
                disabled={createWager.isPending}
              />
              <p className="text-xs text-muted-foreground">
                Get ID from your Lichess game URL: <span className="text-primary">lichess.org/</span><span className="text-primary font-medium">AbCdEfGh</span>
              </p>
            </div>
          )}

          {/* Stream URL */}
          <div className="space-y-2">
            <Label htmlFor="streamUrl">
              Stream URL <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="streamUrl"
              placeholder="https://twitch.tv/yourusername"
              value={streamUrl}
              onChange={(e) => setStreamUrl(e.target.value)}
              className="bg-background border-border"
              disabled={createWager.isPending}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive p-3 rounded-lg bg-destructive/10">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Summary */}
          <div className="p-4 rounded-lg bg-muted/30 border border-border">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Your Stake</span>
              <span className="font-gaming text-lg">{stakeAmount || '0'} SOL</span>
            </div>
            <div className="flex justify-between items-center mt-2">
              <span className="text-muted-foreground">Potential Winnings</span>
              <span className="font-gaming text-lg text-success">
                +{formatSol(stakeLamports)} SOL
              </span>
            </div>
            {selectedOpponent && (
              <div className="flex justify-between items-center mt-2">
                <span className="text-muted-foreground">Challenging</span>
                <span className="font-gaming text-primary">
                  {selectedOpponent.username || truncateAddress(selectedOpponent.wallet_address)}
                </span>
              </div>
            )}
          </div>
          
          <Button 
            type="submit" 
            variant="neon"
            className="w-full h-12 text-lg font-gaming" 
            disabled={createWager.isPending || !stakeAmount}
          >
            {createWager.isPending ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Creating Wager...
              </>
            ) : selectedOpponent ? (
              'Send Challenge'
            ) : (
              'Create Wager'
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}