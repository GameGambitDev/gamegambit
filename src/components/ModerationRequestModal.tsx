'use client';

// src/components/ModerationRequestModal.tsx
//
// 30-second popup shown when this wallet is selected as a moderator.
// Triggered from GameEventContext via Realtime subscription on moderation_requests.
//
// Shows:
//  - Game type + players
//  - Stake amount
//  - Countdown ring (30s)
//  - Accept / Decline buttons
//
// Auto-dismisses (treated as decline) when countdown hits 0.

import { useEffect, useRef, useState } from 'react';
import { Scale, Clock, Swords, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
    useAcceptModeration,
    useDeclineModeration,
    useModerationWager,
    usePlayerDisplayNames,
} from '@/hooks/useModeration';
import type { ModerationRequest } from '@/hooks/useModeration';

interface Props {
    request: ModerationRequest;
    onAccepted: () => void;   // open ModerationPanel
    onDismissed: () => void;  // close popup, do nothing
}

const MODERATOR_FEE_NOTE = '30% of platform fee (capped at $10)';

function gameLabel(game: string): string {
    switch (game) {
        case 'chess': return 'Chess';
        case 'codm': return 'CODM';
        case 'pubg': return 'PUBG Mobile';
        case 'free_fire': return 'Free Fire';
        default: return game.toUpperCase();
    }
}

