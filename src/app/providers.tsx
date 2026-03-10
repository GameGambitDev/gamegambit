'use client'

import { ReactNode, useMemo } from 'react'
import {
  ConnectionProvider,
  WalletProvider,
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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
})

interface ProvidersProps {
  children: ReactNode
}

// Separate component that uses hooks (must be inside WalletProvider)
function AutoPlayerSetup() {
  const { isCreating, error } = useAutoCreatePlayer();

  if (error) {
    console.error('Failed to create player:', error);
    // Silently fail - user can still use the app
  }

  // This component doesn't render anything, just runs side effects
  return null;
}

export function Providers({ children }: ProvidersProps) {
  const endpoint = useMemo(() => clusterApiUrl('devnet'), [])
  const wallets = useMemo(() => [], [])

  return (
    <QueryClientProvider client={queryClient}>
      <ConnectionProvider endpoint={endpoint}>
        <WalletProvider wallets={wallets} autoConnect>
          <WalletModalProvider>
            <TooltipProvider>
              <PWAInstallPrompt />
              <ServiceWorkerUpdater />
              <AutoPlayerSetup />
              {children}
              <Toaster />
              <Sonner />
            </TooltipProvider>
          </WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
    </QueryClientProvider>
  )
}
