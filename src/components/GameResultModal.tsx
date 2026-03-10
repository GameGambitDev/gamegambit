'use client';

/**
 * GameResultModal.tsx
 * 
 * Animated modal that displays when a game ends:
 * - Victory: Trophy animation, confetti, payout info
 * - Defeat: Consolation message, stats
 * - Draw: Refund info
 */

import { useEffect, useState, useCallback } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Frown, Scale, Sparkles, ArrowRight, ExternalLink } from 'lucide-react';
import { formatSol } from '@/lib/constants';
import { PlayerLink } from '@/components/PlayerLink';
import confetti from 'canvas-confetti';

// ─── Types ────────────────────────────────────────────────────────────────────

interface GameResultModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: 'win' | 'lose' | 'draw';
  winnerWallet?: string | null;
  winnerUsername?: string | null;
  totalPot: number; // in lamports
  platformFee: number; // in lamports
  winnerPayout?: number; // in lamports
  refundAmount?: number; // in lamports (for draw)
  explorerUrl?: string | null;
  onViewDetails?: () => void;
}

// ─── Victory Animation ────────────────────────────────────────────────────────

function VictoryContent({ 
  totalPot, 
  platformFee, 
  winnerPayout,
  explorerUrl,
  onClose,
  onViewDetails,
}: {
  totalPot: number;
  platformFee: number;
  winnerPayout?: number;
  explorerUrl?: string | null;
  onClose: () => void;
  onViewDetails?: () => void;
}) {
  const payout = winnerPayout || Math.floor(totalPot * 0.9);

  useEffect(() => {
    // Fire confetti multiple times for dramatic effect
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();
      if (timeLeft <= 0) {
        clearInterval(interval);
        return;
      }

      const particleCount = 50 * (timeLeft / duration);
      
      // Confetti from both sides
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
        colors: ['#FFD700', '#FFA500', '#FF6B6B', '#4ECDC4', '#9945FF'],
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
        colors: ['#FFD700', '#FFA500', '#FF6B6B', '#4ECDC4', '#9945FF'],
      });
    }, 250);

    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 15 }}
      className="text-center py-6"
    >
      {/* Trophy Animation */}
      <motion.div
        initial={{ y: -50, rotate: -15 }}
        animate={{ y: 0, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.2 }}
        className="relative w-32 h-32 mx-auto mb-6"
      >
        {/* Glow effect */}
        <motion.div
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.5, 0.8, 0.5],
          }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute inset-0 bg-accent/30 rounded-full blur-xl"
        />
        
        {/* Trophy icon */}
        <motion.div
          animate={{ 
            y: [0, -5, 0],
          }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="relative flex items-center justify-center w-full h-full"
        >
          <Trophy className="h-24 w-24 text-accent drop-shadow-lg" />
          
          {/* Sparkles around trophy */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-0"
          >
            <Sparkles className="absolute top-0 left-1/2 -translate-x-1/2 h-4 w-4 text-accent" />
            <Sparkles className="absolute bottom-0 left-1/2 -translate-x-1/2 h-4 w-4 text-accent" />
            <Sparkles className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-4 text-accent" />
            <Sparkles className="absolute right-0 top-1/2 -translate-y-1/2 h-4 w-4 text-accent" />
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Victory Text */}
      <motion.h2
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-3xl sm:text-4xl font-gaming font-bold mb-2"
      >
        <span className="bg-gradient-to-r from-accent via-primary to-accent bg-clip-text text-transparent">
          VICTORY!
        </span>
      </motion.h2>

      <motion.p
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="text-muted-foreground mb-6"
      >
        Congratulations! You've won the match!
      </motion.p>

      {/* Payout Info */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="p-4 rounded-lg bg-success/10 border border-success/30 mb-6"
      >
        <p className="text-sm text-muted-foreground mb-1">Your Winnings</p>
        <p className="text-3xl font-gaming font-bold text-success">
          +{formatSol(payout)} SOL
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          Total pot: {formatSol(totalPot)} SOL | Platform fee: {formatSol(platformFee)} SOL (10%)
        </p>
      </motion.div>

      {/* Actions */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="flex flex-col sm:flex-row gap-3"
      >
        {explorerUrl && (
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1"
          >
            <Button variant="outline" className="w-full">
              View Transaction <ExternalLink className="h-4 w-4 ml-2" />
            </Button>
          </a>
        )}
        <Button variant="neon" className="flex-1" onClick={onClose}>
          Claim Victory <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </motion.div>
    </motion.div>
  );
}

// ─── Defeat Animation ─────────────────────────────────────────────────────────

function DefeatContent({
  winnerWallet,
  winnerUsername,
  totalPot,
  onClose,
  onViewDetails,
}: {
  winnerWallet?: string | null;
  winnerUsername?: string | null;
  totalPot: number;
  onClose: () => void;
  onViewDetails?: () => void;
}) {
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      className="text-center py-6"
    >
      {/* Defeat Icon */}
      <motion.div
        initial={{ y: -20 }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className="relative w-28 h-28 mx-auto mb-6"
      >
        <div className="absolute inset-0 bg-muted/30 rounded-full blur-lg" />
        <motion.div
          animate={{ 
            scale: [1, 0.95, 1],
          }}
          transition={{ duration: 2, repeat: Infinity }}
          className="relative flex items-center justify-center w-full h-full"
        >
          <Frown className="h-20 w-20 text-muted-foreground" />
        </motion.div>
      </motion.div>

      {/* Defeat Text */}
      <motion.h2
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="text-2xl sm:text-3xl font-gaming font-bold text-muted-foreground mb-2"
      >
        DEFEAT
      </motion.h2>

      <motion.p
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-muted-foreground mb-6"
      >
        Better luck next time. Keep practicing!
      </motion.p>

      {/* Winner Info */}
      {winnerWallet && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="p-4 rounded-lg bg-muted/30 border border-border mb-6"
        >
          <p className="text-sm text-muted-foreground mb-2">Winner</p>
          <PlayerLink
            walletAddress={winnerWallet}
            username={winnerUsername}
            className="font-gaming font-bold text-primary"
          />
          <p className="text-sm text-muted-foreground mt-2">
            Won {formatSol(Math.floor(totalPot * 0.9))} SOL
          </p>
        </motion.div>
      )}

      {/* Encouragement */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="p-3 rounded-lg bg-primary/5 border border-primary/20 mb-6"
      >
        <p className="text-sm text-muted-foreground">
          Don't give up! Every loss is a learning opportunity.
        </p>
      </motion.div>

      {/* Actions */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="flex gap-3"
      >
        {onViewDetails && (
          <Button variant="outline" className="flex-1" onClick={onViewDetails}>
            View Match Details
          </Button>
        )}
        <Button variant="default" className="flex-1" onClick={onClose}>
          Play Again
        </Button>
      </motion.div>
    </motion.div>
  );
}

// ─── Draw Animation ───────────────────────────────────────────────────────────

function DrawContent({
  refundAmount,
  onClose,
}: {
  refundAmount?: number;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      className="text-center py-6"
    >
      {/* Draw Icon */}
      <motion.div
        initial={{ rotate: -10 }}
        animate={{ rotate: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className="relative w-28 h-28 mx-auto mb-6"
      >
        <div className="absolute inset-0 bg-muted/20 rounded-full blur-lg" />
        <motion.div
          animate={{ 
            scale: [1, 1.05, 1],
          }}
          transition={{ duration: 2, repeat: Infinity }}
          className="relative flex items-center justify-center w-full h-full"
        >
          <Scale className="h-20 w-20 text-muted-foreground" />
        </motion.div>
      </motion.div>

      {/* Draw Text */}
      <motion.h2
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="text-2xl sm:text-3xl font-gaming font-bold text-muted-foreground mb-2"
      >
        DRAW
      </motion.h2>

      <motion.p
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-muted-foreground mb-6"
      >
        The match ended in a draw.
      </motion.p>

      {/* Refund Info */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="p-4 rounded-lg bg-muted/30 border border-border mb-6"
      >
        <p className="text-sm text-muted-foreground mb-1">Refund Amount</p>
        <p className="text-2xl font-gaming font-bold text-foreground">
          {formatSol(refundAmount || 0)} SOL
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          Your stake has been returned to your wallet.
        </p>
      </motion.div>

      {/* Action */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <Button variant="default" className="w-full" onClick={onClose}>
          Continue
        </Button>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export function GameResultModal({
  open,
  onOpenChange,
  result,
  winnerWallet,
  winnerUsername,
  totalPot,
  platformFee,
  winnerPayout,
  refundAmount,
  explorerUrl,
  onViewDetails,
}: GameResultModalProps) {
  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`sm:max-w-md border bg-card ${
          result === 'win' 
            ? 'border-success/40' 
            : result === 'lose'
              ? 'border-muted'
              : 'border-muted'
        }`}
        aria-describedby={undefined}
      >
        <AnimatePresence mode="wait">
          {result === 'win' && (
            <VictoryContent
              key="victory"
              totalPot={totalPot}
              platformFee={platformFee}
              winnerPayout={winnerPayout}
              explorerUrl={explorerUrl}
              onClose={handleClose}
              onViewDetails={onViewDetails}
            />
          )}
          {result === 'lose' && (
            <DefeatContent
              key="defeat"
              winnerWallet={winnerWallet}
              winnerUsername={winnerUsername}
              totalPot={totalPot}
              onClose={handleClose}
              onViewDetails={onViewDetails}
            />
          )}
          {result === 'draw' && (
            <DrawContent
              key="draw"
              refundAmount={refundAmount}
              onClose={handleClose}
            />
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
