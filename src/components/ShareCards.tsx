'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Twitter, Copy, Download, Check, Share2 } from 'lucide-react'
import { formatSol } from '@/lib/constants'

// ─── Shared canvas helpers ─────────────────────────────────────────────────────

const W = 1200
const H = 630
const BRAND = 'gamegambit.gg'

function roundRect(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number, r: number,
) {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.quadraticCurveTo(x + w, y, x + w, y + r)
    ctx.lineTo(x + w, y + h - r)
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    ctx.lineTo(x + r, y + h)
    ctx.quadraticCurveTo(x, y + h, x, y + h - r)
    ctx.lineTo(x, y + r)
    ctx.quadraticCurveTo(x, y, x + r, y)
    ctx.closePath()
}

// Draw shared background gradient + grid
function drawBg(ctx: CanvasRenderingContext2D) {
    // Dark background
    ctx.fillStyle = '#0a0a0f'
    ctx.fillRect(0, 0, W, H)

    // Subtle grid
    ctx.strokeStyle = 'rgba(153,69,255,0.07)'
    ctx.lineWidth = 1
    const spacing = 40
    for (let x = 0; x <= W; x += spacing) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
    }
    for (let y = 0; y <= H; y += spacing) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
    }

    // Glow blobs
    const g1 = ctx.createRadialGradient(200, 200, 0, 200, 200, 350)
    g1.addColorStop(0, 'rgba(153,69,255,0.18)')
    g1.addColorStop(1, 'transparent')
    ctx.fillStyle = g1
    ctx.fillRect(0, 0, W, H)

    const g2 = ctx.createRadialGradient(W - 200, H - 150, 0, W - 200, H - 150, 300)
    g2.addColorStop(0, 'rgba(20,241,149,0.12)')
    g2.addColorStop(1, 'transparent')
    ctx.fillStyle = g2
    ctx.fillRect(0, 0, W, H)
}

// Draw logo text
function drawLogo(ctx: CanvasRenderingContext2D, x: number, y: number, size = 28) {
    ctx.font = `bold ${size}px 'Arial', sans-serif`
    ctx.fillStyle = '#9945FF'
    ctx.fillText('GAME', x, y)
    const w = ctx.measureText('GAME').width
    ctx.fillStyle = '#14F195'
    ctx.fillText('GAMBIT', x + w + 4, y)
}

// ─── Win Share Card ────────────────────────────────────────────────────────────

interface WinShareCardProps {
    open: boolean
    onOpenChange: (o: boolean) => void
    game: string
    amountSol: number          // winnerPayout in lamports
    opponentUsername: string | null
    winnerUsername: string | null
    inviteCode: string | null
}

