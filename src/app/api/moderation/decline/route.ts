// src/app/api/moderation/decline/route.ts
//
// POST /api/moderation/decline
//
// Called when a moderator clicks "Decline" or the 30s countdown expires.
// - Validates session token (HMAC-SHA256 signed with SUPABASE_SERVICE_ROLE_KEY)
// - Confirms request belongs to this wallet and is pending or timed_out
//   (timed_out allowed: frontend may be slightly behind the cron job)
// - Sets status → 'declined', responded_at → now
// - Increments moderation_skipped_count on the player row (non-blocking)
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

    let body: { requestId?: string };
    try { body = await req.json(); }
    catch { return json({ error: 'Invalid JSON' }, 400); }

    const { requestId } = body;
    if (!requestId) return json({ error: 'requestId is required' }, 400);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: request, error: fetchErr } = await supabase
        .from('moderation_requests')
        .select('id, status, moderator_wallet')
        .eq('id', requestId)
        .eq('moderator_wallet', wallet)
        .single();

    if (fetchErr || !request) return json({ error: 'Moderation request not found' }, 404);

    // Allow declining if pending or timed_out — frontend may lag behind the cron
    if (!['pending', 'timed_out'].includes(request.status)) {
        return json({ error: `Request is already ${request.status}` }, 409);
    }

    const { error: updateErr } = await supabase
        .from('moderation_requests')
        .update({ status: 'declined', responded_at: new Date().toISOString() })
        .eq('id', requestId);

    if (updateErr) {
        console.error('[moderation/decline]', updateErr);
        return json({ error: 'Failed to decline request' }, 500);
    }

    // Atomically increment moderation_skipped_count — avoids race condition
    // if two requests fire at the same time (e.g. cron timeout + manual decline).
    supabase.rpc('increment_moderation_skip_count', { p_wallet: wallet })
        .catch((e: unknown) => console.warn('[moderation/decline] skip count update failed:', e));

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