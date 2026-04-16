'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, Trash2, Loader2, Star, AlertTriangle, X, CheckCircle2 } from 'lucide-react';
import { useAdminWallet } from '@/hooks/admin';

interface Wallet {
  id: string;
  wallet_address: string;
  is_primary: boolean;
  created_at: string;
}

function ConfirmUnbindDialog({
  wallet,
  onConfirm,
  onCancel,
  loading,
}: {
  wallet: Wallet;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0 }}
        className="glass rounded-2xl p-6 border border-destructive/30 w-full max-w-sm shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-gaming font-bold text-foreground">Remove Wallet?</h2>
            <p className="text-sm text-muted-foreground mt-1">
              This will unbind <span className="font-mono text-xs text-foreground">{wallet.wallet_address.slice(0, 12)}...</span> from your account.
            </p>
          </div>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 bg-card border border-border/50 hover:border-primary/50 text-foreground font-semibold py-2.5 px-4 rounded-xl transition-colors text-sm">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 bg-destructive/20 hover:bg-destructive/30 border border-destructive/40 text-destructive font-semibold py-2.5 px-4 rounded-xl transition-colors text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Remove
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export const WalletsList = () => {
  const { wallets, isLoading, error, fetchWallets, unbindWallet } = useAdminWallet();
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [confirmWallet, setConfirmWallet] = useState<Wallet | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  useEffect(() => { fetchWallets(); }, []);

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const handleUnbind = async () => {
    if (!confirmWallet) return;
    setDeleteLoading(confirmWallet.id);
    try {
      const result = await unbindWallet(confirmWallet.id);
      if (result) {
        showToast('success', 'Wallet removed successfully');
        fetchWallets();
      } else {
        showToast('error', 'Failed to remove wallet');
      }
    } catch {
      showToast('error', 'An error occurred');
    } finally {
      setDeleteLoading(null);
      setConfirmWallet(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading wallets...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-destructive text-sm py-4">
        <AlertTriangle className="h-4 w-4" />
        Error: {error}
      </div>
    );
  }

  if (!wallets || wallets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
        <Wallet className="h-8 w-8 opacity-30" />
        <p className="text-sm">No wallets bound yet.</p>
      </div>
    );
  }

  return (
    <>
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className={`fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium shadow-xl
              ${toast.type === 'success' ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' : 'bg-destructive/15 border-destructive/30 text-destructive'}`}
          >
            {toast.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-3">
        {(wallets as Wallet[]).map((wallet, i) => (
          <motion.div
            key={wallet.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex items-center justify-between gap-3 bg-background/50 border border-border/50 hover:border-primary/30 rounded-xl p-4 transition-colors group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                <Wallet className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-mono text-foreground truncate">
                    {wallet.wallet_address.slice(0, 16)}...{wallet.wallet_address.slice(-8)}
                  </p>
                  {wallet.is_primary && (
                    <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded-full flex-shrink-0">
                      <Star className="h-2.5 w-2.5" /> Primary
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Bound {new Date(wallet.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                </p>
              </div>
            </div>

            <button
              onClick={() => setConfirmWallet(wallet)}
              disabled={deleteLoading === wallet.id}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg border border-transparent hover:border-destructive/30 transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50"
            >
              {deleteLoading === wallet.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Remove
            </button>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {confirmWallet && (
          <ConfirmUnbindDialog
            wallet={confirmWallet}
            onConfirm={handleUnbind}
            onCancel={() => setConfirmWallet(null)}
            loading={deleteLoading === confirmWallet.id}
          />
        )}
      </AnimatePresence>
    </>
  );
};