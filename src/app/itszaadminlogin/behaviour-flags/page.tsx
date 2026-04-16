'use client';

// src/app/itszaadminlogin/behaviour-flags/page.tsx

import { Suspense, useEffect, useState } from 'react';
import { ProtectedRoute } from '@/components/admin';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Flag, Search, Loader2, RefreshCcw, AlertTriangle,
    Copy, Check, ChevronRight, ChevronLeft, ExternalLink, TrendingUp, Users, Shield,
} from 'lucide-react';
import { getSupabaseClient } from '@/integrations/supabase/client';

// ── Types ─────────────────────────────────────────────────────────────────────

interface BehaviourEvent {
    id: string;
    player_wallet: string;
    event_type: string;
    notes: string | null;
    related_id: string | null;
    created_at: string;
}

interface PlayerFlag {
    wallet: string;
    events: BehaviourEvent[];
    falseVotes: number;
    disputeLosses: number;
    moderatorReports: number;
    lastEvent: string;
    riskScore: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function CopyBtn({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);
    return (
        <button
            onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            className="text-muted-foreground hover:text-primary transition-colors p-0.5"
        >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
    );
}

function short(w: string) {
    return `${w.slice(0, 8)}...${w.slice(-4)}`;
}

function TimeAgo({ date }: { date: string }) {
    const ms = Date.now() - new Date(date).getTime();
    const mins = Math.floor(ms / 60000);
    const hrs = Math.floor(mins / 60);
    const days = Math.floor(hrs / 24);
    const label = days > 0 ? `${days}d ago` : hrs > 0 ? `${hrs}h ago` : `${mins}m ago`;
    return <span className="text-xs text-muted-foreground">{label}</span>;
}

function RiskBadge({ score }: { score: number }) {
    if (score >= 8) return (
        <span className="bg-red-500/15 text-red-400 border border-red-500/30 text-xs font-bold px-2.5 py-1 rounded-full">
            🚨 High Risk
        </span>
    );
    if (score >= 4) return (
        <span className="bg-amber-500/15 text-amber-400 border border-amber-500/30 text-xs font-bold px-2.5 py-1 rounded-full">
            ⚠️ Medium Risk
        </span>
    );
    return (
        <span className="bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 text-xs font-bold px-2.5 py-1 rounded-full">
            👁 Low Risk
        </span>
    );
}

const EVENT_CONFIG: Record<string, { label: string; color: string; weight: number }> = {
    false_vote: { label: 'False Vote', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', weight: 2 },
    dispute_loss: { label: 'Dispute Loss', color: 'text-orange-400 bg-orange-500/10 border-orange-500/20', weight: 1 },
    moderator_reported: { label: 'Mod Reported', color: 'text-red-400 bg-red-500/10 border-red-500/20', weight: 3 },
    suspicious_pattern: { label: 'Suspicious', color: 'text-purple-400 bg-purple-500/10 border-purple-500/20', weight: 2 },
    account_flagged: { label: 'Flagged', color: 'text-rose-400 bg-rose-500/10 border-rose-500/20', weight: 4 },
};

function getEventConfig(type: string) {
    return EVENT_CONFIG[type] ?? { label: type, color: 'text-muted-foreground bg-muted/20 border-border/30', weight: 1 };
}

// ── PlayerFlagCard ────────────────────────────────────────────────────────────

function PlayerFlagCard({
    flag,
    isExpanded,
    onToggle,
}: {
    flag: PlayerFlag;
    isExpanded: boolean;
    onToggle: () => void;
}) {
    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`glass rounded-2xl border overflow-hidden transition-colors ${isExpanded ? 'border-red-500/40' : 'border-primary/20 hover:border-primary/40'}`}
        >
            {/* Card header */}
            <div className="p-5 cursor-pointer" onClick={onToggle}>
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="bg-red-500/15 rounded-xl p-2.5 border border-red-500/20 shrink-0">
                            <Flag className="h-5 w-5 text-red-400" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                <span className="text-sm font-mono font-bold text-foreground">{short(flag.wallet)}</span>
                                <CopyBtn text={flag.wallet} />
                                <RiskBadge score={flag.riskScore} />
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {flag.events.length} event{flag.events.length !== 1 ? 's' : ''} · Last: <TimeAgo date={flag.lastEvent} />
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                        {/* Quick stat pills */}
                        <div className="hidden sm:flex items-center gap-2">
                            {flag.falseVotes > 0 && (
                                <span className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full font-semibold">
                                    {flag.falseVotes} false vote{flag.falseVotes !== 1 ? 's' : ''}
                                </span>
                            )}
                            {flag.moderatorReports > 0 && (
                                <span className="text-xs bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full font-semibold">
                                    {flag.moderatorReports} report{flag.moderatorReports !== 1 ? 's' : ''}
                                </span>
                            )}
                        </div>
                        <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    </div>
                </div>
            </div>

            {/* Expanded detail */}
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
                            {/* Stats grid */}
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { label: 'False Votes', value: flag.falseVotes, color: 'text-amber-400' },
                                    { label: 'Dispute Losses', value: flag.disputeLosses, color: 'text-orange-400' },
                                    { label: 'Mod Reports', value: flag.moderatorReports, color: 'text-red-400' },
                                ].map(({ label, value, color }) => (
                                    <div key={label} className="bg-background/40 rounded-xl p-3 border border-border/30 text-center">
                                        <p className={`text-2xl font-gaming font-bold ${color}`}>{value}</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Full wallet address */}
                            <div className="bg-background/40 rounded-xl p-3 border border-border/30">
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Full Wallet Address</p>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-mono text-foreground break-all">{flag.wallet}</span>
                                    <CopyBtn text={flag.wallet} />
                                    <a
                                        href={`https://solscan.io/account/${flag.wallet}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-muted-foreground hover:text-primary transition-colors shrink-0"
                                    >
                                        <ExternalLink className="h-3.5 w-3.5" />
                                    </a>
                                </div>
                            </div>

                            {/* Event history */}
                            <div>
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Event History</p>
                                <div className="space-y-2">
                                    {flag.events.map((ev) => {
                                        const cfg = getEventConfig(ev.event_type);
                                        return (
                                            <div key={ev.id} className={`rounded-xl p-3 border ${cfg.color} flex items-start justify-between gap-3`}>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2 mb-0.5">
                                                        <span className="text-xs font-bold">{cfg.label}</span>
                                                        {ev.related_id && (
                                                            <span className="text-xs font-mono opacity-60 truncate">
                                                                #{ev.related_id.slice(0, 8)}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {ev.notes && (
                                                        <p className="text-xs opacity-70 leading-relaxed">{ev.notes}</p>
                                                    )}
                                                </div>
                                                <TimeAgo date={ev.created_at} />
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Quick links */}
                            <div className="flex gap-2 pt-1">
                                <a
                                    href={`/itszaadminlogin/profile?wallet=${flag.wallet}`}
                                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold bg-card border border-border/50 hover:border-primary/40 text-foreground rounded-xl transition-colors"
                                >
                                    <Users className="h-3.5 w-3.5" />
                                    View Profile
                                </a>
                                <a
                                    href={`/itszaadminlogin/wagers?wallet=${flag.wallet}`}
                                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold bg-card border border-border/50 hover:border-primary/40 text-foreground rounded-xl transition-colors"
                                >
                                    <Shield className="h-3.5 w-3.5" />
                                    Wager History
                                </a>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

// ── BehaviourFlagsContent ─────────────────────────────────────────────────────

type RiskFilter = 'all' | 'high' | 'medium' | 'low';

function BehaviourFlagsContent() {
    const [events, setEvents] = useState<BehaviourEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [riskFilter, setRiskFilter] = useState<RiskFilter>('all');
    const [expandedWallet, setExpandedWallet] = useState<string | null>(null);
    const [page, setPage] = useState(1);

    // Reset page when filters change
    useEffect(() => { setPage(1); }, [searchTerm, riskFilter]);

    const fetchEvents = async () => {
        try {
            setLoading(true);
            setError(null);
            const { data, error: fetchError } = await getSupabaseClient()
                .from('player_behaviour_log')
                .select('id, player_wallet, event_type, notes, related_id, created_at')
                .order('created_at', { ascending: false })
                .limit(1000);
            if (fetchError) throw fetchError;
            setEvents((data ?? []) as BehaviourEvent[]);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch behaviour log');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchEvents(); }, []);

    // Group by wallet and compute risk scores
    const playerFlags: PlayerFlag[] = (() => {
        const map = new Map<string, BehaviourEvent[]>();
        for (const ev of events) {
            const arr = map.get(ev.player_wallet) ?? [];
            arr.push(ev);
            map.set(ev.player_wallet, arr);
        }
        return Array.from(map.entries()).map(([wallet, evs]) => {
            const falseVotes = evs.filter(e => e.event_type === 'false_vote').length;
            const disputeLosses = evs.filter(e => e.event_type === 'dispute_loss').length;
            const moderatorReports = evs.filter(e => e.event_type === 'moderator_reported').length;
            const riskScore = evs.reduce((sum, e) => sum + (getEventConfig(e.event_type).weight), 0);
            const lastEvent = evs.reduce((latest, e) =>
                new Date(e.created_at) > new Date(latest) ? e.created_at : latest,
                evs[0].created_at
            );
            return { wallet, events: evs, falseVotes, disputeLosses, moderatorReports, lastEvent, riskScore };
        }).sort((a, b) => b.riskScore - a.riskScore);
    })();

    const filtered = playerFlags.filter(f => {
        const q = searchTerm.toLowerCase();
        const matchesSearch = !q || f.wallet.toLowerCase().includes(q);
        const matchesRisk = riskFilter === 'all'
            || (riskFilter === 'high' && f.riskScore >= 8)
            || (riskFilter === 'medium' && f.riskScore >= 4 && f.riskScore < 8)
            || (riskFilter === 'low' && f.riskScore < 4);
        return matchesSearch && matchesRisk;
    });

    const PAGE_SIZE = 25;
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const pageFlags = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const highRiskCount = playerFlags.filter(f => f.riskScore >= 8).length;
    const mediumRiskCount = playerFlags.filter(f => f.riskScore >= 4 && f.riskScore < 8).length;

    return (
        <ProtectedRoute>
            <div className="space-y-6">

                {/* Header */}
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-gradient-to-br from-red-500/20 to-rose-500/20 rounded-xl p-3 border border-red-500/20">
                            <Flag className="h-6 w-6 text-red-400" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-gaming font-bold text-glow">Behaviour Flags</h1>
                            <p className="text-sm text-muted-foreground">
                                {playerFlags.length} flagged player{playerFlags.length !== 1 ? 's' : ''}
                                {highRiskCount > 0 && (
                                    <span className="text-red-400 ml-2">· {highRiskCount} high risk</span>
                                )}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={fetchEvents}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-card border border-border/50 hover:border-primary/40 rounded-xl text-sm text-foreground transition-colors disabled:opacity-50"
                    >
                        <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        <span className="hidden sm:inline">Refresh</span>
                    </button>
                </motion.div>

                {/* Stats row */}
                {playerFlags.length > 0 && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-3 gap-3">
                        {[
                            { label: 'Total Flagged', value: playerFlags.length.toString(), icon: Users, color: 'text-primary' },
                            { label: 'High Risk', value: highRiskCount.toString(), icon: AlertTriangle, color: highRiskCount > 0 ? 'text-red-400' : 'text-muted-foreground' },
                            { label: 'Medium Risk', value: mediumRiskCount.toString(), icon: TrendingUp, color: mediumRiskCount > 0 ? 'text-amber-400' : 'text-muted-foreground' },
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

                {/* Search + filter */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="glass rounded-2xl p-4 border border-primary/20 space-y-3"
                >
                    <div className="relative">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search by wallet address..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-card border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-foreground placeholder:text-muted-foreground text-sm"
                        />
                    </div>
                    <div className="flex gap-2">
                        {(['all', 'high', 'medium', 'low'] as RiskFilter[]).map(f => (
                            <button
                                key={f}
                                onClick={() => setRiskFilter(f)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors capitalize border
                                    ${riskFilter === f
                                        ? 'bg-primary/20 border-primary/40 text-primary'
                                        : 'bg-card border-border/40 text-muted-foreground hover:text-foreground hover:border-primary/30'}`}
                            >
                                {f === 'all' ? 'All' : f === 'high' ? '🚨 High' : f === 'medium' ? '⚠️ Medium' : '👁 Low'}
                            </button>
                        ))}
                    </div>
                </motion.div>

                {/* List */}
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="flex flex-col items-center gap-3">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="text-sm text-muted-foreground">Loading behaviour logs...</p>
                        </div>
                    </div>
                ) : filtered.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="glass rounded-2xl border border-primary/20 text-center py-16"
                    >
                        <Flag className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
                        <p className="text-lg font-gaming font-bold text-foreground mb-1">
                            {searchTerm || riskFilter !== 'all' ? 'No matches found' : 'No flagged players'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                            {searchTerm || riskFilter !== 'all' ? 'Try adjusting your filters' : 'All players are behaving well 🎉'}
                        </p>
                    </motion.div>
                ) : (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="space-y-3"
                    >
                        {pageFlags.map(flag => (
                            <PlayerFlagCard
                                key={flag.wallet}
                                flag={flag}
                                isExpanded={expandedWallet === flag.wallet}
                                onToggle={() => setExpandedWallet(expandedWallet === flag.wallet ? null : flag.wallet)}
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

// ── Page export ───────────────────────────────────────────────────────────────

export default function BehaviourFlagsPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        }>
            <BehaviourFlagsContent />
        </Suspense>
    );
}