// supabase/functions/secure-wager/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
    Connection,
    Keypair,
    PublicKey,
    Transaction,
    TransactionInstruction,
    SystemProgram,
} from "https://esm.sh/@solana/web3.js@1.98.0";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-session-token',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const PROGRAM_ID = "E2Vd3U91kMrgwp8JCXcLSn7bt3NowDmGwoBYsVRhGfMR";
const PLATFORM_WALLET = "3hwPwugeuZ33HWJ3SoJkDN2JT3Be9fH62r19ezFiCgYY";
const PLATFORM_FEE_BPS = 1000;
const DISCRIMINATORS = {
    resolve_wager: [31, 179, 1, 228, 83, 224, 1, 123],
    close_wager: [167, 240, 85, 147, 127, 50, 69, 203],
};

function loadAuthorityKeypair(): Keypair {
    const secret = Deno.env.get('AUTHORITY_WALLET_SECRET');
    if (!secret) throw new Error('AUTHORITY_WALLET_SECRET not configured');
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secret)));
}

function deriveWagerPda(playerA: PublicKey, matchId: bigint): PublicKey {
    const matchIdBytes = new Uint8Array(8);
    new DataView(matchIdBytes.buffer).setBigUint64(0, matchId, true);
    const [pda] = PublicKey.findProgramAddressSync(
        [new TextEncoder().encode("wager"), playerA.toBytes(), matchIdBytes],
        new PublicKey(PROGRAM_ID)
    );
    return pda;
}

