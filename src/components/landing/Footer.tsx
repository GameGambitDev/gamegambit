'use client'

import { Gamepad2, Twitter, MessageCircle, Github, Download } from 'lucide-react'
import Link from 'next/link'
import { usePWA } from '@/contexts/PWAContext'
import { Button } from '@/components/ui/button'
import { useScrollAnimation, useScrollReveal3D } from '@/hooks/useScrollAnimation'

const footerLinks = {
  platform: [
    { label: 'Arena', href: '/arena' },
    { label: 'Leaderboard', href: '/leaderboard' },
    { label: 'My Wagers', href: '/my-wagers' },
  ],
  resources: [
    { label: 'How It Works', href: '/#how-it-works' },
    { label: 'FAQ', href: '/faq' },
    { label: 'Support', href: '/faq' },
  ],
  legal: [
    { label: 'Terms of Service', href: '/terms' },
    { label: 'Privacy Policy', href: '/privacy' },
  ],
}

const socials = [
  { icon: Twitter, href: 'https://x.com/gamegambit_', label: 'Twitter' },
  { icon: MessageCircle, href: 'https://discord.com', label: 'Discord' },
  { icon: Github, href: 'https://github.com/GameGambitDev/gamegambit', label: 'GitHub' },
]

export function Footer() {
  const { install } = usePWA()

  // Four columns each animate in with a staggered 3D reveal
  const cols = [
    useScrollReveal3D<HTMLDivElement>({ threshold: 0.05, delay: 0 }),
    useScrollReveal3D<HTMLDivElement>({ threshold: 0.05, delay: 80 }),
    useScrollReveal3D<HTMLDivElement>({ threshold: 0.05, delay: 160 }),
    useScrollReveal3D<HTMLDivElement>({ threshold: 0.05, delay: 240 }),
  ]

  const { ref: bottomRef, isVisible: bottomVisible } = useScrollAnimation<HTMLDivElement>({ threshold: 0.05 })

  return (
    <footer className="border-t border-border/50 bg-card/30 relative" style={{ zIndex: 1 }}>
      <div className="container px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">

          {/* Brand */}
          <div ref={cols[0].ref} style={cols[0].style} className="md:col-span-1">
            <Link href="/" className="flex items-center gap-3 mb-4">
              <Gamepad2 className="h-8 w-8 text-primary" />
              <span className="font-gaming text-xl font-bold">
                <span className="text-foreground">Game</span>
                <span className="text-primary">Gambit</span>
              </span>
            </Link>
            <p className="text-sm text-muted-foreground mb-6">
              The first trustless P2P gaming wager platform on Solana.
            </p>
            <div className="flex gap-4">
              {socials.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg bg-muted hover:bg-primary/10 hover:text-primary transition-colors"
                  aria-label={social.label}
                >
                  <social.icon className="h-5 w-5" />
                </a>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={install}
              className="mt-6 gap-2 hover:border-primary/50 hover:text-primary transition-all"
            >
              <Download className="h-4 w-4" />
              Install App
            </Button>
          </div>

          {/* Platform */}
          <div ref={cols[1].ref} style={cols[1].style}>
            <h4 className="font-gaming text-sm font-semibold mb-4 uppercase tracking-wider text-foreground">
              Platform
            </h4>
            <ul className="space-y-3">
              {footerLinks.platform.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div ref={cols[2].ref} style={cols[2].style}>
            <h4 className="font-gaming text-sm font-semibold mb-4 uppercase tracking-wider text-foreground">
              Resources
            </h4>
            <ul className="space-y-3">
              {footerLinks.resources.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div ref={cols[3].ref} style={cols[3].style}>
            <h4 className="font-gaming text-sm font-semibold mb-4 uppercase tracking-wider text-foreground">
              Legal
            </h4>
            <ul className="space-y-3">
              {footerLinks.legal.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          ref={bottomRef}
          className="mt-12 pt-8 border-t border-border/50"
          style={{
            opacity: bottomVisible ? 1 : 0,
            transition: 'opacity 0.5s ease 0.3s',
          }}
        >
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">
              © 2026 Game Gambit. All rights reserved.
            </p>
            <p className="text-sm text-muted-foreground">
              Built on <span className="text-primary">Solana</span> • Live on Devnet
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}