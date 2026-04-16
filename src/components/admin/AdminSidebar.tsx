'use client'

import dynamic from 'next/dynamic'
import { motion, AnimatePresence } from 'framer-motion'
import {
    LayoutDashboard, Users, Dices, Scale, AlertTriangle,
    Wallet, Link2, PenLine, Flag, Shield, LogOut,
    ChevronLeft, ChevronRight, Menu, X, Settings
} from 'lucide-react'
import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useAdminAuth, useAdminSession } from '@/hooks/admin'

const WalletMultiButton = dynamic(
    () => import('@solana/wallet-adapter-react-ui').then(m => ({ default: m.WalletMultiButton })),
    { ssr: false }
)

const navItems = [
    { label: 'Dashboard', href: '/itszaadminlogin/dashboard', icon: LayoutDashboard },
    { label: 'Users', href: '/itszaadminlogin/users', icon: Users },
    { label: 'Wagers', href: '/itszaadminlogin/wagers', icon: Dices },
    { label: 'Disputes', href: '/itszaadminlogin/disputes', icon: Scale },
    { label: 'Stuck Wagers', href: '/itszaadminlogin/stuck-wagers', icon: AlertTriangle },
    { label: 'Wallet', href: '/itszaadminlogin/wallet-bindings', icon: Wallet },
    { label: 'Appeals', href: '/itszaadminlogin/username-appeals', icon: Link2 },
    { label: 'Changes', href: '/itszaadminlogin/username-changes', icon: PenLine },
    { label: 'Behaviour', href: '/itszaadminlogin/behaviour-flags', icon: Flag },
    { label: 'Audit Logs', href: '/itszaadminlogin/audit-logs', icon: Shield },
    { label: 'Profile', href: '/itszaadminlogin/profile', icon: Settings },
]

const SIDEBAR_EXPANDED_KEY = 'admin_sidebar_expanded'

