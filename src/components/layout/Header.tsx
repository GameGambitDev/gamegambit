'use client'

import dynamic from 'next/dynamic'
import { useWallet } from '@solana/wallet-adapter-react'
import { motion } from 'framer-motion'
import { Menu, X, User } from 'lucide-react'
import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { truncateAddress } from '@/lib/constants'
import { NotificationsDropdown } from '@/components/NotificationsDropdown'
import { ThemeToggle } from '@/components/ThemeToggle'

const WalletMultiButton = dynamic(
  () => import('@solana/wallet-adapter-react-ui').then(m => ({ default: m.WalletMultiButton })),
  { ssr: false }
)

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
  const pathname = usePathname()

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo - Responsive */}
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

          {/* Desktop Navigation - Full width on lg, icons only on md */}
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

                  {/* Tooltip on md screens when hovering */}
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

            {/* Custom styled wallet button - Always visible */}
            <div className="[&_.wallet-adapter-button]:!bg-primary [&_.wallet-adapter-button]:!text-primary-foreground [&_.wallet-adapter-button]:!font-gaming [&_.wallet-adapter-button]:!text-xs [&_.wallet-adapter-button]:sm:!text-sm [&_.wallet-adapter-button]:!rounded-xl [&_.wallet-adapter-button]:!h-8 [&_.wallet-adapter-button]:sm:!h-9 [&_.wallet-adapter-button]:md:!h-10 [&_.wallet-adapter-button]:!px-2 [&_.wallet-adapter-button]:sm:!px-3 [&_.wallet-adapter-button]:md:!px-4 [&_.wallet-adapter-button]:hover:!shadow-neon [&_.wallet-adapter-button]:!transition-all [&_.wallet-adapter-button-trigger]:!h-8 [&_.wallet-adapter-button-trigger]:sm:!h-9 [&_.wallet-adapter-button-trigger]:md:!h-10">
              <WalletMultiButton />
            </div>

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
              {/* Profile link in mobile menu */}
              {connected && (
                <Link
                  href="/profile"
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-3",
                    pathname === '/profile'
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <User className="h-4 w-4" />
                  Profile
                  {publicKey && (
                    <span className="text-xs text-muted-foreground ml-auto">
                      {truncateAddress(publicKey.toBase58(), 4)}
                    </span>
                  )}
                </Link>
              )}

              {navItems.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    <span>{item.icon}</span>
                    {item.label}
                  </Link>
                )
              })}
            </nav>
          </motion.div>
        )}
      </div>

      {/* Live indicator */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
    </header>
  )
}
