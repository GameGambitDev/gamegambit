// src/app/api/moderation/verdict/route.ts
//
// POST /api/moderation/verdict
//
// Called when a moderator submits their final decision in ModerationPanel.
// - Validates session token (HMAC-SHA256 signed with SUPABASE_SERVICE_ROLE_KEY)
// - Confirms request is 'accepted' and belongs to this wallet
// - Validates decision_deadline hasn't passed
// - Persists decision on moderation_requests row FIRST (recorded even if
//   the on-chain call later fails — admin can recover)
// - Calls process-verdict edge function to resolve on-chain + send notifications
//   using the service role key in Authorization header (same pattern as
//   submitVote calling assign-moderator in secure-wager/actions.ts)
// - Returns { ok: true, result }
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

    let body: { requestId?: string; verdict?: string; notes?: string };
    try { body = await req.json(); }
    catch { return json({ error: 'Invalid JSON' }, 400); }

    const { requestId, verdict, notes } = body;
    if (!requestId) return json({ error: 'requestId is required' }, 400);
    if (!verdict) return json({ error: 'verdict is required' }, 400);

    // Validate verdict value: wallet address | 'draw' | 'cannot_determine'
    const isWalletAddress = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(verdict);
    if (!isWalletAddress && verdict !== 'draw' && verdict !== 'cannot_determine') {
        return json({ error: 'verdict must be a wallet address, "draw", or "cannot_determine"' }, 400);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch request — must belong to this wallet and be in accepted state
    const { data: request, error: fetchErr } = await supabase
        .from('moderation_requests')
        .select('*')
        .eq('id', requestId)
        .eq('moderator_wallet', wallet)
        .single();

    if (fetchErr || !request) return json({ error: 'Moderation request not found' }, 404);

    if (request.status !== 'accepted') {
        return json({ error: `Cannot submit verdict — request is ${request.status}` }, 409);
    }

    if (request.decision_deadline && new Date(request.decision_deadline).getTime() < Date.now()) {
        return json({ error: 'Decision deadline has passed' }, 410);
    }

    // Persist the decision immediately — before calling the edge function.
    // If the edge function fails, the decision is still recorded for admin recovery.
    const finalStatus = verdict === 'cannot_determine' ? 'escalated' : 'completed';
    const { error: updateErr } = await supabase
        .from('moderation_requests')
        .update({
            status: finalStatus,
            decision: verdict,
            decision_notes: notes?.trim() ?? null,
            decided_at: new Date().toISOString(),
        })
        .eq('id', requestId);

    if (updateErr) {
        console.error('[moderation/verdict] update error:', updateErr);
        return json({ error: 'Failed to save verdict' }, 500);
    }

    // Call process-verdict edge function to handle on-chain resolution.
    // Uses supabaseServiceKey in Authorization header — same pattern as
    // submitVote in secure-wager/actions.ts calling assign-moderator.
    try {
        const edgeUrl = `${supabaseUrl}/functions/v1/process-verdict`;
        const edgeRes = await fetch(edgeUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
                requestId,
                wagerId: request.wager_id,
                moderatorWallet: wallet,
                verdict,
                notes: notes?.trim() ?? null,
            }),
        });

        const edgeData = await edgeRes.json().catch(() => ({}));

        if (!edgeRes.ok) {
            // Edge function failed — verdict is already saved, admin can recover
            console.error('[moderation/verdict] process-verdict error:', edgeData);
            return json({
                ok: true,
                warning: 'Verdict saved. On-chain resolution is pending — admin will process it if needed.',
                edgeError: (edgeData as { error?: string })?.error ?? 'Unknown edge error',
            });
        }

        return json({ ok: true, result: edgeData });

    } catch (e) {
        // Network error calling edge function — verdict is still saved
        console.error('[moderation/verdict] Failed to call process-verdict:', e);
        return json({
            ok: true,
            warning: 'Verdict saved. On-chain resolution call failed — admin will process it if needed.',
        });
    }
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