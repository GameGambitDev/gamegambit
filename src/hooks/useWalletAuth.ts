import { useState, useCallback, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';

// localStorage so the token survives tab closes, PWA restarts, and mobile
// browser session resets. sessionStorage was wiping the token on every new
// visit and causing verifyWallet() → signMessage() to fire automatically.
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

export function useWalletAuth() {
  const { publicKey, signMessage } = useWallet();
  const [isVerifying, setIsVerifying] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  // Hydrate from localStorage once on mount
  useEffect(() => {
    setSessionToken(readToken());
    setIsHydrated(true);
  }, []);

  // Clear token when wallet disconnects or changes
  useEffect(() => {
    if (!isHydrated) return;
    if (!publicKey) {
      setSessionToken(null);
      removeToken();
    }
  }, [publicKey, isHydrated]);

  // verifyWallet — must be called EXPLICITLY by user action, never auto-called.
  // Calling signMessage automatically on connect triggers the mobile wallet
  // adapter error modal ("Can't find a wallet") and the Phantom signing popup
  // on desktop on every single page visit.
  const verifyWallet = useCallback(async (): Promise<string | null> => {
    if (!publicKey || !signMessage) return null;

    // Already have a valid token for this wallet — skip signing
    const existing = readToken();
    if (existing) {
      setSessionToken(existing);
      return existing;
    }

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
      const signature = await signMessage(Buffer.from(message));

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

  // getSessionToken — returns cached token or triggers verify (explicit flow only)
  const getSessionToken = useCallback(async (): Promise<string | null> => {
    const stored = readToken();
    if (stored) return stored;
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