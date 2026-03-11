'use client';

import { useState, useCallback } from 'react';
import { AdminWalletBinding } from '@/types/admin';

interface UseAdminWalletState {
  wallets: AdminWalletBinding[];
  isLoading: boolean;
  error: string | null;
  bindingInProgress: boolean;
  currentBindingId: string | null;
}

interface UseAdminWalletActions {
  fetchWallets: () => Promise<boolean>;
  bindWallet: (walletAddress: string) => Promise<{ success: boolean; bindingId?: string; message?: string }>;
  verifyWallet: (bindingId: string, signature: string, message: string) => Promise<boolean>;
  setPrimaryWallet: (walletId: string) => Promise<boolean>;
  unbindWallet: (walletId: string) => Promise<boolean>;
  clearError: () => void;
}

export function useAdminWallet(): UseAdminWalletState & UseAdminWalletActions {
  const [state, setState] = useState<UseAdminWalletState>({
    wallets: [],
    isLoading: false,
    error: null,
    bindingInProgress: false,
    currentBindingId: null,
  });

  const fetchWallets = useCallback(async (): Promise<boolean> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch('/api/admin/wallet/list', {
        method: 'GET',
        credentials: 'include',
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: result.error || 'Failed to fetch wallets',
        }));
        return false;
      }

      setState((prev) => ({
        ...prev,
        isLoading: false,
        wallets: result.wallets || [],
        error: null,
      }));

      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An error occurred';
      setState((prev) => ({ ...prev, isLoading: false, error: message }));
      return false;
    }
  }, []);

  const bindWallet = useCallback(
    async (
      walletAddress: string
    ): Promise<{ success: boolean; bindingId?: string; message?: string }> => {
      setState((prev) => ({
        ...prev,
        bindingInProgress: true,
        error: null,
      }));

      try {
        const response = await fetch('/api/admin/wallet/bind', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ wallet_address: walletAddress }),
          credentials: 'include',
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          setState((prev) => ({
            ...prev,
            bindingInProgress: false,
            error: result.error || 'Failed to bind wallet',
          }));
          return { success: false };
        }

        setState((prev) => ({
          ...prev,
          bindingInProgress: false,
          currentBindingId: result.binding?.id,
          error: null,
        }));

        return {
          success: true,
          bindingId: result.binding?.id,
          message: result.verificationMessage,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'An error occurred';
        setState((prev) => ({
          ...prev,
          bindingInProgress: false,
          error: message,
        }));
        return { success: false };
      }
    },
    []
  );

  const verifyWallet = useCallback(
    async (bindingId: string, signature: string, message: string): Promise<boolean> => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const response = await fetch('/api/admin/wallet/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            binding_id: bindingId,
            signature,
            message,
          }),
          credentials: 'include',
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            error: result.error || 'Failed to verify wallet',
          }));
          return false;
        }

        // Refresh wallets to get updated list
        await fetchWallets();

        setState((prev) => ({
          ...prev,
          isLoading: false,
          bindingInProgress: false,
          currentBindingId: null,
          error: null,
        }));

        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'An error occurred';
        setState((prev) => ({ ...prev, isLoading: false, error: message }));
        return false;
      }
    },
    [fetchWallets]
  );

  const setPrimaryWallet = useCallback(async (walletId: string): Promise<boolean> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch('/api/admin/wallet/list', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet_id: walletId }),
        credentials: 'include',
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: result.error || 'Failed to set primary wallet',
        }));
        return false;
      }

      // Refresh wallets
      await fetchWallets();

      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: null,
      }));

      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An error occurred';
      setState((prev) => ({ ...prev, isLoading: false, error: message }));
      return false;
    }
  }, [fetchWallets]);

  const unbindWallet = useCallback(
    async (walletId: string): Promise<boolean> => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const response = await fetch(`/api/admin/wallet/unbind?wallet_id=${walletId}`, {
          method: 'DELETE',
          credentials: 'include',
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            error: result.error || 'Failed to unbind wallet',
          }));
          return false;
        }

        // Refresh wallets
        await fetchWallets();

        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: null,
        }));

        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'An error occurred';
        setState((prev) => ({ ...prev, isLoading: false, error: message }));
        return false;
      }
    },
    [fetchWallets]
  );

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    fetchWallets,
    bindWallet,
    verifyWallet,
    setPrimaryWallet,
    unbindWallet,
    clearError,
  };
}
