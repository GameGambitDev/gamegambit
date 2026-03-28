// supabase/functions/secure-wager/notifications.ts
//
// In-app notification inserts + Web Push delivery.
// Used by actions.ts. Also re-exported for use by future edge functions
// (assign-moderator, process-verdict, process-concession).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── In-app + Push ─────────────────────────────────────────────────────────────

export async function getDisplayName(
    supabase: ReturnType<typeof createClient>,
    walletAddress: string,
): Promise<string> {
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

export async function insertNotifications(
    supabase: ReturnType<typeof createClient>,
    items: Array<{
        player_wallet: string;
        type: string;
        title: string;
        message: string;
        wager_id?: string;
    }>,
): Promise<void> {
    try {
        const { error } = await supabase.from('notifications').insert(items);
        if (error) console.warn('[notifications] insert error:', error);
        await Promise.allSettled(items.map(item => sendWebPush(supabase, item)));
    } catch (e) {
        console.warn('[notifications] Failed to insert notifications:', e);
    }
}

// ── Web Push ──────────────────────────────────────────────────────────────────

async function sendWebPush(
    supabase: ReturnType<typeof createClient>,
    notification: { player_wallet: string; title: string; message: string; wager_id?: string },
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
                    console.log('[push] sent to', sub.endpoint.slice(0, 60));
                }
            } catch (e) {
                console.warn('[push] per-subscription error:', e);
            }
        }));
    } catch (e) {
        console.warn('[push] sendWebPush error:', e);
    }
}

// ── VAPID / Crypto helpers ────────────────────────────────────────────────────

async function buildVapidJwt(
    subject: string,
    audience: string,
    publicKeyB64: string,
    privateKeyB64: string,
): Promise<string> {
    const b64url = (obj: unknown) =>
        btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

    const now = Math.floor(Date.now() / 1000);
    const header = b64url({ typ: 'JWT', alg: 'ES256' });
    const payload = b64url({ aud: audience, exp: now + 3600, sub: subject });
    const unsigned = `${header}.${payload}`;

    const privBytes = b64urlDecode(privateKeyB64);
    const pubBytes = b64urlDecode(publicKeyB64);
    const pkcs8 = buildPkcs8(privBytes, pubBytes);

    const cryptoKey = await crypto.subtle.importKey(
        'pkcs8', pkcs8,
        { name: 'ECDSA', namedCurve: 'P-256' },
        false, ['sign'],
    );

    const sig = await crypto.subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' },
        cryptoKey,
        new TextEncoder().encode(unsigned),
    );

    const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
        .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    return `${unsigned}.${sigB64}`;
}

function buildPkcs8(privKey: Uint8Array, pubKey: Uint8Array): ArrayBuffer {
    const ecPrivKey = concat(
        new Uint8Array([0x30]),
        derLength(1 + 2 + 32 + 2 + 2 + 66),
        new Uint8Array([0x02, 0x01, 0x01]),
        new Uint8Array([0x04, 0x20]), ...[privKey],
        new Uint8Array([0xa1, 0x44, 0x03, 0x42, 0x00]), ...[pubKey],
    );

    const oid = new Uint8Array([
        0x30, 0x13,
        0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01,
        0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07,
    ]);

    const ecPrivKeyWrapped = new Uint8Array([0x04, ...tlvLength(ecPrivKey.length), ...ecPrivKey]);

    return concat(
        new Uint8Array([0x30]),
        derLength(1 + 2 + oid.length + ecPrivKeyWrapped.length),
        new Uint8Array([0x02, 0x01, 0x00]),
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

async function encryptWebPushPayload(
    plaintext: string,
    p256dhB64: string,
    authB64: string,
): Promise<Uint8Array> {
    const encoder = new TextEncoder();
    const plaintextBytes = encoder.encode(plaintext);
    const receiverPubKeyBytes = b64urlDecode(p256dhB64);
    const authSecret = b64urlDecode(authB64);

    const senderKP = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    const receiverPubKey = await crypto.subtle.importKey('raw', receiverPubKeyBytes, { name: 'ECDH', namedCurve: 'P-256' }, true, []);

    const sharedBits = await crypto.subtle.deriveBits({ name: 'ECDH', public: receiverPubKey }, senderKP.privateKey, 256);
    const sharedSecret = new Uint8Array(sharedBits);
    const senderPubKeyRaw = new Uint8Array(await crypto.subtle.exportKey('raw', senderKP.publicKey));

    const salt = crypto.getRandomValues(new Uint8Array(16));

    const prkMaterial = await crypto.subtle.importKey('raw', sharedSecret, 'HKDF', false, ['deriveBits']);
    const authInfo = concat(encoder.encode('WebPush: info\0'), receiverPubKeyBytes, senderPubKeyRaw);
    const prkBits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: authSecret, info: authInfo }, prkMaterial, 256);
    const prk = new Uint8Array(prkBits);

    const prkKey = await crypto.subtle.importKey('raw', prk, 'HKDF', false, ['deriveBits']);
    const cekBits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info: encoder.encode('Content-Encoding: aes128gcm\0') }, prkKey, 128);
    const nonceBits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info: encoder.encode('Content-Encoding: nonce\0') }, prkKey, 96);

    const cek = await crypto.subtle.importKey('raw', cekBits, 'AES-GCM', false, ['encrypt']);
    const nonce = new Uint8Array(nonceBits);

    const record = new Uint8Array(plaintextBytes.length + 1);
    record.set(plaintextBytes);
    record[plaintextBytes.length] = 0x02;

    const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, cek, record));

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
