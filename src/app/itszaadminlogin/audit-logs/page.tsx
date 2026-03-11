'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { ProtectedRoute } from '@/components/admin';

interface AuditLog {
  id: string;
  action: string;
  description: string;
  created_at: string;
  ip_address?: string;
  user_agent?: string;
}

function AuditLogsContent() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const response = await fetch('/api/admin/audit-logs', {
          credentials: 'include',
        });

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
      <div className="max-w-4xl">
        <Link href="/itszaadminlogin/dashboard" className="text-blue-600 hover:text-blue-700 mb-6 inline-block">
          ← Back to Dashboard
        </Link>

        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Audit Logs</h1>
            <p className="text-gray-600 mt-2">All your account activities and security events</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>
          )}

          <div className="bg-white rounded-lg shadow">
            {/* Filter */}
            <div className="border-b border-gray-200 p-6">
              <label className="text-sm font-medium text-gray-700 mr-4">Filter by action:</label>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Actions</option>
                {actions.map((action) => (
                  <option key={action} value={action}>
                    {action}
                  </option>
                ))}
              </select>
            </div>

            {/* Logs List */}
            <div>
              {isLoading ? (
                <div className="p-6 text-center text-gray-600">Loading audit logs...</div>
              ) : filteredLogs.length === 0 ? (
                <div className="p-6 text-center text-gray-600">No audit logs found</div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {filteredLogs.map((log) => (
                    <div key={log.id} className="p-6 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900">{log.action}</p>
                          <p className="text-sm text-gray-600 mt-1">{log.description}</p>
                        </div>
                        <span className="text-xs text-gray-500 whitespace-nowrap ml-4">
                          {new Date(log.created_at).toLocaleString()}
                        </span>
                      </div>
                      {(log.ip_address || log.user_agent) && (
                        <div className="text-xs text-gray-500 mt-2 font-mono">
                          {log.ip_address && <p>IP: {log.ip_address}</p>}
                          {log.user_agent && <p className="truncate">Agent: {log.user_agent}</p>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <span className="font-semibold">Showing {filteredLogs.length}</span> audit log entries. Logs are kept for 90
              days.
            </p>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}


export default function AuditLogsPage() {
  return (
    <Suspense fallback={<div className="text-center py-12">Loading audit logs...</div>}>
      <AuditLogsContent />
    </Suspense>
  );
}
