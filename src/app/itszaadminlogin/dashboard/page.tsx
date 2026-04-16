'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { ProtectedRoute, ProfileCard } from '@/components/admin';
import { useAdminSession } from '@/hooks/admin';
import { motion } from 'framer-motion';
import {
  Users, Dices, Scale, Wallet, Settings, Shield, AlertTriangle,
  Flag, PenLine, Link2, TrendingUp, Loader2, RefreshCcw,
} from 'lucide-react';
import { getSupabaseClient } from '@/integrations/supabase/client';

interface LiveStats {
  totalUsers: number;
  activeWagers: number;
  openDisputes: number;
  stuckWagers: number;
  pendingAppeals: number;
  pendingChanges: number;
  highRiskFlags: number;
}

function StatPill({
  value,
  label,
  color = 'text-primary',
  urgent = false,
}: {
  value: number | string;
  label: string;
  color?: string;
  urgent?: boolean;
}) {
  return (
    <div className={`glass rounded-2xl p-5 border ${urgent && Number(value) > 0 ? 'border-red-500/40' : 'border-primary/20'} flex flex-col gap-1`}>
      <p className={`text-2xl font-gaming font-bold ${color}`}>
        {value === -1 ? <Loader2 className="h-5 w-5 animate-spin opacity-50" /> : value}
      </p>
      <p className="text-xs text-muted-foreground font-medium">{label}</p>
    </div>
  );
}

function useLiveStats() {
  const [stats, setStats] = useState<LiveStats>({
    totalUsers: -1,
    activeWagers: -1,
    openDisputes: -1,
    stuckWagers: -1,
    pendingAppeals: -1,
    pendingChanges: -1,
    highRiskFlags: -1,
  });
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    setLoading(true);
    const supabase = getSupabaseClient();

    const cutoff2h = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    const [
      usersRes,
      activeWagersRes,
      disputesRes,
      stuckRes,
      appealsRes,
      changesRes,
      flagsRes,
    ] = await Promise.allSettled([
      supabase.from('players').select('*', { count: 'exact', head: true }),
      supabase.from('wagers').select('*', { count: 'exact', head: true }).in('status', ['created', 'joined', 'voting', 'retractable'] as any),
      supabase.from('wagers').select('*', { count: 'exact', head: true }).eq('status', 'disputed'),
      supabase.from('wagers').select('*', { count: 'exact', head: true })
        .eq('deposit_player_a', true).eq('deposit_player_b', true)
        .not('status', 'in', '("resolved","cancelled")').lt('created_at', cutoff2h),
      (supabase.from('username_appeals' as any).select('*', { count: 'exact', head: true }) as any)
        .not('status', 'in', '("released","rejected","resolved")'),
      (supabase.from('username_change_requests' as any).select('*', { count: 'exact', head: true }) as any)
        .eq('status', 'pending'),
      supabase.from('player_behaviour_log').select('player_wallet').limit(500),
    ]);

    // compute high-risk flags (risk score >= 8) from behaviour log
    let highRiskFlags = 0;
    if (flagsRes.status === 'fulfilled' && flagsRes.value.data) {
      const EVENT_WEIGHTS: Record<string, number> = {
        false_vote: 2, dispute_loss: 1, moderator_reported: 3,
        suspicious_pattern: 2, account_flagged: 4,
      };
      const walletCounts = new Map<string, number>();
      for (const row of (flagsRes.value.data as any[])) {
        const w = walletCounts.get(row.player_wallet) ?? 0;
        walletCounts.set(row.player_wallet, w + (EVENT_WEIGHTS[row.event_type] ?? 1));
      }
      highRiskFlags = [...walletCounts.values()].filter((s) => s >= 8).length;
    }

    setStats({
      totalUsers: usersRes.status === 'fulfilled' ? (usersRes.value.count ?? 0) : 0,
      activeWagers: activeWagersRes.status === 'fulfilled' ? (activeWagersRes.value.count ?? 0) : 0,
      openDisputes: disputesRes.status === 'fulfilled' ? (disputesRes.value.count ?? 0) : 0,
      stuckWagers: stuckRes.status === 'fulfilled' ? (stuckRes.value.count ?? 0) : 0,
      pendingAppeals: appealsRes.status === 'fulfilled' ? ((appealsRes.value as any).count ?? 0) : 0,
      pendingChanges: changesRes.status === 'fulfilled' ? ((changesRes.value as any).count ?? 0) : 0,
      highRiskFlags,
    });
    setLoading(false);
  };

  useEffect(() => { fetch(); }, []);

  return { stats, loading, refresh: fetch };
}

