'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAdminProfile, useAdminSession } from '@/hooks/admin';

export const ProfileCard = () => {
  const { session } = useAdminSession();
  const { profile, isLoading, error } = useAdminProfile();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.avatar_url) {
      setAvatarUrl(profile.avatar_url);
    }
  }, [profile]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="h-4 bg-gray-200 rounded animate-pulse w-24 mb-4"></div>
        <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
        Error loading profile: {error}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-4">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={profile?.full_name || 'Profile'}
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
              {session?.user.email?.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{profile?.full_name || 'Admin'}</h3>
            <p className="text-sm text-gray-600">{session?.user.email}</p>
            <span className="inline-block mt-1 px-3 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full capitalize">
              {session?.user.role}
            </span>
          </div>
        </div>
        <Link
          href="/itszaadminlogin/profile"
          className="text-blue-600 hover:text-blue-700 font-medium text-sm"
        >
          Edit Profile
        </Link>
      </div>

      {profile?.created_at && (
        <div className="pt-4 border-t border-gray-200 text-xs text-gray-600">
          <p>Member since {new Date(profile.created_at).toLocaleDateString()}</p>
        </div>
      )}
    </div>
  );
};
