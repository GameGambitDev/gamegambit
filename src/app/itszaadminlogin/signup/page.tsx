import { Suspense } from 'react';
import { SignupForm } from '@/components/admin';

export const metadata = {
  title: 'Admin Signup - Game Gambit',
  description: 'Create a new Game Gambit admin account',
};

export default function SignupPage() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <Suspense fallback={<div>Loading...</div>}>
        <SignupForm />
      </Suspense>
    </div>
  );
}
