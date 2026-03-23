// supabase/functions/secure-wager/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Connection, PublicKey } from "https://esm.sh/@solana/web3.js@1.98.0";

import {
    PLATFORM_FEE_BPS,
    PLATFORM_WALLET,
    getRpcUrl,
    loadAuthorityKeypair,
    deriveWagerPda,
    buildResolveWagerIx,
    buildCloseWagerIx,
    sendAndConfirm,
    explorerTx,
} from "../_shared/solana.ts";

import { sendWebPush } from "../_shared/webpush.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-session-token',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

const supabaseUrl       = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// ── Session auth ──────────────────────────────────────────────────────────────

async function validateSessionToken(token: string): Promise<string | null> {
    try {
        const dotIndex = token.lastIndexOf('.');
        if (dotIndex === -1) return null;
        const payloadB64 = token.substring(0, dotIndex);
        const hash       = token.substring(dotIndex + 1);
        let payloadStr: string;
        try { payloadStr = atob(payloadB64); } catch { return null; }
        let payload: { wallet: string; exp: number };
        try { payload = JSON.parse(payloadStr); } catch { return null; }
        if (!payload.wallet || !payload.exp) return null;
        if (payload.exp < Date.now()) return null;
        const encoder    = new TextEncoder();
        const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(payloadStr + supabaseServiceKey));
        const computed   = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
        if (computed !== hash) return null;
        return payload.wallet;
    } catch { return null; }
}

// ── Notification helpers ──────────────────────────────────────────────────────

async function getDisplayName(supabase: ReturnType<typeof createClient>, walletAddress: string): Promise<string> {
    try {
        const { data } = await supabase.from('players').select('username').eq('wallet_address', walletAddress).single();
        if (data?.username) return data.username;
    } catch { /* ignore */ }
    return walletAddress.slice(0, 4) + '...' + walletAddress.slice(-4);
}

async function insertNotifications(
    supabase: ReturnType<typeof createClient>,
    items: Array<{ player_wallet: string; type: string; title: string; message: string; wager_id?: string }>
) {
    try {
        const { error } = await supabase.from('notifications').insert(items);
        if (error) console.warn('[secure-wager] notification insert error:', error);
        await Promise.allSettled(items.map(item => sendWebPush(supabase, item)));
    } catch (e) {
        console.warn('[secure-wager] insertNotifications error:', e);
    }
}

// ── On-chain resolution ───────────────────────────────────────────────────────

async function resolveOnChain(
    supabase:   ReturnType<typeof createClient>,
    wager:      Record<string, unknown>,
    winnerWallet: string | null,
    resultType: 'playerA' | 'playerB' | 'draw',
): Promise<string | null> {
    try {
        const connection = new Connection(getRpcUrl(), 'confirmed');
        const authority  = loadAuthorityKeypair();
        const playerAPubkey = new PublicKey(wager.player_a_wallet as string);
        const wagerPda   = deriveWagerPda(playerAPubkey, BigInt(wager.match_id as number));
        const wagerId    = wager.id as string;
        const stake      = wager.stake_lamports as number;

        let txSig: string;
        if (resultType === 'draw') {
            const playerBPubkey = new PublicKey(wager.player_b_wallet as string);
            const ix = buildCloseWagerIx(wagerPda, authority.publicKey, playerAPubkey, playerBPubkey);
            txSig = await sendAndConfirm(connection, authority, ix);
            console.log(`[secure-wager] close_wager (draw) tx: ${txSig}`);
            await supabase.from('wager_transactions').upsert([
                { wager_id: wagerId, tx_type: 'draw_refund', wallet_address: wager.player_a_wallet, amount_lamports: stake, tx_signature: txSig, status: 'confirmed' },
                { wager_id: wagerId, tx_type: 'draw_refund', wallet_address: wager.player_b_wallet, amount_lamports: stake, tx_signature: txSig, status: 'confirmed' },
            ], { onConflict: 'tx_signature', ignoreDuplicates: true });
        } else {
            const totalPot    = stake * 2;
            const platformFee = Math.floor(totalPot * PLATFORM_FEE_BPS / 10_000);
            const winnerPayout = totalPot - platformFee;
            const winnerPubkey = new PublicKey(winnerWallet!);
            const ix = buildResolveWagerIx(wagerPda, authority.publicKey, winnerPubkey);
            txSig = await sendAndConfirm(connection, authority, ix);
            console.log(`[secure-wager] resolve_wager tx: ${txSig}`);
            await supabase.from('wager_transactions').upsert([
                { wager_id: wagerId, tx_type: 'winner_payout', wallet_address: winnerWallet, amount_lamports: winnerPayout, tx_signature: txSig, status: 'confirmed' },
                { wager_id: wagerId, tx_type: 'platform_fee', wallet_address: PLATFORM_WALLET.toBase58(), amount_lamports: platformFee, tx_signature: txSig, status: 'confirmed' },
            ], { onConflict: 'tx_signature', ignoreDuplicates: true });
            const loserWallet = winnerWallet === wager.player_a_wallet ? wager.player_b_wallet : wager.player_a_wallet;
            await supabase.rpc('update_winner_stats', { p_wallet: winnerWallet, p_stake: stake, p_earnings: winnerPayout })
                .then(({ error }: { error: unknown }) => error && console.log('winner stats error:', error));
            await supabase.rpc('update_loser_stats', { p_wallet: loserWallet, p_stake: stake })
                .then(({ error }: { error: unknown }) => error && console.log('loser stats error:', error));
        }
        return txSig;
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[secure-wager] resolveOnChain failed:', msg);
        try {
            await supabase.from('wager_transactions').insert({
                wager_id: wager.id, tx_type: 'error_on_chain_resolve',
                wallet_address: wager.player_a_wallet as string,
                amount_lamports: 0, status: 'failed', error_message: msg,
            });
        } catch { /* ignore */ }
        return null;
    }
}

