import Link from 'next/link';

export const metadata = {
  title: 'Unauthorized - Admin Dashboard',
  description: 'Access denied',
};

export default function UnauthorizedPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">403</h1>
        <p className="text-xl text-gray-600 mb-2">Access Denied</p>
        <p className="text-gray-600 mb-8">You don't have permission to access this resource.</p>
        <Link
          href="/itszaadminlogin/dashboard"
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg inline-block"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
