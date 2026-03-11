// Admin System Type Definitions

export type AdminRole = 'moderator' | 'admin' | 'superadmin';

export type AdminPermission = 
  | 'ban_user'
  | 'unban_user'
  | 'resolve_dispute'
  | 'mint_nft'
  | 'edit_game_rules'
  | 'manage_admins'
  | 'view_analytics'
  | 'manage_bans'
  | 'manage_payouts'
  | 'view_audit_logs';

// Admin User
export interface AdminUser {
  id: string;
  email: string;
  username?: string;
  full_name?: string;
  avatar_url?: string;
  bio?: string;
  role: AdminRole;
  permissions: Record<AdminPermission, boolean>;
  is_active: boolean;
  is_banned: boolean;
  ban_reason?: string;
  two_factor_enabled: boolean;
  last_login?: string;
  created_at: string;
  updated_at: string;
}

// Session Management
export interface AdminSession {
  id: string;
  admin_id: string;
  token_hash: string;
  ip_address?: string;
  user_agent?: string;
  expires_at: string;
  last_activity: string;
  is_active: boolean;
  created_at: string;
}

// Wallet Binding
export interface AdminWalletBinding {
  id: string;
  admin_id: string;
  wallet_address: string;
  verified: boolean;
  verification_signature?: string;
  is_primary: boolean;
  verified_at?: string;
  last_verified?: string;
  created_at: string;
  updated_at: string;
}

// Audit Log
export interface AdminAuditLog {
  id: string;
  admin_id?: string;
  action_type: string;
  resource_type: string;
  resource_id?: string;
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

// Authentication Requests/Responses
export interface AdminSignupRequest {
  email: string;
  password: string;
  full_name?: string;
  username?: string;
}

export interface AdminLoginRequest {
  email: string;
  password: string;
}

export interface AdminAuthResponse {
  success: boolean;
  message: string;
  admin?: AdminUser;
  token?: string;
  expiresIn?: number;
  error?: string;
}

export interface AdminSessionResponse {
  valid: boolean;
  admin?: AdminUser;
  expiresAt?: string;
  error?: string;
}

// Wallet Binding Requests/Responses
export interface AdminWalletBindRequest {
  wallet_address: string;
}

export interface AdminWalletVerifyRequest {
  wallet_binding_id: string;
  signature: string;
  message: string;
}

export interface AdminWalletVerifyResponse {
  success: boolean;
  verified: boolean;
  message: string;
  error?: string;
}

// Profile Management
export interface AdminProfileUpdateRequest {
  full_name?: string;
  username?: string;
  bio?: string;
  avatar_url?: string;
}

export interface AdminProfileResponse {
  success: boolean;
  admin?: AdminUser;
  message: string;
  error?: string;
}

// Audit Log Query
export interface AdminAuditLogQuery {
  limit?: number;
  offset?: number;
  action_type?: string;
  resource_type?: string;
  start_date?: string;
  end_date?: string;
}

export interface AdminAuditLogResponse {
  success: boolean;
  logs: AdminAuditLog[];
  total: number;
  error?: string;
}
