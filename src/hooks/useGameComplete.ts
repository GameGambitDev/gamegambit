// src/hooks/useGameComplete.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useWalletAuth } from './useWalletAuth'
import { invokeSecureWager, Wager } from './useWagers'

export interface GameCompleteState {
    game_complete_a: boolean | null
    game_complete_b: boolean | null
    game_complete_deadline: string | null
}

export function useMarkGameComplete() {
    const queryClient = useQueryClient()
    const { getSessionToken } = useWalletAuth()

    return useMutation({
        mutationFn: async ({ wagerId }: { wagerId: string }) => {
            const sessionToken = await getSessionToken()
            if (!sessionToken) throw new Error('Wallet verification required.')
            const data = await invokeSecureWager<{ wager: Wager }>(
                { action: 'markGameComplete', wagerId },
                sessionToken
            )
            return data.wager
        },
        onSuccess: (wager) => {
            // Update the per-wager cache immediately so the modal sees the new
            // game_complete_a/b flag before the next Realtime event arrives.
            queryClient.setQueryData(['wagers', wager.id], wager)
            // Also invalidate so useWagerById refetches — covers the case where
            // setQueryData alone doesn't trigger a re-render of the modal.
            queryClient.invalidateQueries({ queryKey: ['wagers', wager.id] })
            queryClient.invalidateQueries({ queryKey: ['wagers', 'my'] })
        },
    })
}