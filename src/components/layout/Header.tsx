'use client'

import { useWallet } from '@solana/wallet-adapter-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, User, Copy, Check, Smartphone, Swords, LayoutDashboard, Dice5, Trophy, BarChart2, Settings, Rss, MessageCircle, Gift } from 'lucide-react'
import { useState, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { truncateAddress } from '@/lib/constants'
import dynamic from 'next/dynamic'
import { ThemeToggle } from '@/components/ThemeToggle'
import { WalletButton } from '@/components/WalletButton'
import { useUnreadDmCount } from '@/hooks/useFriends'

const NotificationsDropdown = dynamic(
  () => import('@/components/NotificationsDropdown').then(m => ({ default: m.NotificationsDropdown })),
  { ssr: false, loading: () => null }
)

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: '📊', LucideIcon: BarChart2 },
  { label: 'Feed', href: '/feed', icon: '📡', LucideIcon: Rss },
  { label: 'Arena', href: '/arena', icon: '⚔️', LucideIcon: Swords },
  { label: 'My Wagers', href: '/my-wagers', icon: '🎲', LucideIcon: Dice5 },
  { label: 'Leaderboard', href: '/leaderboard', icon: '🏆', LucideIcon: Trophy },
  { label: 'Events', href: '/events', icon: '🎁', LucideIcon: Gift },
]

