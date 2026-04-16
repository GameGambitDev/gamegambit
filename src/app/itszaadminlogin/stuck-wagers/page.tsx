'use client';

import { Suspense, useState, useCallback } from 'react';
import { ProtectedRoute } from '@/components/admin';
import { motion, AnimatePresence } from 'framer-motion';
import {
    AlertTriangle, Loader2, RefreshCcw, ChevronLeft, ChevronRight,
    Copy, Check, ExternalLink, Trophy, RotateCcw, X, Clock,
    CheckCircle2, ChevronDown, Filter, Layers,
} from 'lucide-react';
import {
    useStuckWagers,
    STUCK_PAGE_SIZE_OPTIONS,
    STUCK_THRESHOLD_OPTIONS,
    type StuckPageSize,
    type AdminWager,
} from '@/hooks/admin/useAdminWagers';
import { useWallet } from '@solana/wallet-adapter-react';

// ── Helpers ──────────────────────────────────────────────────────────────────

function shortWallet(w: string) {
    return w ? `${w.slice(0, 8)}...${w.slice(-4)}` : '—';
}

function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const h = Math.floor(diff / 3_600_000);
    const m = Math.floor((diff % 3_600_000) / 60_000);
    if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h ago`;
    if (h > 0) return `${h}h ${m}m ago`;
    return `${m}m ago`;
}

function solAmount(lamports: number) {
    return (lamports / 1e9).toFixed(4);
}

// ── CopyButton ────────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);
    return (
        <button
            onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            className="text-muted-foreground hover:text-primary transition-colors p-0.5"
        >
            {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
        </button>
    );
}

// ── Stuck severity badge ──────────────────────────────────────────────────────

function StalenessTag({ createdAt }: { createdAt: string }) {
    const hours = (Date.now() - new Date(createdAt).getTime()) / 3_600_000;
    if (hours >= 72) return (
        <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/40 text-red-400">
            🔴 {Math.floor(hours / 24)}d stuck
        </span>
    );
    if (hours >= 24) return (
        <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-orange-500/20 border border-orange-500/40 text-orange-400">
            🟠 {Math.floor(hours)}h stuck
        </span>
    );
    return (
        <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-yellow-500/20 border border-yellow-500/40 text-yellow-400">
            🟡 {Math.floor(hours)}h stuck
        </span>
    );
}

// ── Wager detail drawer ───────────────────────────────────────────────────────

function StuckWagerDrawer({
    wager,
    onClose,
    onAction,
    actionLoading,
}: {
    wager: AdminWager & Record<string, unknown>;
    onClose: () => void;
    onAction: (action: string, wagerId: string, extra?: Record<string, unknown>) => Promise<void>;
    actionLoading: string | null;
}) {
    const [resolveStep, setResolveStep] = useState<null | 'pick' | 'confirm'>(null);
    const [resolveWinner, setResolveWinner] = useState<string | null>(null);
    const [refundStep, setRefundStep] = useState(false);
    const [confirmText, setConfirmText] = useState('');
    const stake = solAmount(wager.stake_lamports);

    return (
        <>
            <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
                onClick={onClose}
            />
            <motion.div
                initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                className="fixed right-0 top-0 h-full w-full max-w-md bg-card border-l border-border/60 z-50 flex flex-col shadow-2xl overflow-y-auto"
            >
                {/* Header */}
                <div className="p-6 border-b border-border/50 sticky top-0 bg-card z-10">
                    <div className="flex items-start justify-between">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <AlertTriangle className="h-4 w-4 text-amber-400" />
                                <span className="text-sm font-bold text-foreground font-gaming">#{wager.match_id}</span>
                                <StalenessTag createdAt={wager.created_at} />
                            </div>
                            <p className="text-xs font-mono text-muted-foreground">{wager.id.slice(0, 20)}...</p>
                        </div>
                        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 p-6 space-y-5">
                    {/* Pot */}
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4">
                        <p className="text-xs text-muted-foreground mb-1">Locked in Escrow</p>
                        <p className="text-2xl font-gaming font-bold text-amber-400">{solAmount(wager.stake_lamports * 2)} SOL</p>
                        <p className="text-xs text-muted-foreground">{stake} SOL per player</p>
                    </div>

                    {/* Deposit status */}
                    <div className="bg-background/50 rounded-2xl p-4 border border-border/30 space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Deposit Status</p>
                        {[
                            { label: 'Player A', deposited: wager.deposit_player_a, wallet: wager.player_a_wallet as string, tx: wager.tx_signature_a as string | null },
                            { label: 'Player B', deposited: wager.deposit_player_b, wallet: wager.player_b_wallet as string | null, tx: wager.tx_signature_b as string | null },
                        ].map(({ label, deposited, wallet, tx }) => (
                            <div key={label} className="flex items-center justify-between bg-card/60 rounded-xl px-3 py-2 border border-border/30">
                                <div>
                                    <p className="text-xs font-semibold text-muted-foreground">{label}</p>
                                    {wallet
                                        ? <div className="flex items-center gap-1 mt-0.5">
                                            <span className="text-xs font-mono text-foreground">{shortWallet(wallet)}</span>
                                            <CopyButton text={wallet} />
                                        </div>
                                        : <span className="text-xs text-muted-foreground italic">Not joined</span>
                                    }
                                    {tx && (
                                        <a
                                            href={`https://solscan.io/tx/${tx}`}
                                            target="_blank" rel="noopener noreferrer"
                                            className="flex items-center gap-1 text-xs text-primary hover:underline mt-0.5"
                                        >
                                            <ExternalLink className="h-3 w-3" />Tx
                                        </a>
                                    )}
                                </div>
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${deposited
                                    ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                                    : 'text-red-400 bg-red-500/10 border-red-500/30'
                                    }`}>
                                    {deposited ? '✓ Deposited' : '✗ Not deposited'}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Votes */}
                    {(wager.vote_player_a || wager.vote_player_b) && (
                        <div className="bg-background/50 rounded-2xl p-4 border border-border/30 space-y-2">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Votes Submitted</p>
                            {[
                                { label: 'Player A voted', val: wager.vote_player_a as string | null },
                                { label: 'Player B voted', val: wager.vote_player_b as string | null },
                            ].filter(v => v.val).map(({ label, val }) => (
                                <div key={label} className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground">{label}</span>
                                    <div className="flex items-center gap-1">
                                        <span className="font-mono text-purple-400">{shortWallet(val!)}</span>
                                        <CopyButton text={val!} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Timeline */}
                    <div className="space-y-1">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Timeline</p>
                        {[
                            { label: 'Created', val: wager.created_at },
                            { label: 'Game status', val: wager.status },
                            { label: 'Vote deadline', val: wager.vote_deadline as string | null },
                            { label: 'Game complete deadline', val: wager.game_complete_deadline as string | null },
                        ].map(({ label, val }) => val && (
                            <div key={label} className="flex justify-between text-xs">
                                <span className="text-muted-foreground">{label}</span>
                                <span className="text-foreground font-mono">
                                    {label === 'Game status'
                                        ? <span className="text-amber-400 font-bold uppercase">{val}</span>
                                        : new Date(val as string).toLocaleString()
                                    }
                                </span>
                            </div>
                        ))}
                        <div className="flex justify-between text-xs pt-1 border-t border-border/30">
                            <span className="text-muted-foreground font-semibold">Age</span>
                            <span className="text-amber-400 font-bold">{timeAgo(wager.created_at)}</span>
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
                            View game on Lichess: {wager.lichess_game_id as string}
                        </a>
                    )}
                </div>

                {/* Action footer — only if player B has joined */}
                {wager.player_b_wallet && (
                    <div className="p-6 border-t border-border/50 space-y-3 sticky bottom-0 bg-card">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Resolve This Wager</p>

                        {resolveStep === null && !refundStep && (
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setResolveStep('pick')}
                                    className="flex-1 flex items-center justify-center gap-2 bg-primary/20 hover:bg-primary/30 border border-primary/30 text-primary font-semibold py-2.5 px-4 rounded-xl transition-colors text-sm"
                                >
                                    <Trophy className="h-4 w-4" />Force Resolve
                                </button>
                                <button
                                    onClick={() => setRefundStep(true)}
                                    className="flex-1 flex items-center justify-center gap-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 font-semibold py-2.5 px-4 rounded-xl transition-colors text-sm"
                                >
                                    <RotateCcw className="h-4 w-4" />Force Refund
                                </button>
                            </div>
                        )}

                        {resolveStep === 'pick' && (
                            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
                                <p className="text-xs text-muted-foreground">Who won?</p>
                                {[
                                    { label: 'Player A wins', wallet: wager.player_a_wallet as string },
                                    { label: 'Player B wins', wallet: wager.player_b_wallet as string },
                                ].map(({ label, wallet }) => (
                                    <button
                                        key={wallet}
                                        onClick={() => { setResolveWinner(wallet); setResolveStep('confirm'); }}
                                        className="w-full text-left px-4 py-2.5 text-sm bg-background/50 border border-border/40 hover:border-primary/40 rounded-xl transition-colors"
                                    >
                                        <span className="font-semibold text-foreground">{label}</span>
                                        <span className="text-xs text-muted-foreground ml-2 font-mono">{shortWallet(wallet)}</span>
                                    </button>
                                ))}
                                <button onClick={() => setResolveStep(null)} className="w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                            </motion.div>
                        )}

                        {resolveStep === 'confirm' && resolveWinner && (
                            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                                <div className="bg-primary/10 border border-primary/20 rounded-xl p-3">
                                    <p className="text-xs text-muted-foreground">Winner:</p>
                                    <p className="text-sm font-mono text-primary font-semibold">{shortWallet(resolveWinner)}</p>
                                </div>
                                <p className="text-xs text-muted-foreground">Type <span className="text-foreground font-mono font-bold">CONFIRM</span> to proceed:</p>
                                <input
                                    type="text" value={confirmText}
                                    onChange={e => setConfirmText(e.target.value.toUpperCase())}
                                    placeholder="Type CONFIRM..." autoFocus
                                    className="w-full px-4 py-2.5 bg-background border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-foreground text-sm"
                                />
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => { setResolveStep(null); setResolveWinner(null); setConfirmText(''); }}
                                        className="flex-1 py-2.5 text-sm bg-card border border-border/50 text-foreground rounded-xl hover:border-primary/40 transition-colors"
                                    >Cancel</button>
                                    <button
                                        onClick={async () => {
                                            await onAction('forceResolve', wager.id, { winnerWallet: resolveWinner, notes: 'Admin force resolved from stuck wagers' });
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

                        {refundStep && (
                            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                                    <p className="text-xs text-red-400 font-semibold">Refund both players in full</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">Each player gets {stake} SOL back.</p>
                                </div>
                                <p className="text-xs text-muted-foreground">Type <span className="text-foreground font-mono font-bold">CONFIRM</span> to proceed:</p>
                                <input
                                    type="text" value={confirmText}
                                    onChange={e => setConfirmText(e.target.value.toUpperCase())}
                                    placeholder="Type CONFIRM..." autoFocus
                                    className="w-full px-4 py-2.5 bg-background border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-foreground text-sm"
                                />
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => { setRefundStep(false); setConfirmText(''); }}
                                        className="flex-1 py-2.5 text-sm bg-card border border-border/50 text-foreground rounded-xl hover:border-primary/40 transition-colors"
                                    >Cancel</button>
                                    <button
                                        onClick={async () => {
                                            await onAction('forceRefund', wager.id, { notes: 'Admin force refund from stuck wagers' });
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

// ── Main page ─────────────────────────────────────────────────────────────────

function StuckWagersContent() {
    const {
        wagers, loading, error,
        total, currentPage, totalPages, pageSize, thresholdHours,
        hasNextPage, hasPrevPage,
        nextPage, prevPage, refresh,
        changePageSize, changeThreshold,
    } = useStuckWagers(10, 2);

    const [selected, setSelected] = useState<(AdminWager & Record<string, unknown>) | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
    const { publicKey } = useWallet();

    const showToast = (type: 'success' | 'error', msg: string) => {
        setToast({ type, msg });
        setTimeout(() => setToast(null), 3500);
    };

    const doAction = useCallback(async (action: string, wagerId: string, extra: Record<string, unknown> = {}) => {
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
            refresh();
        } catch (err) {
            showToast('error', err instanceof Error ? err.message : 'Action failed');
        } finally {
            setActionLoading(null);
        }
    }, [publicKey, refresh]);

    const currentThresholdLabel = STUCK_THRESHOLD_OPTIONS.find(o => o.hours === thresholdHours)?.label ?? `${thresholdHours}h`;

    return (
        <ProtectedRoute>
            <div className="space-y-6">

                {/* Toast */}
                <AnimatePresence>
                    {toast && (
                        <motion.div
                            initial={{ opacity: 0, y: -20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -20 }}
                            className={`fixed top-20 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border text-sm font-medium
                                ${toast.type === 'success' ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' : 'bg-red-500/15 border-red-500/30 text-red-400'}`}
                        >
                            {toast.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                            {toast.msg}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Header */}
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                        <div className="bg-gradient-to-br from-amber-500/20 to-orange-600/20 rounded-xl p-3 border border-amber-500/20">
                            <AlertTriangle className="h-6 w-6 text-amber-400" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-gaming font-bold text-glow">Stuck Wagers</h1>
                            <p className="text-sm text-muted-foreground">
                                Both players deposited · not yet resolved · older than {currentThresholdLabel}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={refresh} disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-card border border-border/50 hover:border-primary/40 rounded-xl text-sm text-foreground transition-colors disabled:opacity-50"
                    >
                        <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        <span className="hidden sm:inline">Refresh</span>
                    </button>
                </motion.div>

                {/* Controls */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
                    className="glass rounded-2xl p-4 border border-amber-500/20 flex flex-wrap items-center gap-4">

                    {/* Threshold picker */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                            <Clock className="h-3.5 w-3.5" />
                            Show stuck for longer than:
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {STUCK_THRESHOLD_OPTIONS.map(opt => (
                                <button
                                    key={opt.hours}
                                    onClick={() => changeThreshold(opt.hours)}
                                    className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors border ${thresholdHours === opt.hours
                                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                                        : 'bg-card border-border/40 text-muted-foreground hover:text-foreground hover:border-amber-500/30'
                                        }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="hidden sm:block w-px h-6 bg-border/40" />

                    {/* Page size picker */}
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                            <Layers className="h-3.5 w-3.5" />
                            Show:
                        </div>
                        <div className="flex gap-1.5">
                            {STUCK_PAGE_SIZE_OPTIONS.map(size => (
                                <button
                                    key={size}
                                    onClick={() => changePageSize(size as StuckPageSize)}
                                    className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors border ${pageSize === size
                                        ? 'bg-primary/20 text-primary border-primary/40'
                                        : 'bg-card border-border/40 text-muted-foreground hover:text-foreground hover:border-primary/30'
                                        }`}
                                >
                                    {size}
                                </button>
                            ))}
                        </div>
                    </div>
                </motion.div>

                {/* Error */}
                {error && (
                    <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl flex items-center gap-2 text-sm">
                        <AlertTriangle className="h-4 w-4" />{error}
                    </div>
                )}

                {/* Table */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                    className="glass rounded-2xl overflow-hidden border border-amber-500/20">

                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
                        </div>
                    ) : wagers.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-3">
                            <CheckCircle2 className="h-10 w-10 text-emerald-400" />
                            <p className="text-foreground font-semibold">All clear!</p>
                            <p className="text-sm text-muted-foreground">No stuck wagers older than {currentThresholdLabel}.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-border/50 bg-card/40">
                                        <th className="px-5 py-3.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Match</th>
                                        <th className="px-5 py-3.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Players</th>
                                        <th className="px-5 py-3.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Locked SOL</th>
                                        <th className="px-5 py-3.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                                        <th className="px-5 py-3.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Stuck For</th>
                                        <th className="px-5 py-3.5 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/30">
                                    {wagers.map((wager, i) => {
                                        const w = wager as AdminWager & Record<string, unknown>;
                                        return (
                                            <motion.tr
                                                key={wager.id}
                                                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                                                className="hover:bg-amber-500/5 transition-colors cursor-pointer group"
                                                onClick={() => setSelected(w)}
                                            >
                                                <td className="px-5 py-4">
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="text-sm font-gaming font-bold text-foreground group-hover:text-amber-400 transition-colors">#{wager.match_id}</span>
                                                        <span className="text-xs font-mono text-muted-foreground">{wager.id.slice(0, 8)}...</span>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="text-xs font-mono text-foreground">{wager.player_a_wallet.slice(0, 8)}...</span>
                                                        {wager.player_b_wallet
                                                            ? <span className="text-xs font-mono text-muted-foreground">vs {(wager.player_b_wallet as string).slice(0, 8)}...</span>
                                                            : <span className="text-xs text-red-400 italic">No player B yet</span>
                                                        }
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <span className="text-sm font-semibold text-amber-400">{solAmount(wager.stake_lamports * 2)} SOL</span>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <span className="text-xs font-bold uppercase text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                                                        {wager.status}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <StalenessTag createdAt={wager.created_at} />
                                                </td>
                                                <td className="px-5 py-4 text-right">
                                                    <button
                                                        onClick={e => { e.stopPropagation(); setSelected(w); }}
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

                    {/* Pagination */}
                    {total > pageSize && (
                        <div className="flex items-center justify-between px-5 py-4 border-t border-border/30 bg-card/20">
                            <span className="text-sm text-muted-foreground">
                                Page {currentPage} of {totalPages} · <span className="font-semibold text-foreground">{total}</span> stuck
                            </span>
                            <div className="flex gap-2">
                                <button onClick={prevPage} disabled={!hasPrevPage || loading}
                                    className="p-2 rounded-lg bg-card border border-border/50 hover:border-amber-500/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                                    <ChevronLeft className="h-4 w-4" />
                                </button>
                                <button onClick={nextPage} disabled={!hasNextPage || loading}
                                    className="p-2 rounded-lg bg-card border border-border/50 hover:border-amber-500/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </motion.div>

                {/* Drawer */}
                <AnimatePresence>
                    {selected && (
                        <StuckWagerDrawer
                            wager={selected}
                            onClose={() => setSelected(null)}
                            onAction={doAction}
                            actionLoading={actionLoading}
                        />
                    )}
                </AnimatePresence>
            </div>
        </ProtectedRoute>
    );
}

export default function StuckWagersPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-amber-400" /></div>}>
            <StuckWagersContent />
        </Suspense>
    );
}