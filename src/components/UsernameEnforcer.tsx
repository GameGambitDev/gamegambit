'use client'

import { useEffect, useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { usePlayer } from '@/hooks/usePlayer'
import { UsernameSetupModal } from './UsernameSetupModal'

interface UsernameEnforcerProps {
  children: React.ReactNode
}

export function UsernameEnforcer({ children }: UsernameEnforcerProps) {
  const { connected } = useWallet()
  const { data: player, refetch } = usePlayer()
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    if (connected && player && !player.username) {
      setShowModal(true)
    } else {
      setShowModal(false)
    }
  }, [connected, player])

  const handleUsernameSet = () => {
    refetch()
    setShowModal(false)
  }

  const needsUsername = connected && player && !player.username

  return (
    <>
      <div className={needsUsername ? 'pointer-events-none select-none' : ''}>
        {children}
      </div>

      {needsUsername && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40" />
      )}

      <UsernameSetupModal open={showModal} onSuccess={handleUsernameSet} />
    </>
  )
}

export function useIsProfileComplete() {
  const { connected } = useWallet()
  const { data: player, isLoading } = usePlayer()

  return {
    isComplete: connected && player?.username ? true : false,
    isLoading,
    username: player?.username,
    needsSetup: connected && player && !player.username,
  }
}