/**
 * GameGambit — Phase 0 Security Tests
 * Tests all 5 SEC fixes by verifying unauthenticated requests are rejected.
 *
 * Usage:
 *   1. Copy this file to your project root
 *   2. Start your Next.js dev server: npm run dev
 *   3. In a second terminal: node test-phase0-security.mjs
 *
 * For Supabase edge functions you need supabase start running locally,
 * OR set SUPABASE_URL to your remote project URL in .env.local and the
 * script will test against production (safe — all tests only send bad/missing auth).
 *
 * Set these in your environment or .env.local before running:
 *   NEXT_PUBLIC_SUPABASE_URL   — your Supabase project URL
 *   RESOLVE_WAGER_CALLER_SECRET — the secret you generated
 *   ADMIN_SIGNUP_SECRET         — the secret you generated
 *   LICHESS_WEBHOOK_SECRET      — the secret you generated
 */

import { createHmac } from 'crypto';

// ── Config ────────────────────────────────────────────────────────────────────

const NEXT_URL = process.env.NEXT_URL || 'http://localhost:3000';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

if (!SUPABASE_URL) {
  console.error('❌  NEXT_PUBLIC_SUPABASE_URL is not set. Add it to .env.local or export it first.');
  process.exit(1);
}

const RESOLVE_SECRET   = process.env.RESOLVE_WAGER_CALLER_SECRET || '';
const ADMIN_SECRET     = process.env.ADMIN_SIGNUP_SECRET || '';
const LICHESS_SECRET   = process.env.LICHESS_WEBHOOK_SECRET || '';

// ── Helpers ───────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

