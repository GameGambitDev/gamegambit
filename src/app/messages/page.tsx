'use client'

import { Suspense, useState, useEffect, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useWallet } from '@solana/wallet-adapter-react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import {
    MessageCircle, Send, Swords, ArrowLeft, User, Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { truncateAddress } from '@/lib/constants'
import { useFriends, useDirectMessages, getDmChannelId } from '@/hooks/useFriends'
import { usePlayerByWallet } from '@/hooks/usePlayer'
import type { DirectMessage } from '@/hooks/useFriends'

// ── Time helper ───────────────────────────────────────────────────────────────
function formatTimeAgo(ts: string): string {
    const diffMs = Date.now() - new Date(ts).getTime()
    const mins = Math.floor(diffMs / 60_000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
}

// ── Conversation header with player name + challenge button ───────────────────
function ConversationHeader({ wallet, onBack }: { wallet: string; onBack: () => void }) {
    const { data: player } = usePlayerByWallet(wallet)
    const router = useRouter()

    return (
        <div className="flex items-center gap-3 p-4 border-b border-border/50 flex-shrink-0">
            <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 md:hidden"
                onClick={onBack}
            >
                <ArrowLeft className="h-4 w-4" />
            </Button>

            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 border border-primary/30 flex items-center justify-center flex-shrink-0">
                <User className="h-4 w-4 text-primary" />
            </div>

            <div className="flex-1 min-w-0">
                <div className="font-gaming text-sm truncate">
                    {player?.username || truncateAddress(wallet, 6)}
                </div>
                <Link href={`/profile/${wallet}`} className="text-xs text-muted-foreground hover:text-primary transition-colors">
                    View profile →
                </Link>
            </div>

            <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs flex-shrink-0"
                onClick={() => router.push(`/arena?challenge=${wallet}`)}
            >
                <Swords className="h-3.5 w-3.5" />
                Challenge
            </Button>
        </div>
    )
}

// ── Single message bubble ─────────────────────────────────────────────────────
function MessageBubble({ msg, isMe }: { msg: DirectMessage; isMe: boolean }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn('flex', isMe ? 'justify-end' : 'justify-start')}
        >
            <div
                className={cn(
                    'max-w-[75%] px-3 py-2 rounded-2xl text-sm',
                    isMe
                        ? 'bg-primary text-primary-foreground rounded-br-sm'
                        : 'bg-muted text-foreground rounded-bl-sm',
                )}
            >
                <p className="break-words">{msg.message}</p>
                <p className={cn('text-[10px] mt-1', isMe ? 'text-primary-foreground/60 text-right' : 'text-muted-foreground')}>
                    {formatTimeAgo(msg.created_at)}
                    {isMe && msg.read_at && <span className="ml-1">·  read</span>}
                </p>
            </div>
        </motion.div>
    )
}

