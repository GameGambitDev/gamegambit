// supabase/functions/process-concession/index.ts
//
// Step 4 — Dispute Grace Period: on-chain resolution for conceded disputes.
//
// This function is designed to be called directly by the client-side
// concedeDispute flow via secure-wager/actions.ts (which calls resolveOnChain
// internally). This standalone function is kept as a safety fallback for
// admin-triggered re-resolution if the inline call fails.
//
// It does NOT charge a moderator fee (grace period concessions reward honesty).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.2";
import {
    Connection,
    Keypair,
    PublicKey,
    Transaction,
    TransactionInstruction,
    SystemProgram,
} from "https://esm.sh/@solana/web3.js@1.98.0";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
};

const PROGRAM_ID = "E2Vd3U91kMrgwp8JCXcLSn7bt3NowDmGwoBYsVRhGfMR";
const PLATFORM_WALLET = "3hwPwugeuZ33HWJ3SoJkDN2JT3Be9fH62r19ezFiCgYY";

// ── Fee helper (must match calculate_platform_fee() in lib.rs) ────────────────
const MICRO_THRESHOLD = 500_000_000;    // 0.5 SOL in lamports
const WHALE_THRESHOLD = 5_000_000_000;  // 5.0 SOL in lamports

function calculatePlatformFee(stakeLamports: number): number {
  let bps: number;
  if (stakeLamports < MICRO_THRESHOLD)       bps = 1000;
  else if (stakeLamports <= WHALE_THRESHOLD) bps = 700;
  else                                        bps = 500;
  return Math.floor((stakeLamports * 2 * bps) / 10_000);
}

const DISCRIMINATORS = {
    resolve_wager: [31, 179, 1, 228, 83, 224, 1, 123],
    close_wager: [167, 240, 85, 147, 127, 50, 69, 203],
};

function loadAuthorityKeypair(secret: string): Keypair {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secret)));
}

function deriveWagerPda(playerA: PublicKey, matchId: bigint): PublicKey {
    const matchIdBytes = new Uint8Array(8);
    new DataView(matchIdBytes.buffer).setBigUint64(0, matchId, true);
    const [pda] = PublicKey.findProgramAddressSync(
        [new TextEncoder().encode("wager"), playerA.toBytes(), matchIdBytes],
        new PublicKey(PROGRAM_ID),
    );
    return pda;
}

function buildResolveWagerIx(
    wagerPda: PublicKey,
    authority: PublicKey,
    winner: PublicKey,
    platformWallet: PublicKey,
): TransactionInstruction {
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

serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    try {
        const supabase = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );

        const { wagerId } = await req.json();
        if (!wagerId) return new Response(JSON.stringify({ error: "wagerId required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

        const { data: wager, error: wagerErr } = await supabase
            .from("wagers")
            .select("*")
            .eq("id", wagerId)
            .single();

        if (wagerErr || !wager) {
            return new Response(JSON.stringify({ error: "Wager not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        if (wager.status !== "resolved" || !wager.grace_conceded_by || !wager.winner_wallet) {
            return new Response(JSON.stringify({ error: "Wager is not a valid concession — must be resolved with grace_conceded_by set" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // Check if already processed on-chain
        const { data: existing } = await supabase
            .from("wager_transactions")
            .select("id")
            .eq("wager_id", wagerId)
            .eq("tx_type", "winner_payout")
            .limit(1);

        if (existing && existing.length > 0) {
            return new Response(JSON.stringify({ ok: true, skipped: true, reason: "Already resolved on-chain" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const rpcUrl = Deno.env.get("SOLANA_RPC_URL") || "https://api.devnet.solana.com";
        const connection = new Connection(rpcUrl, "confirmed");
        const authority = loadAuthorityKeypair(Deno.env.get("AUTHORITY_WALLET_SECRET")!);

        const playerAPubkey = new PublicKey(wager.player_a_wallet);
        const wagerPda = deriveWagerPda(playerAPubkey, BigInt(wager.match_id));
        const winnerPubkey = new PublicKey(wager.winner_wallet);
        const platformPubkey = new PublicKey(PLATFORM_WALLET);

        const stake = wager.stake_lamports as number;
        const totalPot = stake * 2;
        const platformFee = calculatePlatformFee(stake);
        const winnerPayout = totalPot - platformFee;

        const ix = buildResolveWagerIx(wagerPda, authority.publicKey, winnerPubkey, platformPubkey);
        const transaction = new Transaction().add(ix);
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
        transaction.recentBlockhash = blockhash;
        transaction.lastValidBlockHeight = lastValidBlockHeight;
        transaction.feePayer = authority.publicKey;
        transaction.sign(authority);

        const txSig = await connection.sendRawTransaction(transaction.serialize(), { skipPreflight: false, preflightCommitment: "confirmed" });
        await connection.confirmTransaction({ signature: txSig, blockhash, lastValidBlockHeight }, "confirmed");

        console.log(`[process-concession] Resolved wager ${wagerId}: ${txSig}`);

        await supabase.from("wager_transactions").upsert([
            { wager_id: wagerId, tx_type: "winner_payout", wallet_address: wager.winner_wallet, amount_lamports: winnerPayout, tx_signature: txSig, status: "confirmed" },
            { wager_id: wagerId, tx_type: "platform_fee", wallet_address: PLATFORM_WALLET, amount_lamports: platformFee, tx_signature: txSig, status: "confirmed" },
        ], { onConflict: "tx_signature", ignoreDuplicates: true });

        // Update winner/loser stats
        await supabase.rpc("update_winner_stats", { p_wallet: wager.winner_wallet, p_stake: stake, p_earnings: winnerPayout });
        const loserWallet = wager.winner_wallet === wager.player_a_wallet ? wager.player_b_wallet : wager.player_a_wallet;
        await supabase.rpc("update_loser_stats", { p_wallet: loserWallet, p_stake: stake });

        return new Response(JSON.stringify({ ok: true, txSignature: txSig }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[process-concession] Error:", msg);
        return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
});