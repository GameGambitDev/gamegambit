// supabase/functions/secure-wager/solana.ts
//
// All Solana plumbing: keypair loading, PDA derivation, instruction builders,
// transaction sending, and the resolveOnChain helper used by actions.ts.
// Nothing in here knows about wager business logic.
//
// FIX (April 2026): Replaced lazy dynamic import() of @solana/web3.js with a
// static top-level import. The dynamic import pattern caused:
//   "Cannot evaluate dynamically imported module, because JavaScript execution
//    has been terminated."
// (Supabase Edge Runtime / Deno kills the isolate after returning a response.
// Any dynamic import() that is still evaluating at that point is terminated.
// Static imports are fully resolved before the first handler runs, so they
// are never affected by isolate shutdown.)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
    Connection,
    Keypair,
    PublicKey,
    SystemProgram,
    Transaction,
    TransactionInstruction,
} from "https://esm.sh/@solana/web3.js@1.98.0";

// Re-export commonly used types so consumers don't need to import web3.js directly
export { Connection, PublicKey };

export const PROGRAM_ID = "E2Vd3U91kMrgwp8JCXcLSn7bt3NowDmGwoBYsVRhGfMR";
export const PLATFORM_WALLET = "3hwPwugeuZ33HWJ3SoJkDN2JT3Be9fH62r19ezFiCgYY";

// Fee helpers (must match calculate_platform_fee() in lib.rs)
const _MICRO_THRESHOLD = 500_000_000;
const _WHALE_THRESHOLD = 5_000_000_000;

export function calculatePlatformFee(stakeLamports: number): number {
    let bps: number;
    if (stakeLamports < _MICRO_THRESHOLD) bps = 1000;
    else if (stakeLamports <= _WHALE_THRESHOLD) bps = 700;
    else bps = 500;
    return Math.floor((stakeLamports * 2 * bps) / 10_000);
}

const DISCRIMINATORS = {
    resolve_wager: [31, 179, 1, 228, 83, 224, 1, 123],
    close_wager: [167, 240, 85, 147, 127, 50, 69, 203],
};

// ── Keypair + PDA ─────────────────────────────────────────────────────────────

export function loadAuthorityKeypair(): InstanceType<typeof Keypair> {
    const secret = Deno.env.get('AUTHORITY_WALLET_SECRET');
    if (!secret) throw new Error('AUTHORITY_WALLET_SECRET not configured');
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secret)));
}

export function deriveWagerPda(playerAWallet: string, matchId: bigint): InstanceType<typeof PublicKey> {
    const playerA = new PublicKey(playerAWallet);
    const matchIdBytes = new Uint8Array(8);
    new DataView(matchIdBytes.buffer).setBigUint64(0, matchId, true);
    const [pda] = PublicKey.findProgramAddressSync(
        [new TextEncoder().encode("wager"), playerA.toBytes(), matchIdBytes],
        new PublicKey(PROGRAM_ID),
    );
    return pda;
}

// ── Instruction builders ──────────────────────────────────────────────────────

