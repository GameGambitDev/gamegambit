import { ReactNode } from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Admin Portal - Game Gambit',
  description: 'Admin management panel for Game Gambit',
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto py-6 sm:px-6 lg:px-8">{children}</div>
    </div>
  );
}