export function ModerationRequestModal({ request, onAccepted, onDismissed }: Props) {
    const deadline = new Date(request.deadline).getTime();
    const totalSeconds = Math.max(1, Math.round((deadline - Date.now()) / 1000));

    const [secondsLeft, setSecondsLeft] = useState(() =>
        Math.max(0, Math.round((deadline - Date.now()) / 1000))
    );
    const [closing, setClosing] = useState(false);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Fix: keep onDismissed/onAccepted in refs so the interval closure never
    // captures a stale version if the parent re-renders and passes new callbacks.
    const onDismissedRef = useRef(onDismissed);
    const onAcceptedRef = useRef(onAccepted);
    useEffect(() => { onDismissedRef.current = onDismissed; }, [onDismissed]);
    useEffect(() => { onAcceptedRef.current = onAccepted; }, [onAccepted]);

    const accept = useAcceptModeration();
    const decline = useDeclineModeration();

    const { data: wager } = useModerationWager(request.wager_id);
    const { data: names } = usePlayerDisplayNames([
        wager?.player_a_wallet,
        wager?.player_b_wallet,
    ]);

    // Countdown — polls on 500ms tick so the ring stays smooth.
    // Uses refs for callbacks so the interval is never re-registered on parent renders.
    useEffect(() => {
        intervalRef.current = setInterval(() => {
            const remaining = Math.max(0, Math.round((deadline - Date.now()) / 1000));
            setSecondsLeft(remaining);
            if (remaining === 0) {
                clearInterval(intervalRef.current!);
                handleDismiss();
            }
        }, 500);
        return () => clearInterval(intervalRef.current!);
        // deadline is stable for the lifetime of this request — intentional dep list
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [deadline]);

    function handleDismiss() {
        setClosing(true);
        setTimeout(() => onDismissedRef.current(), 300);
    }

    async function handleDecline() {
        try {
            await decline.mutateAsync({ requestId: request.id });
        } catch {
            // non-critical — dismiss regardless
        }
        handleDismiss();
    }

    async function handleAccept() {
        try {
            await accept.mutateAsync({ requestId: request.id });
            setClosing(true);
            setTimeout(() => onAcceptedRef.current(), 300);
        } catch (e) {
            console.error('[ModerationRequestModal] accept error:', e);
        }
    }

    const progress = secondsLeft / totalSeconds; // 1 → 0
    const urgentColor =
        secondsLeft <= 10 ? '#ef4444' :
            secondsLeft <= 20 ? '#f59e0b' :
                '#22c55e';
    const circumference = 2 * Math.PI * 22;
    const dashOffset = circumference * (1 - progress);

    const potSOL = wager ? ((wager.stake_lamports * 2) / 1e9).toFixed(3) : '...';
    const playerA = wager?.player_a_wallet ? (names?.[wager.player_a_wallet] ?? '...') : '...';
    const playerB = wager?.player_b_wallet ? (names?.[wager.player_b_wallet] ?? '...') : '...';

    return (
        <div
            className={cn(
                'fixed inset-0 z-[100] flex items-center justify-center p-4',
                'bg-black/70 backdrop-blur-sm',
                'transition-opacity duration-300',
                closing ? 'opacity-0' : 'opacity-100',
            )}
        >
            <div
                className={cn(
                    'relative w-full max-w-sm rounded-2xl border border-border/60 bg-card shadow-2xl',
                    'transition-all duration-300',
                    closing ? 'scale-95 opacity-0' : 'scale-100 opacity-100',
                )}
            >
                {/* Top accent bar */}
                <div className="h-1 w-full rounded-t-2xl bg-gradient-to-r from-primary via-primary/70 to-primary/30" />

                {/* Header */}
                <div className="flex items-start justify-between px-5 pt-5 pb-3">
                    <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/30">
                            <Scale className="h-4.5 w-4.5 text-primary" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold leading-tight">Moderation Request</p>
                            <p className="text-xs text-muted-foreground">You've been selected as a moderator</p>
                        </div>
                    </div>

                    {/* Countdown ring */}
                    <div className="relative flex-shrink-0">
                        <svg width="52" height="52" className="-rotate-90">
                            <circle
                                cx="26" cy="26" r="22"
                                fill="none" stroke="currentColor"
                                strokeWidth="3"
                                className="text-muted/30"
                            />
                            <circle
                                cx="26" cy="26" r="22"
                                fill="none"
                                stroke={urgentColor}
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeDasharray={circumference}
                                strokeDashoffset={dashOffset}
                                style={{ transition: 'stroke-dashoffset 0.5s linear, stroke 0.3s' }}
                            />
                        </svg>
                        <span
                            className="absolute inset-0 flex items-center justify-center text-sm font-bold tabular-nums"
                            style={{ color: urgentColor }}
                        >
                            {secondsLeft}
                        </span>
                    </div>
                </div>

                {/* Match info card */}
                <div className="mx-5 mb-4 rounded-xl border border-border/50 bg-muted/30 p-4">
                    <div className="mb-3 flex items-center justify-between">
                        <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                            {wager ? gameLabel(wager.game) : '...'}
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Swords className="h-3 w-3" />
                            Disputed match
                        </span>
                    </div>

                    {/* Players */}
                    <div className="flex items-center gap-2 text-sm">
                        <span className="flex-1 truncate font-medium text-center">{playerA}</span>
                        <span className="text-xs text-muted-foreground font-mono flex-shrink-0">vs</span>
                        <span className="flex-1 truncate font-medium text-center">{playerB}</span>
                    </div>

                    {/* Pot */}
                    <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-3 text-xs text-muted-foreground">
                        <span>Pot</span>
                        <span className="font-semibold text-foreground">{potSOL} SOL</span>
                    </div>
                </div>

                {/* Fee note */}
                <div className="mx-5 mb-4 flex items-center gap-2 rounded-lg bg-green-500/8 border border-green-500/20 px-3 py-2">
                    <Clock className="h-3.5 w-3.5 text-green-400 flex-shrink-0" />
                    <p className="text-xs text-green-400">
                        Accept to earn{' '}
                        <span className="font-semibold">{MODERATOR_FEE_NOTE}</span>{' '}
                        of the pot for a fair verdict
                    </p>
                </div>

                {/* Actions */}
                <div className="flex gap-2.5 px-5 pb-5">
                    <Button
                        variant="outline"
                        className="flex-1 border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/50"
                        onClick={handleDecline}
                        disabled={accept.isPending || decline.isPending}
                    >
                        Decline
                    </Button>
                    <Button
                        className="flex-1 gap-1.5 bg-primary hover:bg-primary/90"
                        onClick={handleAccept}
                        disabled={accept.isPending || decline.isPending}
                    >
                        {accept.isPending ? (
                            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                            <ChevronRight className="h-3.5 w-3.5" />
                        )}
                        Accept
                    </Button>
                </div>
            </div>
        </div>
    );
}