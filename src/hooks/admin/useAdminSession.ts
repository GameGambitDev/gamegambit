'use client';

// src/hooks/admin/useAdminSession.ts
//
// Now a thin wrapper around AdminAuthContext.
// No more independent /api/admin/auth/verify calls from this hook.

import { useAdminSession as useAdminSessionFromContext } from '@/contexts/AdminAuthContext';

export function useAdminSession() {
  return useAdminSessionFromContext();
}