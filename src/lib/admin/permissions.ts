// Role-based access control and permissions
import { AdminRole, AdminPermission, AdminUser } from '@/types/admin';

// Define permissions for each role
const rolePermissions: Record<AdminRole, AdminPermission[]> = {
  moderator: [
    'ban_user',
    'unban_user',
    'resolve_dispute',
    'view_analytics',
  ],
  admin: [
    'ban_user',
    'unban_user',
    'resolve_dispute',
    'mint_nft',
    'edit_game_rules',
    'view_analytics',
    'manage_bans',
    'manage_payouts',
    'view_audit_logs',
  ],
  superadmin: [
    'ban_user',
    'unban_user',
    'resolve_dispute',
    'mint_nft',
    'edit_game_rules',
    'manage_admins',
    'view_analytics',
    'manage_bans',
    'manage_payouts',
    'view_audit_logs',
  ],
};

/**
 * Get all permissions for a role
 */
export function getPermissionsForRole(role: AdminRole): AdminPermission[] {
  return rolePermissions[role] || [];
}

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: AdminRole, permission: AdminPermission): boolean {
  const permissions = getPermissionsForRole(role);
  return permissions.includes(permission);
}

/**
 * Check if an admin has a specific permission
 */
export function adminHasPermission(admin: AdminUser, permission: AdminPermission): boolean {
  // Check role-based permissions first
  if (hasPermission(admin.role, permission)) {
    return true;
  }

  // Check custom permissions
  if (admin.permissions && admin.permissions[permission]) {
    return true;
  }

  return false;
}

/**
 * Get all permissions for an admin
 */
export function getAdminPermissions(admin: AdminUser): AdminPermission[] {
  const rolePerms = getPermissionsForRole(admin.role);
  const customPerms = Object.keys(admin.permissions || {}).filter(
    (key) => admin.permissions[key as AdminPermission]
  ) as AdminPermission[];

  // Combine and deduplicate
  return Array.from(new Set([...rolePerms, ...customPerms]));
}

/**
 * Check if admin can manage another admin
 */
export function canManageAdmin(actor: AdminUser, target: AdminUser): boolean {
  // Superadmin can manage anyone
  if (actor.role === 'superadmin') {
    return true;
  }

  // Admins can manage moderators
  if (actor.role === 'admin' && target.role === 'moderator') {
    return true;
  }

  // Cannot manage yourself
  if (actor.id === target.id) {
    return false;
  }

  return false;
}

/**
 * Check if admin can ban/unban a user
 */
export function canBanUser(admin: AdminUser): boolean {
  return adminHasPermission(admin, 'ban_user');
}

/**
 * Check if admin can resolve disputes
 */
export function canResolveDispute(admin: AdminUser): boolean {
  return adminHasPermission(admin, 'resolve_dispute');
}

/**
 * Check if admin can mint NFTs
 */
export function canMintNFT(admin: AdminUser): boolean {
  return adminHasPermission(admin, 'mint_nft');
}

/**
 * Check if admin can edit game rules
 */
export function canEditGameRules(admin: AdminUser): boolean {
  return adminHasPermission(admin, 'edit_game_rules');
}

/**
 * Check if admin can manage other admins
 */
export function canManageAdmins(admin: AdminUser): boolean {
  return adminHasPermission(admin, 'manage_admins');
}

/**
 * Check if admin can view analytics
 */
export function canViewAnalytics(admin: AdminUser): boolean {
  return adminHasPermission(admin, 'view_analytics');
}

/**
 * Check if admin can manage payouts
 */
export function canManagePayouts(admin: AdminUser): boolean {
  return adminHasPermission(admin, 'manage_payouts');
}

/**
 * Check if admin can view audit logs
 */
export function canViewAuditLogs(admin: AdminUser): boolean {
  return adminHasPermission(admin, 'view_audit_logs');
}

/**
 * Get role hierarchy level
 */
export function getRoleHierarchy(role: AdminRole): number {
  const hierarchy: Record<AdminRole, number> = {
    moderator: 1,
    admin: 2,
    superadmin: 3,
  };
  return hierarchy[role] || 0;
}

/**
 * Check if one role outranks another
 */
export function roleOutranks(role1: AdminRole, role2: AdminRole): boolean {
  return getRoleHierarchy(role1) > getRoleHierarchy(role2);
}

/**
 * Generate permission matrix for display
 */
export function generatePermissionMatrix(): Record<AdminRole, Record<AdminPermission, boolean>> {
  const permissions: AdminPermission[] = [
    'ban_user',
    'unban_user',
    'resolve_dispute',
    'mint_nft',
    'edit_game_rules',
    'manage_admins',
    'view_analytics',
    'manage_bans',
    'manage_payouts',
    'view_audit_logs',
  ];

  const roles: AdminRole[] = ['moderator', 'admin', 'superadmin'];

  const matrix: Record<AdminRole, Record<AdminPermission, boolean>> = {
    moderator: {} as Record<AdminPermission, boolean>,
    admin: {} as Record<AdminPermission, boolean>,
    superadmin: {} as Record<AdminPermission, boolean>,
  };

  roles.forEach((role) => {
    permissions.forEach((permission) => {
      matrix[role][permission] = hasPermission(role, permission);
    });
  });

  return matrix;
}
