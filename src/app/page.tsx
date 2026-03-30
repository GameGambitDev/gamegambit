'use client'

import dynamic from 'next/dynamic'
import { Hero } from '@/components/landing/Hero'
import { LiveFeed } from '@/components/landing/LiveFeed'
import { HowItWorks } from '@/components/landing/HowItWorks'
import { SupportedGames } from '@/components/landing/SupportedGames'
import { Footer } from '@/components/landing/Footer'

// Fixed full-page Three.js canvas — covers the entire landing page.
// Must be here (page level) so particles persist through every section.
const HeroCanvas = dynamic(
  () => import('@/components/landing/HeroCanvas').then(m => ({ default: m.HeroCanvas })),
  { ssr: false, loading: () => null }
)

export default function HomePage() {
  return (
    <>
      {/* Fixed particle canvas — sits behind all sections via z-index: 0 */}
      <HeroCanvas />

      {/* All sections sit at z-index: 1 via position: relative */}
      <Hero />
      <LiveFeed />
      <HowItWorks />
      <SupportedGames />
    </>
  )
}