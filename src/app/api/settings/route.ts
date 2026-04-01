// src/app/api/settings/route.ts
//
// GET  /api/settings      — returns push_notifications_enabled + moderation_requests_enabled
// PATCH /api/settings     — updates one or both settings
//
// Auth: X-Session-Token header (same HMAC-SHA256 scheme as verify-wallet edge function)
// The token contains { wallet, exp } signed with SUPABASE_SERVICE_ROLE_KEY.
//
// NOTE: push_notifications_enabled and moderation_requests_enabled are new columns
// added by migration 001. Until `supabase gen types` is re-run after the migration,
// the typed client won't know about them. We use `as any` casts only on those two
// new fields so the rest of the code remains fully typed.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
// FIX: was AUTHORITY_WALLET_SECRET — verify-wallet signs tokens with SUPABASE_SERVICE_ROLE_KEY
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ── Session validation — mirrors verify-wallet edge function logic ─────────────
// Token format: base64(JSON payload) + '.' + sha256_hex(payload + secret)

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
            .update(payloadStr + secret)
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

// ── GET — return current settings ─────────────────────────────────────────────

export async function GET(req: NextRequest) {
    const token = req.headers.get('X-Session-Token')?.trim();
    if (!token) return json({ error: 'Unauthorised' }, 401);

    const wallet = await validateSessionToken(token);
    if (!wallet) return json({ error: 'Invalid or expired session' }, 401);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Use explicit column selection and cast to any so TS doesn't complain about
    // the new columns not being in the stale generated types file.
    const { data, error } = await (supabase
        .from('players')
        .select('push_notifications_enabled, moderation_requests_enabled')
        .eq('wallet_address', wallet)
        .maybeSingle() as any);

    if (error) {
        console.error('[settings GET]', error);
        return json({ error: 'Failed to fetch settings' }, 500);
    }

    if (!data) return json({ error: 'Player not found' }, 404);

    return json({
        push_notifications_enabled: data.push_notifications_enabled ?? true,
        moderation_requests_enabled: data.moderation_requests_enabled ?? true,
    });
}

// ── PATCH — update one or both settings ───────────────────────────────────────

export async function PATCH(req: NextRequest) {
    const token = req.headers.get('X-Session-Token')?.trim();
    if (!token) return json({ error: 'Unauthorised' }, 401);

    const wallet = await validateSessionToken(token);
    if (!wallet) return json({ error: 'Invalid or expired session' }, 401);

    let body: Record<string, unknown>;
    try { body = await req.json(); }
    catch { return json({ error: 'Invalid JSON' }, 400); }

    // Only allow these two settings through this route
    const updates: Record<string, boolean> = {};

    if (body.push_notifications_enabled !== undefined) {
        if (typeof body.push_notifications_enabled !== 'boolean') {
            return json({ error: 'push_notifications_enabled must be a boolean' }, 400);
        }
        updates.push_notifications_enabled = body.push_notifications_enabled;
    }

    if (body.moderation_requests_enabled !== undefined) {
        if (typeof body.moderation_requests_enabled !== 'boolean') {
            return json({ error: 'moderation_requests_enabled must be a boolean' }, 400);
        }
        updates.moderation_requests_enabled = body.moderation_requests_enabled;
    }

    if (Object.keys(updates).length === 0) {
        return json({ error: 'No valid settings provided' }, 400);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { error } = await (supabase
        .from('players')
        .update(updates)
        .eq('wallet_address', wallet) as any);

    if (error) {
        console.error('[settings PATCH]', error);
        return json({ error: 'Failed to update settings' }, 500);
    }

    return json({ ok: true, updated: updates });
}

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, PATCH, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, X-Session-Token',
        },
    });
}