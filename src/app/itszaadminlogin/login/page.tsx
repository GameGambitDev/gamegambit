import { Suspense } from 'react';
import { LoginForm } from '@/components/admin';

export const metadata = {
  title: 'Admin Login - Game Gambit',
  description: 'Sign in to the Game Gambit admin portal',
};

export default function LoginPage() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <Suspense fallback={<div>Loading...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
