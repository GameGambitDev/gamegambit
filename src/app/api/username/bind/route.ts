// src/app/api/username/bind/route.ts
//
// POST /api/username/bind
// Body: { game: 'pubg' | 'codm' | 'free_fire', username: string, accountId?: string }
//
// Thin wrapper around secure-player's `bindGame` action.
// Checks if the username is already taken first — if so, returns a structured
// USERNAME_TAKEN error so the caller can open the appeal flow instead.
//
// Auth: X-Session-Token (HMAC-SHA256 scheme, same as secure-player)

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import type { Database } from '@/integrations/supabase/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const secret = process.env.AUTHORITY_WALLET_SECRET!;

const ALLOWED_GAMES = ['pubg', 'codm', 'free_fire'] as const;
type AllowedGame = typeof ALLOWED_GAMES[number];

// ── Session validation ────────────────────────────────────────────────────────

async function validateSessionToken(token: string): Promise<string | null> {
  try {
    const dotIndex = token.lastIndexOf('.');
    if (dotIndex === -1) return null;
    const payloadB64 = token.substring(0, dotIndex);
    const hash = token.substring(dotIndex + 1);
    let payloadStr: string;
    try { payloadStr = Buffer.from(payloadB64, 'base64').toString('utf-8'); }
    catch { return null; }
    let payload: { wallet: string; exp: number };
    try { payload = JSON.parse(payloadStr); }
    catch { return null; }
    if (!payload.wallet || !payload.exp) return null;
    if (payload.exp < Date.now()) return null;
    const computedHash = crypto.createHash('sha256').update(payloadStr + secret).digest('hex');
    if (computedHash !== hash) return null;
    return payload.wallet;
  } catch {
    return null;
  }
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status });
}

function getUsernameColumn(game: AllowedGame): string {
  switch (game) {
    case 'pubg': return 'pubg_username';
    case 'codm': return 'codm_username';
    case 'free_fire': return 'free_fire_username';
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const token = req.headers.get('X-Session-Token')?.trim();
  if (!token) return json({ error: 'Unauthorised' }, 401);

  const callerWallet = await validateSessionToken(token);
  if (!callerWallet) return json({ error: 'Invalid or expired session' }, 401);

  let body: { game?: string; username?: string; accountId?: string };
  try { body = await req.json(); }
  catch { return json({ error: 'Invalid JSON' }, 400); }

  const { game, username, accountId } = body;

  if (!game || !ALLOWED_GAMES.includes(game as AllowedGame)) {
    return json({ error: 'Invalid game. Must be pubg, codm, or free_fire.' }, 400);
  }
  if (!username || typeof username !== 'string' || username.trim().length === 0) {
    return json({ error: 'Username is required' }, 400);
  }

  const cleanUsername = username.trim();
  const validGame = game as AllowedGame;
  const usernameColumn = getUsernameColumn(validGame);

  const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

  // ── Check if username is already taken by someone else ────────────────────
  const { data: existing } = await (supabase
    .from('players')
    .select('wallet_address')
    .eq(usernameColumn as 'wallet_address', cleanUsername)
    .neq('wallet_address', callerWallet)
    .maybeSingle() as any) as { data: { wallet_address: string } | null };

  if (existing) {
    return json({
      error: 'USERNAME_TAKEN',
      message: 'This username is already linked to another account.',
    }, 409);
  }

  // ── Forward to secure-player bindGame ─────────────────────────────────────
  // We call the edge function directly so all the update + bound_at logic
  // stays in one place (secure-player/index.ts).
  const edgeFnUrl = `${supabaseUrl}/functions/v1/secure-player`;

  const resp = await fetch(edgeFnUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'X-Session-Token': token,
    },
    body: JSON.stringify({ action: 'bindGame', game: validGame, username: cleanUsername, accountId }),
  });

  const data = await resp.json();

  if (!resp.ok || data?.error) {
    // Propagate USERNAME_TAKEN from edge fn too (race condition safety)
    const status = data?.error === 'USERNAME_TAKEN' ? 409 : resp.status;
    return json({ error: data?.error || 'Failed to bind username' }, status);
  }

  return json({ ok: true, message: `${validGame} account linked successfully.` });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Session-Token',
    },
  });
}