import { useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { usePlayer, useCreatePlayer } from './usePlayer';
import { useWalletAuth } from './useWalletAuth';

/**
 * Auto-creates a player record when wallet connects
 * Handles hydration, auth verification, and debouncing
 * Call this hook in your layout or root component
 */
export function useAutoCreatePlayer() {
    const { publicKey } = useWallet();
    const { isHydrated, isVerified, verifyWallet, isVerifying } = useWalletAuth();
    const { data: player, isLoading } = usePlayer();
    const createPlayerMutation = useCreatePlayer();

    // Step 1: Auto-verify wallet on connection
    useEffect(() => {
        if (!publicKey || !isHydrated || isVerified || isVerifying) return;

        verifyWallet().catch(err => {
            console.error('Auto-verification failed:', err);
        });
    }, [publicKey, isHydrated, isVerified, isVerifying, verifyWallet]);

    // Step 2: Auto-create player after successful verification
    useEffect(() => {
        if (!publicKey) return; // Wallet not connected
        if (!isHydrated) return; // Still hydrating
        if (!isVerified) return; // Not verified yet
        if (isLoading) return; // Still loading player data
        if (player) return; // Player already exists
        if (createPlayerMutation.isPending) return; // Already creating

        console.log('[useAutoCreatePlayer] Creating player...');
        createPlayerMutation.mutate();
    }, [publicKey, isHydrated, isVerified, player, isLoading, createPlayerMutation]);

    return {
        isCreating: createPlayerMutation.isPending,
        error: createPlayerMutation.error,
        playerCreated: !!player,
    };
}