// supabase/functions/admin-action/index.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
    PROGRAM_ID_STR,
    PLATFORM_WALLET_STR,
    calculatePlatformFee,
    DISCRIMINATORS,
    getAuthority,
    deriveWagerPDA,
    sendAndConfirm,
    Connection,
    PublicKey,
    TransactionInstruction,
    SystemProgram,
} from "./solana.ts";

const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
};

function getSupabase() {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set");
    return createClient(url, key);
}

async function logAdminAction(
    supabase: ReturnType<typeof getSupabase>,
    action: string,
    wagerId: string | null,
    walletAddress: string | null,
    performedBy: string,
    notes: string | null,
    metadata: Record<string, unknown> = {},
) {
    await supabase.from("admin_logs").insert({
        action, wager_id: wagerId, wallet_address: walletAddress,
        performed_by: performedBy, notes, metadata,
    });
}

async function forceResolve(
    supabase: ReturnType<typeof getSupabase>,
    wagerId: string, winnerWallet: string, adminWallet: string,
    notes: string | null, rpcUrl: string,
) {
    const { data: wager, error } = await supabase.from("wagers").select("*").eq("id", wagerId).single();
    if (error || !wager) throw new Error("Wager not found");

    if (winnerWallet !== wager.player_a_wallet && winnerWallet !== wager.player_b_wallet)
        throw new Error("Winner must be a participant in this wager");

    if (!["voting", "joined", "disputed", "retractable"].includes(wager.status))
        throw new Error(`Cannot resolve wager with status: ${wager.status}`);

    // Atomically claim the wager before touching the chain — prevents double-pay if two admins race
    const { data: updatedWager, error: updateError } = await supabase
        .from("wagers")
        .update({ status: "resolving", winner_wallet: winnerWallet, resolved_at: new Date().toISOString() })
        .eq("id", wagerId)
        .in("status", ["voting", "joined", "disputed", "retractable"])
        .select().single();

    if (updateError || !updatedWager)
        throw new Error("Wager already resolved or status changed — aborting to prevent double-pay");

    const totalPot = wager.stake_lamports * 2;
    const platformFee = calculatePlatformFee(wager.stake_lamports);
    const winnerPayout = totalPot - platformFee;

    // Insert a pending tx record so the admin can track progress immediately
    const { data: pendingTx } = await supabase.from("wager_transactions").insert({
        wager_id: wagerId, wallet_address: winnerWallet,
        tx_type: "winner_payout", status: "pending", amount_lamports: winnerPayout,
    }).select().single();

    await logAdminAction(supabase, "force_resolve_queued", wagerId, winnerWallet, adminWallet, notes, {
        winner: winnerWallet,
    });

    // Fire on-chain work in the background — return 200 immediately
    const onChainWork = (async () => {
        try {
            const authority = getAuthority();
            const wagerPDA = deriveWagerPDA(wager.player_a_wallet, BigInt(wager.match_id));
            const winnerPubkey = new PublicKey(winnerWallet);
            const platformPubkey = new PublicKey(PLATFORM_WALLET_STR);

            const disc = DISCRIMINATORS.resolve_wager;
            const winnerBytes = winnerPubkey.toBytes();
            const instructionData = new Uint8Array(disc.length + winnerBytes.length);
            instructionData.set(disc, 0);
            instructionData.set(winnerBytes, disc.length);

            const ix = new TransactionInstruction({
                programId: new PublicKey(PROGRAM_ID_STR),
                keys: [
                    { pubkey: wagerPDA, isSigner: false, isWritable: true },
                    { pubkey: winnerPubkey, isSigner: false, isWritable: true },
                    { pubkey: authority.publicKey, isSigner: true, isWritable: true },
                    { pubkey: platformPubkey, isSigner: false, isWritable: true },
                    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
                ],
                data: instructionData,
            });

            const sig = await sendAndConfirm(authority, ix, rpcUrl);
            console.log(`[admin-action] forceResolve tx confirmed: ${sig}`);

            await supabase.from("wagers").update({ status: "resolved" }).eq("id", wagerId);
            await supabase.from("wager_transactions").upsert([
                { wager_id: wagerId, wallet_address: winnerWallet, tx_type: "winner_payout", amount_lamports: winnerPayout, tx_signature: sig, status: "confirmed" },
                { wager_id: wagerId, wallet_address: PLATFORM_WALLET_STR, tx_type: "platform_fee", amount_lamports: platformFee, tx_signature: sig, status: "confirmed" },
            ], { onConflict: "tx_signature", ignoreDuplicates: true });
            if (pendingTx?.id) {
                await supabase.from("wager_transactions").update({ status: "confirmed", tx_signature: sig }).eq("id", pendingTx.id);
            }
            await logAdminAction(supabase, "force_resolve", wagerId, winnerWallet, adminWallet, notes, {
                tx_signature: sig, winner: winnerWallet, payout_lamports: winnerPayout,
            });
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`[admin-action] forceResolve on-chain failed: ${msg}`);
            // Roll back so an admin can retry
            await supabase.from("wagers").update({ status: "disputed" }).eq("id", wagerId);
            if (pendingTx?.id) {
                await supabase.from("wager_transactions").update({ status: "failed" }).eq("id", pendingTx.id);
            }
            await logAdminAction(supabase, "force_resolve_failed", wagerId, winnerWallet, adminWallet, msg);
        }
    })();

    // Keep the promise alive after the HTTP response is returned
    // @ts-ignore — EdgeRuntime is available in Supabase edge functions
    if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(onChainWork);

    return {
        success: true,
        queued: true,
        message: "Wager status set to 'resolving'. On-chain transaction running in background — check wager_transactions for confirmation.",
        winnerWallet,
    };
}

