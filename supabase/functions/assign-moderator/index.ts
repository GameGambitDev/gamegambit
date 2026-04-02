// supabase/functions/assign-moderator/index.ts
//
// Called fire-and-forget from secure-wager/actions.ts (handleSubmitVote)
// when a dispute is created, and by moderation-timeout when retrying.
//
// Logic:
//   1. Load the disputed wager
//   2. Find eligible moderator — moderation_requests_enabled=true, not a
//      participant, not suspended, not already tried on this wager.
//      Ordered by moderation_skipped_count ASC so willing players get priority.
//   3. Insert moderation_requests row (status='pending', deadline=now+30s)
//   4. Send in-app notification to the selected moderator
//
// Self-contained: all helpers inlined. No cross-function relative imports
// (Supabase does not support them between separate function directories).
// Uses Deno.serve (same as secure-wager — the modern pattern).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Seconds the moderator popup stays open before auto-declining
const POPUP_SECONDS = 30;

// ── Notification helper ───────────────────────────────────────────────────────
// Inlined here because Supabase does not allow relative imports across
// separate function directories. Keep in sync with secure-wager/notifications.ts.

async function insertNotification(
    supabase: ReturnType<typeof createClient>,
    item: {
        player_wallet: string;
        type: string;
        title: string;
        message: string;
        wager_id: string;
    },
): Promise<void> {
    try {
        const { error } = await supabase.from("notifications").insert(item);
        if (error) console.warn("[assign-moderator] notification insert error:", error.message);
    } catch (e) {
        console.warn("[assign-moderator] notification insert threw:", e);
    }
}

// ── Main ──────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { status: 200, headers: corsHeaders });
    }

    const respond = (body: unknown, status = 200): Response =>
        new Response(JSON.stringify(body), {
            status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    try {
        const supabase = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );

        const body = await req.json();
        const wagerId = body?.wagerId as string | undefined;
        if (!wagerId) return respond({ error: "wagerId is required" }, 400);

        console.log(`[assign-moderator] Processing wager: ${wagerId}`);

        // ── 1. Load wager ──────────────────────────────────────────────────────
        const { data: wager, error: wagerErr } = await supabase
            .from("wagers")
            .select("id, game, stake_lamports, player_a_wallet, player_b_wallet, status")
            .eq("id", wagerId)
            .single();

        if (wagerErr || !wager) {
            console.warn(`[assign-moderator] Wager ${wagerId} not found`);
            return respond({ error: "Wager not found" }, 404);
        }

        if (wager.status !== "disputed") {
            console.log(`[assign-moderator] Wager ${wagerId} not assignable — status: ${wager.status}`);
            return respond({ ok: false, reason: `Wager not in assignable state: ${wager.status}` });
        }

        // ── 2. Build exclusion set (participants + already-tried wallets) ──────
        const { data: existingRequests } = await supabase
            .from("moderation_requests")
            .select("moderator_wallet")
            .eq("wager_id", wagerId);

        const excluded = new Set<string>(
            (existingRequests ?? []).map((r: { moderator_wallet: string }) => r.moderator_wallet),
        );
        excluded.add(wager.player_a_wallet);
        if (wager.player_b_wallet) excluded.add(wager.player_b_wallet);

        // ── 3. Find eligible moderator ─────────────────────────────────────────
        // Fetch a pool and filter in-process. Avoids complex SQL.
        // Ordered by moderation_skipped_count ASC: willing players go first.
        const { data: candidates, error: candidatesErr } = await supabase
            .from("players")
            .select("wallet_address, moderation_skipped_count")
            .eq("moderation_requests_enabled", true)
            .eq("is_suspended", false)
            .order("moderation_skipped_count", { ascending: true, nullsFirst: false })
            .limit(100);

        if (candidatesErr) {
            console.error("[assign-moderator] candidates query error:", candidatesErr.message);
            return respond({ error: "Failed to query candidates" }, 500);
        }

        if (!candidates || candidates.length === 0) {
            console.warn(`[assign-moderator] No candidates at all for wager ${wagerId}`);
            return respond({ ok: false, reason: "No eligible moderators available" });
        }

        const eligible = (candidates as { wallet_address: string }[])
            .filter((c) => !excluded.has(c.wallet_address));

        if (eligible.length === 0) {
            console.warn(`[assign-moderator] All candidates exhausted for wager ${wagerId}`);
            return respond({ ok: false, reason: "All candidates already tried" });
        }

        const moderatorWallet = eligible[0].wallet_address;

        // ── 4. Insert moderation_requests row ─────────────────────────────────
        const now = new Date();
        const deadline = new Date(now.getTime() + POPUP_SECONDS * 1000).toISOString();

        const { data: requestRow, error: insertErr } = await supabase
            .from("moderation_requests")
            .insert({
                wager_id: wagerId,
                moderator_wallet: moderatorWallet,
                status: "pending",
                request_type: "dispute",
                deadline,
                assigned_at: now.toISOString(),
            })
            .select("id")
            .single();

        if (insertErr || !requestRow) {
            console.error("[assign-moderator] insert error:", insertErr?.message);
            return respond({ error: "Failed to create moderation request" }, 500);
        }

        // ── 5. Notify the moderator ────────────────────────────────────────────
        const potSOL = ((wager.stake_lamports * 2) / 1e9).toFixed(3);
        await insertNotification(supabase, {
            player_wallet: moderatorWallet,
            type: "moderation_request",
            title: "Moderation Request",
            message: `You've been selected to moderate a ${wager.game.toUpperCase()} dispute (${potSOL} SOL pot). Open the app — you have ${POPUP_SECONDS}s to accept.`,
            wager_id: wagerId,
        });

        console.log(`[assign-moderator] Assigned ${moderatorWallet} → wager ${wagerId}, deadline: ${deadline}`);
        return respond({ ok: true, moderatorWallet, requestId: requestRow.id, deadline });

    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[assign-moderator] Unexpected error:", msg);
        return respond({ error: msg }, 500);
    }
});