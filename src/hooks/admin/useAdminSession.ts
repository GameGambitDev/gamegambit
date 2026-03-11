'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export interface AdminSession {
  token: string;
  user: {
    id: string;
    email: string;
    role: 'moderator' | 'admin' | 'superadmin';
    name?: string;
  };
  expiresAt: Date;
}

export const useAdminSession = () => {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Verify session on mount
  useEffect(() => {
    const verifySession = async () => {
      try {
        const response = await fetch('/api/admin/auth/verify', {
          method: 'GET',
          credentials: 'include',
        });

        if (!response.ok) {
          setSession(null);
          setError(null);
          return;
        }

        const data = await response.json();
        setSession(data.admin ? { token: "", user: { id: data.admin.id, email: data.admin.email, role: data.admin.role, name: data.admin.full_name }, expiresAt: new Date(data.expiresAt) } : null);
        setError(null);
      } catch (err) {
        setSession(null);
        setError(err instanceof Error ? err.message : 'Session verification failed');
      } finally {
        setIsLoading(false);
      }
    };

    verifySession();
  }, []);

  // Auto-refresh token before expiry
  useEffect(() => {
    if (!session) return;

    const expiresIn = new Date(session.expiresAt).getTime() - Date.now();
    const refreshTime = expiresIn - 5 * 60 * 1000; // Refresh 5 minutes before expiry

    if (refreshTime <= 0) {
      // Token already expired, logout
      setSession(null);
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        const response = await fetch('/api/admin/auth/refresh', {
          method: 'POST',
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          setSession(data.admin ? { token: "", user: { id: data.admin.id, email: data.admin.email, role: data.admin.role, name: data.admin.full_name }, expiresAt: new Date(data.expiresAt) } : null);
        } else {
          setSession(null);
          router.push('/itszaadminlogin/login');
        }
      } catch (err) {
        setSession(null);
        router.push('/itszaadminlogin/login');
      }
    }, refreshTime);

    return () => clearTimeout(timeout);
  }, [session, router]);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/admin/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch (err) {
      console.error('Logout failed:', err);
    } finally {
      setSession(null);
      router.push('/itszaadminlogin/login');
    }
  }, [router]);

  const refreshSession = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setSession(data.admin ? { token: "", user: { id: data.admin.id, email: data.admin.email, role: data.admin.role, name: data.admin.full_name }, expiresAt: new Date(data.expiresAt) } : null);
        return data.session;
      } else {
        setSession(null);
        return null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refresh failed');
      return null;
    }
  }, []);

  return {
    session,
    isLoading,
    error,
    logout,
    refreshSession,
    isAuthenticated: !!session,
  };
};
