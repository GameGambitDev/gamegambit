'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy, Frown, Scale, Sparkles, ArrowRight, ExternalLink,
  LayoutDashboard, Swords, BarChart3, RefreshCw, Home, Loader2, Share2,
} from 'lucide-react';
import { formatSol, calculatePlatformFee, getFeeTierLabel } from '@/lib/constants';
import { PlayerLink } from '@/components/PlayerLink';
import { useRouter } from 'next/navigation';
import confetti from 'canvas-confetti';
import { WinShareCard } from '@/components/ShareCards';

interface GameResultModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: 'win' | 'lose' | 'draw';
  winnerWallet?: string | null;
  winnerUsername?: string | null;
  totalPot: number;
  platformFee: number;
  winnerPayout?: number;
  refundAmount?: number;
  explorerUrl?: string | null;
  onViewDetails?: () => void;
  /** Called when the player taps Rematch — creates a new wager + notifies opponent */
  onRematch?: () => Promise<void>;
  isRematchPending?: boolean;
  // Share card props (wins only)
  game?: string | null;
  opponentWallet?: string | null;
  opponentUsername?: string | null;
  inviteCode?: string | null;
}

// ─── Animated counter ──────────────────────────────────────────────────────────

function AnimatedCounter({
  from, to, duration = 2000, prefix = '', suffix = '', className = '',
}: {
  from: number; to: number; duration?: number;
  prefix?: string; suffix?: string; className?: string;
}) {
  const [current, setCurrent] = useState(from);
  const startTime = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    startTime.current = null;
    const animate = (timestamp: number) => {
      if (startTime.current === null) startTime.current = timestamp;
      const elapsed = timestamp - startTime.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setCurrent(from + (to - from) * eased);
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [from, to, duration]);

  const display = (current / 1e9).toFixed(4);
  return <span className={className}>{prefix}{display}{suffix}</span>;
}

// ─── Victory Content ───────────────────────────────────────────────────────────

