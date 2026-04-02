'use client'

// src/components/PunishmentNoticeModal.tsx — Step 6
//
// Shown to the losing player after a moderator-resolved dispute.
// Triggered from my-wagers/page.tsx or dashboard/page.tsx when a
// wager_lost notification arrives AND wager.moderator_decision is set.
//
// Displays:
//  - What offense was logged (dispute_loss)
//  - Current offense count and what tier they're at
//  - What the punishment is (warning / suspension)
//  - Future escalation tiers so they know what's coming
//  - "Report unfair verdict" button → opens ReportModeratorModal
//
// Props:
//   open          — boolean controlled by parent
//   onOpenChange  — (open: boolean) => void
//   wagerId       — string — used to pass to ReportModeratorModal
//   offenseCount  — number — fetched from punishment_log by parent
//   punishment    — string — 'warning' | 'suspend_24h' | 'suspend_72h' | 'suspend_168h'
//   onReport      — () => void — parent opens ReportModeratorModal

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, ShieldAlert, Clock, ChevronRight, Flag } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    wagerId: string
    offenseCount: number
    punishment: string
    onReport: () => void
}

const TIERS = [
    { count: 1, label: 'Warning', badge: 'warning', desc: 'First offense — formal warning logged', suspendHours: null },
    { count: 2, label: '24h suspend', badge: 'moderate', desc: 'Account suspended for 24 hours', suspendHours: 24 },
    { count: 3, label: '3d suspend', badge: 'serious', desc: 'Account suspended for 3 days', suspendHours: 72 },
    { count: 4, label: '7d suspend', badge: 'severe', desc: '4th offense and beyond — 7-day suspension', suspendHours: 168 },
]

function parsePunishment(raw: string): { label: string; isSuspension: boolean; duration: string | null } {
    switch (raw) {
        case 'warning': return { label: 'Warning issued', isSuspension: false, duration: null }
        case 'suspend_24h': return { label: 'Suspended for 24 hours', isSuspension: true, duration: '24 hours' }
        case 'suspend_72h': return { label: 'Suspended for 3 days', isSuspension: true, duration: '3 days' }
        case 'suspend_168h': return { label: 'Suspended for 7 days', isSuspension: true, duration: '7 days' }
        default: return { label: raw, isSuspension: false, duration: null }
    }
}

export function PunishmentNoticeModal({
    open, onOpenChange, offenseCount, punishment, onReport,
}: Props) {
    const parsed = parsePunishment(punishment)

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md p-0 overflow-hidden border-destructive/30">
                {/* Top accent */}
                <div className="h-1 w-full bg-gradient-to-r from-destructive via-destructive/70 to-destructive/30" />

                <div className="px-6 pt-5 pb-6 space-y-5">
                    <DialogHeader>
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 ring-1 ring-destructive/30 flex-shrink-0">
                                <ShieldAlert className="h-5 w-5 text-destructive" />
                            </div>
                            <div>
                                <DialogTitle className="text-base font-semibold leading-tight">
                                    Dispute Ruling — Account Notice
                                </DialogTitle>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    The moderator ruled against you in this dispute
                                </p>
                            </div>
                        </div>
                    </DialogHeader>

                    {/* Current punishment */}
                    <div className={cn(
                        'rounded-xl border p-4',
                        parsed.isSuspension
                            ? 'border-destructive/40 bg-destructive/8'
                            : 'border-amber-500/30 bg-amber-500/8',
                    )}>
                        <div className="flex items-start gap-3">
                            <AlertTriangle className={cn(
                                'h-4 w-4 mt-0.5 flex-shrink-0',
                                parsed.isSuspension ? 'text-destructive' : 'text-amber-500',
                            )} />
                            <div>
                                <p className={cn(
                                    'text-sm font-semibold',
                                    parsed.isSuspension ? 'text-destructive' : 'text-amber-500',
                                )}>
                                    {parsed.label}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                    This is offense <span className="font-semibold text-foreground">#{offenseCount}</span> on your account.
                                    {parsed.isSuspension && (
                                        <> You cannot create or join wagers until your suspension expires.</>
                                    )}
                                    {!parsed.isSuspension && (
                                        <> No suspension this time. Further offenses will result in account suspension.</>
                                    )}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Tier escalation table */}
                    <div>
                        <p className="text-xs text-muted-foreground mb-2.5 font-medium uppercase tracking-wide">
                            Dispute loss escalation
                        </p>
                        <div className="space-y-1.5">
                            {TIERS.map((tier) => {
                                const isCurrent = tier.count === offenseCount
                                const isPast = tier.count < offenseCount
                                return (
                                    <div
                                        key={tier.count}
                                        className={cn(
                                            'flex items-center gap-3 rounded-lg px-3 py-2 text-xs',
                                            isCurrent && 'bg-destructive/10 border border-destructive/25',
                                            isPast && 'opacity-40',
                                            !isCurrent && !isPast && 'bg-muted/30',
                                        )}
                                    >
                                        <span className={cn(
                                            'flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold flex-shrink-0',
                                            isCurrent && 'bg-destructive text-destructive-foreground',
                                            isPast && 'bg-muted text-muted-foreground',
                                            !isCurrent && !isPast && 'bg-muted/60 text-muted-foreground',
                                        )}>
                                            {tier.count}
                                        </span>
                                        <span className={cn(
                                            'font-medium flex-shrink-0 w-24',
                                            isCurrent ? 'text-destructive' : 'text-muted-foreground',
                                        )}>
                                            {tier.label}
                                        </span>
                                        <span className="text-muted-foreground/70 truncate">{tier.desc}</span>
                                        {isCurrent && (
                                            <Badge variant="destructive" className="ml-auto text-[9px] px-1.5 py-0 flex-shrink-0">
                                                current
                                            </Badge>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Appeal note */}
                    <p className="text-xs text-muted-foreground leading-relaxed border-t border-border/40 pt-4">
                        If you believe the moderator's verdict was unfair, you can file a report. Reports are
                        reviewed by admins and may result in the moderator's reputation being flagged.
                    </p>

                    {/* Actions */}
                    <div className="flex gap-2.5">
                        <Button
                            variant="ghost"
                            className="flex-1 text-muted-foreground border border-border/50 hover:bg-muted/50"
                            onClick={() => onOpenChange(false)}
                        >
                            Understood
                        </Button>
                        <Button
                            variant="outline"
                            className="flex-1 gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => { onOpenChange(false); onReport() }}
                        >
                            <Flag className="h-3.5 w-3.5" />
                            Report verdict
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}