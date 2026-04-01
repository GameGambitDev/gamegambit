// src/app/api/moderation/accept/route.ts
//
// POST /api/moderation/accept
//
// Called when a moderator clicks "Accept" on ModerationRequestModal.
// - Validates session token (HMAC-SHA256 signed with SUPABASE_SERVICE_ROLE_KEY)
// - Confirms request is still 'pending' and belongs to this wallet
// - Updates status → 'accepted', sets responded_at + decision_deadline (30 min)
// - Returns { ok: true, request }
//
// NOTE: The session token is created by verify-wallet edge function using
// SUPABASE_SERVICE_ROLE_KEY as the signing secret. All API routes that validate
// session tokens MUST use SUPABASE_SERVICE_ROLE_KEY — NOT AUTHORITY_WALLET_SECRET
// (which is the Solana keypair secret, a completely different env var).

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// Used for both DB access AND session token validation — verify-wallet signs
// tokens with this same key (SECRET_KEY = SUPABASE_SERVICE_ROLE_KEY in that fn).
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ── Session validation ────────────────────────────────────────────────────────
// Token format: btoa(JSON payload) + '.' + sha256_hex(payloadStr + SUPABASE_SERVICE_ROLE_KEY)
// Mirrors secure-player/index.ts validateSessionToken logic.

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

// ── POST ──────────────────────────────────────────────────────────────────────

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
        .select('*')
        .eq('id', requestId)
        .eq('moderator_wallet', wallet)
        .single();

    if (fetchErr || !request) return json({ error: 'Moderation request not found' }, 404);

    if (request.status !== 'pending') {
        return json({ error: `Request is already ${request.status}` }, 409);
    }

    if (new Date(request.deadline).getTime() < Date.now()) {
        return json({ error: 'Request deadline has passed' }, 410);
    }

    // 30 minutes to submit a verdict from the moment of acceptance
    const decisionDeadline = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    const { data: updated, error: updateErr } = await supabase
        .from('moderation_requests')
        .update({
            status: 'accepted',
            responded_at: new Date().toISOString(),
            decision_deadline: decisionDeadline,
        })
        .eq('id', requestId)
        .select()
        .single();

    if (updateErr) {
        console.error('[moderation/accept]', updateErr);
        return json({ error: 'Failed to accept request' }, 500);
    }

    return json({ ok: true, request: updated });
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