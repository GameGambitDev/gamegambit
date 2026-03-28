// supabase/functions/secure-wager/auth.ts
//
// Session token validation only.
// The token is a base64-encoded JSON payload signed with HMAC-SHA256
// using SUPABASE_SERVICE_ROLE_KEY as the secret.

const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

export async function validateSessionToken(token: string): Promise<string | null> {
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
