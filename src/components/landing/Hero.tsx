'use client'

import { motion } from 'framer-motion'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { ArrowRight, Zap, Shield, Users, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export function Hero() {
  const { connected } = useWallet()

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Cyber Grid Background */}
      <div className="absolute inset-0 cyber-grid opacity-30" />
      
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-background" />
      <div className="absolute inset-0 scanline opacity-20" />

      {/* Animated Orbs */}
      <motion.div
        animate={{
          y: [0, -30, 0],
          opacity: [0.2, 0.5, 0.2],
          scale: [1, 1.1, 1],
        }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-1/4 left-1/4 w-72 h-72 rounded-full bg-gradient-radial from-primary/30 to-transparent blur-3xl"
      />
      <motion.div
        animate={{
          y: [0, 30, 0],
          opacity: [0.15, 0.4, 0.15],
          scale: [1, 1.15, 1],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-gradient-radial from-secondary/25 to-transparent blur-3xl"
      />
      <motion.div
        animate={{
          x: [0, 20, 0],
          opacity: [0.1, 0.3, 0.1],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-1/2 right-1/3 w-64 h-64 rounded-full bg-gradient-radial from-accent/20 to-transparent blur-3xl"
      />

      {/* Content */}
      <div className="container relative z-10 px-4 py-32">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
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

          {/* Main Headline */}
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

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-2xl mx-auto text-balance"
          >
            The first trustless P2P gaming wager platform on Solana. 
            Challenge anyone. Stake real SOL. Winner takes all.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex flex-col sm:flex-row gap-4 justify-center mb-16"
          >
            {connected ? (
              <Link href="/arena">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="rounded-xl animate-glow-pulse"
                >
                  <Button variant="neon" size="xl" className="group relative overflow-hidden">
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
            <Link href="#how-it-works">
              <Button variant="outline" size="xl" className="hover:border-primary/50 hover:shadow-neon transition-all">
                How It Works
              </Button>
            </Link>
          </motion.div>

          {/* Stats/Features */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="grid grid-cols-1 sm:grid-cols-3 gap-6"
          >
            {[
              { icon: Zap, label: 'Instant Payouts', desc: 'Winner gets 100% of the pot' },
              { icon: Shield, label: 'Trustless', desc: 'Smart contract secured' },
              { icon: Users, label: 'P2P Moderation', desc: 'Community-driven disputes' },
            ].map((feature, i) => (
              <motion.div
                key={feature.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 + i * 0.1 }}
                whileHover={{ y: -5, borderColor: 'hsl(var(--primary) / 0.5)' }}
                className="flex flex-col items-center p-6 rounded-xl bg-card/50 border border-border/50 transition-all duration-300 backdrop-blur-sm group"
              >
                <div className="p-3 rounded-lg bg-primary/10 mb-4 group-hover:bg-primary/20 group-hover:shadow-neon transition-all">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-gaming text-lg font-semibold mb-1">{feature.label}</h3>
                <p className="text-sm text-muted-foreground">{feature.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Bottom Gradient */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
    </section>
  )
}
