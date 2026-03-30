'use client'

import { motion } from 'framer-motion'
import { Wallet, Search, MessageSquare, Lock, Vote, Trophy } from 'lucide-react'
import { useScrollAnimation, useParallax, use3DTilt, useScrollReveal3D } from '@/hooks/useScrollAnimation'
import { CSSProperties, useRef, useState, useEffect } from 'react'

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

const STEP_CSS = `
@keyframes gg-icon-bounce {
  0%   { transform: scale(1) translateY(0); }
  30%  { transform: scale(1.28) translateY(-5px); }
  55%  { transform: scale(0.92) translateY(2px); }
  75%  { transform: scale(1.10) translateY(-2px); }
  100% { transform: scale(1) translateY(0); }
}
@keyframes gg-line-grow {
  from { transform: scaleX(0); transform-origin: left; }
  to   { transform: scaleX(1); transform-origin: left; }
}
.gg-icon-bounce { animation: gg-icon-bounce 0.6s cubic-bezier(.36,.07,.19,.97) both; }
.gg-line-grow   { animation: gg-line-grow 0.5s ease-out both; }
`

/** Single step card — scroll entrance with 3D tilt + icon bounce on reveal */
function StepCard({ step, index }: { step: typeof steps[number]; index: number }) {
  const { ref: revealRef, style: revealStyle, isVisible } = useScrollReveal3D<HTMLDivElement>({
    threshold: 0.1,
    delay: index * 90,
    fromZ: -80,
    fromRotate: index % 2 === 0 ? 8 : -8,
  })
  const { ref: tiltRef, style: tiltStyle } = use3DTilt<HTMLDivElement>(8)
  const [iconBounced, setIconBounced] = useState(false)
  const [lineVisible, setLineVisible] = useState(false)

  useEffect(() => {
    if (!isVisible) return
    const iconT = setTimeout(() => {
      setIconBounced(true)
      setTimeout(() => setIconBounced(false), 650)
    }, index * 90 + 400)
    const lineT = setTimeout(() => setLineVisible(true), index * 90 + 300)
    return () => { clearTimeout(iconT); clearTimeout(lineT) }
  }, [isVisible, index])

  return (
    <div ref={revealRef} style={revealStyle} className="relative group pt-3 pl-3">
      {/* Connector line — animates in when card becomes visible */}
      {index < steps.length - 1 && (
        <div
          className={`hidden lg:block absolute top-12 left-[60%] w-full h-px bg-gradient-to-r from-primary/50 to-transparent ${lineVisible ? 'gg-line-grow' : 'opacity-0'}`}
        />
      )}

      <div
        ref={tiltRef}
        style={tiltStyle}
        className="relative p-6 rounded-xl bg-card/50 border border-border/50 hover:border-primary/40 hover:shadow-neon transition-colors duration-300 h-full backdrop-blur-sm"
      >
        {/* Top-edge accent on hover */}
        <div className="absolute inset-x-0 top-0 h-px rounded-t-xl bg-gradient-to-r from-transparent via-primary/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
        {/* Shimmer on hover */}
        <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
          style={{ background: 'radial-gradient(circle at 50% 0%, hsl(var(--primary)/0.07), transparent 70%)' }} />

        {/* Step number badge */}
        <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-gradient-to-br from-primary to-neon-cyan flex items-center justify-center font-gaming text-sm font-bold text-primary-foreground shadow-neon group-hover:scale-110 transition-transform duration-300">
          {index + 1}
        </div>

        {/* Icon — bounces on scroll-enter, scales on hover */}
        <div className="mb-4 p-3 rounded-lg bg-primary/10 w-fit group-hover:bg-primary/20 group-hover:shadow-neon transition-all duration-300">
          <step.icon className={`h-6 w-6 text-primary group-hover:text-accent transition-colors duration-200 ${iconBounced ? 'gg-icon-bounce' : ''}`} />
        </div>

        <h3 className="font-gaming text-lg font-semibold mb-2 group-hover:text-primary transition-colors duration-200">{step.title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
      </div>
    </div>
  )
}

export function HowItWorks() {
  const { ref: headingRef, isVisible: headingVisible } = useScrollAnimation<HTMLDivElement>()
  const { ref: ctaRef, isVisible: ctaVisible } = useScrollAnimation<HTMLDivElement>()
  const orbY = useParallax(-0.08)

  return (
    <section id="how-it-works" className="py-12 sm:py-24 relative overflow-hidden" style={{ zIndex: 1 }}>
      <style>{STEP_CSS}</style>
      {/* Parallax background orb — drifts at a different rate than content */}
      <div
        className="absolute -left-32 top-1/4 w-96 h-96 rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, hsl(270 100% 60% / 0.06), transparent)',
          filter: 'blur(60px)',
          transform: `translateY(${orbY}px)`,
        }}
      />
      <div
        className="absolute -right-24 bottom-1/4 w-80 h-80 rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, hsl(180 100% 50% / 0.05), transparent)',
          filter: 'blur(60px)',
          transform: `translateY(${-orbY * 0.6}px)`,
        }}
      />

      <div className="absolute inset-0 bg-gradient-to-b from-background via-card/30 to-background" />
      <div className="absolute inset-0 cyber-grid opacity-10" />

      <div className="container relative z-10 px-4">
        {/* Header — scroll-triggered blur-reveal */}
        <div
          ref={headingRef}
          className="text-center mb-8 sm:mb-16"
          style={{
            opacity: headingVisible ? 1 : 0,
            transform: headingVisible ? 'none' : 'translateY(28px)',
            filter: headingVisible ? 'none' : 'blur(6px)',
            transition: 'opacity 0.7s cubic-bezier(.22,1,.36,1), transform 0.7s cubic-bezier(.22,1,.36,1), filter 0.7s ease',
          }}
        >
          <h2 className="text-4xl font-bold mb-4 font-gaming">
            How It <span className="gradient-text text-glow">Works</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-balance">
            From wallet connect to winner payout in minutes.
            No middlemen, no fees, no trust required.
          </p>
        </div>

        {/* Steps — each card self-animates on scroll */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {steps.map((step, index) => (
            <StepCard key={step.title} step={step} index={index} />
          ))}
        </div>

        {/* Bottom CTA */}
        <div
          ref={ctaRef}
          className="mt-16 text-center"
          style={{
            opacity: ctaVisible ? 1 : 0,
            transform: ctaVisible ? 'none' : 'translateY(20px)',
            transition: 'opacity 0.6s cubic-bezier(.22,1,.36,1) 0.2s, transform 0.6s cubic-bezier(.22,1,.36,1) 0.2s',
          }}
        >
          <p className="text-lg text-muted-foreground mb-4">
            {"This isn't play-to-earn. This is "}
            <span className="text-primary font-semibold text-glow">play-to-win</span>.
          </p>
          <p className="font-gaming text-xl text-foreground">Your move.</p>
        </div>
      </div>
    </section>
  )
}