async function forceRefund(
    supabase: ReturnType<typeof getSupabase>,
    wagerId: string, adminWallet: string, notes: string | null, rpcUrl: string,
) {
    const { data: wager, error } = await supabase.from("wagers").select("*").eq("id", wagerId).single();
    if (error || !wager) throw new Error("Wager not found");

    if (!["voting", "joined", "disputed", "retractable"].includes(wager.status))
        throw new Error(`Cannot refund wager with status: ${wager.status}`);

    if (!wager.player_b_wallet)
        throw new Error("Cannot refund single-player wager — player B hasn't joined yet");

    // Atomically claim the wager — prevents double-refund
    const { data: updatedWager, error: updateError } = await supabase
        .from("wagers")
        .update({ status: "cancelling", resolved_at: new Date().toISOString() })
        .eq("id", wagerId)
        .in("status", ["voting", "joined", "disputed", "retractable"])
        .select().single();

    if (updateError || !updatedWager)
        throw new Error("Wager already resolved or status changed — aborting to prevent double-refund");

    // Insert pending records for both players immediately
    const { data: pendingTxA } = await supabase.from("wager_transactions").insert({
        wager_id: wagerId, wallet_address: wager.player_a_wallet,
        tx_type: "refund", status: "pending", amount_lamports: wager.stake_lamports,
    }).select().single();
    const { data: pendingTxB } = await supabase.from("wager_transactions").insert({
        wager_id: wagerId, wallet_address: wager.player_b_wallet,
        tx_type: "refund", status: "pending", amount_lamports: wager.stake_lamports,
    }).select().single();

    await logAdminAction(supabase, "force_refund_queued", wagerId, null, adminWallet, notes);

    const onChainWork = (async () => {
        try {
            const authority = getAuthority();
            const wagerPDA = deriveWagerPDA(wager.player_a_wallet, BigInt(wager.match_id));
            const playerAPubkey = new PublicKey(wager.player_a_wallet);
            const playerBPubkey = new PublicKey(wager.player_b_wallet);
            const platformPubkey = new PublicKey(PLATFORM_WALLET_STR);

            const ix = new TransactionInstruction({
                programId: new PublicKey(PROGRAM_ID_STR),
                keys: [
                    { pubkey: wagerPDA, isSigner: false, isWritable: true },
                    { pubkey: playerAPubkey, isSigner: false, isWritable: true },
                    { pubkey: playerBPubkey, isSigner: false, isWritable: true },
                    { pubkey: authority.publicKey, isSigner: true, isWritable: true },
                    { pubkey: platformPubkey, isSigner: false, isWritable: true },
                    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
                ],
                data: new Uint8Array(DISCRIMINATORS.close_wager),
            });

            const sig = await sendAndConfirm(authority, ix, rpcUrl);
            console.log(`[admin-action] forceRefund tx confirmed: ${sig}`);

            await supabase.from("wagers").update({ status: "cancelled" }).eq("id", wagerId);
            await supabase.from("wager_transactions").upsert([
                { wager_id: wagerId, wallet_address: wager.player_a_wallet, tx_type: "refund", amount_lamports: wager.stake_lamports, tx_signature: sig, status: "confirmed" },
                { wager_id: wagerId, wallet_address: wager.player_b_wallet, tx_type: "refund", amount_lamports: wager.stake_lamports, tx_signature: sig, status: "confirmed" },
            ], { onConflict: "tx_signature", ignoreDuplicates: true });
            if (pendingTxA?.id) await supabase.from("wager_transactions").update({ status: "confirmed", tx_signature: sig }).eq("id", pendingTxA.id);
            if (pendingTxB?.id) await supabase.from("wager_transactions").update({ status: "confirmed", tx_signature: sig }).eq("id", pendingTxB.id);
            await logAdminAction(supabase, "force_refund", wagerId, null, adminWallet, notes, {
                tx_signature: sig, refund_lamports: wager.stake_lamports,
            });
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`[admin-action] forceRefund on-chain failed: ${msg}`);
            // Roll back so an admin can retry
            await supabase.from("wagers").update({ status: "disputed" }).eq("id", wagerId);
            if (pendingTxA?.id) await supabase.from("wager_transactions").update({ status: "failed" }).eq("id", pendingTxA.id);
            if (pendingTxB?.id) await supabase.from("wager_transactions").update({ status: "failed" }).eq("id", pendingTxB.id);
            await logAdminAction(supabase, "force_refund_failed", wagerId, null, adminWallet, msg);
        }
    })();

    // @ts-ignore
    if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(onChainWork);

    return {
        success: true,
        queued: true,
        message: "Wager status set to 'cancelling'. Refund transaction running in background — check wager_transactions for confirmation.",
        refundLamports: wager.stake_lamports,
    };
}

