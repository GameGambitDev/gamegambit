// supabase/functions/check-chess-games/index.ts
//
// Called by an external cron (e.g. cron-job.org) every 60 seconds.
// Checks ALL active chess wagers platform-wide, not just one user's.
// Resolves finished games on-chain + fires push notifications to both players
// even when neither player has the site open.
//
// Setup:
//   1. Deploy: supabase functions deploy check-chess-games
//   2. Go to https://cron-job.org → create job → POST to:
//      https://<your-project-ref>.supabase.co/functions/v1/check-chess-games
//      Add header: Authorization: Bearer <your-SUPABASE-anon-key>
//      Interval: every 60 seconds

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SECURE_WAGER_URL = `${SUPABASE_URL}/functions/v1/secure-wager`;

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    const respond = (body: unknown, status = 200) =>
        new Response(JSON.stringify(body), {
            status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

        // Fetch all active chess wagers that have a Lichess game linked
        const { data: wagers, error } = await supabase
            .from('wagers')
            .select('id, lichess_game_id, player_a_wallet, player_b_wallet')
            .eq('game', 'chess')
            .in('status', ['voting', 'joined'])
            .not('lichess_game_id', 'is', null);

        if (error) throw error;
        if (!wagers || wagers.length === 0) {
            return respond({ checked: 0, message: 'No active chess wagers' });
        }

        console.log(`[check-chess-games] Checking ${wagers.length} active wager(s)`);

        // Call checkGameComplete on secure-wager for each wager.
        // secure-wager already handles: Lichess API → on-chain resolve →
        // DB update → insertNotifications → sendWebPush.
        // We just need to trigger it — no auth token needed since
        // checkGameComplete is the one unauthenticated action.
        const results = await Promise.allSettled(
            wagers.map(async (w: { id: string; lichess_game_id: string }) => {
                const res = await fetch(SECURE_WAGER_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                        // checkGameComplete does not require X-Session-Token
                        // (it is listed in the requiresAuth exclusion list)
                    },
                    body: JSON.stringify({ action: 'checkGameComplete', wagerId: w.id }),
                });

                if (!res.ok) {
                    const txt = await res.text();
                    throw new Error(`wager ${w.id}: HTTP ${res.status} — ${txt}`);
                }

                const json = await res.json();
                console.log(`[check-chess-games] wager ${w.id}: gameComplete=${json.gameComplete} resultType=${json.resultType ?? 'n/a'}`);
                return { wagerId: w.id, ...json };
            })
        );

        const resolved = results.filter(r => r.status === 'fulfilled' && (r as any).value?.gameComplete).length;
        const failed = results.filter(r => r.status === 'rejected').length;

        results
            .filter(r => r.status === 'rejected')
            .forEach(r => console.error('[check-chess-games] error:', (r as any).reason));

        return respond({
            checked: wagers.length,
            resolved,
            failed,
            ok: true,
        });

    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[check-chess-games] fatal error:', msg);
        return respond({ ok: false, error: msg }, 500);
    }
});