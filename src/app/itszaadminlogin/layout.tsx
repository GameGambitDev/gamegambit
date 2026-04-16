// src/app/itszaadminlogin/layout.tsx

import { ReactNode } from 'react';
import type { Metadata } from 'next';
import { AdminAuthProvider } from '@/contexts/AdminAuthContext';
import { AdminLayoutShell } from '@/components/admin/AdminLayoutShell';

export const metadata: Metadata = {
  title: 'Admin Portal - Game Gambit',
  description: 'Admin management panel for Game Gambit',
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminAuthProvider>
      <AdminLayoutShell>
        {children}
      </AdminLayoutShell>
    </AdminAuthProvider>
  );
}