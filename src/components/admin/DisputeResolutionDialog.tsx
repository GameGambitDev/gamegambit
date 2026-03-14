'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertCircle, Loader, CheckCircle } from 'lucide-react';
import { useAdminAction } from '@/hooks/admin/useAdminAction';

export interface DisputeResolutionDialogProps {
    isOpen: boolean;
    onClose: () => void;
    disputeId: string;
    wagerId: string;
    player1: string;
    player2: string;
    game: string;
    stake: number;
    issue: string;
    onResolutionSuccess?: () => void;
}

export function DisputeResolutionDialog({
    isOpen,
    onClose,
    disputeId,
    wagerId,
    player1,
    player2,
    game,
    stake,
    issue,
    onResolutionSuccess,
}: DisputeResolutionDialogProps) {
    const [resolution, setResolution] = useState<'resolve' | 'refund' | 'mark_disputed' | null>(null);
    const [winner, setWinner] = useState<'player1' | 'player2' | null>(null);
    const [notes, setNotes] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const { resolve, refund, markDisputed, loading, error, clearError } = useAdminAction();

    const handleSubmit = async () => {
        clearError();

        let result = null;

        if (resolution === 'resolve' && winner) {
            const winnerWallet = winner === 'player1' ? player1 : player2;
            result = await resolve(wagerId, winnerWallet, notes);
        } else if (resolution === 'refund') {
            result = await refund(wagerId, notes);
        } else if (resolution === 'mark_disputed') {
            result = await markDisputed(wagerId, notes);
        }

        if (result?.success) {
            setSubmitted(true);
            setTimeout(() => {
                setSubmitted(false);
                onClose();
                onResolutionSuccess?.();
            }, 2000);
        }
    };

    const isValid = resolution && (
        (resolution === 'resolve' && winner) ||
        resolution === 'refund' ||
        resolution === 'mark_disputed'
    );

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                    />

                    {/* Dialog */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative z-10 glass rounded-2xl p-6 border border-primary/20 max-w-2xl w-full mx-4 space-y-6 max-h-[85vh] overflow-y-auto"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between sticky top-0 bg-background/80 backdrop-blur -mx-6 -mt-6 px-6 py-4 mb-2 border-b border-border/50">
                            <h2 className="text-2xl font-gaming font-bold text-glow">Resolve Dispute</h2>
                            <button
                                onClick={onClose}
                                className="text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Content */}
                        {!submitted ? (
                            <div className="space-y-6">
                                {/* Dispute Details */}
                                <div className="space-y-4 bg-card/50 rounded-xl p-4 border border-border/50">
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-1">Dispute ID</p>
                                        <p className="text-sm font-mono text-primary">{disputeId}</p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 border-t border-border/50 pt-4">
                                        <div>
                                            <p className="text-xs text-muted-foreground mb-1">Players</p>
                                            <p className="text-sm text-foreground">{player1} vs {player2}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground mb-1">Game</p>
                                            <p className="text-sm text-foreground">{game}</p>
                                        </div>
                                    </div>

                                    <div>
                                        <p className="text-xs text-muted-foreground mb-1">Stake</p>
                                        <p className="text-lg font-semibold text-primary">{stake} SOL</p>
                                    </div>

                                    <div className="border-t border-border/50 pt-4">
                                        <p className="text-xs text-muted-foreground mb-2">Issue</p>
                                        <p className="text-sm text-foreground bg-card rounded-lg p-3 border border-border/50">
                                            {issue}
                                        </p>
                                    </div>
                                </div>

                                {/* Resolution Options */}
                                <div className="space-y-3">
                                    <p className="text-sm font-semibold text-foreground">Choose Resolution:</p>

                                    {/* Force Resolve */}
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        onClick={() => {
                                            setResolution('resolve');
                                            setWinner(null);
                                            clearError();
                                        }}
                                        className={`w-full p-4 rounded-xl border-2 transition-all text-left ${resolution === 'resolve'
                                            ? 'border-primary bg-primary/10'
                                            : 'border-border/50 hover:border-primary/50 bg-card/50'
                                            }`}
                                    >
                                        <p className="font-semibold text-foreground mb-1">Force Resolve (Pick Winner)</p>
                                        <p className="text-xs text-muted-foreground">Declare one player as the winner</p>
                                    </motion.button>

                                    {resolution === 'resolve' && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="flex gap-2 ml-4"
                                        >
                                            <button
                                                onClick={() => setWinner('player1')}
                                                className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-colors ${winner === 'player1'
                                                    ? 'bg-success text-success-foreground'
                                                    : 'bg-card border border-border/50 hover:border-success/50 text-foreground'
                                                    }`}
                                            >
                                                {player1} Wins
                                            </button>
                                            <button
                                                onClick={() => setWinner('player2')}
                                                className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-colors ${winner === 'player2'
                                                    ? 'bg-success text-success-foreground'
                                                    : 'bg-card border border-border/50 hover:border-success/50 text-foreground'
                                                    }`}
                                            >
                                                {player2} Wins
                                            </button>
                                        </motion.div>
                                    )}

                                    {/* Force Refund */}
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        onClick={() => {
                                            setResolution('refund');
                                            clearError();
                                        }}
                                        className={`w-full p-4 rounded-xl border-2 transition-all text-left ${resolution === 'refund'
                                            ? 'border-primary bg-primary/10'
                                            : 'border-border/50 hover:border-primary/50 bg-card/50'
                                            }`}
                                    >
                                        <p className="font-semibold text-foreground mb-1">Force Refund</p>
                                        <p className="text-xs text-muted-foreground">Refund the wager to both players</p>
                                    </motion.button>

                                    {/* Mark Disputed */}
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        onClick={() => {
                                            setResolution('mark_disputed');
                                            clearError();
                                        }}
                                        className={`w-full p-4 rounded-xl border-2 transition-all text-left ${resolution === 'mark_disputed'
                                            ? 'border-primary bg-primary/10'
                                            : 'border-border/50 hover:border-primary/50 bg-card/50'
                                            }`}
                                    >
                                        <p className="font-semibold text-foreground mb-1">Keep Disputed</p>
                                        <p className="text-xs text-muted-foreground">Mark for further review</p>
                                    </motion.button>
                                </div>

                                {/* Notes */}
                                {resolution && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                    >
                                        <label className="block text-sm font-medium text-foreground mb-2">
                                            Resolution Notes (required)
                                        </label>
                                        <textarea
                                            value={notes}
                                            onChange={(e) => setNotes(e.target.value)}
                                            placeholder="Explain your decision..."
                                            className="w-full px-4 py-2 bg-card border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-foreground placeholder:text-muted-foreground resize-none"
                                            rows={3}
                                            disabled={loading}
                                        />
                                    </motion.div>
                                )}

                                {/* Error */}
                                {error && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-lg flex gap-2 items-start text-sm"
                                    >
                                        <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                        <p>{error}</p>
                                    </motion.div>
                                )}

                                {/* Actions */}
                                <div className="flex gap-3 sticky bottom-0 bg-background/80 backdrop-blur -mx-6 -mb-6 px-6 py-4 border-t border-border/50">
                                    <button
                                        onClick={onClose}
                                        disabled={loading}
                                        className="flex-1 bg-card border border-border/50 hover:border-primary/50 text-foreground font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSubmit}
                                        disabled={!isValid || !notes.trim() || loading}
                                        className="flex-1 bg-primary hover:bg-primary/90 disabled:bg-muted text-primary-foreground font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                                    >
                                        {loading && <Loader className="h-4 w-4 animate-spin" />}
                                        {loading ? 'Processing...' : 'Confirm Resolution'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* Success State */
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="flex flex-col items-center gap-4 py-8"
                            >
                                <CheckCircle className="h-16 w-16 text-success animate-pulse" />
                                <div className="text-center space-y-2">
                                    <h3 className="text-xl font-gaming font-bold text-foreground">Dispute Resolved</h3>
                                    <p className="text-muted-foreground text-sm">
                                        Dispute #{disputeId} has been successfully resolved
                                    </p>
                                </div>
                            </motion.div>
                        )}
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
