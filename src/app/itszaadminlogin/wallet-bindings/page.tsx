'use client';

import { Suspense } from 'react';
import { ProtectedRoute, WalletBindForm, WalletsList } from '@/components/admin';
import { motion } from 'framer-motion';
import { Wallet, Loader2 } from 'lucide-react';

function WalletBindingsContent() {
  return (
    <ProtectedRoute>
      <div className="space-y-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-green-500/20 to-green-600/20 rounded-xl p-3 border border-green-500/20">
            <Wallet className="h-6 w-6 text-green-400" />
          </div>
          <div>
            <h1 className="text-3xl font-gaming font-bold text-glow">Wallet Bindings</h1>
            <p className="text-muted-foreground text-sm">Connect and manage your Solana wallets for admin transactions</p>
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <WalletBindForm />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="glass rounded-2xl p-6 border border-primary/20"
            >
              <h3 className="text-lg font-gaming font-bold text-foreground mb-4">Your Wallets</h3>
              <WalletsList />
            </motion.div>
          </div>

          {/* How it works sidebar */}
          <motion.div
            initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}
            className="glass rounded-2xl p-6 border border-primary/20 h-fit"
          >
            <h3 className="text-base font-gaming font-bold text-foreground mb-4">How It Works</h3>
            <ol className="space-y-4">
              {[
                { step: '01', text: 'Connect your Solana wallet using the button in the sidebar' },
                { step: '02', text: 'Click "Bind Connected Wallet" to initiate the binding process' },
                { step: '03', text: 'Wallet is securely bound to your admin account' },
                { step: '04', text: 'Use your wallet to sign admin transactions and access restricted features' },
              ].map(({ step, text }) => (
                <li key={step} className="flex items-start gap-3">
                  <span className="text-xs font-bold text-primary font-gaming bg-primary/10 border border-primary/20 rounded-lg px-2 py-1 flex-shrink-0">{step}</span>
                  <p className="text-sm text-muted-foreground pt-0.5">{text}</p>
                </li>
              ))}
            </ol>
          </motion.div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

export default function WalletBindingsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <WalletBindingsContent />
    </Suspense>
  );
}