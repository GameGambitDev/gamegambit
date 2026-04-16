'use client';

// src/hooks/admin/useAdminAuth.ts
//
// Now a thin wrapper around AdminAuthContext.
// No more independent /api/admin/auth/verify calls from this hook.

import { useAdminAuth as useAdminAuthFromContext } from '@/contexts/AdminAuthContext';

export function useAdminAuth() {
  return useAdminAuthFromContext();
}