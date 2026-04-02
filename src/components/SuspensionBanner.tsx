'use client'

// src/components/SuspensionBanner.tsx — Step 6
//
// Shown at the top of dashboard, arena, and profile when the connected
// player's account is suspended (player.is_suspended === true).
//
// Displays:
//  - Suspension message with time remaining (or "indefinite")
//  - Link to profile page to view punishment history
//  - Dismissible for the session (doesn't clear the actual suspension)
//
// Usage:
//   import { SuspensionBanner } from '@/components/SuspensionBanner'
//   <SuspensionBanner player={player} />

import { useState } from 'react'
import { AlertOctagon, X, Clock, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import type { Player } from '@/hooks/usePlayer'

interface Props {
    player: Player | null | undefined
}

function formatTimeRemaining(endsAt: string | null): string {
    if (!endsAt) return 'indefinitely'
    const diff = new Date(endsAt).getTime() - Date.now()
    if (diff <= 0) return 'suspension period ending soon'

    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(hours / 24)
    const remainingHours = hours % 24

    if (days > 0 && remainingHours > 0) return `for ${days}d ${remainingHours}h`
    if (days > 0) return `for ${days} day${days === 1 ? '' : 's'}`
    if (hours > 0) return `for ${hours} hour${hours === 1 ? '' : 's'}`

    const mins = Math.floor(diff / (1000 * 60))
    return `for ${mins} minute${mins === 1 ? '' : 's'}`
}

export function SuspensionBanner({ player }: Props) {
    const [dismissed, setDismissed] = useState(false)

    // Not suspended or already dismissed this session
    if (!player?.is_suspended || dismissed) return null

    const timeLabel = formatTimeRemaining(player.suspension_ends_at ?? null)

    return (
        <div
            role="alert"
            className="w-full bg-destructive/10 border-b border-destructive/30"
        >
            <div className="container px-4 py-3 flex items-center gap-3">
                {/* Icon */}
                <div className="flex-shrink-0">
                    <AlertOctagon className="h-4 w-4 text-destructive" />
                </div>

                {/* Message */}
                <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2">
                    <span className="text-sm font-semibold text-destructive leading-snug">
                        Your account is suspended {timeLabel}.
                    </span>
                    <span className="text-xs text-destructive/80 leading-snug">
                        You cannot create or join wagers until the suspension expires.
                    </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 hidden sm:flex items-center gap-1"
                        asChild
                    >
                        <Link href="/profile">
                            <Clock className="h-3 w-3" />
                            View history
                            <ChevronRight className="h-3 w-3" />
                        </Link>
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setDismissed(true)}
                        aria-label="Dismiss suspension notice"
                    >
                        <X className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>
        </div>
    )
}