function VictoryContent({
  totalPot, platformFee, winnerPayout, explorerUrl,
  onClose, onViewDetails, onRematch, isRematchPending,
  game, opponentUsername, winnerUsername, inviteCode,
}: {
  totalPot: number; platformFee: number; winnerPayout?: number;
  explorerUrl?: string | null;
  onClose: () => void; onViewDetails?: () => void;
  onRematch?: () => Promise<void>; isRematchPending?: boolean;
  game?: string | null;
  opponentUsername?: string | null;
  winnerUsername?: string | null;
  inviteCode?: string | null;
}) {
  const router = useRouter();
  const _platformFee = calculatePlatformFee(totalPot / 2);
  const payout = winnerPayout || (totalPot - _platformFee);
  const [claimed, setClaimed] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    const duration = 5000;
    const animEnd = Date.now() + duration;
    const colors = ['#FFD700', '#FFA500', '#FF6B6B', '#4ECDC4', '#9945FF', '#14F195'];
    const defaults = { startVelocity: 35, spread: 360, ticks: 80, zIndex: 9999 };
    const rand = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval = setInterval(() => {
      const timeLeft = animEnd - Date.now();
      if (timeLeft <= 0) { clearInterval(interval); return; }
      const count = 80 * (timeLeft / duration);
      confetti({ ...defaults, particleCount: count, origin: { x: rand(0.1, 0.3), y: Math.random() - 0.2 }, colors });
      confetti({ ...defaults, particleCount: count, origin: { x: rand(0.7, 0.9), y: Math.random() - 0.2 }, colors });
    }, 200);

    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 15 }}
      className="text-center py-4"
    >
      {/* Trophy */}
      <motion.div
        initial={{ y: -50, rotate: -15 }}
        animate={{ y: 0, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.2 }}
        className="relative w-28 h-28 mx-auto mb-4"
      >
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute inset-0 bg-accent/30 rounded-full blur-xl"
        />
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="relative flex items-center justify-center w-full h-full"
        >
          <Trophy className="h-20 w-20 text-accent drop-shadow-lg" />
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-0"
          >
            {[0, 90, 180, 270].map((deg) => (
              <Sparkles
                key={deg}
                className="absolute h-3 w-3 text-accent"
                style={{
                  top: deg === 0 ? 0 : deg === 180 ? 'auto' : '50%',
                  bottom: deg === 180 ? 0 : 'auto',
                  left: deg === 270 ? 0 : deg === 90 ? 'auto' : '50%',
                  right: deg === 90 ? 0 : 'auto',
                  transform: 'translate(-50%, -50%)',
                }}
              />
            ))}
          </motion.div>
        </motion.div>
      </motion.div>

      <motion.h2
        initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-3xl sm:text-4xl font-gaming font-bold mb-1"
      >
        <span className="bg-gradient-to-r from-accent via-primary to-accent bg-clip-text text-transparent">
          VICTORY!
        </span>
      </motion.h2>

      <motion.p
        initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="text-muted-foreground text-sm mb-4"
      >
        You crushed it! The SOL is yours.
      </motion.p>

      {/* Payout */}
      <motion.div
        initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="p-4 rounded-xl bg-success/10 border border-success/30 mb-4"
      >
        <p className="text-xs text-muted-foreground mb-1">Your Winnings</p>
        {claimed ? (
          <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300 }}>
            <AnimatedCounter
              from={0} to={payout} duration={2000}
              prefix="+" suffix=" SOL"
              className="text-3xl font-gaming font-bold text-success"
            />
            <motion.p
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }}
              className="text-xs text-success/70 mt-1"
            >
              ✓ Added to your wallet
            </motion.p>
          </motion.div>
        ) : (
          <p className="text-3xl font-gaming font-bold text-success">+{formatSol(payout)} SOL</p>
        )}
        <p className="text-xs text-muted-foreground mt-2">
          Total pot: {formatSol(totalPot)} SOL · Platform fee: {formatSol(platformFee)} SOL ({getFeeTierLabel(totalPot / 2)})
        </p>
      </motion.div>

      {/* Actions */}
      <motion.div
        initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.6 }} className="space-y-3"
      >
        {!claimed ? (
          <Button variant="neon" className="w-full" onClick={() => setClaimed(true)}>
            <ArrowRight className="h-4 w-4 mr-2" />
            Collect Your Reward💰
          </Button>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 gap-2"
          >
            <Button variant="default" className="w-full" onClick={() => { onClose(); router.push('/dashboard'); }}>
              <LayoutDashboard className="h-4 w-4 mr-1.5" />
              Dashboard
            </Button>
            {onRematch ? (
              <Button
                variant="neon" className="w-full"
                onClick={onRematch} disabled={isRematchPending}
              >
                {isRematchPending
                  ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Sending...</>
                  : <><Swords className="h-4 w-4 mr-1.5" /> Rematch</>
                }
              </Button>
            ) : (
              <Button variant="neon" className="w-full" onClick={() => { onClose(); router.push('/arena'); }}>
                <Swords className="h-4 w-4 mr-1.5" />
                Play Again
              </Button>
            )}
            {onViewDetails && (
              <Button variant="outline" className="w-full col-span-2" onClick={onViewDetails}>
                <BarChart3 className="h-4 w-4 mr-1.5" />
                View Match Details
              </Button>
            )}
            {explorerUrl && (
              <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="col-span-2">
                <Button variant="outline" className="w-full">
                  <ExternalLink className="h-4 w-4 mr-1.5" />
                  View Transaction
                </Button>
              </a>
            )}
            {game && (
              <Button
                variant="outline"
                className="w-full col-span-2 border-success/30 text-success hover:bg-success/10"
                onClick={() => setShareOpen(true)}
              >
                <Share2 className="h-4 w-4 mr-1.5" />
                Share Your Win
              </Button>
            )}
          </motion.div>
        )}
      </motion.div>

      {/* Win Share Card dialog */}
      {game && (
        <WinShareCard
          open={shareOpen}
          onOpenChange={setShareOpen}
          game={game}
          amountSol={payout}
          opponentUsername={opponentUsername ?? null}
          winnerUsername={winnerUsername ?? null}
          inviteCode={inviteCode ?? null}
        />
      )}
    </motion.div>
  );
}

// ─── Defeat Content ────────────────────────────────────────────────────────────