const NAV_CARDS = [
  { title: 'Users', description: 'View and manage all users', href: '/itszaadminlogin/users', icon: Users, color: 'from-blue-500/20 to-blue-600/20', border: 'border-blue-500/30' },
  { title: 'Wagers', description: 'Manage all active wagers', href: '/itszaadminlogin/wagers', icon: Dices, color: 'from-purple-500/20 to-purple-600/20', border: 'border-purple-500/30' },
  { title: 'Disputes', description: 'Resolve disputes and contested wagers', href: '/itszaadminlogin/disputes', icon: Scale, color: 'from-orange-500/20 to-orange-600/20', border: 'border-orange-500/30' },
  { title: 'Stuck Wagers', description: 'Funds locked on-chain with no resolution', href: '/itszaadminlogin/stuck-wagers', icon: AlertTriangle, color: 'from-amber-500/20 to-yellow-600/20', border: 'border-amber-500/30' },
  { title: 'Username Appeals', description: 'Review username ownership disputes', href: '/itszaadminlogin/username-appeals', icon: Link2, color: 'from-pink-500/20 to-pink-600/20', border: 'border-pink-500/30' },
  { title: 'Username Changes', description: 'Approve or reject change requests', href: '/itszaadminlogin/username-changes', icon: PenLine, color: 'from-violet-500/20 to-violet-600/20', border: 'border-violet-500/30' },
  { title: 'Behaviour Flags', description: 'Monitor suspicious player activity', href: '/itszaadminlogin/behaviour-flags', icon: Flag, color: 'from-red-500/20 to-rose-600/20', border: 'border-red-500/30' },
  { title: 'Wallet', description: 'Manage wallet bindings', href: '/itszaadminlogin/wallet-bindings', icon: Wallet, color: 'from-green-500/20 to-green-600/20', border: 'border-green-500/30' },
  { title: 'Profile', description: 'Admin profile settings', href: '/itszaadminlogin/profile', icon: Settings, color: 'from-cyan-500/20 to-cyan-600/20', border: 'border-cyan-500/30' },
  { title: 'Audit Logs', description: 'View activity and security logs', href: '/itszaadminlogin/audit-logs', icon: Shield, color: 'from-slate-500/20 to-slate-600/20', border: 'border-slate-500/30' },
];

function DashboardContent() {
  const { session } = useAdminSession();
  const { stats, loading, refresh } = useLiveStats();

  return (
    <ProtectedRoute>
      <div className="space-y-8">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-gaming font-bold text-glow mb-1">Admin Dashboard</h1>
            <p className="text-muted-foreground text-sm">Welcome back, {session?.user.email}</p>
          </div>
          <button
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-card border border-border/50 hover:border-primary/40 rounded-xl text-sm text-foreground transition-colors disabled:opacity-50"
          >
            <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </motion.div>

        {/* Profile */}
        <ProfileCard />

        {/* Live stats */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Live Overview</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            <StatPill value={stats.totalUsers === -1 ? -1 : stats.totalUsers} label="Total Users" color="text-blue-400" />
            <StatPill value={stats.activeWagers === -1 ? -1 : stats.activeWagers} label="Active Wagers" color="text-purple-400" />
            <StatPill value={stats.openDisputes === -1 ? -1 : stats.openDisputes} label="Open Disputes" color={stats.openDisputes > 0 ? 'text-amber-400' : 'text-muted-foreground'} urgent={stats.openDisputes > 0} />
            <StatPill value={stats.stuckWagers === -1 ? -1 : stats.stuckWagers} label="Stuck Wagers" color={stats.stuckWagers > 0 ? 'text-red-400' : 'text-muted-foreground'} urgent={stats.stuckWagers > 0} />
            <StatPill value={stats.pendingAppeals === -1 ? -1 : stats.pendingAppeals} label="Pending Appeals" color={stats.pendingAppeals > 0 ? 'text-pink-400' : 'text-muted-foreground'} />
            <StatPill value={stats.pendingChanges === -1 ? -1 : stats.pendingChanges} label="Name Changes" color={stats.pendingChanges > 0 ? 'text-violet-400' : 'text-muted-foreground'} />
            <StatPill value={stats.highRiskFlags === -1 ? -1 : stats.highRiskFlags} label="High Risk Flags" color={stats.highRiskFlags > 0 ? 'text-red-400' : 'text-muted-foreground'} urgent={stats.highRiskFlags > 0} />
          </div>
        </motion.div>

        {/* Session info */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="grid sm:grid-cols-3 gap-3">
          <div className="glass rounded-2xl p-5 border border-primary/20">
            <p className="text-muted-foreground text-xs font-medium mb-1.5">Role</p>
            <p className="text-lg font-gaming font-bold text-primary capitalize">{session?.user.role || 'Admin'}</p>
          </div>
          <div className="glass rounded-2xl p-5 border border-primary/20">
            <p className="text-muted-foreground text-xs font-medium mb-1.5">Session</p>
            <p className="text-sm text-success font-semibold">Active & Secure</p>
          </div>
          <div className="glass rounded-2xl p-5 border border-primary/20">
            <p className="text-muted-foreground text-xs font-medium mb-1.5">Expires</p>
            <p className="text-xs text-muted-foreground">
              {session?.expiresAt ? new Date(session.expiresAt).toLocaleTimeString() : '—'}
            </p>
          </div>
        </motion.div>

        {/* Nav cards */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
          <h2 className="text-xl font-gaming font-bold mb-3">Management</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {NAV_CARDS.map((card, idx) => {
              const Icon = card.icon;
              return (
                <motion.div
                  key={card.href}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 + idx * 0.04 }}
                  whileHover={{ translateY: -3 }}
                >
                  <Link
                    href={card.href}
                    className="glass rounded-2xl p-5 border border-primary/20 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 group block h-full transition-all"
                  >
                    <div className={`bg-gradient-to-br ${card.color} rounded-xl p-2.5 w-fit mb-3 group-hover:scale-110 transition-transform`}>
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="text-sm font-gaming font-bold text-foreground mb-0.5">{card.title}</h3>
                    <p className="text-xs text-muted-foreground">{card.description}</p>
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
    <Suspense fallback={
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}