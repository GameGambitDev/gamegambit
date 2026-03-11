'use client';

import { useState, useCallback, useEffect } from 'react';
import { AdminUser, AdminSignupRequest, AdminLoginRequest } from '@/types/admin';
import { validatePasswordStrength } from '@/lib/admin/validators';

interface UseAdminAuthState {
  admin: AdminUser | null;
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;
}

interface UseAdminAuthActions {
  signup: (data: AdminSignupRequest) => Promise<boolean>;
  login: (data: AdminLoginRequest) => Promise<boolean>;
  logout: () => Promise<void>;
  verify: () => Promise<boolean>;
  clearError: () => void;
}

export function useAdminAuth(): UseAdminAuthState & UseAdminAuthActions {
  const [state, setState] = useState<UseAdminAuthState>({
    admin: null,
    isLoading: true,
    error: null,
    isAuthenticated: false,
  });

  // Verify session on mount
  useEffect(() => {
    verify();
  }, []);

  const signup = useCallback(async (data: AdminSignupRequest): Promise<boolean> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      // Validate password strength
      const strength = validatePasswordStrength(data.password);
      if (!strength.valid) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: `Password does not meet requirements: ${strength.errors.join(', ')}`,
        }));
        return false;
      }

      const response = await fetch('/api/admin/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: result.error || 'Signup failed',
        }));
        return false;
      }

      setState((prev) => ({
        ...prev,
        isLoading: false,
        admin: result.admin,
        isAuthenticated: true,
        error: null,
      }));

      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An error occurred';
      setState((prev) => ({ ...prev, isLoading: false, error: message }));
      return false;
    }
  }, []);

  const login = useCallback(async (data: AdminLoginRequest): Promise<boolean> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: result.error || 'Login failed',
        }));
        return false;
      }

      setState((prev) => ({
        ...prev,
        isLoading: false,
        admin: result.admin,
        isAuthenticated: true,
        error: null,
      }));

      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An error occurred';
      setState((prev) => ({ ...prev, isLoading: false, error: message }));
      return false;
    }
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      await fetch('/api/admin/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });

      setState({
        admin: null,
        isLoading: false,
        error: null,
        isAuthenticated: false,
      });
    } catch (error) {
      console.error('Logout error:', error);
      setState({
        admin: null,
        isLoading: false,
        error: 'Logout failed',
        isAuthenticated: false,
      });
    }
  }, []);

  const verify = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch('/api/admin/auth/verify', {
        method: 'GET',
        credentials: 'include',
      });

      const result = await response.json();

      if (result.valid && result.admin) {
        setState((prev) => ({
          ...prev,
          admin: result.admin,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        }));
        return true;
      } else {
        setState((prev) => ({
          ...prev,
          admin: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        }));
        return false;
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        admin: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      }));
      return false;
    }
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    signup,
    login,
    logout,
    verify,
    clearError,
  };
}
