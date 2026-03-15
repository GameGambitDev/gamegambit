'use client'

import { WalletAdapterNetwork } from '@solana/wallet-adapter-base'
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom'
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare'
import { WalletConnectWalletAdapter } from '@solana/wallet-adapter-walletconnect'

import { ReactNode, useMemo, useState, useEffect, createContext, useContext } from 'react'
import {
  ConnectionProvider,
  WalletProvider,
  useWallet,
} from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import { clusterApiUrl } from '@solana/web3.js'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { useAutoCreatePlayer } from '@/hooks/useAutoCreatePlayer'
import { PWAInstallPrompt, ServiceWorkerUpdater } from '@/components/PWASetup'

import '@solana/wallet-adapter-react-ui/styles.css'

// ─── WalletReady context ──────────────────────────────────────────────────────
// On mobile, autoConnect is async. Phantom/Solflare reconnect 500-800ms after
// mount. Any page that reads `connected` before that resolves will see `false`
// and show the "connect your wallet" screen permanently.
//
// useWalletReady() returns true once the adapter has finished its autoConnect
// attempt. Pages should check this BEFORE checking `connected`:
//
//   const walletReady = useWalletReady()
//   if (!walletReady) return <LoadingSpinner />   // still reconnecting
//   if (!connected)   return <ConnectPrompt />    // genuinely not connected

const WalletReadyContext = createContext(false)

export function useWalletReady() {
  return useContext(WalletReadyContext)
}

function WalletReadyProvider({ children }: { children: ReactNode }) {
  const { connecting, connected } = useWallet()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Once connected, mark ready immediately
    if (connected) {
      setReady(true)
      return
    }
    // If not connecting (autoConnect has either finished or there's no stored
    // wallet), wait 800ms for Phantom deep-link callbacks to settle, then mark
    // ready regardless — user is genuinely disconnected at that point.
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

interface ProvidersProps {
  children: ReactNode
}

function AutoPlayerSetup() {
  const { error } = useAutoCreatePlayer()
  if (error) console.error('Failed to create player:', error)
  return null
}

export function Providers({ children }: ProvidersProps) {
  // useState keeps queryClient stable across re-renders and navigations.
  // Module-level definition gets nuked on mobile hot-reloads, dropping all
  // cached wager/player data and causing wallet-dependent queries to re-run
  // with stale connected=false state.
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

  const endpoint = useMemo(() => clusterApiUrl('devnet'), [])
  const wallets = useMemo(() => {
    const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
    const list: any[] = [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ]
    if (projectId) {
      list.push(
        new WalletConnectWalletAdapter({
          network: WalletAdapterNetwork.Devnet,
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
        <WalletProvider wallets={wallets} autoConnect>
          <WalletModalProvider>
            <WalletReadyProvider>
              <TooltipProvider>
                <PWAInstallPrompt />
                <ServiceWorkerUpdater />
                <AutoPlayerSetup />
                {children}
                <Toaster />
                <Sonner />
              </TooltipProvider>
            </WalletReadyProvider>
          </WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
    </QueryClientProvider>
  )
}