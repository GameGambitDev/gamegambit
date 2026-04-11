'use client'

import { useEffect, useRef, useState } from 'react'
import { getSupabaseClient } from '@/integrations/supabase/client'
import { formatSol } from '@/lib/constants'
import { LAMPORTS_PER_SOL } from '@/lib/constants'
import { useScrollAnimation } from '@/hooks/useScrollAnimation'
import { Users, Swords, Trophy, Activity, Wifi } from 'lucide-react'

interface PlatformStats {
    totalWagers: number
    totalSolWagered: number   // in SOL (already converted)
    totalPlayers: number
    activeWagers: number
}

function useAnimatedCounter(target: number, duration = 1200, started = false) {
    const [value, setValue] = useState(0)
    const raf = useRef<number | null>(null)

    useEffect(() => {
        if (!started || target === 0) return
        const start = performance.now()
        const from = 0

        const step = (now: number) => {
            const elapsed = now - start
            const progress = Math.min(elapsed / duration, 1)
            // ease out cubic
            const ease = 1 - Math.pow(1 - progress, 3)
            setValue(Math.round(from + (target - from) * ease))
            if (progress < 1) {
                raf.current = requestAnimationFrame(step)
            }
        }

        raf.current = requestAnimationFrame(step)
        return () => { if (raf.current) cancelAnimationFrame(raf.current) }
    }, [target, duration, started])

    return value
}

function StatItem({
    icon: Icon,
    label,
    value,
    suffix = '',
    prefix = '',
    delay = 0,
    isVisible = false,
}: {
    icon: React.ElementType
    label: string
    value: number
    suffix?: string
    prefix?: string
    delay?: number
    isVisible?: boolean
}) {
    const [animStarted, setAnimStarted] = useState(false)

    useEffect(() => {
        if (!isVisible) return
        const t = setTimeout(() => setAnimStarted(true), delay)
        return () => clearTimeout(t)
    }, [isVisible, delay])

    const animated = useAnimatedCounter(value, 1200, animStarted)

    const display = value >= 1000
        ? animated >= 1000
            ? `${(animated / 1000).toFixed(animated >= 10000 ? 0 : 1)}k`
            : `${animated}`
        : `${animated}`

    return (
        <div className="flex flex-col items-center gap-1 px-4 py-3 sm:py-0 relative group">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-0.5">
                <Icon className="h-3.5 w-3.5 text-primary/70" />
                <span className="text-xs uppercase tracking-widest font-medium">{label}</span>
            </div>
            <div className="font-gaming text-xl sm:text-2xl font-bold text-foreground tabular-nums">
                {prefix}{display}{suffix}
            </div>
        </div>
    )
}

function Divider() {
    return (
        <div className="hidden sm:block w-px h-8 bg-border/40 self-center" />
    )
}

export function StatsBar() {
    const [stats, setStats] = useState<PlatformStats | null>(null)
    const [loading, setLoading] = useState(true)
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

    const { ref, isVisible } = useScrollAnimation<HTMLDivElement>({ threshold: 0.2 })

    const fetchStats = async () => {
        try {
            const supabase = getSupabaseClient()

            const [wagersRes, resolvedRes, playersRes, activeRes] = await Promise.all([
                // Total wagers ever created
                supabase
                    .from('wagers')
                    .select('id', { count: 'exact', head: true }),

                // Total SOL wagered across all resolved wagers
                supabase
                    .from('wagers')
                    .select('stake_lamports')
                    .eq('status', 'resolved'),

                // Total registered players
                supabase
                    .from('players')
                    .select('wallet_address', { count: 'exact', head: true }),

                // Active wagers right now
                supabase
                    .from('wagers')
                    .select('id', { count: 'exact', head: true })
                    .in('status', ['created', 'joined', 'voting']),
            ])

            const totalWagers = wagersRes.count ?? 0
            const totalPlayers = playersRes.count ?? 0
            const activeWagers = activeRes.count ?? 0

            // Sum up lamports from resolved wagers, multiply by 2 for full pot
            const resolvedWagers = resolvedRes.data ?? []
            const totalLamports = resolvedWagers.reduce(
                (acc, w) => acc + (w.stake_lamports ?? 0) * 2,
                0
            )
            const totalSolWagered = totalLamports / LAMPORTS_PER_SOL

            setStats({ totalWagers, totalSolWagered, totalPlayers, activeWagers })
        } catch (err) {
            // Silently fail — stats bar is non-critical
            console.error('StatsBar fetch error:', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchStats()
        intervalRef.current = setInterval(fetchStats, 30_000)
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current)
        }
    }, [])

    // Skeleton while loading
    if (loading) {
        return (
            <div className="relative z-10 py-4">
                <div className="container px-4">
                    <div className="flex justify-center">
                        <div className="flex items-center gap-6 sm:gap-10 px-6 py-4 rounded-2xl bg-card/40 border border-border/40 backdrop-blur-md animate-pulse">
                            {[...Array(4)].map((_, i) => (
                                <div key={i} className="flex flex-col items-center gap-1.5 px-4">
                                    <div className="h-3 w-16 rounded bg-muted/50" />
                                    <div className="h-6 w-10 rounded bg-muted/50" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    if (!stats) return null

    return (
        <div ref={ref} className="relative z-10 py-4"
            style={{
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? 'none' : 'translateY(20px)',
                transition: 'opacity 0.6s cubic-bezier(.22,1,.36,1), transform 0.6s cubic-bezier(.22,1,.36,1)',
            }}
        >
            <div className="container px-4">
                <div className="flex justify-center">
                    <div className="inline-flex flex-wrap justify-center items-center gap-0 sm:gap-0 px-4 sm:px-8 py-3 sm:py-4 rounded-2xl bg-card/40 border border-border/40 backdrop-blur-md shadow-lg">

                        <StatItem
                            icon={Swords}
                            label="Wagers"
                            value={stats.totalWagers}
                            isVisible={isVisible}
                            delay={0}
                        />
                        <Divider />
                        <StatItem
                            icon={Trophy}
                            label="SOL Wagered"
                            value={parseFloat(stats.totalSolWagered.toFixed(2))}
                            suffix=" SOL"
                            isVisible={isVisible}
                            delay={150}
                        />
                        <Divider />
                        <StatItem
                            icon={Users}
                            label="Players"
                            value={stats.totalPlayers}
                            isVisible={isVisible}
                            delay={300}
                        />
                        <Divider />
                        <StatItem
                            icon={Activity}
                            label="Active Now"
                            value={stats.activeWagers}
                            isVisible={isVisible}
                            delay={450}
                        />

                    </div>
                </div>
            </div>

            {/* Subtle refresh indicator — only visible if we have data */}
            <div className="flex justify-center mt-2">
                <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground/50">
                    <Wifi className="h-2.5 w-2.5" />
                    <span>Updates every 30s</span>
                </div>
            </div>
        </div>
    )
}