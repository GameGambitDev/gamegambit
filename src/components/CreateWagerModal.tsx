import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Loader2, AlertCircle, Swords, Search, User, X,
  Users, UserPlus, Lock, ExternalLink, Zap, KeyRound,
} from 'lucide-react';
import { useCreateWager, GameType } from '@/hooks/useWagers';
import { useWalletBalance } from '@/hooks/useWalletBalance';
import { useSearchPlayers, Player, usePlayer } from '@/hooks/usePlayer';
import {
  useLichessToken, useSaveLichessToken, useCreateLichessChallenge,
  LICHESS_TOKEN_URL,
} from '@/hooks/useLichess';
import { GAMES, formatSol, truncateAddress } from '@/lib/constants';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface CreateWagerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const GAME_OPTIONS: { value: GameType; label: string; icon: string; live: boolean }[] = [
  { value: 'chess', label: GAMES.CHESS.name, icon: GAMES.CHESS.icon, live: GAMES.CHESS.live },
  { value: 'codm', label: GAMES.CODM.name, icon: GAMES.CODM.icon, live: GAMES.CODM.live },
  { value: 'pubg', label: GAMES.PUBG.name, icon: GAMES.PUBG.icon, live: GAMES.PUBG.live },
];

const STAKE_PRESETS = [0.01, 0.05, 0.1, 0.25, 0.5, 1];

type WagerMode = 'open' | 'challenge';

const TIME_CONTROLS = [
  { label: '1+0', limit: 60, increment: 0 },
  { label: '3+2', limit: 180, increment: 2 },
  { label: '5+3', limit: 300, increment: 3 },
  { label: '10+0', limit: 600, increment: 0 },
  { label: '15+10', limit: 900, increment: 10 },
  { label: '30+0', limit: 1800, increment: 0 },
];

