'use client';

import { useEffect, useState } from 'react';
import { useAdminWallet } from '@/hooks/admin';

interface Wallet {
  id: string;
  wallet_address: string;
  is_primary: boolean;
  created_at: string;
}

export const WalletsList = () => {
  const { wallets, isLoading, error, fetchWallets, unbindWallet } = useAdminWallet();
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchWallets();
  }, []);

  const handleUnbind = async (walletId: string) => {
    if (!window.confirm('Are you sure you want to unbind this wallet?')) return;

    setDeleteLoading(walletId);
    try {
      const result = await unbindWallet(walletId);
      if (result) {
        fetchWallets(); // Refresh list
      }
    } finally {
      setDeleteLoading(null);
    }
  };

  if (isLoading) {
    return <div className="text-gray-600">Loading wallets...</div>;
  }

  if (error) {
    return <div className="text-red-600">Error: {error}</div>;
  }

  if (!wallets || wallets.length === 0) {
    return (
      <div className="text-center py-8 text-gray-600">
        No wallets bound yet. Bind your first wallet above.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {wallets.map((wallet: Wallet) => (
        <div key={wallet.id} className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-mono text-gray-900 truncate">
              {wallet.wallet_address}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Bound {new Date(wallet.created_at).toLocaleDateString()}
            </p>
            {wallet.is_primary && (
              <span className="inline-block mt-2 px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded">
                Primary
              </span>
            )}
          </div>

          <button
            onClick={() => handleUnbind(wallet.id)}
            disabled={deleteLoading === wallet.id}
            className="ml-4 px-3 py-1 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors disabled:text-gray-400"
          >
            {deleteLoading === wallet.id ? 'Removing...' : 'Remove'}
          </button>
        </div>
      ))}
    </div>
  );
};
