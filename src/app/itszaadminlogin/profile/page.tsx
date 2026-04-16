'use client';

import { useState, useEffect, Suspense } from 'react';
import { ProtectedRoute } from '@/components/admin';
import { useAdminProfile, useAdminSession } from '@/hooks/admin';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Loader2, CheckCircle2, AlertTriangle, Mail, User, FileText, Save } from 'lucide-react';

function ProfileContent() {
  const { session } = useAdminSession();
  const { profile, isLoading, updateProfile } = useAdminProfile();
  const [formData, setFormData] = useState({ name: '', bio: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (profile) {
      setFormData({ name: profile.full_name || '', bio: profile.bio || '' });
    }
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);
    try {
      const result = await updateProfile(formData);
      if (result) {
        setMessage({ type: 'success', text: 'Profile updated successfully' });
      } else {
        setMessage({ type: 'error', text: 'Failed to update profile' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'An error occurred' });
    } finally {
      setIsSaving(false);
      setTimeout(() => setMessage(null), 4000);
    }
  };

  return (
    <ProtectedRoute>
      <div className="space-y-6 max-w-2xl">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-cyan-500/20 to-cyan-600/20 rounded-xl p-3 border border-cyan-500/20">
            <Settings className="h-6 w-6 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-3xl font-gaming font-bold text-glow">Profile Settings</h1>
            <p className="text-muted-foreground text-sm">Update your admin profile information</p>
          </div>
        </motion.div>

        {/* Toast */}
        <AnimatePresence>
          {message && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium
                ${message.type === 'success'
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                  : 'bg-destructive/15 border-destructive/30 text-destructive'}`}
            >
              {message.type === 'success'
                ? <CheckCircle2 className="h-4 w-4 shrink-0" />
                : <AlertTriangle className="h-4 w-4 shrink-0" />}
              {message.text}
            </motion.div>
          )}
        </AnimatePresence>

        {isLoading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-sm">Loading profile...</span>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass rounded-2xl p-6 border border-primary/20"
          >
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email — read only */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" />
                  Email Address
                </label>
                <input
                  type="email"
                  value={session?.user.email || ''}
                  disabled
                  className="w-full px-4 py-2.5 bg-muted/30 border border-border/50 rounded-xl text-muted-foreground text-sm cursor-not-allowed"
                />
                <p className="text-xs text-muted-foreground/70 pl-1">Email cannot be changed</p>
              </div>

              {/* Full Name */}
              <div className="space-y-1.5">
                <label htmlFor="name" className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  Full Name
                </label>
                <input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-card border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground placeholder:text-muted-foreground text-sm transition-colors hover:border-primary/30"
                  placeholder="Your full name"
                  disabled={isSaving}
                />
              </div>

              {/* Bio */}
              <div className="space-y-1.5">
                <label htmlFor="bio" className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  Bio
                </label>
                <textarea
                  id="bio"
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  className="w-full px-4 py-2.5 bg-card border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground placeholder:text-muted-foreground text-sm transition-colors hover:border-primary/30 resize-none"
                  rows={4}
                  placeholder="Tell us about yourself..."
                  disabled={isSaving}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground font-gaming font-semibold py-2.5 px-6 rounded-xl transition-all shadow-lg shadow-primary/20 hover:shadow-neon disabled:shadow-none text-sm"
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={() => profile && setFormData({ name: profile.full_name || '', bio: profile.bio || '' })}
                  disabled={isSaving}
                  className="px-6 py-2.5 bg-card border border-border/50 hover:border-primary/40 text-foreground font-semibold rounded-xl transition-colors text-sm disabled:opacity-50"
                >
                  Reset
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </div>
    </ProtectedRoute>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <ProfileContent />
    </Suspense>
  );
}