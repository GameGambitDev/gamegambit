'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useWallet } from '@solana/wallet-adapter-react'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'
import { truncateAddress } from '@/lib/constants'
import { Smartphone, ChevronDown, LogOut, Copy, ExternalLink, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useWalletAuth } from '@/hooks/useWalletAuth'

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return isMobile
}

// Detect if we're in a wallet's built-in browser (Phantom, Solflare, etc.)
function useIsWalletBrowser() {
  const [isWalletBrowser, setIsWalletBrowser] = useState(false)
  useEffect(() => {
    const ua = navigator.userAgent
    const isWallet =
      !!(window as any).solana ||
      !!(window as any).phantom ||
      !!(window as any).solflare ||
      /Phantom|Solflare|MisesBrowser|Kiwi/i.test(ua)
    setIsWalletBrowser(isWallet)
  }, [])
  return isWalletBrowser
}

export function WalletButton() {
  const { connected, publicKey, disconnect, wallet } = useWallet()
  const { setVisible } = useWalletModal()
  const { clearSession } = useWalletAuth()
  const isMobile = useIsMobile()
  const isWalletBrowser = useIsWalletBrowser()
  const [open, setOpen] = useState(false)
  const [showMobileConnectModal, setShowMobileConnectModal] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [dropdownPos, setDropdownPos] = useState<{ top: number; right: number } | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  // Auto-disconnect on session expiry
  useEffect(() => {
    const handler = () => {
      clearSession()
      disconnect()
      setOpen(false)
      toast.error('Session expired — please reconnect your wallet.')
    }
    window.addEventListener('gg:session-expired', handler)
    return () => window.removeEventListener('gg:session-expired', handler)
  }, [clearSession, disconnect])

  // Close desktop dropdown on outside click or scroll
  useEffect(() => {
    if (!open || isMobile) return
    const handleOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) setOpen(false)
    }
    const handleScroll = () => setOpen(false)
    document.addEventListener('mousedown', handleOutside)
    window.addEventListener('scroll', handleScroll, true)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [open, isMobile])

  const openDropdown = useCallback(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      const dropdownWidth = 208
      const rawRight = window.innerWidth - rect.right
      const right = Math.max(8, Math.min(rawRight, window.innerWidth - dropdownWidth - 8))
      setDropdownPos({ top: rect.bottom + 8, right })
    }
    setOpen(true)
  }, [])

  const handleCopy = () => {
    if (publicKey) {
      navigator.clipboard.writeText(publicKey.toBase58())
      toast.success('Address copied!')
      setOpen(false)
    }
  }

  const handleDisconnect = () => {
    clearSession()
    disconnect()
    setOpen(false)
  }

  const handleConnect = () => {
    if (isMobile) {
      setShowMobileConnectModal(true)
    } else {
      setVisible(true)
    }
  }

  // ── Connected ──────────────────────────────────────────────────────────────
  if (connected && publicKey) {
    return (
      <>
        <button
          ref={buttonRef}
          onClick={() => isMobile ? setOpen(true) : (open ? setOpen(false) : openDropdown())}
          className={cn(
            "flex items-center gap-1.5 px-2 sm:px-3 md:px-4 h-8 sm:h-9 md:h-10",
            "rounded-xl font-gaming text-xs sm:text-sm",
            "bg-primary text-primary-foreground hover:shadow-neon transition-all",
          )}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
          <span className="hidden sm:inline">{truncateAddress(publicKey.toBase58())}</span>
          <span className="sm:hidden">{truncateAddress(publicKey.toBase58(), 4)}</span>
          <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
        </button>

        {mounted && open && createPortal(
          isMobile
            ? /* ── Mobile: bottom sheet ─────────────────────────────────── */
            <div
              className="fixed inset-0 flex items-end justify-center bg-black/60 backdrop-blur-sm"
              style={{ zIndex: 2147483647 }}
              onClick={() => setOpen(false)}
            >
              <div
                className="w-full bg-card border-t border-border rounded-t-2xl overflow-hidden"
                onClick={e => e.stopPropagation()}
              >
                {/* Handle bar */}
                <div className="flex justify-center pt-3 pb-1">
                  <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
                </div>

                {/* Wallet info */}
                <div className="px-5 py-4 border-b border-border flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Wallet className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Connected with {wallet?.adapter.name}</p>
                    <p className="text-sm font-mono font-medium">{truncateAddress(publicKey.toBase58(), 8)}</p>
                  </div>
                </div>

                {/* Actions */}
                <button
                  onClick={handleCopy}
                  className="w-full flex items-center gap-3 px-5 py-4 text-sm hover:bg-muted transition-colors text-left border-b border-border/40"
                >
                  <Copy className="h-4 w-4 text-muted-foreground" />
                  Copy address
                </button>
                <a
                  href={`https://explorer.solana.com/address/${publicKey.toBase58()}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                  className="w-full flex items-center gap-3 px-5 py-4 text-sm hover:bg-muted transition-colors border-b border-border/40"
                >
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  View on Explorer
                </a>
                <button
                  onClick={handleDisconnect}
                  className="w-full flex items-center gap-3 px-5 py-4 text-sm text-destructive hover:bg-destructive/10 transition-colors text-left"
                >
                  <LogOut className="h-4 w-4" />
                  Disconnect
                </button>
                {/* iOS safe area */}
                <div className="h-6" />
              </div>
            </div>

            : /* ── Desktop: floating dropdown ───────────────────────────── */
            <div
              ref={dropdownRef}
              className="fixed w-52 bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
              style={{ top: dropdownPos?.top, right: dropdownPos?.right, zIndex: 2147483647 }}
            >
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
                onClick={() => setOpen(false)}
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
            </div>,
          document.body
        )}
      </>
    )
  }

  // ── Not connected ──────────────────────────────────────────────────────────
  return (
    <>
      <button
        onClick={handleConnect}
        className={cn(
          "flex items-center gap-1.5 px-2 sm:px-3 md:px-4 h-8 sm:h-9 md:h-10",
          "rounded-xl font-gaming text-xs sm:text-sm",
          "bg-primary text-primary-foreground hover:shadow-neon transition-all",
        )}
      >
        Connect Wallet
      </button>

      {showMobileConnectModal && (
        <MobileWalletModal
          isWalletBrowser={isWalletBrowser}
          onClose={() => setShowMobileConnectModal(false)}
          onOpenDefault={() => { setShowMobileConnectModal(false); setVisible(true) }}
        />
      )}
    </>
  )
}

// ── Mobile wallet connect modal ────────────────────────────────────────────

function MobileWalletModal({
  onClose,
  onOpenDefault,
  isWalletBrowser,
}: {
  onClose: () => void
  onOpenDefault: () => void
  isWalletBrowser: boolean
}) {
  const { select, wallets } = useWallet()

  const walletConnectAdapter = wallets.find(w => w.adapter.name.toLowerCase().includes('walletconnect'))
  const phantomAdapter = wallets.find(w => w.adapter.name.toLowerCase().includes('phantom'))
  const solflareAdapter = wallets.find(w => w.adapter.name.toLowerCase().includes('solflare'))

  const handleSelect = (name: string) => {
    const found = wallets.find(w => w.adapter.name === name)
    if (found) { select(found.adapter.name); onClose() }
  }

  return (
    <div
      className="fixed inset-0 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      style={{ zIndex: 2147483647 }}
      onClick={onClose}
    >
      <div
        className="w-full sm:w-96 bg-card border border-border rounded-t-2xl sm:rounded-2xl p-5 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-gaming font-bold text-base">Connect Wallet</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg leading-none">✕</button>
        </div>

        {/* WalletConnect — always shown on mobile */}
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
                <span className="text-[10px] px-1.5 py-0.5 bg-primary text-primary-foreground rounded-full font-medium">Recommended</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Works in any browser — opens Phantom or Solflare to sign</p>
            </div>
          </button>
        )}

        {/* Phantom + Solflare — only shown inside wallet browsers where extensions work */}
        {isWalletBrowser && (
          <>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">or select wallet directly</span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <div className="space-y-2">
              {[phantomAdapter, solflareAdapter].filter(Boolean).map(w => w && (
                <button
                  key={w.adapter.name}
                  onClick={() => handleSelect(w.adapter.name)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-muted transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <Wallet className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{w.adapter.name}</p>
                    <p className="text-xs text-muted-foreground">Detected in this browser</p>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Warning for regular mobile Chrome/Safari */}
        {!isWalletBrowser && (
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <p className="text-xs text-muted-foreground">
              <span className="text-amber-400 font-medium">Tip:</span> For direct wallet connection, open this app inside{' '}
              <span className="text-amber-400">Phantom's browser</span>,{' '}
              <span className="text-amber-400">Mises</span>, or{' '}
              <span className="text-amber-400">Kiwi Browser</span>.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}