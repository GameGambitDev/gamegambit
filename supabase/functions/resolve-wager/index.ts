// supabase/functions/resolve-wager/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.2";
import {
    Connection,
    Keypair,
    PublicKey,
    Transaction,
    TransactionInstruction,
    SystemProgram,
    LAMPORTS_PER_SOL,
} from "https://esm.sh/@solana/web3.js@1.98.0";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

// ── Constants (must match lib.rs) ─────────────────────────────────────────────
const PROGRAM_ID = "E2Vd3U91kMrgwp8JCXcLSn7bt3NowDmGwoBYsVRhGfMR";
const PLATFORM_WALLET = "3hwPwugeuZ33HWJ3SoJkDN2JT3Be9fH62r19ezFiCgYY";
const PLATFORM_FEE_BPS = 1000;   // 10%
const MODERATOR_FEE_SHARE = 0.40;

// Discriminators from IDL
const DISCRIMINATORS = {
    resolve_wager: [31, 179, 1, 228, 83, 224, 1, 123],
    close_wager: [167, 240, 85, 147, 127, 50, 69, 203],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function loadAuthorityKeypair(secret: string): Keypair {
    const arr = JSON.parse(secret);
    return Keypair.fromSecretKey(Uint8Array.from(arr));
}

function deriveWagerPda(playerA: PublicKey, matchId: bigint): PublicKey {
    const matchIdBytes = new Uint8Array(8);
    const view = new DataView(matchIdBytes.buffer);
    view.setBigUint64(0, matchId, true); // little-endian
    const [pda] = PublicKey.findProgramAddressSync(
        [new TextEncoder().encode("wager"), playerA.toBytes(), matchIdBytes],
        new PublicKey(PROGRAM_ID)
    );
    return pda;
}

function buildResolveWagerIx(
    wagerPda: PublicKey,
    authority: PublicKey,
    winner: PublicKey,
    platformWallet: PublicKey,
): TransactionInstruction {
    // resolve_wager accounts — matches ResolveWager struct in lib.rs:
    //   wager, winner, authorizer (signer), platform_wallet, system_program
    // Args: winner pubkey (32 bytes)
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

function buildCloseWagerIx(
    wagerPda: PublicKey,
    authority: PublicKey,
    playerA: PublicKey,
    playerB: PublicKey,
    platformWallet: PublicKey,
): TransactionInstruction {
    // close_wager accounts (draw refund):
    // close_wager accounts — matches CloseWager struct in lib.rs:
    //   wager (writable, closes to authorizer), player_a (writable), player_b (writable), authorizer (signer, writable), system_program
    // No args needed
    return new TransactionInstruction({
        programId: new PublicKey(PROGRAM_ID),
        keys: [
            { pubkey: wagerPda,                isSigner: false, isWritable: true },
            { pubkey: playerA,                 isSigner: false, isWritable: true },
            { pubkey: playerB,                 isSigner: false, isWritable: true },
            { pubkey: authority,               isSigner: true,  isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: new Uint8Array(DISCRIMINATORS.close_wager),
    });
}

async function sendAndConfirm(
    connection: Connection,
    authority: Keypair,
    instruction: TransactionInstruction,
): Promise<string> {
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

// ── Main ──────────────────────────────────────────────────────────────────────

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    const respond = (body: unknown, status = 200) =>
        new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        // Secret name matches what you set in Supabase dashboard
        const authoritySecret = Deno.env.get('AUTHORITY_WALLET_SECRET')!;
        const rpcUrl = Deno.env.get('SOLANA_RPC_URL') || 'https://api.devnet.solana.com';

        if (!authoritySecret) throw new Error('AUTHORITY_WALLET_SECRET not configured');

        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const connection = new Connection(rpcUrl, 'confirmed');
        const authority = loadAuthorityKeypair(authoritySecret);

        console.log(`📥 resolve-wager — authority: ${authority.publicKey.toBase58()}`);

        const body = await req.json();
        console.log('Action:', body.action);

        switch (body.action) {

            // ── resolve_wager: winner takes 90%, platform takes 10% ──────────────
            case 'resolve_wager': {
                const { matchId, playerAWallet, playerBWallet, winnerWallet, wagerId, stakeLamports, moderatorWallet } = body;
                if (!matchId || !playerAWallet || !winnerWallet)
                    throw new Error('Missing: matchId, playerAWallet, winnerWallet');

                const playerAPubkey = new PublicKey(playerAWallet);
                const winnerPubkey = new PublicKey(winnerWallet);
                const platformPubkey = new PublicKey(PLATFORM_WALLET);
                const wagerPda = deriveWagerPda(playerAPubkey, BigInt(matchId));

                console.log(`🎮 Resolving wager PDA: ${wagerPda.toBase58()} → winner: ${winnerWallet}`);

                // Build + sign + send on-chain resolve_wager instruction
                const ix = buildResolveWagerIx(wagerPda, authority.publicKey, winnerPubkey, platformPubkey);
                let txSig: string | null = null;
                try {
                    txSig = await sendAndConfirm(connection, authority, ix);
                    console.log(`resolve_wager tx success: ${txSig}`);
                } catch (onChainErr: any) {
                    // Log error with full context for debugging
                    const errorMsg = onChainErr?.message || String(onChainErr);
                    console.error('On-chain resolve_wager failed:', errorMsg);
                    
                    // Log the failure to transactions table
                    if (wagerId) {
                        await logError(supabase, wagerId, 'on_chain_resolve', errorMsg, {
                            walletAddress: winnerWallet,
                            wagerPda: wagerPda.toBase58(),
                            matchId,
                        });
                    }
                }

                // Update DB
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

                    // Update player stats
                    await supabase.rpc('update_winner_stats', { p_wallet: winnerWallet, p_stake: stake, p_earnings: winnerPayout })
                        .then(({ error }) => error && console.log('⚠️ winner stats:', error.message));
                    if (loserWallet) {
                        await supabase.rpc('update_loser_stats', { p_wallet: loserWallet, p_stake: stake })
                            .then(({ error }) => error && console.log('⚠️ loser stats:', error.message));
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

            // ── refund_draw: close_wager returns funds to both players ────────────
            case 'refund_draw': {
                const { matchId, playerAWallet, playerBWallet, wagerId, stakeLamports } = body;
                if (!matchId || !playerAWallet || !playerBWallet)
                    throw new Error('Missing: matchId, playerAWallet, playerBWallet');

                const playerAPubkey = new PublicKey(playerAWallet);
                const playerBPubkey = new PublicKey(playerBWallet);
                const platformPubkey = new PublicKey(PLATFORM_WALLET);
                const wagerPda = deriveWagerPda(playerAPubkey, BigInt(matchId));

                console.log(`🤝 Draw refund PDA: ${wagerPda.toBase58()}`);

                const ix = buildCloseWagerIx(wagerPda, authority.publicKey, playerAPubkey, playerBPubkey, platformPubkey);
                let txSig: string | null = null;
                try {
                    txSig = await sendAndConfirm(connection, authority, ix);
                    console.log(`close_wager (draw) tx success: ${txSig}`);
                } catch (onChainErr: any) {
                    const errorMsg = onChainErr?.message || String(onChainErr);
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

            // ── get_balance: check authority wallet balance ───────────────────────
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

            // ── record_escrow: log deposit txs ────────────────────────────────────
            case 'record_escrow': {
                const { wagerId, playerAWallet, playerBWallet, stakeLamports, txSignature } = body;
                if (!wagerId || !stakeLamports) throw new Error('Missing wagerId or stakeLamports');
                if (playerAWallet) await logTransaction(supabase, wagerId, 'escrow_deposit', playerAWallet, stakeLamports, txSignature ?? null);
                if (playerBWallet) await logTransaction(supabase, wagerId, 'escrow_deposit', playerBWallet, stakeLamports, txSignature ?? null);
                return respond({ success: true });
            }

            // ── refund_cancelled: refund both players when wager is cancelled ─────
            case 'refund_cancelled': {
                const { matchId, playerAWallet, playerBWallet, wagerId, stakeLamports, cancelledBy, reason } = body;
                if (!matchId || !playerAWallet) throw new Error('Missing: matchId, playerAWallet');

                const playerAPubkey = new PublicKey(playerAWallet);
                const playerBPubkey = playerBWallet ? new PublicKey(playerBWallet) : null;
                const platformPubkey = new PublicKey(PLATFORM_WALLET);
                const wagerPda = deriveWagerPda(playerAPubkey, BigInt(matchId));

                console.log(`Cancelled wager refund PDA: ${wagerPda.toBase58()} | Reason: ${reason}`);

                // Check if PDA has funds (only if on-chain deposits were made)
                const pdaBalance = await connection.getBalance(wagerPda);
                let txSig: string | null = null;

                if (pdaBalance > 0 && playerBPubkey) {
                    // Funds exist on-chain, use close_wager to refund both players
                    console.log(`PDA has ${pdaBalance} lamports - initiating on-chain refund`);
                    const ix = buildCloseWagerIx(wagerPda, authority.publicKey, playerAPubkey, playerBPubkey, platformPubkey);
                    try {
                        txSig = await sendAndConfirm(connection, authority, ix);
                        console.log(`close_wager (cancelled) tx success: ${txSig}`);
                    } catch (onChainErr: any) {
                        const errorMsg = onChainErr?.message || String(onChainErr);
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

                // Update wager status in DB if not already done
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

                    // Log refund transactions
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
        console.error('❌ resolve-wager error:', msg);
        return respond({ success: false, error: msg }, 500);
    }
});
