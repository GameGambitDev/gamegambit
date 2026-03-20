'use client';

import { Suspense, useEffect, useState } from 'react';
import { ProtectedRoute } from '@/components/admin';
import { motion } from 'framer-motion';
import { Users as UsersIcon, Search, Filter, Loader } from 'lucide-react';
import { getSupabaseClient } from '@/integrations/supabase/client';
import { useWallet } from '@solana/wallet-adapter-react';

// @deprecated — use Tables<'players'> instead
interface Player {
    wallet_address: string;
    username: string | null;
    is_banned: boolean;

    total_wins: number | null;
    total_losses: number | null;
    total_earnings: number | null;
    total_wagered: number | null;
    created_at: string;

}

function UsersContent() {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'banned'>('all');
    const [users, setUsers] = useState<Player[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [banReason, setBanReason] = useState('');
    const [showBanDialog, setShowBanDialog] = useState<string | null>(null);
    const { publicKey } = useWallet();

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            setError(null);
            const { data, error: fetchError } = await getSupabaseClient()
                .from('players')
                .select('wallet_address, username, is_banned, total_wins, total_losses, total_earnings, total_wagered, created_at')
                .order('created_at', { ascending: false });

            if (fetchError) throw fetchError;
            setUsers((data || []) as unknown as Player[]);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch users');
        } finally {
            setLoading(false);
        }
    };

    const truncateWallet = (wallet: string, start = 8, end = 4) => {
        if (wallet.length <= start + end) return wallet;
        return `${wallet.slice(0, start)}...${wallet.slice(-end)}`;
    };

    const handleBanPlayer = async (walletAddress: string, reason: string) => {
        if (!publicKey) {
            setError('Please connect your wallet');
            return;
        }

        try {
            setActionLoading(walletAddress);
            const response = await fetch('/api/admin/action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'banPlayer',
                    adminWallet: publicKey.toBase58(),
                    playerWallet: walletAddress,
                    reason,
                }),
            });

            const result = await response.json();
            if (!result.success) throw new Error(result.error || 'Failed to ban player');

            // Optimistically update UI
            setUsers(users.map(u =>
                u.wallet_address === walletAddress
                    ? { ...u, is_banned: true, ban_reason: reason }
                    : u
            ));
            setShowBanDialog(null);
            setBanReason('');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to ban player');
        } finally {
            setActionLoading(null);
        }
    };

    const handleUnbanPlayer = async (walletAddress: string) => {
        if (!publicKey) {
            setError('Please connect your wallet');
            return;
        }

        try {
            setActionLoading(walletAddress);
            const response = await fetch('/api/admin/action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'unbanPlayer',
                    adminWallet: publicKey.toBase58(),
                    playerWallet: walletAddress,
                }),
            });

            const result = await response.json();
            if (!result.success) throw new Error(result.error || 'Failed to unban player');

            // Optimistically update UI
            setUsers(users.map(u =>
                u.wallet_address === walletAddress
                    ? { ...u, is_banned: false, ban_reason: null }
                    : u
            ));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to unban player');
        } finally {
            setActionLoading(null);
        }
    };

    const filteredUsers = users.filter(user => {
        const matchesSearch = user.wallet_address.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
        const matchesFilter = filterStatus === 'all' ||
            (filterStatus === 'banned' ? user.is_banned : !user.is_banned);
        return matchesSearch && matchesFilter;
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
                        <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 rounded-xl p-3">
                            <UsersIcon className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-gaming font-bold text-glow">User Management</h1>
                            <p className="text-muted-foreground">View and manage all users in the system</p>
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
                                placeholder="Search by wallet address or username..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-card border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-foreground placeholder:text-muted-foreground"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Filter className="h-4 w-4 text-muted-foreground" />
                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value as 'all' | 'active' | 'banned')}
                                className="bg-card border border-border/50 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
                            >
                                <option value="all">All Users</option>
                                <option value="active">Active</option>
                                <option value="banned">Banned</option>
                            </select>
                        </div>
                    </div>
                </motion.div>

                {/* Users Table */}
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
                                    <th className="px-6 py-4 text-left text-sm font-gaming font-bold text-foreground">Wallet</th>
                                    <th className="px-6 py-4 text-left text-sm font-gaming font-bold text-foreground">Username</th>
                                    <th className="px-6 py-4 text-left text-sm font-gaming font-bold text-foreground">Joined</th>
                                    <th className="px-6 py-4 text-left text-sm font-gaming font-bold text-foreground">W/L</th>
                                    <th className="px-6 py-4 text-left text-sm font-gaming font-bold text-foreground">Earnings</th>
                                    <th className="px-6 py-4 text-left text-sm font-gaming font-bold text-foreground">Status</th>
                                    <th className="px-6 py-4 text-left text-sm font-gaming font-bold text-foreground">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredUsers.map((user) => (
                                    <tr key={user.wallet_address} className="border-b border-border/50 hover:bg-card/50 transition-colors">
                                        <td className="px-6 py-4 text-xs font-mono text-muted-foreground">{truncateWallet(user.wallet_address)}</td>
                                        <td className="px-6 py-4 text-sm text-foreground font-medium">{user.username || truncateWallet(user.wallet_address)}</td>
                                        <td className="px-6 py-4 text-sm text-muted-foreground">{new Date(user.created_at).toLocaleDateString()}</td>
                                        <td className="px-6 py-4 text-sm text-foreground">{(user.total_wins ?? 0)}W / {(user.total_losses ?? 0)}L</td>
                                        <td className="px-6 py-4 text-sm text-primary font-semibold">{((user.total_earnings ?? 0) / 1_000_000_000).toFixed(4)} SOL</td>
                                        <td className="px-6 py-4">
                                            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${user.is_banned ? 'bg-destructive/20 text-destructive' : 'bg-success/20 text-success'
                                                }`}>
                                                {user.is_banned ? 'Banned' : 'Active'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            <div className="flex gap-2">
                                                {user.is_banned ? (
                                                    <button
                                                        onClick={() => handleUnbanPlayer(user.wallet_address)}
                                                        disabled={actionLoading === user.wallet_address}
                                                        className="text-success hover:text-success/80 disabled:opacity-50 transition-colors text-xs font-semibold"
                                                    >
                                                        {actionLoading === user.wallet_address ? 'Unbanning...' : 'Unban'}
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => setShowBanDialog(user.wallet_address)}
                                                        className="text-destructive hover:text-destructive/80 transition-colors text-xs font-semibold"
                                                    >
                                                        Ban
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </motion.div>

                {filteredUsers.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                        No users found matching your search criteria.
                    </div>
                )}

                {/* Ban Dialog */}
                {showBanDialog && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                        onClick={() => setShowBanDialog(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="glass rounded-2xl p-6 border border-primary/20 w-full max-w-md"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h2 className="text-xl font-gaming font-bold text-foreground mb-4">Ban Player</h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm text-muted-foreground mb-2 block">Reason for ban</label>
                                    <input
                                        type="text"
                                        value={banReason}
                                        onChange={(e) => setBanReason(e.target.value)}
                                        placeholder="Enter ban reason..."
                                        className="w-full px-4 py-2 bg-card border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
                                    />
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => {
                                            setShowBanDialog(null);
                                            setBanReason('');
                                        }}
                                        className="flex-1 bg-card border border-border/50 hover:border-primary/50 text-foreground font-semibold py-2 px-4 rounded-lg transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => handleBanPlayer(showBanDialog, banReason)}
                                        disabled={!banReason || actionLoading === showBanDialog}
                                        className="flex-1 bg-destructive hover:bg-destructive/90 disabled:bg-muted text-destructive-foreground font-semibold py-2 px-4 rounded-lg transition-colors"
                                    >
                                        {actionLoading === showBanDialog ? 'Banning...' : 'Confirm Ban'}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </div>
        </ProtectedRoute>
    );
}

export default function UsersPage() {
    return (
        <Suspense fallback={<div className="text-center py-12 text-muted-foreground">Loading users...</div>}>
            <UsersContent />
        </Suspense>
    );
}
