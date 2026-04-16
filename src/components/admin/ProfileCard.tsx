'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Settings, Shield, Calendar } from 'lucide-react';
import { useAdminProfile, useAdminSession } from '@/hooks/admin';

export const ProfileCard = () => {
  const { session } = useAdminSession();
  const { profile, isLoading, error } = useAdminProfile();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.avatar_url) setAvatarUrl(profile.avatar_url);
  }, [profile]);

  if (isLoading) {
    return (
      <div className="glass rounded-2xl p-6 border border-primary/20 animate-pulse">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-muted" />
          <div className="space-y-2 flex-1">
            <div className="h-4 bg-muted rounded w-32" />
            <div className="h-3 bg-muted rounded w-48" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass rounded-2xl p-4 border border-destructive/30 bg-destructive/10 text-destructive text-sm">
        Error loading profile: {error}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl p-6 border border-primary/20"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={profile?.full_name || 'Profile'}
              className="w-14 h-14 rounded-full object-cover border-2 border-primary/30 ring-2 ring-primary/10"
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 border-2 border-primary/30 flex items-center justify-center">
              <span className="text-xl font-bold text-primary font-gaming">
                {session?.user.email?.charAt(0).toUpperCase() || 'A'}
              </span>
            </div>
          )}
          <div>
            <h3 className="text-lg font-gaming font-bold text-foreground">
              {profile?.full_name || 'Admin'}
            </h3>
            <p className="text-sm text-muted-foreground">{session?.user.email}</p>
            <div className="flex items-center gap-1.5 mt-1.5">
              <Shield className="h-3 w-3 text-primary" />
              <span className="text-xs font-semibold text-primary capitalize px-2 py-0.5 bg-primary/10 rounded-full border border-primary/20">
                {session?.user.role || 'admin'}
              </span>
            </div>
          </div>
        </div>

        <Link
          href="/itszaadminlogin/profile"
          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-primary transition-colors px-3 py-1.5 rounded-lg hover:bg-primary/10 border border-transparent hover:border-primary/20"
        >
          <Settings className="h-3.5 w-3.5" />
          Edit Profile
        </Link>
      </div>

      {profile?.created_at && (
        <div className="mt-4 pt-4 border-t border-border/50 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          Member since {new Date(profile.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      )}
    </motion.div>
  );
};