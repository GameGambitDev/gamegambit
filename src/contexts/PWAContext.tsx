'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { X, Smartphone, Share } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PWAContextType {
    canInstall: boolean
    install: () => Promise<void>
}

const PWAContext = createContext<PWAContextType>({
    canInstall: false,
    install: async () => { },
})

function ManualInstallModal({ onClose }: { onClose: () => void }) {
    const isIOS = /iphone|ipad|ipod/i.test(
        typeof navigator !== 'undefined' ? navigator.userAgent : ''
    )

    return (
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-4">
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-sm bg-card border border-border rounded-2xl p-6 shadow-2xl">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
                >
                    <X className="h-5 w-5" />
                </button>

                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-primary/10">
                        <Smartphone className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h3 className="font-gaming font-bold text-foreground">Install GameGambit</h3>
                        <p className="text-xs text-muted-foreground">Add to your home screen</p>
                    </div>
                </div>

                {isIOS ? (
                    <ol className="space-y-3 text-sm text-muted-foreground">
                        <li className="flex items-start gap-3">
                            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-bold">1</span>
                            <span>Tap the <Share className="inline h-4 w-4 text-primary" /> Share button at the bottom of your browser</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-bold">2</span>
                            <span>Scroll down and tap <strong className="text-foreground">Add to Home Screen</strong></span>
                        </li>
                        <li className="flex items-start gap-3">
                            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-bold">3</span>
                            <span>Tap <strong className="text-foreground">Add</strong> to confirm</span>
                        </li>
                    </ol>
                ) : (
                    <ol className="space-y-3 text-sm text-muted-foreground">
                        <li className="flex items-start gap-3">
                            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-bold">1</span>
                            <span>Tap the <strong className="text-foreground">⋮</strong> menu in your browser</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-bold">2</span>
                            <span>Tap <strong className="text-foreground">Add to Home Screen</strong> or <strong className="text-foreground">Install App</strong></span>
                        </li>
                        <li className="flex items-start gap-3">
                            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-bold">3</span>
                            <span>Tap <strong className="text-foreground">Install</strong> to confirm</span>
                        </li>
                    </ol>
                )}

                <Button variant="neon" className="w-full mt-6" onClick={onClose}>
                    Got it
                </Button>
            </div>
        </div>
    )
}

export function PWAProvider({ children }: { children: React.ReactNode }) {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
    const [isInstalled, setIsInstalled] = useState(false)
    const [showManual, setShowManual] = useState(false)

    useEffect(() => {
        // Check if already installed
        if (window.matchMedia('(display-mode: standalone)').matches) {
            setIsInstalled(true)
            return
        }

        const handler = (e: Event) => {
            e.preventDefault()
            setDeferredPrompt(e)
        }

        window.addEventListener('beforeinstallprompt', handler)

        // Also detect if installed after prompt
        window.addEventListener('appinstalled', () => setIsInstalled(true))

        return () => {
            window.removeEventListener('beforeinstallprompt', handler)
        }
    }, [])

    const install = async () => {
        if (deferredPrompt) {
            // Native prompt available — use it
            deferredPrompt.prompt()
            const { outcome } = await deferredPrompt.userChoice
            if (outcome === 'accepted') {
                setDeferredPrompt(null)
                setIsInstalled(true)
            }
        } else {
            // No prompt (iOS or Chrome suppressed it) — show manual instructions
            setShowManual(true)
        }
    }

    return (
        <PWAContext.Provider value={{ canInstall: !isInstalled, install }}>
            {children}
            {showManual && <ManualInstallModal onClose={() => setShowManual(false)} />}
        </PWAContext.Provider>
    )
}

export const usePWA = () => useContext(PWAContext)