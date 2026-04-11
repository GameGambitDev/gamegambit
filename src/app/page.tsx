'use client'

import dynamic from 'next/dynamic'
import { Hero } from '@/components/landing/Hero'

// Fixed full-page Three.js canvas — covers the entire landing page.
// Must be here (page level) so particles persist through every section.
const HeroCanvas = dynamic(
  () => import('@/components/landing/HeroCanvas').then(m => ({ default: m.HeroCanvas })),
  { ssr: false, loading: () => null }
)

// Below-fold sections — not visible on first load, defer their JS
const StatsBar = dynamic(
  () => import('@/components/landing/StatsBar').then(m => ({ default: m.StatsBar })),
  { ssr: false, loading: () => null }
)
const LiveFeed = dynamic(
  () => import('@/components/landing/LiveFeed').then(m => ({ default: m.LiveFeed })),
  { ssr: false, loading: () => null }
)
const HowItWorks = dynamic(
  () => import('@/components/landing/HowItWorks').then(m => ({ default: m.HowItWorks })),
  { ssr: false, loading: () => null }
)
const SupportedGames = dynamic(
  () => import('@/components/landing/SupportedGames').then(m => ({ default: m.SupportedGames })),
  { ssr: false, loading: () => null }
)

export default function HomePage() {
  return (
    <>
      {/* Fixed particle canvas — sits behind all sections via z-index: 0 */}
      <HeroCanvas />

      {/* All sections sit at z-index: 1 via position: relative */}
      <Hero />
      <StatsBar />
      <LiveFeed />
      <HowItWorks />
      <SupportedGames />
    </>
  )
}