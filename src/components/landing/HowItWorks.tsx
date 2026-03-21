'use client'

import { motion } from 'framer-motion'
import { Wallet, Search, MessageSquare, Lock, Vote, Trophy } from 'lucide-react'

const steps = [
  {
    icon: Wallet,
    title: 'Connect Wallet',
    description: 'Link your Solana wallet. No email, no password. Your keys, your wagers.',
  },
  {
    icon: Search,
    title: 'Find Opponent',
    description: 'Search by name, play nearby, or quick match with anyone online.',
  },
  {
    icon: MessageSquare,
    title: 'Chat & Challenge',
    description: 'Negotiate the game, stakes, and rules. Both players hit READY.',
  },
  {
    icon: Lock,
    title: 'Stakes Lock',
    description: 'SOL is locked in a smart contract. No trust needed.',
  },
  {
    icon: Vote,
    title: 'Play & Vote',
    description: 'Play the game off-platform. Both vote on the winner.',
  },
  {
    icon: Trophy,
    title: 'Winner Takes 90%',
    description: 'Matching votes = instant payout. Disputes go to random moderators.',
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-12 sm:py-24 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-card/30 to-background" />
      <div className="absolute inset-0 cyber-grid opacity-10" />

      <div className="container relative z-10 px-4">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl font-bold mb-4 font-gaming"
          >
            How It <span className="gradient-text text-glow">Works</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-lg text-muted-foreground max-w-2xl mx-auto text-balance"
          >
            From wallet connect to winner payout in minutes.
            No middlemen, no fees, no trust required.
          </motion.p>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {steps.map((step, index) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="relative group pt-3 pl-3"
            >
              {/* Connector Line */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-12 left-[60%] w-full h-px bg-gradient-to-r from-primary/50 to-transparent" />
              )}

              <div className="relative p-6 rounded-xl bg-card/50 border border-border/50 hover:border-primary/30 hover:shadow-neon transition-all duration-300 h-full backdrop-blur-sm">
                {/* Step Number */}
                <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-gradient-to-br from-primary to-neon-cyan flex items-center justify-center font-gaming text-sm font-bold text-primary-foreground shadow-neon">
                  {index + 1}
                </div>

                {/* Icon */}
                <div className="mb-4 p-3 rounded-lg bg-primary/10 w-fit group-hover:bg-primary/20 group-hover:shadow-neon transition-all">
                  <step.icon className="h-6 w-6 text-primary" />
                </div>

                {/* Content */}
                <h3 className="font-gaming text-lg font-semibold mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-16 text-center"
        >
          <p className="text-lg text-muted-foreground mb-4">
            {"This isn't play-to-earn. This is "}
            <span className="text-primary font-semibold text-glow">play-to-win</span>.
          </p>
          <p className="font-gaming text-xl text-foreground">
            Your move.
          </p>
        </motion.div>
      </div>
    </section>
  )
}