'use client';

import { useState, useEffect, Suspense } from 'react';
import { ProtectedRoute } from '@/components/admin';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Loader2, AlertTriangle, Filter, Monitor, Globe, Clock } from 'lucide-react';

interface AuditLog {
  id: string;
  action: string;
  description: string;
  created_at: string;
  ip_address?: string;
  user_agent?: string;
}

const ACTION_COLORS: Record<string, string> = {
  login: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  logout: 'text-slate-400 bg-slate-500/10 border-slate-500/30',
  wallet_bind_initiated: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  wallet_verified: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
  ban_player: 'text-red-400 bg-red-500/10 border-red-500/30',
  unban_player: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  force_resolve: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
  refund: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
};

function ActionBadge({ action }: { action: string }) {
  const classes = ACTION_COLORS[action] || 'text-muted-foreground bg-muted/20 border-border/40';
  const label = action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return (
    <span className={`inline-flex text-xs font-semibold px-2 py-0.5 rounded-full border ${classes}`}>
      {label}
    </span>
  );
}

function AuditLogsContent() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const response = await fetch('/api/admin/audit-logs', { credentials: 'include' });
        if (!response.ok) throw new Error('Failed to fetch logs');
        const data = await response.json();
        setLogs(data.logs || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load audit logs');
      } finally {
        setIsLoading(false);
      }
    };
    fetchLogs();
  }, []);

  const filteredLogs = filter === 'all' ? logs : logs.filter((log) => log.action === filter);
  const actions = [...new Set(logs.map((log) => log.action))];

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-pink-500/20 to-pink-600/20 rounded-xl p-3 border border-pink-500/20">
              <Shield className="h-6 w-6 text-pink-400" />
            </div>
            <div>
              <h1 className="text-3xl font-gaming font-bold text-glow">Audit Logs</h1>
              <p className="text-muted-foreground text-sm">Account activity and security events</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-muted-foreground bg-card border border-border/50 px-3 py-1.5 rounded-lg">
            <Clock className="h-3.5 w-3.5" />
            Logs kept for 90 days
          </div>
        </motion.div>

        {/* Error */}
        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-xl flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </motion.div>
        )}

        {/* Filter bar */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="glass rounded-2xl p-4 border border-primary/20 flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Filter className="h-4 w-4" />
            <span className="font-medium">Filter:</span>
          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="bg-card border border-border/50 rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            <option value="all">All Actions ({logs.length})</option>
            {actions.map((action) => (
              <option key={action} value={action}>
                {action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
              </option>
            ))}
          </select>
          <span className="text-xs text-muted-foreground ml-auto">
            Showing <span className="font-semibold text-foreground">{filteredLogs.length}</span> entries
          </span>
        </motion.div>

        {/* Logs */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="glass rounded-2xl border border-primary/20 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-20 gap-3 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-sm">Loading audit logs...</span>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
              <Shield className="h-8 w-8 opacity-30" />
              <p className="text-sm">No audit logs found</p>
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              <AnimatePresence>
                {filteredLogs.map((log, i) => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.015 }}
                    className="p-5 hover:bg-card/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <ActionBadge action={log.action} />
                        {log.description && (
                          <span className="text-sm text-foreground">{log.description}</span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                    </div>
                    {(log.ip_address || log.user_agent) && (
                      <div className="flex flex-wrap gap-3 mt-2">
                        {log.ip_address && (
                          <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono bg-background/50 px-2 py-1 rounded-lg">
                            <Globe className="h-3 w-3" />
                            {log.ip_address}
                          </span>
                        )}
                        {log.user_agent && (
                          <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono bg-background/50 px-2 py-1 rounded-lg truncate max-w-xs">
                            <Monitor className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{log.user_agent}</span>
                          </span>
                        )}
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </motion.div>
      </div>
    </ProtectedRoute>
  );
}

export default function AuditLogsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <AuditLogsContent />
    </Suspense>
  );
}