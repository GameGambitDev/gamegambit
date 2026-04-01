'use client';

// src/components/ModerationPanel.tsx
//
// 5-step guided moderator workflow shown after accepting a moderation request.
// Steps:
//   1. Overview  — see dispute context, stake, players
//   2. Evidence  — watch stream / review votes cast by each player
//   3. Research  — links to game-specific verification (screenshots, IDs)
//   4. Decision  — pick winner / draw / cannot_determine
//   5. Confirm   — review selection + submit
//
// Verdict options:
//   - Player A wallet  (player A wins)
//   - Player B wallet  (player B wins)
//   - 'draw'           (refund both)
//   - 'cannot_determine' (escalate to admin)

import { useState, useEffect, useRef } from 'react';
import {
    X, Scale, Users, Video, Search, Gavel, CheckCircle,
    ExternalLink, Clock, AlertTriangle, ChevronRight, ChevronLeft,
    Trophy, Handshake, HelpCircle, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
    useModerationWager,
    usePlayerDisplayNames,
    useSubmitVerdict,
} from '@/hooks/useModeration';
import type { ModerationRequest } from '@/hooks/useModeration';

interface Props {
    request: ModerationRequest;
    onClose: () => void;
}

type VerdictOption = 'player_a' | 'player_b' | 'draw' | 'cannot_determine';

const STEPS = [
    { id: 1, label: 'Overview', icon: Users },
    { id: 2, label: 'Evidence', icon: Video },
    { id: 3, label: 'Research', icon: Search },
    { id: 4, label: 'Decision', icon: Gavel },
    { id: 5, label: 'Confirm', icon: CheckCircle },
];

function gameLabel(game: string) {
    const map: Record<string, string> = {
        chess: 'Chess', codm: 'CODM', pubg: 'PUBG Mobile', free_fire: 'Free Fire',
    };
    return map[game] ?? game.toUpperCase();
}

