// supabase/functions/process-verdict/index.ts
//
// Called by the verdict API route after a moderator submits their decision.
// Handles on-chain resolution directly using the same Solana helpers as
// secure-wager/solana.ts (inlined here — no cross-function imports).
//
// Flow:
//   1. Load wager + validate it isn't already resolved
//   2. Resolve on-chain: resolve_wager (winner) | close_wager (draw) | skip (cannot_determine)
//   3. Update wager status + log wager_transactions
//   4. Update winner/loser stats
//   5. Apply punishment tiers to the loser (dispute_loss offence)
//   6. Notify both players + moderator
//
// Verdict values accepted:
//   <wallet address>    → that wallet wins
//   "draw"              → refund both players
//   "cannot_determine"  → escalate to admin, no on-chain action
//
// Self-contained: Solana + notification helpers inlined.
// Uses AUTHORITY_WALLET_SECRET (same as secure-wager/solana.ts).
// Uses Deno.serve (same as secure-wager).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ── Constants (must match lib.rs + secure-wager/solana.ts) ───────────────────

const PROGRAM_ID = "E2Vd3U91kMrgwp8JCXcLSn7bt3NowDmGwoBYsVRhGfMR";
const PLATFORM_WALLET = "3hwPwugeuZ33HWJ3SoJkDN2JT3Be9fH62r19ezFiCgYY";

// ── Fee helpers (must match calculate_platform_fee() in lib.rs) ───────────────
const MICRO_THRESHOLD = 500_000_000;    // 0.5 SOL in lamports
const WHALE_THRESHOLD = 5_000_000_000;  // 5.0 SOL in lamports
const MODERATOR_FEE_SHARE = 0.30;
const MOD_FEE_CAP_USD = 10;

function calculatePlatformFee(stakeLamports: number): number {
  let bps: number;
  if (stakeLamports < MICRO_THRESHOLD)       bps = 1000;
  else if (stakeLamports <= WHALE_THRESHOLD) bps = 700;
  else                                        bps = 500;
  return Math.floor((stakeLamports * 2 * bps) / 10_000);
}

async function getSolPriceUsd(): Promise<number> {
  try {
    const r = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd'
    );
    const d = await r.json();
    return d.solana.usd as number;
  } catch {
    return 150;
  }
}

function calculateModFee(platformFeeLamports: number, solPriceUsd: number): number {
  const feeUsd = (platformFeeLamports / 1_000_000_000) * solPriceUsd;
  const modUsd = Math.min(feeUsd * MODERATOR_FEE_SHARE, MOD_FEE_CAP_USD);
  return Math.floor((modUsd / solPriceUsd) * 1_000_000_000);
}

const DISCRIMINATORS = {
    resolve_wager: [31, 179, 1, 228, 83, 224, 1, 123],
    close_wager: [167, 240, 85, 147, 127, 50, 69, 203],
};

// ── Solana helpers (inlined from secure-wager/solana.ts) ─────────────────────

// Lazy import — avoids loading the large @solana/web3.js bundle unless needed
// and is the same pattern used by secure-wager/solana.ts.
let _solana: typeof import("https://esm.sh/@solana/web3.js@1.98.0") | null = null;
async function getSolana() {
    if (!_solana) _solana = await import("https://esm.sh/@solana/web3.js@1.98.0");
    return _solana;
}

async function loadAuthorityKeypair() {
    const { Keypair } = await getSolana();
    const secret = Deno.env.get("AUTHORITY_WALLET_SECRET");
    if (!secret) throw new Error("AUTHORITY_WALLET_SECRET not configured");
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secret)));
}

async function deriveWagerPda(playerAWallet: string, matchId: bigint) {
    const { PublicKey } = await getSolana();
    const playerA = new PublicKey(playerAWallet);
    const matchIdBytes = new Uint8Array(8);
    new DataView(matchIdBytes.buffer).setBigUint64(0, matchId, true);
    const [pda] = PublicKey.findProgramAddressSync(
        [new TextEncoder().encode("wager"), playerA.toBytes(), matchIdBytes],
        new PublicKey(PROGRAM_ID),
    );
    return pda;
}

