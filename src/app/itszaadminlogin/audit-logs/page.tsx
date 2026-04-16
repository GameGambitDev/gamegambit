'use client';

import { useState, useEffect, Suspense, useCallback } from 'react';
import { ProtectedRoute } from '@/components/admin';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, Loader2, AlertTriangle, Filter, Monitor, Globe, Clock,
  ChevronLeft, ChevronRight, RefreshCcw,
} from 'lucide-react';

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

const PAGE_SIZE = 25;

function ActionBadge({ action }: { action: string | undefined | null }) {
  const safeAction = action ?? '';
  const classes = ACTION_COLORS[safeAction] || 'text-muted-foreground bg-muted/20 border-border/40';
  const label = safeAction.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || 'Unknown';
  return (
    <span className={`inline-flex text-xs font-semibold px-2 py-0.5 rounded-full border ${classes}`}>
      {label}
    </span>
  );
}

function PaginationBar({
  page, totalPages, onPrev, onNext, disabled,
}: {
  page: number; totalPages: number; onPrev: () => void; onNext: () => void; disabled: boolean;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-5 py-3 border-t border-border/30">
      <span className="text-xs text-muted-foreground">
        Page <span className="font-semibold text-foreground">{page}</span> of{' '}
        <span className="font-semibold text-foreground">{totalPages}</span>
      </span>
      <div className="flex gap-2">
        <button
          onClick={onPrev}
          disabled={disabled || page <= 1}
          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-card border border-border/50 hover:border-primary/40 rounded-lg text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Prev
        </button>
        <button
          onClick={onNext}
          disabled={disabled || page >= totalPages}
          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-card border border-border/50 hover:border-primary/40 rounded-lg text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Next
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function AuditLogsContent() {
  const [allLogs, setAllLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);

  const loadLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/audit-logs', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch logs');
      const data = await response.json();
      setAllLogs(data.logs || []);
      setPage(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit logs');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  // Reset page when filter changes
  useEffect(() => { setPage(1); }, [filter]);

  const filteredLogs = filter === 'all' ? allLogs : allLogs.filter((l) => l.action === filter);
  const actions = [...new Set(allLogs.map((l) => l.action).filter(Boolean))] as string[];
  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));
  const pageLogs = filteredLogs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-muted-foreground bg-card border border-border/50 px-3 py-1.5 rounded-lg">
              <Clock className="h-3.5 w-3.5" />
              Logs kept 90 days
            </div>
            <button
              onClick={loadLogs}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-card border border-border/50 hover:border-primary/40 rounded-xl text-sm text-foreground transition-colors disabled:opacity-50"
            >
              <RefreshCcw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
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
          className="glass rounded-2xl p-4 border border-primary/20 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Filter className="h-4 w-4" />
            <span className="font-medium">Filter:</span>
          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="bg-card border border-border/50 rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">All Actions ({allLogs.length})</option>
            {actions.map((action) => (
              <option key={action} value={action}>
                {action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              </option>
            ))}
          </select>
          <span className="text-xs text-muted-foreground ml-auto">
            <span className="font-semibold text-foreground">{filteredLogs.length}</span> entries
            {totalPages > 1 && (
              <> · page <span className="font-semibold text-foreground">{page}</span>/{totalPages}</>
            )}
          </span>
        </motion.div>

        {/* Logs table */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="glass rounded-2xl border border-primary/20 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-20 gap-3 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-sm">Loading audit logs...</span>
            </div>
          ) : pageLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
              <Shield className="h-8 w-8 opacity-30" />
              <p className="text-sm">No audit logs found</p>
            </div>
          ) : (
            <>
              <div className="divide-y divide-border/30">
                <AnimatePresence mode="popLayout">
                  {pageLogs.map((log, i) => (
                    <motion.div
                      key={log.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.01 }}
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
                              <Globe className="h-3 w-3" />{log.ip_address}
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
              <PaginationBar
                page={page}
                totalPages={totalPages}
                onPrev={() => setPage((p) => p - 1)}
                onNext={() => setPage((p) => p + 1)}
                disabled={isLoading}
              />
            </>
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