// ── Chat pane ─────────────────────────────────────────────────────────────────
function ChatPane({ otherWallet, onBack }: { otherWallet: string; onBack: () => void }) {
    const { publicKey } = useWallet()
    const myWallet = publicKey?.toBase58() ?? ''
    const [input, setInput] = useState('')
    const bottomRef = useRef<HTMLDivElement>(null)
    const { messages, isLoading, sendMessage, markRead } = useDirectMessages(otherWallet)

    // Scroll to bottom on new messages
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    // Mark read when pane opens or new messages arrive
    useEffect(() => {
        markRead.mutate()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [messages.length])

    const handleSend = () => {
        const text = input.trim()
        if (!text || sendMessage.isPending) return
        sendMessage.mutate(text)
        setInput('')
    }

    return (
        <div className="flex flex-col h-full">
            <ConversationHeader wallet={otherWallet} onBack={onBack} />

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                {isLoading && (
                    <div className="flex justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                )}
                {!isLoading && messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
                        <MessageCircle className="h-10 w-10 text-muted-foreground/30" />
                        <p className="text-sm text-muted-foreground">No messages yet</p>
                        <p className="text-xs text-muted-foreground/60">Say something or challenge them to a wager</p>
                    </div>
                )}
                {messages.map((msg) => (
                    <MessageBubble key={msg.id} msg={msg} isMe={msg.sender_wallet === myWallet} />
                ))}
                <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t border-border/50 flex-shrink-0">
                <div className="flex gap-2">
                    <input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                        placeholder="Message..."
                        className="flex-1 bg-muted/50 border border-border/50 rounded-xl px-3 py-2 text-sm outline-none focus:border-primary/50 transition-colors"
                    />
                    <Button
                        size="icon"
                        className="h-9 w-9 flex-shrink-0"
                        onClick={handleSend}
                        disabled={!input.trim() || sendMessage.isPending}
                    >
                        {sendMessage.isPending
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <Send className="h-4 w-4" />}
                    </Button>
                </div>
            </div>
        </div>
    )
}

// ── Conversation list item ────────────────────────────────────────────────────
function ConversationItem({
    wallet,
    isActive,
    myWallet,
    onClick,
}: {
    wallet: string
    isActive: boolean
    myWallet: string
    onClick: () => void
}) {
    const { data: player } = usePlayerByWallet(wallet)
    const channelId = getDmChannelId(myWallet, wallet)
    const { messages } = useDirectMessages(wallet)
    const lastMsg = messages[messages.length - 1]
    const unread = messages.filter((m) => m.sender_wallet !== myWallet && !m.read_at).length

    return (
        <button
            onClick={onClick}
            className={cn(
                'w-full flex items-center gap-3 px-4 py-3 text-left transition-all hover:bg-muted/50',
                isActive && 'bg-primary/10 border-r-2 border-primary',
            )}
        >
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 border border-primary/30 flex items-center justify-center flex-shrink-0">
                <User className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                    <span className="font-gaming text-sm truncate">
                        {player?.username || truncateAddress(wallet, 4)}
                    </span>
                    {lastMsg && (
                        <span className="text-[10px] text-muted-foreground flex-shrink-0">
                            {formatTimeAgo(lastMsg.created_at)}
                        </span>
                    )}
                </div>
                {lastMsg && (
                    <p className="text-xs text-muted-foreground truncate">
                        {lastMsg.sender_wallet === myWallet ? 'You: ' : ''}{lastMsg.message}
                    </p>
                )}
            </div>
            {unread > 0 && (
                <span className="flex-shrink-0 h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                    {unread > 9 ? '9+' : unread}
                </span>
            )}
        </button>
    )
}

// ── Main inner component (uses useSearchParams so needs Suspense) ─────────────
function MessagesInner() {
    const { publicKey } = useWallet()
    const myWallet = publicKey?.toBase58() ?? null
    const searchParams = useSearchParams()
    const router = useRouter()

    const { friendWallets, friendsLoading } = useFriends()
    const [activeWallet, setActiveWallet] = useState<string | null>(
        searchParams.get('with') ?? null,
    )

    // If ?with= param changes, open that conversation
    useEffect(() => {
        const w = searchParams.get('with')
        if (w) setActiveWallet(w)
    }, [searchParams])

    const handleSelect = (wallet: string) => {
        setActiveWallet(wallet)
        // Update URL without full navigation
        const url = new URL(window.location.href)
        url.searchParams.set('with', wallet)
        window.history.pushState({}, '', url.toString())
    }

    const handleBack = () => {
        setActiveWallet(null)
        const url = new URL(window.location.href)
        url.searchParams.delete('with')
        window.history.pushState({}, '', url.toString())
    }

    if (!myWallet) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
                <MessageCircle className="h-14 w-14 text-muted-foreground/30" />
                <h2 className="font-gaming text-lg">Connect your wallet</h2>
                <p className="text-sm text-muted-foreground">You need to connect your wallet to view messages</p>
            </div>
        )
    }

    // All wallets you can DM — friends list + any ?with= wallet not yet a friend
    const dmWallets = activeWallet && !friendWallets.includes(activeWallet)
        ? [activeWallet, ...friendWallets]
        : friendWallets

    return (
        <div className="flex h-full">
            {/* ── Sidebar ───────────────────────────────────────────────────── */}
            <div
                className={cn(
                    'flex flex-col border-r border-border/50 flex-shrink-0',
                    'w-full md:w-72 lg:w-80',
                    // On mobile hide sidebar when a chat is open
                    activeWallet ? 'hidden md:flex' : 'flex',
                )}
            >
                {/* Sidebar header */}
                <div className="px-4 py-4 border-b border-border/50 flex-shrink-0">
                    <h1 className="font-gaming text-base text-foreground">Messages</h1>
                    <p className="text-xs text-muted-foreground mt-0.5">Your friend conversations</p>
                </div>

                {/* Conversation list */}
                <div className="flex-1 overflow-y-auto">
                    {friendsLoading && (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                    )}
                    {!friendsLoading && dmWallets.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-16 px-4 text-center gap-3">
                            <MessageCircle className="h-10 w-10 text-muted-foreground/30" />
                            <p className="text-sm text-muted-foreground">No conversations yet</p>
                            <p className="text-xs text-muted-foreground/60">
                                Add friends to start messaging them
                            </p>
                            <Link href="/leaderboard">
                                <Button variant="outline" size="sm" className="mt-1 text-xs gap-1.5">
                                    Find Players
                                </Button>
                            </Link>
                        </div>
                    )}
                    <AnimatePresence>
                        {dmWallets.map((wallet) => (
                            <motion.div
                                key={wallet}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                            >
                                <ConversationItem
                                    wallet={wallet}
                                    isActive={activeWallet === wallet}
                                    myWallet={myWallet}
                                    onClick={() => handleSelect(wallet)}
                                />
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            </div>

            {/* ── Chat pane ─────────────────────────────────────────────────── */}
            <div
                className={cn(
                    'flex-1 flex flex-col',
                    !activeWallet ? 'hidden md:flex' : 'flex',
                )}
            >
                {activeWallet ? (
                    <ChatPane otherWallet={activeWallet} onBack={handleBack} />
                ) : (
                    <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
                        <MessageCircle className="h-14 w-14 text-muted-foreground/20" />
                        <p className="text-sm text-muted-foreground">Select a conversation</p>
                    </div>
                )}
            </div>
        </div>
    )
}

// ── Page wrapper with Suspense (required for useSearchParams) ─────────────────
export default function MessagesPage() {
    return (
        <div className="container mx-auto px-0 sm:px-4 pt-16 sm:pt-20 h-screen flex flex-col">
            <Card className="flex-1 overflow-hidden border-border/50">
                <CardContent className="p-0 h-full">
                    <Suspense fallback={
                        <div className="flex items-center justify-center h-full">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    }>
                        <MessagesInner />
                    </Suspense>
                </CardContent>
            </Card>
        </div>
    )
}