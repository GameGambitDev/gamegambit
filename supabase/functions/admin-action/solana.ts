// supabase/functions/admin-action/solana.ts

import * as web3 from "https://esm.sh/@solana/web3.js@1.98.0";

export const PROGRAM_ID_STR = "E2Vd3U91kMrgwp8JCXcLSn7bt3NowDmGwoBYsVRhGfMR";
export const PLATFORM_WALLET_STR = "3hwPwugeuZ33HWJ3SoJkDN2JT3Be9fH62r19ezFiCgYY";

// ── Fee helper ────────────────────────────────────────────────────────────────
const MICRO_THRESHOLD = 500_000_000;
const WHALE_THRESHOLD = 5_000_000_000;

export function calculatePlatformFee(stakeLamports: number): number {
    let bps: number;
    if (stakeLamports < MICRO_THRESHOLD) bps = 1000;
    else if (stakeLamports <= WHALE_THRESHOLD) bps = 700;
    else bps = 500;
    return Math.floor((stakeLamports * 2 * bps) / 10_000);
}

export const DISCRIMINATORS = {
    resolve_wager: new Uint8Array([31, 179, 1, 228, 83, 224, 1, 123]),
    close_wager: new Uint8Array([167, 240, 85, 147, 127, 50, 69, 203]),
};

// ── Re-export what index.ts needs directly ────────────────────────────────────
export const {
    Connection,
    Keypair,
    PublicKey,
    Transaction,
    TransactionInstruction,
    SystemProgram,
} = web3;

// ── Keypair ───────────────────────────────────────────────────────────────────
export function getAuthority() {
    const raw = Deno.env.get("AUTHORITY_WALLET_SECRET");
    if (!raw) throw new Error("AUTHORITY_WALLET_SECRET is not set");
    let bytes: number[];
    try { bytes = JSON.parse(raw); }
    catch { throw new Error("AUTHORITY_WALLET_SECRET is not valid JSON"); }
    return Keypair.fromSecretKey(new Uint8Array(bytes));
}

// ── PDA derivation ────────────────────────────────────────────────────────────
export function deriveWagerPDA(playerAWallet: string, matchId: bigint) {
    const matchIdBytes = new Uint8Array(8);
    new DataView(matchIdBytes.buffer).setBigUint64(0, matchId, true);
    const [pda] = PublicKey.findProgramAddressSync(
        [new TextEncoder().encode("wager"), new PublicKey(playerAWallet).toBytes(), matchIdBytes],
        new PublicKey(PROGRAM_ID_STR),
    );
    return pda;
}

// ── Send + confirm via SDK (no manual polling loop) ───────────────────────────
export async function sendAndConfirm(
    // deno-lint-ignore no-explicit-any
    authority: any,
    // deno-lint-ignore no-explicit-any
    instruction: any,
    rpcUrl: string,
): Promise<string> {
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

    // Use SDK confirmation — delegates to WebSocket subscription internally,
    // avoiding the CPU-heavy manual polling loop that caused Edge Function timeouts.
    await connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        "confirmed",
    );

    return signature;
}