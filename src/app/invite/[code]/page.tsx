'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { Swords, Users, Trophy, ArrowRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { getSupabaseClient } from '@/integrations/supabase/client'
import { truncateAddress } from '@/lib/constants'

const REFERRAL_COOKIE = 'gg_referrer'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

function setReferralCookie(code: string) {
    if (typeof document === 'undefined') return
    document.cookie = `${REFERRAL_COOKIE}=${encodeURIComponent(code)}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`
}

interface ReferrerInfo {
    username: string | null
    wallet_address: string
    total_wins: number | null
    referral_count: number
}

export default function InvitePage({ params }: { params: Promise<{ code: string }> }) {
    const { code } = use(params)
    const router = useRouter()
    const [referrer, setReferrer] = useState<ReferrerInfo | null>(null)
    const [loading, setLoading] = useState(true)
    const [notFound, setNotFound] = useState(false)

    useEffect(() => {
        async function loadReferrer() {
            const { data, error } = await getSupabaseClient()
                .from('players')
                .select('username, wallet_address, total_wins, referral_count')
                .eq('invite_code', code)
                .single()

            if (error || !data) {
                setNotFound(true)
            } else {
                setReferrer(data as ReferrerInfo)
                // Store cookie immediately — even before they connect wallet
                setReferralCookie(code)
            }
            setLoading(false)
        }
        loadReferrer()
    }, [code])

    const handleJoin = () => {
        // Cookie already set on load — just send them to the arena
        router.push('/arena')
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (notFound) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4">
                <Card className="max-w-md w-full">
                    <CardContent className="p-8 text-center">
                        <div className="text-4xl mb-4">🤔</div>
                        <h1 className="font-gaming text-xl mb-2">Invite Not Found</h1>
                        <p className="text-sm text-muted-foreground mb-6">
                            This invite link is invalid or has expired.
                        </p>
                        <Button onClick={() => router.push('/arena')} className="gap-2">
                            Explore GameGambit <ArrowRight className="h-4 w-4" />
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    const displayName = referrer?.username || truncateAddress(referrer?.wallet_address ?? '', 6)

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
            {/* Background glow */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-3xl" />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="max-w-md w-full"
            >
                {/* Logo */}
                <div className="flex justify-center mb-8">
                    <div className="flex items-center gap-2">
                        <Image src="/logo.png" alt="GameGambit" width={48} height={48} className="h-12 w-auto" />
                        <span className="font-gaming text-2xl">
                            <span className="text-foreground">Game</span>
                            <span className="text-primary text-glow">Gambit</span>
                        </span>
                    </div>
                </div>

                <Card className="border-primary/20 bg-card/80 backdrop-blur-sm">
                    <CardContent className="p-8">
                        {/* Invite header */}
                        <div className="text-center mb-8">
                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 border-2 border-primary/30 flex items-center justify-center mx-auto mb-4">
                                <Swords className="h-7 w-7 text-primary" />
                            </div>
                            <h1 className="font-gaming text-2xl mb-2">You've Been Challenged</h1>
                            <p className="text-muted-foreground text-sm">
                                <span className="text-primary font-semibold">{displayName}</span> invited you to join
                                GameGambit. Wager on skill. Win on-chain.
                            </p>
                        </div>

                        {/* Referrer stats */}
                        {referrer && (
                            <div className="grid grid-cols-2 gap-3 mb-8">
                                <div className="bg-muted/40 rounded-xl p-3 text-center">
                                    <Trophy className="h-4 w-4 text-yellow-400 mx-auto mb-1" />
                                    <div className="font-gaming text-lg text-foreground">{referrer.total_wins ?? 0}</div>
                                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Wins</div>
                                </div>
                                <div className="bg-muted/40 rounded-xl p-3 text-center">
                                    <Users className="h-4 w-4 text-primary mx-auto mb-1" />
                                    <div className="font-gaming text-lg text-foreground">{referrer.referral_count}</div>
                                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Referred</div>
                                </div>
                            </div>
                        )}

                        {/* Feature bullets */}
                        <div className="space-y-3 mb-8">
                            {[
                                { emoji: '⚔️', text: 'Wager SOL on Chess, PUBG, CODM, Free Fire' },
                                { emoji: '🏆', text: 'Compete on the leaderboard, earn your rep' },
                                { emoji: '👀', text: 'Spectate live matches and place side bets' },
                            ].map(({ emoji, text }) => (
                                <div key={text} className="flex items-center gap-3 text-sm">
                                    <span className="text-lg flex-shrink-0">{emoji}</span>
                                    <span className="text-muted-foreground">{text}</span>
                                </div>
                            ))}
                        </div>

                        <Button
                            onClick={handleJoin}
                            variant="neon"
                            size="lg"
                            className="w-full gap-2 font-gaming text-base"
                        >
                            Enter the Arena
                            <ArrowRight className="h-4 w-4" />
                        </Button>

                        <p className="text-center text-[11px] text-muted-foreground/60 mt-4">
                            Connect and play. No account needed.
                        </p>
                    </CardContent>
                </Card>
            </motion.div>
        </div>
    )
}