'use client';

import { Suspense, useState, useCallback } from 'react';
import { ProtectedRoute } from '@/components/admin';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Dices, Search, Loader2, ChevronLeft, ChevronRight, AlertTriangle,
    CheckCircle2, X, RefreshCcw, Filter, ExternalLink, Copy, Check,
    Swords, Clock, Trophy, Ban, RotateCcw, Shield, ChevronDown
} from 'lucide-react';
import { useAdminWagers, AdminWager } from '@/hooks/admin/useAdminWagers';
import { useWallet } from '@solana/wallet-adapter-react';

type WagerStatus = 'all' | 'created' | 'joined' | 'voting' | 'retractable' | 'disputed' | 'resolved' | 'cancelled';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
    created: { label: 'Open', color: 'text-blue-400', bg: 'bg-blue-500/15', border: 'border-blue-500/30' },
    joined: { label: 'Live', color: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30' },
    voting: { label: 'Voting', color: 'text-purple-400', bg: 'bg-purple-500/15', border: 'border-purple-500/30' },
    retractable: { label: 'Retractable', color: 'text-cyan-400', bg: 'bg-cyan-500/15', border: 'border-cyan-500/30' },
    disputed: { label: 'Disputed', color: 'text-amber-400', bg: 'bg-amber-500/15', border: 'border-amber-500/30' },
    resolved: { label: 'Resolved', color: 'text-slate-400', bg: 'bg-slate-500/15', border: 'border-slate-500/30' },
    cancelled: { label: 'Cancelled', color: 'text-red-400', bg: 'bg-red-500/15', border: 'border-red-500/30' },
};

const GAME_CONFIG: Record<string, { label: string; icon: string }> = {
    chess: { label: 'Chess', icon: '♟️' },
    codm: { label: 'CODM', icon: '🎯' },
    pubg: { label: 'PUBG', icon: '🪖' },
    free_fire: { label: 'Free Fire', icon: '🔥' },
};

