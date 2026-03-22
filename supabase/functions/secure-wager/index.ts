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

async function createLichessGame(
    playerAUsername: string,
    playerBUsername: string,
    clockLimit: number,
    clockIncrement: number,
    rated: boolean,
    sidePreference: string = 'random',
): Promise<{ gameId: string; urlWhite: string; urlBlack: string }> {
    const platformToken = Deno.env.get('LICHESS_PLATFORM_TOKEN');
    if (!platformToken) throw new Error('LICHESS_PLATFORM_TOKEN not configured');

    const body = new URLSearchParams({
        'clock.limit': String(clockLimit),
        'clock.increment': String(clockIncrement),
        rated: String(rated),
        users: sidePreference === 'black'
            ? `${playerBUsername},${playerAUsername}`
            : `${playerAUsername},${playerBUsername}`,
        rules: 'noRematch,noEarlyDraw',
        name: 'GameGambit Wager',
    });

    const res = await fetch('https://lichess.org/api/challenge/open', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${platformToken}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
        },
        body: body.toString(),
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Lichess challenge creation failed (${res.status}): ${errText}`);
    }

    const challenge = await res.json() as {
        id: string;
        url: string;
        urlWhite: string;
        urlBlack: string;
    };

    if (!challenge.id) throw new Error('Lichess returned no game ID');
    return {
        gameId: challenge.id,
        urlWhite: challenge.urlWhite,
        urlBlack: challenge.urlBlack,
    };
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
            await supabase.from('wager_transactions').upsert([
                { wager_id: wagerId, tx_type: 'draw_refund', wallet_address: wager.player_a_wallet, amount_lamports: stake, tx_signature: txSig, status: 'confirmed' },
                { wager_id: wagerId, tx_type: 'draw_refund', wallet_address: wager.player_b_wallet, amount_lamports: stake, tx_signature: txSig, status: 'confirmed' },
            ], { onConflict: 'tx_signature', ignoreDuplicates: true });
        } else {
            const totalPot = stake * 2;
            const platformFee = Math.floor(totalPot * PLATFORM_FEE_BPS / 10_000);
            const winnerPayout = totalPot - platformFee;
            const winnerPubkey = new PublicKey(winnerWallet!);
            const platformPubkey = new PublicKey(PLATFORM_WALLET);
            const ix = buildResolveWagerIx(wagerPda, authority.publicKey, winnerPubkey, platformPubkey);
            txSig = await sendAndConfirm(connection, authority, ix);
            console.log(`[secure-wager] resolve_wager tx: ${txSig}`);
            await supabase.from('wager_transactions').upsert([
                { wager_id: wagerId, tx_type: 'winner_payout', wallet_address: winnerWallet, amount_lamports: winnerPayout, tx_signature: txSig, status: 'confirmed' },
                { wager_id: wagerId, tx_type: 'platform_fee', wallet_address: PLATFORM_WALLET, amount_lamports: platformFee, tx_signature: txSig, status: 'confirmed' },
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
        if (payload.exp < Date.now()) return null;
        const encoder = new TextEncoder();
        const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(payloadStr + supabaseServiceKey));
        const computedHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
        if (computedHash !== hash) return null;
        return payload.wallet;
    } catch {
        return null;
    }
}

// ── Get display name for a wallet (username > truncated address) ──────────────
async function getDisplayName(supabase: ReturnType<typeof createClient>, walletAddress: string): Promise<string> {
    try {
        const { data } = await supabase
            .from('players')
            .select('username')
            .eq('wallet_address', walletAddress)
            .single();
        if (data?.username) return data.username;
    } catch { /* ignore */ }
    return walletAddress.slice(0, 4) + '...' + walletAddress.slice(-4);
}

// ── Insert notifications ───────────────────────────────────────────────────────
async function insertNotifications(
    supabase: ReturnType<typeof createClient>,
    items: Array<{
        player_wallet: string
        type: string
        title: string
        message: string
        wager_id?: string
    }>
) {
    try {
        const { error } = await supabase.from('notifications').insert(items);
        if (error) console.warn('[secure-wager] notification insert error:', error);
        // Fire Web Push for each recipient
        await Promise.allSettled(items.map(item => sendWebPush(supabase, item)));
    } catch (e) {
        console.warn('[secure-wager] Failed to insert notifications:', e);
    }
}

// ── Web Push sender ───────────────────────────────────────────────────────────
// Implements RFC 8291 (Message Encryption) + RFC 8292 (VAPID)
async function sendWebPush(
    supabase: ReturnType<typeof createClient>,
    notification: { player_wallet: string; title: string; message: string; wager_id?: string }
): Promise<void> {
    try {
        const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')?.trim();
        const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')?.trim();
        const vapidSubject = Deno.env.get('VAPID_SUBJECT')?.trim();
        if (!vapidPrivateKey || !vapidPublicKey || !vapidSubject) {
            console.warn('[push] VAPID secrets not configured');
            return;
        }

        const { data: subs } = await supabase
            .from('push_subscriptions')
            .select('endpoint, p256dh, auth')
            .eq('player_wallet', notification.player_wallet);

        if (!subs || subs.length === 0) return;

        const payloadJson = JSON.stringify({
            title: notification.title,
            body: notification.message,
            icon: '/logo.png',
            badge: '/favicon.png',
            tag: 'gg-' + Date.now(),
            url: notification.wager_id ? '/my-wagers' : '/',
        });

        await Promise.allSettled(subs.map(async (sub) => {
            try {
                const audience = new URL(sub.endpoint).origin;
                const vapidJwt = await buildVapidJwt(vapidSubject, audience, vapidPublicKey, vapidPrivateKey);
                const encrypted = await encryptWebPushPayload(payloadJson, sub.p256dh, sub.auth);

                const res = await fetch(sub.endpoint, {
                    method: 'POST',
                    headers: {
                        'Authorization': `vapid t=${vapidJwt},k=${vapidPublicKey}`,
                        'Content-Type': 'application/octet-stream',
                        'Content-Encoding': 'aes128gcm',
                        'TTL': '86400',
                        'Content-Length': encrypted.byteLength.toString(),
                    },
                    body: encrypted,
                });

                if (!res.ok) {
                    console.warn(`[push] endpoint ${res.status}: ${sub.endpoint.slice(0, 60)}`);
                    if (res.status === 404 || res.status === 410) {
                        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
                    }
                } else {
                    console.log('[push] sent successfully to', sub.endpoint.slice(0, 60));
                }
            } catch (e) {
                console.warn('[push] per-subscription error:', e);
            }
        }));
    } catch (e) {
        console.warn('[secure-wager] sendWebPush error:', e);
    }
}

// ── VAPID JWT (RFC 8292) ──────────────────────────────────────────────────────
// Deno crypto does NOT support importing raw EC private keys — requires PKCS8.
// VAPID private keys are 32-byte raw P-256 scalars. We wrap them in PKCS8.
async function buildVapidJwt(subject: string, audience: string, publicKeyB64: string, privateKeyB64: string): Promise<string> {
    const b64url = (obj: unknown) =>
        btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

    const now = Math.floor(Date.now() / 1000);
    const header = b64url({ typ: 'JWT', alg: 'ES256' });
    const payload = b64url({ aud: audience, exp: now + 3600, sub: subject });
    const unsigned = `${header}.${payload}`;

    // Convert raw 32-byte private key + uncompressed public key to PKCS8 DER
    const privBytes = b64urlDecode(privateKeyB64);
    const pubBytes = b64urlDecode(publicKeyB64);
    const pkcs8 = buildPkcs8(privBytes, pubBytes);

    const cryptoKey = await crypto.subtle.importKey(
        'pkcs8', pkcs8,
        { name: 'ECDSA', namedCurve: 'P-256' },
        false, ['sign']
    );

    const sig = await crypto.subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' },
        cryptoKey,
        new TextEncoder().encode(unsigned)
    );

    const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
        .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    return `${unsigned}.${sigB64}`;
}

// Build a minimal PKCS8 DER structure for a P-256 private key
// Structure: SEQUENCE { version, privateKeyAlgorithm (OID), privateKey (ECPrivateKey) }
function buildPkcs8(privKey: Uint8Array, pubKey: Uint8Array): ArrayBuffer {
    // ECPrivateKey ::= SEQUENCE { version(1), privateKey OCTET STRING, publicKey [1] BIT STRING }
    const ecPrivKey = concat(
        new Uint8Array([0x30]), // SEQUENCE
        derLength(1 + 2 + 32 + 2 + 2 + 66),
        new Uint8Array([0x02, 0x01, 0x01]), // version = 1
        new Uint8Array([0x04, 0x20]), ...[privKey], // privateKey OCTET STRING (32 bytes)
        new Uint8Array([0xa1, 0x44, 0x03, 0x42, 0x00]), ...[pubKey], // publicKey [1] BIT STRING
    );

    // AlgorithmIdentifier: { OID id-ecPublicKey, OID secp256r1 }
    const oid = new Uint8Array([
        0x30, 0x13,
        0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01, // id-ecPublicKey
        0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, // secp256r1
    ]);

    const ecPrivKeyWrapped = new Uint8Array([0x04, ...tlvLength(ecPrivKey.length), ...ecPrivKey]);

    return concat(
        new Uint8Array([0x30]),
        derLength(1 + 2 + oid.length + ecPrivKeyWrapped.length),
        new Uint8Array([0x02, 0x01, 0x00]), // version = 0
        oid,
        ecPrivKeyWrapped,
    ).buffer;
}

function derLength(len: number): Uint8Array {
    if (len < 128) return new Uint8Array([len]);
    if (len < 256) return new Uint8Array([0x81, len]);
    return new Uint8Array([0x82, len >> 8, len & 0xff]);
}

function tlvLength(len: number): number[] {
    if (len < 128) return [len];
    if (len < 256) return [0x81, len];
    return [0x82, len >> 8, len & 0xff];
}

// ── Web Push payload encryption (RFC 8291 / aes128gcm) ────────────────────────
async function encryptWebPushPayload(plaintext: string, p256dhB64: string, authB64: string): Promise<Uint8Array> {
    const encoder = new TextEncoder();
    const plaintextBytes = encoder.encode(plaintext);
    const receiverPubKeyBytes = b64urlDecode(p256dhB64);
    const authSecret = b64urlDecode(authB64);

    // Generate ephemeral sender ECDH key pair
    const senderKP = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    const receiverPubKey = await crypto.subtle.importKey('raw', receiverPubKeyBytes, { name: 'ECDH', namedCurve: 'P-256' }, true, []);

    const sharedBits = await crypto.subtle.deriveBits({ name: 'ECDH', public: receiverPubKey }, senderKP.privateKey, 256);
    const sharedSecret = new Uint8Array(sharedBits);
    const senderPubKeyRaw = new Uint8Array(await crypto.subtle.exportKey('raw', senderKP.publicKey));

    const salt = crypto.getRandomValues(new Uint8Array(16));

    // PRK via HKDF-SHA-256 with auth as salt
    const prkMaterial = await crypto.subtle.importKey('raw', sharedSecret, 'HKDF', false, ['deriveBits']);
    const authInfo = concat(encoder.encode('WebPush: info\0'), receiverPubKeyBytes, senderPubKeyRaw);
    const prkBits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: authSecret, info: authInfo }, prkMaterial, 256);
    const prk = new Uint8Array(prkBits);

    const prkKey = await crypto.subtle.importKey('raw', prk, 'HKDF', false, ['deriveBits']);
    const cekBits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info: encoder.encode('Content-Encoding: aes128gcm\0') }, prkKey, 128);
    const nonceBits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info: encoder.encode('Content-Encoding: nonce\0') }, prkKey, 96);

    const cek = await crypto.subtle.importKey('raw', cekBits, 'AES-GCM', false, ['encrypt']);
    const nonce = new Uint8Array(nonceBits);

    // Pad + delimiter
    const record = new Uint8Array(plaintextBytes.length + 1);
    record.set(plaintextBytes);
    record[plaintextBytes.length] = 0x02;

    const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, cek, record));

    // aes128gcm header: salt(16) + rs(4) + idlen(1) + keyid(65)
    const hdr = new Uint8Array(86);
    hdr.set(salt, 0);
    new DataView(hdr.buffer).setUint32(16, 4096, false);
    hdr[20] = 65;
    hdr.set(senderPubKeyRaw, 21);

    return concat(hdr, ciphertext);
}

function b64urlDecode(b64: string): Uint8Array {
    const padded = b64.replace(/-/g, '+').replace(/_/g, '/');
    const padding = '='.repeat((4 - (padded.length % 4)) % 4);
    return Uint8Array.from(atob(padded + padding), c => c.charCodeAt(0));
}

function concat(...arrays: Uint8Array[]): Uint8Array {
    const total = arrays.reduce((s, a) => s + a.length, 0);
    const out = new Uint8Array(total);
    let off = 0;
    for (const a of arrays) { out.set(a, off); off += a.length; }
    return out;
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { status: 200, headers: corsHeaders });

    const respond = (body: unknown, status = 200) =>
        new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    try {
        const sessionToken = req.headers.get('X-Session-Token')?.trim();
        const { action, ...data } = await req.json();
        console.log(`[secure-wager] Action: ${action}`);

        const requiresAuth = !['checkGameComplete'].includes(action);
        let walletAddress = '';

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
                    chess_clock_limit: chess_clock_limit ?? 300,
                    chess_clock_increment: chess_clock_increment ?? 3,
                    chess_rated: chess_rated ?? false,
                    chess_side_preference: chess_side_preference ?? 'random',
                }),
            }).select().single();

            if (error) {
                console.error('[secure-wager] Create error:', error);
                return respond({ error: 'Failed to create wager' }, 500);
            }
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

            // Get joiner's display name for notification
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
            if (otherVote && otherVote === votedWinner) { updateData.status = 'retractable'; updateData.retract_deadline = new Date(Date.now() + 15_000).toISOString(); }
            else if (otherVote && otherVote !== votedWinner) { updateData.status = 'disputed'; }
            const { data: updatedWager, error } = await supabase.from('wagers').update(updateData).eq('id', wagerId).select().single();
            if (error) return respond({ error: 'Failed to submit vote' }, 500);
            return respond({ wager: updatedWager });
        }

        // ── edit ───────────────────────────────────────────────────────────────
        if (action === 'edit') {
            const { wagerId, stake_lamports, stream_url, is_public } = data;
            if (!wagerId) return respond({ error: 'Wager ID required' }, 400);
            const wager = await getWager(wagerId);
            if (wager.player_a_wallet !== walletAddress) return respond({ error: 'Only the wager owner can edit' }, 403);
            const updateData: Record<string, unknown> = {};
            if (wager.status === 'created') {
                if (stake_lamports !== undefined) updateData.stake_lamports = stake_lamports;
                if (is_public !== undefined) updateData.is_public = is_public;
            }
            if (stream_url !== undefined) updateData.stream_url = stream_url || null;
            const { data: updatedWager, error } = await supabase.from('wagers').update(updateData).eq('id', wagerId).select().single();
            if (error) return respond({ error: 'Failed to edit wager' }, 500);
            return respond({ wager: updatedWager });
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

            const { data: rpcResult, error: rpcError } = await supabase.rpc('set_player_ready', {
                p_wager_id: wagerId,
                p_is_player_a: isPlayerA,
                p_ready: ready,
            });

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
                        countdown_started_at: shouldStartCountdown
                            ? new Date(Date.now() - 1000).toISOString()
                            : null,
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
            const elapsed = Date.now() - new Date(wager.countdown_started_at).getTime();
            if (!bothDeposited && elapsed < 11_000) {
                return respond({ error: 'Waiting for both players to deposit', elapsed, bothDeposited }, 400);
            }
            const { data: updatedWager, error } = await supabase.from('wagers')
                .update({ status: 'voting' })
                .eq('id', wagerId).eq('status', 'joined').select().single();
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
                console.log(`[secure-wager] Both deposited on chess wager ${wagerId} — creating Lichess game`);
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
                console.log(`[secure-wager] Both deposited on chess wager ${wagerId} — creating Lichess game`);
                const lichessResult = await tryCreateLichessGame(supabase, wagerId, wager);
                await insertNotifications(supabase, [
                    { player_wallet: wager.player_a_wallet, type: 'game_started', title: 'Game started!', message: 'Both players have deposited. Your Lichess game is ready — click your play link.', wager_id: wagerId },
                    { player_wallet: wager.player_b_wallet, type: 'game_started', title: 'Game started!', message: 'Both players have deposited. Your Lichess game is ready — click your play link.', wager_id: wagerId },
                ]);
                return respond({ success: true, wager: { ...updated, ...lichessResult }, gameStarted: true });
            }

            return respond({ success: true, wager: updated, gameStarted: bothDeposited });
        }

        // ── checkGameComplete ──────────────────────────────────────────────────
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

                console.log(`[secure-wager] white="${whiteUser}" black="${blackUser}" | A="${playerAUsername}" B="${playerBUsername}"`);

                let winnerWallet: string | null = null;
                let resultType: 'playerA' | 'playerB' | 'draw' | 'unknown' = 'unknown';

                const drawStatuses = ['draw', 'stalemate', 'aborted', 'noStart'];
                if (drawStatuses.includes(game.status) || !game.winner) {
                    resultType = 'draw';
                } else {
                    const winnerLichessUser = game.winner === 'white' ? whiteUser : blackUser;
                    if (playerAUsername && winnerLichessUser === playerAUsername) {
                        winnerWallet = wager.player_a_wallet; resultType = 'playerA';
                    } else if (playerBUsername && winnerLichessUser === playerBUsername) {
                        winnerWallet = wager.player_b_wallet; resultType = 'playerB';
                    } else {
                        console.log(`[secure-wager] Cannot match winner. winner="${winnerLichessUser}" A="${playerAUsername}" B="${playerBUsername}"`);
                        resultType = 'unknown';
                    }
                }

                if (resultType === 'unknown') {
                    return respond({
                        gameComplete: true, status: game.status, winner: game.winner, resultType: 'unknown',
                        message: `Cannot match players. A="${playerAUsername}" B="${playerBUsername}". white="${whiteUser}" black="${blackUser}".`,
                    });
                }

                const { data: updatedWager, error: updateError } = await supabase.from('wagers')
                    .update({ status: 'resolved', winner_wallet: resultType === 'draw' ? null : winnerWallet, resolved_at: new Date().toISOString() })
                    .eq('id', wagerId).in('status', ['voting', 'joined']).select().single();

                if (updateError || !updatedWager) {
                    return respond({ gameComplete: true, message: 'Already resolved by concurrent request' });
                }

                const txSig = await resolveOnChain(supabase, wager, winnerWallet, resultType as 'playerA' | 'playerB' | 'draw');

                const stake = wager.stake_lamports as number;
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
                        { player_wallet: winnerWallet, type: 'wager_won', title: '🏆 You won!', message: `${payoutSol} SOL has been sent to your wallet.`, wager_id: wagerId },
                        { player_wallet: loserWallet as string, type: 'wager_lost', title: 'You lost this one', message: 'Better luck next time. Create a new wager and get your SOL back.', wager_id: wagerId },
                    ]);
                }

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
                .update({
                    status: 'cancelled', cancelled_at: new Date().toISOString(),
                    cancelled_by: walletAddress, cancel_reason: reason || 'user_requested',
                    ready_player_a: false, ready_player_b: false, countdown_started_at: null,
                })
                .eq('id', wagerId).select().single();
            if (updateError) return respond({ error: 'Failed to cancel wager' }, 500);

            try {
                await supabase.from('wager_transactions').insert({
                    wager_id: wagerId, tx_type: 'cancelled', wallet_address: wager.player_a_wallet,
                    amount_lamports: 0, status: 'confirmed',
                });
            } catch { /* non-critical */ }

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
                        await supabase.from('wager_transactions').upsert([
                            { wager_id: wagerId, tx_type: 'cancel_refund', wallet_address: wager.player_a_wallet, amount_lamports: wager.stake_lamports, tx_signature: txSig, status: 'confirmed' },
                            { wager_id: wagerId, tx_type: 'cancel_refund', wallet_address: wager.player_b_wallet, amount_lamports: wager.stake_lamports, tx_signature: txSig, status: 'confirmed' },
                        ], { onConflict: 'tx_signature', ignoreDuplicates: true });
                    }
                } catch (e: unknown) {
                    console.error('[secure-wager] Cancel refund failed:', e instanceof Error ? e.message : String(e));
                }
            }

            // Notify the other player — use display name
            const otherPlayer = walletAddress === wager.player_a_wallet ? wager.player_b_wallet : wager.player_a_wallet;
            if (otherPlayer) {
                const cancellerName = await getDisplayName(supabase, walletAddress);
                await insertNotifications(supabase, [{
                    player_wallet: otherPlayer,
                    type: 'wager_cancelled',
                    title: 'Wager cancelled',
                    message: `${cancellerName} cancelled the wager. Your stake has been refunded.`,
                    wager_id: wagerId,
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

// ── Helper: try creating Lichess game ─────────────────────────────────────────
async function tryCreateLichessGame(
    supabase: ReturnType<typeof createClient>,
    wagerId: string,
    wager: Record<string, unknown>,
): Promise<{ lichess_game_id?: string; lichess_url_white?: string; lichess_url_black?: string }> {
    try {
        const [{ data: pA }, { data: pB }] = await Promise.all([
            supabase.from('players').select('lichess_username').eq('wallet_address', wager.player_a_wallet).single(),
            supabase.from('players').select('lichess_username').eq('wallet_address', wager.player_b_wallet).single(),
        ]);

        const playerAUsername = pA?.lichess_username;
        const playerBUsername = pB?.lichess_username;

        if (!playerAUsername || !playerBUsername) {
            console.error(`[secure-wager] Cannot create Lichess game — missing usernames. A="${playerAUsername}" B="${playerBUsername}"`);
            return {};
        }

        const clockLimit = (wager.chess_clock_limit as number) ?? 300;
        const clockIncrement = (wager.chess_clock_increment as number) ?? 3;
        const rated = (wager.chess_rated as boolean) ?? false;
        const sidePreference = (wager.chess_side_preference as string) ?? 'random';

        const { gameId, urlWhite, urlBlack } = await createLichessGame(
            playerAUsername,
            playerBUsername,
            clockLimit,
            clockIncrement,
            rated,
            sidePreference,
        );

        console.log(`[secure-wager] Lichess game created: ${gameId} for wager ${wagerId}`);

        await supabase.from('wagers').update({
            lichess_game_id: gameId,
            lichess_url_white: urlWhite,
            lichess_url_black: urlBlack,
        }).eq('id', wagerId);

        return { lichess_game_id: gameId, lichess_url_white: urlWhite, lichess_url_black: urlBlack };

    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[secure-wager] createLichessGame failed for wager ${wagerId}:`, msg);
        return {};
    }
}