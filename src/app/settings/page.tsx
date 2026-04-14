'use client'

import { motion } from 'framer-motion'
import { useWallet } from '@solana/wallet-adapter-react'
import { useWalletReady } from '@/app/providers'
import dynamic from 'next/dynamic'
import {
    Bell, BellOff, Shield, ShieldOff, ChevronRight,
    Settings, FileText, Clock, Coins,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { usePlayerSettings } from '@/hooks/usePlayerSettings'
import { SettingsPageSkeleton } from '@/components/skeletons/GamingSkeletonLoader'
import Link from 'next/link'
import { cn } from '@/lib/utils'

const WalletMultiButton = dynamic(
    () => import('@solana/wallet-adapter-react-ui').then(m => ({ default: m.WalletMultiButton })),
    { ssr: false },
)

// ── Notification sub-types — shown when push is ON ───────────────────────────

const NOTIFICATION_TYPES = [
    { label: 'Wager joined / opponent found', icon: '⚔️' },
    { label: 'Game complete confirmations', icon: '✅' },
    { label: 'Voting reminders', icon: '🗳️' },
    { label: 'Dispute updates', icon: '⚖️' },
    { label: 'Funds received', icon: '💰' },
] as const

// ── Account quick-links ───────────────────────────────────────────────────────

const ACCOUNT_LINKS = [
    { label: 'Linked Games', href: '/profile', icon: ChevronRight },
    { label: 'Transaction History', href: '/my-wagers', icon: Coins },
    { label: 'Terms & Privacy', href: '/terms', icon: FileText },
] as const

// ── Component ─────────────────────────────────────────────────────────────────

export default function SettingsPage() {
    const { connected } = useWallet()
    const walletReady = useWalletReady()
    const { settings, isLoading, updateSettings, isUpdating } = usePlayerSettings()

    // ── Not ready yet — show skeleton instead of flashing connect screen ────
    if (!walletReady) {
        return <SettingsPageSkeleton />
    }

    // ── Not connected ─────────────────────────────────────────────────────────
    if (!connected) {
        return (
            <div className="py-8 pb-16">
                <div className="container px-4 max-w-2xl mx-auto">
                    <div className="flex flex-col items-center justify-center py-20 gap-6">
                        <div className="text-4xl">⚙️</div>
                        <div className="text-center">
                            <h2 className="text-xl font-gaming font-bold mb-2">Sign In to Manage Settings</h2>
                            <p className="text-muted-foreground text-sm">Your preferences, notifications, and account links live here.</p>
                        </div>
                        <WalletMultiButton />
                    </div>
                </div>
            </div>
        )
    }

    // ── Data loading ──────────────────────────────────────────────────────────
    if (isLoading) {
        return <SettingsPageSkeleton />
    }

    // ── Toggle handlers ───────────────────────────────────────────────────────

    const handlePushToggle = async (enabled: boolean) => {
        try {
            await updateSettings({ pushNotificationsEnabled: enabled })
            toast.success(
                enabled ? 'Push notifications turned on' : 'Push notifications turned off',
                { description: enabled ? 'You\'ll receive device alerts for match activity.' : 'In-app notifications still work.' },
            )
        } catch {
            toast.error('Failed to update notification settings')
        }
    }

    const handleModerationToggle = async (enabled: boolean) => {
        try {
            await updateSettings({ moderationRequestsEnabled: enabled })
            toast.success(
                enabled ? 'Moderation requests turned on' : 'Moderation requests turned off',
                {
                    description: enabled
                        ? 'You may be selected to moderate disputes and earn fees.'
                        : 'You won\'t receive moderation requests.',
                },
            )
        } catch {
            toast.error('Failed to update moderation setting')
        }
    }

    return (
        <div className="py-8 pb-16">
            <div className="container px-4 max-w-2xl mx-auto space-y-6">

                {/* ── Page header ──────────────────────────────────────────────────── */}
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3"
                >
                    <Settings className="h-6 w-6 text-primary" />
                    <h1 className="text-2xl font-gaming font-bold">Settings</h1>
                </motion.div>

                {/* ── Notifications ────────────────────────────────────────────────── */}
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 }}
                >
                    <Card variant="gaming">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Bell className="h-4 w-4 text-primary" />
                                Notifications
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-5">

                            {/* Push toggle */}
                            <div className="flex items-start justify-between gap-4">
                                <div className="space-y-1 min-w-0">
                                    <Label
                                        htmlFor="push-toggle"
                                        className="text-sm font-medium flex items-center gap-2 cursor-pointer"
                                    >
                                        {settings.pushNotificationsEnabled
                                            ? <Bell className="h-4 w-4 text-primary flex-shrink-0" />
                                            : <BellOff className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                        }
                                        Push Notifications
                                        {settings.pushNotificationsEnabled && (
                                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-primary border-primary/30">
                                                ON
                                            </Badge>
                                        )}
                                    </Label>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        Get notified on your device about wager activity, results, and platform updates.
                                    </p>
                                </div>
                                <Switch
                                    id="push-toggle"
                                    checked={settings.pushNotificationsEnabled}
                                    onCheckedChange={handlePushToggle}
                                    disabled={isLoading || isUpdating}
                                    className="flex-shrink-0 mt-0.5"
                                />
                            </div>

                            {/* Sub-types (only when push is ON) */}
                            {settings.pushNotificationsEnabled && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="ml-6 space-y-1 border-l border-border/50 pl-4"
                                >
                                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-2">
                                        Notification types
                                    </p>
                                    {NOTIFICATION_TYPES.map((n) => (
                                        <div key={n.label} className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <span className="text-sm">{n.icon}</span>
                                            <span>{n.label}</span>
                                        </div>
                                    ))}
                                    <p className="text-[11px] text-muted-foreground/60 mt-2 leading-relaxed">
                                        In-app notifications always work regardless of this toggle.
                                    </p>
                                </motion.div>
                            )}

                        </CardContent>
                    </Card>
                </motion.div>

                {/* ── Moderation ───────────────────────────────────────────────────── */}
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                >
                    <Card variant="gaming">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Shield className="h-4 w-4 text-accent" />
                                Moderation
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">

                            <div className="flex items-start justify-between gap-4">
                                <div className="space-y-1 min-w-0">
                                    <Label
                                        htmlFor="mod-toggle"
                                        className="text-sm font-medium flex items-center gap-2 cursor-pointer"
                                    >
                                        {settings.moderationRequestsEnabled
                                            ? <Shield className="h-4 w-4 text-accent flex-shrink-0" />
                                            : <ShieldOff className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                        }
                                        Become a Match Moderator
                                        {settings.moderationRequestsEnabled && (
                                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-accent border-accent/30">
                                                ON
                                            </Badge>
                                        )}
                                    </Label>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        Allow the platform to select you as a neutral moderator for disputed matches.
                                        You earn a fee paid in SOL, arriving in seconds, for each case you moderate.
                                    </p>
                                </div>
                                <Switch
                                    id="mod-toggle"
                                    checked={settings.moderationRequestsEnabled}
                                    onCheckedChange={handleModerationToggle}
                                    disabled={isLoading || isUpdating}
                                    className="flex-shrink-0 mt-0.5"
                                />
                            </div>

                            {/* Opt-out note */}
                            {!settings.moderationRequestsEnabled && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="p-3 rounded-lg bg-muted/40 border border-border/50"
                                >
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        <span className="text-foreground font-medium">Moderation is off.</span>{' '}
                                        You won't be called to review disputes or earn moderator fees.
                                        You can turn this back on anytime.
                                    </p>
                                </motion.div>
                            )}

                            {/* Opt-in note */}
                            {settings.moderationRequestsEnabled && (
                                <div className="p-3 rounded-lg bg-accent/5 border border-accent/20">
                                    <div className="flex items-start gap-2">
                                        <Clock className="h-3.5 w-3.5 text-accent flex-shrink-0 mt-0.5" />
                                        <p className="text-xs text-muted-foreground leading-relaxed">
                                            When selected, you'll get a 20-second popup to accept or decline.
                                            Declining is fine. It passes to someone else with no penalty.
                                            If you accept, you have 10 minutes to review the match and submit a verdict.
                                        </p>
                                    </div>
                                </div>
                            )}

                        </CardContent>
                    </Card>
                </motion.div>

                {/* ── Account links ────────────────────────────────────────────────── */}
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                >
                    <Card variant="gaming">
                        <CardHeader>
                            <CardTitle className="text-base">Account</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-1 p-2">
                            {ACCOUNT_LINKS.map(({ label, href, icon: Icon }) => (
                                <Button
                                    key={href}
                                    variant="ghost"
                                    className={cn(
                                        'w-full justify-between text-sm font-normal h-11 px-4',
                                        'text-muted-foreground hover:text-foreground',
                                    )}
                                    asChild
                                >
                                    <Link href={href}>
                                        <span>{label}</span>
                                        <Icon className="h-4 w-4 text-muted-foreground/60" />
                                    </Link>
                                </Button>
                            ))}
                        </CardContent>
                    </Card>
                </motion.div>

            </div>
        </div>
    )
}