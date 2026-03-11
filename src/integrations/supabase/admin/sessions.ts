// Supabase admin session operations
import { createClient } from '@supabase/supabase-js';
import { AdminSession } from '@/types/admin';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

/**
 * Get all active sessions for an admin
 */
export async function getAdminSessions(adminId: string): Promise<{
  success: boolean;
  sessions?: AdminSession[];
  error?: string;
}> {
  try {
    const { data: sessions, error } = await supabase
      .from('admin_sessions')
      .select('*')
      .eq('admin_id', adminId)
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, sessions: sessions as AdminSession[] };
  } catch (e) {
    console.error('Error fetching sessions:', e);
    return { success: false, error: 'Failed to fetch sessions' };
  }
}

/**
 * Get a specific session
 */
export async function getSession(sessionId: string): Promise<{
  success: boolean;
  session?: AdminSession;
  error?: string;
}> {
  try {
    const { data: session, error } = await supabase
      .from('admin_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error || !session) {
      return { success: false, error: 'Session not found' };
    }

    return { success: true, session: session as AdminSession };
  } catch (e) {
    console.error('Error fetching session:', e);
    return { success: false, error: 'Failed to fetch session' };
  }
}

/**
 * Invalidate a session
 */
export async function invalidateSession(sessionId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { error } = await supabase
      .from('admin_sessions')
      .update({ is_active: false })
      .eq('id', sessionId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (e) {
    console.error('Error invalidating session:', e);
    return { success: false, error: 'Failed to invalidate session' };
  }
}

/**
 * Invalidate all sessions for an admin
 */
export async function invalidateAllAdminSessions(adminId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { error } = await supabase
      .from('admin_sessions')
      .update({ is_active: false })
      .eq('admin_id', adminId)
      .eq('is_active', true);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (e) {
    console.error('Error invalidating all sessions:', e);
    return { success: false, error: 'Failed to invalidate sessions' };
  }
}

/**
 * Cleanup expired sessions
 */
export async function cleanupExpiredSessions(): Promise<{
  success: boolean;
  deletedCount?: number;
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from('admin_sessions')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .select();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, deletedCount: data?.length || 0 };
  } catch (e) {
    console.error('Error cleaning up sessions:', e);
    return { success: false, error: 'Failed to cleanup sessions' };
  }
}

/**
 * Update session activity
 */
export async function updateSessionActivity(sessionId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { error } = await supabase
      .from('admin_sessions')
      .update({ last_activity: new Date().toISOString() })
      .eq('id', sessionId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (e) {
    console.error('Error updating session activity:', e);
    return { success: false, error: 'Failed to update session' };
  }
}

/**
 * Get session by token hash
 */
export async function getSessionByTokenHash(tokenHash: string): Promise<{
  success: boolean;
  session?: AdminSession;
  error?: string;
}> {
  try {
    const { data: session, error } = await supabase
      .from('admin_sessions')
      .select('*')
      .eq('token_hash', tokenHash)
      .single();

    if (error || !session) {
      return { success: false, error: 'Session not found' };
    }

    return { success: true, session: session as AdminSession };
  } catch (e) {
    console.error('Error fetching session:', e);
    return { success: false, error: 'Failed to fetch session' };
  }
}

/**
 * Get session statistics
 */
export async function getSessionStats(adminId: string): Promise<{
  success: boolean;
  stats?: {
    activeCount: number;
    totalCount: number;
    lastActivity?: string;
  };
  error?: string;
}> {
  try {
    const { count: activeCount } = await supabase
      .from('admin_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('admin_id', adminId)
      .eq('is_active', true);

    const { count: totalCount } = await supabase
      .from('admin_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('admin_id', adminId);

    const { data: latestSession } = await supabase
      .from('admin_sessions')
      .select('last_activity')
      .eq('admin_id', adminId)
      .order('last_activity', { ascending: false })
      .limit(1)
      .single();

    return {
      success: true,
      stats: {
        activeCount: activeCount || 0,
        totalCount: totalCount || 0,
        lastActivity: latestSession?.last_activity,
      },
    };
  } catch (e) {
    console.error('Error getting session stats:', e);
    return { success: false, error: 'Failed to get stats' };
  }
}
