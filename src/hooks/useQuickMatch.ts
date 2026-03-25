import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletAuth } from './useWalletAuth';
import { invokeSecureWager, Wager, GameType } from './useWagers';
import { toast } from 'sonner';

export function useQuickMatch() {
  const { publicKey } = useWallet();
  const queryClient = useQueryClient();
  const { getSessionToken } = useWalletAuth();

  return useMutation({
    mutationFn: async (game?: GameType): Promise<Wager> => {
      if (!publicKey) throw new Error('Wallet not connected');

      const sessionToken = await getSessionToken();
      if (!sessionToken) {
        throw new Error('Wallet verification required. Please sign the message to continue.');
      }

      const walletAddress = publicKey.toBase58();

      // Read-only query to find eligible open wagers — safe to do directly
      // via the anon Supabase client (no write, no auth bypass).
      const { getSupabaseClient } = await import('@/integrations/supabase/client');
      const supabase = getSupabaseClient();

      const { data: openWagers, error: fetchError } = await supabase
        .from('wagers')
        .select('id, game, stake_lamports, player_a_wallet, player_b_wallet, status')
        .eq('status', 'created')
        .neq('player_a_wallet', walletAddress)
        .is('player_b_wallet', null);

      if (fetchError) throw fetchError;

      let eligibleWagers = openWagers || [];
      if (game) {
        eligibleWagers = eligibleWagers.filter(w => w.game === game);
      }

      if (eligibleWagers.length === 0) {
        throw new Error(
          game
            ? `No open ${game.toUpperCase()} wagers right now. Try a different game or create one!`
            : 'No open wagers right now. Be the first to create one!'
        );
      }

      // Join via secure-wager using the same invokeSecureWager helper that
      // every other mutation in useWagers.ts uses — ensures X-Session-Token
      // is set correctly on Vercel (the old supabase.functions.invoke call
      // used Authorization: Bearer which the edge function rejected).
      const selectedWager = eligibleWagers[Math.floor(Math.random() * eligibleWagers.length)];

      const result = await invokeSecureWager<{ wager: Wager }>(
        { action: 'join', wagerId: selectedWager.id },
        sessionToken,
      );

      return result.wager;
    },
    onSuccess: (wager) => {
      queryClient.invalidateQueries({ queryKey: ['wagers'] });
      toast.success(
        `Matched! Joined a ${wager.game.toUpperCase()} wager for ${(wager.stake_lamports / 1_000_000_000).toFixed(4)} SOL`
      );
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}