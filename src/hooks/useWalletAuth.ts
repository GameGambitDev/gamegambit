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
        return sessionToken;
      } catch {
        // Token invalid, continue to re-verify
      }
    }

    setIsVerifying(true);
    const walletAddress = publicKey.toBase58();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    try {
      // Step 1: Generate nonce from server
      console.log('[useWalletAuth] Requesting nonce from server...');
      const nonceResponse = await fetch(`${supabaseUrl}/functions/v1/verify-wallet`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          action: 'generate-nonce',
          walletAddress,
        }),
      });

      if (!nonceResponse.ok) {
        const error = await nonceResponse.json().catch(() => ({ error: nonceResponse.statusText }));
        console.error('[useWalletAuth] Nonce generation failed:', error);
        throw new Error(error.error || 'Failed to generate nonce');
      }

      const nonceData = await nonceResponse.json();
      const { message, nonce, timestamp } = nonceData;

      // Step 2: Sign the nonce message with wallet
      console.log('[useWalletAuth] Signing nonce message with wallet...');
      const messageBuffer = Buffer.from(message);
      const signature = await signMessage(messageBuffer);

      // Step 3: Verify signature on server
      console.log('[useWalletAuth] Verifying signature on server...');
      const verifyResponse = await fetch(`${supabaseUrl}/functions/v1/verify-wallet`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          action: 'verify-signature',
          walletAddress,
          signature: Array.from(signature),  // ← Changed from Buffer.from(signature).toString('base64')
          message,
        }),
      });

      if (!verifyResponse.ok) {
        const error = await verifyResponse.json().catch(() => ({ error: verifyResponse.statusText }));
        console.error('[useWalletAuth] Verification failed:', error);
        throw new Error(error.error || 'Wallet verification failed');
      }

      const verifyData = await verifyResponse.json();

      if (!verifyData.verified || !verifyData.sessionToken) {
        console.error('[useWalletAuth] No session token in response');
        throw new Error('Failed to generate session token');
      }

      // Store session token
      const token = verifyData.sessionToken;
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
    isHydrated,
  };
}