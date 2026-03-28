// supabase/functions/secure-wager/solana.ts
//
// All Solana plumbing: keypair loading, PDA derivation, instruction builders,
// transaction sending, and the resolveOnChain helper used by actions.ts.
// Nothing in here knows about wager business logic.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const PROGRAM_ID = "E2Vd3U91kMrgwp8JCXcLSn7bt3NowDmGwoBYsVRhGfMR";
export const PLATFORM_WALLET = "3hwPwugeuZ33HWJ3SoJkDN2JT3Be9fH62r19ezFiCgYY";
export const PLATFORM_FEE_BPS = 1000;

const DISCRIMINATORS = {
    resolve_wager: [31, 179, 1, 228, 83, 224, 1, 123],
    close_wager: [167, 240, 85, 147, 127, 50, 69, 203],
};

// ── Lazy Solana import ────────────────────────────────────────────────────────

let _solana: typeof import("https://esm.sh/@solana/web3.js@1.98.0") | null = null;
export async function getSolana() {
    if (!_solana) {
        _solana = await import("https://esm.sh/@solana/web3.js@1.98.0");
    }
    return _solana;
}

// ── Keypair + PDA ─────────────────────────────────────────────────────────────

export async function loadAuthorityKeypair() {
    const { Keypair } = await getSolana();
    const secret = Deno.env.get('AUTHORITY_WALLET_SECRET');
    if (!secret) throw new Error('AUTHORITY_WALLET_SECRET not configured');
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secret)));
}

export async function deriveWagerPda(playerAWallet: string, matchId: bigint) {
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

// ── Instruction builders ──────────────────────────────────────────────────────

export async function buildResolveWagerIx(
    wagerPda: unknown, authority: unknown, winner: unknown, platformWallet: unknown,
) {
    const { TransactionInstruction, SystemProgram, PublicKey } = await getSolana();
    const disc = new Uint8Array(DISCRIMINATORS.resolve_wager);
    // deno-lint-ignore no-explicit-any
    const winnerBytes = (winner as any).toBytes();
    const data = new Uint8Array(disc.length + winnerBytes.length);
    data.set(disc, 0);
    data.set(winnerBytes, disc.length);
    return new TransactionInstruction({
        programId: new PublicKey(PROGRAM_ID),
        keys: [
            // deno-lint-ignore no-explicit-any
            { pubkey: wagerPda as any, isSigner: false, isWritable: true },
            // deno-lint-ignore no-explicit-any
            { pubkey: winner as any, isSigner: false, isWritable: true },
            // deno-lint-ignore no-explicit-any
            { pubkey: authority as any, isSigner: true, isWritable: true },
            // deno-lint-ignore no-explicit-any
            { pubkey: platformWallet as any, isSigner: false, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data,
    });
}

export async function buildCloseWagerIx(
    wagerPda: unknown, authority: unknown, playerA: unknown, playerB: unknown,
) {
    const { TransactionInstruction, SystemProgram, PublicKey } = await getSolana();
    return new TransactionInstruction({
        programId: new PublicKey(PROGRAM_ID),
        keys: [
            // deno-lint-ignore no-explicit-any
            { pubkey: wagerPda as any, isSigner: false, isWritable: true },
            // deno-lint-ignore no-explicit-any
            { pubkey: playerA as any, isSigner: false, isWritable: true },
            // deno-lint-ignore no-explicit-any
            { pubkey: playerB as any, isSigner: false, isWritable: true },
            // deno-lint-ignore no-explicit-any
            { pubkey: authority as any, isSigner: true, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: new Uint8Array(DISCRIMINATORS.close_wager),
    });
}

// ── Transaction sending ───────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
export async function sendAndConfirm(connection: any, authority: any, ix: any): Promise<string> {
    const { Transaction } = await getSolana();
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
        const { Connection, PublicKey } = await getSolana();
        const rpcUrl = Deno.env.get('SOLANA_RPC_URL') || 'https://api.devnet.solana.com';
        const connection = new Connection(rpcUrl, 'confirmed');
        const authority = await loadAuthorityKeypair();
        const wagerPda = await deriveWagerPda(wager.player_a_wallet as string, BigInt(wager.match_id as number));
        const wagerId = wager.id as string;
        const stake = wager.stake_lamports as number;

        let txSig: string;
        if (resultType === 'draw') {
            const playerAPubkey = new PublicKey(wager.player_a_wallet as string);
            const playerBPubkey = new PublicKey(wager.player_b_wallet as string);
            const ix = await buildCloseWagerIx(wagerPda, authority.publicKey, playerAPubkey, playerBPubkey);
            txSig = await sendAndConfirm(connection, authority, ix);
            console.log(`[solana] close_wager (draw) tx: ${txSig}`);
            await supabase.from('wager_transactions').upsert([
                { wager_id: wagerId, tx_type: 'draw_refund', wallet_address: wager.player_a_wallet, amount_lamports: stake, tx_signature: txSig, status: 'confirmed' },
                { wager_id: wagerId, tx_type: 'draw_refund', wallet_address: wager.player_b_wallet, amount_lamports: stake, tx_signature: txSig, status: 'confirmed' },
            ], { onConflict: 'tx_signature', ignoreDuplicates: true });
        } else {
            const totalPot = stake * 2;
            const platformFee = Math.floor(totalPot * PLATFORM_FEE_BPS / 10_000);
            const winnerPayout = totalPot - platformFee;
            const winnerPubkey = new PublicKey(winnerWallet!);
            const platformPubkey = new PublicKey(PLATFORM_WALLET);
            const ix = await buildResolveWagerIx(wagerPda, authority.publicKey, winnerPubkey, platformPubkey);
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
