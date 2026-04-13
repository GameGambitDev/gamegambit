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

// ── Session token validation ───────────────────────────────────────────────────

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
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');

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

// ── Validation helpers ────────────────────────────────────────────────────────

/** Platform username: 3–20 chars, letters/numbers/underscores only */
function validatePlatformUsername(username: string): boolean {
    if (!username || username.length < 3 || username.length > 20) return false;
    return /^[a-zA-Z0-9_]+$/.test(username);
}

/** In-game username: 1–64 chars, permissive (games vary widely) */
function validateGameUsername(username: string): boolean {
    if (!username || username.length < 1 || username.length > 64) return false;
    return true; // Broad validation — PUBG API will reject invalid names for PUBG
}

/** PUBG player ID format from the API: "account.xxxxxxxx..." */
function validatePubgPlayerId(id: string): boolean {
    if (!id || id.length < 1 || id.length > 100) return false;
    return /^[a-zA-Z0-9._-]+$/.test(id);
}

/** Free Fire UID is numeric */
function validateFreeFireUid(uid: string): boolean {
    if (!uid || uid.length < 1 || uid.length > 20) return false;
    return /^[0-9]+$/.test(uid);
}

/** Settings boolean toggle */
function isBoolean(v: unknown): v is boolean {
    return typeof v === 'boolean';
}

// ── Safe update field whitelist ────────────────────────────────────────────────
//
// Any field NOT in this object is silently dropped — security boundary.
// Punishment fields (is_suspended, false_vote_count, etc.) are system-only
// and cannot be set through this endpoint.

function buildSafeUpdates(updates: Record<string, unknown>): Record<string, unknown> | null {
    const safe: Record<string, unknown> = {};

    // Platform username
    if (updates.username !== undefined) {
        if (updates.username !== null && !validatePlatformUsername(String(updates.username))) {
            throw new Error('Username must be 3–20 characters — letters, numbers, and underscores only');
        }
        safe.username = updates.username;
    }

    // Lichess (OAuth-managed; also allows null for disconnect)
    if (updates.lichess_username !== undefined) safe.lichess_username = updates.lichess_username;
    if (updates.lichess_user_id !== undefined) safe.lichess_user_id = updates.lichess_user_id;
    if (updates.lichess_access_token !== undefined) safe.lichess_access_token = updates.lichess_access_token;

    // CODM
    if (updates.codm_username !== undefined) {
        if (updates.codm_username !== null && !validateGameUsername(String(updates.codm_username))) {
            throw new Error('Invalid CODM username format');
        }
        safe.codm_username = updates.codm_username;
    }
    if (updates.codm_player_id !== undefined) safe.codm_player_id = updates.codm_player_id;

    // PUBG
    if (updates.pubg_username !== undefined) {
        if (updates.pubg_username !== null && !validateGameUsername(String(updates.pubg_username))) {
            throw new Error('Invalid PUBG username format');
        }
        safe.pubg_username = updates.pubg_username;
    }
    if (updates.pubg_player_id !== undefined) {
        if (updates.pubg_player_id !== null && !validatePubgPlayerId(String(updates.pubg_player_id))) {
            throw new Error('Invalid PUBG player ID format');
        }
        safe.pubg_player_id = updates.pubg_player_id;
    }

    // Free Fire
    if (updates.free_fire_username !== undefined) {
        if (updates.free_fire_username !== null && !validateGameUsername(String(updates.free_fire_username))) {
            throw new Error('Invalid Free Fire username format');
        }
        safe.free_fire_username = updates.free_fire_username;
    }
    if (updates.free_fire_uid !== undefined) {
        if (updates.free_fire_uid !== null && !validateFreeFireUid(String(updates.free_fire_uid))) {
            throw new Error('Free Fire UID must be numeric');
        }
        safe.free_fire_uid = updates.free_fire_uid;
    }

    // game_username_bound_at — set by the bind flow to record when each game was linked
    // We only allow merging a single key at a time via the 'bindGame' action (see below),
    // NOT via generic update, to prevent clients overwriting the whole JSONB object.

    // Settings
    if (updates.push_notifications_enabled !== undefined) {
        if (!isBoolean(updates.push_notifications_enabled)) {
            throw new Error('push_notifications_enabled must be a boolean');
        }
        safe.push_notifications_enabled = updates.push_notifications_enabled;
    }
    if (updates.moderation_requests_enabled !== undefined) {
        if (!isBoolean(updates.moderation_requests_enabled)) {
            throw new Error('moderation_requests_enabled must be a boolean');
        }
        safe.moderation_requests_enabled = updates.moderation_requests_enabled;
    }

    return Object.keys(safe).length > 0 ? safe : null;
}

