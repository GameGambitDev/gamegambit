import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useQuery } from '@tanstack/react-query';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';

export function useWalletBalance() {
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();

  return useQuery({
    queryKey: ['walletBalance', publicKey?.toBase58()],
    queryFn: async () => {
      if (!publicKey) return 0;

      try {
        const balance = await connection.getBalance(publicKey);
        if (process.env.NODE_ENV === 'development') {
          console.log('[useWalletBalance] fetched for:', publicKey.toBase58(), '→', balance, 'lamports');
        }
        return balance / LAMPORTS_PER_SOL;
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[useWalletBalance] Error fetching balance:', error);
        }
        throw error;
      }
    },
    enabled: connected && !!publicKey,
    refetchInterval: 30000,
    staleTime: 10000,
    retry: 3,
    retryDelay: 1000,
  });
}