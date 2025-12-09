import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useQuery } from '@tanstack/react-query';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';

export function useWalletBalance() {
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();

  return useQuery({
    queryKey: ['walletBalance', publicKey?.toBase58()],
    queryFn: async () => {
      if (!publicKey) {
        console.log('[useWalletBalance] No public key available');
        return 0;
      }
      
      try {
        console.log('[useWalletBalance] Fetching balance for:', publicKey.toBase58());
        const balance = await connection.getBalance(publicKey);
        console.log('[useWalletBalance] Balance in lamports:', balance);
        return balance / LAMPORTS_PER_SOL;
      } catch (error) {
        console.error('[useWalletBalance] Error fetching balance:', error);
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