// deno-lint-ignore no-explicit-any
async function sendAndConfirm(connection: any, authority: any, ix: any): Promise<string> {
    const { Transaction } = await getSolana();
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
    const tx = new Transaction();
    tx.add(ix);
    tx.recentBlockhash = blockhash;
    tx.feePayer = authority.publicKey;
    tx.sign(authority);
    const sig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false });
    await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
    return sig;
}

// ── On-chain resolution ───────────────────────────────────────────────────────

async function resolveOnChain(
    supabase: ReturnType<typeof createClient>,
    wager: Record<string, unknown>,
    winnerWallet: string | null,
    resultType: "playerA" | "playerB" | "draw",
    moderatorWallet: string,
): Promise<string | null> {
    try {
        const { Connection, PublicKey, TransactionInstruction, SystemProgram } = await getSolana();
        const rpcUrl = Deno.env.get("SOLANA_RPC_URL") || "https://api.devnet.solana.com";
        const connection = new Connection(rpcUrl, "confirmed");
        const authority = await loadAuthorityKeypair();
        const wagerId = wager.id as string;
        const stake = wager.stake_lamports as number;
        const wagerPda = await deriveWagerPda(
            wager.player_a_wallet as string,
            BigInt(wager.match_id as number),
        );

        let txSig: string;

        if (resultType === "draw") {
            // close_wager — refunds both players
            const playerAPubkey = new PublicKey(wager.player_a_wallet as string);
            const playerBPubkey = new PublicKey(wager.player_b_wallet as string);
            const ix = new TransactionInstruction({
                programId: new PublicKey(PROGRAM_ID),
                keys: [
                    { pubkey: wagerPda, isSigner: false, isWritable: true },
                    { pubkey: playerAPubkey, isSigner: false, isWritable: true },
                    { pubkey: playerBPubkey, isSigner: false, isWritable: true },
                    { pubkey: authority.publicKey, isSigner: true, isWritable: true },
                    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
                ],
                data: new Uint8Array(DISCRIMINATORS.close_wager),
            });
            txSig = await sendAndConfirm(connection, authority, ix);
            console.log(`[process-verdict] close_wager (draw) tx: ${txSig}`);

            await supabase.from("wager_transactions").upsert([
                { wager_id: wagerId, tx_type: "draw_refund", wallet_address: wager.player_a_wallet, amount_lamports: stake, tx_signature: txSig, status: "confirmed" },
                { wager_id: wagerId, tx_type: "draw_refund", wallet_address: wager.player_b_wallet, amount_lamports: stake, tx_signature: txSig, status: "confirmed" },
            ], { onConflict: "tx_signature", ignoreDuplicates: true });

        } else {
            // resolve_wager — winner takes pot minus platform fee
            const totalPot = stake * 2;
            const platformFee = calculatePlatformFee(stake);
            const winnerPayout = totalPot - platformFee;
            const solPrice = await getSolPriceUsd();
            const moderatorCut = calculateModFee(platformFee, solPrice);
            const netPlatformFee = platformFee - moderatorCut;

            const winnerPubkey = new PublicKey(winnerWallet!);
            const platformPubkey = new PublicKey(PLATFORM_WALLET);

            const disc = new Uint8Array(DISCRIMINATORS.resolve_wager);
            const winnerBytes = winnerPubkey.toBytes();
            const ixData = new Uint8Array(disc.length + winnerBytes.length);
            ixData.set(disc, 0);
            ixData.set(winnerBytes, disc.length);

            const ix = new TransactionInstruction({
                programId: new PublicKey(PROGRAM_ID),
                keys: [
                    { pubkey: wagerPda, isSigner: false, isWritable: true },
                    { pubkey: winnerPubkey, isSigner: false, isWritable: true },
                    { pubkey: authority.publicKey, isSigner: true, isWritable: true },
                    { pubkey: platformPubkey, isSigner: false, isWritable: true },
                    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
                ],
                data: ixData,
            });
            txSig = await sendAndConfirm(connection, authority, ix);
            console.log(`[process-verdict] resolve_wager tx: ${txSig}`);

            const loserWallet = winnerWallet === wager.player_a_wallet
                ? wager.player_b_wallet as string
                : wager.player_a_wallet as string;

            await supabase.from("wager_transactions").upsert([
                { wager_id: wagerId, tx_type: "winner_payout", wallet_address: winnerWallet, amount_lamports: winnerPayout, tx_signature: txSig, status: "confirmed" },
                { wager_id: wagerId, tx_type: "platform_fee", wallet_address: PLATFORM_WALLET, amount_lamports: netPlatformFee, tx_signature: txSig, status: "confirmed" },
                { wager_id: wagerId, tx_type: "moderator_fee", wallet_address: moderatorWallet, amount_lamports: moderatorCut, tx_signature: txSig, status: "confirmed" },
            ], { onConflict: "tx_signature", ignoreDuplicates: true });

            // Update player stats
            await supabase.rpc("update_winner_stats", { p_wallet: winnerWallet, p_stake: stake, p_earnings: winnerPayout })
                .then(({ error }: { error: unknown }) => error && console.warn("[process-verdict] winner stats error:", error));
            await supabase.rpc("update_loser_stats", { p_wallet: loserWallet, p_stake: stake })
                .then(({ error }: { error: unknown }) => error && console.warn("[process-verdict] loser stats error:", error));
        }

        return txSig!;
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[process-verdict] resolveOnChain failed:", msg);
        // Log failure for admin visibility but don't blow up the whole function
        try {
            await supabase.from("wager_transactions").insert({
                wager_id: wager.id,
                tx_type: "error_on_chain_resolve",
                wallet_address: wager.player_a_wallet as string,
                amount_lamports: 0,
                status: "failed",
                error_message: msg,
            });
        } catch { /* ignore */ }
        return null;
    }
}