export function Header() {
  const { connected, publicKey } = useWallet()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [hoveredIcon, setHoveredIcon] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const unreadDms = useUnreadDmCount()

  const handleCopyAddress = useCallback(() => {
    if (!publicKey) return
    navigator.clipboard.writeText(publicKey.toBase58())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [publicKey])

  const pathname = usePathname()

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-3 sm:px-4">
          <div className="flex h-14 sm:h-16 items-center justify-between gap-2">

            {/* ── Logo ─────────────────────────────────────────────────────── */}
            <Link href="/" className="flex items-center gap-1 group flex-shrink-0 min-w-0">
              <motion.div
                whileHover={{ rotate: 5, scale: 1.05 }}
                transition={{ type: 'spring', stiffness: 400 }}
                className="relative flex-shrink-0"
              >
                <Image
                  src="/logo.png"
                  alt="Game Gambit Logo"
                  width={40}
                  height={60}
                  className="h-10 w-auto sm:h-12 md:h-14"
                  priority
                />
                <div className="absolute inset-0 blur-xl bg-primary/30 -z-10 opacity-50" />
              </motion.div>
              <span className="font-gaming font-bold hidden sm:inline text-sm sm:text-base md:text-lg lg:text-xl whitespace-nowrap">
                <span className="text-foreground">Game</span>
                <span className="text-primary text-glow">Gambit</span>
              </span>
            </Link>

            {/* ── Desktop Nav ───────────────────────────────────────────────── */}
            <nav className="hidden md:flex items-center gap-1 flex-shrink-0">
              {navItems.map((item) => {
                const isActive = pathname === item.href
                return (
                  <div
                    key={item.href}
                    className="relative group"
                    onMouseEnter={() => setHoveredIcon(item.href)}
                    onMouseLeave={() => setHoveredIcon(null)}
                  >
                    <Link
                      href={item.href}
                      className={cn(
                        "px-2 py-2 rounded-lg text-sm font-medium transition-all duration-300 flex items-center gap-2",
                        "lg:px-4",
                        isActive
                          ? "bg-primary/10 text-primary border-glow-subtle"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      )}
                    >
                      <span className="text-base">{item.icon}</span>
                      <span className="hidden lg:inline">{item.label}</span>
                    </Link>
                    {hoveredIcon === item.href && (
                      <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 px-2 py-1 bg-card border border-border rounded text-xs whitespace-nowrap text-foreground pointer-events-none z-50 lg:hidden">
                        {item.label}
                      </div>
                    )}
                  </div>
                )
              })}
            </nav>

            {/* ── Right Side ────────────────────────────────────────────────── */}
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0 overflow-visible">
              <ThemeToggle />

              {connected && (
                <>
                  <NotificationsDropdown />

                  {/* Messages icon — desktop only (mobile handled in drawer) */}
                  <div
                    className="relative hidden sm:block"
                    onMouseEnter={() => setHoveredIcon('/messages')}
                    onMouseLeave={() => setHoveredIcon(null)}
                  >
                    <Link href="/messages">
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          'h-8 w-8 sm:h-9 sm:w-9 relative',
                          pathname === '/messages'
                            ? 'bg-primary/10 text-primary'
                            : 'text-muted-foreground hover:text-foreground'
                        )}
                        aria-label="Messages"
                      >
                        <MessageCircle className="h-4 w-4" />
                        {unreadDms > 0 && (
                          <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
                            {unreadDms > 9 ? '9+' : unreadDms}
                          </span>
                        )}
                      </Button>
                    </Link>
                    {hoveredIcon === '/messages' && (
                      <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 px-2 py-1 bg-card border border-border rounded text-xs whitespace-nowrap text-foreground pointer-events-none z-50">
                        Messages
                      </div>
                    )}
                  </div>

                  {/* Settings icon — desktop only */}
                  <div
                    className="relative hidden sm:block"
                    onMouseEnter={() => setHoveredIcon('/settings')}
                    onMouseLeave={() => setHoveredIcon(null)}
                  >
                    <Link href="/settings">
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "h-8 w-8 sm:h-9 sm:w-9",
                          pathname === '/settings'
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                        aria-label="Settings"
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                    </Link>
                    {hoveredIcon === '/settings' && (
                      <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 px-2 py-1 bg-card border border-border rounded text-xs whitespace-nowrap text-foreground pointer-events-none z-50">
                        Settings
                      </div>
                    )}
                  </div>

                  <Link href="/profile" className="hidden sm:block flex-shrink-0">
                    <Button variant="glass" size="sm" className="text-xs sm:text-sm whitespace-nowrap">
                      <User className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 flex-shrink-0" />
                      <span className="hidden md:inline">
                        {publicKey && truncateAddress(publicKey.toBase58())}
                      </span>
                      <span className="md:hidden">
                        {publicKey && truncateAddress(publicKey.toBase58(), 4)}
                      </span>
                    </Button>
                  </Link>
                </>
              )}

              {/* Wallet button — constrained so it never overflows on mobile */}
              <div className="flex-shrink-0 max-w-[120px] sm:max-w-none overflow-hidden">
                <WalletButton />
              </div>

              {/* Hamburger — always visible on mobile, never pushed off-screen */}
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden flex-shrink-0 h-8 w-8 sm:h-9 sm:w-9"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Toggle menu"
              >
                <AnimatePresence mode="wait" initial={false}>
                  {mobileMenuOpen ? (
                    <motion.div
                      key="close"
                      initial={{ rotate: -90, opacity: 0 }}
                      animate={{ rotate: 0, opacity: 1 }}
                      exit={{ rotate: 90, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      <X className="h-4 w-4 sm:h-5 sm:w-5" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="open"
                      initial={{ rotate: 90, opacity: 0 }}
                      animate={{ rotate: 0, opacity: 1 }}
                      exit={{ rotate: -90, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      <Menu className="h-4 w-4 sm:h-5 sm:w-5" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </Button>
            </div>
          </div>
        </div>

        {/* Bottom glow line */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
      </header>

      {/* ── Mobile Menu ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />

            {/* Panel */}
            <motion.div
              key="panel"
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className="fixed top-0 right-0 bottom-0 z-50 w-72 md:hidden flex flex-col
                         bg-background border-l border-border/60 shadow-2xl overflow-y-auto"
            >
              {/* Panel header */}
              <div className="flex items-center justify-between px-5 h-14 border-b border-border/40 flex-shrink-0">
                <span className="font-gaming text-sm text-primary text-glow tracking-widest uppercase">
                  Navigation
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Decorative scanline strip */}
              <div className="h-px w-full bg-gradient-to-r from-transparent via-primary/60 to-transparent" />

              {/* Nav links */}
              <nav className="flex flex-col gap-1 p-3 flex-1">
                {navItems.map((item, i) => {
                  const isActive = pathname === item.href
                  const { LucideIcon } = item
                  return (
                    <motion.div
                      key={item.href}
                      initial={{ opacity: 0, x: 40 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.04 * i, type: 'spring', stiffness: 300, damping: 28 }}
                    >
                      <Link
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={cn(
                          "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium",
                          "transition-all duration-200 group relative overflow-hidden",
                          isActive
                            ? "bg-primary/15 text-primary border border-primary/30 shadow-[0_0_12px_rgba(var(--primary)/0.15)]"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/70 border border-transparent"
                        )}
                      >
                        {isActive && (
                          <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-primary" />
                        )}
                        <span className="text-lg flex-shrink-0">{item.icon}</span>
                        <span className="font-gaming tracking-wide">{item.label}</span>
                        {isActive && (
                          <motion.span
                            layoutId="mobile-active-dot"
                            className="ml-auto h-1.5 w-1.5 rounded-full bg-primary"
                          />
                        )}
                      </Link>
                    </motion.div>
                  )
                })}

                {/* Divider */}
                <div className="my-2 h-px bg-border/50" />

                {/* Wallet section */}
                {connected && publicKey ? (
                  <motion.div
                    initial={{ opacity: 0, x: 40 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.04 * navItems.length, type: 'spring', stiffness: 300, damping: 28 }}
                    className="flex flex-col gap-1"
                  >
                    {/* Address chip */}
                    <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-muted/40 border border-border/40">
                      <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
                      <span className="text-xs text-muted-foreground font-mono truncate">
                        {truncateAddress(publicKey.toBase58(), 6)}
                      </span>
                    </div>

                    {/* FIXED: Messages link added to mobile menu */}
                    <Link
                      href="/messages"
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium",
                        "transition-all duration-200 border border-transparent",
                        pathname === '/messages'
                          ? "bg-primary/15 text-primary border-primary/30"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
                      )}
                    >
                      <MessageCircle className="h-4 w-4 flex-shrink-0" />
                      <span className="font-gaming tracking-wide">Messages</span>
                      {unreadDms > 0 && (
                        <span className="ml-auto min-w-[20px] h-5 px-1 rounded-full bg-destructive text-white text-[10px] font-bold flex items-center justify-center">
                          {unreadDms > 9 ? '9+' : unreadDms}
                        </span>
                      )}
                    </Link>

                    <Link
                      href="/profile"
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium",
                        "transition-all duration-200 border border-transparent",
                        pathname === '/profile'
                          ? "bg-primary/15 text-primary border-primary/30"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
                      )}
                    >
                      <User className="h-4 w-4 flex-shrink-0" />
                      <span className="font-gaming tracking-wide">Profile</span>
                    </Link>

                    {/* Settings — mobile menu */}
                    <Link
                      href="/settings"
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium",
                        "transition-all duration-200 border border-transparent",
                        pathname === '/settings'
                          ? "bg-primary/15 text-primary border-primary/30"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
                      )}
                    >
                      <Settings className="h-4 w-4 flex-shrink-0" />
                      <span className="font-gaming tracking-wide">Settings</span>
                    </Link>

                    <button
                      onClick={handleCopyAddress}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium w-full
                                 text-muted-foreground hover:text-foreground hover:bg-muted/70
                                 transition-all duration-200 border border-transparent"
                    >
                      {copied
                        ? <Check className="h-4 w-4 text-green-400 flex-shrink-0" />
                        : <Copy className="h-4 w-4 flex-shrink-0" />}
                      <span className="font-gaming tracking-wide">
                        {copied ? 'Copied!' : 'Copy Address'}
                      </span>
                    </button>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, x: 40 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.04 * navItems.length, type: 'spring', stiffness: 300, damping: 28 }}
                    className="mx-1 p-4 rounded-xl bg-amber-500/8 border border-amber-500/20"
                  >
                    <div className="flex items-start gap-3">
                      <Smartphone className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        <span className="text-amber-400 font-medium block mb-1">On mobile?</span>
                        Open in <span className="text-amber-400">Phantom's browser</span>,{' '}
                        <span className="text-amber-400">Mises</span>, or{' '}
                        <span className="text-amber-400">Kiwi Browser</span> for wallet support.
                      </p>
                    </div>
                  </motion.div>
                )}
              </nav>

              {/* Panel footer glow */}
              <div className="h-px w-full bg-gradient-to-r from-transparent via-primary/40 to-transparent flex-shrink-0" />
              <div className="px-5 py-4 flex-shrink-0">
                <p className="text-[10px] text-muted-foreground/40 font-gaming tracking-widest text-center uppercase">
                  GameGambit · Solana
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}