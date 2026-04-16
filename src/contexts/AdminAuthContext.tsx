'use client';

// src/contexts/AdminAuthContext.tsx
//
// Single source of truth for admin auth state.
// Replaces the duplicated verify() calls in useAdminAuth + useAdminSession.
// Mount this once in the admin layout — every hook reads from here instead
// of hitting /api/admin/auth/verify independently.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';

export interface AdminUser {
  id: string;
  email: string;
  role: 'moderator' | 'admin' | 'superadmin';
  full_name?: string;
}

interface AdminAuthState {
  admin: AdminUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
}

interface AdminAuthActions {
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  clearError: () => void;
}

type AdminAuthContextValue = AdminAuthState & AdminAuthActions;

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<AdminAuthState>({
    admin: null,
    isLoading: true,
    isAuthenticated: false,
    error: null,
  });

  // ── Single verify call on mount ───────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const verify = async () => {
      try {
        const res = await fetch('/api/admin/auth/verify', {
          method: 'GET',
          credentials: 'include',
        });

        if (cancelled) return;

        if (!res.ok) {
          setState({ admin: null, isLoading: false, isAuthenticated: false, error: null });
          return;
        }

        const data = await res.json();
        if (data.valid && data.admin) {
          setState({ admin: data.admin, isLoading: false, isAuthenticated: true, error: null });
        } else {
          setState({ admin: null, isLoading: false, isAuthenticated: false, error: null });
        }
      } catch {
        if (!cancelled)
          setState({ admin: null, isLoading: false, isAuthenticated: false, error: null });
      }
    };

    verify();
    return () => { cancelled = true; };
  }, []);

  // ── Actions ───────────────────────────────────────────────────────────────
  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setState((prev) => ({ ...prev, isLoading: false, error: data.error || 'Login failed' }));
        return false;
      }

      setState({ admin: data.admin, isLoading: false, isAuthenticated: true, error: null });
      return true;
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Login failed',
      }));
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    // Clear local state immediately — don't wait for the API
    setState({ admin: null, isLoading: false, isAuthenticated: false, error: null });
    router.push('/itszaadminlogin/login');

    // Fire the server logout in the background (best-effort)
    try {
      await fetch('/api/admin/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {
      // Ignore — local state is already cleared
    }
  }, [router]);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return (
    <AdminAuthContext.Provider value={{ ...state, login, logout, clearError }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

// ── Consumer hooks ────────────────────────────────────────────────────────────

export function useAdminAuthContext(): AdminAuthContextValue {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuthContext must be used inside <AdminAuthProvider>');
  return ctx;
}

// Drop-in replacement for useAdminSession
export function useAdminSession() {
  const { admin, isLoading, isAuthenticated, logout } = useAdminAuthContext();

  const session = admin
    ? {
      token: '',
      user: {
        id: admin.id,
        email: admin.email,
        role: admin.role,
        name: admin.full_name,
      },
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // placeholder
    }
    : null;

  return { session, isLoading, isAuthenticated, error: null, logout, refreshSession: async () => null };
}

// Drop-in replacement for useAdminAuth
export function useAdminAuth() {
  const { admin, isLoading, isAuthenticated, error, login, logout, clearError } = useAdminAuthContext();

  const signup = async (data: { email: string; password: string; full_name?: string }): Promise<boolean> => {
    try {
      const res = await fetch('/api/admin/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
      });
      const json = await res.json();
      return res.ok && json.success === true;
    } catch {
      return false;
    }
  };

  return {
    admin,
    isLoading,
    isAuthenticated,
    error,
    login: (data: { email: string; password: string }) => login(data.email, data.password),
    logout,
    clearError,
    signup,
    verify: async () => isAuthenticated,
  };
}