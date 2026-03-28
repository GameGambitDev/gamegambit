import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Loader2, AlertCircle, Swords, Search, User, X,
  Users, UserPlus, Lock, CheckCircle2,
} from 'lucide-react';
import { useCreateWager, GameType } from '@/hooks/useWagers';
import { useWalletBalance } from '@/hooks/useWalletBalance';
import { useSearchPlayers, Player, usePlayer } from '@/hooks/usePlayer';
import { startLichessOAuth } from '@/hooks/useLichess';
import { GAMES, formatSol, truncateAddress } from '@/lib/constants';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useWallet } from '@solana/wallet-adapter-react';

interface CreateWagerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const GAME_OPTIONS: { value: GameType; label: string; icon: string; live: boolean }[] = [
  { value: 'chess', label: GAMES.CHESS.name, icon: GAMES.CHESS.icon, live: GAMES.CHESS.live },
  { value: 'pubg', label: GAMES.PUBG.name, icon: GAMES.PUBG.icon, live: GAMES.PUBG.live },
  { value: 'codm', label: GAMES.CODM.name, icon: GAMES.CODM.icon, live: GAMES.CODM.live },
  { value: 'free_fire', label: GAMES.FREE_FIRE.name, icon: GAMES.FREE_FIRE.icon, live: GAMES.FREE_FIRE.live },
];

const STAKE_PRESETS = [0.01, 0.05, 0.1, 0.25, 0.5, 1];

export type TimeControlCategory = 'Bullet' | 'Blitz' | 'Rapid' | 'Classical';

export interface TimeControl {
  label: string;
  limit: number;       // seconds
  increment: number;   // seconds
  category: TimeControlCategory;
  description: string;
}

export const TIME_CONTROLS: TimeControl[] = [
  // Bullet
  { label: '1+0', limit: 60, increment: 0, category: 'Bullet', description: 'Ultra-fast, 1 min each' },
  { label: '2+1', limit: 120, increment: 1, category: 'Bullet', description: '2 min + 1 sec/move' },
  { label: '3+0', limit: 180, increment: 0, category: 'Bullet', description: '3 min each, no increment' },
  // Blitz
  { label: '3+2', limit: 180, increment: 2, category: 'Blitz', description: '3 min + 2 sec/move' },
  { label: '5+0', limit: 300, increment: 0, category: 'Blitz', description: '5 min each, no increment' },
  { label: '5+3', limit: 300, increment: 3, category: 'Blitz', description: '5 min + 3 sec/move' },
  // Rapid
  { label: '10+0', limit: 600, increment: 0, category: 'Rapid', description: '10 min each — popular choice' },
  { label: '15+10', limit: 900, increment: 10, category: 'Rapid', description: '15 min + 10 sec/move' },
  { label: '20+0', limit: 1200, increment: 0, category: 'Rapid', description: '20 min each' },
  { label: '25+0', limit: 1500, increment: 0, category: 'Rapid', description: '25 min each' },
  { label: '30+0', limit: 1800, increment: 0, category: 'Rapid', description: '30 min each' },
  // Classical
  { label: '45+45', limit: 2700, increment: 45, category: 'Classical', description: '45 min + 45 sec/move' },
  { label: '60+0', limit: 3600, increment: 0, category: 'Classical', description: '1 hour each — ⚠ long game' },
  { label: '90+30', limit: 5400, increment: 30, category: 'Classical', description: '90 min + 30 sec/move — ⚠ 2–4 hrs' },
];

const CATEGORY_STYLES: Record<TimeControlCategory, { dot: string; label: string; border: string; activeBg: string; activeText: string }> = {
  Bullet: { dot: 'bg-red-500', label: 'text-red-400', border: 'border-red-500/40', activeBg: 'bg-red-500/20', activeText: 'text-red-400' },
  Blitz: { dot: 'bg-orange-400', label: 'text-orange-400', border: 'border-orange-400/40', activeBg: 'bg-orange-400/20', activeText: 'text-orange-400' },
  Rapid: { dot: 'bg-green-500', label: 'text-green-400', border: 'border-green-500/40', activeBg: 'bg-green-500/20', activeText: 'text-green-400' },
  Classical: { dot: 'bg-blue-500', label: 'text-blue-400', border: 'border-blue-500/40', activeBg: 'bg-blue-500/20', activeText: 'text-blue-400' },
};

const CATEGORIES: TimeControlCategory[] = ['Bullet', 'Blitz', 'Rapid', 'Classical'];

export type SidePreference = 'random' | 'white' | 'black';

type WagerMode = 'open' | 'challenge';

