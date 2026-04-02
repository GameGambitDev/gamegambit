// supabase/functions/moderation-timeout/index.ts
//
// Called by pg_cron every 30 seconds. Handles two timeout cases:
//
//   A. PENDING requests past their `deadline`
//      → status = 'timed_out' → re-assign via assign-moderator
//
//   B. ACCEPTED requests past their `decision_deadline` (moderator accepted but didn't decide)
//      → status = 'timed_out' → increment that player's skip count → re-assign
//
// For each timed-out request, assign-moderator is fired fire-and-forget (same
// pattern as submitVote in secure-wager/actions.ts). Already-tried wallets are
// excluded automatically by assign-moderator's exclusion set logic.
//
// CPU efficiency: skip count updates run concurrently with Promise.all — no
// sequential awaits in loops that would block the function unnecessarily.
//
// Self-contained. Uses Deno.serve.
//
// ── pg_cron setup (run ONCE in Supabase SQL editor) ──────────────────────────
//
//   select cron.schedule(
//     'moderation-timeout',
//     '* * * * *',
//     $$
//       select net.http_post(
//         url        := current_setting('app.supabase_url') || '/functions/v1/moderation-timeout',
//         headers    := jsonb_build_object(
//                         'Content-Type',  'application/json',
//                         'Authorization', 'Bearer ' || current_setting('app.service_role_key')
//                       ),
//         body       := '{}'::jsonb
//       )
//     $$
//   );
//
// The 30s popup window is enforced by the `deadline` column, not the cron
// frequency. Running every minute is safe — the queries filter by deadline.
//
// If pg_cron isn't available, you can also call this from an external scheduler
// (GitHub Actions, cron job on a server, etc.) using the edge function URL.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const now = new Date().toISOString();
        const timedOutWagerIds: string[] = [];

        // ── A. Pending requests past accept deadline ───────────────────────────
        const { data: expiredPending, error: pendingErr } = await supabase
            .from("moderation_requests")
            .select("id, wager_id, moderator_wallet")
            .eq("status", "pending")
            .lt("deadline", now);

        if (pendingErr) {
            console.error("[moderation-timeout] pending query error:", pendingErr.message);
        }

        if (expiredPending && expiredPending.length > 0) {
            const ids = expiredPending.map((r: { id: string }) => r.id);
            await supabase
                .from("moderation_requests")
                .update({ status: "timed_out" })
                .in("id", ids);

            for (const r of expiredPending as { id: string; wager_id: string }[]) {
                console.log(`[moderation-timeout] Timed out pending request ${r.id} (wager ${r.wager_id})`);
                timedOutWagerIds.push(r.wager_id);
            }
        }

        // ── B. Accepted requests past decision deadline ────────────────────────
        const { data: expiredAccepted, error: acceptedErr } = await supabase
            .from("moderation_requests")
            .select("id, wager_id, moderator_wallet")
            .eq("status", "accepted")
            .not("decision_deadline", "is", null)
            .lt("decision_deadline", now);

        if (acceptedErr) {
            console.error("[moderation-timeout] accepted query error:", acceptedErr.message);
        }

        if (expiredAccepted && expiredAccepted.length > 0) {
            const ids = expiredAccepted.map((r: { id: string }) => r.id);

            // Batch status update first
            await supabase
                .from("moderation_requests")
                .update({ status: "timed_out" })
                .in("id", ids);

            // Penalise all expired-accepted moderators concurrently — no sequential awaits
            await Promise.all(
                (expiredAccepted as { id: string; wager_id: string; moderator_wallet: string }[]).map(
                    async (r) => {
                        console.log(`[moderation-timeout] Timed out accepted (no verdict) ${r.id} (wager ${r.wager_id})`);
                        timedOutWagerIds.push(r.wager_id);

                        // Atomically increment skip count via RPC — avoids race
                        // condition when cron fires twice in quick succession.
                        try {
                            await supabase.rpc("increment_moderation_skip_count", {
                                p_wallet: r.moderator_wallet,
                            });
                        } catch (e) {
                            console.warn(`[moderation-timeout] skip count update failed for ${r.moderator_wallet}:`, e);
                        }

                        // Log behaviour — non-critical, fire-and-forget
                        supabase.from("player_behaviour_log").insert({
                            player_wallet: r.moderator_wallet,
                            event_type: "moderation_no_verdict",
                            related_id: r.wager_id,
                            notes: "Accepted moderation request but did not submit verdict before decision deadline",
                        }).catch(() => { /* non-critical */ });
                    }
                )
            );
        }

        // ── C. Re-assign for each uniquely timed-out wager ────────────────────
        // Deduplicate — multiple timed-out requests could belong to the same wager
        const uniqueWagerIds = [...new Set(timedOutWagerIds)];
        const assignResults: Record<string, unknown> = {};

        // Check wager statuses concurrently before firing assign-moderator calls
        await Promise.all(
            uniqueWagerIds.map(async (wagerId) => {
                // Skip if wager is already resolved or cancelled
                const { data: wager } = await supabase
                    .from("wagers")
                    .select("status")
                    .eq("id", wagerId)
                    .single();

                if (!wager || ["resolved", "cancelled"].includes(wager.status)) {
                    console.log(`[moderation-timeout] Wager ${wagerId} already ${wager?.status ?? "gone"} — skipping`);
                    assignResults[wagerId] = { skipped: true, reason: wager?.status ?? "not_found" };
                    return;
                }

                // Skip if there's already a fresh pending/accepted request for this wager
                const { data: activeRequest } = await supabase
                    .from("moderation_requests")
                    .select("id")
                    .eq("wager_id", wagerId)
                    .in("status", ["pending", "accepted"])
                    .maybeSingle();

                if (activeRequest) {
                    console.log(`[moderation-timeout] Wager ${wagerId} already has active request — skipping`);
                    assignResults[wagerId] = { skipped: true, reason: "already_active" };
                    return;
                }

                // Fire-and-forget assign-moderator — same pattern as submitVote in actions.ts
                // Does NOT await — this is intentional to avoid CPU limit from chained awaits
                fetch(`${supabaseUrl}/functions/v1/assign-moderator`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${supabaseServiceKey}`,
                    },
                    body: JSON.stringify({ wagerId }),
                }).then(async (res) => {
                    const result = await res.json().catch(() => ({}));
                    console.log(`[moderation-timeout] Re-assign result for ${wagerId}:`, JSON.stringify(result));
                }).catch((err: unknown) => {
                    console.error(
                        `[moderation-timeout] Re-assign call failed for ${wagerId}:`,
                        err instanceof Error ? err.message : String(err),
                    );
                });

                assignResults[wagerId] = { queued: true };
            })
        );

        const summary = {
            ok: true,
            expiredPending: expiredPending?.length ?? 0,
            expiredAccepted: expiredAccepted?.length ?? 0,
            uniqueWagersReassigned: uniqueWagerIds.length,
            results: assignResults,
        };

        console.log("[moderation-timeout] Run complete:", JSON.stringify(summary));
        return respond(summary);

    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[moderation-timeout] Unexpected error:", msg);
        return respond({ error: msg }, 500);
    }
});