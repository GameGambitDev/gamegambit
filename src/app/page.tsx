'use client'

import { Hero } from '@/components/landing/Hero'
import { LiveFeed } from '@/components/landing/LiveFeed'
import { HowItWorks } from '@/components/landing/HowItWorks'
import { SupportedGames } from '@/components/landing/SupportedGames'

export default function HomePage() {
  return (
    <>
      <Hero />
      <LiveFeed />
      <HowItWorks />
      <SupportedGames />
    </>
  )
}
