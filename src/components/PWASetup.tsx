'use client'

import { useEffect, useState } from 'react'

declare global {
  interface Window {
    deferredPrompt?: any
  }
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showPrompt, setShowPrompt] = useState(false)

  useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((registration) => {
          console.log('[PWA] Service Worker registered:', registration)
        })
        .catch((error) => {
          console.warn('[PWA] Service Worker registration failed:', error)
        })
    }

    // Handle install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShowPrompt(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === 'accepted') {
      console.log('[PWA] App installed')
      setShowPrompt(false)
    }

    setDeferredPrompt(null)
  }

  // Don't show prompt - let OS handle it
  // Return null to hide UI prompt
  return null
}

export function ServiceWorkerUpdater() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker.ready
      .then((registration) => {
        // Check for updates every hour
        setInterval(() => {
          registration.update()
        }, 60 * 60 * 1000)

        // Listen for controller change
        navigator.serviceWorker.controller?.addEventListener('message', (event) => {
          if (event.data.type === 'UPDATE_AVAILABLE') {
            console.log('[PWA] Update available')
            // Optionally show update notification
          }
        })
      })
      .catch((error) => {
        console.warn('[PWA] Service Worker not ready:', error)
      })
  }, [])

  return null
}