export function AdminSidebar() {
    const [expanded, setExpanded] = useState<boolean>(() => {
        if (typeof window === 'undefined') return true
        try { return localStorage.getItem(SIDEBAR_EXPANDED_KEY) !== 'false' } catch { return true }
    })
    const [mobileOpen, setMobileOpen] = useState(false)
    const pathname = usePathname()
    const { logout } = useAdminAuth()
    const { session } = useAdminSession()

    const toggleExpanded = () => {
        const next = !expanded
        setExpanded(next)
        try { localStorage.setItem(SIDEBAR_EXPANDED_KEY, String(next)) } catch { }
        window.dispatchEvent(new CustomEvent('admin-sidebar-change', { detail: { width: next ? 220 : 64 } }))
    }

    const handleLogout = async () => {
        await logout()
    }

    const SidebarContent = ({ mobile = false }: { mobile?: boolean }) => (
        <div className="flex flex-col h-full">
            {/* Logo */}
            <div className={cn(
                "flex items-center gap-3 px-4 py-5 border-b border-border/50",
                !expanded && !mobile && "justify-center px-2"
            )}>
                <motion.div whileHover={{ rotate: 5, scale: 1.05 }} transition={{ type: 'spring', stiffness: 400 }} className="relative flex-shrink-0">
                    <Image src="/logo.png" alt="Game Gambit" width={36} height={36} className="h-9 w-9" priority />
                    <div className="absolute inset-0 blur-xl bg-primary/30 -z-10 opacity-50" />
                </motion.div>
                <AnimatePresence initial={false}>
                    {(expanded || mobile) && (
                        <motion.div
                            initial={{ opacity: 0, width: 0 }}
                            animate={{ opacity: 1, width: 'auto' }}
                            exit={{ opacity: 0, width: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden whitespace-nowrap"
                        >
                            <div className="flex flex-col">
                                <span className="font-gaming font-bold text-base leading-tight">
                                    <span className="text-foreground">Game</span>
                                    <span className="text-primary text-glow">Gambit</span>
                                </span>
                                <span className="text-[10px] text-muted-foreground font-inter uppercase tracking-widest">Admin Portal</span>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Nav */}
            <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
                {navItems.map((item) => {
                    const isActive = pathname === item.href
                    const Icon = item.icon
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setMobileOpen(false)}
                            title={!expanded && !mobile ? item.label : undefined}
                            className={cn(
                                "group relative flex items-center gap-3 rounded-xl transition-all duration-200 font-medium text-sm",
                                expanded || mobile ? "px-3 py-2.5" : "px-2 py-2.5 justify-center",
                                isActive
                                    ? "bg-primary/15 text-primary border border-primary/25 shadow-sm shadow-primary/10"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                            )}
                        >
                            {isActive && (
                                <motion.div
                                    layoutId="activeNav"
                                    className="absolute inset-0 rounded-xl bg-primary/10"
                                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                                />
                            )}
                            <Icon className={cn("relative z-10 flex-shrink-0", expanded || mobile ? "h-4 w-4" : "h-5 w-5")} />
                            <AnimatePresence initial={false}>
                                {(expanded || mobile) && (
                                    <motion.span
                                        initial={{ opacity: 0, width: 0 }}
                                        animate={{ opacity: 1, width: 'auto' }}
                                        exit={{ opacity: 0, width: 0 }}
                                        transition={{ duration: 0.15 }}
                                        className="relative z-10 overflow-hidden whitespace-nowrap"
                                    >
                                        {item.label}
                                    </motion.span>
                                )}
                            </AnimatePresence>
                            {/* Tooltip for collapsed */}
                            {!expanded && !mobile && (
                                <div className="absolute left-full ml-2.5 px-2.5 py-1.5 bg-popover border border-border rounded-lg text-xs font-medium text-foreground whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-lg">
                                    {item.label}
                                </div>
                            )}
                        </Link>
                    )
                })}
            </nav>

            {/* Bottom: user info + wallet + logout */}
            <div className={cn("border-t border-border/50 p-3 space-y-2")}>
                {/* Wallet button */}
                <div className={cn(
                    "[&_.wallet-adapter-button]:!bg-primary/10 [&_.wallet-adapter-button]:!text-primary [&_.wallet-adapter-button]:!border [&_.wallet-adapter-button]:!border-primary/30 [&_.wallet-adapter-button]:!font-inter [&_.wallet-adapter-button]:!text-xs [&_.wallet-adapter-button]:!rounded-xl [&_.wallet-adapter-button]:!h-9 [&_.wallet-adapter-button]:!transition-all [&_.wallet-adapter-button]:hover:!bg-primary/20 [&_.wallet-adapter-button]:!w-full [&_.wallet-adapter-button]:!justify-center",
                    !expanded && !mobile && "[&_.wallet-adapter-button]:!px-0 [&_.wallet-adapter-button]:!w-10 [&_.wallet-adapter-button]:!min-w-0"
                )}>
                    <WalletMultiButton />
                </div>

                {/* User row */}
                <AnimatePresence initial={false}>
                    {(expanded || mobile) && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="flex items-center gap-2 px-2 py-1.5 rounded-xl bg-muted/30">
                                <div className="h-7 w-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center flex-shrink-0">
                                    <span className="text-xs font-bold text-primary">
                                        {session?.user.email?.charAt(0).toUpperCase() || 'A'}
                                    </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold text-foreground truncate capitalize">{session?.user.role || 'Admin'}</p>
                                    <p className="text-[10px] text-muted-foreground truncate">{session?.user.email}</p>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Logout */}
                <button
                    onClick={handleLogout}
                    title={!expanded && !mobile ? 'Logout' : undefined}
                    className={cn(
                        "w-full flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors",
                        !expanded && !mobile && "justify-center px-2"
                    )}
                >
                    <LogOut className="h-4 w-4 flex-shrink-0" />
                    <AnimatePresence initial={false}>
                        {(expanded || mobile) && (
                            <motion.span
                                initial={{ opacity: 0, width: 0 }}
                                animate={{ opacity: 1, width: 'auto' }}
                                exit={{ opacity: 0, width: 0 }}
                                transition={{ duration: 0.15 }}
                                className="overflow-hidden whitespace-nowrap"
                            >
                                Logout
                            </motion.span>
                        )}
                    </AnimatePresence>
                </button>

                {/* Collapse toggle — desktop only */}
                {!mobile && (
                    <button
                        onClick={toggleExpanded}
                        className={cn(
                            "w-full flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors",
                            !expanded && "justify-center px-2"
                        )}
                    >
                        {expanded ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        <AnimatePresence initial={false}>
                            {expanded && (
                                <motion.span
                                    initial={{ opacity: 0, width: 0 }}
                                    animate={{ opacity: 1, width: 'auto' }}
                                    exit={{ opacity: 0, width: 0 }}
                                    transition={{ duration: 0.15 }}
                                    className="overflow-hidden whitespace-nowrap"
                                >
                                    Collapse
                                </motion.span>
                            )}
                        </AnimatePresence>
                    </button>
                )}
            </div>
        </div>
    )

    return (
        <>
            {/* Desktop sidebar */}
            <motion.aside
                animate={{ width: expanded ? 220 : 64 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="hidden md:flex flex-col fixed left-0 top-0 h-full z-40 bg-card/90 backdrop-blur-xl border-r border-border/50 overflow-hidden"
            >
                <SidebarContent />
            </motion.aside>

            {/* Mobile toggle button */}
            <button
                onClick={() => setMobileOpen(true)}
                className="md:hidden fixed top-4 left-4 z-50 p-2.5 rounded-xl bg-card border border-border/50 shadow-lg"
            >
                <Menu className="h-5 w-5" />
            </button>

            {/* Mobile drawer */}
            <AnimatePresence>
                {mobileOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
                            onClick={() => setMobileOpen(false)}
                        />
                        <motion.aside
                            initial={{ x: '-100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '-100%' }}
                            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                            className="md:hidden fixed left-0 top-0 h-full w-64 z-50 bg-card border-r border-border/50 flex flex-col shadow-2xl"
                        >
                            <button
                                onClick={() => setMobileOpen(false)}
                                className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </button>
                            <SidebarContent mobile />
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>
        </>
    )
}