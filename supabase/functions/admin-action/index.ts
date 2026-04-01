// supabase/functions/admin-action/index.ts
//
// FIX 1: Lazy Solana import (getSolana()) — mirrors secure-wager/solana.ts.
//         Eager top-level imports of @solana/web3.js@1.98.0 parse + execute the
//         entire 2 MB SDK during Deno cold-start, exhausting the worker memory
//         budget before the first request arrives (WORKER_LIMIT error).
//
// FIX 2: HTTP-polling confirmation — replaces sendAndConfirmTransaction() and
//         connection.confirmTransaction(), both of which open a WebSocket that
//         continuously drains Deno CPU budget, reliably hitting the ~2 s limit.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
};

const PROGRAM_ID_STR = "E2Vd3U91kMrgwp8JCXcLSn7bt3NowDmGwoBYsVRhGfMR";
const PLATFORM_WALLET_STR = "3hwPwugeuZ33HWJ3SoJkDN2JT3Be9fH62r19ezFiCgYY";

const DISCRIMINATORS = {
    resolve_wager: new Uint8Array([31, 179, 1, 228, 83, 224, 1, 123]),
    close_wager: new Uint8Array([167, 240, 85, 147, 127, 50, 69, 203]),
};

// ── Lazy Solana import ────────────────────────────────────────────────────────
// The SDK is only loaded when a Solana action is actually needed.
// This keeps cold-start memory well under the worker limit.

// deno-lint-ignore no-explicit-any
let _solana: any = null;
async function getSolana() {
    if (!_solana) {
        _solana = await import("https://esm.sh/@solana/web3.js@1.98.0");
    }
    return _solana;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getSupabase() {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set in edge function secrets");
    return createClient(url, key);
}

async function getAuthority() {
    const { Keypair } = await getSolana();
    const raw = Deno.env.get("AUTHORITY_WALLET_SECRET");
    if (!raw) throw new Error("AUTHORITY_WALLET_SECRET is not set in edge function secrets");
    let bytes: number[];
    try {
        bytes = JSON.parse(raw);
    } catch {
        throw new Error("AUTHORITY_WALLET_SECRET is not valid JSON — expected a JSON array of numbers");
    }
    return Keypair.fromSecretKey(new Uint8Array(bytes));
}

async function deriveWagerPDA(playerAWallet: string, matchId: bigint) {
    const { PublicKey } = await getSolana();
    const matchIdBytes = new Uint8Array(8);
    new DataView(matchIdBytes.buffer).setBigUint64(0, matchId, true);
    const [pda] = PublicKey.findProgramAddressSync(
        [new TextEncoder().encode("wager"), new PublicKey(playerAWallet).toBytes(), matchIdBytes],
        new PublicKey(PROGRAM_ID_STR),
    );
    return pda;
}

// ── HTTP-polling confirmation ─────────────────────────────────────────────────
// Does NOT use sendAndConfirmTransaction() or connection.confirmTransaction().
// Both open WebSocket subscriptions that drain Deno CPU budget continuously.
// Plain fetch() polls getSignatureStatuses instead — zero WebSocket usage.

// deno-lint-ignore no-explicit-any
async function sendAndConfirm(authority: any, instruction: any, rpcUrl: string): Promise<string> {
    const { Connection, Transaction } = await getSolana();
    const connection = new Connection(rpcUrl, "confirmed");
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");

    const tx = new Transaction();
    tx.add(instruction);
    tx.recentBlockhash = blockhash;
    tx.feePayer = authority.publicKey;
    tx.sign(authority);

    const signature = await connection.sendRawTransaction(tx.serialize(), {
        skipPreflight: false,
        preflightCommitment: "confirmed",
    });

    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 2000));

        const res = await fetch(rpcUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                jsonrpc: "2.0",
                id: 1,
                method: "getSignatureStatuses",
                params: [[signature], { searchTransactionHistory: false }],
            }),
        });

        const json = await res.json();
        const status = json?.result?.value?.[0];

        if (status) {
            if (status.err) throw new Error(`Transaction failed on-chain: ${JSON.stringify(status.err)}`);
            if (status.confirmationStatus === "confirmed" || status.confirmationStatus === "finalized") {
                return signature;
            }
        }

        const blockHeight = await connection.getBlockHeight("confirmed");
        if (blockHeight > lastValidBlockHeight) {
            throw new Error("Transaction expired — blockhash no longer valid");
        }
    }

    throw new Error("Transaction confirmation timed out after 30 s");
}

// ── Admin audit log ────────────────────────────────────────────────────────────

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
        action,
        wager_id: wagerId,
        wallet_address: walletAddress,
        performed_by: performedBy,
        notes,
        metadata,
    });
}

// ── Actions ────────────────────────────────────────────────────────────────────