function DefeatContent({
  winnerWallet, winnerUsername, totalPot, refundAmount,
  onClose, onViewDetails, onRematch, isRematchPending,
}: {
  winnerWallet?: string | null; winnerUsername?: string | null;
  totalPot: number; refundAmount?: number;
  onClose: () => void; onViewDetails?: () => void;
  onRematch?: () => Promise<void>; isRematchPending?: boolean;
}) {
  const router = useRouter();
  const lost = refundAmount ?? Math.floor(totalPot / 2);
  const [acknowledged, setAcknowledged] = useState(false);

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      className="text-center py-4"
    >
      {/* Defeat icon */}
      <motion.div
        initial={{ y: -20 }} animate={{ y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className="relative w-24 h-24 mx-auto mb-4"
      >
        <div className="absolute inset-0 bg-destructive/10 rounded-full blur-lg" />
        <motion.div
          animate={{ scale: [1, 0.95, 1] }} transition={{ duration: 2, repeat: Infinity }}
          className="relative flex items-center justify-center w-full h-full"
        >
          <Frown className="h-16 w-16 text-muted-foreground" />
        </motion.div>
      </motion.div>

      <motion.h2
        initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="text-2xl sm:text-3xl font-gaming font-bold text-muted-foreground mb-1"
      >
        DEFEAT
      </motion.h2>

      <motion.p
        initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-muted-foreground text-sm mb-4"
      >
        Tough match. Every loss makes you sharper.
      </motion.p>

      {/* Loss amount */}
      <motion.div
        initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="p-4 rounded-xl bg-destructive/10 border border-destructive/30 mb-3"
      >
        <p className="text-xs text-muted-foreground mb-1">Amount Lost</p>
        {acknowledged ? (
          <AnimatedCounter
            from={lost} to={0} duration={1500}
            prefix="-" suffix=" SOL"
            className="text-2xl font-gaming font-bold text-destructive"
          />
        ) : (
          <p className="text-2xl font-gaming font-bold text-destructive">
            -{formatSol(lost)} SOL
          </p>
        )}
      </motion.div>

      {/* Winner info */}
      {winnerWallet && (
        <motion.div
          initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.45 }}
          className="p-3 rounded-xl bg-muted/20 border border-border mb-3"
        >
          <p className="text-xs text-muted-foreground mb-1">Winner</p>
          <PlayerLink
            walletAddress={winnerWallet}
            username={winnerUsername}
            className="font-gaming font-bold text-primary text-sm"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Took home {formatSol(totalPot - calculatePlatformFee(totalPot / 2))} SOL
          </p>
        </motion.div>
      )}

      {/* Motivation */}
      <motion.div
        initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="p-3 rounded-xl bg-primary/5 border border-primary/20 mb-4"
      >
        <p className="text-xs text-muted-foreground">
          💪 Study the game, level up, and come back stronger. The leaderboard is waiting.
        </p>
      </motion.div>

      {/* Actions */}
      <motion.div
        initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.6 }} className="space-y-2"
      >
        {!acknowledged ? (
          <Button variant="default" className="w-full" onClick={() => setAcknowledged(true)}>
            Walk it off
          </Button>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 gap-2"
          >
            {/* Rematch — calls the real handler if provided, else navigates to arena */}
            {onRematch ? (
              <Button
                variant="neon" className="w-full"
                onClick={onRematch} disabled={isRematchPending}
              >
                {isRematchPending
                  ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Sending...</>
                  : <><RefreshCw className="h-4 w-4 mr-1.5" /> Rematch</>
                }
              </Button>
            ) : (
              <Button variant="neon" className="w-full" onClick={() => { onClose(); router.push('/arena'); }}>
                <RefreshCw className="h-4 w-4 mr-1.5" />
                Rematch
              </Button>
            )}
            <Button variant="default" className="w-full" onClick={() => { onClose(); router.push('/dashboard'); }}>
              <LayoutDashboard className="h-4 w-4 mr-1.5" />
              Dashboard
            </Button>
            {onViewDetails && (
              <Button variant="outline" className="w-full" onClick={onViewDetails}>
                <BarChart3 className="h-4 w-4 mr-1.5" />
                Match Details
              </Button>
            )}
            <Button variant="outline" className="w-full" onClick={() => { onClose(); router.push('/leaderboard'); }}>
              <Trophy className="h-4 w-4 mr-1.5" />
              Leaderboard
            </Button>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}

// ─── Draw Content ──────────────────────────────────────────────────────────────

function DrawContent({
  refundAmount, onClose, onViewDetails, onRematch, isRematchPending,
}: {
  refundAmount?: number;
  onClose: () => void; onViewDetails?: () => void;
  onRematch?: () => Promise<void>; isRematchPending?: boolean;
}) {
  const router = useRouter();
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      className="text-center py-4"
    >
      <motion.div
        initial={{ rotate: -10 }} animate={{ rotate: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className="relative w-24 h-24 mx-auto mb-4"
      >
        <div className="absolute inset-0 bg-muted/20 rounded-full blur-lg" />
        <motion.div
          animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 2, repeat: Infinity }}
          className="relative flex items-center justify-center w-full h-full"
        >
          <Scale className="h-16 w-16 text-muted-foreground" />
        </motion.div>
      </motion.div>

      <motion.h2
        initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="text-2xl sm:text-3xl font-gaming font-bold text-muted-foreground mb-1"
      >
        DRAW
      </motion.h2>

      <motion.p
        initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-muted-foreground text-sm mb-4"
      >
        An equal match — honours even.
      </motion.p>

      <motion.div
        initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="p-4 rounded-xl bg-muted/30 border border-border mb-4"
      >
        <p className="text-xs text-muted-foreground mb-1">Refunded to Your Wallet</p>
        <p className="text-2xl font-gaming font-bold text-foreground">
          {formatSol(refundAmount || 0)} SOL
        </p>
        <p className="text-xs text-muted-foreground mt-1">Your stake has been returned in full.</p>
      </motion.div>

      <motion.div
        initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="grid grid-cols-2 gap-2"
      >
        {onRematch ? (
          <Button
            variant="neon" className="w-full"
            onClick={onRematch} disabled={isRematchPending}
          >
            {isRematchPending
              ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Sending...</>
              : <><Swords className="h-4 w-4 mr-1.5" /> Rematch</>
            }
          </Button>
        ) : (
          <Button variant="neon" className="w-full" onClick={() => { onClose(); router.push('/arena'); }}>
            <Swords className="h-4 w-4 mr-1.5" />
            Play Again
          </Button>
        )}
        <Button variant="default" className="w-full" onClick={() => { onClose(); router.push('/dashboard'); }}>
          <Home className="h-4 w-4 mr-1.5" />
          Dashboard
        </Button>
        {onViewDetails && (
          <Button variant="outline" className="w-full col-span-2" onClick={onViewDetails}>
            <BarChart3 className="h-4 w-4 mr-1.5" />
            View Match Details
          </Button>
        )}
      </motion.div>
    </motion.div>
  );
}

