'use client'

import { createContext, useContext, useEffect, useState } from 'react'

interface PWAContextType {
    canInstall: boolean
    install: () => Promise<void>
}

const PWAContext = createContext<PWAContextType>({
    canInstall: false,
    install: async () => { },
})

export function PWAProvider({ children }: { children: React.ReactNode }) {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null)

    useEffect(() => {
        const handler = (e: Event) => {
            e.preventDefault()
            setDeferredPrompt(e)
        }

        window.addEventListener('beforeinstallprompt', handler)
        return () => window.removeEventListener('beforeinstallprompt', handler)
    }, [])

    const install = async () => {
        if (!deferredPrompt) return
        deferredPrompt.prompt()
        const { outcome } = await deferredPrompt.userChoice
        if (outcome === 'accepted') setDeferredPrompt(null)
    }

    return (
        <PWAContext.Provider value={{ canInstall: !!deferredPrompt, install }}>
            {children}
        </PWAContext.Provider>
    )
}

export const usePWA = () => useContext(PWAContext)