async function markDisputed(
    supabase: ReturnType<typeof getSupabase>,
    wagerId: string, adminWallet: string, notes: string | null,
) {
    const { error } = await supabase.from("wagers")
        .update({ status: "disputed", requires_moderator: true }).eq("id", wagerId);
    if (error) throw new Error("Failed to mark as disputed");
    await logAdminAction(supabase, "mark_disputed", wagerId, null, adminWallet, notes);
    return { success: true };
}

async function banPlayer(
    supabase: ReturnType<typeof getSupabase>,
    walletAddress: string, reason: string, adminWallet: string,
) {
    const { error } = await supabase.from("players")
        .update({ is_banned: true, ban_reason: reason }).eq("wallet_address", walletAddress);
    if (error) throw new Error("Failed to ban player");
    await logAdminAction(supabase, "ban_player", null, walletAddress, adminWallet, reason);
    return { success: true };
}

async function unbanPlayer(
    supabase: ReturnType<typeof getSupabase>,
    walletAddress: string, adminWallet: string,
) {
    const { error } = await supabase.from("players")
        .update({ is_banned: false, ban_reason: null }).eq("wallet_address", walletAddress);
    if (error) throw new Error("Failed to unban player");
    await logAdminAction(supabase, "unban_player", null, walletAddress, adminWallet, null);
    return { success: true };
}

async function flagPlayer(
    supabase: ReturnType<typeof getSupabase>,
    walletAddress: string, reason: string, adminWallet: string,
) {
    const { error } = await supabase.from("players").update({
        flagged_for_review: true, flag_reason: reason,
        flagged_at: new Date().toISOString(), flagged_by: adminWallet,
    }).eq("wallet_address", walletAddress);
    if (error) throw new Error("Failed to flag player");
    await logAdminAction(supabase, "flag_player", null, walletAddress, adminWallet, reason);
    return { success: true };
}

