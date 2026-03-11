'use client';

import { useState, useCallback } from 'react';
import { AdminUser, AdminProfileUpdateRequest } from '@/types/admin';

interface UseAdminProfileState {
  profile: AdminUser | null;
  isLoading: boolean;
  error: string | null;
}

interface UseAdminProfileActions {
  fetchProfile: () => Promise<boolean>;
  updateProfile: (data: AdminProfileUpdateRequest) => Promise<boolean>;
  clearError: () => void;
}

export function useAdminProfile(): UseAdminProfileState & UseAdminProfileActions {
  const [state, setState] = useState<UseAdminProfileState>({
    profile: null,
    isLoading: false,
    error: null,
  });

  const fetchProfile = useCallback(async (): Promise<boolean> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch('/api/admin/profile', {
        method: 'GET',
        credentials: 'include',
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: result.error || 'Failed to fetch profile',
        }));
        return false;
      }

      setState((prev) => ({
        ...prev,
        isLoading: false,
        profile: result.admin,
        error: null,
      }));

      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An error occurred';
      setState((prev) => ({ ...prev, isLoading: false, error: message }));
      return false;
    }
  }, []);

  const updateProfile = useCallback(
    async (data: AdminProfileUpdateRequest): Promise<boolean> => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const response = await fetch('/api/admin/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
          credentials: 'include',
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            error: result.error || 'Failed to update profile',
          }));
          return false;
        }

        setState((prev) => ({
          ...prev,
          isLoading: false,
          profile: result.admin,
          error: null,
        }));

        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'An error occurred';
        setState((prev) => ({ ...prev, isLoading: false, error: message }));
        return false;
      }
    },
    []
  );

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    fetchProfile,
    updateProfile,
    clearError,
  };
}