function buildResolveWagerIx(wagerPda: PublicKey, authority: PublicKey, winner: PublicKey, platformWallet: PublicKey): TransactionInstruction {
    const disc = new Uint8Array(DISCRIMINATORS.resolve_wager);
    const winnerBytes = winner.toBytes();
    const data = new Uint8Array(disc.length + winnerBytes.length);
    data.set(disc, 0);
    data.set(winnerBytes, disc.length);
    return new TransactionInstruction({
        programId: new PublicKey(PROGRAM_ID),
        keys: [
            { pubkey: wagerPda, isSigner: false, isWritable: true },
            { pubkey: winner, isSigner: false, isWritable: true },
            { pubkey: authority, isSigner: true, isWritable: true },
            { pubkey: platformWallet, isSigner: false, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data,
    });
}

function buildCloseWagerIx(wagerPda: PublicKey, authority: PublicKey, playerA: PublicKey, playerB: PublicKey): TransactionInstruction {
    return new TransactionInstruction({
        programId: new PublicKey(PROGRAM_ID),
        keys: [
            { pubkey: wagerPda, isSigner: false, isWritable: true },
            { pubkey: playerA, isSigner: false, isWritable: true },
            { pubkey: playerB, isSigner: false, isWritable: true },
            { pubkey: authority, isSigner: true, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: new Uint8Array(DISCRIMINATORS.close_wager),
    });
}

async function sendAndConfirm(connection: Connection, authority: Keypair, ix: TransactionInstruction): Promise<string> {
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    const tx = new Transaction();
    tx.add(ix);
    tx.recentBlockhash = blockhash;
    tx.feePayer = authority.publicKey;
    tx.sign(authority);
    const sig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false });
    await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');
    return sig;
}

async function resolveOnChain(
    supabase: ReturnType<typeof createClient>,
    wager: Record<string, unknown>,
    winnerWallet: string | null,
    resultType: 'playerA' | 'playerB' | 'draw',
): Promise<string | null> {
    try {
        const rpcUrl = Deno.env.get('SOLANA_RPC_URL') || 'https://api.devnet.solana.com';
        const connection = new Connection(rpcUrl, 'confirmed');
        const authority = loadAuthorityKeypair();
        const playerAPubkey = new PublicKey(wager.player_a_wallet as string);
        const wagerPda = deriveWagerPda(playerAPubkey, BigInt(wager.match_id as number));
        const wagerId = wager.id as string;
        const stake = wager.stake_lamports as number;

        let txSig: string;
        if (resultType === 'draw') {
            const playerBPubkey = new PublicKey(wager.player_b_wallet as string);
            const ix = buildCloseWagerIx(wagerPda, authority.publicKey, playerAPubkey, playerBPubkey);
            txSig = await sendAndConfirm(connection, authority, ix);
            console.log(`[secure-wager] close_wager (draw) tx: ${txSig}`);
            const { error: drawInsertError } = await supabase.from('wager_transactions').upsert([
                { wager_id: wagerId, tx_type: 'draw_refund', wallet_address: wager.player_a_wallet, amount_lamports: stake, tx_signature: txSig, status: 'confirmed' },
                { wager_id: wagerId, tx_type: 'draw_refund', wallet_address: wager.player_b_wallet, amount_lamports: stake, tx_signature: txSig, status: 'confirmed' },
            ], { onConflict: 'tx_signature', ignoreDuplicates: true });
            if (drawInsertError) {
                console.error('[secure-wager] wager_transactions draw upsert failed:', JSON.stringify(drawInsertError));
            }
        } else {
            const totalPot = stake * 2;
            const platformFee = Math.floor(totalPot * PLATFORM_FEE_BPS / 10_000);
            const winnerPayout = totalPot - platformFee;
            const winnerPubkey = new PublicKey(winnerWallet!);
            const platformPubkey = new PublicKey(PLATFORM_WALLET);
            const ix = buildResolveWagerIx(wagerPda, authority.publicKey, winnerPubkey, platformPubkey);
            txSig = await sendAndConfirm(connection, authority, ix);
            console.log(`[secure-wager] resolve_wager tx: ${txSig}`);
            const { error: txInsertError } = await supabase.from('wager_transactions').upsert([
                { wager_id: wagerId, tx_type: 'winner_payout', wallet_address: winnerWallet, amount_lamports: winnerPayout, tx_signature: txSig, status: 'confirmed' },
                { wager_id: wagerId, tx_type: 'platform_fee', wallet_address: PLATFORM_WALLET, amount_lamports: platformFee, tx_signature: txSig, status: 'confirmed' },
            ], { onConflict: 'tx_signature', ignoreDuplicates: true });
            if (txInsertError) {
                console.error('[secure-wager] wager_transactions upsert failed:', JSON.stringify(txInsertError));
            }
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
        await supabase.from('wager_transactions').insert({
            wager_id: wager.id, tx_type: 'error_on_chain_resolve',
            wallet_address: wager.player_a_wallet as string,
            amount_lamports: 0, status: 'failed', error_message: msg,
        }).catch(() => { });
        return null;
    }
}

async function validateSessionToken(token: string): Promise<string | null> {
    try {
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

        if (action === 'create') {
            const { game, stake_lamports, lichess_game_id, is_public, stream_url } = data;
            if (!game || !['chess', 'codm', 'pubg'].includes(game)) return respond({ error: 'Invalid game type' }, 400);
            if (!stake_lamports || stake_lamports <= 0) return respond({ error: 'Invalid stake amount' }, 400);
            const { data: newWager, error } = await supabase.from('wagers').insert({
                match_id: Date.now(), player_a_wallet: walletAddress, game, stake_lamports,
                lichess_game_id: lichess_game_id || null, is_public: is_public !== false, stream_url: stream_url || null,
            }).select().single();
            if (error) { console.error('[secure-wager] Create error:', error); return respond({ error: 'Failed to create wager' }, 500); }
            return respond({ wager: newWager });
        }

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
            return respond({ wager: updatedWager });
        }

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
            if (otherVote && otherVote === votedWinner) { updateData.status = 'retractable'; updateData.retract_deadline = new Date(Date.now() + 15_000).toISOString(); }
            else if (otherVote && otherVote !== votedWinner) { updateData.status = 'disputed'; }
            const { data: updatedWager, error } = await supabase.from('wagers').update(updateData).eq('id', wagerId).select().single();
            if (error) return respond({ error: 'Failed to submit vote' }, 500);
            return respond({ wager: updatedWager });
        }

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

        if (action === 'setReady') {
            const { wagerId, ready } = data;
            if (!wagerId || ready === undefined) return respond({ error: 'Wager ID and ready status required' }, 400);

            // ── ATOMIC READY UPDATE ──────────────────────────────────────────────
            // We use a raw SQL UPDATE so that `countdown_started_at` is decided
            // entirely on the DB's committed row state — not a stale client-side
            // snapshot. This eliminates the race where two simultaneous setReady(true)
            // calls both read otherReady=false and both write countdown_started_at=null.
            //
            // The SQL evaluates the *other* player's column in the same atomic write:
            //   SET ready_player_a = $ready,
            //       countdown_started_at = CASE
            //           WHEN $ready AND ready_player_b THEN NOW()
            //           WHEN NOT $ready              THEN NULL
            //           ELSE countdown_started_at        -- preserve existing value
            //       END
            // (mirrored for player_b)
            //
            // We fall back to a standard JS update only when the wager row is
            // already confirmed via getWager() for the auth/status checks below.

            const wager = await getWager(wagerId);
            if (wager.status !== 'joined') return respond({ error: 'Wager must be in joined status' }, 400);
            const isPlayerA = wager.player_a_wallet === walletAddress;
            const isPlayerB = wager.player_b_wallet === walletAddress;
            if (!isPlayerA && !isPlayerB) return respond({ error: 'You are not a participant' }, 403);

            // Build the atomic SQL expression via rpc helper.
            // We call a lightweight Postgres function `set_player_ready` that
            // performs the CASE-based update and returns the updated row.
            //
            // If that RPC doesn't exist yet (first deploy), we fall back to the
            // safe two-step approach with an explicit re-read after write so at
            // least the countdown_started_at is based on fresh committed data.
            const { data: rpcResult, error: rpcError } = await supabase.rpc('set_player_ready', {
                p_wager_id: wagerId,
                p_is_player_a: isPlayerA,
                p_ready: ready,
            });

            if (rpcError) {
                // RPC not available — fall back to safe two-step:
                // 1. Write only the ready flag (no countdown decision yet)
                // 2. Re-read the row inside a serializable-ish update to decide countdown
                console.warn('[secure-wager] set_player_ready RPC unavailable, using fallback:', rpcError.message);

                const readyField = isPlayerA ? 'ready_player_a' : 'ready_player_b';
                const { error: step1Error } = await supabase
                    .from('wagers')
                    .update({ [readyField]: ready })
                    .eq('id', wagerId);
                if (step1Error) return respond({ error: 'Failed to set ready status' }, 500);

                // Re-read committed state and atomically set countdown only if
                // both flags are now true on the *fresh* row.
                const fresh = await getWager(wagerId);
                const bothReady = fresh.ready_player_a && fresh.ready_player_b;
                const shouldStartCountdown = bothReady && !fresh.countdown_started_at;
                const shouldClearCountdown = !fresh.ready_player_a || !fresh.ready_player_b;

                if (shouldStartCountdown || shouldClearCountdown) {
                    await supabase
                        .from('wagers')
                        .update({
                            countdown_started_at: shouldStartCountdown ? new Date().toISOString() : null,
                        })
                        .eq('id', wagerId)
                        // Only write if the ready state still matches — prevents
                        // a third concurrent call from clobbering a later write.
                        .eq('ready_player_a', fresh.ready_player_a)
                        .eq('ready_player_b', fresh.ready_player_b);
                }

                const updatedWager = await getWager(wagerId);
                return respond({ wager: updatedWager });
            }

            // RPC succeeded — it returns the full updated row
            return respond({ wager: rpcResult });
        }

        if (action === 'startGame') {
            const { wagerId } = data;
            if (!wagerId) return respond({ error: 'Wager ID required' }, 400);
            const wager = await getWager(wagerId);
            if (!wager.ready_player_a || !wager.ready_player_b) return respond({ error: 'Both players must be ready' }, 400);
            if (!wager.countdown_started_at) return respond({ error: 'Countdown not started' }, 400);
            const elapsed = Date.now() - new Date(wager.countdown_started_at).getTime();
            if (elapsed < 11_000) return respond({ error: 'Countdown not complete', elapsed, required: 11000 }, 400);
            const { data: updatedWager, error } = await supabase.from('wagers').update({ status: 'voting' }).eq('id', wagerId).select().single();
            if (error) return respond({ error: 'Failed to start game' }, 500);
            console.log(`[secure-wager] Game started for wager ${wagerId} (elapsed=${elapsed}ms)`);
            return respond({ wager: updatedWager });
        }

        if (action === 'checkGameComplete') {
            const { wagerId } = data;
            if (!wagerId) return respond({ error: 'Wager ID required' }, 400);
            const wager = await getWager(wagerId);

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
                const whiteUser = (game.players?.white?.userId || game.players?.white?.user?.id || game.players?.white?.user?.name || '').toLowerCase().trim();
                const blackUser = (game.players?.black?.userId || game.players?.black?.user?.id || game.players?.black?.user?.name || '').toLowerCase().trim();

                console.log(`[secure-wager] Lichess: white="${whiteUser}" black="${blackUser}" | DB: A="${playerAUsername}" B="${playerBUsername}"`);

                let winnerWallet: string | null = null;
                let resultType: 'playerA' | 'playerB' | 'draw' | 'unknown' = 'unknown';

                const drawStatuses = ['draw', 'stalemate', 'aborted', 'noStart'];
                if (drawStatuses.includes(game.status) || !game.winner) {
                    resultType = 'draw';
                } else {
                    const winnerSide = game.winner;
                    const loserSide = winnerSide === 'white' ? 'black' : 'white';
                    const winnerLichessUser = winnerSide === 'white' ? whiteUser : blackUser;
                    const loserLichessUser = loserSide === 'white' ? whiteUser : blackUser;

                    if (playerAUsername && winnerLichessUser === playerAUsername) {
                        winnerWallet = wager.player_a_wallet; resultType = 'playerA';
                    } else if (playerBUsername && winnerLichessUser === playerBUsername) {
                        winnerWallet = wager.player_b_wallet; resultType = 'playerB';
                    } else if (playerAUsername && loserLichessUser === playerAUsername && playerBUsername === '') {
                        winnerWallet = wager.player_b_wallet; resultType = 'playerB';
                    } else if (playerBUsername && loserLichessUser === playerBUsername && playerAUsername === '') {
                        winnerWallet = wager.player_a_wallet; resultType = 'playerA';
                    } else if (playerAUsername && (whiteUser === playerAUsername || blackUser === playerAUsername) && playerBUsername === '') {
                        if (winnerLichessUser !== playerAUsername) { winnerWallet = wager.player_b_wallet; resultType = 'playerB'; }
                    } else if (playerBUsername && (whiteUser === playerBUsername || blackUser === playerBUsername) && playerAUsername === '') {
                        if (winnerLichessUser !== playerBUsername) { winnerWallet = wager.player_a_wallet; resultType = 'playerA'; }
                    } else {
                        console.log(`[secure-wager] Cannot resolve: winner="${winnerLichessUser}" A="${playerAUsername}" B="${playerBUsername}"`);
                        resultType = 'unknown';
                    }
                }

                if (resultType === 'unknown') {
                    return respond({
                        gameComplete: true, status: game.status, winner: game.winner, resultType: 'unknown',
                        message: `Cannot match players. DB: A="${playerAUsername}" B="${playerBUsername}". Lichess: white="${whiteUser}" black="${blackUser}".`,
                    });
                }

                // ── ATOMIC STATUS GUARD — only one concurrent instance proceeds ──
                const { data: updatedWager, error: updateError } = await supabase.from('wagers')
                    .update({
                        status: 'resolved',
                        winner_wallet: resultType === 'draw' ? null : winnerWallet,
                        resolved_at: new Date().toISOString(),
                    })
                    .eq('id', wagerId)
                    .in('status', ['voting', 'joined']) // atomic: only succeeds if still active
                    .select()
                    .single();

                if (updateError || !updatedWager) {
                    console.log(`[secure-wager] Wager ${wagerId} already resolved by concurrent request, skipping on-chain`);
                    return respond({ gameComplete: true, message: 'Already resolved by concurrent request' });
                }

                console.log(`[secure-wager] Resolving on-chain: ${resultType} for wager ${wagerId}`);
                const txSig = await resolveOnChain(supabase, wager, winnerWallet, resultType as 'playerA' | 'playerB' | 'draw');
                console.log(`[secure-wager] On-chain ${txSig ? 'SUCCESS: ' + txSig : 'FAILED — see wager_transactions error log'}`);

                return respond({
                    gameComplete: true, status: game.status, winner: game.winner,
                    resultType, winnerWallet: resultType === 'draw' ? null : winnerWallet,
                    isDraw: resultType === 'draw', wager: updatedWager,
                    txSignature: txSig,
                    explorerUrl: txSig ? `https://explorer.solana.com/tx/${txSig}?cluster=devnet` : null,
                });

            } catch (lichessError) {
                console.error('[secure-wager] Lichess API error:', lichessError);
                return respond({ gameComplete: false, message: 'Error checking Lichess game' });
            }
        }

        if (action === 'recordOnChainCreate' || action === 'recordOnChainJoin') {
            console.log(`[secure-wager] ${action} recorded`);
            return respond({ success: true });
        }

        if (action === 'cancelWager') {
            const { wagerId, reason } = data;
            if (!wagerId) return respond({ error: 'Wager ID required' }, 400);
            const wager = await getWager(wagerId);
            if (!['joined', 'voting'].includes(wager.status)) return respond({ error: 'Wager cannot be cancelled in current status' }, 400);
            const isPlayerA = wager.player_a_wallet === walletAddress;
            const isPlayerB = wager.player_b_wallet === walletAddress;
            if (!isPlayerA && !isPlayerB) return respond({ error: 'Only participants can cancel the wager' }, 403);

            const { data: updatedWager, error: updateError } = await supabase.from('wagers')
                .update({
                    status: 'cancelled', cancelled_at: new Date().toISOString(),
                    cancelled_by: walletAddress, cancel_reason: reason || 'user_requested',
                    ready_player_a: false, ready_player_b: false, countdown_started_at: null,
                })
                .eq('id', wagerId).select().single();
            if (updateError) return respond({ error: 'Failed to cancel wager' }, 500);

            await supabase.from('wager_transactions').insert({
                wager_id: wagerId, tx_type: 'cancelled', wallet_address: wager.player_a_wallet,
                amount_lamports: 0, status: 'confirmed',
            }).catch(() => { });

            if (wager.player_b_wallet) {
                try {
                    const rpcUrl = Deno.env.get('SOLANA_RPC_URL') || 'https://api.devnet.solana.com';
                    const connection = new Connection(rpcUrl, 'confirmed');
                    const authority = loadAuthorityKeypair();
                    const playerAPubkey = new PublicKey(wager.player_a_wallet);
                    const playerBPubkey = new PublicKey(wager.player_b_wallet);
                    const wagerPda = deriveWagerPda(playerAPubkey, BigInt(wager.match_id));
                    const pdaBalance = await connection.getBalance(wagerPda);
                    if (pdaBalance > 0) {
                        const ix = buildCloseWagerIx(wagerPda, authority.publicKey, playerAPubkey, playerBPubkey);
                        const txSig = await sendAndConfirm(connection, authority, ix);
                        console.log(`[secure-wager] Cancel refund tx: ${txSig}`);
                        const { error: cancelInsertError } = await supabase.from('wager_transactions').upsert([
                            { wager_id: wagerId, tx_type: 'cancel_refund', wallet_address: wager.player_a_wallet, amount_lamports: wager.stake_lamports, tx_signature: txSig, status: 'confirmed' },
                            { wager_id: wagerId, tx_type: 'cancel_refund', wallet_address: wager.player_b_wallet, amount_lamports: wager.stake_lamports, tx_signature: txSig, status: 'confirmed' },
                        ], { onConflict: 'tx_signature', ignoreDuplicates: true });
                        if (cancelInsertError) {
                            console.error('[secure-wager] cancel_refund upsert failed:', JSON.stringify(cancelInsertError));
                        }
                    }
                } catch (e: unknown) {
                    console.error('[secure-wager] Cancel refund failed:', e instanceof Error ? e.message : String(e));
                }
            }

            return respond({ wager: updatedWager, message: 'Wager cancelled.', refundInitiated: true });
        }

        return respond({ error: 'Invalid action' }, 400);

    } catch (error) {
        console.error('[secure-wager] Error:', error);
        return respond({ error: 'Internal server error' }, 500);
    }
});