function formatCountdown(deadline: string | null): string {
    if (!deadline) return '--:--';
    const ms = new Date(deadline).getTime() - Date.now();
    if (ms <= 0) return '00:00';
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function ModerationPanel({ request, onClose }: Props) {
    const [step, setStep] = useState(1);
    const [verdict, setVerdict] = useState<VerdictOption | null>(null);
    const [notes, setNotes] = useState('');
    const [countdown, setCountdown] = useState(formatCountdown(request.decision_deadline));
    const [closing, setClosing] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [submitDone, setSubmitDone] = useState(false);

    const { data: wager } = useModerationWager(request.wager_id);
    const { data: names } = usePlayerDisplayNames([wager?.player_a_wallet, wager?.player_b_wallet]);
    const submitVerdict = useSubmitVerdict();

    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        intervalRef.current = setInterval(() => {
            setCountdown(formatCountdown(request.decision_deadline));
        }, 1000);
        return () => clearInterval(intervalRef.current!);
    }, [request.decision_deadline]);

    function handleClose() {
        setClosing(true);
        setTimeout(onClose, 300);
    }

    async function handleSubmit() {
        if (!verdict || !wager) return;
        setSubmitError(null);

        const resolvedVerdict =
            verdict === 'player_a' ? wager.player_a_wallet
                : verdict === 'player_b' ? (wager.player_b_wallet ?? 'draw')
                    : verdict;

        try {
            await submitVerdict.mutateAsync({
                requestId: request.id,
                verdict: resolvedVerdict,
                notes: notes.trim() || undefined,
            });
            setSubmitDone(true);
        } catch (e) {
            setSubmitError(e instanceof Error ? e.message : 'Failed to submit verdict');
        }
    }

    const playerAName = wager?.player_a_wallet ? (names?.[wager.player_a_wallet] ?? '...') : '...';
    const playerBName = wager?.player_b_wallet ? (names?.[wager.player_b_wallet] ?? '...') : '...';
    const stakeSOL = wager ? (wager.stake_lamports / 1e9).toFixed(3) : '...';
    const potSOL = wager ? ((wager.stake_lamports * 2) / 1e9).toFixed(3) : '...';

    const voteAFor = wager?.vote_player_a
        ? (wager.vote_player_a === wager.player_a_wallet ? playerAName
            : wager.vote_player_a === wager.player_b_wallet ? playerBName : 'Draw')
        : null;

    const voteBFor = wager?.vote_player_b
        ? (wager.vote_player_b === wager.player_a_wallet ? playerAName
            : wager.vote_player_b === wager.player_b_wallet ? playerBName : 'Draw')
        : null;

    const isDeadlineExpired = request.decision_deadline
        ? new Date(request.decision_deadline).getTime() < Date.now()
        : false;

    // ── Success screen ─────────────────────────────────────────────────────────
    if (submitDone) {
        return (
            <div className={cn(
                'fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm',
                'transition-opacity duration-300',
                closing ? 'opacity-0' : 'opacity-100',
            )}>
                <div className={cn(
                    'w-full max-w-sm rounded-2xl border border-border/60 bg-card shadow-2xl text-center p-8',
                    'transition-all duration-300',
                    closing ? 'scale-95 opacity-0' : 'scale-100 opacity-100',
                )}>
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10 ring-2 ring-green-500/30">
                        <CheckCircle className="h-8 w-8 text-green-400" />
                    </div>
                    <h3 className="mb-2 text-lg font-semibold">Verdict Submitted</h3>
                    <p className="mb-6 text-sm text-muted-foreground">
                        Your decision has been recorded. The moderator fee will be sent to your wallet.
                    </p>
                    <Button className="w-full" onClick={handleClose}>Done</Button>
                </div>
            </div>
        );
    }

    return (
        <div className={cn(
            'fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4 bg-black/70 backdrop-blur-sm',
            'transition-opacity duration-300',
            closing ? 'opacity-0' : 'opacity-100',
        )}>
            <div className={cn(
                'relative w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl border border-border/60 bg-card shadow-2xl',
                'flex flex-col max-h-[92dvh]',
                'transition-all duration-300',
                closing ? 'translate-y-4 opacity-0' : 'translate-y-0 opacity-100',
            )}>
                {/* Top accent */}
                <div className="h-1 w-full rounded-t-2xl bg-gradient-to-r from-amber-500 via-primary to-primary/30 flex-shrink-0" />

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-border/50 flex-shrink-0">
                    <div className="flex items-center gap-2.5">
                        <Scale className="h-4.5 w-4.5 text-amber-400" />
                        <div>
                            <p className="text-sm font-semibold">Moderation Panel</p>
                            {wager && (
                                <p className="text-xs text-muted-foreground">
                                    {gameLabel(wager.game)} · {potSOL} SOL pot
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Deadline countdown */}
                        {request.decision_deadline && (
                            <div className={cn(
                                'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-mono font-semibold',
                                isDeadlineExpired
                                    ? 'bg-destructive/15 text-destructive'
                                    : 'bg-amber-500/10 text-amber-400',
                            )}>
                                <Clock className="h-3 w-3" />
                                {countdown}
                            </div>
                        )}
                        <button
                            onClick={handleClose}
                            className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {/* Step progress */}
                <div className="flex items-center gap-0 px-5 py-3 border-b border-border/40 flex-shrink-0">
                    {STEPS.map((s, i) => {
                        const Icon = s.icon;
                        const isActive = s.id === step;
                        const isDone = s.id < step;
                        return (
                            <div key={s.id} className="flex items-center flex-1 last:flex-none">
                                <div className="flex flex-col items-center gap-1">
                                    <div className={cn(
                                        'flex h-7 w-7 items-center justify-center rounded-full text-xs transition-all duration-200',
                                        isActive && 'bg-primary text-primary-foreground ring-2 ring-primary/30',
                                        isDone && 'bg-primary/20 text-primary',
                                        !isActive && !isDone && 'bg-muted/50 text-muted-foreground',
                                    )}>
                                        {isDone ? <CheckCircle className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                                    </div>
                                    <span className={cn(
                                        'text-[9px] font-medium hidden sm:block',
                                        isActive ? 'text-foreground' : 'text-muted-foreground',
                                    )}>{s.label}</span>
                                </div>
                                {i < STEPS.length - 1 && (
                                    <div className={cn(
                                        'h-px flex-1 mx-1 mb-3 sm:mb-4 transition-colors',
                                        isDone ? 'bg-primary/40' : 'bg-border/50',
                                    )} />
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Body — scrollable */}
                <div className="flex-1 overflow-y-auto px-5 py-4">

                    {/* ── Step 1: Overview ── */}
                    {step === 1 && (
                        <div className="space-y-4">
                            <div>
                                <h3 className="mb-1 text-sm font-semibold">Dispute Overview</h3>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    Both players submitted votes that disagreed. Your job is to review the match and determine the correct winner.
                                    Be fair — your reputation depends on it.
                                </p>
                            </div>

                            {/* Players */}
                            <div className="rounded-xl border border-border/50 bg-muted/20 p-4 space-y-3">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Players</p>
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex-1 rounded-lg bg-muted/40 p-3 text-center">
                                        <p className="text-xs text-muted-foreground mb-1">Player A</p>
                                        <p className="text-sm font-semibold truncate">{playerAName}</p>
                                    </div>
                                    <span className="text-xs text-muted-foreground font-mono">vs</span>
                                    <div className="flex-1 rounded-lg bg-muted/40 p-3 text-center">
                                        <p className="text-xs text-muted-foreground mb-1">Player B</p>
                                        <p className="text-sm font-semibold truncate">{playerBName}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Stake */}
                            <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Stake each</span>
                                    <span className="font-semibold">{stakeSOL} SOL</span>
                                </div>
                                <div className="flex justify-between text-sm mt-2">
                                    <span className="text-muted-foreground">Total pot</span>
                                    <span className="font-semibold">{potSOL} SOL</span>
                                </div>
                                <div className="flex justify-between text-xs mt-2 pt-2 border-t border-border/40">
                                    <span className="text-muted-foreground">Your fee (fair verdict)</span>
                                    <span className="text-green-400 font-medium">
                                        ~{wager ? ((wager.stake_lamports * 2 * 0.1 * 0.4) / 1e9).toFixed(4) : '...'} SOL
                                    </span>
                                </div>
                            </div>

                            <div className="rounded-lg bg-amber-500/8 border border-amber-500/20 p-3 flex gap-2">
                                <AlertTriangle className="h-3.5 w-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
                                <p className="text-xs text-amber-400/90 leading-relaxed">
                                    You have {formatCountdown(request.decision_deadline)} to review and submit your verdict.
                                    Timing out will penalise your moderator score.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* ── Step 2: Evidence ── */}
                    {step === 2 && (
                        <div className="space-y-4">
                            <div>
                                <h3 className="mb-1 text-sm font-semibold">Review Votes & Evidence</h3>
                                <p className="text-xs text-muted-foreground">
                                    Each player voted for who they thought won. The conflict is why you're here.
                                </p>
                            </div>

                            {/* Votes */}
                            <div className="space-y-2">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Votes cast</p>
                                <div className="rounded-xl border border-border/50 bg-muted/20 divide-y divide-border/40">
                                    <div className="flex items-center justify-between px-4 py-3">
                                        <span className="text-xs text-muted-foreground">{playerAName} voted</span>
                                        <span className={cn(
                                            'text-xs font-semibold px-2 py-0.5 rounded-md',
                                            voteAFor ? 'bg-primary/10 text-primary' : 'text-muted-foreground',
                                        )}>
                                            {voteAFor ?? 'No vote'}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between px-4 py-3">
                                        <span className="text-xs text-muted-foreground">{playerBName} voted</span>
                                        <span className={cn(
                                            'text-xs font-semibold px-2 py-0.5 rounded-md',
                                            voteBFor ? 'bg-primary/10 text-primary' : 'text-muted-foreground',
                                        )}>
                                            {voteBFor ?? 'No vote'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Stream link */}
                            {wager?.stream_url ? (
                                <div className="space-y-2">
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Stream / Recording</p>
                                    <a
                                        href={wager.stream_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 rounded-xl border border-border/50 bg-muted/20 px-4 py-3 hover:bg-muted/40 transition-colors group"
                                    >
                                        <Video className="h-4 w-4 text-primary" />
                                        <span className="flex-1 text-sm truncate">{wager.stream_url}</span>
                                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                                    </a>
                                </div>
                            ) : (
                                <div className="rounded-xl border border-dashed border-border/40 bg-muted/10 px-4 py-6 text-center">
                                    <Video className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
                                    <p className="text-xs text-muted-foreground">No stream URL was provided for this match.</p>
                                    <p className="text-xs text-muted-foreground mt-1">Use in-game evidence to make your decision.</p>
                                </div>
                            )}

                            <div className="rounded-lg bg-muted/20 border border-border/40 p-3">
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    Check kill counts, final scores, or match results from the game itself.
                                    If you cannot verify either way, you can escalate to admin in the Decision step.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* ── Step 3: Research ── */}
                    {step === 3 && (
                        <div className="space-y-4">
                            <div>
                                <h3 className="mb-1 text-sm font-semibold">In-Game Verification</h3>
                                <p className="text-xs text-muted-foreground">
                                    Use the resources below to cross-reference the match result independently.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    {wager ? gameLabel(wager.game) : 'Game'} Resources
                                </p>

                                {wager?.game === 'codm' && (
                                    <div className="space-y-2">
                                        <ResourceLink
                                            href="https://www.callofduty.com/mobilelobby"
                                            label="COD Mobile — Official Match History"
                                            hint="Check match history by searching usernames"
                                        />
                                        <VerifyTip>Ask players to share in-game screenshots of the final scoreboard showing both usernames and the result.</VerifyTip>
                                    </div>
                                )}
                                {wager?.game === 'pubg' && (
                                    <div className="space-y-2">
                                        <ResourceLink
                                            href="https://pubgmobile.com"
                                            label="PUBG Mobile — Official Site"
                                            hint="Cross-reference match results via player stats"
                                        />
                                        <ResourceLink
                                            href="https://pubgmobile.com/landing/leaderboard.html"
                                            label="PUBG Mobile Leaderboard"
                                            hint="For verifying account authenticity"
                                        />
                                        <VerifyTip>Request a screenshot of the post-match results screen showing kills, placement, and both player names.</VerifyTip>
                                    </div>
                                )}
                                {wager?.game === 'free_fire' && (
                                    <div className="space-y-2">
                                        <ResourceLink
                                            href="https://ff.garena.com"
                                            label="Free Fire — Official Site"
                                            hint="Player profiles and match stats"
                                        />
                                        <VerifyTip>Look for in-game post-match screenshots that show both Free Fire UIDs and the final result.</VerifyTip>
                                    </div>
                                )}
                                {wager?.game === 'chess' && (
                                    <div className="space-y-2">
                                        <ResourceLink
                                            href="https://lichess.org"
                                            label="Lichess — Game Archive"
                                            hint="Chess games are auto-resolved, this is a fallback"
                                        />
                                        <VerifyTip>Chess wagers normally resolve automatically via Lichess. A moderation request here is unusual — check if there was a technical issue.</VerifyTip>
                                    </div>
                                )}
                            </div>

                            <div className="rounded-lg bg-muted/20 border border-border/40 p-3">
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    You are not expected to contact the players directly. Base your decision on available evidence.
                                    If evidence is genuinely ambiguous, select "Cannot Determine" in the next step.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* ── Step 4: Decision ── */}
                    {step === 4 && (
                        <div className="space-y-4">
                            <div>
                                <h3 className="mb-1 text-sm font-semibold">Your Verdict</h3>
                                <p className="text-xs text-muted-foreground">
                                    Select who you believe won this match, or escalate if you cannot determine a result.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <VerdictOption
                                    active={verdict === 'player_a'}
                                    onClick={() => setVerdict('player_a')}
                                    icon={<Trophy className="h-4 w-4 text-yellow-400" />}
                                    label={playerAName}
                                    hint="Player A wins"
                                />
                                <VerdictOption
                                    active={verdict === 'player_b'}
                                    onClick={() => setVerdict('player_b')}
                                    icon={<Trophy className="h-4 w-4 text-yellow-400" />}
                                    label={playerBName}
                                    hint="Player B wins"
                                />
                                <VerdictOption
                                    active={verdict === 'draw'}
                                    onClick={() => setVerdict('draw')}
                                    icon={<Handshake className="h-4 w-4 text-blue-400" />}
                                    label="Draw"
                                    hint="Refund both players"
                                />
                                <VerdictOption
                                    active={verdict === 'cannot_determine'}
                                    onClick={() => setVerdict('cannot_determine')}
                                    icon={<HelpCircle className="h-4 w-4 text-muted-foreground" />}
                                    label="Cannot Determine"
                                    hint="Escalate to admin — no fee earned"
                                    muted
                                />
                            </div>

                            {/* Optional notes */}
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                                    Notes (optional)
                                </label>
                                <textarea
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    placeholder="Briefly explain your reasoning..."
                                    rows={3}
                                    className={cn(
                                        'w-full resize-none rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5',
                                        'text-sm placeholder:text-muted-foreground/50',
                                        'focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20',
                                        'transition-colors',
                                    )}
                                />
                            </div>
                        </div>
                    )}

                    {/* ── Step 5: Confirm ── */}
                    {step === 5 && (
                        <div className="space-y-4">
                            <div>
                                <h3 className="mb-1 text-sm font-semibold">Confirm & Submit</h3>
                                <p className="text-xs text-muted-foreground">
                                    Review your decision. Once submitted it cannot be changed.
                                </p>
                            </div>

                            {/* Summary */}
                            <div className="rounded-xl border border-border/50 bg-muted/20 divide-y divide-border/40">
                                <div className="flex items-center justify-between px-4 py-3">
                                    <span className="text-xs text-muted-foreground">Match</span>
                                    <span className="text-xs font-medium">
                                        {wager ? gameLabel(wager.game) : '...'} — {potSOL} SOL
                                    </span>
                                </div>
                                <div className="flex items-center justify-between px-4 py-3">
                                    <span className="text-xs text-muted-foreground">Your verdict</span>
                                    <span className={cn(
                                        'text-xs font-semibold px-2 py-0.5 rounded-md',
                                        verdict === 'cannot_determine'
                                            ? 'bg-muted/50 text-muted-foreground'
                                            : 'bg-primary/10 text-primary',
                                    )}>
                                        {verdict === 'player_a' ? playerAName
                                            : verdict === 'player_b' ? playerBName
                                                : verdict === 'draw' ? 'Draw'
                                                    : 'Cannot Determine'}
                                    </span>
                                </div>
                                {notes.trim() && (
                                    <div className="px-4 py-3">
                                        <p className="text-xs text-muted-foreground mb-1">Your notes</p>
                                        <p className="text-xs leading-relaxed">{notes.trim()}</p>
                                    </div>
                                )}
                            </div>

                            {verdict !== 'cannot_determine' && (
                                <div className="rounded-lg bg-green-500/8 border border-green-500/20 p-3 flex gap-2">
                                    <CheckCircle className="h-3.5 w-3.5 text-green-400 flex-shrink-0 mt-0.5" />
                                    <p className="text-xs text-green-400">
                                        Submitting a fair verdict earns you{' '}
                                        <span className="font-semibold">
                                            ~{wager ? ((wager.stake_lamports * 2 * 0.04) / 1e9).toFixed(4) : '...'} SOL
                                        </span>
                                    </p>
                                </div>
                            )}

                            {verdict === 'cannot_determine' && (
                                <div className="rounded-lg bg-muted/20 border border-border/40 p-3 flex gap-2">
                                    <AlertTriangle className="h-3.5 w-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                                    <p className="text-xs text-amber-400/80">
                                        Escalating to admin — no moderator fee will be earned. Only use this if evidence is genuinely ambiguous.
                                    </p>
                                </div>
                            )}

                            {submitError && (
                                <p className="text-xs text-destructive rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2">
                                    {submitError}
                                </p>
                            )}
                        </div>
                    )}

                </div>

                {/* Footer nav */}
                <div className="flex items-center gap-2.5 border-t border-border/50 px-5 py-4 flex-shrink-0">
                    {step > 1 && (
                        <Button
                            variant="outline"
                            className="gap-1.5 border-border/60"
                            onClick={() => setStep(s => s - 1)}
                            disabled={submitVerdict.isPending}
                        >
                            <ChevronLeft className="h-3.5 w-3.5" />
                            Back
                        </Button>
                    )}

                    <div className="flex-1" />

                    {step < 5 ? (
                        <Button
                            className="gap-1.5"
                            onClick={() => setStep(s => s + 1)}
                            disabled={step === 4 && !verdict}
                        >
                            {step === 4 ? 'Review' : 'Next'}
                            <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                    ) : (
                        <Button
                            className="gap-1.5 bg-primary hover:bg-primary/90"
                            onClick={handleSubmit}
                            disabled={!verdict || submitVerdict.isPending}
                        >
                            {submitVerdict.isPending ? (
                                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Submitting...</>
                            ) : (
                                <><Gavel className="h-3.5 w-3.5" /> Submit Verdict</>
                            )}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function VerdictOption({
    active, onClick, icon, label, hint, muted,
}: {
    active: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
    hint: string;
    muted?: boolean;
}) {
    return (
        <button
            onClick={onClick}
            className={cn(
                'w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all duration-150',
                active
                    ? 'border-primary/60 bg-primary/8 ring-1 ring-primary/20'
                    : 'border-border/50 bg-muted/20 hover:bg-muted/40 hover:border-border/70',
            )}
        >
            <div className={cn(
                'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full',
                active ? 'bg-primary/15' : 'bg-muted/50',
            )}>
                {icon}
            </div>
            <div className="flex-1 min-w-0">
                <p className={cn('text-sm font-medium truncate', muted && !active && 'text-muted-foreground')}>
                    {label}
                </p>
                <p className="text-xs text-muted-foreground">{hint}</p>
            </div>
            <div className={cn(
                'h-4 w-4 flex-shrink-0 rounded-full border-2 transition-colors',
                active ? 'border-primary bg-primary' : 'border-muted-foreground/40',
            )}>
                {active && <div className="h-full w-full rounded-full bg-primary-foreground scale-50" />}
            </div>
        </button>
    );
}

function ResourceLink({ href, label, hint }: { href: string; label: string; hint: string }) {
    return (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-xl border border-border/50 bg-muted/20 px-4 py-3 hover:bg-muted/40 transition-colors group"
        >
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{label}</p>
                <p className="text-xs text-muted-foreground">{hint}</p>
            </div>
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground flex-shrink-0 transition-colors" />
        </a>
    );
}

function VerifyTip({ children }: { children: React.ReactNode }) {
    return (
        <div className="rounded-lg bg-blue-500/8 border border-blue-500/20 px-3 py-2 flex gap-2">
            <Search className="h-3.5 w-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-400/90">{children}</p>
        </div>
    );
}