// ── Punishment tiers ──────────────────────────────────────────────────────────

function getPunishment(offenceCount: number): { punishment: string; suspendHours: number | null; indefinite: boolean } {
    if (offenceCount === 1) return { punishment: "warning", suspendHours: null, indefinite: false };
    if (offenceCount === 2) return { punishment: "suspend_24h", suspendHours: 24, indefinite: false };
    if (offenceCount === 3) return { punishment: "suspend_72h", suspendHours: 72, indefinite: false };
    if (offenceCount === 4) return { punishment: "suspend_168h", suspendHours: 168, indefinite: false };
    // Offense 5+ — permanent ban, suspension_ends_at remains null indefinitely
    return { punishment: "ban_indefinite", suspendHours: null, indefinite: true };
}

async function applyPunishment(
    supabase: ReturnType<typeof createClient>,
    loserWallet: string,
    wagerId: string,
    notes: string | null,
): Promise<void> {
    try {
        const { data: existing } = await supabase
            .from("punishment_log")
            .select("id")
            .eq("player_wallet", loserWallet)
            .eq("offense_type", "dispute_loss");

        const offenceCount = (existing?.length ?? 0) + 1;
        const { punishment, suspendHours, indefinite } = getPunishment(offenceCount);
        const punishmentEndsAt = suspendHours
            ? new Date(Date.now() + suspendHours * 60 * 60 * 1000).toISOString()
            : null;

        await supabase.from("punishment_log").insert({
            player_wallet: loserWallet,
            wager_id: wagerId,
            offense_type: "dispute_loss",
            offense_count: offenceCount,
            punishment,
            punishment_ends_at: punishmentEndsAt,
            issued_by: "moderator_system",
            notes: notes ?? null,
        });

        await supabase.from("player_behaviour_log").insert({
            player_wallet: loserWallet,
            event_type: "dispute_loss_moderated",
            related_id: wagerId,
            notes: `Offense #${offenceCount} — ${punishment}`,
        });

        // Apply suspension — timed for offenses 2-4, permanent for 5+
        if (suspendHours || indefinite) {
            await supabase.from("players")
                .update({
                    is_suspended: true,
                    // For indefinite bans suspension_ends_at stays null — no expiry
                    ...(suspendHours ? { suspension_ends_at: punishmentEndsAt } : {}),
                })
                .eq("wallet_address", loserWallet);
            const label = indefinite ? "permanently" : `for ${suspendHours}h`;
            console.log(`[process-verdict] Suspended ${loserWallet} ${label} (offense #${offenceCount})`);
        }
    } catch (e) {
        console.warn("[process-verdict] applyPunishment error:", e);
        // Non-critical — don't fail verdict for this
    }
}

