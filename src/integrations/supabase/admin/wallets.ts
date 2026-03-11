// Supabase admin wallet binding operations
import { createClient } from '@supabase/supabase-js';
import { AdminWalletBinding } from '@/types/admin';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

/**
 * Create a new wallet binding
 */
export async function createWalletBinding(
  adminId: string,
  walletAddress: string
): Promise<{
  success: boolean;
  binding?: AdminWalletBinding;
  error?: string;
}> {
  try {
    const { data: binding, error } = await supabase
      .from('admin_wallet_bindings')
      .insert({
        admin_id: adminId,
        wallet_address: walletAddress,
        verified: false,
        is_primary: false,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating wallet binding:', error);
      if (error.code === '23505') {
        return { success: false, error: 'Wallet already bound to another admin' };
      }
      return { success: false, error: error.message };
    }

    return { success: true, binding: binding as AdminWalletBinding };
  } catch (e) {
    console.error('Error in createWalletBinding:', e);
    return { success: false, error: 'Failed to create wallet binding' };
  }
}

/**
 * Verify a wallet binding
 */
export async function verifyWalletBinding(
  bindingId: string,
  signature: string
): Promise<{
  success: boolean;
  binding?: AdminWalletBinding;
  error?: string;
}> {
  try {
    const { data: binding, error } = await supabase
      .from('admin_wallet_bindings')
      .update({
        verified: true,
        verification_signature: signature,
        verified_at: new Date().toISOString(),
        last_verified: new Date().toISOString(),
      })
      .eq('id', bindingId)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, binding: binding as AdminWalletBinding };
  } catch (e) {
    console.error('Error verifying wallet:', e);
    return { success: false, error: 'Failed to verify wallet' };
  }
}

/**
 * Get all wallet bindings for an admin
 */
export async function getAdminWallets(adminId: string): Promise<{
  success: boolean;
  wallets?: AdminWalletBinding[];
  error?: string;
}> {
  try {
    const { data: wallets, error } = await supabase
      .from('admin_wallet_bindings')
      .select('*')
      .eq('admin_id', adminId)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, wallets: wallets as AdminWalletBinding[] };
  } catch (e) {
    console.error('Error fetching wallets:', e);
    return { success: false, error: 'Failed to fetch wallets' };
  }
}

/**
 * Get a specific wallet binding
 */
export async function getWalletBinding(bindingId: string): Promise<{
  success: boolean;
  binding?: AdminWalletBinding;
  error?: string;
}> {
  try {
    const { data: binding, error } = await supabase
      .from('admin_wallet_bindings')
      .select('*')
      .eq('id', bindingId)
      .single();

    if (error || !binding) {
      return { success: false, error: 'Wallet binding not found' };
    }

    return { success: true, binding: binding as AdminWalletBinding };
  } catch (e) {
    console.error('Error fetching wallet:', e);
    return { success: false, error: 'Failed to fetch wallet' };
  }
}

/**
 * Set primary wallet
 */
export async function setPrimaryWallet(
  adminId: string,
  walletId: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // Remove primary from all wallets
    await supabase
      .from('admin_wallet_bindings')
      .update({ is_primary: false })
      .eq('admin_id', adminId)
      .eq('is_primary', true);

    // Set new primary
    const { error } = await supabase
      .from('admin_wallet_bindings')
      .update({ is_primary: true })
      .eq('id', walletId)
      .eq('admin_id', adminId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (e) {
    console.error('Error setting primary wallet:', e);
    return { success: false, error: 'Failed to set primary wallet' };
  }
}

/**
 * Delete a wallet binding
 */
export async function deleteWalletBinding(
  bindingId: string,
  adminId: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // Get binding first
    const { data: binding, error: fetchError } = await supabase
      .from('admin_wallet_bindings')
      .select('*')
      .eq('id', bindingId)
      .eq('admin_id', adminId)
      .single();

    if (fetchError || !binding) {
      return { success: false, error: 'Wallet binding not found' };
    }

    // Delete binding
    const { error } = await supabase
      .from('admin_wallet_bindings')
      .delete()
      .eq('id', bindingId);

    if (error) {
      return { success: false, error: error.message };
    }

    // If it was primary, set the first remaining as primary
    if (binding.is_primary) {
      const { data: remaining } = await supabase
        .from('admin_wallet_bindings')
        .select('id')
        .eq('admin_id', adminId)
        .order('created_at', { ascending: true })
        .limit(1);

      if (remaining && remaining.length > 0) {
        await supabase
          .from('admin_wallet_bindings')
          .update({ is_primary: true })
          .eq('id', remaining[0].id);
      }
    }

    return { success: true };
  } catch (e) {
    console.error('Error deleting wallet:', e);
    return { success: false, error: 'Failed to delete wallet' };
  }
}

/**
 * Check if wallet is already bound
 */
export async function isWalletBound(walletAddress: string): Promise<{
  bound: boolean;
  adminId?: string;
}> {
  try {
    const { data, error } = await supabase
      .from('admin_wallet_bindings')
      .select('admin_id')
      .eq('wallet_address', walletAddress)
      .single();

    if (error || !data) {
      return { bound: false };
    }

    return { bound: true, adminId: data.admin_id };
  } catch (e) {
    console.error('Error checking wallet:', e);
    return { bound: false };
  }
}

/**
 * Get verified wallets for an admin
 */
export async function getVerifiedWallets(adminId: string): Promise<{
  success: boolean;
  wallets?: AdminWalletBinding[];
  error?: string;
}> {
  try {
    const { data: wallets, error } = await supabase
      .from('admin_wallet_bindings')
      .select('*')
      .eq('admin_id', adminId)
      .eq('verified', true)
      .order('is_primary', { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, wallets: wallets as AdminWalletBinding[] };
  } catch (e) {
    console.error('Error fetching verified wallets:', e);
    return { success: false, error: 'Failed to fetch wallets' };
  }
}

/**
 * Update wallet verification timestamp
 */
export async function updateWalletLastVerified(bindingId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { error } = await supabase
      .from('admin_wallet_bindings')
      .update({
        last_verified: new Date().toISOString(),
      })
      .eq('id', bindingId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (e) {
    console.error('Error updating last verified:', e);
    return { success: false, error: 'Failed to update verification' };
  }
}