export function buildResolveWagerIx(
    // deno-lint-ignore no-explicit-any
    wagerPda: any, authority: any, winner: any, platformWallet: any,
): InstanceType<typeof TransactionInstruction> {
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

export function buildCloseWagerIx(
    // deno-lint-ignore no-explicit-any
    wagerPda: any, authority: any, playerA: any, playerB: any,
): InstanceType<typeof TransactionInstruction> {
    return new TransactionInstruction({
        programId: new PublicKey(PROGRAM_ID),
        keys: [
            { pubkey: wagerPda, isSigner: false, isWritable: true },
            { pubkey: playerA, isSigner: false, isWritable: true },
            { pubkey: playerB, isSigner: false, isWritable: true },
            { pubkey: authority, isSigner: true, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: new Uint8Array(DISCRIMINATORS.close_wager),
    });
}

// ── Transaction sending ───────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
export async function sendAndConfirm(connection: any, authority: any, ix: any): Promise<string> {
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    const tx = new Transaction();
    tx.add(ix);
    tx.recentBlockhash = blockhash;
    tx.feePayer = authority.publicKey;
    tx.sign(authority);
    const sig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false });
    await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');
    return sig;
}

// ── High-level resolution helper ──────────────────────────────────────────────

export async function resolveOnChain(
    supabase: ReturnType<typeof createClient>,
    wager: Record<string, unknown>,
    winnerWallet: string | null,
    resultType: 'playerA' | 'playerB' | 'draw',
): Promise<string | null> {
    try {
        const rpcUrl = Deno.env.get('SOLANA_RPC_URL') || 'https://api.devnet.solana.com';
        const connection = new Connection(rpcUrl, 'confirmed');
        const authority = loadAuthorityKeypair();
        const wagerPda = deriveWagerPda(wager.player_a_wallet as string, BigInt(wager.match_id as number));
        const wagerId = wager.id as string;
        const stake = wager.stake_lamports as number;

        let txSig: string;
        if (resultType === 'draw') {
            const playerAPubkey = new PublicKey(wager.player_a_wallet as string);
            const playerBPubkey = new PublicKey(wager.player_b_wallet as string);
            const ix = buildCloseWagerIx(wagerPda, authority.publicKey, playerAPubkey, playerBPubkey);
            txSig = await sendAndConfirm(connection, authority, ix);
            console.log(`[solana] close_wager (draw) tx: ${txSig}`);
            await supabase.from('wager_transactions').upsert([
                { wager_id: wagerId, tx_type: 'draw_refund', wallet_address: wager.player_a_wallet, amount_lamports: stake, tx_signature: txSig, status: 'confirmed' },
                { wager_id: wagerId, tx_type: 'draw_refund', wallet_address: wager.player_b_wallet, amount_lamports: stake, tx_signature: txSig, status: 'confirmed' },
            ], { onConflict: 'tx_signature', ignoreDuplicates: true });
        } else {
            const totalPot = stake * 2;
            const platformFee = calculatePlatformFee(stake);
            const winnerPayout = totalPot - platformFee;
            const winnerPubkey = new PublicKey(winnerWallet!);
            const platformPubkey = new PublicKey(PLATFORM_WALLET);
            const ix = buildResolveWagerIx(wagerPda, authority.publicKey, winnerPubkey, platformPubkey);
            txSig = await sendAndConfirm(connection, authority, ix);
            console.log(`[solana] resolve_wager tx: ${txSig}`);
            await supabase.from('wager_transactions').upsert([
                { wager_id: wagerId, tx_type: 'winner_payout', wallet_address: winnerWallet, amount_lamports: winnerPayout, tx_signature: txSig, status: 'confirmed' },
                { wager_id: wagerId, tx_type: 'platform_fee', wallet_address: PLATFORM_WALLET, amount_lamports: platformFee, tx_signature: txSig, status: 'confirmed' },
            ], { onConflict: 'tx_signature', ignoreDuplicates: true });
            const loserWallet = winnerWallet === wager.player_a_wallet ? wager.player_b_wallet : wager.player_a_wallet;
            await supabase.rpc('update_winner_stats', { p_wallet: winnerWallet, p_stake: stake, p_earnings: winnerPayout })
                .then(({ error }: { error: unknown }) => error && console.log('winner stats error:', error));
            await supabase.rpc('update_loser_stats', { p_wallet: loserWallet, p_stake: stake })
                .then(({ error }: { error: unknown }) => error && console.log('loser stats error:', error));
        }
        return txSig;
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[solana] resolveOnChain failed:', msg);
        try {
            await supabase.from('wager_transactions').insert({
                wager_id: wager.id, tx_type: 'error_on_chain_resolve',
                wallet_address: wager.player_a_wallet as string,
                amount_lamports: 0, status: 'failed', error_message: msg,
            });
        } catch { /* ignore */ }
        return null;
    }
}