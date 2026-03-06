import { useEffect, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { usePlayer, useCreatePlayer } from './usePlayer';
import { useWalletAuth } from './useWalletAuth';

export function useAutoCreatePlayer() {
    const { publicKey } = useWallet();
    const { isHydrated, isVerified, verifyWallet, isVerifying } = useWalletAuth();
    const { data: player, isLoading } = usePlayer();
    const createPlayerMutation = useCreatePlayer();
    const hasAttempted = useRef(false);

    // Step 1: Auto-verify wallet on connection
    useEffect(() => {
        if (!publicKey || !isHydrated || isVerified || isVerifying) return;
        verifyWallet().catch(err => {
            console.error('Auto-verification failed:', err);
        });
    }, [publicKey, isHydrated, isVerified, isVerifying, verifyWallet]);

    // Step 2: Auto-create player after verification — only once
    useEffect(() => {
        if (!publicKey) { hasAttempted.current = false; return; }
        if (!isHydrated) return;
        if (!isVerified) return;
        if (isLoading) return;
        if (player) return;
        if (createPlayerMutation.isPending) return;
        if (hasAttempted.current) return; // prevent retries

        hasAttempted.current = true;
        console.log('[useAutoCreatePlayer] Creating player...');
        createPlayerMutation.mutate();
    }, [publicKey, isHydrated, isVerified, player, isLoading, createPlayerMutation]);

    return {
        isCreating: createPlayerMutation.isPending,
        error: createPlayerMutation.error,
        playerCreated: !!player,
    };
}