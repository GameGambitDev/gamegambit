import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { motion } from 'framer-motion';
import { Gamepad2, Menu, X, User } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { truncateAddress } from '@/lib/constants';
import { NotificationsDropdown } from '@/components/NotificationsDropdown';

const navItems = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Arena', href: '/arena' },
  { label: 'My Wagers', href: '/my-wagers' },
  { label: 'Leaderboard', href: '/leaderboard' },
];

export function Header() {
  const { connected, publicKey } = useWallet();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 sm:gap-3 group">
            <motion.div
              whileHover={{ rotate: 15, scale: 1.1 }}
              transition={{ type: 'spring', stiffness: 400 }}
              className="relative"
            >
              <Gamepad2 className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
              <div className="absolute inset-0 blur-lg bg-primary/50 -z-10" />
            </motion.div>
            <span className="font-gaming text-lg sm:text-xl font-bold">
              <span className="text-foreground">Game</span>
              <span className="text-primary text-glow">Gambit</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300",
                    isActive
                      ? "bg-primary/10 text-primary border-glow-subtle"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Right Side */}
          <div className="flex items-center gap-2 sm:gap-3">
            {connected && (
              <>
                <NotificationsDropdown />
                <Link to="/profile" className="hidden sm:block">
                  <Button variant="glass" size="sm">
                    <User className="h-4 w-4 mr-2" />
                    {publicKey && truncateAddress(publicKey.toBase58())}
                  </Button>
                </Link>
              </>
            )}
            
            {/* Custom styled wallet button */}
            <div className="[&_.wallet-adapter-button]:!bg-primary [&_.wallet-adapter-button]:!text-primary-foreground [&_.wallet-adapter-button]:!font-gaming [&_.wallet-adapter-button]:!text-xs [&_.wallet-adapter-button]:sm:!text-sm [&_.wallet-adapter-button]:!rounded-lg [&_.wallet-adapter-button]:!h-9 [&_.wallet-adapter-button]:sm:!h-10 [&_.wallet-adapter-button]:!px-3 [&_.wallet-adapter-button]:sm:!px-4 [&_.wallet-adapter-button]:hover:!shadow-neon [&_.wallet-adapter-button]:!transition-all">
              <WalletMultiButton />
            </div>

            {/* Mobile Menu Toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden h-9 w-9"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-border py-4"
          >
            <nav className="flex flex-col gap-2">
              {/* Profile link in mobile menu */}
              {connected && (
                <Link
                  to="/profile"
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "px-4 py-3 rounded-lg text-sm font-medium transition-all flex items-center gap-3",
                    location.pathname === '/profile'
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
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "px-4 py-3 rounded-lg text-sm font-medium transition-all",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </motion.div>
        )}
      </div>

      {/* Live indicator */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
    </header>
  );
}
