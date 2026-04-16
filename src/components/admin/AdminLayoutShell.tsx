'use client';

// src/components/admin/AdminLayoutShell.tsx
//
// Reads from AdminAuthContext (one verify call, already done by the provider).
// Only renders the sidebar once auth is confirmed — prevents it flashing
// while logged out or during the loading state.

import { ReactNode } from 'react';
import { useAdminAuthContext } from '@/contexts/AdminAuthContext';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminMainWrapper } from '@/components/admin/AdminMainWrapper';
import { Loader2 } from 'lucide-react';

export function AdminLayoutShell({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useAdminAuthContext();

  // Still verifying — show a minimal full-screen loader, no sidebar
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Not authenticated — render children only (ProtectedRoute inside will redirect to login)
  if (!isAuthenticated) {
    return <>{children}</>;
  }

  // Authenticated — full layout with sidebar
  return (
    <div className="min-h-screen bg-background">
      <AdminSidebar />
      <AdminMainWrapper>
        {children}
      </AdminMainWrapper>
    </div>
  );
}