// ── Server ────────────────────────────────────────────────────────────────────

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
        const sessionToken = req.headers.get('X-Session-Token')?.trim();
        const body = await req.json();
        const { action, ...data } = body as { action: string;[key: string]: unknown };

        console.log(`[secure-player] Action: ${action}, hasToken: ${!!sessionToken}`);

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // ── create ──────────────────────────────────────────────────────────────
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

            // Generate unique invite code: wallet prefix + random hex suffix
            const randomSuffix = Math.random().toString(16).slice(2, 6);
            const inviteCode = `${walletAddress.slice(0, 6).toLowerCase()}-${randomSuffix}`;

            // Check for referral code passed from client cookie
            const referrerCode = typeof data.referrerCode === 'string' ? data.referrerCode.trim() : null;
            let referredByWallet: string | null = null;

            if (referrerCode) {
                const { data: referrer } = await supabase
                    .from('players')
                    .select('wallet_address')
                    .eq('invite_code', referrerCode)
                    .maybeSingle();
                // Don't allow self-referral
                if (referrer && referrer.wallet_address !== walletAddress) {
                    referredByWallet = referrer.wallet_address;
                }
            }

            const insertPayload: Record<string, unknown> = {
                wallet_address: walletAddress,
                invite_code: inviteCode,
            };
            if (referredByWallet) insertPayload.referred_by_wallet = referredByWallet;

            const { data: newPlayer, error } = await supabase
                .from('players')
                .insert(insertPayload)
                .select()
                .single();

            if (error) {
                console.error('[secure-player] Create error:', error);
                return respond({ error: 'Failed to create player' }, 500);
            }

            // Increment referrer's referral_count (non-fatal — don't fail the whole request)
            if (referredByWallet) {
                const { data: referrerRow } = await supabase
                    .from('players')
                    .select('referral_count')
                    .eq('wallet_address', referredByWallet)
                    .single();
                const currentCount = (referrerRow?.referral_count as number) ?? 0;
                await supabase
                    .from('players')
                    .update({ referral_count: currentCount + 1 })
                    .eq('wallet_address', referredByWallet);
                console.log(`[secure-player] Referral linked: ${walletAddress} referred by ${referredByWallet}`);
            }

            console.log(`[secure-player] Created player for: ${walletAddress}`);
            return respond({ player: newPlayer });
        }

        // ── update ──────────────────────────────────────────────────────────────
        if (action === 'update') {
            if (!sessionToken) return respond({ error: 'Wallet verification required' }, 401);
            const walletAddress = await validateSessionToken(sessionToken);
            if (!walletAddress) return respond({ error: 'Invalid or expired session' }, 401);

            const { updates } = data as { updates: Record<string, unknown> };
            if (!updates || typeof updates !== 'object') {
                return respond({ error: 'Missing updates object' }, 400);
            }

            let safeUpdates: Record<string, unknown> | null;
            try {
                safeUpdates = buildSafeUpdates(updates);
            } catch (e) {
                return respond({ error: (e as Error).message }, 400);
            }

            if (!safeUpdates) {
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

        // ── bindGame ─────────────────────────────────────────────────────────────
        // Dedicated action for game username binding.
        // Checks for uniqueness, updates the username + player ID + bound_at timestamp.
        //
        // data shape: { game: 'pubg'|'codm'|'free_fire', username: string, accountId?: string }

        if (action === 'bindGame') {
            if (!sessionToken) return respond({ error: 'Wallet verification required' }, 401);
            const walletAddress = await validateSessionToken(sessionToken);
            if (!walletAddress) return respond({ error: 'Invalid or expired session' }, 401);

            const { game, username, accountId } = data as {
                game: string;
                username: string;
                accountId?: string;
            };

            const ALLOWED_GAMES = ['pubg', 'codm', 'free_fire'] as const;
            if (!ALLOWED_GAMES.includes(game as typeof ALLOWED_GAMES[number])) {
                return respond({ error: 'Invalid game type' }, 400);
            }
            if (!validateGameUsername(username)) {
                return respond({ error: 'Invalid username format' }, 400);
            }

            // Determine which columns to set based on game
            const usernameCol =
                game === 'pubg' ? 'pubg_username' :
                    game === 'codm' ? 'codm_username' :
                        game === 'free_fire' ? 'free_fire_username' : null;

            const playerIdCol =
                game === 'pubg' ? 'pubg_player_id' :
                    game === 'codm' ? 'codm_player_id' :
                        game === 'free_fire' ? 'free_fire_uid' : null;

            if (!usernameCol) return respond({ error: 'Unknown game' }, 400);

            // Check uniqueness — is this username already bound by someone else?
            const { data: existing } = await supabase
                .from('players')
                .select('wallet_address')
                .eq(usernameCol, username)
                .neq('wallet_address', walletAddress)
                .maybeSingle();

            if (existing) {
                // Username is taken by another player — client should show appeal flow
                return respond({ error: 'USERNAME_TAKEN', takenBy: 'another account' }, 409);
            }

            // Build update payload
            const updatePayload: Record<string, unknown> = {
                [usernameCol]: username,
                // Merge the bound_at timestamp into the JSONB column using jsonb concatenation
                game_username_bound_at: supabase.rpc('jsonb_set_key', {
                    // We use a raw SQL approach instead — see note below
                }),
            };

            // Note: Supabase JS client doesn't support jsonb_set cleanly in .update().
            // We use a raw SQL update for game_username_bound_at only.
            const boundAt = new Date().toISOString();

            const updateCols: Record<string, unknown> = { [usernameCol]: username };
            if (playerIdCol && accountId) updateCols[playerIdCol] = accountId;

            // Step 1: update the username (and optional player ID)
            const { error: updateErr } = await supabase
                .from('players')
                .update(updateCols)
                .eq('wallet_address', walletAddress);

            if (updateErr) {
                console.error('[secure-player] bindGame update error:', updateErr);
                return respond({ error: 'Failed to link account' }, 500);
            }

            // Step 2: merge the bound_at timestamp into game_username_bound_at JSONB
            // Using rpc or raw SQL. We use a simple RPC-style update here:
            const { error: jsonbErr } = await supabase.rpc('merge_game_bound_at', {
                p_wallet: walletAddress,
                p_game: game,
                p_ts: boundAt,
            });

            if (jsonbErr) {
                // Non-fatal: the username is already linked, just the timestamp didn't save
                console.warn('[secure-player] game_username_bound_at merge failed (non-fatal):', jsonbErr);
            }

            // Return the updated player row
            const { data: updatedPlayer, error: fetchErr } = await supabase
                .from('players')
                .select('*')
                .eq('wallet_address', walletAddress)
                .single();

            if (fetchErr) return respond({ error: 'Failed to fetch updated player' }, 500);

            console.log(`[secure-player] Bound ${game} username "${username}" for ${walletAddress}`);
            return respond({ player: updatedPlayer });
        }

        return respond({ error: 'Invalid action' }, 400);

    } catch (error) {
        console.error('[secure-player] Unhandled error:', error);
        return respond({ error: 'Internal server error' }, 500);
    }
});