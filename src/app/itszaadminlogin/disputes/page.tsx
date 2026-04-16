'use client';

import { Suspense, useEffect, useState } from 'react';
import { ProtectedRoute } from '@/components/admin';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Scale, Search, AlertTriangle, Loader2, RefreshCcw, CheckCircle2,
    X, Copy, Check, ExternalLink, Clock, ChevronRight, Trophy, RotateCcw,
    Users, Swords, TrendingUp, ChevronLeft,
} from 'lucide-react';
import { getSupabaseClient } from '@/integrations/supabase/client';
import { useWallet } from '@solana/wallet-adapter-react';
import { calculatePlatformFee } from '@/lib/constants';

interface DisputeWager {
    id: string;
    match_id: number;
    player_a_wallet: string;
    player_b_wallet: string;
    game: 'chess' | 'codm' | 'pubg' | 'free_fire';
    stake_lamports: number;
    status: string;
    vote_player_a: string | null;
    vote_player_b: string | null;
    created_at: string;
    dispute_created_at: string | null;
    grace_conceded_by: string | null;
    moderator_wallet: string | null;
    winner_wallet: string | null;
    moderator_decision: string | null;
}

const GAME_CONFIG: Record<string, { label: string; icon: string }> = {
    chess: { label: 'Chess', icon: '♟️' },
    codm: { label: 'CODM', icon: '🎯' },
    pubg: { label: 'PUBG', icon: '🪖' },
    free_fire: { label: 'Free Fire', icon: '🔥' },
};

const PAGE_SIZE = 20;

function CopyBtn({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);
    return (
        <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            className="text-muted-foreground hover:text-primary transition-colors p-0.5">
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
    );
}

function TimeAgo({ date }: { date: string }) {
    const ms = Date.now() - new Date(date).getTime();
    const mins = Math.floor(ms / 60000);
    const hrs = Math.floor(mins / 60);
    const days = Math.floor(hrs / 24);
    const label = days > 0 ? `${days}d ago` : hrs > 0 ? `${hrs}h ago` : `${mins}m ago`;
    const urgent = hrs >= 24;
    return <span className={`text-xs font-semibold ${urgent ? 'text-red-400' : 'text-muted-foreground'}`}>{label}</span>;
}

function VoteBlock({ label, voterWallet, votedFor }: {
    label: string; voterWallet: string; votedFor: string | null;
}) {
    const short = (w: string) => `${w.slice(0, 8)}...${w.slice(-4)}`;
    const selfVote = votedFor === voterWallet;
    return (
        <div className="bg-background/50 rounded-xl p-3 border border-border/30">
            <p className="text-xs text-muted-foreground font-semibold mb-1.5">{label}</p>
            <div className="flex items-center gap-1.5 mb-2">
                <span className="text-xs font-mono text-foreground">{short(voterWallet)}</span>
                <CopyBtn text={voterWallet} />
            </div>
            {votedFor ? (
                <div className={`text-xs rounded-lg px-2.5 py-1.5 font-semibold border ${selfVote
                    ? 'bg-primary/10 border-primary/20 text-primary'
                    : 'bg-purple-500/10 border-purple-500/20 text-purple-400'}`}>
                    Voted: {selfVote ? '🙋 Themselves' : `Opponent (${short(votedFor)})`}
                </div>
            ) : (
                <div className="text-xs bg-muted/20 border border-border/30 rounded-lg px-2.5 py-1.5 text-muted-foreground">
                    No vote yet
                </div>
            )}
        </div>
    );
}

