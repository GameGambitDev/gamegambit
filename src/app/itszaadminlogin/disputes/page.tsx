'use client';

import { Suspense, useEffect, useState } from 'react';
import { ProtectedRoute } from '@/components/admin';
import { motion } from 'framer-motion';
import { Scale, Search, AlertTriangle, Loader } from 'lucide-react';
import { getSupabaseClient } from '@/integrations/supabase/client';
import { useWallet } from '@solana/wallet-adapter-react';

interface Dispute {
    id: string;
    match_id: number;
    player_a_wallet: string;
    player_b_wallet: string;
    game: 'chess' | 'codm' | 'pubg';
    stake_lamports: number;
    status: string;
    vote_player_a: string;
    vote_player_b: string;
    created_at: string;
}

function DisputesContent() {
    const [searchTerm, setSearchTerm] = useState('');
    const [disputes, setDisputes] = useState<Dispute[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedDispute, setSelectedDispute] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [txSignature, setTxSignature] = useState<string | null>(null);
    const [showResolveDropdown, setShowResolveDropdown] = useState<string | null>(null);
    const [showConfirmInput, setShowConfirmInput] = useState<string | null>(null);
    const [confirmText, setConfirmText] = useState('');
    const { publicKey } = useWallet();

    useEffect(() => {
        fetchDisputes();
    }, []);

    const fetchDisputes = async () => {
        try {
            setLoading(true);
            setError(null);
            const { data, error: fetchError } = await getSupabaseClient()
                .from('wagers')
                .select('id, match_id, player_a_wallet, player_b_wallet, game, stake_lamports, status, vote_player_a, vote_player_b, created_at')
                .eq('status', 'disputed')
                .order('created_at', { ascending: true });

            if (fetchError) throw fetchError;
            setDisputes(data || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch disputes');
        } finally {
            setLoading(false);
        }
    };

    const truncateWallet = (wallet: string, start = 8, end = 4) => {
        if (wallet.length <= start + end) return wallet;
        return `${wallet.slice(0, start)}...${wallet.slice(-end)}`;
    };

    const getTimeInDispute = (createdAt: string) => {
        const now = new Date();
        const created = new Date(createdAt);
        const diffMs = now.getTime() - created.getTime();
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

        if (diffHours < 1) {
            const diffMins = Math.floor(diffMs / (1000 * 60));
            return `${diffMins}m ago`;
        }
        if (diffHours < 24) {
            return `${diffHours}h ago`;
        }
        const diffDays = Math.floor(diffHours / 24);
        return `${diffDays}d ago`;
    };

    const handleForceResolve = async (disputeId: string, winnerWallet: string) => {
        if (!publicKey) {
            setError('Please connect your wallet');
            return;
        }

        if (confirmText !== 'CONFIRM') {
            setError('Please type CONFIRM to proceed');
            return;
        }

        try {
            setActionLoading(`resolve-${disputeId}`);
            const response = await fetch('/api/admin/action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'forceResolve',
                    adminWallet: publicKey.toBase58(),
                    wagerId: disputeId,
                    winnerWallet,
                    notes: 'Force resolved from disputes by admin',
                }),
            });

            const result = await response.json();
            if (!result.success) throw new Error(result.error || 'Failed to resolve dispute');

            setTxSignature(result.txSignature);
            setDisputes(disputes.filter(d => d.id !== disputeId));
            setTimeout(() => {
                setSelectedDispute(null);
                setShowResolveDropdown(null);
                setShowConfirmInput(null);
                setConfirmText('');
                setTxSignature(null);
            }, 3000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to resolve dispute');
        } finally {
            setActionLoading(null);
        }
    };

    const handleForceRefund = async (disputeId: string) => {
        if (!publicKey) {
            setError('Please connect your wallet');
            return;
        }

        try {
            setActionLoading(`refund-${disputeId}`);
            const response = await fetch('/api/admin/action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'forceRefund',
                    adminWallet: publicKey.toBase58(),
                    wagerId: disputeId,
                    notes: 'Force refunded from disputes by admin',
                }),
            });

            const result = await response.json();
            if (!result.success) throw new Error(result.error || 'Failed to refund dispute');

            setTxSignature(result.txSignature);
            setDisputes(disputes.filter(d => d.id !== disputeId));
            setTimeout(() => {
                setSelectedDispute(null);
                setTxSignature(null);
            }, 3000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to refund dispute');
        } finally {
            setActionLoading(null);
        }
    };

    const filteredDisputes = disputes.filter(dispute => {
        const matchesSearch = dispute.id.includes(searchTerm) ||
            dispute.player_a_wallet.toLowerCase().includes(searchTerm.toLowerCase()) ||
            dispute.player_b_wallet.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesSearch;
    });

    if (loading) {
        return (
            <ProtectedRoute>
                <div className="flex items-center justify-center py-12">
                    <Loader className="h-8 w-8 animate-spin text-primary" />
                </div>
            </ProtectedRoute>
        );
    }

    return (
        <ProtectedRoute>
            <div className="space-y-6">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <div className="flex items-center gap-3 mb-4">
                        <div className="bg-gradient-to-br from-orange-500/20 to-orange-600/20 rounded-xl p-3">
                            <Scale className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-gaming font-bold text-glow">Dispute Resolution</h1>
                            <p className="text-muted-foreground">Review and resolve contested wagers</p>
                        </div>
                    </div>
                </motion.div>

                {/* Error Message */}
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-lg"
                    >
                        {error}
                    </motion.div>
                )}

                {/* Tx Signature Display */}
                {txSignature && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-success/10 border border-success/30 text-success px-4 py-3 rounded-lg"
                    >
                        <p className="text-sm font-semibold mb-2">Transaction confirmed:</p>
                        <a
                            href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs break-all hover:underline"
                        >
                            {txSignature}
                        </a>
                    </motion.div>
                )}

                {/* Search */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="glass rounded-2xl p-4 border border-primary/20"
                >
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search by dispute ID, wager ID, or player..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-card border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-foreground placeholder:text-muted-foreground"
                        />
                    </div>
                </motion.div>

                {/* Disputes List */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="space-y-4"
                >
                    {filteredDisputes.map((dispute, idx) => (
                        <motion.div
                            key={dispute.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 + idx * 0.05 }}
                            onClick={() => setSelectedDispute(selectedDispute === dispute.id ? null : dispute.id)}
                            className="glass rounded-2xl border border-primary/20 cursor-pointer hover:border-primary/40 transition-all overflow-hidden"
                        >
                            <div className="p-6">
                                <div className="flex items-start justify-between gap-4 mb-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <AlertTriangle className="h-4 w-4 text-orange-400" />
                                            <h3 className="text-lg font-gaming font-bold text-foreground">Dispute #{dispute.id.slice(0, 8)}</h3>
                                        </div>
                                        <p className="text-sm text-muted-foreground mb-3">Wager ID: {dispute.id}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm text-primary font-semibold">{(dispute.stake_lamports / 1_000_000_000).toFixed(4)} SOL</p>
                                        <p className="text-xs text-muted-foreground">{getTimeInDispute(dispute.created_at)}</p>
                                    </div>
                                </div>

                                <div className="grid md:grid-cols-2 gap-4 mb-4 pb-4 border-b border-border/50">
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-1">Players</p>
                                        <p className="text-sm text-foreground">{truncateWallet(dispute.player_a_wallet)} vs {truncateWallet(dispute.player_b_wallet)}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-1">Game</p>
                                        <p className="text-sm text-foreground capitalize">{dispute.game}</p>
                                    </div>
                                </div>

                                <div className="mb-4">
                                    <p className="text-xs text-muted-foreground mb-2">Votes</p>
                                    <div className="space-y-2 text-sm">
                                        <p className="text-foreground">Player A voted for: <span className="text-primary font-mono">{truncateWallet(dispute.vote_player_a)}</span></p>
                                        <p className="text-foreground">Player B voted for: <span className="text-primary font-mono">{truncateWallet(dispute.vote_player_b)}</span></p>
                                    </div>
                                </div>

                                {selectedDispute === dispute.id && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="pt-4 border-t border-border/50 space-y-3"
                                    >
                                        <div className="space-y-2">
                                            <p className="text-xs text-muted-foreground">Force Resolve - Select Winner:</p>
                                            <div className="flex flex-col md:flex-row gap-2">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setShowResolveDropdown(showResolveDropdown === dispute.id ? null : dispute.id);
                                                    }}
                                                    disabled={actionLoading?.startsWith('resolve') || !publicKey}
                                                    className="flex-1 bg-primary hover:bg-primary/90 disabled:bg-muted text-primary-foreground font-semibold py-2 px-4 rounded-lg transition-colors text-sm"
                                                >
                                                    {actionLoading?.startsWith('resolve') ? 'Resolving...' : 'Pick Winner'}
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleForceRefund(dispute.id);
                                                    }}
                                                    disabled={actionLoading?.startsWith('refund') || !publicKey}
                                                    className="flex-1 bg-destructive/20 hover:bg-destructive/30 disabled:bg-muted text-destructive font-semibold py-2 px-4 rounded-lg transition-colors text-sm"
                                                >
                                                    {actionLoading?.startsWith('refund') ? 'Refunding...' : 'Force Refund'}
                                                </button>
                                            </div>

                                            {showResolveDropdown === dispute.id && (
                                                <div className="glass rounded-lg border border-primary/20 p-3 space-y-2">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setShowConfirmInput(dispute.id);
                                                            setShowResolveDropdown(null);
                                                        }}
                                                        className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-card rounded transition-colors"
                                                    >
                                                        Winner: Player A ({truncateWallet(dispute.player_a_wallet)})
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setShowConfirmInput(`${dispute.id}-b`);
                                                            setShowResolveDropdown(null);
                                                        }}
                                                        className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-card rounded transition-colors"
                                                    >
                                                        Winner: Player B ({truncateWallet(dispute.player_b_wallet)})
                                                    </button>
                                                </div>
                                            )}

                                            {showConfirmInput === dispute.id || showConfirmInput === `${dispute.id}-b` ? (
                                                <div className="glass rounded-lg border border-primary/20 p-3 space-y-2">
                                                    <p className="text-xs text-muted-foreground">Type CONFIRM to proceed:</p>
                                                    <input
                                                        type="text"
                                                        value={confirmText}
                                                        onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                                                        placeholder="Type CONFIRM..."
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="w-full px-3 py-2 bg-card border border-border/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-foreground text-sm"
                                                    />
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            const winnerWallet = showConfirmInput === dispute.id
                                                                ? dispute.player_a_wallet
                                                                : dispute.player_b_wallet;
                                                            handleForceResolve(dispute.id, winnerWallet);
                                                        }}
                                                        disabled={confirmText !== 'CONFIRM' || actionLoading === `resolve-${dispute.id}`}
                                                        className="w-full bg-success hover:bg-success/90 disabled:bg-muted text-success-foreground font-semibold py-2 px-4 rounded-lg transition-colors text-sm"
                                                    >
                                                        Confirm Resolution
                                                    </button>
                                                </div>
                                            ) : null}
                                        </div>
                                    </motion.div>
                                )}
                            </div>
                        </motion.div>
                    ))}
                </motion.div>

                {filteredDisputes.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                        No active disputes 🎉
                    </div>
                )}
            </div>
        </ProtectedRoute>
    );
}

export default function DisputesPage() {
    return (
        <Suspense fallback={<div className="text-center py-12 text-muted-foreground">Loading disputes...</div>}>
            <DisputesContent />
        </Suspense>
    );
}
