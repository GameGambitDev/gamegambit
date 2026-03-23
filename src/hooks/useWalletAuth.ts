import { useState, useCallback, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';

const STORAGE_KEY = 'gg_wallet_session';

function readToken(): string | null {
  try { return localStorage.getItem(STORAGE_KEY) } catch { return null }
}
function writeToken(t: string) {
  try { localStorage.setItem(STORAGE_KEY, t) } catch { }
}
function removeToken() {
  try { localStorage.removeItem(STORAGE_KEY) } catch { }
}

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[0]))
    return payload.exp < Date.now()
  } catch { return true }
}

export function useWalletAuth() {
  const { publicKey, signMessage } = useWallet();
  const [isVerifying, setIsVerifying] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const token = readToken();
    if (token && isTokenExpired(token)) {
      removeToken();
      setSessionToken(null);
    } else {
      setSessionToken(token);
    }
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    if (!publicKey) {
      setSessionToken(null);
      removeToken();
    }
  }, [publicKey, isHydrated]);

  const verifyWallet = useCallback(async (): Promise<string | null> => {
    if (!publicKey || !signMessage) return null;

    const existing = readToken();
    if (existing && !isTokenExpired(existing)) {
      setSessionToken(existing);
      return existing;
    }

    // Token missing or expired — clear it and re-verify
    removeToken();

    setIsVerifying(true);
    const walletAddress = publicKey.toBase58();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    try {
      const nonceRes = await fetch(`${supabaseUrl}/functions/v1/verify-wallet`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({ action: 'generate-nonce', walletAddress }),
      });

      if (!nonceRes.ok) {
        const err = await nonceRes.json().catch(() => ({ error: nonceRes.statusText }));
        throw new Error(err.error || 'Failed to generate nonce');
      }

      const { message } = await nonceRes.json();

      const signature = await signMessage(new TextEncoder().encode(message));

      const verifyRes = await fetch(`${supabaseUrl}/functions/v1/verify-wallet`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          action: 'verify-signature',
          walletAddress,
          signature: Array.from(signature),
          message,
        }),
      });

      if (!verifyRes.ok) {
        const err = await verifyRes.json().catch(() => ({ error: verifyRes.statusText }));
        throw new Error(err.error || 'Wallet verification failed');
      }

      const verifyData = await verifyRes.json();
      if (!verifyData.verified || !verifyData.sessionToken) {
        throw new Error('Failed to generate session token');
      }

      writeToken(verifyData.sessionToken);
      setSessionToken(verifyData.sessionToken);
      return verifyData.sessionToken;

    } catch (error) {
      console.error('[useWalletAuth] Verification error:', error);
      throw error;
    } finally {
      setIsVerifying(false);
    }
  }, [publicKey, signMessage]);

  const clearSession = useCallback(() => {
    setSessionToken(null);
    removeToken();
  }, []);

  const getSessionToken = useCallback(async (): Promise<string | null> => {
    const stored = readToken();
    if (stored && !isTokenExpired(stored)) return stored;
    // Expired or missing — trigger re-verification
    removeToken();
    return await verifyWallet();
  }, [verifyWallet]);

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