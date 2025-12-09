import { useState, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { supabase } from '@/integrations/supabase/client';

const SESSION_STORAGE_KEY = 'wallet_session_token';

export function useWalletAuth() {
  const { publicKey, signMessage } = useWallet();
  const [isVerifying, setIsVerifying] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(() => {
    // Initialize from session storage
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem(SESSION_STORAGE_KEY);
    }
    return null;
  });

  const verifyWallet = useCallback(async (): Promise<string | null> => {
    if (!publicKey || !signMessage) {
      console.error('[useWalletAuth] Wallet not connected or signing not available');
      return null;
    }

    // Check if we have a valid session
    if (sessionToken) {
      try {
        const [payloadB64] = sessionToken.split('.');
        const payload = JSON.parse(atob(payloadB64));
        if (payload.exp > Date.now() && payload.wallet === publicKey.toBase58()) {
          return sessionToken;
        }
      } catch {
        // Token invalid, continue to re-verify
      }
    }

    setIsVerifying(true);
    const walletAddress = publicKey.toBase58();

    try {
      // Step 1: Request nonce
      const { data: nonceData, error: nonceError } = await supabase.functions.invoke('verify-wallet', {
        body: { action: 'generate-nonce', walletAddress },
      });

      if (nonceError || !nonceData?.message) {
        console.error('[useWalletAuth] Failed to get nonce:', nonceError);
        throw new Error('Failed to generate verification challenge');
      }

      // Step 2: Sign the message with wallet
      const messageBytes = new TextEncoder().encode(nonceData.message);
      const signature = await signMessage(messageBytes);

      // Step 3: Verify signature on server
      const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-wallet', {
        body: {
          action: 'verify-signature',
          walletAddress,
          signature: Array.from(signature),
          message: nonceData.message,
        },
      });

      if (verifyError || !verifyData?.verified) {
        console.error('[useWalletAuth] Signature verification failed:', verifyError);
        throw new Error('Wallet verification failed');
      }

      // Store session token
      const token = verifyData.sessionToken;
      setSessionToken(token);
      sessionStorage.setItem(SESSION_STORAGE_KEY, token);

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
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  }, []);

  const getSessionToken = useCallback(async (): Promise<string | null> => {
    // Return existing valid token or verify
    if (sessionToken) {
      try {
        const [payloadB64] = sessionToken.split('.');
        const payload = JSON.parse(atob(payloadB64));
        if (payload.exp > Date.now() && payload.wallet === publicKey?.toBase58()) {
          return sessionToken;
        }
      } catch {
        // Token invalid
      }
    }
    
    // Need to verify
    return await verifyWallet();
  }, [sessionToken, publicKey, verifyWallet]);

  return {
    isVerifying,
    sessionToken,
    verifyWallet,
    clearSession,
    getSessionToken,
    isVerified: !!sessionToken,
  };
}