function StatusBadge({ status }: { status: string }) {
    const cfg = STATUS_CONFIG[status] || { label: status, color: 'text-muted-foreground', bg: 'bg-muted/20', border: 'border-border/30' };
    return (
        <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full border ${cfg.color} ${cfg.bg} ${cfg.border}`}>
            {cfg.label}
        </span>
    );
}

function GameBadge({ game }: { game: string }) {
    const cfg = GAME_CONFIG[game] || { label: game, icon: '🎮' };
    return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-card/60 border border-border/40 px-2.5 py-1 rounded-full">
            <span>{cfg.icon}</span>{cfg.label}
        </span>
    );
}

function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);
    const copy = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };
    return (
        <button onClick={copy} className="text-muted-foreground hover:text-primary transition-colors p-0.5">
            {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
        </button>
    );
}

function WagerDrawer({ wager, onClose, onAction, actionLoading }: {
    wager: AdminWager & Record<string, any>;
    onClose: () => void;
    onAction: (action: string, wagerId: string, extra?: Record<string, unknown>) => Promise<void>;
    actionLoading: string | null;
}) {
    const [resolveStep, setResolveStep] = useState<null | 'pick' | 'confirm'>(null);
    const [resolveWinner, setResolveWinner] = useState<string | null>(null);
    const [refundStep, setRefundStep] = useState(false);
    const [confirmText, setConfirmText] = useState('');

    const solAmount = (wager.stake_lamports / 1e9).toFixed(4);
    const isActive = !['resolved', 'cancelled'].includes(wager.status);

    const shortWallet = (w: string) => w ? `${w.slice(0, 8)}...${w.slice(-4)}` : '—';

    return (
        <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
            <motion.div
                initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                className="fixed right-0 top-0 h-full w-full max-w-md bg-card border-l border-border/60 z-50 flex flex-col shadow-2xl overflow-y-auto"
            >
                {/* Header */}
                <div className="p-6 border-b border-border/50 sticky top-0 bg-card z-10">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                            <div className="text-xl">{GAME_CONFIG[wager.game]?.icon || '🎮'}</div>
                            <div>
                                <div className="flex items-center gap-2 mb-0.5">
                                    <span className="text-sm font-gaming font-bold text-foreground">#{wager.match_id}</span>
                                    <StatusBadge status={wager.status || 'unknown'} />
                                </div>
                                <p className="text-xs font-mono text-muted-foreground">{wager.id.slice(0, 16)}...</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 p-6 space-y-5">
                    {/* Stake */}
                    <div className="bg-background/50 rounded-2xl p-4 border border-border/30">
                        <p className="text-xs text-muted-foreground mb-1">Total Pot</p>
                        <p className="text-2xl font-gaming font-bold text-amber-400">{(wager.stake_lamports * 2 / 1e9).toFixed(4)} SOL</p>
                        <p className="text-xs text-muted-foreground">{solAmount} SOL per player</p>
                    </div>

                    {/* Players */}
                    <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Players</p>
                        <div className="space-y-2">
                            {[
                                { label: 'Player A', wallet: wager.player_a_wallet, vote: wager.vote_player_a },
                                { label: 'Player B', wallet: wager.player_b_wallet, vote: wager.vote_player_b },
                            ].map(({ label, wallet, vote }) => (
                                <div key={label} className="bg-background/50 rounded-xl p-3 border border-border/30">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs text-muted-foreground font-semibold">{label}</span>
                                        {vote && <span className="text-xs text-purple-400 font-semibold">Voted: {shortWallet(vote)}</span>}
                                    </div>
                                    {wallet ? (
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-xs font-mono text-foreground">{shortWallet(wallet)}</span>
                                            <CopyButton text={wallet} />
                                        </div>
                                    ) : <span className="text-xs text-muted-foreground italic">Not joined yet</span>}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Winner */}
                    {wager.winner_wallet && (
                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
                            <p className="text-xs text-emerald-400 font-semibold mb-1">Winner</p>
                            <div className="flex items-center gap-1.5">
                                <span className="text-xs font-mono text-foreground">{shortWallet(wager.winner_wallet)}</span>
                                <CopyButton text={wager.winner_wallet} />
                            </div>
                        </div>
                    )}

                    {/* Dispute info */}
                    {wager.status === 'disputed' && (
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 space-y-1">
                            <p className="text-xs font-semibold text-amber-400">⚠️ Disputed</p>
                            {wager.dispute_created_at && (
                                <p className="text-xs text-muted-foreground">
                                    Disputed {new Date(wager.dispute_created_at).toLocaleString()}
                                </p>
                            )}
                            {wager.grace_conceded_by && (
                                <p className="text-xs text-emerald-400">Grace conceded by {shortWallet(wager.grace_conceded_by)}</p>
                            )}
                        </div>
                    )}

                    {/* Timestamps */}
                    <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Timeline</p>
                        <div className="space-y-1">
                            {[
                                { label: 'Created', val: wager.created_at },
                                { label: 'Resolved', val: wager.resolved_at },
                                { label: 'Cancelled', val: wager.cancelled_at },
                            ].filter(t => t.val).map(t => (
                                <div key={t.label} className="flex justify-between text-xs">
                                    <span className="text-muted-foreground">{t.label}</span>
                                    <span className="text-foreground">{new Date(t.val!).toLocaleString()}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Lichess link */}
                    {wager.lichess_game_id && (
                        <a
                            href={`https://lichess.org/${wager.lichess_game_id}`}
                            target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-2 text-xs text-primary hover:underline"
                        >
                            <ExternalLink className="h-3.5 w-3.5" />
                            View on Lichess
                        </a>
                    )}
                </div>

                {/* Actions footer */}
                {isActive && wager.player_b_wallet && (
                    <div className="p-6 border-t border-border/50 space-y-3 sticky bottom-0 bg-card">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Admin Actions</p>

                        {/* Force Resolve */}
                        {resolveStep === null && refundStep === false && (
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setResolveStep('pick')}
                                    className="flex-1 flex items-center justify-center gap-2 bg-primary/20 hover:bg-primary/30 border border-primary/30 text-primary font-semibold py-2.5 px-4 rounded-xl transition-colors text-sm"
                                >
                                    <Trophy className="h-4 w-4" />
                                    Force Resolve
                                </button>
                                <button
                                    onClick={() => setRefundStep(true)}
                                    className="flex-1 flex items-center justify-center gap-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 font-semibold py-2.5 px-4 rounded-xl transition-colors text-sm"
                                >
                                    <RotateCcw className="h-4 w-4" />
                                    Force Refund
                                </button>
                            </div>
                        )}

                        {/* Resolve: pick winner */}
                        {resolveStep === 'pick' && (
                            <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
                                <p className="text-xs text-muted-foreground">Select winner:</p>
                                {[
                                    { label: 'Player A wins', wallet: wager.player_a_wallet },
                                    { label: 'Player B wins', wallet: wager.player_b_wallet },
                                ].map(({ label, wallet }) => (
                                    <button
                                        key={wallet}
                                        onClick={() => { setResolveWinner(wallet); setResolveStep('confirm'); }}
                                        className="w-full text-left px-4 py-2.5 text-sm bg-background/50 border border-border/40 hover:border-primary/40 rounded-xl transition-colors text-foreground"
                                    >
                                        <span className="font-semibold">{label}</span>
                                        <span className="text-xs text-muted-foreground ml-2 font-mono">{shortWallet(wallet)}</span>
                                    </button>
                                ))}
                                <button onClick={() => setResolveStep(null)} className="w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                                    Cancel
                                </button>
                            </motion.div>
                        )}

                        {/* Resolve: confirm */}
                        {resolveStep === 'confirm' && resolveWinner && (
                            <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                                <div className="bg-primary/10 border border-primary/20 rounded-xl p-3">
                                    <p className="text-xs text-muted-foreground">Winner will be:</p>
                                    <p className="text-sm font-mono text-primary font-semibold">{shortWallet(resolveWinner)}</p>
                                </div>
                                <p className="text-xs text-muted-foreground">Type <span className="text-foreground font-mono font-bold">CONFIRM</span> to proceed:</p>
                                <input
                                    type="text"
                                    value={confirmText}
                                    onChange={e => setConfirmText(e.target.value.toUpperCase())}
                                    placeholder="Type CONFIRM..."
                                    autoFocus
                                    className="w-full px-4 py-2.5 bg-background border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-foreground text-sm"
                                />
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => { setResolveStep(null); setResolveWinner(null); setConfirmText(''); }}
                                        className="flex-1 py-2.5 text-sm bg-card border border-border/50 text-foreground rounded-xl hover:border-primary/40 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={async () => {
                                            await onAction('forceResolve', wager.id, { winnerWallet: resolveWinner, notes: 'Admin force resolved' });
                                            setResolveStep(null); setResolveWinner(null); setConfirmText(''); onClose();
                                        }}
                                        disabled={confirmText !== 'CONFIRM' || actionLoading === wager.id}
                                        className="flex-1 py-2.5 text-sm bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {actionLoading === wager.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm'}
                                    </button>
                                </div>
                            </motion.div>
                        )}

                        {/* Refund: confirm */}
                        {refundStep && (
                            <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                                    <p className="text-xs text-red-400 font-semibold">Refund both players in full</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">Each player gets {solAmount} SOL back.</p>
                                </div>
                                <p className="text-xs text-muted-foreground">Type <span className="text-foreground font-mono font-bold">CONFIRM</span> to proceed:</p>
                                <input
                                    type="text"
                                    value={confirmText}
                                    onChange={e => setConfirmText(e.target.value.toUpperCase())}
                                    placeholder="Type CONFIRM..."
                                    autoFocus
                                    className="w-full px-4 py-2.5 bg-background border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-foreground text-sm"
                                />
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => { setRefundStep(false); setConfirmText(''); }}
                                        className="flex-1 py-2.5 text-sm bg-card border border-border/50 text-foreground rounded-xl hover:border-primary/40 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={async () => {
                                            await onAction('forceRefund', wager.id, { notes: 'Admin force refund' });
                                            setRefundStep(false); setConfirmText(''); onClose();
                                        }}
                                        disabled={confirmText !== 'CONFIRM' || actionLoading === wager.id}
                                        className="flex-1 py-2.5 text-sm bg-red-500 hover:bg-red-500/90 text-white rounded-xl font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {actionLoading === wager.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm Refund'}
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </div>
                )}
            </motion.div>
        </>
    );
}

