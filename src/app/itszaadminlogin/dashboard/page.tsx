'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { ProtectedRoute, ProfileCard } from '@/components/admin';
import { useAdminSession } from '@/hooks/admin';
import { motion } from 'framer-motion';
import { Users, Dices, Scale, Wallet, Settings, Shield, AlertTriangle } from 'lucide-react';

function DashboardContent() {
  const { session } = useAdminSession();

  const managementCards = [
    {
      title: 'Users',
      description: 'View and manage all users',
      href: '/itszaadminlogin/users',
      icon: Users,
      color: 'from-blue-500/20 to-blue-600/20',
      borderColor: 'border-blue-500/30',
    },
    {
      title: 'Wagers',
      description: 'Manage all active wagers',
      href: '/itszaadminlogin/wagers',
      icon: Dices,
      color: 'from-purple-500/20 to-purple-600/20',
      borderColor: 'border-purple-500/30',
    },
    {
      title: 'Disputes',
      description: 'Resolve disputes and contested wagers',
      href: '/itszaadminlogin/disputes',
      icon: Scale,
      color: 'from-orange-500/20 to-orange-600/20',
      borderColor: 'border-orange-500/30',
    },
    {
      title: 'Stuck Wagers',
      description: 'Funds locked on-chain with no resolution',
      href: '/itszaadminlogin/stuck-wagers',
      icon: AlertTriangle,
      color: 'from-amber-500/20 to-yellow-600/20',
      borderColor: 'border-amber-500/30',
    },
    {
      title: 'Wallet',
      description: 'Manage wallet bindings',
      href: '/itszaadminlogin/wallet-bindings',
      icon: Wallet,
      color: 'from-green-500/20 to-green-600/20',
      borderColor: 'border-green-500/30',
    },
    {
      title: 'Profile',
      description: 'Admin profile settings',
      href: '/itszaadminlogin/profile',
      icon: Settings,
      color: 'from-cyan-500/20 to-cyan-600/20',
      borderColor: 'border-cyan-500/30',
    },
    {
      title: 'Audit Logs',
      description: 'View activity and security logs',
      href: '/itszaadminlogin/audit-logs',
      icon: Shield,
      color: 'from-pink-500/20 to-pink-600/20',
      borderColor: 'border-pink-500/30',
    },
  ];

  return (
    <ProtectedRoute>
      <div className="space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-gaming font-bold text-glow mb-2">Admin Dashboard</h1>
          <p className="text-muted-foreground">Welcome back, {session?.user.email}</p>
        </motion.div>

        {/* Profile Card */}
        <ProfileCard />

        {/* Stats Grid */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          <div className="glass rounded-2xl p-6 border border-primary/20">
            <p className="text-muted-foreground text-sm font-medium mb-2">Role</p>
            <p className="text-2xl font-gaming font-bold text-primary capitalize">{session?.user.role || 'Admin'}</p>
          </div>

          <div className="glass rounded-2xl p-6 border border-primary/20">
            <p className="text-muted-foreground text-sm font-medium mb-2">Session Status</p>
            <p className="text-sm text-success">Active & Secure</p>
          </div>

          <div className="glass rounded-2xl p-6 border border-primary/20">
            <p className="text-muted-foreground text-sm font-medium mb-2">Last Active</p>
            <p className="text-xs text-muted-foreground">
              {session?.expiresAt
                ? `Expires ${new Date(session.expiresAt).toLocaleTimeString()}`
                : 'Now'}
            </p>
          </div>
        </motion.div>

        {/* Management Cards Grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="space-y-4"
        >
          <h2 className="text-2xl font-gaming font-bold">Management</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {managementCards.map((card, idx) => {
              const Icon = card.icon;
              return (
                <motion.div
                  key={card.href}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + idx * 0.05 }}
                  whileHover={{ translateY: -4 }}
                >
                  <Link
                    href={card.href}
                    className={`glass rounded-2xl p-6 border transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 group block h-full`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className={`bg-gradient-to-br ${card.color} rounded-xl p-3 group-hover:scale-110 transition-transform`}>
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                    </div>
                    <h3 className="text-lg font-gaming font-bold text-foreground mb-1">{card.title}</h3>
                    <p className="text-sm text-muted-foreground">{card.description}</p>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </ProtectedRoute>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="text-center py-12 text-muted-foreground">Loading dashboard...</div>}>
      <DashboardContent />
    </Suspense>
  );
}