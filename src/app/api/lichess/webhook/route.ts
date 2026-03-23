// src/app/api/lichess/webhook/route.ts
//
// Receives game-end notifications from Lichess.
// Lichess POSTs here when a game finishes (configure in your Lichess team/app settings).
//
// Setup: add this URL to your Lichess OAuth app as a webhook endpoint:
//   https://thegamegambit.vercel.app/api/lichess/webhook
//
// Lichess signs requests with HMAC-SHA256 using your app secret.
// Set LICHESS_WEBHOOK_SECRET in your environment variables.

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const WEBHOOK_SECRET = process.env.LICHESS_WEBHOOK_SECRET;

// ── Verify Lichess HMAC-SHA256 signature ──────────────────────────────────────

function verifySignature(body: string, signature: string | null): boolean {
    if (!WEBHOOK_SECRET || !signature) return false;
    const expected = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(body)
        .digest('hex');
    const sig = signature.replace(/^sha256=/, '');
    try {
        return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
    } catch {
        return false;
    }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
    const rawBody = await req.text();
    const signature = req.headers.get('x-lichess-signature');

    // Verify signature if secret is configured
    if (WEBHOOK_SECRET) {
        const valid = verifySignature(rawBody, signature);
        if (!valid) {
            console.error('[lichess-webhook] Invalid signature');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
    }

    let payload: { gameId?: string; game?: { id?: string }; type?: string };
    try {
        payload = JSON.parse(rawBody);
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    // Extract game ID — Lichess sends it as gameId or nested game.id
    const lichessGameId = payload.gameId ?? payload.game?.id;
    if (!lichessGameId) {
        return NextResponse.json({ error: 'Missing gameId' }, { status: 400 });
    }

    console.log(`[lichess-webhook] Game ended: ${lichessGameId}`);

    // Look up the wager linked to this game — no auth needed, service-side only
    const lookupRes = await fetch(
        `${SUPABASE_URL}/rest/v1/wagers?lichess_game_id=eq.${lichessGameId}&status=in.(voting,joined)&select=id`,
        {
            headers: {
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                Accept: 'application/json',
            },
        }
    );

    if (!lookupRes.ok) {
        console.error('[lichess-webhook] Wager lookup failed');
        return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
    }

    const wagers = await lookupRes.json() as { id: string }[];
    if (!wagers.length) {
        // No active wager for this game — not an error, just not our game
        return NextResponse.json({ ok: true, message: 'No active wager for this game' });
    }

    // Call checkGameComplete for each matching wager (should almost always be 1)
    const results = await Promise.allSettled(
        wagers.map(({ id: wagerId }) =>
            fetch(`${SUPABASE_URL}/functions/v1/secure-wager`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                    // No X-Session-Token — checkGameComplete is the one action that doesn't require it
                },
                body: JSON.stringify({ action: 'checkGameComplete', wagerId }),
            }).then(r => r.json())
        )
    );

    results.forEach((r, i) => {
        if (r.status === 'fulfilled') {
            console.log(`[lichess-webhook] Wager ${wagers[i].id}: gameComplete=${r.value.gameComplete} resultType=${r.value.resultType}`);
        } else {
            console.error(`[lichess-webhook] Wager ${wagers[i].id} failed:`, r.reason);
        }
    });

    return NextResponse.json({ ok: true, processed: wagers.length });
}