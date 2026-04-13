import { useEffect, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { usePlayer, useCreatePlayer } from './usePlayer';
import { useWalletAuth } from './useWalletAuth';

// IMPORTANT: This hook no longer calls verifyWallet() automatically.
// Auto-calling signMessage on connect was triggering:
//   - "Can't find a wallet" modal on mobile (no compatible wallet app installed error)
//   - Phantom transaction signer popup on every single page load on desktop
//
// verifyWallet() is now only called explicitly when the user performs an
// action that requires auth (create wager, join wager, etc.) via getSessionToken().
//
// Player creation still runs automatically AFTER the user has already verified
// (i.e. isVerified === true from a persisted localStorage token), which is safe
// because it only hits our own backend, not the wallet.

const REFERRAL_COOKIE = 'gg_referrer';

/** Read referral code stored by /invite/[code] page */
function getReferralCookie(): string | null {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.match(new RegExp(`(?:^|; )${REFERRAL_COOKIE}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
}

/** Clear referral cookie after use */
function clearReferralCookie() {
    if (typeof document === 'undefined') return;
    document.cookie = `${REFERRAL_COOKIE}=; path=/; max-age=0`;
}

export function useAutoCreatePlayer() {
    const { publicKey } = useWallet();
    const { isHydrated, isVerified, isVerifying } = useWalletAuth();
    const { data: player, isLoading } = usePlayer();
    const createPlayerMutation = useCreatePlayer();
    const hasAttempted = useRef(false);

    // Auto-create player record in our DB — but ONLY after the user has already
    // explicitly verified their wallet (token exists in localStorage). This hits
    // our own API, not the wallet adapter, so no signing popup.
    useEffect(() => {
        if (!publicKey) { hasAttempted.current = false; return; }
        if (!isHydrated) return;
        if (!isVerified) return;   // don't run until user has signed at least once
        if (isLoading) return;
        if (player) return;
        if (createPlayerMutation.isPending) return;
        if (hasAttempted.current) return;

        hasAttempted.current = true;

        // Read referral cookie — pass code to backend, clear cookie regardless
        const referrerCode = getReferralCookie();
        clearReferralCookie();

        console.log('[useAutoCreatePlayer] Creating player record...', referrerCode ? `referrer: ${referrerCode}` : '');
        createPlayerMutation.mutate(referrerCode ?? undefined);
    }, [publicKey, isHydrated, isVerified, player, isLoading, createPlayerMutation]);

    return {
        isCreating: createPlayerMutation.isPending,
        error: createPlayerMutation.error,
        playerCreated: !!player,
    };
}