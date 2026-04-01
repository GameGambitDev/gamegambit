// src/app/api/moderation/report/route.ts
//
// POST /api/moderation/report
//
// Used by ReportModeratorModal (Step 6) to let a player flag an unfair verdict.
// - Validates session token (HMAC-SHA256 signed with SUPABASE_SERVICE_ROLE_KEY)
// - Confirms caller was a participant in the wager and it is resolved
// - Guards against duplicate reports (one report per wallet per wager)
// - Logs to player_behaviour_log (event_type: 'verdict_reported')
// - Returns { ok: true }
//
// NOTE: Token is signed by verify-wallet with SUPABASE_SERVICE_ROLE_KEY.
// Must use that same key here for validation — NOT AUTHORITY_WALLET_SECRET.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function validateSessionToken(token: string): Promise<string | null> {
    try {
        const dotIndex = token.lastIndexOf('.');
        if (dotIndex === -1) return null;
        const payloadB64 = token.substring(0, dotIndex);
        const hash = token.substring(dotIndex + 1);

        let payloadStr: string;
        try { payloadStr = Buffer.from(payloadB64, 'base64').toString('utf-8'); }
        catch { return null; }

        let payload: { wallet: string; exp: number };
        try { payload = JSON.parse(payloadStr); }
        catch { return null; }

        if (!payload.wallet || !payload.exp) return null;
        if (payload.exp < Date.now()) return null;

        const computedHash = crypto
            .createHash('sha256')
            .update(payloadStr + supabaseServiceKey)
            .digest('hex');

        if (computedHash !== hash) return null;
        return payload.wallet;
    } catch {
        return null;
    }
}

function json(body: unknown, status = 200) {
    return NextResponse.json(body, { status });
}

export async function POST(req: NextRequest) {
    const token = req.headers.get('X-Session-Token')?.trim();
    if (!token) return json({ error: 'Unauthorised' }, 401);

    const wallet = await validateSessionToken(token);
    if (!wallet) return json({ error: 'Invalid or expired session' }, 401);

    let body: { wagerId?: string; reason?: string };
    try { body = await req.json(); }
    catch { return json({ error: 'Invalid JSON' }, 400); }

    const { wagerId, reason } = body;
    if (!wagerId) return json({ error: 'wagerId is required' }, 400);
    if (!reason || reason.trim().length < 10) {
        return json({ error: 'Please provide a reason of at least 10 characters' }, 400);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify caller is a participant in the wager
    const { data: wager, error: wagerErr } = await supabase
        .from('wagers')
        .select('id, status, player_a_wallet, player_b_wallet')
        .eq('id', wagerId)
        .single();

    if (wagerErr || !wager) return json({ error: 'Wager not found' }, 404);

    const isParticipant = wager.player_a_wallet === wallet || wager.player_b_wallet === wallet;
    if (!isParticipant) return json({ error: 'You were not a participant in this wager' }, 403);

    if (wager.status !== 'resolved') {
        return json({ error: 'Can only report verdicts on resolved wagers' }, 409);
    }

    // Prevent duplicate reports
    const { data: existing } = await supabase
        .from('player_behaviour_log')
        .select('id')
        .eq('player_wallet', wallet)
        .eq('event_type', 'verdict_reported')
        .eq('related_id', wagerId)
        .maybeSingle();

    if (existing) return json({ error: 'You have already reported this verdict' }, 409);

    // Log the report
    const { error: logErr } = await supabase.from('player_behaviour_log').insert({
        player_wallet: wallet,
        event_type: 'verdict_reported',
        related_id: wagerId,
        notes: reason.trim().slice(0, 500),
    });

    if (logErr) {
        console.error('[moderation/report] log error:', logErr);
        return json({ error: 'Failed to submit report' }, 500);
    }

    return json({ ok: true });
}

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, X-Session-Token',
        },
    });
}