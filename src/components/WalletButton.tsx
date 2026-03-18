'use client'

import { useState, useEffect, useRef } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'
import { Button } from '@/components/ui/button'
import { truncateAddress } from '@/lib/constants'
import { Smartphone, Monitor, ChevronDown, LogOut, Copy, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useWalletAuth } from '@/hooks/useWalletAuth'

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(
      /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent)
    )
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return isMobile
}

export function WalletButton() {
  const { connected, publicKey, disconnect, wallet } = useWallet()
  const { setVisible } = useWalletModal()
  const { clearSession } = useWalletAuth()
  const isMobile = useIsMobile()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [showMobileModal, setShowMobileModal] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // ── Auto-disconnect on session expiry ──────────────────────────────────────
  // useWagers.ts dispatches 'gg:session-expired' on any 401 from secure-wager.
  // We listen here and disconnect + clear token in one place.
  useEffect(() => {
    const handler = () => {
      clearSession()
      disconnect()
      setDropdownOpen(false)
      toast.error('Session expired — please reconnect your wallet.')
    }
    window.addEventListener('gg:session-expired', handler)
    return () => window.removeEventListener('gg:session-expired', handler)
  }, [clearSession, disconnect])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleConnect = () => {
    if (isMobile) {
      setShowMobileModal(true)
    } else {
      setVisible(true)
    }
  }

  const handleCopy = () => {
    if (publicKey) {
      navigator.clipboard.writeText(publicKey.toBase58())
      toast.success('Address copied!')
      setDropdownOpen(false)
    }
  }

  const handleDisconnect = () => {
    clearSession()
    disconnect()
    setDropdownOpen(false)
  }

  // Connected state — show address + dropdown
  if (connected && publicKey) {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className={cn(
            "flex items-center gap-1.5 px-2 sm:px-3 md:px-4 h-8 sm:h-9 md:h-10",
            "rounded-xl font-gaming text-xs sm:text-sm",
            "bg-primary text-primary-foreground",
            "hover:shadow-neon transition-all",
          )}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
          <span className="hidden sm:inline">{truncateAddress(publicKey.toBase58())}</span>
          <span className="sm:hidden">{truncateAddress(publicKey.toBase58(), 4)}</span>
          <ChevronDown className={cn("h-3 w-3 transition-transform", dropdownOpen && "rotate-180")} />
        </button>

        {dropdownOpen && (
          <div className="absolute right-0 top-full mt-2 w-52 bg-card border border-border rounded-xl shadow-lg z-[9999] overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <p className="text-xs text-muted-foreground">Connected with</p>
              <p className="text-sm font-medium truncate">{wallet?.adapter.name}</p>
            </div>
            <button
              onClick={handleCopy}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-muted transition-colors text-left"
            >
              <Copy className="h-3.5 w-3.5 text-muted-foreground" />
              Copy address
            </button>
            <a
              href={`https://explorer.solana.com/address/${publicKey.toBase58()}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setDropdownOpen(false)}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-muted transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
              View on Explorer
            </a>
            <button
              onClick={handleDisconnect}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors text-left border-t border-border"
            >
              <LogOut className="h-3.5 w-3.5" />
              Disconnect
            </button>
          </div>
        )}
      </div>
    )
  }

  // Not connected
  return (
    <>
      <button
        onClick={handleConnect}
        className={cn(
          "flex items-center gap-1.5 px-2 sm:px-3 md:px-4 h-8 sm:h-9 md:h-10",
          "rounded-xl font-gaming text-xs sm:text-sm",
          "bg-primary text-primary-foreground",
          "hover:shadow-neon transition-all",
        )}
      >
        Connect Wallet
      </button>

      {/* Mobile wallet picker modal */}
      {showMobileModal && (
        <MobileWalletModal
          onClose={() => setShowMobileModal(false)}
          onOpenDefault={() => { setShowMobileModal(false); setVisible(true) }}
        />
      )}
    </>
  )
}

// ── Mobile wallet modal ────────────────────────────────────────────────────────

function MobileWalletModal({
  onClose,
  onOpenDefault,
}: {
  onClose: () => void
  onOpenDefault: () => void
}) {
  const { select, wallets } = useWallet()

  const walletConnectAdapter = wallets.find(w =>
    w.adapter.name.toLowerCase().includes('walletconnect')
  )
  const phantomAdapter = wallets.find(w =>
    w.adapter.name.toLowerCase().includes('phantom')
  )
  const solflareAdapter = wallets.find(w =>
    w.adapter.name.toLowerCase().includes('solflare')
  )

  const handleSelect = (name: string) => {
    const found = wallets.find(w => w.adapter.name === name)
    if (found) {
      select(found.adapter.name)
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full sm:w-96 bg-card border border-border rounded-t-2xl sm:rounded-2xl p-5 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="font-gaming font-bold text-base">Connect Wallet</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg leading-none">✕</button>
        </div>

        {/* WalletConnect — recommended */}
        {walletConnectAdapter && (
          <button
            onClick={() => handleSelect(walletConnectAdapter.adapter.name)}
            className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-primary/40 bg-primary/5 hover:bg-primary/10 transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Smartphone className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">WalletConnect</span>
                <span className="text-[10px] px-1.5 py-0.5 bg-primary text-primary-foreground rounded-full font-medium">
                  Recommended
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Works in any browser — opens Phantom or Solflare to sign
              </p>
            </div>
          </button>
        )}

        {/* Divider */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">or use in-app browser</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Phantom + Solflare — secondary options */}
        <div className="space-y-2">
          {[phantomAdapter, solflareAdapter].filter(Boolean).map(w => w && (
            <button
              key={w.adapter.name}
              onClick={() => handleSelect(w.adapter.name)}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-muted transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                <Monitor className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">{w.adapter.name}</p>
                <p className="text-xs text-muted-foreground">Only works inside {w.adapter.name} browser</p>
              </div>
            </button>
          ))}
        </div>

        <p className="text-[11px] text-muted-foreground text-center">
          New to Solana? Download{' '}
          <a href="https://phantom.app" target="_blank" rel="noopener noreferrer" className="text-primary underline">
            Phantom
          </a>
          {' '}first
        </p>
      </div>
    </div>
  )
}