async function forceResolve(
    supabase: ReturnType<typeof getSupabase>,
    wagerId: string,
    winnerWallet: string,
    adminWallet: string,
    notes: string | null,
    rpcUrl: string,
) {
    const { data: wager, error } = await supabase
        .from("wagers")
        .select("*")
        .eq("id", wagerId)
        .single();

    if (error || !wager) throw new Error("Wager not found");

    if (winnerWallet !== wager.player_a_wallet && winnerWallet !== wager.player_b_wallet) {
        throw new Error("Winner must be a participant in this wager");
    }

    if (!["voting", "joined", "disputed", "retractable"].includes(wager.status)) {
        throw new Error(`Cannot resolve wager with status: ${wager.status}`);
    }

    const { data: updatedWager, error: updateError } = await supabase
        .from("wagers")
        .update({
            status: "resolved",
            winner_wallet: winnerWallet,
            resolved_at: new Date().toISOString(),
        })
        .eq("id", wagerId)
        .in("status", ["voting", "joined", "disputed", "retractable"])
        .select()
        .single();

    if (updateError || !updatedWager) {
        throw new Error("Wager already resolved or status changed — aborting to prevent double-pay");
    }

    // Solana SDK loaded lazily here — not at module boot
    const { PublicKey, TransactionInstruction, SystemProgram } = await getSolana();
    const authority = await getAuthority();
    const wagerPDA = await deriveWagerPDA(wager.player_a_wallet, BigInt(wager.match_id));
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
    console.log(`[admin-action] forceResolve tx: ${sig}`);

    const totalPot = wager.stake_lamports * 2;
    const platformFee = Math.floor(totalPot * 0.1);
    const winnerPayout = totalPot - platformFee;

    await supabase.from("wager_transactions").upsert([
        { wager_id: wagerId, wallet_address: winnerWallet, tx_type: "winner_payout", amount_lamports: winnerPayout, tx_signature: sig, status: "confirmed" },
        { wager_id: wagerId, wallet_address: PLATFORM_WALLET_STR, tx_type: "platform_fee", amount_lamports: platformFee, tx_signature: sig, status: "confirmed" },
    ], { onConflict: "tx_signature", ignoreDuplicates: true });

    await logAdminAction(supabase, "force_resolve", wagerId, winnerWallet, adminWallet, notes, {
        tx_signature: sig,
        winner: winnerWallet,
        payout_lamports: winnerPayout,
    });

    return {
        success: true,
        txSignature: sig,
        explorerUrl: `https://explorer.solana.com/tx/${sig}?cluster=devnet`,
        winnerWallet,
        payoutLamports: winnerPayout,
    };
}