export function CreateWagerModal({ open, onOpenChange, onSuccess }: CreateWagerModalProps) {
  const { publicKey } = useWallet();
  const [wagerMode, setWagerMode] = useState<WagerMode>('open');
  const [selectedGame, setSelectedGame] = useState<GameType>('chess');
  const [stakeAmount, setStakeAmount] = useState('0.1');
  const [streamUrl, setStreamUrl] = useState('');
  const [error, setError] = useState('');
  const [opponentSearch, setOpponentSearch] = useState('');
  const [selectedOpponent, setSelectedOpponent] = useState<Player | null>(null);
  const [selectedTimeControl, setSelectedTimeControl] = useState<TimeControl>(TIME_CONTROLS[6]);
  const [isRated, setIsRated] = useState(false);
  const [isConnectingLichess, setIsConnectingLichess] = useState(false);
  const [sidePreference, setSidePreference] = useState<SidePreference>('random');

  const createWager = useCreateWager();
  const { data: balance } = useWalletBalance();
  const { data: player, isLoading: lichessLoading } = usePlayer();
  const { data: searchResults, isLoading: searchLoading } = useSearchPlayers(opponentSearch);

  const stakeLamports = Math.floor(parseFloat(stakeAmount || '0') * 1_000_000_000);
  const balanceLamports = (balance || 0) * 1_000_000_000;
  const isChess = selectedGame === 'chess';
  const isLichessConnected = !!(player as any)?.lichess_username;
  const lichessUsername = (player as any)?.lichess_username;

  // For chess: check if opponent has Lichess connected when in challenge mode
  const opponentHasLichess = !!(selectedOpponent as any)?.lichess_username;

  // Chess wager can proceed if:
  // - Player has Lichess connected AND
  // - Either open wager (anyone can accept, we require them to have Lichess too) OR challenge opponent has Lichess
  const chessCanProceed = !isChess || (isLichessConnected && (wagerMode === 'open' || opponentHasLichess));

  const handleConnectLichess = async () => {
    if (!publicKey) {
      toast.error('Connect your wallet first');
      return;
    }
    setIsConnectingLichess(true);
    try {
      await startLichessOAuth(publicKey.toBase58());
      // Page will redirect — no need to reset state
    } catch (err) {
      setIsConnectingLichess(false);
      toast.error('Failed to start Lichess authentication');
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
    if (isChess && !isLichessConnected) {
      setError('Connect your Lichess account to create chess wagers');
      return;
    }
    if (isChess && wagerMode === 'challenge' && !opponentHasLichess) {
      setError('Your opponent must also connect their Lichess account to play chess');
      return;
    }

    try {
      await createWager.mutateAsync({
        game: selectedGame,
        stake_lamports: stakeLamports,
        // No lichess_game_id — server creates the game automatically when both
        // players deposit (via LICHESS_PLATFORM_TOKEN in secure-wager)
        stream_url: streamUrl || undefined,
        is_public: wagerMode === 'open',
        // Pass time control preferences so secure-wager can create the right game
        ...(isChess && {
          chess_clock_limit: selectedTimeControl.limit,
          chess_clock_increment: selectedTimeControl.increment,
          chess_rated: isRated,
          chess_side_preference: sidePreference,
        }),
      });
      toast.success(
        wagerMode === 'challenge' && selectedOpponent
          ? `Challenge sent to ${selectedOpponent.username || truncateAddress(selectedOpponent.wallet_address)}!`
          : 'Wager created! Waiting for an opponent...'
      );
      onOpenChange(false);
      onSuccess?.();
      // Reset
      setWagerMode('open');
      setStakeAmount('0.1');
      setStreamUrl('');
      setSelectedOpponent(null);
      setOpponentSearch('');
      setSelectedTimeControl(TIME_CONTROLS[6]);
      setIsRated(false);
      setSidePreference('random');
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

          {/* ── Chess: Lichess status + time control ─────────────────────── */}
          {isChess && (
            <div className="space-y-3">
              {/* Lichess connection status */}
              {lichessLoading ? (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Checking Lichess…
                </div>
              ) : isLichessConnected ? (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-success/10 border border-success/20">
                  <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-success">Lichess verified ✓</p>
                    <p className="text-xs text-muted-foreground">Playing as @{lichessUsername}</p>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-warning/10 border border-warning/20 space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-warning">Lichess account required</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Connect your Lichess account to play chess wagers. This verifies your identity and lets us create games automatically.
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full border-warning/40 hover:border-warning"
                    onClick={handleConnectLichess}
                    disabled={isConnectingLichess}
                  >
                    {isConnectingLichess
                      ? <><Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> Connecting…</>
                      : '♟ Connect Lichess Account'
                    }
                  </Button>
                  <p className="text-[11px] text-muted-foreground text-center">
                    No Lichess account?{' '}
                    <a href="https://lichess.org/signup" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                      Create one free
                    </a>
                  </p>
                </div>
              )}

              {/* Time controls — grouped by category */}
              {isLichessConnected && (
                <div className="space-y-3 p-3 rounded-lg border border-border bg-muted/10">
                  {/* Header row: label + rated toggle */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-medium text-muted-foreground">Time Control</p>
                      {/* Active selection badge */}
                      <span className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border",
                        CATEGORY_STYLES[selectedTimeControl.category].border,
                        CATEGORY_STYLES[selectedTimeControl.category].activeBg,
                        CATEGORY_STYLES[selectedTimeControl.category].activeText,
                      )}>
                        <span className={cn("w-1.5 h-1.5 rounded-full", CATEGORY_STYLES[selectedTimeControl.category].dot)} />
                        {selectedTimeControl.label} · {selectedTimeControl.category}
                      </span>
                    </div>
                    {/* Rated toggle */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsRated(!isRated)}
                        className={cn(
                          "w-8 h-4 rounded-full transition-colors relative flex-shrink-0",
                          isRated ? "bg-primary" : "bg-muted"
                        )}
                      >
                        <span className={cn(
                          "absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all",
                          isRated ? "left-4" : "left-0.5"
                        )} />
                      </button>
                      <span className="text-xs text-muted-foreground">Rated</span>
                    </div>
                  </div>

                  {/* Grouped time control buttons */}
                  <div className="space-y-2.5">
                    {CATEGORIES.map((cat) => {
                      const style = CATEGORY_STYLES[cat];
                      const options = TIME_CONTROLS.filter(tc => tc.category === cat);
                      return (
                        <div key={cat}>
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className={cn("w-2 h-2 rounded-full flex-shrink-0", style.dot)} />
                            <span className={cn("text-[11px] font-semibold uppercase tracking-wide", style.label)}>
                              {cat}
                            </span>
                            {cat === 'Classical' && (
                              <span className="text-[10px] text-muted-foreground ml-1">⚠ Long games</span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {options.map((tc) => {
                              const isSelected = selectedTimeControl.label === tc.label && selectedTimeControl.category === tc.category;
                              return (
                                <button
                                  key={`${tc.category}-${tc.label}`}
                                  type="button"
                                  title={tc.description}
                                  onClick={() => setSelectedTimeControl(tc)}
                                  className={cn(
                                    "px-2.5 py-1 rounded text-xs border transition-all",
                                    isSelected
                                      ? cn("font-semibold", style.border, style.activeBg, style.activeText)
                                      : "border-border hover:border-primary/50 text-muted-foreground hover:text-foreground"
                                  )}
                                >
                                  {tc.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <p className="text-[11px] text-muted-foreground pt-1 border-t border-border/50">
                    {selectedTimeControl.description} · Game created automatically when both players deposit.
                  </p>
                </div>
              )}

              {/* Side Preference — always visible for chess */}
              {isLichessConnected && (
                <div className="p-3 rounded-lg border border-border bg-muted/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground">Your Side</p>
                    {sidePreference !== 'random' && (
                      <span className="text-[10px] text-primary">
                        You play {sidePreference} · opponent sees this
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['random', 'white', 'black'] as SidePreference[]).map((side) => (
                      <button
                        key={side}
                        type="button"
                        onClick={() => setSidePreference(side)}
                        className={cn(
                          "flex flex-col items-center gap-1 py-2 px-1 rounded-lg border-2 text-xs font-medium transition-all",
                          sidePreference === side
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-background hover:border-primary/50 text-muted-foreground"
                        )}
                      >
                        <span className="text-base">
                          {side === 'random' ? '🎲' : side === 'white' ? '♔' : '♚'}
                        </span>
                        <span className="capitalize text-[11px]">{side}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

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
                      {(selectedOpponent as any).lichess_username ? (
                        <p className="text-xs text-success">♟ @{(selectedOpponent as any).lichess_username} ✓</p>
                      ) : isChess ? (
                        <p className="text-xs text-warning">⚠ No Lichess account linked</p>
                      ) : null}
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
                              {(p as any).lichess_username && (
                                <p className="text-xs text-success">♟ @{(p as any).lichess_username}</p>
                              )}
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
            {isChess && isLichessConnected && (
              <>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-muted-foreground">Time Control</span>
                  <span className={cn("font-mono text-sm font-semibold", CATEGORY_STYLES[selectedTimeControl.category].activeText)}>
                    {selectedTimeControl.label} · {selectedTimeControl.category} {isRated ? '· Rated' : '· Casual'}
                  </span>
                </div>
                {sidePreference !== 'random' && (
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-muted-foreground">Your Side</span>
                    <span className="font-mono text-sm text-primary capitalize">
                      {sidePreference === 'white' ? '⬜ White' : '⬛ Black'}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>

          <Button
            type="submit"
            variant="neon"
            className="w-full h-12 text-lg font-gaming"
            disabled={
              createWager.isPending ||
              !stakeAmount ||
              (isChess && !isLichessConnected) ||
              (isChess && wagerMode === 'challenge' && !!selectedOpponent && !opponentHasLichess)
            }
          >
            {createWager.isPending ? (
              <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Creating Wager…</>
            ) : selectedOpponent ? 'Send Challenge' : 'Create Wager'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}