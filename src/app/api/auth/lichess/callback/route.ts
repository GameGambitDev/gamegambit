// src/app/api/auth/lichess/callback/route.ts
//
// Handles the Lichess OAuth PKCE callback.
// Flow:
//   1. Lichess redirects here with ?code=xxx&state=yyy
//   2. We verify the state matches what we stored (CSRF protection)
//   3. We exchange the code for an access token using the stored code_verifier
//   4. We call /api/account to get the verified Lichess username
//   5. We save the token + username + lichess_user_id to the players table
//   6. We redirect back to /profile with ?lichess=connected

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    const redirectBase = process.env.NEXT_PUBLIC_SITE_URL || 'https://thegamegambit.vercel.app';

    // ── Error from Lichess (user denied, etc.) ──────────────────────────────────
    if (error) {
        console.error('[lichess-callback] Lichess returned error:', error);
        return NextResponse.redirect(`${redirectBase}/profile?lichess=denied`);
    }

    if (!code || !state) {
        return NextResponse.redirect(`${redirectBase}/profile?lichess=error&reason=missing_params`);
    }

    // ── Retrieve stored PKCE verifier + wallet from cookie ──────────────────────
    const cookieHeader = req.headers.get('cookie') || '';
    const cookies = Object.fromEntries(
        cookieHeader.split(';').map(c => {
            const [k, ...v] = c.trim().split('=');
            return [k, decodeURIComponent(v.join('='))];
        })
    );

    const storedState = cookies['gg_lichess_state'];
    const codeVerifier = cookies['gg_lichess_verifier'];
    const walletAddress = cookies['gg_lichess_wallet'];

    if (!storedState || !codeVerifier || !walletAddress) {
        return NextResponse.redirect(`${redirectBase}/profile?lichess=error&reason=missing_cookies`);
    }

    // ── CSRF check ──────────────────────────────────────────────────────────────
    if (state !== storedState) {
        console.error('[lichess-callback] State mismatch — possible CSRF');
        return NextResponse.redirect(`${redirectBase}/profile?lichess=error&reason=state_mismatch`);
    }

    try {
        // ── Exchange code for access token ──────────────────────────────────────
        const redirectUri = `${redirectBase}/api/auth/lichess/callback`;
        const tokenRes = await fetch('https://lichess.org/api/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                code_verifier: codeVerifier,
                redirect_uri: redirectUri,
                client_id: new URL(redirectBase).hostname,
            }).toString(),
        });

        if (!tokenRes.ok) {
            const err = await tokenRes.text();
            console.error('[lichess-callback] Token exchange failed:', err);
            return NextResponse.redirect(`${redirectBase}/profile?lichess=error&reason=token_exchange`);
        }

        const tokenData = await tokenRes.json() as { access_token: string; token_type: string };
        const accessToken = tokenData.access_token;

        // ── Fetch verified Lichess account ──────────────────────────────────────
        const accountRes = await fetch('https://lichess.org/api/account', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/json',
            },
        });

        if (!accountRes.ok) {
            console.error('[lichess-callback] Failed to fetch Lichess account');
            return NextResponse.redirect(`${redirectBase}/profile?lichess=error&reason=account_fetch`);
        }

        const account = await accountRes.json() as { id: string; username: string };

        // ── Save to DB using service role (bypasses RLS) ────────────────────────
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const { error: dbError } = await supabase
            .from('players')
            .update({
                lichess_access_token: accessToken,
                lichess_username: account.username,
                lichess_user_id: account.id,
            })
            .eq('wallet_address', walletAddress);

        if (dbError) {
            console.error('[lichess-callback] DB update failed:', dbError);
            return NextResponse.redirect(`${redirectBase}/profile?lichess=error&reason=db_error`);
        }

        console.log(`[lichess-callback] Connected @${account.username} to wallet ${walletAddress.slice(0, 8)}...`);

        // ── Clear PKCE cookies and redirect to profile ──────────────────────────
        const response = NextResponse.redirect(`${redirectBase}/profile?lichess=connected&username=${account.username}`);
        response.cookies.delete('gg_lichess_state');
        response.cookies.delete('gg_lichess_verifier');
        response.cookies.delete('gg_lichess_wallet');
        return response;

    } catch (err) {
        console.error('[lichess-callback] Unexpected error:', err);
        return NextResponse.redirect(`${redirectBase}/profile?lichess=error&reason=unexpected`);
    }
}