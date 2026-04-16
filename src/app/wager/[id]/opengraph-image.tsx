// src/app/wager/[id]/opengraph-image.tsx
// Next.js auto-serves this as the og:image for /wager/[id]

import { ImageResponse } from 'next/og'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const alt = 'GameGambit Wager'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// ── Helpers ───────────────────────────────────────────────────────────────────

function getGameInfo(game: string): { name: string; icon: string } {
    switch (game) {
        case 'chess': return { name: 'Chess', icon: '♟' }
        case 'codm': return { name: 'Call of Duty Mobile', icon: '🎯' }
        case 'pubg': return { name: 'PUBG Mobile', icon: '🔫' }
        case 'free_fire': return { name: 'Free Fire', icon: '🔥' }
        default: return { name: game, icon: '🎮' }
    }
}

function formatSol(lamports: number): string {
    return (lamports / 1_000_000_000).toFixed(2)
}

function truncate(wallet: string, chars = 4): string {
    return `${wallet.slice(0, chars)}...${wallet.slice(-chars)}`
}

function getStatusLabel(status: string): string {
    switch (status) {
        case 'created': return '🟡 Waiting for opponent'
        case 'joined': return '🟢 Live'
        case 'voting': return '🔵 Voting'
        case 'retractable': return '🟠 Pending'
        case 'disputed': return '🔴 Disputed'
        case 'resolved': return '⚪ Resolved'
        case 'cancelled': return '⚪ Cancelled'
        default: return status
    }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params

    // Fetch wager + both players server-side
    let wager: any = null
    let playerA: any = null
    let playerB: any = null

    try {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )

        const { data: w } = await supabase
            .from('wagers')
            .select('game, stake_lamports, status, player_a_wallet, player_b_wallet, winner_wallet, match_id')
            .eq('id', id)
            .single()

        wager = w

        if (wager) {
            const [{ data: pA }, { data: pB }] = await Promise.all([
                supabase
                    .from('players')
                    .select('username')
                    .eq('wallet_address', wager.player_a_wallet)
                    .single(),
                wager.player_b_wallet
                    ? supabase
                        .from('players')
                        .select('username')
                        .eq('wallet_address', wager.player_b_wallet)
                        .single()
                    : Promise.resolve({ data: null }),
            ])
            playerA = pA
            playerB = pB
        }
    } catch {
        // Supabase unavailable — render fallback card
    }

    const game = wager ? getGameInfo(wager.game) : { name: 'GameGambit', icon: '🎮' }
    const stake = wager ? formatSol(wager.stake_lamports) : '—'
    const pot = wager ? formatSol(wager.stake_lamports * 2) : '—'
    const status = wager ? getStatusLabel(wager.status) : ''
    const matchId = wager?.match_id ?? ''

    const nameA = playerA?.username ?? (wager ? truncate(wager.player_a_wallet) : 'Player A')
    const nameB = wager?.player_b_wallet
        ? (playerB?.username ?? truncate(wager.player_b_wallet))
        : '???'

    const isResolved = wager?.status === 'resolved'
    const winnerName = isResolved && wager?.winner_wallet
        ? (wager.winner_wallet === wager.player_a_wallet ? nameA : nameB)
        : null

    return new ImageResponse(
        (
            <div
                style={{
                    width: 1200,
                    height: 630,
                    display: 'flex',
                    flexDirection: 'column',
                    background: 'linear-gradient(135deg, #0a0a0f 0%, #12071e 50%, #0a0a0f 100%)',
                    fontFamily: 'sans-serif',
                    position: 'relative',
                    overflow: 'hidden',
                }}
            >
                {/* Background glow */}
                <div
                    style={{
                        position: 'absolute',
                        top: -200,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: 800,
                        height: 400,
                        borderRadius: '50%',
                        background: 'radial-gradient(ellipse, rgba(139,92,246,0.15) 0%, transparent 70%)',
                    }}
                />

                {/* Top bar */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '36px 56px 0',
                    }}
                >
                    {/* Logo */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div
                            style={{
                                width: 44,
                                height: 44,
                                borderRadius: 10,
                                background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 22,
                            }}
                        >
                            🎮
                        </div>
                        <span style={{ color: '#ffffff', fontSize: 26, fontWeight: 700, letterSpacing: -0.5 }}>
                            GameGambit
                        </span>
                    </div>

                    {/* Game + match id */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 28 }}>{game.icon}</span>
                        <span style={{ color: '#a78bfa', fontSize: 20, fontWeight: 600 }}>{game.name}</span>
                        {matchId && (
                            <span style={{ color: '#4b5563', fontSize: 16, marginLeft: 4 }}>#{matchId}</span>
                        )}
                    </div>
                </div>

                {/* Main content */}
                <div
                    style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '0 56px',
                        gap: 32,
                    }}
                >
                    {/* VS row */}
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 32,
                            width: '100%',
                            justifyContent: 'center',
                        }}
                    >
                        {/* Player A */}
                        <div
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: 8,
                                flex: 1,
                                maxWidth: 380,
                            }}
                        >
                            <div
                                style={{
                                    background: winnerName === nameA
                                        ? 'linear-gradient(135deg, rgba(251,191,36,0.15), rgba(251,191,36,0.05))'
                                        : 'rgba(139,92,246,0.08)',
                                    border: winnerName === nameA ? '2px solid rgba(251,191,36,0.5)' : '1px solid rgba(139,92,246,0.2)',
                                    borderRadius: 16,
                                    padding: '20px 32px',
                                    width: '100%',
                                    textAlign: 'center',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: 4,
                                }}
                            >
                                {winnerName === nameA && (
                                    <span style={{ fontSize: 20, marginBottom: 2 }}>👑</span>
                                )}
                                <span style={{ color: '#ffffff', fontSize: 32, fontWeight: 700 }}>{nameA}</span>
                                <span style={{ color: '#6b7280', fontSize: 14 }}>Challenger</span>
                            </div>
                        </div>

                        {/* VS divider */}
                        <div
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: 6,
                                flexShrink: 0,
                            }}
                        >
                            <span style={{ color: '#7c3aed', fontSize: 22, fontWeight: 800 }}>VS</span>
                            <div style={{ width: 2, height: 40, background: 'rgba(124,58,237,0.3)' }} />
                        </div>

                        {/* Player B */}
                        <div
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: 8,
                                flex: 1,
                                maxWidth: 380,
                            }}
                        >
                            <div
                                style={{
                                    background: winnerName === nameB
                                        ? 'linear-gradient(135deg, rgba(251,191,36,0.15), rgba(251,191,36,0.05))'
                                        : 'rgba(139,92,246,0.08)',
                                    border: winnerName === nameB ? '2px solid rgba(251,191,36,0.5)' : '1px solid rgba(139,92,246,0.2)',
                                    borderRadius: 16,
                                    padding: '20px 32px',
                                    width: '100%',
                                    textAlign: 'center',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: 4,
                                }}
                            >
                                {winnerName === nameB && (
                                    <span style={{ fontSize: 20, marginBottom: 2 }}>👑</span>
                                )}
                                <span
                                    style={{
                                        color: wager?.player_b_wallet ? '#ffffff' : '#4b5563',
                                        fontSize: 32,
                                        fontWeight: 700,
                                    }}
                                >
                                    {nameB}
                                </span>
                                <span style={{ color: '#6b7280', fontSize: 14 }}>
                                    {wager?.player_b_wallet ? 'Opponent' : 'Waiting...'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Stake + status row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                        <div
                            style={{
                                background: 'rgba(139,92,246,0.12)',
                                border: '1px solid rgba(139,92,246,0.3)',
                                borderRadius: 12,
                                padding: '12px 28px',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: 2,
                            }}
                        >
                            <span style={{ color: '#a78bfa', fontSize: 13, fontWeight: 600, letterSpacing: 1 }}>
                                EACH STAKES
                            </span>
                            <span style={{ color: '#ffffff', fontSize: 30, fontWeight: 800 }}>
                                {stake} SOL
                            </span>
                        </div>

                        <div
                            style={{
                                background: 'rgba(16,185,129,0.08)',
                                border: '1px solid rgba(16,185,129,0.2)',
                                borderRadius: 12,
                                padding: '12px 28px',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: 2,
                            }}
                        >
                            <span style={{ color: '#6b7280', fontSize: 13, fontWeight: 600, letterSpacing: 1 }}>
                                TOTAL POT
                            </span>
                            <span style={{ color: '#10b981', fontSize: 30, fontWeight: 800 }}>
                                {pot} SOL
                            </span>
                        </div>

                        {status && (
                            <div
                                style={{
                                    background: 'rgba(255,255,255,0.04)',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    borderRadius: 12,
                                    padding: '12px 28px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                }}
                            >
                                <span style={{ color: '#d1d5db', fontSize: 18, fontWeight: 600 }}>{status}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0 56px 32px',
                    }}
                >
                    <span style={{ color: '#4b5563', fontSize: 16 }}>thegamegambit.vercel.app</span>
                    <span style={{ color: '#4b5563', fontSize: 16 }}>Wager on skill. Win on-chain.</span>
                </div>
            </div>
        ),
        { ...size }
    )
}