// ── Lichess ───────────────────────────────────────────────────────────────────

async function createLichessGame(
    playerAUsername: string,
    playerBUsername: string,
    clockLimit:      number,
    clockIncrement:  number,
    rated:           boolean,
    sidePreference:  string = 'random',
): Promise<{ gameId: string; urlWhite: string; urlBlack: string }> {
    const platformToken = Deno.env.get('LICHESS_PLATFORM_TOKEN');
    if (!platformToken) throw new Error('LICHESS_PLATFORM_TOKEN not configured');

    const body = new URLSearchParams({
        'clock.limit':      String(clockLimit),
        'clock.increment':  String(clockIncrement),
        rated:              String(rated),
        users: sidePreference === 'black'
            ? `${playerBUsername},${playerAUsername}`
            : `${playerAUsername},${playerBUsername}`,
        rules: 'noRematch,noEarlyDraw',
        name:  'GameGambit Wager',
    });

    const res = await fetch('https://lichess.org/api/challenge/open', {
        method: 'POST',
        headers: {
            Authorization:  `Bearer ${platformToken}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept:         'application/json',
        },
        body: body.toString(),
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Lichess challenge creation failed (${res.status}): ${errText}`);
    }

    const challenge = await res.json() as { id: string; url: string; urlWhite: string; urlBlack: string };
    if (!challenge.id) throw new Error('Lichess returned no game ID');
    return { gameId: challenge.id, urlWhite: challenge.urlWhite, urlBlack: challenge.urlBlack };
}

async function tryCreateLichessGame(
    supabase: ReturnType<typeof createClient>,
    wagerId:  string,
    wager:    Record<string, unknown>,
): Promise<{ lichess_game_id?: string; lichess_url_white?: string; lichess_url_black?: string }> {
    try {
        const [{ data: pA }, { data: pB }] = await Promise.all([
            supabase.from('players').select('lichess_username').eq('wallet_address', wager.player_a_wallet).single(),
            supabase.from('players').select('lichess_username').eq('wallet_address', wager.player_b_wallet).single(),
        ]);

        const playerAUsername = pA?.lichess_username;
        const playerBUsername = pB?.lichess_username;

        if (!playerAUsername || !playerBUsername) {
            console.error(`[secure-wager] Missing Lichess usernames. A="${playerAUsername}" B="${playerBUsername}"`);
            return {};
        }

        const { gameId, urlWhite, urlBlack } = await createLichessGame(
            playerAUsername, playerBUsername,
            (wager.chess_clock_limit    as number)  ?? 300,
            (wager.chess_clock_increment as number) ?? 3,
            (wager.chess_rated           as boolean) ?? false,
            (wager.chess_side_preference as string)  ?? 'random',
        );

        console.log(`[secure-wager] Lichess game created: ${gameId} for wager ${wagerId}`);
        await supabase.from('wagers').update({ lichess_game_id: gameId, lichess_url_white: urlWhite, lichess_url_black: urlBlack }).eq('id', wagerId);
        return { lichess_game_id: gameId, lichess_url_white: urlWhite, lichess_url_black: urlBlack };
    } catch (err) {
        console.error(`[secure-wager] createLichessGame failed for ${wagerId}:`, err instanceof Error ? err.message : String(err));
        return {};
    }
}

// ── Main handler ──────────────────────────────────────────────────────────────

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { status: 200, headers: corsHeaders });

    const respond = (body: unknown, status = 200) =>
        new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    try {
        const sessionToken = req.headers.get('X-Session-Token')?.trim();
        const { action, ...data } = await req.json();
        console.log(`[secure-wager] Action: ${action}`);

        const requiresAuth = !['checkGameComplete'].includes(action);
        let walletAddress  = '';

        if (requiresAuth) {
            if (!sessionToken) return respond({ error: 'Wallet verification required' }, 401);
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

        // ── create ─────────────────────────────────────────────────────────────
        if (action === 'create') {
            const { game, stake_lamports, is_public, stream_url, chess_clock_limit, chess_clock_increment, chess_rated, chess_side_preference } = data;
            if (!game || !['chess', 'codm', 'pubg'].includes(game)) return respond({ error: 'Invalid game type' }, 400);
            if (!stake_lamports || stake_lamports <= 0) return respond({ error: 'Invalid stake amount' }, 400);
            if (game === 'chess') {
                const { data: p } = await supabase.from('players').select('lichess_username').eq('wallet_address', walletAddress).single();
                if (!p?.lichess_username) return respond({ error: 'Connect your Lichess account in your profile before creating chess wagers' }, 400);
            }
            const { data: newWager, error } = await supabase.from('wagers').insert({
                player_a_wallet: walletAddress,
                game,
                stake_lamports,
                is_public: is_public !== false,
                stream_url: stream_url || null,
                ...(game === 'chess' && {
                    chess_clock_limit:      chess_clock_limit      ?? 300,
                    chess_clock_increment:  chess_clock_increment  ?? 3,
                    chess_rated:            chess_rated            ?? false,
                    chess_side_preference:  chess_side_preference  ?? 'random',
                }),
            }).select().single();
            if (error) { console.error('[secure-wager] Create error:', error); return respond({ error: 'Failed to create wager' }, 500); }
            return respond({ wager: newWager });
        }

        // ── join ───────────────────────────────────────────────────────────────
        if (action === 'join') {
            const { wagerId } = data;
            if (!wagerId) return respond({ error: 'Wager ID required' }, 400);
            const wager = await getWager(wagerId);
            if (wager.status !== 'created') return respond({ error: 'Wager is not available to join' }, 400);
            if (wager.player_a_wallet === walletAddress) return respond({ error: 'Cannot join your own wager' }, 400);
            if (wager.game === 'chess') {
                const { data: p } = await supabase.from('players').select('lichess_username').eq('wallet_address', walletAddress).single();
                if (!p?.lichess_username) return respond({ error: 'Connect your Lichess account in your profile before joining chess wagers' }, 400);
            }
            const { data: updatedWager, error } = await supabase.from('wagers')
                .update({ player_b_wallet: walletAddress, status: 'joined' })
                .eq('id', wagerId).eq('status', 'created').select().single();
            if (error) return respond({ error: 'Failed to join wager' }, 500);
            const joinerName = await getDisplayName(supabase, walletAddress);
            await insertNotifications(supabase, [{
                player_wallet: wager.player_a_wallet,
                type: 'wager_joined',
                title: 'Someone joined your wager!',
                message: `${joinerName} accepted your wager. Head to the Ready Room to get started.`,
                wager_id: wagerId,
            }]);
            return respond({ wager: updatedWager });
        }

        // ── vote ───────────────────────────────────────────────────────────────
        if (action === 'vote') {
            const { wagerId, votedWinner } = data;
            if (!wagerId || !votedWinner) return respond({ error: 'Wager ID and voted winner required' }, 400);
            const wager = await getWager(wagerId);
            if (wager.game === 'chess') return respond({ error: 'Chess wagers resolve automatically via Lichess.' }, 400);
            const isPlayerA = wager.player_a_wallet === walletAddress;
            const isPlayerB = wager.player_b_wallet === walletAddress;
            if (!isPlayerA && !isPlayerB) return respond({ error: 'You are not a participant' }, 403);
            if (votedWinner !== wager.player_a_wallet && votedWinner !== wager.player_b_wallet) return respond({ error: 'Invalid winner selection' }, 400);
            if (isPlayerA && wager.vote_player_a) return respond({ error: 'You have already voted' }, 400);
            if (isPlayerB && wager.vote_player_b) return respond({ error: 'You have already voted' }, 400);
            const otherVote = isPlayerA ? wager.vote_player_b : wager.vote_player_a;
            const voteField = isPlayerA ? 'vote_player_a' : 'vote_player_b';
            const updateData: Record<string, unknown> = { [voteField]: votedWinner, vote_timestamp: new Date().toISOString(), status: 'voting' };
            if (otherVote && otherVote === votedWinner)  { updateData.status = 'retractable'; updateData.retract_deadline = new Date(Date.now() + 15_000).toISOString(); }
            else if (otherVote && otherVote !== votedWinner) { updateData.status = 'disputed'; }
            const { data: updatedWager, error } = await supabase.from('wagers').update(updateData).eq('id', wagerId).select().single();
            if (error) return respond({ error: 'Failed to submit vote' }, 500);
            return respond({ wager: updatedWager });
        }

        // ── edit ───────────────────────────────────────────────────────────────
        if (action === 'edit') {
            const { wagerId, stake_lamports, lichess_game_id, stream_url, is_public } = data;
            if (!wagerId) return respond({ error: 'Wager ID required' }, 400);
            const wager = await getWager(wagerId);
            if (wager.player_a_wallet !== walletAddress) return respond({ error: 'Only the wager owner can edit' }, 403);
            const updateData: Record<string, unknown> = {};
            if (wager.status === 'created') {
                if (stake_lamports  !== undefined) updateData.stake_lamports  = stake_lamports;
                if (is_public       !== undefined) updateData.is_public       = is_public;
                if (lichess_game_id !== undefined) updateData.lichess_game_id = lichess_game_id || null;
            }
            if (stream_url !== undefined) updateData.stream_url = stream_url || null;
            if (Object.keys(updateData).length === 0) return respond({ wager }, 200);
            const { data: updatedWager, error } = await supabase.from('wagers').update(updateData).eq('id', wagerId).select().single();
            if (error) return respond({ error: 'Failed to edit wager' }, 500);
            return respond({ wager: updatedWager });
        }

        // ── applyProposal ──────────────────────────────────────────────────────
        if (action === 'applyProposal') {
            const { wagerId, field, newValue } = data;
            if (!wagerId || !field || newValue === undefined) return respond({ error: 'wagerId, field, and newValue required' }, 400);
            const wager = await getWager(wagerId);
            const isParticipant = wager.player_a_wallet === walletAddress || wager.player_b_wallet === walletAddress;
            if (!isParticipant) return respond({ error: 'Not a participant in this wager' }, 403);
            const allowedFields = ['stake_lamports', 'is_public', 'stream_url'];
            if (!allowedFields.includes(field)) return respond({ error: `Field '${field}' cannot be changed via proposal` }, 400);
            if (field === 'stake_lamports' && (typeof newValue !== 'number' || newValue <= 0)) return respond({ error: 'Invalid stake amount' }, 400);
            const { data: updatedWager, error } = await supabase.from('wagers').update({ [field]: newValue }).eq('id', wagerId).select().single();
            if (error) return respond({ error: 'Failed to apply proposal' }, 500);
            console.log(`[secure-wager] applyProposal: ${field} = ${newValue} on wager ${wagerId} by ${walletAddress}`);
            return respond({ wager: updatedWager });
        }

        // ── notifyChat ─────────────────────────────────────────────────────────
        if (action === 'notifyChat') {
            const { wagerId } = data;
            if (!wagerId) return respond({ error: 'wagerId required' }, 400);
            const wager = await getWager(wagerId);
            const opponentWallet = wager.player_a_wallet === walletAddress ? wager.player_b_wallet : wager.player_a_wallet;
            if (!opponentWallet) return respond({ ok: true });
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
            const { data: recent } = await supabase.from('notifications').select('id')
                .eq('player_wallet', opponentWallet).eq('wager_id', wagerId).eq('type', 'chat_message')
                .gte('created_at', fiveMinutesAgo).limit(1);
            if (recent && recent.length > 0) return respond({ ok: true, skipped: true });
            const senderName = await getDisplayName(supabase, walletAddress);
            await insertNotifications(supabase, [{
                player_wallet: opponentWallet, type: 'chat_message',
                title: 'New message', message: `${senderName} is messaging you in the ready room.`, wager_id: wagerId,
            }]);
            return respond({ ok: true });
        }

        // ── notifyProposal ─────────────────────────────────────────────────────
        if (action === 'notifyProposal') {
            const { wagerId, proposalCount } = data;
            if (!wagerId) return respond({ error: 'wagerId required' }, 400);
            const wager = await getWager(wagerId);
            const opponentWallet = wager.player_a_wallet === walletAddress ? wager.player_b_wallet : wager.player_a_wallet;
            if (!opponentWallet) return respond({ ok: true });
            const senderName = await getDisplayName(supabase, walletAddress);
            const count = typeof proposalCount === 'number' && proposalCount > 1 ? proposalCount : 1;
            await insertNotifications(supabase, [{
                player_wallet: opponentWallet, type: 'wager_proposal',
                title: 'Wager change proposed',
                message: `${senderName} proposed ${count > 1 ? `${count} changes` : 'a change'} to your wager. Open the ready room to review.`,
                wager_id: wagerId,
            }]);
            return respond({ ok: true });
        }

        // ── delete ─────────────────────────────────────────────────────────────
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

        // ── setReady ───────────────────────────────────────────────────────────
        if (action === 'setReady') {
            const { wagerId, ready } = data;
            if (!wagerId || ready === undefined) return respond({ error: 'Wager ID and ready status required' }, 400);
            const wager = await getWager(wagerId);
            if (wager.status !== 'joined') return respond({ error: 'Wager must be in joined status' }, 400);
            const isPlayerA = wager.player_a_wallet === walletAddress;
            const isPlayerB = wager.player_b_wallet === walletAddress;
            if (!isPlayerA && !isPlayerB) return respond({ error: 'You are not a participant' }, 403);
            const { data: rpcResult, error: rpcError } = await supabase.rpc('set_player_ready', { p_wager_id: wagerId, p_is_player_a: isPlayerA, p_ready: ready });
            if (rpcError) {
                console.warn('[secure-wager] set_player_ready RPC unavailable, fallback:', rpcError.message);
                const readyField = isPlayerA ? 'ready_player_a' : 'ready_player_b';
                const { error: step1Error } = await supabase.from('wagers').update({ [readyField]: ready }).eq('id', wagerId);
                if (step1Error) return respond({ error: 'Failed to set ready status' }, 500);
                const fresh = await getWager(wagerId);
                const bothReady = fresh.ready_player_a && fresh.ready_player_b;
                const shouldStartCountdown = bothReady && !fresh.countdown_started_at;
                const shouldClearCountdown = !fresh.ready_player_a || !fresh.ready_player_b;
                if (shouldStartCountdown || shouldClearCountdown) {
                    await supabase.from('wagers').update({
                        countdown_started_at: shouldStartCountdown ? new Date(Date.now() - 1000).toISOString() : null,
                    }).eq('id', wagerId).eq('ready_player_a', fresh.ready_player_a).eq('ready_player_b', fresh.ready_player_b);
                }
                return respond({ wager: await getWager(wagerId) });
            }
            return respond({ wager: rpcResult });
        }

        // ── startGame ──────────────────────────────────────────────────────────
        if (action === 'startGame') {
            const { wagerId } = data;
            if (!wagerId) return respond({ error: 'Wager ID required' }, 400);
            const wager = await getWager(wagerId);
            if (wager.status === 'voting') return respond({ wager });
            if (!wager.ready_player_a || !wager.ready_player_b) return respond({ error: 'Both players must be ready' }, 400);
            if (!wager.countdown_started_at) return respond({ error: 'Countdown not started' }, 400);
            const bothDeposited = wager.deposit_player_a && wager.deposit_player_b;
            const elapsed       = Date.now() - new Date(wager.countdown_started_at).getTime();
            if (!bothDeposited && elapsed < 11_000) return respond({ error: 'Waiting for both players to deposit', elapsed, bothDeposited }, 400);
            const { data: updatedWager, error } = await supabase.from('wagers')
                .update({ status: 'voting' }).eq('id', wagerId).eq('status', 'joined').select().single();
            if (error || !updatedWager) return respond({ wager: await getWager(wagerId) });
            return respond({ wager: updatedWager });
        }

        // ── recordOnChainCreate ────────────────────────────────────────────────
        if (action === 'recordOnChainCreate') {
            const { wagerId, txSignature } = data;
            if (!wagerId) return respond({ error: 'wagerId required' }, 400);
            const wager = await getWager(wagerId);
            if (wager.player_a_wallet !== walletAddress) return respond({ error: 'Only Player A can record create deposit' }, 403);
            const updatePayload: Record<string, unknown> = { deposit_player_a: true };
            if (txSignature) updatePayload.tx_signature_a = txSignature;
            const bothDeposited = wager.deposit_player_b === true;
            if (bothDeposited) updatePayload.status = 'voting';
            const { data: updated, error } = await supabase.from('wagers').update(updatePayload).eq('id', wagerId).select().single();
            if (error) return respond({ error: 'Failed to record deposit' }, 500);
            if (bothDeposited && wager.game === 'chess') {
                const lichessResult = await tryCreateLichessGame(supabase, wagerId, wager);
                await insertNotifications(supabase, [
                    { player_wallet: wager.player_a_wallet, type: 'game_started', title: 'Game started!', message: 'Both players have deposited. Your Lichess game is ready — click your play link.', wager_id: wagerId },
                    { player_wallet: wager.player_b_wallet, type: 'game_started', title: 'Game started!', message: 'Both players have deposited. Your Lichess game is ready — click your play link.', wager_id: wagerId },
                ]);
                return respond({ success: true, wager: { ...updated, ...lichessResult }, gameStarted: true });
            }
            return respond({ success: true, wager: updated, gameStarted: bothDeposited });
        }

        // ── recordOnChainJoin ──────────────────────────────────────────────────
        if (action === 'recordOnChainJoin') {
            const { wagerId, txSignature } = data;
            if (!wagerId) return respond({ error: 'wagerId required' }, 400);
            const wager = await getWager(wagerId);
            if (wager.player_b_wallet !== walletAddress) return respond({ error: 'Only Player B can record join deposit' }, 403);
            const updatePayload: Record<string, unknown> = { deposit_player_b: true };
            if (txSignature) updatePayload.tx_signature_b = txSignature;
            const bothDeposited = wager.deposit_player_a === true;
            if (bothDeposited) updatePayload.status = 'voting';
            const { data: updated, error } = await supabase.from('wagers').update(updatePayload).eq('id', wagerId).select().single();
            if (error) return respond({ error: 'Failed to record deposit' }, 500);
            if (bothDeposited && wager.game === 'chess') {
                const lichessResult = await tryCreateLichessGame(supabase, wagerId, wager);
                await insertNotifications(supabase, [
                    { player_wallet: wager.player_a_wallet, type: 'game_started', title: 'Game started!', message: 'Both players have deposited. Your Lichess game is ready — click your play link.', wager_id: wagerId },
                    { player_wallet: wager.player_b_wallet, type: 'game_started', title: 'Game started!', message: 'Both players have deposited. Your Lichess game is ready — click your play link.', wager_id: wagerId },
                ]);
                return respond({ success: true, wager: { ...updated, ...lichessResult }, gameStarted: true });
            }
            return respond({ success: true, wager: updated, gameStarted: bothDeposited });
        }

        // ── record_escrow ──────────────────────────────────────────────────────
        // Logs deposit transactions without on-chain interaction.
        // Moved here from resolve-wager where it doesn't belong.
        if (action === 'record_escrow') {
            const { wagerId, playerAWallet, playerBWallet, stakeLamports, txSignature } = data;
            if (!wagerId || !stakeLamports) return respond({ error: 'wagerId and stakeLamports required' }, 400);
            const logDeposit = (wallet: string) =>
                supabase.from('wager_transactions').insert({
                    wager_id: wagerId, tx_type: 'escrow_deposit',
                    wallet_address: wallet, amount_lamports: stakeLamports,
                    tx_signature: txSignature ?? null, status: 'confirmed',
                });
            if (playerAWallet) await logDeposit(playerAWallet);
            if (playerBWallet) await logDeposit(playerBWallet);
            return respond({ success: true });
        }

        // ── checkGameComplete ──────────────────────────────────────────────────
        if (action === 'checkGameComplete') {
            const { wagerId } = data;
            if (!wagerId) return respond({ error: 'Wager ID required' }, 400);
            const wager = await getWager(wagerId);
            if (!['voting', 'joined'].includes(wager.status)) return respond({ gameComplete: false, message: 'Wager not in active game state' });
            if (wager.game !== 'chess' || !wager.lichess_game_id) return respond({ gameComplete: false, message: 'No Lichess game linked' });
            try {
                const lichessResponse = await fetch(`https://lichess.org/api/game/${wager.lichess_game_id}`, { headers: { Accept: 'application/json' } });
                if (!lichessResponse.ok) return respond({ gameComplete: false, message: 'Could not fetch game from Lichess' });
                const game = await lichessResponse.json();
                console.log(`[secure-wager] Lichess ${wager.lichess_game_id}: status=${game.status} winner=${game.winner}`);

                const finishedStatuses = ['mate', 'resign', 'outoftime', 'draw', 'stalemate', 'timeout', 'cheat', 'noStart', 'aborted'];
                if (!finishedStatuses.includes(game.status)) return respond({ gameComplete: false, status: game.status, message: 'Game still in progress' });

                const [{ data: pA }, { data: pB }] = await Promise.all([
                    supabase.from('players').select('lichess_username').eq('wallet_address', wager.player_a_wallet).single(),
                    supabase.from('players').select('lichess_username').eq('wallet_address', wager.player_b_wallet).single(),
                ]);

                const playerAUsername = (pA?.lichess_username || '').toLowerCase().trim();
                const playerBUsername = (pB?.lichess_username || '').toLowerCase().trim();
                const whiteUser = (game.players?.white?.userId || game.players?.white?.user?.id || game.players?.white?.user?.name || '').toLowerCase().trim();
                const blackUser = (game.players?.black?.userId || game.players?.black?.user?.id || game.players?.black?.user?.name || '').toLowerCase().trim();

                let winnerWallet: string | null = null;
                let resultType: 'playerA' | 'playerB' | 'draw' | 'unknown' = 'unknown';

                const drawStatuses = ['draw', 'stalemate', 'aborted', 'noStart'];
                if (drawStatuses.includes(game.status) || !game.winner) {
                    resultType = 'draw';
                } else {
                    const winnerLichessUser = game.winner === 'white' ? whiteUser : blackUser;
                    if (playerAUsername && winnerLichessUser === playerAUsername)      { winnerWallet = wager.player_a_wallet; resultType = 'playerA'; }
                    else if (playerBUsername && winnerLichessUser === playerBUsername) { winnerWallet = wager.player_b_wallet; resultType = 'playerB'; }
                    else {
                        console.log(`[secure-wager] Cannot match winner. winner="${winnerLichessUser}" A="${playerAUsername}" B="${playerBUsername}"`);
                        resultType = 'unknown';
                    }
                }

                if (resultType === 'unknown') {
                    return respond({ gameComplete: true, status: game.status, winner: game.winner, resultType: 'unknown',
                        message: `Cannot match players. A="${playerAUsername}" B="${playerBUsername}". white="${whiteUser}" black="${blackUser}".` });
                }

                const { data: updatedWager, error: updateError } = await supabase.from('wagers')
                    .update({ status: 'resolved', winner_wallet: resultType === 'draw' ? null : winnerWallet, resolved_at: new Date().toISOString() })
                    .eq('id', wagerId).in('status', ['voting', 'joined']).select().single();

                if (updateError || !updatedWager) return respond({ gameComplete: true, message: 'Already resolved by concurrent request' });

                const txSig  = await resolveOnChain(supabase, wager, winnerWallet, resultType as 'playerA' | 'playerB' | 'draw');
                const stake  = wager.stake_lamports as number;
                const payout = Math.floor(stake * 2 * 0.9);
                const payoutSol = (payout / 1e9).toFixed(4);

                if (resultType === 'draw') {
                    await insertNotifications(supabase, [
                        { player_wallet: wager.player_a_wallet, type: 'wager_draw', title: 'Game ended in a draw', message: 'Your stake has been refunded in full.', wager_id: wagerId },
                        { player_wallet: wager.player_b_wallet, type: 'wager_draw', title: 'Game ended in a draw', message: 'Your stake has been refunded in full.', wager_id: wagerId },
                    ]);
                } else if (winnerWallet) {
                    const loserWallet = winnerWallet === wager.player_a_wallet ? wager.player_b_wallet : wager.player_a_wallet;
                    await insertNotifications(supabase, [
                        { player_wallet: winnerWallet,         type: 'wager_won',  title: '🏆 You won!',       message: `${payoutSol} SOL has been sent to your wallet.`, wager_id: wagerId },
                        { player_wallet: loserWallet as string, type: 'wager_lost', title: 'You lost this one', message: 'Better luck next time. Create a new wager and get your SOL back.', wager_id: wagerId },
                    ]);
                }

                return respond({
                    gameComplete: true, status: game.status, winner: game.winner,
                    resultType, winnerWallet: resultType === 'draw' ? null : winnerWallet,
                    isDraw: resultType === 'draw', wager: updatedWager,
                    txSignature: txSig,
                    explorerUrl: txSig ? explorerTx(txSig) : null,
                });
            } catch (lichessError) {
                console.error('[secure-wager] Lichess API error:', lichessError);
                return respond({ gameComplete: false, message: 'Error checking Lichess game' });
            }
        }

        // ── cancelWager ────────────────────────────────────────────────────────
        if (action === 'cancelWager') {
            const { wagerId, reason } = data;
            if (!wagerId) return respond({ error: 'Wager ID required' }, 400);
            const wager = await getWager(wagerId);
            if (!['joined', 'voting'].includes(wager.status)) return respond({ error: 'Wager cannot be cancelled in current status' }, 400);
            const isPlayerA = wager.player_a_wallet === walletAddress;
            const isPlayerB = wager.player_b_wallet === walletAddress;
            if (!isPlayerA && !isPlayerB) return respond({ error: 'Only participants can cancel the wager' }, 403);

            const { data: updatedWager, error: updateError } = await supabase.from('wagers')
                .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), cancelled_by: walletAddress,
                    cancel_reason: reason || 'user_requested', ready_player_a: false, ready_player_b: false, countdown_started_at: null })
                .eq('id', wagerId).select().single();
            if (updateError) return respond({ error: 'Failed to cancel wager' }, 500);

            try {
                await supabase.from('wager_transactions').insert({ wager_id: wagerId, tx_type: 'cancelled', wallet_address: wager.player_a_wallet, amount_lamports: 0, status: 'confirmed' });
            } catch { /* non-critical */ }

            if (wager.player_b_wallet) {
                try {
                    const connection    = new Connection(getRpcUrl(), 'confirmed');
                    const authority     = loadAuthorityKeypair();
                    const playerAPubkey = new PublicKey(wager.player_a_wallet);
                    const playerBPubkey = new PublicKey(wager.player_b_wallet);
                    const wagerPda      = deriveWagerPda(playerAPubkey, BigInt(wager.match_id));
                    const pdaBalance    = await connection.getBalance(wagerPda);
                    if (pdaBalance > 0) {
                        const ix    = buildCloseWagerIx(wagerPda, authority.publicKey, playerAPubkey, playerBPubkey);
                        const txSig = await sendAndConfirm(connection, authority, ix);
                        console.log(`[secure-wager] Cancel refund tx: ${txSig}`);
                        await supabase.from('wager_transactions').upsert([
                            { wager_id: wagerId, tx_type: 'cancel_refund', wallet_address: wager.player_a_wallet, amount_lamports: wager.stake_lamports, tx_signature: txSig, status: 'confirmed' },
                            { wager_id: wagerId, tx_type: 'cancel_refund', wallet_address: wager.player_b_wallet, amount_lamports: wager.stake_lamports, tx_signature: txSig, status: 'confirmed' },
                        ], { onConflict: 'tx_signature', ignoreDuplicates: true });
                    }
                } catch (e: unknown) {
                    console.error('[secure-wager] Cancel refund failed:', e instanceof Error ? e.message : String(e));
                }
            }

            const otherPlayer = walletAddress === wager.player_a_wallet ? wager.player_b_wallet : wager.player_a_wallet;
            if (otherPlayer) {
                const cancellerName = await getDisplayName(supabase, walletAddress);
                await insertNotifications(supabase, [{
                    player_wallet: otherPlayer, type: 'wager_cancelled',
                    title: 'Wager cancelled', message: `${cancellerName} cancelled the wager. Your stake has been refunded.`, wager_id: wagerId,
                }]);
            }

            return respond({ wager: updatedWager, message: 'Wager cancelled.', refundInitiated: true });
        }

        return respond({ error: 'Invalid action' }, 400);

    } catch (error) {
        console.error('[secure-wager] Error:', error);
        return respond({ error: 'Internal server error' }, 500);
    }
});
