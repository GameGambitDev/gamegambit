'use client';

// src/app/itszaadminlogin/username-changes/page.tsx

import { Suspense, useEffect, useState } from 'react';
import { ProtectedRoute } from '@/components/admin';
import { motion, AnimatePresence } from 'framer-motion';
import {
    PenLine, Search, Loader2, RefreshCcw, CheckCircle2, AlertTriangle,
    X, Copy, Check, ChevronRight,
} from 'lucide-react';
import { getSupabaseClient } from '@/integrations/supabase/client';
import { useWallet } from '@solana/wallet-adapter-react';

interface ChangeRequest {
    id: string;
    game: string;
    player_wallet: string;
    old_username: string;
    new_username: string;
    reason: string;
    reason_category: string;
    status: string;
    admin_notes: string | null;
    reviewed_at: string | null;
    reviewed_by: string | null;
    created_at: string;
}

const GAME_CONFIG: Record<string, { label: string; icon: string }> = {
    chess: { label: 'Chess', icon: '♟️' },
    codm: { label: 'CODM', icon: '🎯' },
    pubg: { label: 'PUBG', icon: '🪖' },
    free_fire: { label: 'Free Fire', icon: '🔥' },
};

const STATUS_CONFIG: Record<string, { label: string; classes: string }> = {
    pending: { label: 'Pending Review', classes: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
    approved: { label: 'Approved', classes: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
    rejected: { label: 'Rejected', classes: 'bg-red-500/15 text-red-400 border-red-500/30' },
};

const CATEGORY_LABELS: Record<string, string> = {
    name_change: 'Name Change',
    account_recovery: 'Account Recovery',
    typo_correction: 'Typo Correction',
    other: 'Other',
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

function ChangeRequestCard({
    req,
    isExpanded,
    onToggle,
    onAction,
    actionLoading,
}: {
    req: ChangeRequest;
    isExpanded: boolean;
    onToggle: () => void;
    onAction: (id: string, action: 'approve' | 'reject', adminWallet: string, notes?: string) => Promise<void>;
    actionLoading: string | null;
}) {
    const [step, setStep] = useState<null | 'approve' | 'reject'>(null);
    const [notes, setNotes] = useState('');
    const { publicKey } = useWallet();

    const short = (w: string) => `${w.slice(0, 8)}...${w.slice(-4)}`;
    const gameCfg = GAME_CONFIG[req.game] || { label: req.game, icon: '🎮' };
    const statusCfg = STATUS_CONFIG[req.status] || { label: req.status, classes: 'bg-muted text-muted-foreground border-border' };
    const isResolved = req.status !== 'pending';

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
                                <span className="text-sm font-gaming font-bold text-foreground">{gameCfg.label}</span>
                                <span className="text-xs text-muted-foreground font-mono">{req.old_username}</span>
                                <span className="text-xs text-muted-foreground">→</span>
                                <span className="text-xs font-semibold text-primary font-mono">{req.new_username}</span>
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${statusCfg.classes}`}>
                                    {statusCfg.label}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground font-mono">{short(req.player_wallet)}</span>
                                <span className="text-xs text-muted-foreground">·</span>
                                <span className="text-xs text-muted-foreground">
                                    {CATEGORY_LABELS[req.reason_category] || req.reason_category}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="text-right shrink-0 flex items-center gap-2">
                        <TimeAgo date={req.created_at} />
                        <ChevronRight
                            className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                        />
                    </div>
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
                            {/* Details */}
                            <div className="bg-background/40 rounded-xl p-4 space-y-2 text-xs">
                                <p className="font-semibold text-muted-foreground uppercase tracking-wider mb-2">Request Details</p>
                                {[
                                    { label: 'Request ID', val: req.id },
                                    { label: 'Player', val: req.player_wallet },
                                    { label: 'Old Name', val: req.old_username },
                                    { label: 'New Name', val: req.new_username },
                                    {
                                        label: 'Category',
                                        val: CATEGORY_LABELS[req.reason_category] || req.reason_category,
                                    },
                                ].map((r) => (
                                    <div key={r.label} className="flex items-start justify-between gap-3">
                                        <span className="text-muted-foreground shrink-0 w-20">{r.label}</span>
                                        <div className="flex items-center gap-1 min-w-0">
                                            <span className="font-mono text-foreground truncate">{r.val}</span>
                                            <CopyBtn text={r.val} />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Player reason */}
                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-xs">
                                <p className="text-blue-400 font-semibold mb-1">Player's Reason</p>
                                <p className="text-foreground">{req.reason}</p>
                            </div>

                            {/* Existing admin notes */}
                            {req.admin_notes && (
                                <div className="bg-muted/20 border border-border/30 rounded-xl p-3 text-xs">
                                    <p className="text-muted-foreground font-semibold mb-1">Admin Notes</p>
                                    <p className="text-foreground">{req.admin_notes}</p>
                                </div>
                            )}

                            {/* Reviewed info */}
                            {isResolved && req.reviewed_at && (
                                <div className="bg-muted/20 border border-border/30 rounded-xl p-3 text-xs text-muted-foreground text-center">
                                    Reviewed on {new Date(req.reviewed_at).toLocaleString()}
                                    {req.reviewed_by && (
                                        <>
                                            {' '}
                                            by <span className="font-mono text-foreground">{short(req.reviewed_by)}</span>
                                        </>
                                    )}
                                </div>
                            )}

                            {/* Action area */}
                            {!isResolved && (
                                <div className="space-y-3 pt-1">
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Admin Decision</p>

                                    {!publicKey && (
                                        <p className="text-xs text-amber-400 text-center">Connect admin wallet to take action</p>
                                    )}

                                    {step === null && (
                                        <div className="grid grid-cols-2 gap-3">
                                            <button
                                                onClick={() => setStep('approve')}
                                                disabled={!publicKey}
                                                className="flex items-center justify-center gap-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-400 font-semibold py-3 px-4 rounded-xl transition-colors text-sm disabled:opacity-40"
                                            >
                                                <CheckCircle2 className="h-4 w-4" />
                                                Approve
                                            </button>
                                            <button
                                                onClick={() => setStep('reject')}
                                                disabled={!publicKey}
                                                className="flex items-center justify-center gap-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 font-semibold py-3 px-4 rounded-xl transition-colors text-sm disabled:opacity-40"
                                            >
                                                <X className="h-4 w-4" />
                                                Reject
                                            </button>
                                        </div>
                                    )}

                                    {step === 'approve' && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 5 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="space-y-3"
                                        >
                                            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-xs">
                                                <p className="text-emerald-400 font-semibold mb-1">Approve username change</p>
                                                <p className="text-muted-foreground">
                                                    This will update the player's {gameCfg.label} username from{' '}
                                                    <span className="text-foreground font-mono">{req.old_username}</span> to{' '}
                                                    <span className="text-primary font-mono">{req.new_username}</span>.
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
                                                        await onAction(req.id, 'approve', publicKey!.toBase58(), notes);
                                                        setStep(null);
                                                    }}
                                                    disabled={actionLoading === req.id}
                                                    className="flex-1 py-2.5 text-sm bg-emerald-500 hover:bg-emerald-500/90 text-white rounded-xl font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                                >
                                                    {actionLoading === req.id ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        '✓ Confirm Approval'
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
                                                <p className="text-red-400 font-semibold mb-1">Reject this change request</p>
                                                <p className="text-muted-foreground">
                                                    The player's username will remain as{' '}
                                                    <span className="text-foreground font-mono">{req.old_username}</span>.
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
                                                        await onAction(req.id, 'reject', publicKey!.toBase58(), notes);
                                                        setStep(null);
                                                    }}
                                                    disabled={actionLoading === req.id}
                                                    className="flex-1 py-2.5 text-sm bg-red-500 hover:bg-red-500/90 text-white rounded-xl font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                                >
                                                    {actionLoading === req.id ? (
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
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

function UsernameChangesContent() {
    const [requests, setRequests] = useState<ChangeRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'resolved'>('pending');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

    const showToast = (type: 'success' | 'error', msg: string) => {
        setToast({ type, msg });
        setTimeout(() => setToast(null), 3500);
    };

    const fetchRequests = async () => {
        try {
            setLoading(true);
            setError(null);
            const { data, error: fetchErr } = await (getSupabaseClient()
                .from('username_change_requests' as any)
                .select(
                    'id, game, player_wallet, old_username, new_username, reason, reason_category, status, admin_notes, reviewed_at, reviewed_by, created_at'
                )
                .order('created_at', { ascending: false }) as any);
            if (fetchErr) throw fetchErr;
            setRequests((data || []) as ChangeRequest[]);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch change requests');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRequests();
    }, []);

    const handleAction = async (id: string, action: 'approve' | 'reject', adminWallet: string, notes?: string) => {
        setActionLoading(id);
        try {
            const req = requests.find((r) => r.id === id);
            if (!req) throw new Error('Request not found');

            const supabase = getSupabaseClient();

            if (action === 'approve') {
                const colMap: Record<string, string> = {
                    pubg: 'pubg_username',
                    codm: 'codm_username',
                    free_fire: 'free_fire_username',
                };
                const col = colMap[req.game];
                if (col) {
                    const { error: updateErr } = await supabase
                        .from('players')
                        .update({ [col]: req.new_username } as any)
                        .eq('wallet_address', req.player_wallet);
                    if (updateErr) throw updateErr;
                }
                await (supabase
                    .from('username_change_requests' as any)
                    .update({
                        status: 'approved',
                        reviewed_at: new Date().toISOString(),
                        reviewed_by: adminWallet,
                        admin_notes: notes || null,
                    })
                    .eq('id', id) as any);
                showToast('success', `Username updated to "${req.new_username}"`);
            } else {
                await (supabase
                    .from('username_change_requests' as any)
                    .update({
                        status: 'rejected',
                        reviewed_at: new Date().toISOString(),
                        reviewed_by: adminWallet,
                        admin_notes: notes || null,
                    })
                    .eq('id', id) as any);
                showToast('success', 'Change request rejected.');
            }

            await fetchRequests();
            setExpandedId(null);
        } catch (err) {
            showToast('error', err instanceof Error ? err.message : 'Action failed');
        } finally {
            setActionLoading(null);
        }
    };

    const filtered = requests.filter((r) => {
        const q = searchTerm.toLowerCase();
        const matchesSearch =
            !q ||
            r.old_username.toLowerCase().includes(q) ||
            r.new_username.toLowerCase().includes(q) ||
            r.player_wallet.toLowerCase().includes(q) ||
            r.id.includes(q);
        const matchesFilter =
            filterStatus === 'all' ? true : filterStatus === 'pending' ? r.status === 'pending' : r.status !== 'pending';
        return matchesSearch && matchesFilter;
    });

    const pendingCount = requests.filter((r) => r.status === 'pending').length;

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
                            <PenLine className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-gaming font-bold text-glow">Username Changes</h1>
                            <p className="text-sm text-muted-foreground">
                                {requests.length} total ·{' '}
                                <span className={pendingCount > 0 ? 'text-amber-400' : 'text-muted-foreground'}>
                                    {pendingCount} pending review
                                </span>
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={fetchRequests}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-card border border-border/50 hover:border-primary/40 rounded-xl text-sm text-foreground transition-colors disabled:opacity-50"
                    >
                        <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        <span className="hidden sm:inline">Refresh</span>
                    </button>
                </motion.div>

                {/* Stats */}
                {requests.length > 0 && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-3 gap-3">
                        {[
                            { label: 'Total', value: requests.length, color: 'text-foreground' },
                            {
                                label: 'Pending',
                                value: pendingCount,
                                color: pendingCount > 0 ? 'text-amber-400' : 'text-muted-foreground',
                            },
                            {
                                label: 'Approved',
                                value: requests.filter((r) => r.status === 'approved').length,
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
                            placeholder="Search by username or wallet..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-card border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-foreground placeholder:text-muted-foreground text-sm"
                        />
                    </div>
                    <div className="flex gap-2">
                        {(['pending', 'resolved', 'all'] as const).map((f) => (
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
                        <PenLine className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
                        <p className="text-lg font-gaming font-bold text-foreground mb-1">
                            {searchTerm ? 'No matches found' : 'No change requests'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                            {searchTerm
                                ? 'Try a different search'
                                : filterStatus === 'pending'
                                    ? 'No pending requests ✓'
                                    : 'No resolved requests yet'}
                        </p>
                    </motion.div>
                ) : (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.15 }}
                        className="space-y-3"
                    >
                        {filtered.map((req) => (
                            <ChangeRequestCard
                                key={req.id}
                                req={req}
                                isExpanded={expandedId === req.id}
                                onToggle={() => setExpandedId(expandedId === req.id ? null : req.id)}
                                onAction={handleAction}
                                actionLoading={actionLoading}
                            />
                        ))}
                    </motion.div>
                )}
            </div>
        </ProtectedRoute>
    );
}

export default function UsernameChangesPage() {
    return (
        <Suspense
            fallback={
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            }
        >
            <UsernameChangesContent />
        </Suspense>
    );
}