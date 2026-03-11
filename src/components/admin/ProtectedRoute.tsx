'use client';

import { ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminSession } from '@/hooks/admin';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: 'moderator' | 'admin' | 'superadmin';
}

export const ProtectedRoute = ({ children, requiredRole }: ProtectedRouteProps) => {
  const { session, isLoading, isAuthenticated } = useAdminSession();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      router.push('/itszaadminlogin/login');
      return;
    }

    if (requiredRole && session?.user.role !== requiredRole) {
      // Check if user has sufficient privileges
      const roleHierarchy = { moderator: 1, admin: 2, superadmin: 3 };
      const userLevel = roleHierarchy[session?.user.role as keyof typeof roleHierarchy] || 0;
      const requiredLevel = roleHierarchy[requiredRole];

      if (userLevel < requiredLevel) {
        router.push('/itszaadminlogin/unauthorized');
      }
    }
  }, [isLoading, isAuthenticated, session, requiredRole, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-r-transparent mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Router will redirect
  }

  return <>{children}</>;
};
