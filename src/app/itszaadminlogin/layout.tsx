import { ReactNode } from 'react';
import type { Metadata } from 'next';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminMainWrapper } from '@/components/admin/AdminMainWrapper';

export const metadata: Metadata = {
  title: 'Admin Portal - Game Gambit',
  description: 'Admin management panel for Game Gambit',
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <AdminSidebar />
      <AdminMainWrapper>
        {children}
      </AdminMainWrapper>
    </div>
  );
}