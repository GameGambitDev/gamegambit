import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWallet } from '@solana/wallet-adapter-react';

export interface WagerTransaction {
  id: string;
  wager_id: string;
  tx_type: 'escrow_deposit' | 'escrow_release' | 'winner_payout' | 'draw_refund' | 'platform_fee';
  wallet_address: string;
  amount_lamports: number;
  tx_signature: string | null;
  status: 'pending' | 'confirmed' | 'failed';
  error_message: string | null;
  created_at: string;
}

// Fetch transactions for a specific wager
export function useWagerTransactions(wagerId: string | null) {
  return useQuery({
    queryKey: ['wager-transactions', wagerId],
    queryFn: async () => {
      if (!wagerId) return [];
      
      const { data, error } = await supabase
        .from('wager_transactions')
        .select('*')
        .eq('wager_id', wagerId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as WagerTransaction[];
    },
    enabled: !!wagerId,
  });
}

// Fetch all transactions for the connected wallet
export function useMyTransactions(limit: number = 50) {
  const { publicKey } = useWallet();
  const walletAddress = publicKey?.toBase58();

  return useQuery({
    queryKey: ['my-transactions', walletAddress, limit],
    queryFn: async () => {
      if (!walletAddress) return [];
      
      const { data, error } = await supabase
        .from('wager_transactions')
        .select('*')
        .eq('wallet_address', walletAddress)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return data as WagerTransaction[];
    },
    enabled: !!walletAddress,
  });
}

// Get transaction type display info
export function getTransactionTypeInfo(txType: string) {
  switch (txType) {
    case 'escrow_deposit':
      return { label: 'Escrow Deposit', color: 'text-warning', icon: '⬆️' };
    case 'escrow_release':
      return { label: 'Escrow Released', color: 'text-muted-foreground', icon: '⬇️' };
    case 'winner_payout':
      return { label: 'Winner Payout', color: 'text-success', icon: '🏆' };
    case 'draw_refund':
      return { label: 'Draw Refund', color: 'text-primary', icon: '🤝' };
    case 'platform_fee':
      return { label: 'Platform Fee', color: 'text-muted-foreground', icon: '💎' };
    default:
      return { label: txType, color: 'text-foreground', icon: '📝' };
  }
}

// Get status display info
export function getTransactionStatusInfo(status: string) {
  switch (status) {
    case 'confirmed':
      return { label: 'Confirmed', color: 'text-success' };
    case 'pending':
      return { label: 'Pending', color: 'text-warning' };
    case 'failed':
      return { label: 'Failed', color: 'text-destructive' };
    default:
      return { label: status, color: 'text-foreground' };
  }
}