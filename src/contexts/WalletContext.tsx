import React, { FC, useMemo } from 'react';
import {
  ConnectionProvider,
  WalletProvider,
} from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';

import '@solana/wallet-adapter-react-ui/styles.css';

// ─── Resolve network from env ─────────────────────────────────────────────────
// Must stay in sync with src/app/providers.tsx.
// Set NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta in production .env.
const rawNetwork = process.env.NEXT_PUBLIC_SOLANA_NETWORK
const SOLANA_NETWORK: WalletAdapterNetwork =
  rawNetwork === 'mainnet-beta'
    ? WalletAdapterNetwork.Mainnet
    : rawNetwork === 'testnet'
      ? WalletAdapterNetwork.Testnet
      : WalletAdapterNetwork.Devnet

interface WalletContextProviderProps {
  children: React.ReactNode;
}

export const WalletContextProvider: FC<WalletContextProviderProps> = ({ children }) => {
  const endpoint = useMemo(() => clusterApiUrl(SOLANA_NETWORK), []);

  // Explicitly list wallets for mobile browser compatibility
  // PhantomWalletAdapter supports deep linking on mobile browsers
  const wallets = useMemo(() => [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
  ], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};