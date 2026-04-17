'use client'

import { ReactNode, useMemo, useState, useEffect, createContext, useContext } from 'react'
import {
  ConnectionProvider,
  WalletProvider,
  useWallet,
} from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base'
import { WalletConnectWalletAdapter } from '@solana/wallet-adapter-walletconnect'
import { clusterApiUrl } from '@solana/web3.js'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@/components/ui/tooltip'
// import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { useAutoCreatePlayer } from '@/hooks/useAutoCreatePlayer'
import dynamic from 'next/dynamic'

import { ModalProvider } from '@/contexts/ModalContext'
import { BalanceAnimationProvider } from '@/contexts/BalanceAnimationContext'
import { GameEventProvider } from '@/contexts/GameEventContext'

// ── Lazy-loaded non-critical UI ───────────────────────────────────────────────
const PWAInstallPrompt = dynamic(
  () => import('@/components/PWASetup').then(m => ({ default: m.PWAInstallPrompt })),
  { ssr: false, loading: () => null }
)
const ServiceWorkerUpdater = dynamic(
  () => import('@/components/PWASetup').then(m => ({ default: m.ServiceWorkerUpdater })),
  { ssr: false, loading: () => null }
)
const ModerationOrchestrator = dynamic(
  () => import('@/components/ModerationOrchestrator').then(m => ({ default: m.ModerationOrchestrator })),
  { ssr: false, loading: () => null }
)

import '@solana/wallet-adapter-react-ui/styles.css'

// ─── Resolve network from env ─────────────────────────────────────────────────
const rawNetwork = process.env.NEXT_PUBLIC_SOLANA_NETWORK
const SOLANA_NETWORK: WalletAdapterNetwork =
  rawNetwork === 'mainnet-beta'
    ? WalletAdapterNetwork.Mainnet
    : WalletAdapterNetwork.Devnet

const WALLETCONNECT_NETWORK: WalletAdapterNetwork.Mainnet | WalletAdapterNetwork.Devnet =
  SOLANA_NETWORK === WalletAdapterNetwork.Mainnet
    ? WalletAdapterNetwork.Mainnet
    : WalletAdapterNetwork.Devnet

// ─── WalletReady context ──────────────────────────────────────────────────────
const WalletReadyContext = createContext(false)

export function useWalletReady() {
  return useContext(WalletReadyContext)
}

function WalletReadyProvider({ children }: { children: ReactNode }) {
  const { connecting, connected } = useWallet()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (connected) {
      setReady(true)
      return
    }
    if (!connecting) {
      const t = setTimeout(() => setReady(true), 800)
      return () => clearTimeout(t)
    }
  }, [connecting, connected])

  return (
    <WalletReadyContext.Provider value={ready}>
      {children}
    </WalletReadyContext.Provider>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function AutoPlayerSetup() {
  const { error } = useAutoCreatePlayer()
  if (error) console.error('Failed to create player:', error)
  return null
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  const endpoint = useMemo(() => clusterApiUrl(SOLANA_NETWORK), [])

  const wallets = useMemo(() => {
    const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID

    // Phantom and Solflare are intentionally NOT listed here —
    // both wallets self-register via the Wallet Standard and will
    // appear automatically in the modal. Explicitly adding their
    // adapters causes duplicate registrations and a React render error.
    const list: any[] = []

    if (projectId) {
      list.push(
        new WalletConnectWalletAdapter({
          network: WALLETCONNECT_NETWORK,
          options: {
            projectId,
            metadata: {
              name: 'GameGambit',
              description: 'Skill-based wagering on Solana',
              url: 'https://thegamegambit.vercel.app',
              icons: ['https://thegamegambit.vercel.app/logo.png'],
            },
          },
        })
      )
    }

    return list
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <ConnectionProvider endpoint={endpoint}>
        <WalletProvider
          wallets={wallets}
          autoConnect
          onError={(error) => {
            if (error.name === 'WalletNotReadyError') return
            console.error('[WalletProvider]', error)
          }}
        >
          <WalletModalProvider>
            <WalletReadyProvider>
              <BalanceAnimationProvider>
                <ModalProvider>
                  <GameEventProvider>
                    <TooltipProvider>
                      <PWAInstallPrompt />
                      <ServiceWorkerUpdater />
                      <AutoPlayerSetup />
                      <ModerationOrchestrator />
                      {children}
                      {/* <Toaster /> */}
                      <Sonner />
                    </TooltipProvider>
                  </GameEventProvider>
                </ModalProvider>
              </BalanceAnimationProvider>
            </WalletReadyProvider>
          </WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
    </QueryClientProvider>
  )
}