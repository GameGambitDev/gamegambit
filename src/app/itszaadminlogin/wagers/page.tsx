'use client';

import { Suspense, useEffect, useState } from 'react';
import { ProtectedRoute } from '@/components/admin';
import { motion } from 'framer-motion';
import { Dices, Search, Filter, Loader, Copy, Check } from 'lucide-react';
import { getSupabaseClient } from '@/integrations/supabase/client';
import { useWallet } from '@solana/wallet-adapter-react';

interface Wager {
    id: string;
    match_id: number;
    player_a_wallet: string;
    player_b_wallet: string;
    game: 'chess' | 'codm' | 'pubg';
    stake_lamports: number;
    status: 'created' | 'joined' | 'voting' | 'retractable' | 'disputed' | 'resolved' | 'cancelled';
    winner_wallet: string | null;
    created_at: string;
    resolved_at: string | null;
}

type StatusDisplay = 'Pending' | 'In Progress' | 'Resolved' | 'Disputed' | 'Cancelled';

function WagersContent() {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'in_progress' | 'resolved' | 'disputed'>('all');
    const [wagers, setWagers] = useState<Wager[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedWagerId, setExpandedWagerId] = useState<string | null>(null);
    const [copiedWallet, setCopiedWallet] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [txSignature, setTxSignature] = useState<string | null>(null);
    const [selectedWinner, setSelectedWinner] = useState<string | null>(null);
    const [showResolveDropdown, setShowResolveDropdown] = useState<string | null>(null);
    const { publicKey } = useWallet();

    useEffect(() => {
        fetchWagers();
    }, []);

    const fetchWagers = async () => {
        try {
            setLoading(true);
            setError(null);
            const { data, error: fetchError } = await getSupabaseClient()
                .from('wagers')
                .select('id, match_id, player_a_wallet, player_b_wallet, game, stake_lamports, status, winner_wallet, created_at, resolved_at')
                .order('created_at', { ascending: false });

            if (fetchError) throw fetchError;
            setWagers(data || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch wagers');
        } finally {
            setLoading(false);
        }
    };

    const truncateWallet = (wallet: string, start = 8, end = 4) => {
        if (wallet.length <= start + end) return wallet;
        return `${wallet.slice(0, start)}...${wallet.slice(-end)}`;
    };

    const mapStatusToDisplay = (status: string): StatusDisplay => {
        switch (status) {
            case 'voting':
                return 'In Progress';
            case 'disputed':
                return 'Disputed';
            case 'resolved':
                return 'Resolved';
            case 'cancelled':
                return 'Cancelled';
            case 'created':
            case 'joined':
            default:
                return 'Pending';
        }
    };

    const copyWallet = (wallet: string) => {
        navigator.clipboard.writeText(wallet);
        setCopiedWallet(wallet);
        setTimeout(() => setCopiedWallet(null), 2000);
    };

    const handleForceResolve = async (wagerId: string, winnerWallet: string) => {
        if (!publicKey) {
            setError('Please connect your wallet');
            return;
        }

        try {
            setActionLoading(`resolve-${wagerId}`);
            const response = await fetch('/api/admin/action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'forceResolve',
                    adminWallet: publicKey.toBase58(),
                    wagerId,
                    winnerWallet,
                    notes: 'Force resolved by admin',
                }),
            });

            const result = await response.json();
            if (!result.success) throw new Error(result.error || 'Failed to resolve wager');

            setTxSignature(result.txSignature);
            setWagers(wagers.map(w => w.id === wagerId ? { ...w, status: 'resolved', winner_wallet: winnerWallet } : w));
            setTimeout(() => {
                setExpandedWagerId(null);
                setShowResolveDropdown(null);
                setSelectedWinner(null);
                setTxSignature(null);
            }, 3000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to resolve wager');
        } finally {
            setActionLoading(null);
        }
    };

    const handleForceRefund = async (wagerId: string) => {
        if (!publicKey) {
            setError('Please connect your wallet');
            return;
        }

        try {
            setActionLoading(`refund-${wagerId}`);
            const response = await fetch('/api/admin/action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'forceRefund',
                    adminWallet: publicKey.toBase58(),
                    wagerId,
                    notes: 'Force refunded by admin',
                }),
            });

            const result = await response.json();
            if (!result.success) throw new Error(result.error || 'Failed to refund wager');

            setTxSignature(result.txSignature);
            setWagers(wagers.map(w => w.id === wagerId ? { ...w, status: 'cancelled' } : w));
            setTimeout(() => {
                setExpandedWagerId(null);
                setTxSignature(null);
            }, 3000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to refund wager');
        } finally {
            setActionLoading(null);
        }
    };

    const canActOnWager = (status: string) => {
        return ['voting', 'joined', 'disputed'].includes(status);
    };

    const filteredWagers = wagers.filter(wager => {
        const displayStatus = mapStatusToDisplay(wager.status);
        const matchesSearch = wager.id.includes(searchTerm) ||
            wager.player_a_wallet.toLowerCase().includes(searchTerm.toLowerCase()) ||
            wager.player_b_wallet.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = filterStatus === 'all' ||
            (filterStatus === 'pending' && ['created', 'joined'].includes(wager.status)) ||
            (filterStatus === 'in_progress' && wager.status === 'voting') ||
            (filterStatus === 'resolved' && wager.status === 'resolved') ||
            (filterStatus === 'disputed' && wager.status === 'disputed');
        return matchesSearch && matchesFilter;
    });

    const getStatusColor = (status: string) => {
        const displayStatus = mapStatusToDisplay(status);
        switch (displayStatus) {
            case 'Resolved':
                return 'bg-success/20 text-success';
            case 'In Progress':
                return 'bg-blue-500/20 text-blue-400';
            case 'Disputed':
                return 'bg-orange-500/20 text-orange-400';
            case 'Cancelled':
                return 'bg-muted text-muted-foreground';
            default:
                return 'bg-cyan-500/20 text-cyan-400';
        }
    };

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
                        <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/20 rounded-xl p-3">
                            <Dices className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-gaming font-bold text-glow">Wager Management</h1>
                            <p className="text-muted-foreground">Manage all wagers and handle refunds for stuck wagers</p>
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

                {/* Search & Filter */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="glass rounded-2xl p-4 border border-primary/20 space-y-4"
                >
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Search by wager ID or player..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-card border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-foreground placeholder:text-muted-foreground"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Filter className="h-4 w-4 text-muted-foreground" />
                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value as any)}
                                className="bg-card border border-border/50 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
                            >
                                <option value="all">All Wagers</option>
                                <option value="pending">Pending</option>
                                <option value="in_progress">In Progress</option>
                                <option value="resolved">Resolved</option>
                                <option value="disputed">Disputed</option>
                            </select>
                        </div>
                    </div>
                </motion.div>

                {/* Wagers Table */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="glass rounded-2xl overflow-hidden border border-primary/20"
                >
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-border/50 bg-card/50">
                                    <th className="px-6 py-4 text-left text-sm font-gaming font-bold text-foreground">Wager ID</th>
                                    <th className="px-6 py-4 text-left text-sm font-gaming font-bold text-foreground">Players</th>
                                    <th className="px-6 py-4 text-left text-sm font-gaming font-bold text-foreground">Game</th>
                                    <th className="px-6 py-4 text-left text-sm font-gaming font-bold text-foreground">Stake</th>
                                    <th className="px-6 py-4 text-left text-sm font-gaming font-bold text-foreground">Created</th>
                                    <th className="px-6 py-4 text-left text-sm font-gaming font-bold text-foreground">Status</th>
                                    <th className="px-6 py-4 text-left text-sm font-gaming font-bold text-foreground">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredWagers.map((wager) => (
                                    <tr key={wager.id} className="border-b border-border/50 hover:bg-card/50 transition-colors">
                                        <td className="px-6 py-4 text-sm font-mono text-muted-foreground">{wager.id.slice(0, 8)}</td>
                                        <td className="px-6 py-4 text-sm text-foreground">{truncateWallet(wager.player_a_wallet)} vs {truncateWallet(wager.player_b_wallet)}</td>
                                        <td className="px-6 py-4 text-sm text-foreground capitalize">{wager.game}</td>
                                        <td className="px-6 py-4 text-sm text-primary font-semibold">{(wager.stake_lamports / 1_000_000_000).toFixed(4)} SOL</td>
                                        <td className="px-6 py-4 text-sm text-muted-foreground">{new Date(wager.created_at).toLocaleDateString()}</td>
                                        <td className="px-6 py-4">
                                            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${getStatusColor(wager.status)}`}>
                                                {mapStatusToDisplay(wager.status)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            <button
                                                onClick={() => setExpandedWagerId(expandedWagerId === wager.id ? null : wager.id)}
                                                className="text-primary hover:text-primary/80 transition-colors"
                                            >
                                                {expandedWagerId === wager.id ? 'Hide' : 'View'}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </motion.div>

                {/* Expanded Row */}
                {expandedWagerId && filteredWagers.find(w => w.id === expandedWagerId) && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="glass rounded-2xl p-6 border border-primary/20"
                    >
                        {(() => {
                            const wager = filteredWagers.find(w => w.id === expandedWagerId)!;
                            return (
                                <div className="space-y-4">
                                    <div className="grid md:grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-xs text-muted-foreground mb-2">Full Wager ID</p>
                                            <p className="text-sm font-mono text-foreground break-all">{wager.id}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground mb-2">Match ID</p>
                                            <p className="text-sm font-mono text-foreground">{wager.match_id}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground mb-2">Player A Wallet</p>
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-mono text-foreground break-all flex-1">{wager.player_a_wallet}</p>
                                                <button
                                                    onClick={() => copyWallet(wager.player_a_wallet)}
                                                    className="text-primary hover:text-primary/80 transition-colors"
                                                >
                                                    {copiedWallet === wager.player_a_wallet ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                                </button>
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground mb-2">Player B Wallet</p>
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-mono text-foreground break-all flex-1">{wager.player_b_wallet}</p>
                                                <button
                                                    onClick={() => copyWallet(wager.player_b_wallet)}
                                                    className="text-primary hover:text-primary/80 transition-colors"
                                                >
                                                    {copiedWallet === wager.player_b_wallet ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                                </button>
                                            </div>
                                        </div>
                                        {wager.winner_wallet && (
                                            <div>
                                                <p className="text-xs text-muted-foreground mb-2">Winner Wallet</p>
                                                <p className="text-sm font-mono text-success">{wager.winner_wallet}</p>
                                            </div>
                                        )}
                                    </div>

                                    {canActOnWager(wager.status) && (
                                        <div className="pt-4 border-t border-border/50 space-y-3">
                                            <div className="flex flex-col md:flex-row gap-3">
                                                <div className="flex-1 relative">
                                                    <button
                                                        onClick={() => setShowResolveDropdown(showResolveDropdown === wager.id ? null : wager.id)}
                                                        disabled={actionLoading?.startsWith('resolve') || !publicKey}
                                                        className="w-full bg-primary hover:bg-primary/90 disabled:bg-muted text-primary-foreground font-semibold py-2 px-4 rounded-lg transition-colors"
                                                    >
                                                        {actionLoading?.startsWith('resolve') ? 'Resolving...' : 'Force Resolve'}
                                                    </button>
                                                    {showResolveDropdown === wager.id && (
                                                        <div className="absolute top-full left-0 right-0 mt-2 glass rounded-lg border border-primary/20 p-2 z-10">
                                                            <button
                                                                onClick={() => {
                                                                    setSelectedWinner(wager.player_a_wallet);
                                                                    handleForceResolve(wager.id, wager.player_a_wallet);
                                                                }}
                                                                disabled={actionLoading === `resolve-${wager.id}`}
                                                                className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-card rounded transition-colors"
                                                            >
                                                                Winner: Player A ({truncateWallet(wager.player_a_wallet)})
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setSelectedWinner(wager.player_b_wallet);
                                                                    handleForceResolve(wager.id, wager.player_b_wallet);
                                                                }}
                                                                disabled={actionLoading === `resolve-${wager.id}`}
                                                                className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-card rounded transition-colors"
                                                            >
                                                                Winner: Player B ({truncateWallet(wager.player_b_wallet)})
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={() => handleForceRefund(wager.id)}
                                                    disabled={actionLoading?.startsWith('refund') || !publicKey}
                                                    className="flex-1 bg-destructive/20 hover:bg-destructive/30 disabled:bg-muted text-destructive font-semibold py-2 px-4 rounded-lg transition-colors"
                                                >
                                                    {actionLoading?.startsWith('refund') ? 'Refunding...' : 'Force Refund'}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                    </motion.div>
                )}

                {filteredWagers.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                        No wagers found matching your search criteria.
                    </div>
                )}
            </div>
        </ProtectedRoute>
    );
}

export default function WagersPage() {
    return (
        <Suspense fallback={<div className="text-center py-12 text-muted-foreground">Loading wagers...</div>}>
            <WagersContent />
        </Suspense>
    );
}