function drawWinCard(
    ctx: CanvasRenderingContext2D,
    game: string,
    amountSol: number,
    opponentUsername: string | null,
    winnerUsername: string | null,
    inviteCode: string | null,
) {
    drawBg(ctx)

    const solAmount = (amountSol / 1e9).toFixed(4)
    const inviteUrl = inviteCode ? `${BRAND}/invite/${inviteCode}` : BRAND
    const opponent = opponentUsername || 'Unknown'
    const winner = winnerUsername || 'Me'
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

    // ── Top accent bar
    const accentGrad = ctx.createLinearGradient(0, 0, W, 0)
    accentGrad.addColorStop(0, '#9945FF')
    accentGrad.addColorStop(1, '#14F195')
    ctx.fillStyle = accentGrad
    ctx.fillRect(0, 0, W, 5)

    // ── Logo (top-left)
    drawLogo(ctx, 48, 62)

    // ── Date (top-right)
    ctx.font = '18px Arial, sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.45)'
    ctx.textAlign = 'right'
    ctx.fillText(dateStr, W - 48, 62)
    ctx.textAlign = 'left'

    // ── Trophy emoji / badge
    ctx.font = '80px Arial, sans-serif'
    ctx.fillText('🏆', 48, 210)

    // ── "I just won" headline
    ctx.font = 'bold 62px Arial, sans-serif'
    ctx.fillStyle = '#ffffff'
    ctx.fillText('I just won', 48, 310)

    // ── SOL amount (green)
    const iJustWonW = ctx.measureText('I just won ').width
    const accentGrad2 = ctx.createLinearGradient(48 + iJustWonW, 250, 48 + iJustWonW + 320, 310)
    accentGrad2.addColorStop(0, '#14F195')
    accentGrad2.addColorStop(1, '#9945FF')
    ctx.fillStyle = accentGrad2
    ctx.font = 'bold 72px Arial, sans-serif'
    ctx.fillText(`${solAmount} SOL`, 48, 390)

    // ── "on GameGambit" sub text
    ctx.font = 'bold 38px Arial, sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.fillText('on GameGambit', 48, 440)

    // ── Game pill
    roundRect(ctx, 48, 468, Math.min(ctx.measureText(game).width + 32, 280), 38, 8)
    ctx.fillStyle = 'rgba(153,69,255,0.25)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(153,69,255,0.6)'
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.font = '18px Arial, sans-serif'
    ctx.fillStyle = '#c084fc'
    ctx.fillText(game, 64, 492)

    // ── Right panel — vs card
    const rx = W - 380
    roundRect(ctx, rx, 100, 320, 200, 16)
    ctx.fillStyle = 'rgba(255,255,255,0.04)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'
    ctx.lineWidth = 1
    ctx.stroke()

    ctx.font = '14px Arial, sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.4)'
    ctx.textAlign = 'center'
    ctx.fillText('WINNER', rx + 160, 140)

    ctx.font = 'bold 28px Arial, sans-serif'
    ctx.fillStyle = '#14F195'
    ctx.fillText(winner.length > 14 ? winner.slice(0, 13) + '…' : winner, rx + 160, 180)

    ctx.font = 'bold 22px Arial, sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    ctx.fillText('VS', rx + 160, 220)

    ctx.font = '14px Arial, sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.4)'
    ctx.fillText('OPPONENT', rx + 160, 258)

    ctx.font = 'bold 22px Arial, sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    ctx.fillText(opponent.length > 14 ? opponent.slice(0, 13) + '…' : opponent, rx + 160, 285)

    ctx.textAlign = 'left'

    // ── Bottom bar
    ctx.fillStyle = 'rgba(255,255,255,0.05)'
    ctx.fillRect(0, H - 70, W, 70)

    ctx.font = '18px Arial, sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.fillText('Wager on skill. Win on-chain.', 48, H - 30)

    ctx.font = '18px Arial, sans-serif'
    ctx.fillStyle = '#9945FF'
    ctx.textAlign = 'right'
    ctx.fillText(inviteUrl, W - 48, H - 30)
    ctx.textAlign = 'left'
}

