// supabase/functions/secure-player/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-session-token',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

async function validateSessionToken(token: string): Promise<string | null> {
    try {
        const dotIndex = token.lastIndexOf('.');
        if (dotIndex === -1) return null;
        const payloadB64 = token.substring(0, dotIndex);
        const hash = token.substring(dotIndex + 1);

        let payloadStr: string;
        try { payloadStr = atob(payloadB64); }
        catch { return null; }

        let payload: { wallet: string; exp: number };
        try { payload = JSON.parse(payloadStr); }
        catch { return null; }

        if (!payload.wallet || !payload.exp) return null;
        if (payload.exp < Date.now()) {
            console.log('[secure-player] Session token expired');
            return null;
        }

        const encoder = new TextEncoder();
        const data = encoder.encode(payloadStr + supabaseServiceKey);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const computedHash = Array.from(new Uint8Array(hashBuffer))
            .map(b => b.toString(16).padStart(2, '0')).join('');

        if (computedHash !== hash) {
            console.log('[secure-player] Invalid session token hash');
            return null;
        }

        return payload.wallet;
    } catch (error) {
        console.error('[secure-player] Token validation error:', error);
        return null;
    }
}

function validateGameUsername(username: string): boolean {
    if (!username || username.length < 1 || username.length > 50) return false;
    return /^[a-zA-Z0-9_-]+$/.test(username);
}

function validatePlatformUsername(username: string): boolean {
    if (!username || username.length < 3 || username.length > 20) return false;
    return /^[a-zA-Z0-9_]+$/.test(username);
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { status: 200, headers: corsHeaders });
    }

    const respond = (body: unknown, status = 200) =>
        new Response(JSON.stringify(body), {
            status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    try {
        // X-Session-Token avoids Supabase gateway overwriting Authorization header
        const sessionToken = req.headers.get('X-Session-Token')?.trim();
        const { action, ...data } = await req.json();
        console.log(`[secure-player] Action: ${action}, token: ${!!sessionToken}`);

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // ── create ─────────────────────────────────────────────────────────────
        if (action === 'create') {
            if (!sessionToken) return respond({ error: 'Wallet verification required' }, 401);
            const walletAddress = await validateSessionToken(sessionToken);
            if (!walletAddress) return respond({ error: 'Invalid or expired session' }, 401);

            const { data: existing } = await supabase
                .from('players')
                .select('*')
                .eq('wallet_address', walletAddress)
                .single();

            if (existing) return respond({ player: existing });

            const { data: newPlayer, error } = await supabase
                .from('players')
                .insert({ wallet_address: walletAddress })
                .select()
                .single();

            if (error) {
                console.error('[secure-player] Create error:', error);
                return respond({ error: 'Failed to create player' }, 500);
            }

            console.log(`[secure-player] Created player for: ${walletAddress}`);
            return respond({ player: newPlayer });
        }

        // ── update ─────────────────────────────────────────────────────────────
        if (action === 'update') {
            if (!sessionToken) return respond({ error: 'Wallet verification required' }, 401);
            const walletAddress = await validateSessionToken(sessionToken);
            if (!walletAddress) return respond({ error: 'Invalid or expired session' }, 401);

            const { updates } = data;

            // Validate username if being changed
            if (updates.username !== undefined) {
                if (updates.username && !validatePlatformUsername(updates.username)) {
                    return respond({ error: 'Username must be 3-20 characters, letters/numbers/underscores only' }, 400);
                }
            }

            // Validate game usernames if being changed
            if (updates.lichess_username && !validateGameUsername(updates.lichess_username)) {
                return respond({ error: 'Invalid Lichess username format' }, 400);
            }
            if (updates.codm_username && !validateGameUsername(updates.codm_username)) {
                return respond({ error: 'Invalid CODM username format' }, 400);
            }
            if (updates.pubg_username && !validateGameUsername(updates.pubg_username)) {
                return respond({ error: 'Invalid PUBG username format' }, 400);
            }

            // Whitelist of fields that can be updated via this endpoint
            // lichess_access_token is allowed here for OAuth disconnect (set to null)
            // lichess_username and lichess_user_id are set by the OAuth callback directly
            // via service role — not via this endpoint during normal use
            const safeUpdates: Record<string, unknown> = {};
            if (updates.username !== undefined) safeUpdates.username = updates.username;
            if (updates.lichess_username !== undefined) safeUpdates.lichess_username = updates.lichess_username;
            if (updates.lichess_user_id !== undefined) safeUpdates.lichess_user_id = updates.lichess_user_id;
            if (updates.lichess_access_token !== undefined) safeUpdates.lichess_access_token = updates.lichess_access_token;
            if (updates.codm_username !== undefined) safeUpdates.codm_username = updates.codm_username;
            if (updates.pubg_username !== undefined) safeUpdates.pubg_username = updates.pubg_username;

            if (Object.keys(safeUpdates).length === 0) {
                return respond({ error: 'No valid fields to update' }, 400);
            }

            const { data: updatedPlayer, error } = await supabase
                .from('players')
                .update(safeUpdates)
                .eq('wallet_address', walletAddress)
                .select()
                .single();

            if (error) {
                console.error('[secure-player] Update error:', error);
                return respond({ error: 'Failed to update player' }, 500);
            }

            return respond({ player: updatedPlayer });
        }

        return respond({ error: 'Invalid action' }, 400);

    } catch (error) {
        console.error('[secure-player] Error:', error);
        return respond({ error: 'Internal server error' }, 500);
    }
});