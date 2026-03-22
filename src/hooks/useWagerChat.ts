import { useState, useEffect, useCallback, useRef } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { getSupabaseClient } from '@/integrations/supabase/client'
import { useEditWager, Wager } from '@/hooks/useWagers'
import { toast } from 'sonner'

export interface WagerMessage {
    id: string
    wager_id: string
    sender_wallet: string
    message: string
    message_type: 'chat' | 'proposal'
    proposal_data: ProposalData | null
    proposal_status: 'pending' | 'accepted' | 'rejected' | null
    created_at: string
}

export interface ProposalData {
    field: 'stake_lamports' | 'is_public' | 'stream_url'
    old_value: number | boolean | string | null
    new_value: number | boolean | string | null
    label: string
}

// wager_messages is not yet in the generated Supabase types.
// Cast to any at the query boundary until types are regenerated.
const db = () => getSupabaseClient() as any

export function useWagerChat(wagerId: string | null) {
    const { publicKey } = useWallet()
    const wallet = publicKey?.toBase58()
    const [messages, setMessages] = useState<WagerMessage[]>([])
    const [loading, setLoading] = useState(false)
    const [sending, setSending] = useState(false)
    const editWager = useEditWager()
    const bottomRef = useRef<HTMLDivElement | null>(null)

    // Initial fetch
    useEffect(() => {
        if (!wagerId) return
        setLoading(true)
        db()
            .from('wager_messages')
            .select('*')
            .eq('wager_id', wagerId)
            .order('created_at', { ascending: true })
            .then(({ data, error }: { data: WagerMessage[] | null; error: any }) => {
                if (error) {
                    console.error('[useWagerChat] Failed to fetch messages:', error)
                    toast.error('Failed to load chat messages')
                } else if (data) {
                    setMessages(data)
                }
                setLoading(false)
            })
    }, [wagerId])

    // Realtime subscription
    useEffect(() => {
        if (!wagerId) return
        const supabase = getSupabaseClient()
        const channel = supabase
            .channel(`wager-chat:${wagerId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'wager_messages',
                filter: `wager_id=eq.${wagerId}`,
            }, (payload: any) => {
                if (payload.eventType === 'INSERT') {
                    setMessages(prev => {
                        // Deduplicate in case optimistic insert already added it
                        if (prev.some(m => m.id === payload.new.id)) return prev
                        return [...prev, payload.new as WagerMessage]
                    })
                } else if (payload.eventType === 'UPDATE') {
                    setMessages(prev => prev.map(m =>
                        m.id === payload.new.id ? (payload.new as WagerMessage) : m
                    ))
                }
            })
            .subscribe((status: string) => {
                if (status === 'CHANNEL_ERROR') {
                    console.error('[useWagerChat] Realtime subscription error for', wagerId)
                }
            })
        return () => { supabase.removeChannel(channel) }
    }, [wagerId])

    // Scroll to bottom when new messages arrive
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    const sendMessage = useCallback(async (text: string) => {
        if (!wagerId || !wallet || !text.trim()) return
        setSending(true)
        try {
            const { error } = await db().from('wager_messages').insert({
                wager_id: wagerId,
                sender_wallet: wallet,
                message: text.trim(),
                message_type: 'chat',
            })
            if (error) throw error
        } catch (err) {
            console.error('[useWagerChat] sendMessage error:', err)
            toast.error('Failed to send message')
        } finally {
            setSending(false)
        }
    }, [wagerId, wallet])

    const sendProposal = useCallback(async (wager: Wager, updates: {
        stake_lamports?: number
        is_public?: boolean
        stream_url?: string
    }) => {
        if (!wagerId || !wallet) return
        setSending(true)
        try {
            const proposals: Omit<WagerMessage, 'id' | 'created_at'>[] = []

            if (updates.stake_lamports !== undefined && updates.stake_lamports !== wager.stake_lamports) {
                proposals.push({
                    wager_id: wagerId,
                    sender_wallet: wallet,
                    message: `Proposed stake change: ${(wager.stake_lamports / 1e9).toFixed(4)} SOL → ${(updates.stake_lamports / 1e9).toFixed(4)} SOL`,
                    message_type: 'proposal',
                    proposal_data: {
                        field: 'stake_lamports',
                        old_value: wager.stake_lamports,
                        new_value: updates.stake_lamports,
                        label: `Stake: ${(wager.stake_lamports / 1e9).toFixed(4)} → ${(updates.stake_lamports / 1e9).toFixed(4)} SOL`,
                    },
                    proposal_status: 'pending',
                })
            }

            if (updates.is_public !== undefined && updates.is_public !== wager.is_public) {
                proposals.push({
                    wager_id: wagerId,
                    sender_wallet: wallet,
                    message: `Proposed visibility change: ${wager.is_public ? 'Public' : 'Private'} → ${updates.is_public ? 'Public' : 'Private'}`,
                    message_type: 'proposal',
                    proposal_data: {
                        field: 'is_public',
                        old_value: wager.is_public,
                        new_value: updates.is_public,
                        label: `Visibility: ${wager.is_public ? 'Public' : 'Private'} → ${updates.is_public ? 'Public' : 'Private'}`,
                    },
                    proposal_status: 'pending',
                })
            }

            if (updates.stream_url !== undefined && updates.stream_url !== (wager.stream_url ?? '')) {
                proposals.push({
                    wager_id: wagerId,
                    sender_wallet: wallet,
                    message: `Stream URL updated`,
                    message_type: 'proposal',
                    proposal_data: {
                        field: 'stream_url',
                        old_value: wager.stream_url ?? null,
                        new_value: updates.stream_url || null,
                        label: `Stream: ${updates.stream_url || '(removed)'}`,
                    },
                    proposal_status: 'pending',
                })
            }

            if (proposals.length === 0) {
                toast.info('No changes to propose')
                return
            }

            const { error } = await db().from('wager_messages').insert(proposals)
            if (error) throw error
            toast.success(`${proposals.length} proposal${proposals.length > 1 ? 's' : ''} sent to opponent`)
        } catch (err) {
            console.error('[useWagerChat] sendProposal error:', err)
            toast.error('Failed to send proposal')
        } finally {
            setSending(false)
        }
    }, [wagerId, wallet])

    const respondToProposal = useCallback(async (
        messageId: string,
        status: 'accepted' | 'rejected',
        proposalData: ProposalData,
        wagerId: string
    ) => {
        try {
            const { error: updateError } = await db()
                .from('wager_messages')
                .update({ proposal_status: status })
                .eq('id', messageId)
            if (updateError) throw updateError

            if (status === 'accepted') {
                const updates: Record<string, unknown> = {}
                updates[proposalData.field] = proposalData.new_value
                await editWager.mutateAsync({ wagerId, ...updates as any })
                toast.success('Change accepted and applied')
            } else {
                toast.info('Change rejected')
            }
        } catch (err) {
            console.error('[useWagerChat] respondToProposal error:', err)
            toast.error('Failed to respond to proposal')
        }
    }, [editWager])

    const pendingProposals = messages.filter(
        m => m.message_type === 'proposal' && m.proposal_status === 'pending' && m.sender_wallet !== wallet
    )

    return {
        messages,
        loading,
        sending,
        sendMessage,
        sendProposal,
        respondToProposal,
        pendingProposals,
        bottomRef,
    }
}