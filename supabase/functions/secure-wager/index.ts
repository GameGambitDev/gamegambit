// supabase/functions/secure-wager/index.ts
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
        // Use lastIndexOf — btoa output never contains dots, so this is safe
        const dotIndex = token.lastIndexOf('.');
        if (dotIndex === -1) return null;

        const payloadB64 = token.substring(0, dotIndex);
        const hash = token.substring(dotIndex + 1);

        let payloadStr: string;
        try { payloadStr = atob(payloadB64); }
        catch { console.log('[secure-wager] base64 decode failed'); return null; }

        let payload: { wallet: string; exp: number };
        try { payload = JSON.parse(payloadStr); }
        catch { console.log('[secure-wager] JSON parse failed'); return null; }

        if (!payload.wallet || !payload.exp) return null;
        if (payload.exp < Date.now()) { console.log('[secure-wager] token expired'); return null; }

        // verify-wallet hashes: JSON.stringify(payload) + SECRET_KEY
        // payloadStr === JSON.stringify(payload), so we hash payloadStr + key
        const encoder = new TextEncoder();
        const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(payloadStr + supabaseServiceKey));
        const computedHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

        if (computedHash !== hash) { console.log('[secure-wager] hash mismatch'); return null; }
        return payload.wallet;
    } catch (e) {
        console.error('[secure-wager] validateSessionToken error:', e);
        return null;
    }
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { status: 200, headers: corsHeaders });

    console.log('[secure-wager] content-type:', req.headers.get('content-type'));

    const respond = (body: unknown, status = 200) =>
        new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    try {
        const sessionToken = req.headers.get('X-Session-Token')?.trim();
        const { action, ...data } = await req.json();
        console.log(`[secure-wager] Action: ${action}, token: ${!!sessionToken}`);

        // checkGameComplete and recordOnChain* are unauthenticated:
        // - checkGameComplete: result is decided by Lichess API, not the caller
        // - recordOnChain*: just a logging hook, no DB mutations
        const requiresAuth = !['checkGameComplete', 'recordOnChainCreate', 'recordOnChainJoin'].includes(action);

        let walletAddress = '';
        if (requiresAuth) {
            if (!sessionToken) return respond({ error: 'Wallet verification required. Missing X-Session-Token header.' }, 401);
            const verified = await validateSessionToken(sessionToken);
            if (!verified) return respond({ error: 'Invalid or expired session' }, 401);
            walletAddress = verified;
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const getWager = async (wagerId: string) => {
            const { data: w, error } = await supabase.from('wagers').select('*').eq('id', wagerId).single();
            if (error || !w) throw new Error('Wager not found');
            return w;
        };

        // CREATE
        if (action === 'create') {
            const { game, stake_lamports, lichess_game_id, is_public, stream_url } = data;
            if (!game || !['chess', 'codm', 'pubg'].includes(game)) return respond({ error: 'Invalid game type' }, 400);
            if (!stake_lamports || stake_lamports <= 0) return respond({ error: 'Invalid stake amount' }, 400);

            const { data: newWager, error } = await supabase.from('wagers').insert({
                match_id: Date.now(), player_a_wallet: walletAddress, game, stake_lamports,
                lichess_game_id: lichess_game_id || null, is_public: is_public !== false, stream_url: stream_url || null,
            }).select().single();

            if (error) { console.error('[secure-wager] Create error:', error); return respond({ error: 'Failed to create wager' }, 500); }
            console.log(`[secure-wager] Created wager ${newWager.id} for ${walletAddress}`);
            return respond({ wager: newWager });
        }

        // JOIN
        if (action === 'join') {
            const { wagerId } = data;
            if (!wagerId) return respond({ error: 'Wager ID required' }, 400);
            const wager = await getWager(wagerId);
            if (wager.status !== 'created') return respond({ error: 'Wager is not available to join' }, 400);
            if (wager.player_a_wallet === walletAddress) return respond({ error: 'Cannot join your own wager' }, 400);

            const { data: updatedWager, error } = await supabase.from('wagers')
                .update({ player_b_wallet: walletAddress, status: 'joined' })
                .eq('id', wagerId).eq('status', 'created').select().single();
            if (error) return respond({ error: 'Failed to join wager' }, 500);

            console.log(`[secure-wager] Wager ${wagerId} joined by ${walletAddress}`);
            return respond({ wager: updatedWager });
        }

        // VOTE — CODM / PUBG only. Chess auto-resolves via Lichess.
        if (action === 'vote') {
            const { wagerId, votedWinner } = data;
            if (!wagerId || !votedWinner) return respond({ error: 'Wager ID and voted winner required' }, 400);

            const wager = await getWager(wagerId);

            // FIX: chess must never vote — Lichess decides the winner
            if (wager.game === 'chess') {
                return respond({ error: 'Chess wagers resolve automatically via Lichess. Voting is not allowed.' }, 400);
            }

            const isPlayerA = wager.player_a_wallet === walletAddress;
            const isPlayerB = wager.player_b_wallet === walletAddress;
            if (!isPlayerA && !isPlayerB) return respond({ error: 'You are not a participant in this wager' }, 403);
            if (votedWinner !== wager.player_a_wallet && votedWinner !== wager.player_b_wallet)
                return respond({ error: 'Invalid winner selection' }, 400);
            if (isPlayerA && wager.vote_player_a) return respond({ error: 'You have already voted' }, 400);
            if (isPlayerB && wager.vote_player_b) return respond({ error: 'You have already voted' }, 400);

            const otherVote = isPlayerA ? wager.vote_player_b : wager.vote_player_a;
            const voteField = isPlayerA ? 'vote_player_a' : 'vote_player_b';
            const updateData: Record<string, unknown> = { [voteField]: votedWinner, vote_timestamp: new Date().toISOString(), status: 'voting' };

            if (otherVote && otherVote === votedWinner) {
                updateData.status = 'retractable';
                updateData.retract_deadline = new Date(Date.now() + 15_000).toISOString();
            } else if (otherVote && otherVote !== votedWinner) {
                updateData.status = 'disputed';
            }

            const { data: updatedWager, error } = await supabase.from('wagers').update(updateData).eq('id', wagerId).select().single();
            if (error) return respond({ error: 'Failed to submit vote' }, 500);
            return respond({ wager: updatedWager });
        }

        // EDIT
        if (action === 'edit') {
            const { wagerId, stake_lamports, lichess_game_id, stream_url, is_public } = data;
            if (!wagerId) return respond({ error: 'Wager ID required' }, 400);
            const wager = await getWager(wagerId);
            if (wager.player_a_wallet !== walletAddress) return respond({ error: 'Only the wager owner can edit' }, 403);

            const updateData: Record<string, unknown> = {};
            if (wager.status === 'created') {
                if (stake_lamports !== undefined) updateData.stake_lamports = stake_lamports;
                if (lichess_game_id !== undefined) updateData.lichess_game_id = lichess_game_id || null;
                if (is_public !== undefined) updateData.is_public = is_public;
            }
            if (stream_url !== undefined) updateData.stream_url = stream_url || null;

            const { data: updatedWager, error } = await supabase.from('wagers').update(updateData).eq('id', wagerId).select().single();
            if (error) return respond({ error: 'Failed to edit wager' }, 500);
            return respond({ wager: updatedWager });
        }

        // DELETE
        if (action === 'delete') {
            const { wagerId } = data;
            if (!wagerId) return respond({ error: 'Wager ID required' }, 400);
            const wager = await getWager(wagerId);
            if (wager.player_a_wallet !== walletAddress) return respond({ error: 'Only the wager owner can delete' }, 403);
            if (wager.status !== 'created') return respond({ error: 'Cannot delete a wager that has been accepted' }, 400);

            const { error } = await supabase.from('wagers').delete().eq('id', wagerId);
            if (error) return respond({ error: 'Failed to delete wager' }, 500);
            return respond({ success: true });
        }

        // SET READY
        if (action === 'setReady') {
            const { wagerId, ready } = data;
            if (!wagerId || ready === undefined) return respond({ error: 'Wager ID and ready status required' }, 400);
            const wager = await getWager(wagerId);
            if (wager.status !== 'joined') return respond({ error: 'Wager must be in joined status' }, 400);

            const isPlayerA = wager.player_a_wallet === walletAddress;
            const isPlayerB = wager.player_b_wallet === walletAddress;
            if (!isPlayerA && !isPlayerB) return respond({ error: 'You are not a participant' }, 403);

            const updateData: Record<string, unknown> = isPlayerA ? { ready_player_a: ready } : { ready_player_b: ready };
            const otherReady = isPlayerA ? wager.ready_player_b : wager.ready_player_a;
            updateData.countdown_started_at = (ready && otherReady) ? new Date().toISOString() : null;

            const { data: updatedWager, error } = await supabase.from('wagers').update(updateData).eq('id', wagerId).select().single();
            if (error) return respond({ error: 'Failed to set ready status' }, 500);
            return respond({ wager: updatedWager });
        }

        // START GAME
        if (action === 'startGame') {
            const { wagerId } = data;
            if (!wagerId) return respond({ error: 'Wager ID required' }, 400);
            const wager = await getWager(wagerId);
            if (!wager.ready_player_a || !wager.ready_player_b) return respond({ error: 'Both players must be ready' }, 400);
            if (!wager.countdown_started_at) return respond({ error: 'Countdown not started' }, 400);
            if (Date.now() - new Date(wager.countdown_started_at).getTime() < 9_000) return respond({ error: 'Countdown not complete' }, 400);

            const { data: updatedWager, error } = await supabase.from('wagers').update({ status: 'voting' }).eq('id', wagerId).select().single();
            if (error) return respond({ error: 'Failed to start game' }, 500);
            console.log(`[secure-wager] Game started for wager ${wagerId}`);
            return respond({ wager: updatedWager });
        }

        // CHECK GAME COMPLETE — no auth required, Lichess decides the winner
        if (action === 'checkGameComplete') {
            const { wagerId } = data;
            if (!wagerId) return respond({ error: 'Wager ID required' }, 400);

            const wager = await getWager(wagerId);

            // FIX: accept 'joined' too — status may not have advanced to 'voting' yet
            if (!['voting', 'joined'].includes(wager.status)) {
                return respond({ gameComplete: false, message: 'Wager not in active game state' });
            }
            if (wager.game !== 'chess' || !wager.lichess_game_id) {
                return respond({ gameComplete: false, message: 'No Lichess game linked' });
            }

            try {
                const lichessResponse = await fetch(
                    `https://lichess.org/api/game/${wager.lichess_game_id}`,
                    { headers: { Accept: 'application/json' } }
                );
                if (!lichessResponse.ok) return respond({ gameComplete: false, message: 'Could not fetch game from Lichess' });

                const game = await lichessResponse.json();
                console.log(`[secure-wager] Lichess ${wager.lichess_game_id}: status=${game.status} winner=${game.winner}`);

                const finishedStatuses = ['mate', 'resign', 'outoftime', 'draw', 'stalemate', 'timeout', 'cheat', 'noStart', 'aborted'];
                if (!finishedStatuses.includes(game.status)) {
                    return respond({ gameComplete: false, status: game.status, message: 'Game still in progress' });
                }

                const [{ data: pA }, { data: pB }] = await Promise.all([
                    supabase.from('players').select('lichess_username').eq('wallet_address', wager.player_a_wallet).single(),
                    supabase.from('players').select('lichess_username').eq('wallet_address', wager.player_b_wallet).single(),
                ]);

                const playerAUsername = (pA?.lichess_username || '').toLowerCase().trim();
                const playerBUsername = (pB?.lichess_username || '').toLowerCase().trim();
                // Lichess returns id (lowercase slug) — prefer id over name
                // Lichess API returns userId directly on the player object (not nested under user)
                const whiteUser = (game.players?.white?.userId || game.players?.white?.user?.id || game.players?.white?.user?.name || '').toLowerCase().trim();
                const blackUser = (game.players?.black?.userId || game.players?.black?.user?.id || game.players?.black?.user?.name || '').toLowerCase().trim();

                console.log(`[secure-wager] Lichess: white="${whiteUser}" black="${blackUser}" | DB: A="${playerAUsername}" B="${playerBUsername}"`);

                let winnerWallet: string | null = null;
                let resultType: 'playerA' | 'playerB' | 'draw' | 'unknown' = 'unknown';

                const drawStatuses = ['draw', 'stalemate', 'aborted', 'noStart'];
                if (drawStatuses.includes(game.status) || !game.winner) {
                    resultType = 'draw';
                } else {
                    const winnerSide = game.winner;            // 'white' | 'black'
                    const loserSide = winnerSide === 'white' ? 'black' : 'white';
                    const winnerLichessUser = winnerSide === 'white' ? whiteUser : blackUser;
                    const loserLichessUser = loserSide === 'white' ? whiteUser : blackUser;

                    // Primary match: by stored lichess_username
                    if (playerAUsername && winnerLichessUser === playerAUsername) {
                        winnerWallet = wager.player_a_wallet; resultType = 'playerA';
                    } else if (playerBUsername && winnerLichessUser === playerBUsername) {
                        winnerWallet = wager.player_b_wallet; resultType = 'playerB';
                    }
                    // Fallback: if one player has no username stored, infer by elimination.
                    // If we know player A's username and they are the LOSER side, player B must be the winner.
                    else if (playerAUsername && loserLichessUser === playerAUsername && playerBUsername === '') {
                        console.log(`[secure-wager] Inferred winner=B (A matched loser side, B has no username stored)`);
                        winnerWallet = wager.player_b_wallet; resultType = 'playerB';
                    } else if (playerBUsername && loserLichessUser === playerBUsername && playerAUsername === '') {
                        console.log(`[secure-wager] Inferred winner=A (B matched loser side, A has no username stored)`);
                        winnerWallet = wager.player_a_wallet; resultType = 'playerA';
                    }
                    // Last resort: if only one player has a username and they appear in the game at all, infer the other
                    else if (playerAUsername && (whiteUser === playerAUsername || blackUser === playerAUsername) && playerBUsername === '') {
                        // We know A is in the game but didn't win → B wins
                        if (winnerLichessUser !== playerAUsername) {
                            console.log(`[secure-wager] Inferred winner=B (A in game but not winner, B has no username)`);
                            winnerWallet = wager.player_b_wallet; resultType = 'playerB';
                        }
                    } else if (playerBUsername && (whiteUser === playerBUsername || blackUser === playerBUsername) && playerAUsername === '') {
                        if (winnerLichessUser !== playerBUsername) {
                            console.log(`[secure-wager] Inferred winner=A (B in game but not winner, A has no username)`);
                            winnerWallet = wager.player_a_wallet; resultType = 'playerA';
                        }
                    } else {
                        console.log(`[secure-wager] Cannot resolve: winner="${winnerLichessUser}" A="${playerAUsername}" B="${playerBUsername}"`);
                        resultType = 'unknown';
                    }
                }

                if (resultType === 'unknown') {
                    // Don't leave the wager stuck — mark it as needing manual resolution
                    // but still update status so it stops polling
                    console.log(`[secure-wager] Unresolvable game ${wager.lichess_game_id} — requires manual intervention`);
                    return respond({
                        gameComplete: true, status: game.status, winner: game.winner, resultType: 'unknown',
                        message: `Cannot match players. DB: A="${playerAUsername}" B="${playerBUsername}". Lichess: white="${whiteUser}" black="${blackUser}". At least one player needs to link their Lichess username.`,
                    });
                }

                const { data: updatedWager, error: updateError } = await supabase.from('wagers')
                    .update({ status: 'resolved', winner_wallet: resultType === 'draw' ? null : winnerWallet, resolved_at: new Date().toISOString() })
                    .eq('id', wagerId).select().single();

                if (updateError) {
                    return respond({ gameComplete: true, status: game.status, resultType, winnerWallet, error: 'Failed to update wager status' });
                }

                // Fire-and-forget: on-chain resolution
                fetch(`${supabaseUrl}/functions/v1/resolve-wager`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
                    body: JSON.stringify({
                        action: resultType === 'draw' ? 'refund_draw' : 'resolve_wager',
                        matchId: wager.match_id, playerAWallet: wager.player_a_wallet,
                        playerBWallet: wager.player_b_wallet, winnerWallet, wagerId: wager.id, stakeLamports: wager.stake_lamports,
                    }),
                }).catch(e => console.error('[secure-wager] resolve-wager call failed:', e));

                // Fire-and-forget: NFT
                if (winnerWallet) {
                    fetch(`${supabaseUrl}/functions/v1/mint-nft`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
                        body: JSON.stringify({ wagerId: wager.id, winnerWallet }),
                    }).catch(e => console.error('[secure-wager] mint-nft call failed:', e));
                }

                return respond({
                    gameComplete: true, status: game.status, winner: game.winner,
                    resultType, winnerWallet: resultType === 'draw' ? null : winnerWallet,
                    isDraw: resultType === 'draw', wager: updatedWager,
                });

            } catch (lichessError) {
                console.error('[secure-wager] Lichess API error:', lichessError);
                return respond({ gameComplete: false, message: 'Error checking Lichess game' });
            }
        }

        // RECORD ON-CHAIN TX (frontend hook, no DB mutation needed)
        if (action === 'recordOnChainCreate' || action === 'recordOnChainJoin') {
            console.log(`[secure-wager] ${action} recorded`);
            return respond({ success: true });
        }

        return respond({ error: 'Invalid action' }, 400);

    } catch (error) {
        console.error('[secure-wager] Error:', error);
        return respond({ error: 'Internal server error' }, 500);
    }
});