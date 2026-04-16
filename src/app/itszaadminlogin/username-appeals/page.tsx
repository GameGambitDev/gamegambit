'use client';

// src/app/itszaadminlogin/username-appeals/page.tsx

import { Suspense, useEffect, useState } from 'react';
import { ProtectedRoute } from '@/components/admin';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Link2, Search, Loader2, RefreshCcw, CheckCircle2, AlertTriangle,
    X, Copy, Check, ChevronRight, ChevronLeft, ExternalLink,
} from 'lucide-react';
import { getSupabaseClient } from '@/integrations/supabase/client';
import { useWallet } from '@solana/wallet-adapter-react';

interface Appeal {
    id: string;
    game: string;
    username: string;
    claimant_wallet: string;
    holder_wallet: string;
    status: string;
    holder_response: string | null;
    holder_responded_at: string | null;
    claimant_evidence_url: string | null;
    holder_evidence_url: string | null;
    admin_notes: string | null;
    response_deadline: string;
    resolved_at: string | null;
    created_at: string;
}

const GAME_CONFIG: Record<string, { label: string; icon: string }> = {
    chess: { label: 'Chess', icon: '♟️' },
    codm: { label: 'CODM', icon: '🎯' },
    pubg: { label: 'PUBG', icon: '🪖' },
    free_fire: { label: 'Free Fire', icon: '🔥' },
};

