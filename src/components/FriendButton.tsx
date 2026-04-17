'use client'

import { useState } from 'react'
import { UserPlus, UserCheck, UserX, Clock, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useFriends } from '@/hooks/useFriends'
import { useWallet } from '@solana/wallet-adapter-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface FriendButtonProps {
    targetWallet: string
    size?: 'sm' | 'default'
    className?: string
}

export function FriendButton({ targetWallet, size = 'sm', className }: FriendButtonProps) {
    const { publicKey } = useWallet()
    const myWallet = publicKey?.toBase58() ?? null
    const [dropdownOpen, setDropdownOpen] = useState(false)

    const {
        getFriendshipStatus,
        getFriendship,
        sendRequest,
        acceptRequest,
        declineRequest,
        removeFriend,
    } = useFriends()

    // Don't render on own profile / when no wallet
    if (!myWallet || targetWallet === myWallet) return null

    const status = getFriendshipStatus(targetWallet)
    const friendship = getFriendship(targetWallet)

    const handleAdd = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        sendRequest.mutate(targetWallet, {
            onSuccess: () => toast.success('Friend request sent!'),
            onError: () => toast.error('Failed to send request'),
        })
    }

    const handleAccept = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (!friendship) return
        acceptRequest.mutate(friendship.id, {
            onSuccess: () => toast.success('Friend request accepted!'),
            onError: () => toast.error('Failed to accept request'),
        })
    }

    const handleDecline = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (!friendship) return
        declineRequest.mutate(friendship.id, {
            onSuccess: () => toast.success('Request declined'),
            onError: () => toast.error('Failed to decline request'),
        })
    }

    const handleRemove = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        removeFriend.mutate(targetWallet, {
            onSuccess: () => toast.success('Friend removed'),
            onError: () => toast.error('Failed to remove friend'),
        })
        setDropdownOpen(false)
    }

    const isLoading =
        sendRequest.isPending ||
        acceptRequest.isPending ||
        declineRequest.isPending ||
        removeFriend.isPending

    if (status === 'none') {
        return (
            <Button
                variant="outline"
                size={size}
                className={cn('gap-1', className)}
                onClick={handleAdd}
                disabled={isLoading}
            >
                <UserPlus className="h-3.5 w-3.5" />
                Add
            </Button>
        )
    }

    // FIXED: was a disabled static button — now a dropdown with Cancel option
    if (status === 'pending_sent') {
        return (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size={size}
                        className={cn('gap-1 text-muted-foreground', className)}
                        onClick={e => { e.preventDefault(); e.stopPropagation() }}
                    >
                        <Clock className="h-3.5 w-3.5" />
                        Pending
                        <ChevronDown className="h-3 w-3" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem
                        className="text-destructive focus:text-destructive cursor-pointer"
                        onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            if (!friendship) return
                            declineRequest.mutate(friendship.id, {
                                onSuccess: () => toast.success('Request cancelled'),
                                onError: () => toast.error('Failed to cancel'),
                            })
                        }}
                    >
                        <UserX className="h-3.5 w-3.5 mr-2" />
                        Cancel Request
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        )
    }

    if (status === 'pending_received') {
        return (
            <div className={cn('flex items-center gap-1', className)} onClick={e => { e.preventDefault(); e.stopPropagation() }}>
                <Button
                    variant="neon"
                    size={size}
                    className="gap-1"
                    onClick={handleAccept}
                    disabled={isLoading}
                >
                    <UserCheck className="h-3.5 w-3.5" />
                    Accept
                </Button>
                <Button
                    variant="ghost"
                    size={size}
                    className="gap-1 text-muted-foreground"
                    onClick={handleDecline}
                    disabled={isLoading}
                >
                    <UserX className="h-3.5 w-3.5" />
                    Decline
                </Button>
            </div>
        )
    }

    if (status === 'friends') {
        return (
            <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size={size}
                        className={cn('gap-1 text-success', className)}
                        onClick={e => { e.preventDefault(); e.stopPropagation() }}
                    >
                        <UserCheck className="h-3.5 w-3.5" />
                        Friends
                        <ChevronDown className="h-3 w-3" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem
                        className="text-destructive focus:text-destructive cursor-pointer"
                        onClick={handleRemove}
                    >
                        <UserX className="h-3.5 w-3.5 mr-2" />
                        Remove Friend
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        )
    }

    return null
}