function DisputeCard({ dispute, isExpanded, onToggle, onAction, actionLoading, publicKey }: {
    dispute: DisputeWager;
    isExpanded: boolean;
    onToggle: () => void;
    onAction: (action: string, wagerId: string, extra?: Record<string, unknown>) => Promise<void>;
    actionLoading: string | null;
    publicKey: { toBase58(): string } | null;
}) {
    const [resolveStep, setResolveStep] = useState<null | 'pick' | 'confirm'>(null);
    const [resolveWinner, setResolveWinner] = useState<string | null>(null);
    const [refundStep, setRefundStep] = useState(false);
    const [confirmText, setConfirmText] = useState('');

    const short = (w: string) => `${w.slice(0, 8)}...${w.slice(-4)}`;
    const solStake = (dispute.stake_lamports / 1e9).toFixed(4);
    const disputedAt = dispute.dispute_created_at || dispute.created_at;
    const gameCfg = GAME_CONFIG[dispute.game] || { label: dispute.game, icon: '🎮' };

    const resetActions = () => {
        setResolveStep(null); setResolveWinner(null);
        setRefundStep(false); setConfirmText('');
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`glass rounded-2xl border overflow-hidden transition-colors ${isExpanded ? 'border-amber-500/40' : 'border-primary/20 hover:border-primary/40'}`}
        >
            <div className="p-5 cursor-pointer" onClick={() => { onToggle(); resetActions(); }}>
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="text-2xl shrink-0">{gameCfg.icon}</div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                <span className="text-sm font-gaming font-bold text-foreground">
                                    #{dispute.match_id} · {gameCfg.label}
                                </span>
                                <span className="bg-amber-500/15 text-amber-400 border border-amber-500/30 text-xs font-semibold px-2 py-0.5 rounded-full">
                                    Disputed
                                </span>
                                {dispute.grace_conceded_by && (
                                    <span className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs font-semibold px-2 py-0.5 rounded-full">
                                        Grace Conceded
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground font-mono truncate">{dispute.id}</p>
                        </div>
                    </div>
                    <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-amber-400">{(dispute.stake_lamports * 2 / 1e9).toFixed(4)} SOL</p>
                        <TimeAgo date={disputedAt} />
                    </div>
                </div>
                <div className="flex items-center gap-2 mt-3 text-xs">
                    <span className="font-mono text-muted-foreground">{short(dispute.player_a_wallet)}</span>
                    <Swords className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                    <span className="font-mono text-muted-foreground">{dispute.player_b_wallet ? short(dispute.player_b_wallet) : 'TBD'}</span>
                    <ChevronRight className={`h-4 w-4 text-muted-foreground ml-auto transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                </div>
            </div>

            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="border-t border-border/50 p-5 space-y-5">
                            <div>
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Vote Breakdown</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <VoteBlock label="Player A" voterWallet={dispute.player_a_wallet} votedFor={dispute.vote_player_a} />
                                    {dispute.player_b_wallet && (
                                        <VoteBlock label="Player B" voterWallet={dispute.player_b_wallet} votedFor={dispute.vote_player_b} />
                                    )}
                                </div>
                            </div>

                            {dispute.grace_conceded_by && (
                                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
                                    <p className="text-xs font-semibold text-emerald-400 mb-1">Player conceded during grace period</p>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-xs font-mono text-foreground">{short(dispute.grace_conceded_by)}</span>
                                        <CopyBtn text={dispute.grace_conceded_by} />
                                        <span className="text-xs text-muted-foreground ml-1">admitted opponent won</span>
                                    </div>
                                </div>
                            )}

                            {dispute.moderator_wallet && (
                                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
                                    <p className="text-xs font-semibold text-blue-400 mb-1">Moderator assigned</p>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-xs font-mono text-foreground">{short(dispute.moderator_wallet)}</span>
                                        <CopyBtn text={dispute.moderator_wallet} />
                                    </div>
                                </div>
                            )}

                            <div className="bg-background/40 rounded-xl p-4 space-y-2 text-xs">
                                <p className="font-semibold text-muted-foreground uppercase tracking-wider mb-2">Full Addresses</p>
                                {[
                                    { label: 'Wager ID', val: dispute.id },
                                    { label: 'Player A', val: dispute.player_a_wallet },
                                    { label: 'Player B', val: dispute.player_b_wallet },
                                ].filter(r => r.val).map(r => (
                                    <div key={r.label} className="flex items-start justify-between gap-3">
                                        <span className="text-muted-foreground shrink-0 w-16">{r.label}</span>
                                        <div className="flex items-center gap-1 min-w-0">
                                            <span className="font-mono text-foreground truncate">{r.val!}</span>
                                            <CopyBtn text={r.val!} />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {dispute.moderator_decision === 'cannot_determine' && (
                                <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4 space-y-2">
                                    <div className="flex items-center gap-2">
                                        <AlertTriangle className="h-4 w-4 text-purple-400 shrink-0" />
                                        <p className="text-sm font-bold text-purple-400">Escalated to Admin</p>
                                    </div>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        The assigned moderator could not determine a winner.
                                        Use <span className="text-foreground font-semibold">Pick Winner</span> or{' '}
                                        <span className="text-foreground font-semibold">Refund Both</span> below to resolve it.
                                    </p>
                                    {dispute.moderator_wallet && (
                                        <div className="flex items-center gap-1.5 pt-1">
                                            <span className="text-xs text-muted-foreground">Escalated by:</span>
                                            <span className="text-xs font-mono text-purple-300">{`${dispute.moderator_wallet.slice(0, 8)}...${dispute.moderator_wallet.slice(-4)}`}</span>
                                            <CopyBtn text={dispute.moderator_wallet} />
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="space-y-3 pt-1">
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Admin Resolution</p>

                                {resolveStep === null && !refundStep && (
                                    <div className="grid grid-cols-2 gap-3">
                                        <button onClick={() => setResolveStep('pick')} disabled={!publicKey}
                                            className="flex items-center justify-center gap-2 bg-primary/20 hover:bg-primary/30 border border-primary/30 text-primary font-semibold py-3 px-4 rounded-xl transition-colors text-sm disabled:opacity-40">
                                            <Trophy className="h-4 w-4" />Pick Winner
                                        </button>
                                        <button onClick={() => setRefundStep(true)} disabled={!publicKey}
                                            className="flex items-center justify-center gap-2 bg-slate-500/20 hover:bg-slate-500/30 border border-slate-500/30 text-slate-400 font-semibold py-3 px-4 rounded-xl transition-colors text-sm disabled:opacity-40">
                                            <RotateCcw className="h-4 w-4" />Refund Both
                                        </button>
                                    </div>
                                )}

                                {!publicKey && (
                                    <p className="text-xs text-amber-400 text-center">Connect admin wallet to take action</p>
                                )}

                                {resolveStep === 'pick' && (
                                    <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
                                        <p className="text-xs text-muted-foreground font-semibold">Who won this match?</p>
                                        {[
                                            { label: 'Player A wins', wallet: dispute.player_a_wallet, voted: dispute.vote_player_a === dispute.player_a_wallet },
                                            ...(dispute.player_b_wallet ? [{ label: 'Player B wins', wallet: dispute.player_b_wallet, voted: dispute.vote_player_b === dispute.player_b_wallet }] : []),
                                        ].map(({ label, wallet, voted }) => (
                                            <button key={wallet} onClick={() => { setResolveWinner(wallet); setResolveStep('confirm'); }}
                                                className="w-full text-left flex items-center justify-between px-4 py-3 text-sm bg-card/60 border border-border/40 hover:border-primary/50 rounded-xl transition-colors">
                                                <div>
                                                    <span className="font-semibold text-foreground">{label}</span>
                                                    <span className="text-xs text-muted-foreground ml-2 font-mono">{short(wallet)}</span>
                                                </div>
                                                {voted && <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full">Voted for self</span>}
                                            </button>
                                        ))}
                                        <button onClick={resetActions} className="w-full py-2 text-xs text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                                    </motion.div>
                                )}

                                {resolveStep === 'confirm' && resolveWinner && (
                                    <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                                        <div className="bg-primary/10 border border-primary/20 rounded-xl p-3">
                                            <p className="text-xs text-muted-foreground mb-0.5">Awarding win to:</p>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-sm font-mono text-primary font-bold">{resolveWinner}</span>
                                                <CopyBtn text={resolveWinner} />
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-1">They will receive {((dispute.stake_lamports * 2 - calculatePlatformFee(dispute.stake_lamports)) / 1e9).toFixed(4)} SOL (after platform fee).</p>
                                        </div>
                                        <input type="text" value={confirmText} onChange={e => setConfirmText(e.target.value.toUpperCase())}
                                            placeholder="Type CONFIRM to proceed..." autoFocus
                                            className="w-full px-4 py-2.5 bg-card border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-foreground text-sm placeholder:text-muted-foreground" />
                                        <div className="flex gap-2">
                                            <button onClick={resetActions} className="flex-1 py-2.5 text-sm bg-card border border-border/50 text-foreground rounded-xl hover:border-primary/40 transition-colors">Cancel</button>
                                            <button
                                                onClick={async () => {
                                                    await onAction('forceResolve', dispute.id, { winnerWallet: resolveWinner, notes: 'Admin force resolved via dispute panel' });
                                                    resetActions();
                                                }}
                                                disabled={confirmText !== 'CONFIRM' || actionLoading === dispute.id}
                                                className="flex-1 py-2.5 text-sm bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                            >
                                                {actionLoading === dispute.id ? <Loader2 className="h-4 w-4 animate-spin" /> : '✓ Confirm Resolution'}
                                            </button>
                                        </div>
                                    </motion.div>
                                )}

                                {refundStep && (
                                    <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                                        <div className="bg-slate-500/10 border border-slate-500/20 rounded-xl p-3">
                                            <p className="text-xs font-semibold text-slate-400 mb-1">Refund both players</p>
                                            <p className="text-xs text-muted-foreground">Each player receives {solStake} SOL back.</p>
                                        </div>
                                        <input type="text" value={confirmText} onChange={e => setConfirmText(e.target.value.toUpperCase())}
                                            placeholder="Type CONFIRM to proceed..." autoFocus
                                            className="w-full px-4 py-2.5 bg-card border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-foreground text-sm placeholder:text-muted-foreground" />
                                        <div className="flex gap-2">
                                            <button onClick={resetActions} className="flex-1 py-2.5 text-sm bg-card border border-border/50 text-foreground rounded-xl hover:border-primary/40 transition-colors">Cancel</button>
                                            <button
                                                onClick={async () => {
                                                    await onAction('forceRefund', dispute.id, { notes: 'Admin force refund via dispute panel' });
                                                    resetActions();
                                                }}
                                                disabled={confirmText !== 'CONFIRM' || actionLoading === dispute.id}
                                                className="flex-1 py-2.5 text-sm bg-slate-500 hover:bg-slate-500/90 text-white rounded-xl font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                            >
                                                {actionLoading === dispute.id ? <Loader2 className="h-4 w-4 animate-spin" /> : '↩ Confirm Refund'}
                                            </button>
                                        </div>
                                    </motion.div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

function PaginationBar({ page, totalPages, onPrev, onNext, disabled }: {
    page: number; totalPages: number; onPrev: () => void; onNext: () => void; disabled: boolean;
}) {
    if (totalPages <= 1) return null;
    return (
        <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-muted-foreground">
                Page <span className="font-semibold text-foreground">{page}</span> of{' '}
                <span className="font-semibold text-foreground">{totalPages}</span>
            </span>
            <div className="flex gap-2">
                <button onClick={onPrev} disabled={disabled || page <= 1}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs bg-card border border-border/50 hover:border-primary/40 rounded-lg text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                    <ChevronLeft className="h-3.5 w-3.5" />Prev
                </button>
                <button onClick={onNext} disabled={disabled || page >= totalPages}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs bg-card border border-border/50 hover:border-primary/40 rounded-lg text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                    Next<ChevronRight className="h-3.5 w-3.5" />
                </button>
            </div>
        </div>
    );
}

function DisputesContent() {
    const [searchTerm, setSearchTerm] = useState('');
    const [disputes, setDisputes] = useState<DisputeWager[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
    const [page, setPage] = useState(1);
    const { publicKey } = useWallet();

    const showToast = (type: 'success' | 'error', msg: string) => {
        setToast({ type, msg });
        setTimeout(() => setToast(null), 3500);
    };

    const fetchDisputes = async () => {
        try {
            setLoading(true);
            setError(null);
            const { data, error: fetchError } = await getSupabaseClient()
                .from('wagers')
                .select('id, match_id, player_a_wallet, player_b_wallet, game, stake_lamports, status, vote_player_a, vote_player_b, created_at, dispute_created_at, grace_conceded_by, moderator_wallet, winner_wallet, moderator_decision')
                .eq('status', 'disputed')
                .order('dispute_created_at', { ascending: true, nullsFirst: false });
            if (fetchError) throw fetchError;
            setDisputes((data || []) as DisputeWager[]);
            setPage(1);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch disputes');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchDisputes(); }, []);

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
            showToast('success', action === 'forceResolve' ? 'Dispute resolved — funds sent!' : 'Refund issued — wager cancelled!');
            setDisputes(prev => prev.filter(d => d.id !== wagerId));
            setExpandedId(null);
        } catch (err) {
            showToast('error', err instanceof Error ? err.message : 'Action failed');
        } finally {
            setActionLoading(null);
        }
    };

    const filteredDisputes = disputes.filter(d => {
        const q = searchTerm.toLowerCase();
        return !q || d.id.includes(q) || d.player_a_wallet.toLowerCase().includes(q) || (d.player_b_wallet?.toLowerCase().includes(q) ?? false);
    });

    // Reset to page 1 when search changes
    useEffect(() => { setPage(1); }, [searchTerm]);

    const totalPages = Math.max(1, Math.ceil(filteredDisputes.length / PAGE_SIZE));
    const pageDisputes = filteredDisputes.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const urgentCount = disputes.filter(d => {
        const hrs = (Date.now() - new Date(d.dispute_created_at || d.created_at).getTime()) / 3600000;
        return hrs >= 24;
    }).length;
    const totalPot = disputes.reduce((s, d) => s + d.stake_lamports * 2, 0);

    return (
        <ProtectedRoute>
            <div className="space-y-6">

                <AnimatePresence>
                    {toast && (
                        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                            className={`fixed top-20 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border text-sm font-medium
                                ${toast.type === 'success' ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' : 'bg-red-500/15 border-red-500/30 text-red-400'}`}>
                            {toast.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                            {toast.msg}
                        </motion.div>
                    )}
                </AnimatePresence>

                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-xl p-3 border border-amber-500/20">
                            <Scale className="h-6 w-6 text-amber-400" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-gaming font-bold text-glow">Dispute Resolution</h1>
                            <p className="text-sm text-muted-foreground">
                                {disputes.length} active dispute{disputes.length !== 1 ? 's' : ''}
                                {urgentCount > 0 && <span className="text-red-400 ml-2">· {urgentCount} urgent (24h+)</span>}
                            </p>
                        </div>
                    </div>
                    <button onClick={fetchDisputes} disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-card border border-border/50 hover:border-primary/40 rounded-xl text-sm text-foreground transition-colors disabled:opacity-50">
                        <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        <span className="hidden sm:inline">Refresh</span>
                    </button>
                </motion.div>

                {disputes.length > 0 && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-3 gap-3">
                        {[
                            { label: 'Total Disputes', value: disputes.length.toString(), icon: Scale, color: 'text-amber-400' },
                            { label: 'Urgent (24h+)', value: urgentCount.toString(), icon: Clock, color: urgentCount > 0 ? 'text-red-400' : 'text-muted-foreground' },
                            { label: 'SOL at Stake', value: `${(totalPot / 1e9).toFixed(2)} SOL`, icon: TrendingUp, color: 'text-primary' },
                        ].map(({ label, value, icon: Icon, color }) => (
                            <div key={label} className="glass rounded-2xl p-4 border border-primary/20 text-center">
                                <Icon className={`h-5 w-5 mx-auto mb-1.5 ${color}`} />
                                <p className={`text-xl font-gaming font-bold ${color}`}>{value}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                            </div>
                        ))}
                    </motion.div>
                )}

                {error && (
                    <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl flex items-center gap-2 text-sm">
                        <AlertTriangle className="h-4 w-4" />{error}
                    </div>
                )}

                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                    className="glass rounded-2xl p-4 border border-primary/20">
                    <div className="relative">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input type="text" placeholder="Search by wager ID or player wallet..."
                            value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-card border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-foreground placeholder:text-muted-foreground text-sm" />
                    </div>
                </motion.div>

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="flex flex-col items-center gap-3">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="text-sm text-muted-foreground">Loading disputes...</p>
                        </div>
                    </div>
                ) : filteredDisputes.length === 0 ? (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="glass rounded-2xl border border-primary/20 text-center py-16">
                        <Scale className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
                        <p className="text-lg font-gaming font-bold text-foreground mb-1">
                            {searchTerm ? 'No matches found' : 'No active disputes'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                            {searchTerm ? 'Try a different search' : 'All disputes resolved 🎉'}
                        </p>
                    </motion.div>
                ) : (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
                        className="space-y-3">
                        {pageDisputes.map(dispute => (
                            <DisputeCard
                                key={dispute.id}
                                dispute={dispute}
                                isExpanded={expandedId === dispute.id}
                                onToggle={() => setExpandedId(expandedId === dispute.id ? null : dispute.id)}
                                onAction={doAction}
                                actionLoading={actionLoading}
                                publicKey={publicKey}
                            />
                        ))}
                        <PaginationBar
                            page={page}
                            totalPages={totalPages}
                            onPrev={() => setPage(p => p - 1)}
                            onNext={() => setPage(p => p + 1)}
                            disabled={loading}
                        />
                    </motion.div>
                )}
            </div>
        </ProtectedRoute>
    );
}

export default function DisputesPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
            <DisputesContent />
        </Suspense>
    );
}