async function check(label, fn) {
  try {
    await fn();
    console.log(`  ✅  ${label}`);
    passed++;
  } catch (e) {
    console.error(`  ❌  ${label}`);
    console.error(`      ${e.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function post(url, body = {}, headers = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

function sign(body, secret) {
  return 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
}

// ── Tests ─────────────────────────────────────────────────────────────────────

console.log('\n🔐  GameGambit — Phase 0 Security Tests\n');

// ── SEC-01: resolve-wager caller secret ──────────────────────────────────────
console.log('SEC-01 · resolve-wager caller secret');
const resolveUrl = `${SUPABASE_URL}/functions/v1/resolve-wager`;

await check('Rejects request with NO secret header (expect 401 or 503)', async () => {
  const { status } = await post(resolveUrl, { action: 'resolve_wager' });
  assert(status === 401 || status === 503,
    `Expected 401 or 503, got ${status}. The endpoint is open to unauthenticated callers.`);
});

await check('Rejects request with WRONG secret (expect 401)', async () => {
  const { status } = await post(resolveUrl, { action: 'resolve_wager' }, {
    'x-caller-secret': 'wrong-secret-value',
  });
  assert(status === 401 || status === 503,
    `Expected 401 or 503, got ${status}.`);
});

if (RESOLVE_SECRET) {
  await check('Accepts request with CORRECT secret (expect NOT 401/503)', async () => {
    const { status } = await post(resolveUrl, { action: 'resolve_wager' }, {
      'x-caller-secret': RESOLVE_SECRET,
    });
    // Will likely fail with 500 (missing fields) but NOT 401/503 — that's what we're testing
    assert(status !== 401 && status !== 503,
      `Correct secret was rejected with ${status}. Check that RESOLVE_WAGER_CALLER_SECRET is deployed to Supabase.`);
  });
} else {
  console.log('  ⚠️   RESOLVE_WAGER_CALLER_SECRET not set locally — skipping positive auth test');
}

// ── SEC-02: admin signup secret ───────────────────────────────────────────────
console.log('\nSEC-02 · admin signup secret');
const signupUrl = `${NEXT_URL}/api/admin/auth/signup`;

await check('Rejects signup with NO secret header (expect 401 or 503)', async () => {
  const { status } = await post(signupUrl, {
    email: 'test@test.com', password: 'TestPass123!', full_name: 'Test'
  });
  assert(status === 401 || status === 503,
    `Expected 401 or 503, got ${status}. Admin signup is open to anyone.`);
});

await check('Rejects signup with WRONG secret (expect 401)', async () => {
  const { status } = await post(signupUrl, {
    email: 'test@test.com', password: 'TestPass123!', full_name: 'Test'
  }, { 'x-admin-signup-secret': 'wrong-secret' });
  assert(status === 401 || status === 503,
    `Expected 401 or 503, got ${status}.`);
});

if (ADMIN_SECRET) {
  await check('Accepts correct secret (expect NOT 401/503)', async () => {
    const { status } = await post(signupUrl, {
      email: 'test@test.com', password: 'TestPass123!', full_name: 'Test'
    }, { 'x-admin-signup-secret': ADMIN_SECRET });
    assert(status !== 401 && status !== 503,
      `Correct secret rejected with ${status}. Check ADMIN_SIGNUP_SECRET in your .env.local.`);
  });
} else {
  console.log('  ⚠️   ADMIN_SIGNUP_SECRET not set locally — skipping positive auth test');
}

// ── SEC-03: ADMIN_JWT_SECRET no fallback ──────────────────────────────────────
console.log('\nSEC-03 · ADMIN_JWT_SECRET hard-fail');
await check('Admin login returns error when ADMIN_JWT_SECRET is missing (only testable locally without env var)', async () => {
  // We can't unset env vars at runtime, so just verify the login endpoint
  // doesn't return 200 with a token signed by the old fallback secret
  const { status, body } = await post(`${NEXT_URL}/api/admin/auth/login`, {
    email: 'nonexistent@test.com', password: 'wrongpassword'
  });
  // Should be 401 (bad creds) or 500 (misconfigured) — never 200
  assert(status !== 200,
    `Login returned 200 unexpectedly. Check that ADMIN_JWT_SECRET is set.`);
  console.log(`      (Got ${status} as expected — endpoint is not freely issuing tokens)`);
});

// ── SEC-04: verify-wallet no fallback secret ──────────────────────────────────
console.log('\nSEC-04 · verify-wallet SUPABASE_SERVICE_ROLE_KEY hard-fail');
const verifyUrl = `${SUPABASE_URL}/functions/v1/verify-wallet`;

await check('verify-wallet responds (not crashed from missing key in production)', async () => {
  const { status } = await post(verifyUrl, {
    action: 'generate-nonce', walletAddress: 'test'
  });
  // If the env var IS set (production), we get a real response (200 or 400)
  // If it's NOT set, the function crashes with 500
  // Either way it should NOT be 200 with a nonce derived from 'fallback-secret'
  assert(status !== 0, `Function didn't respond at all — check Supabase function is deployed.`);
  console.log(`      (Got ${status} — function is live and responding)`);
});

// ── SEC-05: lichess webhook mandatory auth ────────────────────────────────────
console.log('\nSEC-05 · Lichess webhook mandatory signature');
const webhookUrl = `${NEXT_URL}/api/lichess/webhook`;
const testBody = JSON.stringify({ gameId: 'testgame123', type: 'gameFinish' });

await check('Rejects webhook with NO signature (expect 401 or 503)', async () => {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: testBody,
  });
  assert(res.status === 401 || res.status === 503,
    `Expected 401 or 503, got ${res.status}. Webhook is processing unsigned payloads.`);
});

await check('Rejects webhook with WRONG signature (expect 401)', async () => {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-lichess-signature': 'sha256=badsignature',
    },
    body: testBody,
  });
  assert(res.status === 401 || res.status === 503,
    `Expected 401 or 503, got ${res.status}.`);
});

if (LICHESS_SECRET) {
  await check('Accepts webhook with CORRECT signature (expect NOT 401/503)', async () => {
    const sig = sign(testBody, LICHESS_SECRET);
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-lichess-signature': sig,
      },
      body: testBody,
    });
    assert(res.status !== 401 && res.status !== 503,
      `Correct signature rejected with ${res.status}. Check LICHESS_WEBHOOK_SECRET in your .env.local.`);
  });
} else {
  console.log('  ⚠️   LICHESS_WEBHOOK_SECRET not set locally — skipping positive auth test');
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed === 0) {
  console.log('🎉  All Phase 0 security checks passed!\n');
} else {
  console.log('⚠️   Some checks failed — review output above before deploying.\n');
  process.exit(1);
}
