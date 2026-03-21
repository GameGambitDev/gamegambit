'use client'

import { useWallet } from '@solana/wallet-adapter-react'
import { motion } from 'framer-motion'
import { Menu, X, User, Copy, Check, LogOut, Smartphone } from 'lucide-react'
import { useState, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { truncateAddress } from '@/lib/constants'
import { NotificationsDropdown } from '@/components/NotificationsDropdown'
import { ThemeToggle } from '@/components/ThemeToggle'
import { WalletButton } from '@/components/WalletButton'

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: '📊' },
  { label: 'Arena', href: '/arena', icon: '⚔️' },
  { label: 'My Wagers', href: '/my-wagers', icon: '🎲' },
  { label: 'Leaderboard', href: '/leaderboard', icon: '🏆' },
]

export function Header() {
  const { connected, publicKey } = useWallet()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [hoveredIcon, setHoveredIcon] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleCopyAddress = useCallback(() => {
    if (!publicKey) return
    navigator.clipboard.writeText(publicKey.toBase58())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [publicKey])
  const pathname = usePathname()

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-0 group flex-shrink-0">
            <motion.div
              whileHover={{ rotate: 5, scale: 1.05 }}
              transition={{ type: 'spring', stiffness: 400 }}
              className="relative"
            >
              <Image
                src="/logo.png"
                alt="Game Gambit Logo"
                width={40}
                height={60}
                className="h-14 w-auto sm:h-16 sm:w-auto md:h-20 md:w-auto flex-shrink-0"
                priority
              />
              <div className="absolute inset-0 blur-xl bg-primary/30 -z-10 opacity-50" />
            </motion.div>
            <span className="font-gaming font-bold hidden sm:inline text-sm sm:text-base md:text-lg lg:text-xl whitespace-nowrap">
              <span className="text-foreground">Game</span>
              <span className="text-primary text-glow">Gambit</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
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

          {/* Right Side */}
          <div className="flex items-center gap-1 sm:gap-2 md:gap-3 flex-shrink-0">
            <ThemeToggle />
            {connected && (
              <>
                <NotificationsDropdown />
                <Link href="/profile" className="hidden sm:block">
                  <Button variant="glass" size="sm" className="text-xs sm:text-sm">
                    <User className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
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

            {/* Custom wallet button — handles mobile/desktop differently */}
            <WalletButton />

            {/* Mobile Menu Toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden h-8 w-8 sm:h-9 sm:w-9"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-4 w-4 sm:h-5 sm:w-5" /> : <Menu className="h-4 w-4 sm:h-5 sm:w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-border py-3"
          >
            <nav className="flex flex-col gap-1">
              {/* Nav Links */}
              {navItems.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "px-4 py-3 rounded-lg text-sm font-medium transition-all flex items-center gap-3",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    <span className="text-base">{item.icon}</span>
                    {item.label}
                  </Link>
                )
              })}

              {/* Wallet section — shown when connected */}
              {connected && publicKey && (
                <div className="mt-2 pt-2 border-t border-border/50 space-y-1">
                  {/* Address display */}
                  <div className="px-4 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground font-mono">
                        {truncateAddress(publicKey.toBase58(), 6)}
                      </span>
                    </div>
                  </div>

                  {/* Profile */}
                  <Link
                    href="/profile"
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "px-4 py-3 rounded-lg text-sm font-medium transition-all flex items-center gap-3",
                      pathname === '/profile'
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    <User className="h-4 w-4" />
                    Profile
                  </Link>

                  {/* Copy Address */}
                  <button
                    onClick={handleCopyAddress}
                    className="w-full px-4 py-3 rounded-lg text-sm font-medium transition-all flex items-center gap-3 text-muted-foreground hover:text-foreground hover:bg-muted"
                  >
                    {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                    {copied ? 'Copied!' : 'Copy Address'}
                  </button>
                </div>
              )}

              {/* Not connected — browser hint */}
              {!connected && (
                <div className="mt-2 pt-2 border-t border-border/50">
                  <div className="mx-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <div className="flex items-start gap-2">
                      <Smartphone className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-muted-foreground">
                        <span className="text-amber-400 font-medium">On mobile?</span> Open in{' '}
                        <span className="text-amber-400">Phantom's browser</span>,{' '}
                        <span className="text-amber-400">Mises</span>, or{' '}
                        <span className="text-amber-400">Kiwi Browser</span> for wallet support.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </nav>
          </motion.div>
        )}
      </div>

      {/* Live indicator */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
    </header>
  )
}