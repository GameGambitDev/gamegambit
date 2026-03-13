'use client'

import { useEffect } from 'react'

export function PWAInstallPrompt() {
  useEffect(() => {
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
  }, [])

  return null
}

export function ServiceWorkerUpdater() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker.ready
      .then((registration) => {
        setInterval(() => {
          registration.update()
        }, 60 * 60 * 1000)

        navigator.serviceWorker.controller?.addEventListener('message', (event) => {
          if (event.data.type === 'UPDATE_AVAILABLE') {
            console.log('[PWA] Update available')
          }
        })
      })
      .catch((error) => {
        console.warn('[PWA] Service Worker not ready:', error)
      })
  }, [])

  return null
}