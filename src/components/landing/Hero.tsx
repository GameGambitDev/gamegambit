'use client'

import dynamic from 'next/dynamic'
import { useWallet } from '@solana/wallet-adapter-react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, Zap, Shield, Users, Sparkles, Download } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { use3DTilt } from '@/hooks/useScrollAnimation'
import { usePWA } from '@/contexts/PWAContext'
import { useEffect, useState } from 'react'
import React from 'react'

// Shake keyframes — injected once via a style tag
const SHAKE_CSS = `
@keyframes gg-shake {
  0%,100% { transform: perspective(800px) translateX(0) rotateZ(0deg); }
  15%      { transform: perspective(800px) translateX(-4px) rotateZ(-1.5deg); }
  30%      { transform: perspective(800px) translateX(4px) rotateZ(1.5deg); }
  45%      { transform: perspective(800px) translateX(-3px) rotateZ(-1deg); }
  60%      { transform: perspective(800px) translateX(3px) rotateZ(0.8deg); }
  75%      { transform: perspective(800px) translateX(-1px) rotateZ(-0.4deg); }
}
@keyframes gg-border-pulse {
  0%,100% { box-shadow: 0 0 0px 0px hsl(var(--primary)/0); }
  50%      { box-shadow: 0 0 16px 2px hsl(var(--primary)/0.35); }
}
.gg-shake {
  animation: gg-shake 0.55s cubic-bezier(.36,.07,.19,.97) both,
             gg-border-pulse 0.55s ease both;
}
`

function FeatureCard({ icon: Icon, label, desc, delay, shakeDelay }: {
  icon: React.ElementType; label: string; desc: string; delay: number; shakeDelay: number
}) {
  const { ref: tiltRef, style: tiltStyle } = use3DTilt<HTMLDivElement>(10)
  const [shaking, setShaking] = useState(false)

  // One-shot sequential shake after mount
  useEffect(() => {
    const t = setTimeout(() => {
      setShaking(true)
      setTimeout(() => setShaking(false), 600)
    }, shakeDelay)
    return () => clearTimeout(t)
  }, [shakeDelay])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      <div
        ref={tiltRef}
        style={tiltStyle}
        className={`flex flex-col items-center p-6 rounded-xl bg-card/50 border border-border/50 transition-colors duration-300 backdrop-blur-sm group hover:border-primary/50 ${shaking ? 'gg-shake' : ''}`}
      >
        <div className="p-3 rounded-lg bg-primary/10 mb-4 group-hover:bg-primary/20 group-hover:shadow-neon transition-all">
          <Icon className={`h-6 w-6 text-primary ${shaking ? 'text-accent' : ''} transition-colors duration-200`} />
        </div>
        <h3 className="font-gaming text-lg font-semibold mb-1">{label}</h3>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </div>
    </motion.div>
  )
}

const WalletMultiButton = dynamic(
  () => import('@solana/wallet-adapter-react-ui').then(m => ({ default: m.WalletMultiButton })),
  { ssr: false }
)

// NOTE: HeroCanvas is no longer mounted here — it lives in page.tsx at the
// page level so it stays fixed behind ALL sections, not just the hero.

