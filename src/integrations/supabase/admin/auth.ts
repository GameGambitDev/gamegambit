// Supabase admin authentication operations
import { getSupabaseClient } from '@/integrations/supabase/client';
import { AdminUser, AdminSignupRequest, AdminLoginRequest } from '@/types/admin';
import { hashPassword, verifyPassword } from '@/lib/admin/password';
import { hashToken, generateToken, getTokenExpiry } from '@/lib/admin/auth';

const supabase = getSupabaseClient();

/**
 * Create a new admin user (signup)
 */
export async function createAdminUser(
  data: AdminSignupRequest
): Promise<{
  success: boolean;
  admin?: AdminUser;
  token?: string;
  error?: string;
}> {
  try {
    // Hash password
    const passwordHash = await hashPassword(data.password);

    // Create admin user
    const { data: admin, error } = await supabase
      .from('admin_users')
      .insert({
        email: data.email.toLowerCase(),
        password_hash: passwordHash,
        full_name: data.full_name || null,
        username: data.username || null,
        role: 'moderator', // Default role
        permissions: {},
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating admin user:', error);
      if (error.code === '23505') {
        return { success: false, error: 'Email already registered' };
      }
      return { success: false, error: error.message };
    }

    // Generate token
    const token = generateToken(admin.id, admin.email, admin.role);
    const tokenHash = hashToken(token);

    // Create session
    await supabase.from('admin_sessions').insert({
      admin_id: admin.id,
      token_hash: tokenHash,
      expires_at: getTokenExpiry().toISOString(),
      is_active: true,
    });

    return {
      success: true,
      admin: admin as unknown as AdminUser,
      token,
    };
  } catch (e) {
    console.error('Error in createAdminUser:', e);
    return { success: false, error: 'Failed to create admin user' };
  }
}

/**
 * Authenticate admin user (login)
 */
export async function authenticateAdminUser(
  data: AdminLoginRequest
): Promise<{
  success: boolean;
  admin?: AdminUser;
  token?: string;
  error?: string;
}> {
  try {
    // Get admin by email
    const { data: admin, error } = await supabase
      .from('admin_users')
      .select('*')
      .eq('email', data.email.toLowerCase())
      .single();

    if (error || !admin) {
      return { success: false, error: 'Invalid email or password' };
    }

    // Check if admin is active
    if (!admin.is_active) {
      return { success: false, error: 'Admin account is inactive' };
    }

    if (admin.is_banned) {
      return { success: false, error: `Admin account is banned: ${admin.ban_reason || 'No reason provided'}` };
    }

    // Verify password
    const passwordValid = await verifyPassword(data.password, admin.password_hash);
    if (!passwordValid) {
      return { success: false, error: 'Invalid email or password' };
    }

    // Generate token
    const token = generateToken(admin.id, admin.email, admin.role);
    const tokenHash = hashToken(token);

    // Create session
    await supabase.from('admin_sessions').insert({
      admin_id: admin.id,
      token_hash: tokenHash,
      expires_at: getTokenExpiry().toISOString(),
      is_active: true,
    });

    // Update last login
    await supabase
      .from('admin_users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', admin.id);

    return {
      success: true,
      admin: admin as unknown as AdminUser,
      token,
    };
  } catch (e) {
    console.error('Error authenticating admin:', e);
    return { success: false, error: 'Authentication failed' };
  }
}

/**
 * Verify admin session
 */
export async function verifyAdminSession(tokenHash: string): Promise<{
  valid: boolean;
  admin?: AdminUser;
  expiresAt?: string;
  error?: string;
}> {
  try {
    // Get session
    const { data: session, error } = await supabase
      .from('admin_sessions')
      .select('*, admin_users(*)')
      .eq('token_hash', tokenHash)
      .single();

    if (error || !session) {
      return { valid: false, error: 'Session not found' };
    }

    // Check if session is active and not expired
    if (!session.is_active) {
      return { valid: false, error: 'Session is inactive' };
    }

    if (new Date(session.expires_at) < new Date()) {
      return { valid: false, error: 'Session expired' };
    }

    const admin = session.admin_users as unknown as AdminUser;

    // Check if admin is still active
    if (!admin.is_active) {
      return { valid: false, error: 'Admin account is inactive' };
    }

    if (admin.is_banned) {
      return { valid: false, error: 'Admin account is banned' };
    }

    // Update last activity
    await supabase
      .from('admin_sessions')
      .update({ last_activity: new Date().toISOString() })
      .eq('id', session.id);

    return {
      valid: true,
      admin,
      expiresAt: session.expires_at,
    };
  } catch (e) {
    console.error('Error verifying admin session:', e);
    return { valid: false, error: 'Session verification failed' };
  }
}

/**
 * Logout admin (invalidate session)
 */
export async function logoutAdminUser(tokenHash: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { error } = await supabase
      .from('admin_sessions')
      .update({ is_active: false })
      .eq('token_hash', tokenHash);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (e) {
    console.error('Error logging out admin:', e);
    return { success: false, error: 'Logout failed' };
  }
}

/**
 * Refresh admin session
 */
export async function refreshAdminSession(oldTokenHash: string): Promise<{
  success: boolean;
  token?: string;
  admin?: AdminUser;
  error?: string;
}> {
  try {
    // Verify old session
    const verification = await verifyAdminSession(oldTokenHash);
    if (!verification.valid || !verification.admin) {
      return { success: false, error: 'Invalid session' };
    }

    const admin = verification.admin;

    // Invalidate old session
    await supabase
      .from('admin_sessions')
      .update({ is_active: false })
      .eq('token_hash', oldTokenHash);

    // Generate new token
    const newToken = generateToken(admin.id, admin.email, admin.role);
    const newTokenHash = hashToken(newToken);

    // Create new session
    await supabase.from('admin_sessions').insert({
      admin_id: admin.id,
      token_hash: newTokenHash,
      expires_at: getTokenExpiry().toISOString(),
      is_active: true,
    });

    return {
      success: true,
      token: newToken,
      admin,
    };
  } catch (e) {
    console.error('Error refreshing admin session:', e);
    return { success: false, error: 'Session refresh failed' };
  }
}

/**
 * Get admin by ID
 */
export async function getAdminById(adminId: string): Promise<{
  success: boolean;
  admin?: AdminUser;
  error?: string;
}> {
  try {
    const { data: admin, error } = await supabase
      .from('admin_users')
      .select('*')
      .eq('id', adminId)
      .single();

    if (error || !admin) {
      return { success: false, error: 'Admin not found' };
    }

    return { success: true, admin: admin as unknown as AdminUser };
  } catch (e) {
    console.error('Error getting admin:', e);
    return { success: false, error: 'Failed to fetch admin' };
  }
}

/**
 * Check if email already exists
 */
export async function emailExists(email: string): Promise<boolean> {
  try {
    const { count } = await supabase
      .from('admin_users')
      .select('*', { count: 'exact', head: true })
      .eq('email', email.toLowerCase());

    return (count || 0) > 0;
  } catch (e) {
    console.error('Error checking email:', e);
    return false;
  }
}