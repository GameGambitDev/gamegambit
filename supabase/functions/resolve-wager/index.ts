// supabase/functions/resolve-wager/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

const PROGRAM_ID = "E2Vd3U91kMrgwp8JCXcLSn7bt3NowDmGwoBYsVRhGfMR";
const PLATFORM_WALLET = "3hwPwugeuZ33HWJ3SoJkDN2JT3Be9fH62r19ezFiCgYY";
const PLATFORM_FEE_BPS = 1000;
const MODERATOR_FEE_SHARE = 0.40;

const DISCRIMINATORS = {
    resolve_wager: [31, 179, 1, 228, 83, 224, 1, 123],
    close_wager: [167, 240, 85, 147, 127, 50, 69, 203],
};

// ── Lazy Solana loader ────────────────────────────────────────────────────────
let _solana: typeof import("https://esm.sh/@solana/web3.js@1.98.0") | null = null;
async function getSolana() {
    if (!_solana) {
        _solana = await import("https://esm.sh/@solana/web3.js@1.98.0");
    }
    return _solana;
}

async function loadAuthorityKeypair(secret: string) {
    const { Keypair } = await getSolana();
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secret)));
}

// deno-lint-ignore no-explicit-any
async function deriveWagerPda(playerAWallet: string, matchId: bigint): Promise<any> {
    const { PublicKey } = await getSolana();
    const playerA = new PublicKey(playerAWallet);
    const matchIdBytes = new Uint8Array(8);
    new DataView(matchIdBytes.buffer).setBigUint64(0, matchId, true);
    const [pda] = PublicKey.findProgramAddressSync(
        [new TextEncoder().encode("wager"), playerA.toBytes(), matchIdBytes],
        new PublicKey(PROGRAM_ID)
    );
    return pda;
}

