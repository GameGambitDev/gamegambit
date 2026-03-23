// supabase/functions/_shared/solana.ts
// Single source of truth for all on-chain helpers.
// Import with: import { ... } from "../_shared/solana.ts"

import {
    Connection,
    Keypair,
    PublicKey,
    Transaction,
    TransactionInstruction,
    SystemProgram,
} from "https://esm.sh/@solana/web3.js@1.98.0";

// ── Constants (must match lib.rs) ─────────────────────────────────────────────

export const PROGRAM_ID    = new PublicKey("E2Vd3U91kMrgwp8JCXcLSn7bt3NowDmGwoBYsVRhGfMR");
export const PLATFORM_WALLET = new PublicKey("3hwPwugeuZ33HWJ3SoJkDN2JT3Be9fH62r19ezFiCgYY");
export const PLATFORM_FEE_BPS = 1000; // 10 %

export const DISCRIMINATORS = {
    resolve_wager: new Uint8Array([31, 179, 1, 228, 83, 224, 1, 123]),
    close_wager:   new Uint8Array([167, 240, 85, 147, 127, 50, 69, 203]),
};

// ── RPC / Explorer helpers ────────────────────────────────────────────────────

export function getRpcUrl(): string {
    return Deno.env.get("SOLANA_RPC_URL") ?? "https://api.devnet.solana.com";
}

export function isDevnet(): boolean {
    return getRpcUrl().includes("devnet");
}

export function explorerTx(sig: string): string {
    return `https://explorer.solana.com/tx/${sig}${isDevnet() ? "?cluster=devnet" : ""}`;
}

export function explorerAddress(address: string): string {
    return `https://explorer.solana.com/address/${address}${isDevnet() ? "?cluster=devnet" : ""}`;
}

// ── Keypair loader ────────────────────────────────────────────────────────────

export function loadAuthorityKeypair(): Keypair {
    const secret = Deno.env.get("AUTHORITY_WALLET_SECRET");
    if (!secret) throw new Error("AUTHORITY_WALLET_SECRET not configured");
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secret)));
}

// ── PDA derivation ────────────────────────────────────────────────────────────

export function deriveWagerPda(playerA: PublicKey, matchId: bigint): PublicKey {
    const matchIdBytes = new Uint8Array(8);
    new DataView(matchIdBytes.buffer).setBigUint64(0, matchId, true); // little-endian
    const [pda] = PublicKey.findProgramAddressSync(
        [new TextEncoder().encode("wager"), playerA.toBytes(), matchIdBytes],
        PROGRAM_ID
    );
    return pda;
}

// ── Instruction builders ──────────────────────────────────────────────────────

// IDL: resolve_wager → wager, winner, authorizer (signer), platform_wallet, system_program
export function buildResolveWagerIx(
    wagerPda:  PublicKey,
    authority: PublicKey,
    winner:    PublicKey,
): TransactionInstruction {
    const disc        = DISCRIMINATORS.resolve_wager;
    const winnerBytes = winner.toBytes();
    const data        = new Uint8Array(disc.length + winnerBytes.length);
    data.set(disc, 0);
    data.set(winnerBytes, disc.length);

    return new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
            { pubkey: wagerPda,                  isSigner: false, isWritable: true  },
            { pubkey: winner,                    isSigner: false, isWritable: true  },
            { pubkey: authority,                 isSigner: true,  isWritable: true  },
            { pubkey: PLATFORM_WALLET,           isSigner: false, isWritable: true  },
            { pubkey: SystemProgram.programId,   isSigner: false, isWritable: false },
        ],
        data,
    });
}

// IDL: close_wager → wager, player_a, player_b, authorizer (signer), system_program
// No platform_wallet — close_wager splits funds back to both players only.
export function buildCloseWagerIx(
    wagerPda:  PublicKey,
    authority: PublicKey,
    playerA:   PublicKey,
    playerB:   PublicKey,
): TransactionInstruction {
    return new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
            { pubkey: wagerPda,                  isSigner: false, isWritable: true  },
            { pubkey: playerA,                   isSigner: false, isWritable: true  },
            { pubkey: playerB,                   isSigner: false, isWritable: true  },
            { pubkey: authority,                 isSigner: true,  isWritable: true  },
            { pubkey: SystemProgram.programId,   isSigner: false, isWritable: false },
        ],
        data: DISCRIMINATORS.close_wager,
    });
}

// ── Transaction sender ────────────────────────────────────────────────────────

export async function sendAndConfirm(
    connection: Connection,
    authority:  Keypair,
    ix:         TransactionInstruction,
): Promise<string> {
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