async function forceRefund(
    supabase: ReturnType<typeof getSupabase>,
    wagerId: string,
    adminWallet: string,
    notes: string | null,
    rpcUrl: string,
) {
    const { data: wager, error } = await supabase
        .from("wagers")
        .select("*")
        .eq("id", wagerId)
        .single();

    if (error || !wager) throw new Error("Wager not found");

    if (!["voting", "joined", "disputed", "retractable"].includes(wager.status)) {
        throw new Error(`Cannot refund wager with status: ${wager.status}`);
    }

    if (!wager.player_b_wallet) {
        throw new Error("Cannot refund single-player wager — player B hasn't joined yet");
    }

    const { data: updatedWager, error: updateError } = await supabase
        .from("wagers")
        .update({
            status: "cancelled",
            cancelled_at: new Date().toISOString(),
            cancel_reason: "admin_force_refund",
        })
        .eq("id", wagerId)
        .in("status", ["voting", "joined", "disputed", "retractable"])
        .select()
        .single();

    if (updateError || !updatedWager) {
        throw new Error("Wager already cancelled or status changed — aborting to prevent double-refund");
    }

    // Solana SDK loaded lazily here — not at module boot
    const { Connection, PublicKey, TransactionInstruction, SystemProgram } = await getSolana();
    const authority = await getAuthority();
    const connection = new Connection(rpcUrl, "confirmed");
    const wagerPDA = await deriveWagerPDA(wager.player_a_wallet, BigInt(wager.match_id));

    const pdaBalance = await connection.getBalance(wagerPDA);
    if (pdaBalance === 0) throw new Error("PDA is empty — funds may have already been distributed");

    const playerAPubkey = new PublicKey(wager.player_a_wallet);
    const playerBPubkey = new PublicKey(wager.player_b_wallet);

    const ix = new TransactionInstruction({
        programId: new PublicKey(PROGRAM_ID_STR),
        keys: [
            { pubkey: wagerPDA, isSigner: false, isWritable: true },
            { pubkey: playerAPubkey, isSigner: false, isWritable: true },
            { pubkey: playerBPubkey, isSigner: false, isWritable: true },
            { pubkey: authority.publicKey, isSigner: true, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: DISCRIMINATORS.close_wager,
    });

    const sig = await sendAndConfirm(authority, ix, rpcUrl);
    console.log(`[admin-action] forceRefund tx: ${sig}`);

    await supabase.from("wager_transactions").upsert([
        { wager_id: wagerId, wallet_address: wager.player_a_wallet, tx_type: "cancel_refund", amount_lamports: wager.stake_lamports, tx_signature: sig, status: "confirmed" },
        { wager_id: wagerId, wallet_address: wager.player_b_wallet, tx_type: "cancel_refund", amount_lamports: wager.stake_lamports, tx_signature: sig, status: "confirmed" },
    ], { onConflict: "tx_signature", ignoreDuplicates: true });

    await logAdminAction(supabase, "force_refund", wagerId, null, adminWallet, notes, {
        tx_signature: sig,
        refund_lamports: wager.stake_lamports,
    });

    return {
        success: true,
        txSignature: sig,
        explorerUrl: `https://explorer.solana.com/tx/${sig}?cluster=devnet`,
        refundLamports: wager.stake_lamports,
    };
}

async function markDisputed(
    supabase: ReturnType<typeof getSupabase>,
    wagerId: string,
    adminWallet: string,
    notes: string | null,
) {
    const { error } = await supabase
        .from("wagers")
        .update({ status: "disputed", requires_moderator: true })
        .eq("id", wagerId);

    if (error) throw new Error("Failed to mark as disputed");

    await logAdminAction(supabase, "mark_disputed", wagerId, null, adminWallet, notes);
    return { success: true };
}

async function banPlayer(
    supabase: ReturnType<typeof getSupabase>,
    walletAddress: string,
    reason: string,
    adminWallet: string,
) {
    const { error } = await supabase
        .from("players")
        .update({ is_banned: true, ban_reason: reason })
        .eq("wallet_address", walletAddress);

    if (error) throw new Error("Failed to ban player");

    await logAdminAction(supabase, "ban_player", null, walletAddress, adminWallet, reason);
    return { success: true };
}

async function unbanPlayer(
    supabase: ReturnType<typeof getSupabase>,
    walletAddress: string,
    adminWallet: string,
) {
    const { error } = await supabase
        .from("players")
        .update({ is_banned: false, ban_reason: null })
        .eq("wallet_address", walletAddress);

    if (error) throw new Error("Failed to unban player");

    await logAdminAction(supabase, "unban_player", null, walletAddress, adminWallet, null);
    return { success: true };
}

async function flagPlayer(
    supabase: ReturnType<typeof getSupabase>,
    walletAddress: string,
    reason: string,
    adminWallet: string,
) {
    const { error } = await supabase
        .from("players")
        .update({
            flagged_for_review: true,
            flag_reason: reason,
            flagged_at: new Date().toISOString(),
            flagged_by: adminWallet,
        })
        .eq("wallet_address", walletAddress);

    if (error) throw new Error("Failed to flag player");

    await logAdminAction(supabase, "flag_player", null, walletAddress, adminWallet, reason);
    return { success: true };
}

async function unflagPlayer(
    supabase: ReturnType<typeof getSupabase>,
    walletAddress: string,
    adminWallet: string,
) {
    const { error } = await supabase
        .from("players")
        .update({
            flagged_for_review: false,
            flag_reason: null,
            flagged_at: null,
            flagged_by: null,
        })
        .eq("wallet_address", walletAddress);

    if (error) throw new Error("Failed to unflag player");

    await logAdminAction(supabase, "unflag_player", null, walletAddress, adminWallet, null);
    return { success: true };
}

async function checkPdaBalance(
    supabase: ReturnType<typeof getSupabase>,
    wagerId: string,
    adminWallet: string,
    rpcUrl: string,
) {
    const { data: wager, error } = await supabase
        .from("wagers")
        .select("player_a_wallet, match_id, stake_lamports")
        .eq("id", wagerId)
        .single();

    if (error || !wager) throw new Error("Wager not found");

    // Solana SDK loaded lazily — only when this action is called
    const { Connection } = await getSolana();
    const connection = new Connection(rpcUrl, "confirmed");
    const wagerPDA = await deriveWagerPDA(wager.player_a_wallet, BigInt(wager.match_id));
    const balance = await connection.getBalance(wagerPDA);

    await logAdminAction(supabase, "check_pda_balance", wagerId, null, adminWallet, null, {
        pda: wagerPDA.toBase58(),
        balance_lamports: balance,
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
    wagerId: string | null,
    walletAddress: string | null,
    note: string,
    adminWallet: string,
) {
    await supabase.from("admin_notes").insert({
        wager_id: wagerId,
        player_wallet: walletAddress,
        note,
        created_by: adminWallet,
    });

    await logAdminAction(supabase, "add_note", wagerId, walletAddress, adminWallet, note);
    return { success: true };
}

// ── Main Handler ───────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: CORS });
    }

    const respond = (body: unknown, status = 200) =>
        new Response(JSON.stringify(body), {
            status,
            headers: { ...CORS, "Content-Type": "application/json" },
        });

    try {
        const body = await req.json();
        const { action, adminWallet, notes } = body;

        const configuredAdminWallet = Deno.env.get("ADMIN_WALLET");
        if (!configuredAdminWallet) {
            return respond({ error: "ADMIN_WALLET is not set in edge function secrets" }, 500);
        }

        if (!adminWallet || adminWallet !== configuredAdminWallet) {
            return respond({ error: "Forbidden: wallet does not match ADMIN_WALLET secret" }, 403);
        }

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