export function WinShareCard({
    open, onOpenChange,
    game, amountSol, opponentUsername, winnerUsername, inviteCode,
}: WinShareCardProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [copied, setCopied] = useState(false)

    useEffect(() => {
        if (!open) return
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        drawWinCard(ctx, game, amountSol, opponentUsername, winnerUsername, inviteCode)
    }, [open, game, amountSol, opponentUsername, winnerUsername, inviteCode])

    const getBlob = useCallback((): Promise<Blob | null> => {
        return new Promise((resolve) => {
            canvasRef.current?.toBlob(resolve, 'image/png')
        })
    }, [])

    const handleShareX = useCallback(() => {
        const sol = (amountSol / 1e9).toFixed(4)
        const invite = inviteCode ? `\ngamegambit.gg/invite/${inviteCode}` : '\ngamegambit.gg'
        const text = `Beat my opponent for ${sol} SOL playing ${game} on @GameGambit. Who's next? 🏆${invite}`
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank')
    }, [amountSol, game, inviteCode])

    const handleCopy = useCallback(async () => {
        const blob = await getBlob()
        if (!blob) return
        try {
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch {
            // fallback: download
            handleDownload()
        }
    }, [getBlob])

    const handleDownload = useCallback(async () => {
        const blob = await getBlob()
        if (!blob) return
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `gamegambit-win-${Date.now()}.png`
        a.click()
        URL.revokeObjectURL(url)
    }, [getBlob])

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl border-success/30 bg-card" aria-describedby={undefined}>
                <DialogHeader>
                    <DialogTitle className="font-gaming text-lg flex items-center gap-2">
                        <Share2 className="h-5 w-5 text-success" />
                        Flex your win
                    </DialogTitle>
                </DialogHeader>

                {/* Preview */}
                <div className="rounded-xl overflow-hidden border border-border/50">
                    <canvas
                        ref={canvasRef}
                        width={W}
                        height={H}
                        className="w-full h-auto"
                    />
                </div>

                {/* Actions */}
                <div className="grid grid-cols-3 gap-3 pt-1">
                    <Button variant="outline" className="gap-2 border-[#1DA1F2]/40 text-[#1DA1F2] hover:bg-[#1DA1F2]/10" onClick={handleShareX}>
                        <Twitter className="h-4 w-4" />
                        Share on X
                    </Button>
                    <Button variant="outline" className="gap-2" onClick={handleCopy}>
                        {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                        {copied ? 'Copied!' : 'Copy Image'}
                    </Button>
                    <Button variant="outline" className="gap-2" onClick={handleDownload}>
                        <Download className="h-4 w-4" />
                        Download
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}

// ─── Airdrop / Campaign Share Card ────────────────────────────────────────────

interface AirdropShareCardProps {
    open: boolean
    onOpenChange: (o: boolean) => void
    username: string | null
    totalWagered: number      // lamports
    wins: number
    referrals: number
    inviteCode: string | null
}

function drawAirdropCard(
    ctx: CanvasRenderingContext2D,
    username: string | null,
    totalWagered: number,
    wins: number,
    referrals: number,
    inviteCode: string | null,
) {
    drawBg(ctx)

    const inviteUrl = inviteCode ? `${BRAND}/invite/${inviteCode}` : BRAND
    const name = username || 'GameGambit Player'

    // ── Top accent bar
    const accentGrad = ctx.createLinearGradient(0, 0, W, 0)
    accentGrad.addColorStop(0, '#9945FF')
    accentGrad.addColorStop(1, '#14F195')
    ctx.fillStyle = accentGrad
    ctx.fillRect(0, 0, W, 5)

    // ── Logo
    drawLogo(ctx, 48, 62)

    // ── "Campaign Active" badge (top-right)
    roundRect(ctx, W - 200, 38, 152, 34, 8)
    ctx.fillStyle = 'rgba(20,241,149,0.15)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(20,241,149,0.5)'
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.font = 'bold 14px Arial, sans-serif'
    ctx.fillStyle = '#14F195'
    ctx.textAlign = 'center'
    ctx.fillText('⚡ CAMPAIGN ACTIVE', W - 124, 60)
    ctx.textAlign = 'left'

    // ── Username headline
    ctx.font = '24px Arial, sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.fillText('I\'m competing in the', 48, 140)

    const accentGrad2 = ctx.createLinearGradient(48, 160, 800, 230)
    accentGrad2.addColorStop(0, '#9945FF')
    accentGrad2.addColorStop(1, '#14F195')
    ctx.font = 'bold 68px Arial, sans-serif'
    ctx.fillStyle = accentGrad2
    ctx.fillText('GameGambit Airdrop', 48, 230)

    ctx.font = 'bold 32px Arial, sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.65)'
    ctx.fillText(`as ${name}`, 48, 278)

    // ── Stats row
    const stats = [
        { label: 'SOL WAGERED', value: (totalWagered / 1e9).toFixed(2) },
        { label: 'WINS', value: String(wins) },
        { label: 'REFERRALS', value: String(referrals) },
    ]

    const cardW = 280
    const cardH = 120
    const gap = 24
    const totalW = stats.length * cardW + (stats.length - 1) * gap
    const startX = (W - totalW) / 2

    stats.forEach(({ label, value }, i) => {
        const cx = startX + i * (cardW + gap)
        const cy = 320

        roundRect(ctx, cx, cy, cardW, cardH, 12)
        ctx.fillStyle = 'rgba(255,255,255,0.05)'
        ctx.fill()
        ctx.strokeStyle = 'rgba(153,69,255,0.3)'
        ctx.lineWidth = 1.5
        ctx.stroke()

        ctx.font = '14px Arial, sans-serif'
        ctx.fillStyle = 'rgba(255,255,255,0.4)'
        ctx.textAlign = 'center'
        ctx.fillText(label, cx + cardW / 2, cy + 36)

        ctx.font = 'bold 44px Arial, sans-serif'
        ctx.fillStyle = '#ffffff'
        ctx.fillText(value, cx + cardW / 2, cy + 94)
    })
    ctx.textAlign = 'left'

    // ── Bottom bar
    ctx.fillStyle = 'rgba(255,255,255,0.05)'
    ctx.fillRect(0, H - 70, W, 70)

    ctx.font = '18px Arial, sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.fillText('Wager on skill. Win on-chain.', 48, H - 30)

    ctx.font = '18px Arial, sans-serif'
    ctx.fillStyle = '#9945FF'
    ctx.textAlign = 'right'
    ctx.fillText(inviteUrl, W - 48, H - 30)
    ctx.textAlign = 'left'
}

export function AirdropShareCard({
    open, onOpenChange,
    username, totalWagered, wins, referrals, inviteCode,
}: AirdropShareCardProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [copied, setCopied] = useState(false)

    useEffect(() => {
        if (!open) return
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        drawAirdropCard(ctx, username, totalWagered, wins, referrals, inviteCode)
    }, [open, username, totalWagered, wins, referrals, inviteCode])

    const getBlob = useCallback((): Promise<Blob | null> => {
        return new Promise((resolve) => {
            canvasRef.current?.toBlob(resolve, 'image/png')
        })
    }, [])

    const handleShareX = useCallback(() => {
        const invite = inviteCode ? `\ngamegambit.gg/invite/${inviteCode}` : '\ngamegambit.gg'
        const text = `I'm competing in the @GameGambit Airdrop Campaign! 🎮⚡\n${wins} wins · ${referrals} referrals${invite}`
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank')
    }, [wins, referrals, inviteCode])

    const handleCopy = useCallback(async () => {
        const blob = await getBlob()
        if (!blob) return
        try {
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch {
            handleDownload()
        }
    }, [getBlob])

    const handleDownload = useCallback(async () => {
        const blob = await getBlob()
        if (!blob) return
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `gamegambit-airdrop-${Date.now()}.png`
        a.click()
        URL.revokeObjectURL(url)
    }, [getBlob])

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl border-primary/30 bg-card" aria-describedby={undefined}>
                <DialogHeader>
                    <DialogTitle className="font-gaming text-lg flex items-center gap-2">
                        <Share2 className="h-5 w-5 text-primary" />
                        Share Your Campaign Card
                    </DialogTitle>
                </DialogHeader>

                {/* Preview */}
                <div className="rounded-xl overflow-hidden border border-border/50">
                    <canvas
                        ref={canvasRef}
                        width={W}
                        height={H}
                        className="w-full h-auto"
                    />
                </div>

                {/* Actions */}
                <div className="grid grid-cols-3 gap-3 pt-1">
                    <Button variant="outline" className="gap-2 border-[#1DA1F2]/40 text-[#1DA1F2] hover:bg-[#1DA1F2]/10" onClick={handleShareX}>
                        <Twitter className="h-4 w-4" />
                        Share on X
                    </Button>
                    <Button variant="outline" className="gap-2" onClick={handleCopy}>
                        {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                        {copied ? 'Copied!' : 'Copy Image'}
                    </Button>
                    <Button variant="outline" className="gap-2" onClick={handleDownload}>
                        <Download className="h-4 w-4" />
                        Download
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}

// ─── AirdropShareButton — inline trigger button ────────────────────────────────
// Drop this anywhere you want a "Share your card" button.

interface AirdropShareButtonProps {
    username: string | null
    totalWagered: number
    wins: number
    referrals: number
    inviteCode: string | null
    className?: string
}

export function AirdropShareButton({
    username, totalWagered, wins, referrals, inviteCode, className,
}: AirdropShareButtonProps) {
    const [open, setOpen] = useState(false)
    return (
        <>
            <Button variant="outline" className={`gap-2 ${className ?? ''}`} onClick={() => setOpen(true)}>
                <Share2 className="h-4 w-4" />
                Show your standing
            </Button>
            <AirdropShareCard
                open={open}
                onOpenChange={setOpen}
                username={username}
                totalWagered={totalWagered}
                wins={wins}
                referrals={referrals}
                inviteCode={inviteCode}
            />
        </>
    )
}