function WagersContent() {
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<WagerStatus>('all');
    const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
    const [selectedWager, setSelectedWager] = useState<AdminWager & Record<string, any> | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const { publicKey } = useWallet();

    const { wagers, loading, error, total, offset, limit, fetchWagers, refreshWagers, nextPage, prevPage, hasNextPage, hasPrevPage } = useAdminWagers();

    const showToast = (type: 'success' | 'error', msg: string) => {
        setToast({ type, msg });
        setTimeout(() => setToast(null), 3500);
    };

    const handleStatusFilter = (s: WagerStatus) => {
        setStatusFilter(s);
        fetchWagers(0, s === 'all' ? undefined : s);
    };

    const doAction = async (action: string, wagerId: string, extra: Record<string, unknown> = {}) => {
        if (!publicKey) { showToast('error', 'Connect your wallet first'); return; }
        setActionLoading(wagerId);
        try {
            const res = await fetch('/api/admin/action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ action, adminWallet: publicKey.toBase58(), wagerId, ...extra }),
            });
            const result = await res.json();
            if (!result.success) throw new Error(result.error || 'Action failed');
            showToast('success', `${action} completed`);
            refreshWagers();
        } catch (err) {
            showToast('error', err instanceof Error ? err.message : 'Action failed');
        } finally {
            setActionLoading(null);
        }
    };

    const filteredWagers = wagers.filter(w => {
        if (!searchTerm) return true;
        const q = searchTerm.toLowerCase();
        return w.id.toLowerCase().includes(q) ||
            w.player_a_wallet.toLowerCase().includes(q) ||
            (w.player_b_wallet?.toLowerCase().includes(q) ?? false) ||
            (w.winner_wallet?.toLowerCase().includes(q) ?? false);
    });

    const currentPage = Math.floor(offset / limit) + 1;
    const totalPages = Math.ceil(total / limit);
    const statusCounts = wagers.reduce((acc, w) => { acc[w.status] = (acc[w.status] || 0) + 1; return acc; }, {} as Record<string, number>);

    return (
        <ProtectedRoute>
            <div className="space-y-6">

                {/* Toast */}
                <AnimatePresence>
                    {toast && (
                        <motion.div initial={{ opacity: 0, y: -20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -20, scale: 0.95 }}
                            className={`fixed top-20 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border text-sm font-medium
                                ${toast.type === 'success' ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' : 'bg-red-500/15 border-red-500/30 text-red-400'}`}>
                            {toast.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                            {toast.msg}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Header */}
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/20 rounded-xl p-3 border border-purple-500/20">
                            <Dices className="h-6 w-6 text-purple-400" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-gaming font-bold text-glow">Wager Management</h1>
                            <p className="text-sm text-muted-foreground">{total.toLocaleString()} total wagers</p>
                        </div>
                    </div>
                    <button onClick={refreshWagers} disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-card border border-border/50 hover:border-primary/40 rounded-xl text-sm text-foreground transition-colors disabled:opacity-50">
                        <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        <span className="hidden sm:inline">Refresh</span>
                    </button>
                </motion.div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl flex items-center gap-2 text-sm">
                        <AlertTriangle className="h-4 w-4" />{error}
                    </div>
                )}

                {/* Filters */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                    className="glass rounded-2xl p-4 border border-primary/20 space-y-3">
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search by wager ID or wallet address..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-card border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-foreground placeholder:text-muted-foreground text-sm"
                        />
                    </div>
                    {/* Status filters */}
                    <div className="flex flex-wrap gap-2">
                        {(['all', 'created', 'joined', 'voting', 'disputed', 'resolved', 'cancelled'] as WagerStatus[]).map(s => {
                            const cfg = STATUS_CONFIG[s];
                            const count = s === 'all' ? total : statusCounts[s] || 0;
                            return (
                                <button key={s} onClick={() => handleStatusFilter(s)}
                                    className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors border ${statusFilter === s
                                        ? `${cfg?.bg || 'bg-primary/20'} ${cfg?.color || 'text-primary'} ${cfg?.border || 'border-primary/30'}`
                                        : 'bg-card border-border/40 text-muted-foreground hover:text-foreground hover:border-primary/30'}`}>
                                    {cfg?.label || 'All'} {count > 0 && <span className="opacity-70">({count})</span>}
                                </button>
                            );
                        })}
                    </div>
                </motion.div>

                {/* Table */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                    className="glass rounded-2xl overflow-hidden border border-primary/20">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-border/50 bg-card/40">
                                        <th className="px-5 py-3.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Match</th>
                                        <th className="px-5 py-3.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Players</th>
                                        <th className="px-5 py-3.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Stake</th>
                                        <th className="px-5 py-3.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Game</th>
                                        <th className="px-5 py-3.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                                        <th className="px-5 py-3.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Created</th>
                                        <th className="px-5 py-3.5 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/30">
                                    {filteredWagers.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="px-5 py-16 text-center text-muted-foreground text-sm">
                                                No wagers found.
                                            </td>
                                        </tr>
                                    ) : filteredWagers.map((wager, i) => {
                                        const w = wager as AdminWager & Record<string, any>;
                                        return (
                                            <motion.tr key={wager.id}
                                                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.015 }}
                                                className={`hover:bg-card/40 transition-colors cursor-pointer group ${wager.status === 'disputed' ? 'bg-amber-500/5' : ''}`}
                                                onClick={() => setSelectedWager(w)}>
                                                <td className="px-5 py-4">
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="text-sm font-gaming font-bold text-foreground group-hover:text-primary transition-colors">#{w.match_id}</span>
                                                        <span className="text-xs font-mono text-muted-foreground">{wager.id.slice(0, 8)}...</span>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="text-xs font-mono text-foreground">{wager.player_a_wallet.slice(0, 6)}...</span>
                                                        {wager.player_b_wallet
                                                            ? <span className="text-xs font-mono text-muted-foreground">vs {wager.player_b_wallet.slice(0, 6)}...</span>
                                                            : <span className="text-xs text-muted-foreground italic">waiting...</span>
                                                        }
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <span className="text-sm font-semibold text-amber-400">{(wager.stake_lamports / 1e9).toFixed(3)} SOL</span>
                                                </td>
                                                <td className="px-5 py-4"><GameBadge game={wager.game} /></td>
                                                <td className="px-5 py-4"><StatusBadge status={wager.status || 'unknown'} /></td>
                                                <td className="px-5 py-4 text-xs text-muted-foreground whitespace-nowrap">
                                                    {new Date(wager.created_at).toLocaleDateString()}
                                                </td>
                                                <td className="px-5 py-4 text-right">
                                                    <button
                                                        onClick={e => { e.stopPropagation(); setSelectedWager(w); }}
                                                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-card transition-all"
                                                    >
                                                        <ChevronDown className="h-4 w-4 -rotate-90" />
                                                    </button>
                                                </td>
                                            </motion.tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {total > limit && (
                        <div className="flex items-center justify-between px-5 py-4 border-t border-border/30 bg-card/20">
                            <span className="text-sm text-muted-foreground">
                                Page {currentPage} of {totalPages} · <span className="font-semibold text-foreground">{total.toLocaleString()}</span> wagers
                            </span>
                            <div className="flex gap-2">
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

                {/* Drawer */}
                <AnimatePresence>
                    {selectedWager && (
                        <WagerDrawer
                            wager={selectedWager}
                            onClose={() => setSelectedWager(null)}
                            onAction={doAction}
                            actionLoading={actionLoading}
                        />
                    )}
                </AnimatePresence>
            </div>
        </ProtectedRoute>
    );
}

export default function WagersPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
            <WagersContent />
        </Suspense>
    );
}