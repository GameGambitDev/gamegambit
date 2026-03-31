'use client';

import { Suspense, useState, useCallback, useRef } from 'react';
import { ProtectedRoute } from '@/components/admin';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Users as UsersIcon, Search, Loader2, ChevronLeft, ChevronRight,
    Flag, ShieldOff, Shield, AlertTriangle, CheckCircle2, X,
    Trophy, Wallet, TrendingUp, Ban, Eye, MoreVertical
} from 'lucide-react';
import { useAdminUsers, AdminUser } from '@/hooks/admin/useAdminUsers';
import { useWallet } from '@solana/wallet-adapter-react';

const GAME_LABELS: Record<string, string> = { chess: 'Chess', codm: 'CODM', pubg: 'PUBG', free_fire: 'Free Fire' };

const statusConfig = {
    active: { label: 'Active', classes: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' },
    banned: { label: 'Banned', classes: 'bg-red-500/15 text-red-400 border border-red-500/30' },
    flagged: { label: 'Flagged', classes: 'bg-amber-500/15 text-amber-400 border border-amber-500/30' },
};

function StatusPill({ user }: { user: AdminUser }) {
    if (user.is_banned) return <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusConfig.banned.classes}`}>Banned</span>;
    if (user.is_flagged) return <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusConfig.flagged.classes}`}>Flagged</span>;
    return <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusConfig.active.classes}`}>Active</span>;
}

function StatChip({ icon: Icon, value, label, color }: { icon: any; value: string; label: string; color: string }) {
    return (
        <div className="flex items-center gap-1.5">
            <Icon className={`h-3.5 w-3.5 ${color}`} />
            <span className="text-xs text-muted-foreground">{label}:</span>
            <span className="text-xs font-semibold text-foreground">{value}</span>
        </div>
    );
}

function ConfirmDialog({
    title, description, confirmLabel, confirmClass,
    onConfirm, onCancel, loading, extra
}: {
    title: string; description: string; confirmLabel: string; confirmClass: string;
    onConfirm: (reason: string) => void; onCancel: () => void; loading: boolean;
    extra?: { placeholder: string; required: boolean };
}) {
    const [reason, setReason] = useState('');
    return (
        <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={onCancel}
        >
            <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0 }}
                className="glass rounded-2xl p-6 border border-primary/20 w-full max-w-md shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <h2 className="text-lg font-gaming font-bold text-foreground">{title}</h2>
                        <p className="text-sm text-muted-foreground mt-1">{description}</p>
                    </div>
                    <button onClick={onCancel} className="text-muted-foreground hover:text-foreground transition-colors ml-4 mt-0.5">
                        <X className="h-5 w-5" />
                    </button>
                </div>
                {extra && (
                    <input
                        type="text"
                        value={reason}
                        onChange={e => setReason(e.target.value)}
                        placeholder={extra.placeholder}
                        autoFocus
                        className="w-full px-4 py-2.5 bg-card border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-foreground placeholder:text-muted-foreground text-sm mb-4"
                    />
                )}
                <div className="flex gap-3">
                    <button onClick={onCancel}
                        className="flex-1 bg-card border border-border/50 hover:border-primary/50 text-foreground font-semibold py-2.5 px-4 rounded-xl transition-colors text-sm">
                        Cancel
                    </button>
                    <button
                        onClick={() => onConfirm(reason)}
                        disabled={loading || (extra?.required && !reason.trim())}
                        className={`flex-1 ${confirmClass} font-semibold py-2.5 px-4 rounded-xl transition-colors text-sm flex items-center justify-center gap-2 disabled:opacity-50`}
                    >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : confirmLabel}
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
}

function UserDrawer({ user, onClose, onAction, actionLoading }: {
    user: AdminUser; onClose: () => void;
    onAction: (action: string, wallet: string, extra?: Record<string, string>, msg?: string) => Promise<void>;
    actionLoading: string | null;
}) {
    const [showBanConfirm, setShowBanConfirm] = useState(false);
    const [showFlagConfirm, setShowFlagConfirm] = useState(false);

    const solEarnings = (user.total_earnings / 1e9).toFixed(4);
    const winRate = user.total_wins + user.total_losses > 0
        ? Math.round((user.total_wins / (user.total_wins + user.total_losses)) * 100)
        : 0;

    return (
        <>
            <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
                onClick={onClose}
            />
            <motion.div
                initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                className="fixed right-0 top-0 h-full w-full max-w-sm bg-card border-l border-border/60 z-50 flex flex-col shadow-2xl"
            >
                {/* Header */}
                <div className="p-6 border-b border-border/50">
                    <div className="flex items-start justify-between">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <h2 className="text-lg font-gaming font-bold text-foreground">
                                    {user.username || 'Unknown'}
                                </h2>
                                <StatusPill user={user} />
                            </div>
                            <p className="text-xs font-mono text-muted-foreground break-all">{user.wallet_address}</p>
                        </div>
                        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                {/* Stats */}
                <div className="p-6 border-b border-border/50 space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Stats</p>
                    <div className="grid grid-cols-2 gap-3">
                        {[
                            { label: 'Wins', value: user.total_wins.toString(), color: 'text-emerald-400' },
                            { label: 'Losses', value: user.total_losses.toString(), color: 'text-red-400' },
                            { label: 'Win Rate', value: `${winRate}%`, color: 'text-primary' },
                            { label: 'Earnings', value: `${solEarnings} SOL`, color: 'text-amber-400' },
                        ].map(s => (
                            <div key={s.label} className="bg-background/50 rounded-xl p-3">
                                <p className="text-xs text-muted-foreground mb-0.5">{s.label}</p>
                                <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
                            </div>
                        ))}
                    </div>
                    <div className="bg-background/50 rounded-xl p-3">
                        <p className="text-xs text-muted-foreground mb-0.5">Joined</p>
                        <p className="text-sm text-foreground">{new Date(user.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    </div>
                </div>

                {/* Status info */}
                {(user.ban_reason || user.flag_reason) && (
                    <div className="px-6 py-4 border-b border-border/50 space-y-2">
                        {user.ban_reason && (
                            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                                <p className="text-xs text-red-400 font-semibold mb-0.5">Ban reason</p>
                                <p className="text-xs text-foreground">{user.ban_reason}</p>
                            </div>
                        )}
                        {user.flag_reason && (
                            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                                <p className="text-xs text-amber-400 font-semibold mb-0.5">Flag reason</p>
                                <p className="text-xs text-foreground">{user.flag_reason}</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Actions */}
                <div className="p-6 space-y-3 mt-auto">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</p>
                    {user.is_banned ? (
                        <button
                            onClick={() => onAction('unbanPlayer', user.wallet_address, {}, 'Player unbanned')}
                            disabled={actionLoading === user.wallet_address}
                            className="w-full flex items-center justify-center gap-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-400 font-semibold py-2.5 px-4 rounded-xl transition-colors text-sm disabled:opacity-50"
                        >
                            {actionLoading === user.wallet_address ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldOff className="h-4 w-4" />}
                            Unban Player
                        </button>
                    ) : (
                        <button
                            onClick={() => setShowBanConfirm(true)}
                            disabled={actionLoading === user.wallet_address}
                            className="w-full flex items-center justify-center gap-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 font-semibold py-2.5 px-4 rounded-xl transition-colors text-sm disabled:opacity-50"
                        >
                            <Ban className="h-4 w-4" />
                            Ban Player
                        </button>
                    )}
                    {user.is_flagged ? (
                        <button
                            onClick={() => onAction('unflagPlayer', user.wallet_address, {}, 'Flag cleared').then(onClose)}
                            disabled={actionLoading === user.wallet_address}
                            className="w-full flex items-center justify-center gap-2 bg-card border border-border/50 hover:border-primary/50 text-foreground font-semibold py-2.5 px-4 rounded-xl transition-colors text-sm disabled:opacity-50"
                        >
                            {actionLoading === user.wallet_address ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flag className="h-4 w-4 fill-amber-400 text-amber-400" />}
                            Clear Flag
                        </button>
                    ) : (
                        <button
                            onClick={() => setShowFlagConfirm(true)}
                            disabled={actionLoading === user.wallet_address}
                            className="w-full flex items-center justify-center gap-2 bg-card border border-border/50 hover:border-amber-500/40 text-muted-foreground hover:text-amber-400 font-semibold py-2.5 px-4 rounded-xl transition-colors text-sm disabled:opacity-50"
                        >
                            <Flag className="h-4 w-4" />
                            Flag for Review
                        </button>
                    )}
                </div>
            </motion.div>

            <AnimatePresence>
                {showBanConfirm && (
                    <ConfirmDialog
                        title="Ban Player"
                        description={`Ban ${user.username || user.wallet_address.slice(0, 8)}? They will be locked out immediately.`}
                        confirmLabel="Confirm Ban"
                        confirmClass="bg-red-500 hover:bg-red-500/90 text-white"
                        onConfirm={async (reason) => {
                            await onAction('banPlayer', user.wallet_address, { reason }, 'Player banned');
                            setShowBanConfirm(false);
                            onClose();
                        }}
                        onCancel={() => setShowBanConfirm(false)}
                        loading={actionLoading === user.wallet_address}
                        extra={{ placeholder: 'Reason for ban (required)', required: true }}
                    />
                )}
                {showFlagConfirm && (
                    <ConfirmDialog
                        title="Flag for Review"
                        description={`Flag ${user.username || user.wallet_address.slice(0, 8)} for admin review.`}
                        confirmLabel="Confirm Flag"
                        confirmClass="bg-amber-500 hover:bg-amber-500/90 text-black"
                        onConfirm={async (reason) => {
                            await onAction('flagPlayer', user.wallet_address, { reason }, 'Player flagged');
                            setShowFlagConfirm(false);
                            onClose();
                        }}
                        onCancel={() => setShowFlagConfirm(false)}
                        loading={actionLoading === user.wallet_address}
                        extra={{ placeholder: 'Reason for flagging (required)', required: true }}
                    />
                )}
            </AnimatePresence>
        </>
    );
}

function UsersContent() {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'banned' | 'flagged'>('all');
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
    const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
    const searchTimeout = useRef<NodeJS.Timeout | null>(null);
    const { publicKey } = useWallet();

    const { users, loading, error, total, offset, limit, fetchUsers, nextPage, prevPage, hasNextPage, hasPrevPage } = useAdminUsers();

    const showToast = (type: 'success' | 'error', msg: string) => {
        setToast({ type, msg });
        setTimeout(() => setToast(null), 3500);
    };

    const handleSearch = (value: string) => {
        setSearchTerm(value);
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        searchTimeout.current = setTimeout(() => fetchUsers(0, value || undefined), 400);
    };

    const doAction = async (action: string, playerWallet: string, extra: Record<string, string> = {}, successMsg: string) => {
        if (!publicKey) { showToast('error', 'Connect your wallet first'); return; }
        setActionLoading(playerWallet);
        try {
            const res = await fetch('/api/admin/action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ action, adminWallet: publicKey.toBase58(), playerWallet, ...extra }),
            });
            const result = await res.json();
            if (!result.success) throw new Error(result.error || 'Action failed');
            showToast('success', successMsg);
            fetchUsers(offset, searchTerm || undefined);
            // Update selectedUser in place
            setSelectedUser(prev => {
                if (!prev || prev.wallet_address !== playerWallet) return prev;
                const updates: Partial<AdminUser> = {};
                if (action === 'banPlayer') { updates.is_banned = true; updates.ban_reason = extra.reason || ''; }
                if (action === 'unbanPlayer') { updates.is_banned = false; updates.ban_reason = ''; }
                if (action === 'flagPlayer') { updates.is_flagged = true; updates.flag_reason = extra.reason || ''; }
                if (action === 'unflagPlayer') { updates.is_flagged = false; updates.flag_reason = ''; }
                return { ...prev, ...updates };
            });
        } catch (err) {
            showToast('error', err instanceof Error ? err.message : 'Action failed');
        } finally {
            setActionLoading(null);
        }
    };

    // Client-side filter on top of server results
    const filteredUsers = users.filter(user => {
        if (filterStatus === 'banned') return user.is_banned;
        if (filterStatus === 'active') return !user.is_banned && !user.is_flagged;
        if (filterStatus === 'flagged') return user.is_flagged;
        return true;
    });

    const currentPage = Math.floor(offset / limit) + 1;
    const totalPages = Math.ceil(total / limit);

    return (
        <ProtectedRoute>
            <div className="space-y-6">

                {/* Toast */}
                <AnimatePresence>
                    {toast && (
                        <motion.div
                            initial={{ opacity: 0, y: -20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -20, scale: 0.95 }}
                            className={`fixed top-20 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border text-sm font-medium
                                ${toast.type === 'success'
                                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                                    : 'bg-red-500/15 border-red-500/30 text-red-400'}`}
                        >
                            {toast.type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
                            {toast.msg}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Header */}
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 rounded-xl p-3 border border-blue-500/20">
                            <UsersIcon className="h-6 w-6 text-blue-400" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-gaming font-bold text-glow">User Management</h1>
                            <p className="text-muted-foreground text-sm">
                                {total > 0 ? `${total.toLocaleString()} registered players` : 'Loading...'}
                            </p>
                        </div>
                    </div>
                    {/* Status counts */}
                    <div className="hidden md:flex items-center gap-3">
                        {[
                            { key: 'all', label: 'All', count: total },
                            { key: 'active', label: 'Active', count: users.filter(u => !u.is_banned && !u.is_flagged).length },
                            { key: 'flagged', label: 'Flagged', count: users.filter(u => u.is_flagged).length },
                            { key: 'banned', label: 'Banned', count: users.filter(u => u.is_banned).length },
                        ].map(({ key, label, count }) => (
                            <button
                                key={key}
                                onClick={() => setFilterStatus(key as typeof filterStatus)}
                                className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors ${filterStatus === key
                                    ? 'bg-primary/20 text-primary border border-primary/30'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-card'}`}
                            >
                                {label} <span className="opacity-70">({count})</span>
                            </button>
                        ))}
                    </div>
                </motion.div>

                {/* Error */}
                {error && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl flex items-center gap-2 text-sm">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        {error}
                    </motion.div>
                )}

                {/* Search bar */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                    className="glass rounded-2xl p-4 border border-primary/20">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Search by wallet address or username..."
                                value={searchTerm}
                                onChange={e => handleSearch(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-card border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-foreground placeholder:text-muted-foreground text-sm"
                            />
                        </div>
                        {/* Mobile filter */}
                        <select
                            value={filterStatus}
                            onChange={e => setFilterStatus(e.target.value as typeof filterStatus)}
                            className="sm:hidden bg-card border border-border/50 rounded-xl px-3 py-2.5 text-sm focus:outline-none text-foreground"
                        >
                            <option value="all">All Users</option>
                            <option value="active">Active</option>
                            <option value="flagged">Flagged</option>
                            <option value="banned">Banned</option>
                        </select>
                    </div>
                </motion.div>

                {/* Table */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                    className="glass rounded-2xl overflow-hidden border border-primary/20">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="flex flex-col items-center gap-3">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                <p className="text-sm text-muted-foreground">Loading users...</p>
                            </div>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-border/50 bg-card/40">
                                        <th className="px-5 py-3.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Player</th>
                                        <th className="px-5 py-3.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">W / L</th>
                                        <th className="px-5 py-3.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Earnings</th>
                                        <th className="px-5 py-3.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                                        <th className="px-5 py-3.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Joined</th>
                                        <th className="px-5 py-3.5 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/30">
                                    {filteredUsers.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-5 py-16 text-center text-muted-foreground text-sm">
                                                {searchTerm ? `No users matching "${searchTerm}"` : 'No users found.'}
                                            </td>
                                        </tr>
                                    ) : filteredUsers.map((user, i) => (
                                        <motion.tr
                                            key={user.wallet_address}
                                            initial={{ opacity: 0, y: 4 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: i * 0.02 }}
                                            className="hover:bg-card/40 transition-colors group cursor-pointer"
                                            onClick={() => setSelectedUser(user)}
                                        >
                                            <td className="px-5 py-4">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                                                        {user.username || <span className="text-muted-foreground italic font-normal">Unnamed</span>}
                                                    </span>
                                                    <span className="text-xs font-mono text-muted-foreground">
                                                        {user.wallet_address.slice(0, 8)}...{user.wallet_address.slice(-4)}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4">
                                                <span className="text-sm text-emerald-400 font-semibold">{user.total_wins}W</span>
                                                <span className="text-muted-foreground mx-1 text-xs">/</span>
                                                <span className="text-sm text-red-400 font-semibold">{user.total_losses}L</span>
                                            </td>
                                            <td className="px-5 py-4">
                                                <span className="text-sm font-semibold text-amber-400">
                                                    {(user.total_earnings / 1e9).toFixed(4)} SOL
                                                </span>
                                            </td>
                                            <td className="px-5 py-4">
                                                <StatusPill user={user} />
                                            </td>
                                            <td className="px-5 py-4 text-xs text-muted-foreground">
                                                {new Date(user.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="px-5 py-4 text-right">
                                                <button
                                                    onClick={e => { e.stopPropagation(); setSelectedUser(user); }}
                                                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-card transition-colors opacity-0 group-hover:opacity-100"
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </button>
                                            </td>
                                        </motion.tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Pagination */}
                    {total > limit && (
                        <div className="flex items-center justify-between px-5 py-4 border-t border-border/30 bg-card/20">
                            <span className="text-sm text-muted-foreground">
                                Page {currentPage} of {totalPages} · <span className="font-semibold text-foreground">{total.toLocaleString()}</span> users
                            </span>
                            <div className="flex items-center gap-2">
                                <button onClick={prevPage} disabled={!hasPrevPage || loading}
                                    className="p-2 rounded-lg bg-card border border-border/50 hover:border-primary/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                                    <ChevronLeft className="h-4 w-4" />
                                </button>
                                <button onClick={nextPage} disabled={!hasNextPage || loading}
                                    className="p-2 rounded-lg bg-card border border-border/50 hover:border-primary/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </motion.div>

                {/* User drawer */}
                <AnimatePresence>
                    {selectedUser && (
                        <UserDrawer
                            user={selectedUser}
                            onClose={() => setSelectedUser(null)}
                            onAction={doAction}
                            actionLoading={actionLoading}
                        />
                    )}
                </AnimatePresence>
            </div>
        </ProtectedRoute>
    );
}

export default function UsersPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
            <UsersContent />
        </Suspense>
    );
}