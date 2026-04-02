'use client'

// src/components/ReportModeratorModal.tsx — Step 6
//
// Lets a player report an unfair moderator verdict after a dispute resolves.
// Calls POST /api/moderation/report with { wagerId, reason }.
//
// Guards:
//  - Minimum 10-char reason (enforced client + server side)
//  - Duplicate report prevention handled server-side (409 response)
//  - Only callable from PunishmentNoticeModal (shown to loser)
//
// Usage:
//   <ReportModeratorModal
//     open={reportOpen}
//     onOpenChange={setReportOpen}
//     wagerId={wager.id}
//   />

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Flag, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { useWalletAuth } from '@/hooks/useWalletAuth'
import { cn } from '@/lib/utils'

interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    wagerId: string
}

type Stage = 'form' | 'submitting' | 'done' | 'error'

const MIN_REASON_LENGTH = 10
const MAX_REASON_LENGTH = 500

export function ReportModeratorModal({ open, onOpenChange, wagerId }: Props) {
    const { getSessionToken } = useWalletAuth()
    const [reason, setReason] = useState('')
    const [stage, setStage] = useState<Stage>('form')
    const [errorMsg, setErrorMsg] = useState('')

    const charCount = reason.trim().length
    const isValid = charCount >= MIN_REASON_LENGTH

    function handleClose() {
        if (stage === 'submitting') return
        onOpenChange(false)
        // Reset after close animation
        setTimeout(() => {
            setReason('')
            setStage('form')
            setErrorMsg('')
        }, 200)
    }

    async function handleSubmit() {
        if (!isValid || stage === 'submitting') return

        setStage('submitting')
        setErrorMsg('')

        try {
            const token = await getSessionToken()
            if (!token) throw new Error('Session expired — please reconnect your wallet')

            const res = await fetch('/api/moderation/report', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-Token': token,
                },
                body: JSON.stringify({ wagerId, reason: reason.trim() }),
            })

            const data = await res.json()

            if (!res.ok) {
                if (res.status === 409) {
                    // Already reported — treat as success (idempotent from UX perspective)
                    setStage('done')
                    return
                }
                throw new Error(data?.error ?? 'Failed to submit report')
            }

            setStage('done')
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Something went wrong'
            setErrorMsg(msg)
            setStage('error')
            toast.error(msg)
        }
    }

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-md p-0 overflow-hidden border-border/50">
                {/* Top accent */}
                <div className="h-1 w-full bg-gradient-to-r from-amber-500 via-amber-500/70 to-amber-500/30" />

                <div className="px-6 pt-5 pb-6 space-y-5">
                    {/* Header */}
                    <DialogHeader>
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10 ring-1 ring-amber-500/30 flex-shrink-0">
                                <Flag className="h-5 w-5 text-amber-500" />
                            </div>
                            <div>
                                <DialogTitle className="text-base font-semibold leading-tight">
                                    Report Moderator Verdict
                                </DialogTitle>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Flag this verdict for admin review
                                </p>
                            </div>
                        </div>
                    </DialogHeader>

                    {/* Done state */}
                    {stage === 'done' && (
                        <div className="flex flex-col items-center gap-3 py-6 text-center">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10 ring-1 ring-green-500/30">
                                <CheckCircle2 className="h-6 w-6 text-green-400" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-foreground">Report submitted</p>
                                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                    An admin will review this verdict. If the moderator acted unfairly,
                                    it will be flagged on their record.
                                </p>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                className="mt-2"
                                onClick={handleClose}
                            >
                                Close
                            </Button>
                        </div>
                    )}

                    {/* Form state */}
                    {(stage === 'form' || stage === 'submitting' || stage === 'error') && (
                        <>
                            {/* Info note */}
                            <div className="rounded-lg border border-amber-500/20 bg-amber-500/6 px-3 py-2.5">
                                <div className="flex items-start gap-2">
                                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                                    <p className="text-xs text-amber-500/90 leading-relaxed">
                                        Reports are for genuinely unfair verdicts, not just losing a dispute.
                                        Frivolous reports are logged and may count against you.
                                    </p>
                                </div>
                            </div>

                            {/* Reason textarea */}
                            <div className="space-y-2">
                                <Label className="text-xs font-medium text-foreground/80">
                                    Describe why the verdict was unfair
                                </Label>
                                <Textarea
                                    placeholder="e.g. The moderator ruled against me despite clear evidence in my screenshot showing I won the match..."
                                    value={reason}
                                    onChange={(e) => {
                                        setReason(e.target.value.slice(0, MAX_REASON_LENGTH))
                                        if (stage === 'error') setStage('form')
                                    }}
                                    disabled={stage === 'submitting'}
                                    rows={4}
                                    className={cn(
                                        'resize-none text-sm leading-relaxed',
                                        'border-border/50 bg-muted/20 focus:border-primary/50 focus:ring-0',
                                        stage === 'error' && 'border-destructive/50',
                                    )}
                                />
                                <div className="flex items-center justify-between">
                                    <span className={cn(
                                        'text-xs',
                                        charCount < MIN_REASON_LENGTH
                                            ? 'text-muted-foreground'
                                            : 'text-green-400',
                                    )}>
                                        {charCount < MIN_REASON_LENGTH
                                            ? `${MIN_REASON_LENGTH - charCount} more character${MIN_REASON_LENGTH - charCount === 1 ? '' : 's'} required`
                                            : 'Looks good'}
                                    </span>
                                    <span className="text-xs text-muted-foreground/60">
                                        {charCount}/{MAX_REASON_LENGTH}
                                    </span>
                                </div>
                                {stage === 'error' && errorMsg && (
                                    <p className="text-xs text-destructive">{errorMsg}</p>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2.5 pt-1">
                                <Button
                                    variant="ghost"
                                    className="flex-1 border border-border/50 text-muted-foreground hover:bg-muted/50"
                                    onClick={handleClose}
                                    disabled={stage === 'submitting'}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    className={cn(
                                        'flex-1 gap-1.5',
                                        'bg-amber-500 hover:bg-amber-500/90 text-black font-medium',
                                    )}
                                    onClick={handleSubmit}
                                    disabled={!isValid || stage === 'submitting'}
                                >
                                    {stage === 'submitting' ? (
                                        <>
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            Submitting…
                                        </>
                                    ) : (
                                        <>
                                            <Flag className="h-3.5 w-3.5" />
                                            Submit report
                                        </>
                                    )}
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}