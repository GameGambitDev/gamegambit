import type { Metadata, Viewport } from 'next'
import { Inter, Orbitron } from 'next/font/google'
import { Providers } from './providers'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/landing/Footer'
import { UsernameEnforcer } from '@/components/UsernameEnforcer'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

const orbitron = Orbitron({
  subsets: ['latin'],
  variable: '--font-orbitron',
})

export const metadata: Metadata = {
  title: 'Game Gambit | Competitive Gaming Wagers on Solana',
  description: 'Challenge opponents, stake SOL, and prove your skills in competitive gaming matches. Built on Solana for instant, secure transactions.',
  keywords: ['gaming', 'wagers', 'solana', 'competitive', 'esports', 'chess', 'codm', 'pubg'],
  authors: [{ name: 'Game Gambit Team' }],
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.png',
    shortcut: '/favicon.png',
    apple: '/logo.png',
  },
  openGraph: {
    title: 'Game Gambit | Competitive Gaming Wagers',
    description: 'Challenge opponents and stake SOL in competitive gaming matches',
    type: 'website',
    images: [
      {
        url: '/logo.png',
        width: 1200,
        height: 630,
        alt: 'Game Gambit Logo',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Game Gambit',
    description: 'Competitive Gaming Wagers on Solana',
    images: ['/logo.png'],
  },
}

export const viewport: Viewport = {
  themeColor: '#9945FF',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${orbitron.variable} font-sans`}>
        <Providers>
          <UsernameEnforcer>
            <div className="min-h-screen bg-background flex flex-col">
              <Header />
              <main className="flex-1 pt-16 w-full overflow-x-hidden">
                {children}
              </main>
              <Footer />
            </div>
          </UsernameEnforcer>
        </Providers>
      </body>
    </html>
  )
}
