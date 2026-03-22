'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Send, Check, X, MessageSquare, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { useWagerChat, WagerMessage } from '@/hooks/useWagerChat'
import { Wager } from '@/hooks/useWagers'
import { truncateAddress, formatSol } from '@/lib/constants'
import { usePlayerByWallet } from '@/hooks/usePlayer'
import { cn } from '@/lib/utils'

interface WagerChatProps {
    wager: Wager
    currentWallet: string
    opponentWallet: string
}

// ── Proposal message card ─────────────────────────────────────────────────────

function ProposalCard({
    message,
    currentWallet,
    wagerId,
    onRespond,
}: {
    message: WagerMessage
    currentWallet: string
    wagerId: string
    onRespond: (id: string, status: 'accepted' | 'rejected', data: NonNullable<WagerMessage['proposal_data']>, wagerId: string) => void
}) {
    const isMine = message.sender_wallet === currentWallet
    const isPending = message.proposal_status === 'pending'
    const isAccepted = message.proposal_status === 'accepted'
    const isRejected = message.proposal_status === 'rejected'
    const [secs, setSecs] = useState(5)
    const [canRespond, setCanRespond] = useState(false)

    // 5-second lock before opponent can respond
    useEffect(() => {
        if (isMine || !isPending) { setCanRespond(true); return }
        setSecs(5)
        setCanRespond(false)
        let s = 5
        const interval = setInterval(() => {
            s--
            setSecs(s)
            if (s <= 0) { clearInterval(interval); setCanRespond(true) }
        }, 1000)
        return () => clearInterval(interval)
    }, [isMine, isPending, message.id])

    const data = message.proposal_data

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
                'rounded-xl border p-3 space-y-2',
                isAccepted ? 'bg-success/10 border-success/30' :
                    isRejected ? 'bg-muted/20 border-border opacity-60' :
                        'bg-amber-500/10 border-amber-500/30'
            )}
        >
            <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium text-amber-400 uppercase tracking-wide">
                    {isMine ? 'Your proposal' : 'Incoming proposal'}
                </span>
                <span className={cn(
                    'text-[10px] font-medium px-1.5 py-0.5 rounded',
                    isAccepted ? 'bg-success/20 text-success' :
                        isRejected ? 'bg-muted text-muted-foreground' :
                            'bg-amber-500/20 text-amber-400'
                )}>
                    {isAccepted ? '✓ Accepted' : isRejected ? '✗ Rejected' : 'Pending'}
                </span>
            </div>

            {data && (
                <div className="text-xs text-foreground font-medium">{data.label}</div>
            )}

            {!isMine && isPending && data && (
                <div className="flex gap-2 pt-1">
                    <Button
                        size="sm"
                        variant="destructive"
                        className="flex-1 h-7 text-xs"
                        disabled={!canRespond}
                        onClick={() => onRespond(message.id, 'rejected', data, wagerId)}
                    >
                        <X className="h-3 w-3 mr-1" /> Reject
                    </Button>
                    <Button
                        size="sm"
                        variant="default"
                        className="flex-1 h-7 text-xs bg-success hover:bg-success/90"
                        disabled={!canRespond}
                        onClick={() => onRespond(message.id, 'accepted', data, wagerId)}
                    >
                        {!canRespond
                            ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> {secs}s</>
                            : <><Check className="h-3 w-3 mr-1" /> Accept</>
                        }
                    </Button>
                </div>
            )}
        </motion.div>
    )
}

// ── Chat bubble ───────────────────────────────────────────────────────────────

function ChatBubble({
    message,
    currentWallet,
}: {
    message: WagerMessage
    currentWallet: string
}) {
    const isMine = message.sender_wallet === currentWallet
    const { data: sender } = usePlayerByWallet(message.sender_wallet)
    const time = new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

    return (
        <div className={cn('flex flex-col gap-0.5', isMine ? 'items-end' : 'items-start')}>
            <span className="text-[10px] text-muted-foreground px-1">
                {isMine ? 'You' : (sender?.username || truncateAddress(message.sender_wallet, 4))} · {time}
            </span>
            <div className={cn(
                'max-w-[80%] px-3 py-2 rounded-2xl text-sm',
                isMine
                    ? 'bg-primary text-primary-foreground rounded-tr-sm'
                    : 'bg-muted text-foreground rounded-tl-sm'
            )}>
                {message.message}
            </div>
        </div>
    )
}

// ── Main component ────────────────────────────────────────────────────────────

export function WagerChat({ wager, currentWallet, opponentWallet }: WagerChatProps) {
    const [collapsed, setCollapsed] = useState(false)
    const [input, setInput] = useState('')
    const { messages, loading, sending, sendMessage, respondToProposal, pendingProposals, bottomRef } = useWagerChat(wager.id)

    const unread = pendingProposals.length
    const isJoined = wager.status === 'joined'

    const handleSend = () => {
        if (!input.trim()) return
        sendMessage(input)
        setInput('')
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
    }

    return (
        <div className="border border-border rounded-xl bg-card overflow-hidden">
            {/* Header */}
            <button
                onClick={() => setCollapsed(!collapsed)}
                className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/30 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    <span className="text-sm font-gaming">Chat</span>
                    {unread > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-[10px] font-bold text-black">
                            {unread} proposal{unread > 1 ? 's' : ''}
                        </span>
                    )}
                </div>
                {collapsed ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
            </button>

            <AnimatePresence>
                {!collapsed && (
                    <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                        className="overflow-hidden"
                    >
                        {/* Messages area */}
                        <div className="h-48 overflow-y-auto px-3 py-2 space-y-2 border-t border-border">
                            {loading ? (
                                <div className="flex justify-center pt-4">
                                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                </div>
                            ) : messages.length === 0 ? (
                                <p className="text-center text-xs text-muted-foreground pt-6">
                                    No messages yet. Say hi to your opponent!
                                </p>
                            ) : (
                                messages.map((msg) =>
                                    msg.message_type === 'proposal' ? (
                                        <ProposalCard
                                            key={msg.id}
                                            message={msg}
                                            currentWallet={currentWallet}
                                            wagerId={wager.id}
                                            onRespond={respondToProposal}
                                        />
                                    ) : (
                                        <ChatBubble key={msg.id} message={msg} currentWallet={currentWallet} />
                                    )
                                )
                            )}
                            <div ref={bottomRef} />
                        </div>

                        {/* Input */}
                        <div className="flex gap-2 p-2 border-t border-border">
                            <Input
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={isJoined ? "Type a message..." : "Chat available in ready room"}
                                disabled={!isJoined || sending}
                                className="h-8 text-xs bg-muted/30 border-border"
                                maxLength={200}
                            />
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 flex-shrink-0"
                                disabled={!input.trim() || !isJoined || sending}
                                onClick={handleSend}
                            >
                                {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                            </Button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}