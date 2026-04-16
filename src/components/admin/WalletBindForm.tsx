'use client';

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useAdminWallet } from '@/hooks/admin';
import { motion } from 'framer-motion';
import { Loader, CheckCircle, AlertCircle, Wallet, KeyRound, ShieldCheck } from 'lucide-react';
import bs58 from 'bs58';

type Step = 'idle' | 'binding' | 'signing' | 'verifying' | 'done' | 'error';

export const WalletBindForm = () => {
  const { connected, publicKey, signMessage } = useWallet();
  const { bindWallet, verifyWallet } = useAdminWallet();

  const [step, setStep] = useState<Step>('idle');
  const [error, setError] = useState('');
  const [boundAddress, setBoundAddress] = useState('');

  const STEP_LABELS: Record<Step, string> = {
    idle: connected ? 'Bind Connected Wallet' : 'Connect Wallet First',
    binding: 'Registering wallet...',
    signing: 'Check your wallet — sign the message',
    verifying: 'Verifying signature...',
    done: 'Wallet bound successfully!',
    error: 'Retry',
  };

  const reset = () => {
    setStep('idle');
    setError('');
  };

  const handleBind = async () => {
    if (!connected || !publicKey || !signMessage) {
      setError('Please connect a Solana wallet that supports message signing.');
      setStep('error');
      return;
    }

    setError('');
    const walletAddress = publicKey.toBase58();

    try {
      // ── Step 1: Register the binding (creates a pending record + returns verificationMessage) ──
      setStep('binding');
      const bindResult = await bindWallet(walletAddress);
      if (!bindResult.success || !bindResult.bindingId || !bindResult.message) {
        setError(bindResult.message || 'Failed to initiate wallet binding.');
        setStep('error');
        return;
      }

      const { bindingId, message } = bindResult;

      // ── Step 2: Ask the wallet to sign the verification message ──
      setStep('signing');
      const messageBytes = new TextEncoder().encode(message);
      let signatureBytes: Uint8Array;
      try {
        signatureBytes = await signMessage(messageBytes);
      } catch (signErr) {
        // User rejected or wallet errored
        setError('Signature request was cancelled or failed. Please try again.');
        setStep('error');
        return;
      }

      const signatureB58 = bs58.encode(signatureBytes);

      // ── Step 3: Send signature to backend for Ed25519 verification ──
      setStep('verifying');
      const verified = await verifyWallet(bindingId, signatureB58, message);
      if (!verified) {
        setError('Signature verification failed. Please try again.');
        setStep('error');
        return;
      }

      setBoundAddress(walletAddress);
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
      setStep('error');
    }
  };

  const isLoading = step === 'binding' || step === 'signing' || step === 'verifying';
  const isDone = step === 'done';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl p-6 border border-primary/20"
    >
      <h3 className="text-xl font-gaming font-bold text-foreground mb-2">Bind Solana Wallet</h3>
      <p className="text-muted-foreground text-sm mb-6">
        Connect your wallet and sign a message to prove ownership. No transaction or gas fees required.
      </p>

      {/* Error */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-lg mb-4 flex gap-3 items-start text-sm"
        >
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <p>{error}</p>
        </motion.div>
      )}

      {/* Success */}
      {isDone && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-success/10 border border-success/30 text-success px-4 py-3 rounded-lg mb-4 flex gap-3 items-start text-sm"
        >
          <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold mb-0.5">Wallet bound and verified!</p>
            <p className="font-mono text-xs break-all opacity-80">{boundAddress}</p>
          </div>
        </motion.div>
      )}

      {/* Connected wallet display */}
      {connected && !isDone && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-primary/20 rounded-lg p-4 mb-6"
        >
          <p className="text-xs text-muted-foreground mb-1">Connected Wallet:</p>
          <p className="text-sm font-mono text-primary break-all">{publicKey?.toBase58()}</p>
        </motion.div>
      )}

      {/* Progress steps — shown while loading */}
      {isLoading && (
        <div className="space-y-2 mb-5">
          {(
            [
              { s: 'binding', icon: Wallet, label: 'Registering with server' },
              { s: 'signing', icon: KeyRound, label: 'Waiting for wallet signature' },
              { s: 'verifying', icon: ShieldCheck, label: 'Verifying on server' },
            ] as { s: Step; icon: React.FC<{ className?: string }>; label: string }[]
          ).map(({ s, icon: Icon, label }, i) => {
            const states: Step[] = ['binding', 'signing', 'verifying'];
            const currentIdx = states.indexOf(step);
            const thisIdx = states.indexOf(s);
            const active = step === s;
            const done = currentIdx > thisIdx;
            return (
              <div
                key={s}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${active
                  ? 'bg-primary/10 border border-primary/30 text-primary'
                  : done
                    ? 'text-muted-foreground/60'
                    : 'text-muted-foreground/30'
                  }`}
              >
                {active ? (
                  <Loader className="h-4 w-4 animate-spin shrink-0" />
                ) : done ? (
                  <CheckCircle className="h-4 w-4 text-success shrink-0" />
                ) : (
                  <Icon className="h-4 w-4 shrink-0" />
                )}
                {label}
              </div>
            );
          })}
        </div>
      )}

      {/* Action button */}
      {!isDone ? (
        <button
          onClick={step === 'error' ? reset : handleBind}
          disabled={!connected || isLoading}
          className="w-full bg-primary hover:bg-primary/90 disabled:bg-muted text-primary-foreground font-gaming font-semibold py-3 px-4 rounded-xl transition-all shadow-lg shadow-primary/20 hover:shadow-neon disabled:shadow-none flex items-center justify-center gap-2"
        >
          {isLoading && <Loader className="h-4 w-4 animate-spin" />}
          {STEP_LABELS[step]}
        </button>
      ) : (
        <button
          onClick={reset}
          className="w-full bg-card hover:bg-card/80 border border-primary/30 text-foreground font-gaming font-semibold py-3 px-4 rounded-xl transition-all text-sm"
        >
          Bind Another Wallet
        </button>
      )}

      <p className="text-xs text-muted-foreground mt-4">
        {!connected
          ? 'Connect your Solana wallet from the header to proceed.'
          : isDone
            ? 'Your wallet is now securely bound to this admin account.'
            : 'You will be asked to sign a message — this proves you own the wallet and costs no gas.'}
      </p>
    </motion.div>
  );
};