// Supabase admin profile operations
import { createClient } from '@supabase/supabase-js';
import { AdminUser, AdminProfileUpdateRequest } from '@/types/admin';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

/**
 * Get admin profile
 */
export async function getAdminProfile(adminId: string): Promise<{
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
      return { success: false, error: 'Admin profile not found' };
    }

    return { success: true, admin: admin as AdminUser };
  } catch (e) {
    console.error('Error fetching admin profile:', e);
    return { success: false, error: 'Failed to fetch profile' };
  }
}

/**
 * Update admin profile
 */
export async function updateAdminProfile(
  adminId: string,
  data: AdminProfileUpdateRequest
): Promise<{
  success: boolean;
  admin?: AdminUser;
  error?: string;
}> {
  try {
    const updateData: Partial<AdminUser> = {
      updated_at: new Date().toISOString(),
    };

    if (data.full_name !== undefined) updateData.full_name = data.full_name;
    if (data.username !== undefined) updateData.username = data.username;
    if (data.bio !== undefined) updateData.bio = data.bio;
    if (data.avatar_url !== undefined) updateData.avatar_url = data.avatar_url;

    const { data: admin, error } = await supabase
      .from('admin_users')
      .update(updateData)
      .eq('id', adminId)
      .select()
      .single();

    if (error) {
      console.error('Error updating admin profile:', error);
      if (error.code === '23505') {
        return { success: false, error: 'Username already taken' };
      }
      return { success: false, error: error.message };
    }

    return { success: true, admin: admin as AdminUser };
  } catch (e) {
    console.error('Error in updateAdminProfile:', e);
    return { success: false, error: 'Failed to update profile' };
  }
}

/**
 * Update admin avatar
 */
export async function updateAdminAvatar(
  adminId: string,
  avatarUrl: string
): Promise<{
  success: boolean;
  admin?: AdminUser;
  error?: string;
}> {
  try {
    const { data: admin, error } = await supabase
      .from('admin_users')
      .update({
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', adminId)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, admin: admin as AdminUser };
  } catch (e) {
    console.error('Error updating avatar:', e);
    return { success: false, error: 'Failed to update avatar' };
  }
}

/**
 * Change admin password
 */
export async function changeAdminPassword(
  adminId: string,
  newPasswordHash: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { error } = await supabase
      .from('admin_users')
      .update({
        password_hash: newPasswordHash,
        updated_at: new Date().toISOString(),
      })
      .eq('id', adminId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (e) {
    console.error('Error changing password:', e);
    return { success: false, error: 'Failed to change password' };
  }
}

/**
 * Enable 2FA for admin
 */
export async function enable2FA(
  adminId: string,
  secret: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { error } = await supabase
      .from('admin_users')
      .update({
        two_factor_enabled: true,
        two_factor_secret: secret,
        updated_at: new Date().toISOString(),
      })
      .eq('id', adminId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (e) {
    console.error('Error enabling 2FA:', e);
    return { success: false, error: 'Failed to enable 2FA' };
  }
}

/**
 * Disable 2FA for admin
 */
export async function disable2FA(adminId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { error } = await supabase
      .from('admin_users')
      .update({
        two_factor_enabled: false,
        two_factor_secret: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', adminId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (e) {
    console.error('Error disabling 2FA:', e);
    return { success: false, error: 'Failed to disable 2FA' };
  }
}

/**
 * Get admin's profile statistics
 */
export async function getAdminStats(adminId: string): Promise<{
  success: boolean;
  stats?: {
    lastLogin?: string;
    accountCreated: string;
    walletsConnected: number;
    activeSession: boolean;
  };
  error?: string;
}> {
  try {
    // Get admin
    const { data: admin, error: adminError } = await supabase
      .from('admin_users')
      .select('created_at, last_login')
      .eq('id', adminId)
      .single();

    if (adminError || !admin) {
      return { success: false, error: 'Admin not found' };
    }

    // Get wallet count
    const { count: walletCount } = await supabase
      .from('admin_wallet_bindings')
      .select('*', { count: 'exact', head: true })
      .eq('admin_id', adminId);

    // Get active session
    const { count: sessionCount } = await supabase
      .from('admin_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('admin_id', adminId)
      .eq('is_active', true);

    return {
      success: true,
      stats: {
        lastLogin: admin.last_login,
        accountCreated: admin.created_at,
        walletsConnected: walletCount || 0,
        activeSession: (sessionCount || 0) > 0,
      },
    };
  } catch (e) {
    console.error('Error getting admin stats:', e);
    return { success: false, error: 'Failed to fetch stats' };
  }
}