export function CreateWagerModal({ open, onOpenChange, onSuccess }: CreateWagerModalProps) {
  const [wagerMode, setWagerMode] = useState<WagerMode>('open');
  const [selectedGame, setSelectedGame] = useState<GameType>('chess');
  const [stakeAmount, setStakeAmount] = useState('0.1');
  const [lichessGameId, setLichessGameId] = useState('');
  const [streamUrl, setStreamUrl] = useState('');
  const [error, setError] = useState('');
  const [opponentSearch, setOpponentSearch] = useState('');
  const [selectedOpponent, setSelectedOpponent] = useState<Player | null>(null);

  // Lichess token flow
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [selectedTimeControl, setSelectedTimeControl] = useState(TIME_CONTROLS[2]); // 5+3 default
  const [isRated, setIsRated] = useState(false);

  const createWager = useCreateWager();
  const { data: balance } = useWalletBalance();
  const { data: player } = usePlayer();
  const { data: lichessToken, isLoading: tokenLoading } = useLichessToken();
  const saveLichessToken = useSaveLichessToken();
  const createChallenge = useCreateLichessChallenge();
  const { data: searchResults, isLoading: searchLoading } = useSearchPlayers(opponentSearch);

  const stakeLamports = Math.floor(parseFloat(stakeAmount || '0') * 1_000_000_000);
  const balanceLamports = (balance || 0) * 1_000_000_000;
  const isChess = selectedGame === 'chess';
  const hasLichessToken = !!lichessToken;

  const handleLichessGameIdChange = (input: string) => {
    let gameId = input.trim();
    if (gameId.includes('lichess.org/')) {
      const match = gameId.match(/lichess\.org\/([a-zA-Z0-9]+)/);
      if (match) gameId = match[1];
    }
    setLichessGameId(gameId);
  };

  const handleSaveToken = async () => {
    if (!tokenInput.trim()) return;
    try {
      const account = await saveLichessToken.mutateAsync(tokenInput.trim());
      toast.success(`Lichess connected as @${account.username}!`);
      setShowTokenInput(false);
      setTokenInput('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to connect Lichess');
    }
  };

  const handleAutoCreateGame = async () => {
    if (!lichessToken) return;
    setError('');
    try {
      const opponentUsername = selectedOpponent?.lichess_username ?? null;
      const challenge = await createChallenge.mutateAsync({
        token: lichessToken,
        params: {
          opponentLichessUsername: opponentUsername,
          rated: isRated,
          clockLimit: selectedTimeControl.limit,
          clockIncrement: selectedTimeControl.increment,
          color: 'random',
        },
      });
      const gameId = challenge.id || challenge.url?.split('/').pop() || '';
      setLichessGameId(gameId);
      toast.success(`Game created! ID: ${gameId}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create Lichess game');
    }
  };

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
    if (stakeLamports < 10_000_000) {
      setError('Minimum stake is 0.01 SOL');
      return;
    }
    if (isChess && !lichessGameId) {
      setError('Please create or paste a Lichess game ID first');
      return;
    }

    try {
      await createWager.mutateAsync({
        game: selectedGame,
        stake_lamports: stakeLamports,
        lichess_game_id: isChess && lichessGameId ? lichessGameId : undefined,
        stream_url: streamUrl || undefined,
        is_public: wagerMode === 'open',
      });
      toast.success(
        wagerMode === 'challenge' && selectedOpponent
          ? `Challenge sent to ${selectedOpponent.username || truncateAddress(selectedOpponent.wallet_address)}!`
          : 'Wager created! Waiting for an opponent...'
      );
      onOpenChange(false);
      onSuccess?.();
      setWagerMode('open');
      setStakeAmount('0.1');
      setLichessGameId('');
      setStreamUrl('');
      setSelectedOpponent(null);
      setOpponentSearch('');
    } catch (err: any) {
      setError(err.message || 'Failed to create wager');
    }
  };

  const handleSelectOpponent = (p: Player) => {
    setSelectedOpponent(p);
    setOpponentSearch('');
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

        <form onSubmit={handleSubmit} className="space-y-5 mt-4">

          {/* ── Wager Mode ──────────────────────────────────────────────── */}
          <div className="space-y-2">
            <Label>Wager Type</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => { setWagerMode('open'); setSelectedOpponent(null); }}
                className={cn(
                  "flex items-center gap-3 p-4 rounded-lg border-2 transition-all",
                  wagerMode === 'open' ? "border-primary bg-primary/10" : "border-border bg-background hover:border-primary/50"
                )}
              >
                <Users className="h-5 w-5 text-primary" />
                <div className="text-left">
                  <p className="font-medium">Open Wager</p>
                  <p className="text-xs text-muted-foreground">Anyone can accept</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setWagerMode('challenge')}
                className={cn(
                  "flex items-center gap-3 p-4 rounded-lg border-2 transition-all",
                  wagerMode === 'challenge' ? "border-primary bg-primary/10" : "border-border bg-background hover:border-primary/50"
                )}
              >
                <UserPlus className="h-5 w-5 text-accent" />
                <div className="text-left">
                  <p className="font-medium">Challenge</p>
                  <p className="text-xs text-muted-foreground">Pick your opponent</p>
                </div>
              </button>
            </div>
          </div>

          {/* ── Game Selection ───────────────────────────────────────────── */}
          <div className="space-y-2">
            <Label>Select Game</Label>
            <div className="grid grid-cols-3 gap-2">
              {GAME_OPTIONS.map((game) => (
                <button
                  key={game.value}
                  type="button"
                  disabled={!game.live}
                  onClick={() => game.live && setSelectedGame(game.value)}
                  className={cn(
                    "relative flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all",
                    !game.live && "opacity-50 cursor-not-allowed",
                    game.live && selectedGame === game.value
                      ? "border-primary bg-primary/10"
                      : game.live
                        ? "border-border bg-background hover:border-primary/50"
                        : "border-border bg-background"
                  )}
                >
                  {!game.live && (
                    <div className="absolute top-1.5 right-1.5">
                      <Lock className="h-3 w-3 text-muted-foreground" />
                    </div>
                  )}
                  <span className={cn("text-2xl", !game.live && "grayscale")}>{game.icon}</span>
                  <span className="text-sm font-medium">{game.label}</span>
                  {!game.live && <span className="text-[10px] text-muted-foreground">Coming soon</span>}
                </button>
              ))}
            </div>
          </div>

          {/* ── Opponent Search (challenge mode) ─────────────────────────── */}
          {wagerMode === 'challenge' && (
            <div className="space-y-2">
              <Label>Select Opponent</Label>
              {selectedOpponent ? (
                <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/30">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-primary/20">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{selectedOpponent.username || 'Anonymous'}</p>
                      <p className="text-xs text-muted-foreground">{truncateAddress(selectedOpponent.wallet_address)}</p>
                      {(selectedOpponent as any).lichess_username && (
                        <p className="text-xs text-primary">♟ @{(selectedOpponent as any).lichess_username}</p>
                      )}
                    </div>
                  </div>
                  <Button type="button" variant="ghost" size="icon" onClick={() => setSelectedOpponent(null)}>
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
                        <div className="p-3 text-center"><Loader2 className="h-4 w-4 animate-spin mx-auto" /></div>
                      ) : searchResults && searchResults.length > 0 ? (
                        searchResults.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => handleSelectOpponent(p)}
                            className="w-full p-3 text-left hover:bg-primary/10 flex items-center gap-3 transition-colors"
                          >
                            <User className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="font-medium">{p.username || 'Anonymous'}</p>
                              <p className="text-xs text-muted-foreground">{truncateAddress(p.wallet_address)}</p>
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="p-3 text-center text-muted-foreground text-sm">No players found</div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Stake Amount ─────────────────────────────────────────────── */}
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
              onChange={(e) => { setStakeAmount(e.target.value); setError(''); }}
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
                  className={cn("text-xs", parseFloat(stakeAmount) === preset && "border-primary bg-primary/10")}
                >
                  {preset} SOL
                </Button>
              ))}
            </div>
          </div>

          {/* ── Chess: Lichess game section ──────────────────────────────── */}
          {isChess && (
            <div className="space-y-3">
              <Label>Lichess Game</Label>

              {tokenLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Checking Lichess connection…
                </div>
              ) : hasLichessToken ? (
                /* ── Connected: show auto-create UI ── */
                <div className="space-y-3 p-4 rounded-lg border border-primary/20 bg-primary/5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-success font-medium">
                      ♟ Connected as @{player?.lichess_username}
                    </span>
                  </div>

                  {/* Time control picker */}
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Time control</p>
                    <div className="flex flex-wrap gap-1.5">
                      {TIME_CONTROLS.map((tc) => (
                        <button
                          key={tc.label}
                          type="button"
                          onClick={() => setSelectedTimeControl(tc)}
                          className={cn(
                            "px-2.5 py-1 rounded text-xs border transition-all",
                            selectedTimeControl.label === tc.label
                              ? "border-primary bg-primary/20 text-primary"
                              : "border-border hover:border-primary/50"
                          )}
                        >
                          {tc.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Rated toggle */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsRated(!isRated)}
                      className={cn(
                        "w-9 h-5 rounded-full transition-colors relative",
                        isRated ? "bg-primary" : "bg-muted"
                      )}
                    >
                      <span className={cn(
                        "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all",
                        isRated ? "left-4" : "left-0.5"
                      )} />
                    </button>
                    <span className="text-xs text-muted-foreground">Rated game</span>
                  </div>

                  {/* Auto-create button */}
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full border-primary/40 hover:border-primary"
                    onClick={handleAutoCreateGame}
                    disabled={createChallenge.isPending}
                  >
                    {createChallenge.isPending ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating game…</>
                    ) : lichessGameId ? (
                      <><Zap className="h-4 w-4 mr-2 text-success" /> Game ready: {lichessGameId}</>
                    ) : (
                      <><Zap className="h-4 w-4 mr-2 text-primary" /> Create Lichess Game</>
                    )}
                  </Button>

                  {/* Manual override */}
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Or paste an existing game ID / URL</p>
                    <Input
                      placeholder="https://lichess.org/R31kll8h or R31kll8h"
                      value={lichessGameId}
                      onChange={(e) => handleLichessGameIdChange(e.target.value)}
                      className="bg-background border-border text-sm"
                      disabled={createWager.isPending}
                    />
                  </div>
                </div>
              ) : (
                /* ── Not connected: show connect gate ── */
                <div className="space-y-3 p-4 rounded-lg border border-warning/30 bg-warning/5">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-muted-foreground">
                      Connect your Lichess account to auto-create games directly from GameGambit.
                    </p>
                  </div>

                  {showTokenInput ? (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">
                        1.{' '}
                        <a
                          href={LICHESS_TOKEN_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline inline-flex items-center gap-1"
                        >
                          Generate your Lichess token <ExternalLink className="h-3 w-3" />
                        </a>
                        {' '}(opens Lichess, check <strong>challenge:write</strong>, click Create)
                      </p>
                      <p className="text-xs text-muted-foreground">2. Paste the token below:</p>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Paste your Lichess token here"
                          value={tokenInput}
                          onChange={(e) => setTokenInput(e.target.value)}
                          className="bg-background border-border text-sm font-mono"
                          type="password"
                        />
                        <Button
                          type="button"
                          variant="neon"
                          size="sm"
                          onClick={handleSaveToken}
                          disabled={saveLichessToken.isPending || !tokenInput.trim()}
                        >
                          {saveLichessToken.isPending
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : 'Connect'
                          }
                        </Button>
                      </div>
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => { setShowTokenInput(false); setTokenInput(''); }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="flex-1 border-primary/40"
                        onClick={() => setShowTokenInput(true)}
                      >
                        <KeyRound className="h-3.5 w-3.5 mr-1.5" />
                        Connect Lichess Account
                      </Button>
                      <a
                        href="https://lichess.org/signup"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-md border border-border hover:border-primary/50 transition-colors whitespace-nowrap"
                      >
                        No account? <ExternalLink className="h-3 w-3 ml-1" />
                      </a>
                    </div>
                  )}

                  {/* Still allow manual paste even without token */}
                  <div className="space-y-1 pt-2 border-t border-border">
                    <p className="text-xs text-muted-foreground">Or paste a game ID manually:</p>
                    <Input
                      placeholder="https://lichess.org/R31kll8h or R31kll8h"
                      value={lichessGameId}
                      onChange={(e) => handleLichessGameIdChange(e.target.value)}
                      className="bg-background border-border text-sm"
                      disabled={createWager.isPending}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Stream URL ───────────────────────────────────────────────── */}
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

          {/* ── Summary ──────────────────────────────────────────────────── */}
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
            {isChess && lichessGameId && (
              <div className="flex justify-between items-center mt-2">
                <span className="text-muted-foreground">Game ID</span>
                <a
                  href={`https://lichess.org/${lichessGameId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-primary text-sm flex items-center gap-1 hover:underline"
                >
                  {lichessGameId} <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </div>

          <Button
            type="submit"
            variant="neon"
            className="w-full h-12 text-lg font-gaming"
            disabled={createWager.isPending || !stakeAmount || (isChess && !lichessGameId)}
          >
            {createWager.isPending ? (
              <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Creating Wager…</>
            ) : selectedOpponent ? 'Send Challenge' : 'Create Wager'}
          </Button>

          {isChess && !lichessGameId && (
            <p className="text-xs text-center text-muted-foreground">
              A Lichess game ID is required for chess wagers
            </p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}