const STATUS_CONFIG: Record<string, { label: string; classes: string }> = {
    pending_response: { label: 'Awaiting Holder', classes: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
    contested: { label: 'Contested', classes: 'bg-orange-500/15 text-orange-400 border-orange-500/30' },
    escalated: { label: 'Escalated', classes: 'bg-red-500/15 text-red-400 border-red-500/30' },
    released: { label: 'Released', classes: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
    rejected: { label: 'Rejected', classes: 'bg-slate-500/15 text-slate-400 border-slate-500/30' },
    resolved: { label: 'Resolved', classes: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
};

function CopyBtn({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);
    return (
        <button
            onClick={() => {
                navigator.clipboard.writeText(text);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
            }}
            className="text-muted-foreground hover:text-primary transition-colors p-0.5"
        >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
    );
}

function TimeAgo({ date }: { date: string }) {
    const ms = Date.now() - new Date(date).getTime();
    const mins = Math.floor(ms / 60000);
    const hrs = Math.floor(mins / 60);
    const days = Math.floor(hrs / 24);
    return (
        <span className="text-xs text-muted-foreground">
            {days > 0 ? `${days}d ago` : hrs > 0 ? `${hrs}h ago` : `${mins}m ago`}
        </span>
    );
}

function AppealCard({
    appeal,
    isExpanded,
    onToggle,
    onAction,
    actionLoading,
}: {
    appeal: Appeal;
    isExpanded: boolean;
    onToggle: () => void;
    onAction: (id: string, action: 'resolve_release' | 'resolve_reject', notes?: string) => Promise<void>;
    actionLoading: string | null;
}) {
    const [step, setStep] = useState<null | 'release' | 'reject'>(null);
    const [notes, setNotes] = useState('');

    const short = (w: string) => `${w.slice(0, 8)}...${w.slice(-4)}`;
    const gameCfg = GAME_CONFIG[appeal.game] || { label: appeal.game, icon: '🎮' };
    const statusCfg = STATUS_CONFIG[appeal.status] || { label: appeal.status, classes: 'bg-muted text-muted-foreground border-border' };
    const isResolved = ['released', 'rejected', 'resolved'].includes(appeal.status);
    const deadlinePassed = new Date(appeal.response_deadline) < new Date();

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`glass rounded-2xl border overflow-hidden transition-colors ${isExpanded ? 'border-primary/40' : 'border-primary/20 hover:border-primary/35'
                }`}
        >
            {/* Header */}
            <div
                className="p-5 cursor-pointer"
                onClick={() => {
                    onToggle();
                    setStep(null);
                    setNotes('');
                }}
            >
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <span className="text-2xl shrink-0">{gameCfg.icon}</span>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                <span className="text-sm font-gaming font-bold text-foreground">
                                    {gameCfg.label} · {appeal.username}
                                </span>
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${statusCfg.classes}`}>
                                    {statusCfg.label}
                                </span>
                                {deadlinePassed && !isResolved && (
                                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full border bg-red-500/15 text-red-400 border-red-500/30">
                                        Deadline Passed
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground font-mono truncate">{appeal.id}</p>
                        </div>
                    </div>
                    <div className="text-right shrink-0 flex items-center gap-2">
                        <TimeAgo date={appeal.created_at} />
                        <ChevronRight
                            className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                        />
                    </div>
                </div>

                <div className="flex items-center gap-2 mt-3 text-xs">
                    <span className="text-muted-foreground">Claimant:</span>
                    <span className="font-mono text-foreground">{short(appeal.claimant_wallet)}</span>
                    <span className="text-muted-foreground ml-2">Holder:</span>
                    <span className="font-mono text-foreground">{short(appeal.holder_wallet)}</span>
                </div>
            </div>

            {/* Expanded */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="border-t border-border/50 p-5 space-y-4">
                            {/* Full details */}
                            <div className="bg-background/40 rounded-xl p-4 space-y-2 text-xs">
                                <p className="font-semibold text-muted-foreground uppercase tracking-wider mb-2">Full Details</p>
                                {[
                                    { label: 'Appeal ID', val: appeal.id },
                                    { label: 'Username', val: appeal.username },
                                    { label: 'Claimant', val: appeal.claimant_wallet },
                                    { label: 'Holder', val: appeal.holder_wallet },
                                ].map((r) => (
                                    <div key={r.label} className="flex items-start justify-between gap-3">
                                        <span className="text-muted-foreground shrink-0 w-20">{r.label}</span>
                                        <div className="flex items-center gap-1 min-w-0">
                                            <span className="font-mono text-foreground truncate">{r.val}</span>
                                            <CopyBtn text={r.val} />
                                        </div>
                                    </div>
                                ))}
                                <div className="flex items-start justify-between gap-3">
                                    <span className="text-muted-foreground shrink-0 w-20">Deadline</span>
                                    <span className={`font-mono ${deadlinePassed ? 'text-red-400' : 'text-foreground'}`}>
                                        {new Date(appeal.response_deadline).toLocaleString()}
                                    </span>
                                </div>
                            </div>

                            {/* Holder response */}
                            {appeal.holder_response && (
                                <div
                                    className={`rounded-xl p-3 border text-xs ${appeal.holder_response === 'release'
                                        ? 'bg-emerald-500/10 border-emerald-500/20'
                                        : 'bg-orange-500/10 border-orange-500/20'
                                        }`}
                                >
                                    <p
                                        className={`font-semibold mb-1 ${appeal.holder_response === 'release' ? 'text-emerald-400' : 'text-orange-400'
                                            }`}
                                    >
                                        Holder responded:{' '}
                                        {appeal.holder_response === 'release' ? 'Agreed to release' : 'Contesting claim'}
                                    </p>
                                    {appeal.holder_responded_at && (
                                        <p className="text-muted-foreground">
                                            {new Date(appeal.holder_responded_at).toLocaleString()}
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Evidence links */}
                            {(appeal.claimant_evidence_url || appeal.holder_evidence_url) && (
                                <div className="space-y-2">
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Evidence</p>
                                    {appeal.claimant_evidence_url && (
                                        <a
                                            href={appeal.claimant_evidence_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-2 text-xs text-primary hover:underline"
                                        >
                                            <ExternalLink className="h-3.5 w-3.5" />
                                            Claimant evidence
                                        </a>
                                    )}
                                    {appeal.holder_evidence_url && (
                                        <a
                                            href={appeal.holder_evidence_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-2 text-xs text-primary hover:underline"
                                        >
                                            <ExternalLink className="h-3.5 w-3.5" />
                                            Holder evidence
                                        </a>
                                    )}
                                </div>
                            )}

                            {/* Admin notes (read-only if resolved) */}
                            {appeal.admin_notes && (
                                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-xs">
                                    <p className="text-blue-400 font-semibold mb-1">Admin Notes</p>
                                    <p className="text-foreground">{appeal.admin_notes}</p>
                                </div>
                            )}

                            {/* Action area */}
                            {!isResolved && (
                                <div className="space-y-3 pt-1">
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                        Admin Resolution
                                    </p>

                                    {step === null && (
                                        <div className="grid grid-cols-2 gap-3">
                                            <button
                                                onClick={() => setStep('release')}
                                                className="flex items-center justify-center gap-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-400 font-semibold py-3 px-4 rounded-xl transition-colors text-sm"
                                            >
                                                <CheckCircle2 className="h-4 w-4" />
                                                Release Username
                                            </button>
                                            <button
                                                onClick={() => setStep('reject')}
                                                className="flex items-center justify-center gap-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 font-semibold py-3 px-4 rounded-xl transition-colors text-sm"
                                            >
                                                <X className="h-4 w-4" />
                                                Reject Appeal
                                            </button>
                                        </div>
                                    )}

                                    {step === 'release' && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 5 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="space-y-3"
                                        >
                                            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-xs">
                                                <p className="text-emerald-400 font-semibold mb-1">Release username to claimant</p>
                                                <p className="text-muted-foreground">
                                                    This will clear{' '}
                                                    <span className="text-foreground font-mono">{appeal.username}</span> from the
                                                    holder's account. The claimant can then bind it.
                                                </p>
                                            </div>
                                            <textarea
                                                value={notes}
                                                onChange={(e) => setNotes(e.target.value)}
                                                placeholder="Admin notes (optional)..."
                                                rows={2}
                                                className="w-full px-4 py-2.5 bg-card border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-foreground text-sm placeholder:text-muted-foreground resize-none"
                                            />
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setStep(null)}
                                                    className="flex-1 py-2.5 text-sm bg-card border border-border/50 text-foreground rounded-xl hover:border-primary/40 transition-colors"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={async () => {
                                                        await onAction(appeal.id, 'resolve_release', notes);
                                                        setStep(null);
                                                    }}
                                                    disabled={actionLoading === appeal.id}
                                                    className="flex-1 py-2.5 text-sm bg-emerald-500 hover:bg-emerald-500/90 text-white rounded-xl font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                                >
                                                    {actionLoading === appeal.id ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        '✓ Confirm Release'
                                                    )}
                                                </button>
                                            </div>
                                        </motion.div>
                                    )}

                                    {step === 'reject' && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 5 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="space-y-3"
                                        >
                                            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-xs">
                                                <p className="text-red-400 font-semibold mb-1">Reject this appeal</p>
                                                <p className="text-muted-foreground">
                                                    The holder keeps the username. The claimant will be notified.
                                                </p>
                                            </div>
                                            <textarea
                                                value={notes}
                                                onChange={(e) => setNotes(e.target.value)}
                                                placeholder="Reason for rejection (optional)..."
                                                rows={2}
                                                className="w-full px-4 py-2.5 bg-card border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-foreground text-sm placeholder:text-muted-foreground resize-none"
                                            />
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setStep(null)}
                                                    className="flex-1 py-2.5 text-sm bg-card border border-border/50 text-foreground rounded-xl hover:border-primary/40 transition-colors"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={async () => {
                                                        await onAction(appeal.id, 'resolve_reject', notes);
                                                        setStep(null);
                                                    }}
                                                    disabled={actionLoading === appeal.id}
                                                    className="flex-1 py-2.5 text-sm bg-red-500 hover:bg-red-500/90 text-white rounded-xl font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                                >
                                                    {actionLoading === appeal.id ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        '✗ Confirm Rejection'
                                                    )}
                                                </button>
                                            </div>
                                        </motion.div>
                                    )}
                                </div>
                            )}

                            {isResolved && (
                                <div className="bg-muted/20 border border-border/30 rounded-xl p-3 text-xs text-center text-muted-foreground">
                                    This appeal has been resolved{' '}
                                    {appeal.resolved_at ? `on ${new Date(appeal.resolved_at).toLocaleDateString()}` : ''}.
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

function UsernameAppealsContent() {
    const [appeals, setAppeals] = useState<Appeal[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'resolved'>('active');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
    const [page, setPage] = useState(1);
    const { publicKey } = useWallet();

    const showToast = (type: 'success' | 'error', msg: string) => {
        setToast({ type, msg });
        setTimeout(() => setToast(null), 3500);
    };

    const fetchAppeals = async () => {
        try {
            setLoading(true);
            setError(null);
            const { data, error: fetchErr } = await (getSupabaseClient()
                .from('username_appeals' as any)
                .select(
                    'id, game, username, claimant_wallet, holder_wallet, status, holder_response, holder_responded_at, claimant_evidence_url, holder_evidence_url, admin_notes, response_deadline, resolved_at, created_at'
                )
                .order('created_at', { ascending: false }) as any);
            if (fetchErr) throw fetchErr;
            setAppeals((data || []) as Appeal[]);
            setPage(1);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch appeals');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAppeals();
    }, []);

    const handleAction = async (id: string, action: 'resolve_release' | 'resolve_reject', notes?: string) => {
        if (!publicKey) {
            showToast('error', 'Connect your wallet first');
            return;
        }
        setActionLoading(id);
        try {
            const appeal = appeals.find((a) => a.id === id);
            if (!appeal) throw new Error('Appeal not found');

            const supabase = getSupabaseClient();

            if (action === 'resolve_release') {
                const colMap: Record<string, string> = {
                    pubg: 'pubg_username',
                    codm: 'codm_username',
                    free_fire: 'free_fire_username',
                };
                const col = colMap[appeal.game];
                if (col) {
                    const { error: clearErr } = await supabase
                        .from('players')
                        .update({ [col]: null } as any)
                        .eq('wallet_address', appeal.holder_wallet);
                    if (clearErr) throw clearErr;
                }
                await (supabase
                    .from('username_appeals' as any)
                    .update({
                        status: 'released',
                        resolved_at: new Date().toISOString(),
                        admin_notes: notes || null,
                    })
                    .eq('id', id) as any);
                showToast('success', `Username "${appeal.username}" released to claimant.`);
            } else {
                await (supabase
                    .from('username_appeals' as any)
                    .update({
                        status: 'rejected',
                        resolved_at: new Date().toISOString(),
                        admin_notes: notes || null,
                    })
                    .eq('id', id) as any);
                showToast('success', 'Appeal rejected. Holder keeps the username.');
            }

            await fetchAppeals();
            setExpandedId(null);
        } catch (err) {
            showToast('error', err instanceof Error ? err.message : 'Action failed');
        } finally {
            setActionLoading(null);
        }
    };

    const filtered = appeals.filter((a) => {
        const q = searchTerm.toLowerCase();
        const matchesSearch =
            !q ||
            a.username.toLowerCase().includes(q) ||
            a.claimant_wallet.toLowerCase().includes(q) ||
            a.holder_wallet.toLowerCase().includes(q) ||
            a.id.includes(q);
        const matchesFilter =
            filterStatus === 'all'
                ? true
                : filterStatus === 'active'
                    ? !['released', 'rejected', 'resolved'].includes(a.status)
                    : ['released', 'rejected', 'resolved'].includes(a.status);
        return matchesSearch && matchesFilter;
    });

    const PAGE_SIZE = 20;
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const pendingCount = appeals.filter((a) => !['released', 'rejected', 'resolved'].includes(a.status)).length;

    return (
        <ProtectedRoute>
            <div className="space-y-6">
                {/* Toast */}
                <AnimatePresence>
                    {toast && (
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className={`fixed top-20 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border text-sm font-medium ${toast.type === 'success'
                                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                                : 'bg-red-500/15 border-red-500/30 text-red-400'
                                }`}
                        >
                            {toast.type === 'success' ? (
                                <CheckCircle2 className="h-4 w-4" />
                            ) : (
                                <AlertTriangle className="h-4 w-4" />
                            )}
                            {toast.msg}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Header */}
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-gradient-to-br from-primary/20 to-primary/10 rounded-xl p-3 border border-primary/20">
                            <Link2 className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-gaming font-bold text-glow">Username Appeals</h1>
                            <p className="text-sm text-muted-foreground">
                                {appeals.length} total ·{' '}
                                <span className={pendingCount > 0 ? 'text-amber-400' : 'text-muted-foreground'}>
                                    {pendingCount} pending review
                                </span>
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={fetchAppeals}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-card border border-border/50 hover:border-primary/40 rounded-xl text-sm text-foreground transition-colors disabled:opacity-50"
                    >
                        <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        <span className="hidden sm:inline">Refresh</span>
                    </button>
                </motion.div>

                {/* Stats */}
                {appeals.length > 0 && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-4 gap-3">
                        {[
                            { label: 'Total', value: appeals.length, color: 'text-foreground' },
                            {
                                label: 'Pending',
                                value: appeals.filter((a) => a.status === 'pending_response').length,
                                color: 'text-amber-400',
                            },
                            {
                                label: 'Escalated',
                                value: appeals.filter((a) => ['escalated', 'contested'].includes(a.status)).length,
                                color: 'text-red-400',
                            },
                            {
                                label: 'Resolved',
                                value: appeals.filter((a) => ['released', 'rejected', 'resolved'].includes(a.status)).length,
                                color: 'text-emerald-400',
                            },
                        ].map(({ label, value, color }) => (
                            <div key={label} className="glass rounded-2xl p-4 border border-primary/20 text-center">
                                <p className={`text-xl font-gaming font-bold ${color}`}>{value}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                            </div>
                        ))}
                    </motion.div>
                )}

                {error && (
                    <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl flex items-center gap-2 text-sm">
                        <AlertTriangle className="h-4 w-4" />
                        {error}
                    </div>
                )}

                {/* Filters + Search */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="glass rounded-2xl p-4 border border-primary/20 flex flex-col sm:flex-row gap-3"
                >
                    <div className="relative flex-1">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search by username, wallet, or ID..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-card border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-foreground placeholder:text-muted-foreground text-sm"
                        />
                    </div>
                    <div className="flex gap-2">
                        {(['active', 'resolved', 'all'] as const).map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilterStatus(f)}
                                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors capitalize ${filterStatus === f
                                    ? 'bg-primary/20 text-primary border border-primary/30'
                                    : 'bg-card border border-border/50 text-muted-foreground hover:text-foreground'
                                    }`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                </motion.div>

                {/* List */}
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : filtered.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="glass rounded-2xl border border-primary/20 text-center py-16"
                    >
                        <Link2 className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
                        <p className="text-lg font-gaming font-bold text-foreground mb-1">
                            {searchTerm ? 'No matches found' : 'No appeals found'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                            {searchTerm
                                ? 'Try a different search'
                                : filterStatus === 'active'
                                    ? 'No pending appeals — all clear ✓'
                                    : 'No resolved appeals yet'}
                        </p>
                    </motion.div>
                ) : (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.15 }}
                        className="space-y-3"
                    >
                        {pageItems.map((appeal) => (
                            <AppealCard
                                key={appeal.id}
                                appeal={appeal}
                                isExpanded={expandedId === appeal.id}
                                onToggle={() => setExpandedId(expandedId === appeal.id ? null : appeal.id)}
                                onAction={handleAction}
                                actionLoading={actionLoading}
                            />
                        ))}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-between pt-2">
                                <span className="text-xs text-muted-foreground">Page <span className="font-semibold text-foreground">{page}</span> of <span className="font-semibold text-foreground">{totalPages}</span></span>
                                <div className="flex gap-2">
                                    <button onClick={() => setPage(p => p - 1)} disabled={page <= 1} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-card border border-border/50 hover:border-primary/40 rounded-lg text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"><ChevronLeft className="h-3.5 w-3.5" />Prev</button>
                                    <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-card border border-border/50 hover:border-primary/40 rounded-lg text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed">Next<ChevronRight className="h-3.5 w-3.5" /></button>
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}
            </div>
        </ProtectedRoute>
    );
}

export default function UsernameAppealsPage() {
    return (
        <Suspense
            fallback={
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            }
        >
            <UsernameAppealsContent />
        </Suspense>
    );
}