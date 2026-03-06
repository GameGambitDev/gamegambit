import { useState, useCallback, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';

const SESSION_STORAGE_KEY = 'wallet_session_token';

export function useWalletAuth() {
  const { publicKey, signMessage } = useWallet();
  const [isVerifying, setIsVerifying] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  // Only read from sessionStorage after hydration
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
      setSessionToken(stored);
      setIsHydrated(true);
    }
  }, []);

  const verifyWallet = useCallback(async (): Promise<string | null> => {
    if (!publicKey || !signMessage) {
      console.error('[useWalletAuth] Wallet not connected or signing not available');
      return null;
    }

    // Check if we have a valid session
    if (sessionToken) {
      try {
        // If token exists and looks valid, return it
        // (In production, you'd decode and check expiration)
        return sessionToken;
      } catch {
        // Token invalid, continue to re-verify
      }
    }

    setIsVerifying(true);
    const walletAddress = publicKey.toBase58();

    try {
      // Generate a nonce (random message to sign)
      const nonce = Buffer.from(
        crypto.getRandomValues(new Uint8Array(32))
      ).toString('hex');
      const message = `Sign this message to verify your wallet: ${nonce}`;
      const messageBuffer = Buffer.from(message);

      // Step 1: Sign the message with wallet
      console.log('[useWalletAuth] Signing message with wallet...');
      const signature = await signMessage(messageBuffer);

      // Step 2: Send signature to API for verification
      console.log('[useWalletAuth] Verifying signature on server...');
      const response = await fetch('/api/auth/verify-wallet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress,
          signature: Buffer.from(signature).toString('base64'),
          message,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: response.statusText }));
        console.error('[useWalletAuth] Verification failed:', error);
        throw new Error(error.error || 'Wallet verification failed');
      }

      const data = await response.json();

      if (!data.success || !data.sessionToken) {
        console.error('[useWalletAuth] No session token in response');
        throw new Error('Failed to generate session token');
      }

      // Store session token
      const token = data.sessionToken;
      setSessionToken(token);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(SESSION_STORAGE_KEY, token);
      }

      console.log('[useWalletAuth] Wallet verified successfully');
      return token;

    } catch (error) {
      console.error('[useWalletAuth] Verification error:', error);
      throw error;
    } finally {
      setIsVerifying(false);
    }
  }, [publicKey, signMessage, sessionToken]);

  const clearSession = useCallback(() => {
    setSessionToken(null);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }, []);

  const getSessionToken = useCallback(async (): Promise<string | null> => {
    // Return existing valid token or verify
    if (sessionToken) {
      return sessionToken;
    }

    // Need to verify
    return await verifyWallet();
  }, [sessionToken, verifyWallet]);

  return {
    isVerifying,
    sessionToken,
    verifyWallet,
    clearSession,
    getSessionToken,
    isVerified: !!sessionToken,
    isHydrated, // Important: let consumers know if we're ready
  };
}