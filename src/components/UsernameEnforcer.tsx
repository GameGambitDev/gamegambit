import { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { usePlayer, useCreatePlayer } from '@/hooks/usePlayer';
import { UsernameSetupModal } from './UsernameSetupModal';

interface UsernameEnforcerProps {
  children: React.ReactNode;
}

export function UsernameEnforcer({ children }: UsernameEnforcerProps) {
  const { connected, publicKey } = useWallet();
  const { data: player, isLoading: playerLoading, refetch } = usePlayer();
  const createPlayer = useCreatePlayer();
  const [showModal, setShowModal] = useState(false);
  const [isCreatingPlayer, setIsCreatingPlayer] = useState(false);

  useEffect(() => {
    const ensurePlayer = async () => {
      if (!connected || !publicKey || playerLoading) return;
      
      // If no player exists, create one
      if (!player && !isCreatingPlayer) {
        setIsCreatingPlayer(true);
        try {
          await createPlayer.mutateAsync();
          await refetch();
        } catch (error) {
          console.error('Failed to create player:', error);
        } finally {
          setIsCreatingPlayer(false);
        }
      }
    };

    ensurePlayer();
  }, [connected, publicKey, player, playerLoading, isCreatingPlayer]);

  useEffect(() => {
    // Show modal if player exists but has no username
    if (connected && player && !player.username) {
      setShowModal(true);
    } else {
      setShowModal(false);
    }
  }, [connected, player]);

  const handleUsernameSet = () => {
    refetch();
    setShowModal(false);
  };

  // Determine if user needs to set username (connected but no username set)
  const needsUsername = connected && player && !player.username;

  return (
    <>
      {/* Render children but with overlay if username not set */}
      <div className={needsUsername ? 'pointer-events-none select-none' : ''}>
        {children}
      </div>
      
      {/* Blocking overlay when username required */}
      {needsUsername && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40" />
      )}
      
      <UsernameSetupModal open={showModal} onSuccess={handleUsernameSet} />
    </>
  );
}

// Hook to check if user has completed setup
export function useIsProfileComplete() {
  const { connected } = useWallet();
  const { data: player, isLoading } = usePlayer();
  
  return {
    isComplete: connected && player?.username ? true : false,
    isLoading: isLoading,
    username: player?.username,
    needsSetup: connected && player && !player.username,
  };
}
