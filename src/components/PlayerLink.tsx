'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { truncateAddress } from '@/lib/constants'

interface PlayerLinkProps {
  walletAddress: string
  username?: string | null
  className?: string
  showFullAddress?: boolean
}

export function PlayerLink({ walletAddress, username, className, showFullAddress }: PlayerLinkProps) {
  const displayName = username || (showFullAddress ? walletAddress : truncateAddress(walletAddress))
  
  return (
    <Link 
      href={`/profile/${walletAddress}`}
      className={cn(
        "hover:text-primary hover:underline transition-colors cursor-pointer",
        className
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {displayName}
    </Link>
  )
}
