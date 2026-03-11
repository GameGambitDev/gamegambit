'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { ProtectedRoute, ProfileCard } from '@/components/admin';
import { useAdminSession } from '@/hooks/admin';

function DashboardContent() {
  const { session, logout } = useAdminSession();

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-gray-600 mt-2">Welcome back, {session?.user.email}</p>
          </div>
          <button
            onClick={logout}
            className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            Sign Out
          </button>
        </div>

        {/* Profile Card */}
        <ProfileCard />

        {/* Navigation Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link
            href="/itszaadminlogin/profile"
            className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Profile Settings</h3>
            <p className="text-gray-600 text-sm">Manage your profile information and preferences</p>
          </Link>

          <Link
            href="/itszaadminlogin/wallet-bindings"
            className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Wallet Bindings</h3>
            <p className="text-gray-600 text-sm">Connect and manage your Solana wallets</p>
          </Link>

          <Link
            href="/itszaadminlogin/audit-logs"
            className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Audit Logs</h3>
            <p className="text-gray-600 text-sm">View your activity and security logs</p>
          </Link>
        </div>

        {/* Quick Stats */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
            <p className="text-blue-900 text-sm font-medium">Account Status</p>
            <p className="text-2xl font-bold text-blue-600 mt-2 capitalize">{session?.user.role}</p>
          </div>

          <div className="bg-green-50 rounded-lg p-6 border border-green-200">
            <p className="text-green-900 text-sm font-medium">Last Active</p>
            <p className="text-gray-600 mt-2">
              {session?.expiresAt
                ? `Session expires ${new Date(session.expiresAt).toLocaleString()}`
                : 'Loading...'}
            </p>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

export const metadata = {
  title: 'Admin Dashboard - Game Gambit',
  description: 'Game Gambit admin control panel',
};

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="text-center py-12">Loading dashboard...</div>}>
      <DashboardContent />
    </Suspense>
  );
}
