import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletAuth } from './useWalletAuth';
import { toast } from 'sonner';

export function useQuickMatch() {
  const { publicKey } = useWallet();
  const queryClient = useQueryClient();
  const { getSessionToken } = useWalletAuth();

  return useMutation({
    mutationFn: async (game?: 'chess' | 'codm' | 'pubg' | undefined) => {
      if (!publicKey) throw new Error('Wallet not connected');
      
      // Get verified session token
      const sessionToken = await getSessionToken();
      if (!sessionToken) {
        throw new Error('Wallet verification required. Please sign the message to continue.');
      }
      
      const walletAddress = publicKey.toBase58();
      
      // Find a random open wager that the user can join (not their own)
      const { data: openWagers, error: fetchError } = await supabase
        .from('wagers')
        .select('*')
        .eq('status', 'created')
        .neq('player_a_wallet', walletAddress)
        .is('player_b_wallet', null);
      
      if (fetchError) throw fetchError;
      
      // Filter by game type if specified
      let eligibleWagers = openWagers || [];
      if (game) {
        eligibleWagers = eligibleWagers.filter(w => w.game === game);
      }
      
      if (eligibleWagers.length === 0) {
        throw new Error('No open wagers available. Create one to get started!');
      }
      
      // Pick a random wager
      const randomIndex = Math.floor(Math.random() * eligibleWagers.length);
      const selectedWager = eligibleWagers[randomIndex];
      
      // Join the wager via secure edge function
      const { data, error: joinError } = await supabase.functions.invoke('secure-wager', {
        body: { action: 'join', wagerId: selectedWager.id },
        headers: { 'x-wallet-session': sessionToken },
      });
      
      if (joinError) throw joinError;
      if (data?.error) throw new Error(data.error);
      
      return data.wager;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['wagers'] });
      queryClient.invalidateQueries({ queryKey: ['myWagers'] });
      toast.success(`Matched! You joined a ${data.game} wager for ${(data.stake_lamports / 1_000_000_000).toFixed(4)} SOL`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