export function Hero() {
  const { connected } = useWallet()
  const [mounted, setMounted] = useState(false)
  const { canInstall, install } = usePWA()

  useEffect(() => {
    setMounted(true)
  }, [])

  const showBanner = mounted && canInstall

  return (
    // position: relative + z-index: 1 puts this above the fixed canvas (z: 0)
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden" style={{ zIndex: 1 }}>
      {/* Static background layers */}
      <div className="absolute inset-0 cyber-grid opacity-20" />
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-background" />
      <div className="absolute inset-0 scanline opacity-10" />

      <div className="container relative z-10 px-4 py-16 sm:py-32">
        <div className="max-w-4xl mx-auto text-center">

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/10 mb-8 backdrop-blur-sm"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            <span className="text-sm font-medium text-primary">Live on Solana Devnet</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-5xl sm:text-6xl md:text-7xl font-bold mb-6 font-gaming"
          >
            <span className="text-foreground">Wager.</span>{' '}
            <span className="gradient-text text-glow">Play.</span>{' '}
            <span className="gradient-text-gold text-glow-gold">Win.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-lg md:text-2xl text-muted-foreground mb-8 max-w-2xl mx-auto text-balance px-2 sm:px-0"
          >
            The first trustless P2P gaming wager platform on Solana.
            Challenge anyone. Stake real SOL. Winner takes 90%.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex flex-col sm:flex-row gap-4 justify-center mb-8 w-full sm:w-auto"
          >
            {mounted && connected ? (
              <Link href="/arena" className="w-full sm:w-auto">
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="rounded-xl animate-glow-pulse">
                  <Button variant="neon" size="xl" className="group relative overflow-hidden w-full sm:w-auto">
                    <motion.span
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                      animate={{ x: ['-100%', '100%'] }}
                      transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
                    />
                    <Sparkles className="h-5 w-5 mr-2" />
                    Enter Arena
                    <ArrowRight className="h-5 w-5 ml-2 group-hover:translate-x-2 transition-transform duration-300" />
                  </Button>
                </motion.div>
              </Link>
            ) : (
              <div className="[&_.wallet-adapter-button]:!bg-gradient-to-r [&_.wallet-adapter-button]:!from-primary [&_.wallet-adapter-button]:!via-neon-cyan [&_.wallet-adapter-button]:!to-primary [&_.wallet-adapter-button]:!bg-[length:200%_100%] [&_.wallet-adapter-button]:!text-primary-foreground [&_.wallet-adapter-button]:!font-gaming [&_.wallet-adapter-button]:!font-bold [&_.wallet-adapter-button]:!text-lg [&_.wallet-adapter-button]:!tracking-wider [&_.wallet-adapter-button]:!rounded-xl [&_.wallet-adapter-button]:!h-14 [&_.wallet-adapter-button]:!px-10 [&_.wallet-adapter-button]:!shadow-neon-lg [&_.wallet-adapter-button]:hover:!shadow-neon-intense [&_.wallet-adapter-button]:!transition-all [&_.wallet-adapter-button]:!uppercase">
                <WalletMultiButton />
              </div>
            )}
            <Link href="#how-it-works" className="w-full sm:w-auto">
              <Button variant="outline" size="xl" className="hover:border-primary/50 hover:shadow-neon transition-all w-full sm:w-auto">
                How It Works
              </Button>
            </Link>
          </motion.div>

          {/* PWA Install Banner */}
          <AnimatePresence>
            {showBanner && (
              <motion.div
                initial={{ opacity: 0, y: -10, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -10, height: 0 }}
                transition={{ duration: 0.3 }}
                className="mb-10 mx-auto max-w-md"
              >
                <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-primary/30 bg-primary/10 backdrop-blur-sm">
                  <div className="flex items-center gap-3">
                    <Download className="h-4 w-4 text-primary flex-shrink-0" />
                    <p className="text-sm text-left">
                      <span className="font-semibold text-foreground">Install GameGambit</span>
                      <span className="text-muted-foreground"> — get match alerts instantly</span>
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="neon"
                    className="h-7 text-xs px-3 flex-shrink-0"
                    onClick={install}
                  >
                    Install
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <style>{SHAKE_CSS}</style>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <FeatureCard icon={Zap} label="Instant Payouts" desc="Winner gets 90% of the pot" delay={0.6} shakeDelay={1200} />
            <FeatureCard icon={Shield} label="Trustless" desc="Smart contract secured" delay={0.7} shakeDelay={1550} />
            <FeatureCard icon={Users} label="P2P Moderation" desc="Community-driven disputes" delay={0.8} shakeDelay={1900} />
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
    </section>
  )
}