// Supabase admin audit logging operations
import { createClient } from '@supabase/supabase-js';
import { AdminAuditLog, AdminAuditLogQuery } from '@/types/admin';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

/**
 * Log an admin action
 */
export async function logAdminAction(
  adminId: string,
  actionType: string,
  resourceType: string,
  resourceId?: string,
  oldValues?: Record<string, any>,
  newValues?: Record<string, any>,
  ipAddress?: string,
  userAgent?: string
): Promise<{
  success: boolean;
  log?: AdminAuditLog;
  error?: string;
}> {
  try {
    const { data: log, error } = await supabase
      .from('admin_audit_logs')
      .insert({
        admin_id: adminId,
        action_type: actionType,
        resource_type: resourceType,
        resource_id: resourceId || null,
        old_values: oldValues || null,
        new_values: newValues || null,
        ip_address: ipAddress || null,
        user_agent: userAgent || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error logging action:', error);
      return { success: false, error: error.message };
    }

    return { success: true, log: log as AdminAuditLog };
  } catch (e) {
    console.error('Error in logAdminAction:', e);
    return { success: false, error: 'Failed to log action' };
  }
}

/**
 * Get audit logs with optional filters
 */
export async function getAuditLogs(query?: AdminAuditLogQuery): Promise<{
  success: boolean;
  logs?: AdminAuditLog[];
  total?: number;
  error?: string;
}> {
  try {
    let q = supabase.from('admin_audit_logs').select('*', { count: 'exact' });

    // Apply filters
    if (query?.action_type) {
      q = q.eq('action_type', query.action_type);
    }

    if (query?.resource_type) {
      q = q.eq('resource_type', query.resource_type);
    }

    if (query?.resource_id) {
      q = q.eq('resource_id', query.resource_id);
    }

    if (query?.start_date) {
      q = q.gte('created_at', query.start_date);
    }

    if (query?.end_date) {
      q = q.lte('created_at', query.end_date);
    }

    // Pagination
    const offset = query?.offset || 0;
    const limit = Math.min(query?.limit || 50, 1000); // Max 1000 per request
    q = q.range(offset, offset + limit - 1);

    // Order
    q = q.order('created_at', { ascending: false });

    const { data: logs, error, count } = await q;

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, logs: logs as AdminAuditLog[], total: count || 0 };
  } catch (e) {
    console.error('Error fetching audit logs:', e);
    return { success: false, error: 'Failed to fetch logs' };
  }
}

/**
 * Get audit logs for a specific admin
 */
export async function getAdminAuditLogs(
  adminId: string,
  limit = 50,
  offset = 0
): Promise<{
  success: boolean;
  logs?: AdminAuditLog[];
  total?: number;
  error?: string;
}> {
  try {
    const { data: logs, error, count } = await supabase
      .from('admin_audit_logs')
      .select('*', { count: 'exact' })
      .eq('admin_id', adminId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, logs: logs as AdminAuditLog[], total: count || 0 };
  } catch (e) {
    console.error('Error fetching admin logs:', e);
    return { success: false, error: 'Failed to fetch logs' };
  }
}

/**
 * Get audit logs for a specific resource
 */
export async function getResourceAuditLogs(
  resourceType: string,
  resourceId: string,
  limit = 50
): Promise<{
  success: boolean;
  logs?: AdminAuditLog[];
  error?: string;
}> {
  try {
    const { data: logs, error } = await supabase
      .from('admin_audit_logs')
      .select('*')
      .eq('resource_type', resourceType)
      .eq('resource_id', resourceId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, logs: logs as AdminAuditLog[] };
  } catch (e) {
    console.error('Error fetching resource logs:', e);
    return { success: false, error: 'Failed to fetch logs' };
  }
}

/**
 * Get action statistics
 */
export async function getActionStats(startDate?: string, endDate?: string): Promise<{
  success: boolean;
  stats?: Record<string, number>;
  error?: string;
}> {
  try {
    let q = supabase.from('admin_audit_logs').select('action_type');

    if (startDate) {
      q = q.gte('created_at', startDate);
    }

    if (endDate) {
      q = q.lte('created_at', endDate);
    }

    const { data: logs, error } = await q;

    if (error) {
      return { success: false, error: error.message };
    }

    // Count actions
    const stats: Record<string, number> = {};
    logs?.forEach((log: any) => {
      stats[log.action_type] = (stats[log.action_type] || 0) + 1;
    });

    return { success: true, stats };
  } catch (e) {
    console.error('Error getting stats:', e);
    return { success: false, error: 'Failed to get stats' };
  }
}

/**
 * Search audit logs
 */
export async function searchAuditLogs(
  query: string,
  limit = 50
): Promise<{
  success: boolean;
  logs?: AdminAuditLog[];
  error?: string;
}> {
  try {
    // Search across action_type and resource_type
    const { data: logs, error } = await supabase
      .from('admin_audit_logs')
      .select('*')
      .or(`action_type.ilike.%${query}%,resource_type.ilike.%${query}%,resource_id.ilike.%${query}%`)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, logs: logs as AdminAuditLog[] };
  } catch (e) {
    console.error('Error searching logs:', e);
    return { success: false, error: 'Failed to search logs' };
  }
}

/**
 * Export audit logs to CSV
 */
export async function exportAuditLogs(query?: AdminAuditLogQuery): Promise<{
  success: boolean;
  csv?: string;
  error?: string;
}> {
  try {
    const result = await getAuditLogs(query);
    if (!result.success || !result.logs) {
      return { success: false, error: result.error };
    }

    // Convert to CSV
    const headers = [
      'ID',
      'Admin ID',
      'Action Type',
      'Resource Type',
      'Resource ID',
      'Created At',
    ];
    const rows = result.logs.map((log) => [
      log.id,
      log.admin_id || '',
      log.action_type,
      log.resource_type,
      log.resource_id || '',
      log.created_at,
    ]);

    const csv = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    return { success: true, csv };
  } catch (e) {
    console.error('Error exporting logs:', e);
    return { success: false, error: 'Failed to export logs' };
  }
}
