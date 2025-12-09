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
      const balance = await connection.getBalance(publicKey);
      return balance / LAMPORTS_PER_SOL;
    },
    enabled: connected && !!publicKey,
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 10000,
  });
}