async function unflagPlayer(
    supabase: ReturnType<typeof getSupabase>,
    walletAddress: string, adminWallet: string,
) {
    const { error } = await supabase.from("players").update({
        flagged_for_review: false, flag_reason: null, flagged_at: null, flagged_by: null,
    }).eq("wallet_address", walletAddress);
    if (error) throw new Error("Failed to unflag player");
    await logAdminAction(supabase, "unflag_player", null, walletAddress, adminWallet, null);
    return { success: true };
}

async function checkPdaBalance(
    supabase: ReturnType<typeof getSupabase>,
    wagerId: string, adminWallet: string, rpcUrl: string,
) {
    const { data: wager, error } = await supabase.from("wagers")
        .select("player_a_wallet, match_id, stake_lamports").eq("id", wagerId).single();
    if (error || !wager) throw new Error("Wager not found");

    const connection = new Connection(rpcUrl, "confirmed");
    const wagerPDA = deriveWagerPDA(wager.player_a_wallet, BigInt(wager.match_id));
    const balance = await connection.getBalance(wagerPDA);

    await logAdminAction(supabase, "check_pda_balance", wagerId, null, adminWallet, null, {
        pda: wagerPDA.toBase58(), balance_lamports: balance,
    });

    return {
        success: true,
        pda: wagerPDA.toBase58(),
        balanceLamports: balance,
        balanceSol: balance / 1_000_000_000,
        expectedLamports: wager.stake_lamports * 2,
        explorerUrl: `https://explorer.solana.com/address/${wagerPDA.toBase58()}?cluster=devnet`,
    };
}

async function addNote(
    supabase: ReturnType<typeof getSupabase>,
    wagerId: string | null, walletAddress: string | null, note: string, adminWallet: string,
) {
    await supabase.from("admin_notes").insert({
        wager_id: wagerId, player_wallet: walletAddress, note, created_by: adminWallet,
    });
    await logAdminAction(supabase, "add_note", wagerId, walletAddress, adminWallet, note);
    return { success: true };
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

    const respond = (body: unknown, status = 200) =>
        new Response(JSON.stringify(body), {
            status,
            headers: { ...CORS, "Content-Type": "application/json" },
        });

    try {
        const body = await req.json();
        const { action, adminWallet, notes } = body;

        const configuredAdminWallet = Deno.env.get("ADMIN_WALLET");
        if (!configuredAdminWallet)
            return respond({ error: "ADMIN_WALLET is not set in edge function secrets" }, 500);

        if (!adminWallet || adminWallet !== configuredAdminWallet)
            return respond({ error: "Forbidden: wallet does not match ADMIN_WALLET secret" }, 403);

        const rpcUrl = Deno.env.get("SOLANA_RPC_URL") || "https://api.devnet.solana.com";
        const supabase = getSupabase();
        let result: unknown;

        switch (action) {
            case "forceResolve":
                result = await forceResolve(supabase, body.wagerId, body.winnerWallet, adminWallet, notes ?? null, rpcUrl);
                break;
            case "forceRefund":
                result = await forceRefund(supabase, body.wagerId, adminWallet, notes ?? null, rpcUrl);
                break;
            case "markDisputed":
                result = await markDisputed(supabase, body.wagerId, adminWallet, notes ?? null);
                break;
            case "banPlayer":
                result = await banPlayer(supabase, body.playerWallet, body.reason, adminWallet);
                break;
            case "unbanPlayer":
                result = await unbanPlayer(supabase, body.playerWallet, adminWallet);
                break;
            case "flagPlayer":
                result = await flagPlayer(supabase, body.playerWallet, body.reason, adminWallet);
                break;
            case "unflagPlayer":
                result = await unflagPlayer(supabase, body.playerWallet, adminWallet);
                break;
            case "checkPdaBalance":
                result = await checkPdaBalance(supabase, body.wagerId, adminWallet, rpcUrl);
                break;
            case "addNote":
                result = await addNote(supabase, body.wagerId ?? null, body.playerWallet ?? null, body.note, adminWallet);
                break;
            default:
                return respond({ error: `Unknown action: ${action}` }, 400);
        }

        return respond(result);

    } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error("[admin-action] Error:", message);
        return respond({ error: message }, 500);
    }
});