// deno-lint-ignore no-explicit-any
async function buildResolveWagerIx(wagerPda: any, authority: any, winner: any, platformWallet: any): Promise<any> {
    const { TransactionInstruction, SystemProgram, PublicKey } = await getSolana();
    const disc = new Uint8Array(DISCRIMINATORS.resolve_wager);
    const winnerBytes = winner.toBytes();
    const resolveData = new Uint8Array(disc.length + winnerBytes.length);
    resolveData.set(disc, 0);
    resolveData.set(winnerBytes, disc.length);
    return new TransactionInstruction({
        programId: new PublicKey(PROGRAM_ID),
        keys: [
            { pubkey: wagerPda, isSigner: false, isWritable: true },
            { pubkey: winner, isSigner: false, isWritable: true },
            { pubkey: authority, isSigner: true, isWritable: true },
            { pubkey: platformWallet, isSigner: false, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: resolveData,
    });
}

// deno-lint-ignore no-explicit-any
async function buildCloseWagerIx(wagerPda: any, authority: any, playerA: any, playerB: any, platformWallet: any): Promise<any> {
    const { TransactionInstruction, SystemProgram, PublicKey } = await getSolana();
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

// deno-lint-ignore no-explicit-any
async function sendAndConfirm(connection: any, authority: any, instruction: any): Promise<string> {
    const { Transaction } = await getSolana();
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    const tx = new Transaction();
    tx.add(instruction);
    tx.recentBlockhash = blockhash;
    tx.feePayer = authority.publicKey;
    tx.sign(authority);
    const signature = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false });
    await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');
    return signature;
}

async function logTransaction(
    supabase: ReturnType<typeof createClient>,
    wagerId: string,
    txType: string,
    walletAddress: string,
    amountLamports: number,
    txSignature: string | null = null,
    status: 'pending' | 'confirmed' | 'failed' = 'confirmed',
    errorMessage: string | null = null,
) {
    try {
        await supabase.from('wager_transactions').insert({
            wager_id: wagerId,
            tx_type: txType,
            wallet_address: walletAddress,
            amount_lamports: amountLamports,
            tx_signature: txSignature,
            status,
            error_message: errorMessage,
            created_at: new Date().toISOString(),
        });
    } catch (e) { console.log('Transaction log error:', e); }
}

async function logError(
    supabase: ReturnType<typeof createClient>,
    wagerId: string,
    errorType: string,
    errorMessage: string,
    context: Record<string, unknown> = {},
) {
    try {
        console.error(`[${errorType}] Wager ${wagerId}: ${errorMessage}`, context);
        await supabase.from('wager_transactions').insert({
            wager_id: wagerId,
            tx_type: `error_${errorType}`,
            wallet_address: context.walletAddress as string || 'system',
            amount_lamports: 0,
            status: 'failed',
            error_message: `${errorType}: ${errorMessage}`,
            created_at: new Date().toISOString(),
        });
    } catch (e) { console.log('Error log failed:', e); }
}

// ── Main Handler ──────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
    // Handle CORS preflight immediately — before any imports or async work
    if (req.method === 'OPTIONS') {
        return new Response('ok', { status: 200, headers: corsHeaders });
    }

    const respond = (body: unknown, status = 200) =>
        new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const authoritySecret = Deno.env.get('AUTHORITY_WALLET_SECRET')!;
        const rpcUrl = Deno.env.get('SOLANA_RPC_URL') || 'https://api.devnet.solana.com';

        if (!authoritySecret) throw new Error('AUTHORITY_WALLET_SECRET not configured');

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Solana objects loaded lazily here — only after OPTIONS is already handled
        const { Connection, PublicKey, LAMPORTS_PER_SOL } = await getSolana();
        const connection = new Connection(rpcUrl, 'confirmed');
        const authority = await loadAuthorityKeypair(authoritySecret);

        console.log(`resolve-wager — authority: ${authority.publicKey.toBase58()}`);

        const body = await req.json();
        console.log('Action:', body.action);

        switch (body.action) {

            // ── resolve_wager ─────────────────────────────────────────────────────
            case 'resolve_wager': {
                const { matchId, playerAWallet, playerBWallet, winnerWallet, wagerId, stakeLamports, moderatorWallet } = body;
                if (!matchId || !playerAWallet || !winnerWallet)
                    throw new Error('Missing: matchId, playerAWallet, winnerWallet');

                const winnerPubkey = new PublicKey(winnerWallet);
                const platformPubkey = new PublicKey(PLATFORM_WALLET);
                const wagerPda = await deriveWagerPda(playerAWallet, BigInt(matchId));

                console.log(`Resolving wager PDA: ${wagerPda.toBase58()} → winner: ${winnerWallet}`);

                const ix = await buildResolveWagerIx(wagerPda, authority.publicKey, winnerPubkey, platformPubkey);
                let txSig: string | null = null;
                try {
                    txSig = await sendAndConfirm(connection, authority, ix);
                    console.log(`resolve_wager tx success: ${txSig}`);
                } catch (onChainErr: unknown) {
                    const errorMsg = onChainErr instanceof Error ? onChainErr.message : String(onChainErr);
                    console.error('On-chain resolve_wager failed:', errorMsg);
                    if (wagerId) {
                        await logError(supabase, wagerId, 'on_chain_resolve', errorMsg, {
                            walletAddress: winnerWallet,
                            wagerPda: wagerPda.toBase58(),
                            matchId,
                        });
                    }
                }

                if (wagerId) {
                    const { data: wager } = await supabase.from('wagers')
                        .select('status,stake_lamports,player_a_wallet,player_b_wallet').eq('id', wagerId).single();

                    const stake = stakeLamports || wager?.stake_lamports || 0;
                    const totalPot = stake * 2;
                    const platformFee = Math.floor(totalPot * PLATFORM_FEE_BPS / 10_000);
                    const winnerPayout = totalPot - platformFee;
                    const moderatorCut = moderatorWallet ? Math.floor(platformFee * MODERATOR_FEE_SHARE) : 0;
                    const netPlatform = platformFee - moderatorCut;
                    const loserWallet = winnerWallet === wager?.player_a_wallet ? wager?.player_b_wallet : wager?.player_a_wallet;

                    if (wager?.status !== 'resolved') {
                        await supabase.from('wagers').update({
                            status: 'resolved', winner_wallet: winnerWallet, resolved_at: new Date().toISOString(),
                        }).eq('id', wagerId);
                    }

                    await supabase.rpc('update_winner_stats', { p_wallet: winnerWallet, p_stake: stake, p_earnings: winnerPayout })
                        .then(({ error }: { error: unknown }) => error && console.log('winner stats:', error));
                    if (loserWallet) {
                        await supabase.rpc('update_loser_stats', { p_wallet: loserWallet, p_stake: stake })
                            .then(({ error }: { error: unknown }) => error && console.log('loser stats:', error));
                    }

                    await logTransaction(supabase, wagerId, 'winner_payout', winnerWallet, winnerPayout, txSig);
                    await logTransaction(supabase, wagerId, 'platform_fee', PLATFORM_WALLET, netPlatform, txSig);
                    if (moderatorWallet && moderatorCut > 0) {
                        await logTransaction(supabase, wagerId, 'moderator_fee', moderatorWallet, moderatorCut, txSig);
                    }

                    return respond({
                        success: true,
                        txSignature: txSig,
                        winner: winnerWallet,
                        winnerPayout,
                        platformFee: netPlatform,
                        moderatorCut,
                        explorerUrl: txSig ? `https://explorer.solana.com/tx/${txSig}?cluster=devnet` : null,
                    });
                }

                return respond({ success: true, txSignature: txSig });
            }

            // ── refund_draw ───────────────────────────────────────────────────────
            case 'refund_draw': {
                const { matchId, playerAWallet, playerBWallet, wagerId, stakeLamports } = body;
                if (!matchId || !playerAWallet || !playerBWallet)
                    throw new Error('Missing: matchId, playerAWallet, playerBWallet');

                const playerAPubkey = new PublicKey(playerAWallet);
                const playerBPubkey = new PublicKey(playerBWallet);
                const platformPubkey = new PublicKey(PLATFORM_WALLET);
                const wagerPda = await deriveWagerPda(playerAWallet, BigInt(matchId));

                console.log(`Draw refund PDA: ${wagerPda.toBase58()}`);

                const ix = await buildCloseWagerIx(wagerPda, authority.publicKey, playerAPubkey, playerBPubkey, platformPubkey);
                let txSig: string | null = null;
                try {
                    txSig = await sendAndConfirm(connection, authority, ix);
                    console.log(`close_wager (draw) tx success: ${txSig}`);
                } catch (onChainErr: unknown) {
                    const errorMsg = onChainErr instanceof Error ? onChainErr.message : String(onChainErr);
                    console.error('On-chain close_wager (draw) failed:', errorMsg);
                    if (wagerId) {
                        await logError(supabase, wagerId, 'on_chain_draw_refund', errorMsg, {
                            walletAddress: playerAWallet,
                            wagerPda: wagerPda.toBase58(),
                            matchId,
                        });
                    }
                }

                if (wagerId) {
                    const stake = stakeLamports || 0;
                    const { data: wager } = await supabase.from('wagers').select('status').eq('id', wagerId).single();
                    if (wager?.status !== 'resolved') {
                        await supabase.from('wagers').update({
                            status: 'resolved', winner_wallet: null, resolved_at: new Date().toISOString(),
                        }).eq('id', wagerId);
                    }
                    await logTransaction(supabase, wagerId, 'draw_refund', playerAWallet, stake, txSig);
                    await logTransaction(supabase, wagerId, 'draw_refund', playerBWallet, stake, txSig);
                }

                return respond({
                    success: true,
                    txSignature: txSig,
                    explorerUrl: txSig ? `https://explorer.solana.com/tx/${txSig}?cluster=devnet` : null,
                });
            }

            // ── get_balance ───────────────────────────────────────────────────────
            case 'get_balance': {
                const lamports = await connection.getBalance(authority.publicKey);
                return respond({
                    success: true,
                    platformWallet: authority.publicKey.toBase58(),
                    balanceSOL: lamports / LAMPORTS_PER_SOL,
                    balanceLamports: lamports,
                    explorerUrl: `https://explorer.solana.com/address/${authority.publicKey.toBase58()}?cluster=devnet`,
                });
            }

            // ── record_escrow ─────────────────────────────────────────────────────
            case 'record_escrow': {
                const { wagerId, playerAWallet, playerBWallet, stakeLamports, txSignature } = body;
                if (!wagerId || !stakeLamports) throw new Error('Missing wagerId or stakeLamports');
                if (playerAWallet) await logTransaction(supabase, wagerId, 'escrow_deposit', playerAWallet, stakeLamports, txSignature ?? null);
                if (playerBWallet) await logTransaction(supabase, wagerId, 'escrow_deposit', playerBWallet, stakeLamports, txSignature ?? null);
                return respond({ success: true });
            }

            // ── refund_cancelled ──────────────────────────────────────────────────
            case 'refund_cancelled': {
                const { matchId, playerAWallet, playerBWallet, wagerId, stakeLamports, cancelledBy, reason } = body;
                if (!matchId || !playerAWallet) throw new Error('Missing: matchId, playerAWallet');

                const playerAPubkey = new PublicKey(playerAWallet);
                const playerBPubkey = playerBWallet ? new PublicKey(playerBWallet) : null;
                const platformPubkey = new PublicKey(PLATFORM_WALLET);
                const wagerPda = await deriveWagerPda(playerAWallet, BigInt(matchId));

                console.log(`Cancelled wager refund PDA: ${wagerPda.toBase58()} | Reason: ${reason}`);

                const pdaBalance = await connection.getBalance(wagerPda);
                let txSig: string | null = null;

                if (pdaBalance > 0 && playerBPubkey) {
                    console.log(`PDA has ${pdaBalance} lamports - initiating on-chain refund`);
                    const ix = await buildCloseWagerIx(wagerPda, authority.publicKey, playerAPubkey, playerBPubkey, platformPubkey);
                    try {
                        txSig = await sendAndConfirm(connection, authority, ix);
                        console.log(`close_wager (cancelled) tx success: ${txSig}`);
                    } catch (onChainErr: unknown) {
                        const errorMsg = onChainErr instanceof Error ? onChainErr.message : String(onChainErr);
                        console.error('On-chain close_wager (cancelled) failed:', errorMsg);
                        if (wagerId) {
                            await logError(supabase, wagerId, 'on_chain_cancel_refund', errorMsg, {
                                walletAddress: cancelledBy,
                                wagerPda: wagerPda.toBase58(),
                                matchId,
                                pdaBalance,
                            });
                        }
                    }
                } else {
                    console.log(`No on-chain funds to refund (PDA balance: ${pdaBalance})`);
                }

                if (wagerId) {
                    const { data: wager } = await supabase.from('wagers').select('status').eq('id', wagerId).single();
                    if (wager?.status !== 'cancelled') {
                        await supabase.from('wagers').update({
                            status: 'cancelled',
                            cancelled_at: new Date().toISOString(),
                            cancelled_by: cancelledBy,
                            cancel_reason: reason,
                        }).eq('id', wagerId);
                    }

                    const stake = stakeLamports || 0;
                    if (pdaBalance > 0) {
                        await logTransaction(supabase, wagerId, 'cancel_refund', playerAWallet, stake, txSig);
                        if (playerBWallet) {
                            await logTransaction(supabase, wagerId, 'cancel_refund', playerBWallet, stake, txSig);
                        }
                    }
                }

                return respond({
                    success: true,
                    txSignature: txSig,
                    refunded: pdaBalance > 0,
                    pdaBalance,
                    explorerUrl: txSig ? `https://explorer.solana.com/tx/${txSig}?cluster=devnet` : null,
                });
            }

            // ── ban_player ────────────────────────────────────────────────────────
            case 'ban_player': {
                const { playerPubkey, banDurationSeconds } = body;
                if (!playerPubkey || !banDurationSeconds) throw new Error('Missing playerPubkey or banDurationSeconds');
                const banExpiresAt = new Date(Date.now() + banDurationSeconds * 1000);
                const { error } = await supabase.from('players')
                    .update({ is_banned: true, ban_expires_at: banExpiresAt.toISOString() })
                    .eq('wallet_address', playerPubkey);
                if (error) throw error;
                return respond({ success: true, banExpiresAt: banExpiresAt.toISOString() });
            }

            default:
                throw new Error(`Unknown action: ${body.action}`);
        }

    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('resolve-wager error:', msg);
        return respond({ success: false, error: msg }, 500);
    }
});