// ── Notification helper (inlined) ─────────────────────────────────────────────

async function insertNotifications(
    supabase: ReturnType<typeof createClient>,
    items: Array<{
        player_wallet: string;
        type: string;
        title: string;
        message: string;
        wager_id: string;
    }>,
): Promise<void> {
    try {
        const { error } = await supabase.from("notifications").insert(items);
        if (error) console.warn("[process-verdict] notifications insert error:", error.message);
    } catch (e) {
        console.warn("[process-verdict] notifications insert threw:", e);
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
        const { requestId, wagerId, moderatorWallet, verdict, notes } = body as {
            requestId: string;
            wagerId: string;
            moderatorWallet: string;
            verdict: string;
            notes: string | null;
        };

        if (!requestId || !wagerId || !moderatorWallet || !verdict) {
            return respond({ error: "Missing required fields: requestId, wagerId, moderatorWallet, verdict" }, 400);
        }

        console.log(`[process-verdict] requestId=${requestId} wagerId=${wagerId} verdict=${verdict}`);

        // ── 1. Load wager ──────────────────────────────────────────────────────
        const { data: wager, error: wagerErr } = await supabase
            .from("wagers")
            .select("id, game, stake_lamports, player_a_wallet, player_b_wallet, match_id, status")
            .eq("id", wagerId)
            .single();

        if (wagerErr || !wager) {
            return respond({ error: "Wager not found" }, 404);
        }

        // Guard against double-processing
        if (wager.status === "resolved" || wager.status === "cancelled") {
            console.log(`[process-verdict] Wager ${wagerId} already ${wager.status} — skipping`);
            return respond({ ok: true, skipped: true, reason: `Wager already ${wager.status}` });
        }

        const playerAWallet = wager.player_a_wallet as string;
        const playerBWallet = wager.player_b_wallet as string | null;

        // ── 2. Handle cannot_determine — escalate, no on-chain action ──────────
        if (verdict === "cannot_determine") {
            // Leave wager in disputed state for admin manual resolution
            await supabase.from("player_behaviour_log").insert([
                { player_wallet: playerAWallet, event_type: "dispute_escalated", related_id: wagerId, notes: "Moderator could not determine outcome — escalated to admin" },
                ...(playerBWallet ? [{ player_wallet: playerBWallet, event_type: "dispute_escalated", related_id: wagerId, notes: "Moderator could not determine outcome — escalated to admin" }] : []),
            ]);

            const notifs: Array<{ player_wallet: string; type: string; title: string; message: string; wager_id: string }> = [
                { player_wallet: playerAWallet, type: "wager_disputed", title: "Dispute Escalated to Admin", message: "The moderator could not determine a clear winner. An admin will review your dispute.", wager_id: wagerId },
            ];
            if (playerBWallet) {
                notifs.push({ player_wallet: playerBWallet, type: "wager_disputed", title: "Dispute Escalated to Admin", message: "The moderator could not determine a clear winner. An admin will review your dispute.", wager_id: wagerId });
            }
            await insertNotifications(supabase, notifs);

            console.log(`[process-verdict] Escalated wager ${wagerId} to admin`);
            return respond({ ok: true, escalated: true });
        }

        // ── 3. Resolve on-chain ────────────────────────────────────────────────
        const isDraw = verdict === "draw";
        const winnerWallet = isDraw ? null : verdict;
        const resultType: "playerA" | "playerB" | "draw" = isDraw
            ? "draw"
            : verdict === playerAWallet ? "playerA" : "playerB";

        const txSig = await resolveOnChain(supabase, wager, winnerWallet, resultType, moderatorWallet);

        // ── 4. Update wager status in DB ───────────────────────────────────────
        // resolveOnChain logs wager_transactions but does NOT update wager status.
        // We do that here so this function owns the DB update, consistent with
        // how handleConcedeDispute works in actions.ts.
        await supabase.from("wagers")
            .update({
                status: "resolved",
                winner_wallet: winnerWallet,
                resolved_at: new Date().toISOString(),
            })
            .eq("id", wagerId)
            .neq("status", "resolved"); // race guard — don't double-update

        // ── 5. Apply punishment to loser ───────────────────────────────────────
        if (!isDraw && winnerWallet && playerBWallet) {
            const loserWallet = winnerWallet === playerAWallet ? playerBWallet : playerAWallet;
            await applyPunishment(supabase, loserWallet, wagerId, notes ?? null);
        }

        // ── 6. Notifications ───────────────────────────────────────────────────
        const stake = wager.stake_lamports as number;
        const totalPot = stake * 2;
        const platformFee = calculatePlatformFee(stake);
        const winnerPayout = totalPot - platformFee;
        const payoutSol = (winnerPayout / 1e9).toFixed(4);

        const notifs: Array<{ player_wallet: string; type: string; title: string; message: string; wager_id: string }> = [];

        if (isDraw) {
            notifs.push({ player_wallet: playerAWallet, type: "wager_draw", title: "Dispute: Draw", message: "The moderator declared a draw. Your stake has been refunded.", wager_id: wagerId });
            if (playerBWallet) {
                notifs.push({ player_wallet: playerBWallet, type: "wager_draw", title: "Dispute: Draw", message: "The moderator declared a draw. Your stake has been refunded.", wager_id: wagerId });
            }
        } else {
            const loserWallet = winnerWallet === playerAWallet ? playerBWallet : playerAWallet;
            notifs.push({ player_wallet: winnerWallet!, type: "wager_won", title: "🏆 Dispute: You Won!", message: `The moderator ruled in your favour. ${payoutSol} SOL is on its way.`, wager_id: wagerId });
            if (loserWallet) {
                notifs.push({ player_wallet: loserWallet, type: "wager_lost", title: "Dispute: You Lost", message: "The moderator ruled against you. Check your profile for any account notes.", wager_id: wagerId });
            }
        }

        // Notify the moderator — they earned their fee
        notifs.push({
            player_wallet: moderatorWallet,
            type: "wager_won",
            title: "Verdict Processed ✓",
            message: "Your moderator verdict has been applied. Thank you for keeping GameGambit fair.",
            wager_id: wagerId,
        });

        await insertNotifications(supabase, notifs);

        console.log(`[process-verdict] Done — wagerId=${wagerId} verdict=${verdict} tx=${txSig ?? "none"}`);

        return respond({
            ok: true,
            txSignature: txSig,
            verdict,
            wagerId,
            explorerUrl: txSig ? `https://explorer.solana.com/tx/${txSig}?cluster=devnet` : null,
        });

    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[process-verdict] Unexpected error:", msg);
        return respond({ error: msg }, 500);
    }
});