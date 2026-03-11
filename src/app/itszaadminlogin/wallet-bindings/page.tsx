'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { ProtectedRoute, WalletBindForm, WalletsList } from '@/components/admin';

function WalletBindingsContent() {
  return (
    <ProtectedRoute>
      <div className="max-w-3xl">
        <Link href="/itszaadminlogin/dashboard" className="text-blue-600 hover:text-blue-700 mb-6 inline-block">
          ← Back to Dashboard
        </Link>

        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Wallet Bindings</h1>
            <p className="text-gray-600 mt-2">Connect and manage your Solana wallets for enhanced security</p>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <WalletBindForm />

              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Wallets</h3>
                <WalletsList />
              </div>
            </div>

            <div className="bg-blue-50 rounded-lg p-6 border border-blue-200 h-fit">
              <h3 className="text-lg font-semibold text-blue-900 mb-4">How It Works</h3>
              <ol className="text-sm text-blue-800 space-y-3">
                <li>
                  <span className="font-semibold">1.</span> Enter your Solana wallet address
                </li>
                <li>
                  <span className="font-semibold">2.</span> Sign the verification message in your wallet
                </li>
                <li>
                  <span className="font-semibold">3.</span> Wallet is now bound to your account
                </li>
                <li>
                  <span className="font-semibold">4.</span> Use wallet to access additional admin features
                </li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

export const metadata = {
  title: 'Wallet Bindings - Admin Dashboard',
  description: 'Manage your Solana wallet bindings',
};

export default function WalletBindingsPage() {
  return (
    <Suspense fallback={<div className="text-center py-12">Loading wallet bindings...</div>}>
      <WalletBindingsContent />
    </Suspense>
  );
}