// ─── Main Modal ────────────────────────────────────────────────────────────────

export function GameResultModal({
  open, onOpenChange, result,
  winnerWallet, winnerUsername,
  totalPot, platformFee, winnerPayout, refundAmount,
  explorerUrl, onViewDetails,
  onRematch, isRematchPending,
  game, opponentWallet: _opponentWallet, opponentUsername, inviteCode,
}: GameResultModalProps) {
  const handleClose = useCallback(() => onOpenChange(false), [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`sm:max-w-md border bg-card overflow-y-auto max-h-[90vh] ${result === 'win' ? 'border-success/40' :
          result === 'lose' ? 'border-destructive/30' :
            'border-muted'
          }`}
        aria-describedby={undefined}
      >
        <AnimatePresence mode="wait">
          {result === 'win' && (
            <VictoryContent
              key="victory"
              totalPot={totalPot} platformFee={platformFee}
              winnerPayout={winnerPayout} explorerUrl={explorerUrl}
              onClose={handleClose} onViewDetails={onViewDetails}
              onRematch={onRematch} isRematchPending={isRematchPending}
              game={game}
              opponentUsername={opponentUsername}
              winnerUsername={winnerUsername}
              inviteCode={inviteCode}
            />
          )}
          {result === 'lose' && (
            <DefeatContent
              key="defeat"
              winnerWallet={winnerWallet} winnerUsername={winnerUsername}
              totalPot={totalPot} refundAmount={refundAmount}
              onClose={handleClose} onViewDetails={onViewDetails}
              onRematch={onRematch} isRematchPending={isRematchPending}
            />
          )}
          {result === 'draw' && (
            <DrawContent
              key="draw"
              refundAmount={refundAmount}
              onClose={handleClose} onViewDetails={onViewDetails}
              onRematch={onRematch} isRematchPending={isRematchPending}
            />
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}