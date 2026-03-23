// supabase/functions/resolve-wager/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.2";
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "https://esm.sh/@solana/web3.js@1.98.0";

import {
    PLATFORM_WALLET,
    PLATFORM_FEE_BPS,
    getRpcUrl,
    loadAuthorityKeypair,
    deriveWagerPda,
    buildResolveWagerIx,
    buildCloseWagerIx,
    sendAndConfirm,
    explorerTx,
} from "../_shared/solana.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

const MODERATOR_FEE_SHARE = 0.40;

// ── DB helpers ────────────────────────────────────────────────────────────────

async function logTransaction(
    supabase:        ReturnType<typeof createClient>,
    wagerId:         string,
    txType:          string,
    walletAddress:   string,
    amountLamports:  number,
    txSignature:     string | null  = null,
    status:          'pending' | 'confirmed' | 'failed' = 'confirmed',
    errorMessage:    string | null  = null,
) {
    try {
        await supabase.from('wager_transactions').insert({
            wager_id: wagerId, tx_type: txType, wallet_address: walletAddress,
            amount_lamports: amountLamports, tx_signature: txSignature,
            status, error_message: errorMessage, created_at: new Date().toISOString(),
        });
    } catch (e) { console.log('Transaction log error:', e); }
}

async function logError(
    supabase:      ReturnType<typeof createClient>,
    wagerId:       string,
    errorType:     string,
    errorMessage:  string,
    context:       Record<string, unknown> = {},
) {
    try {
        console.error(`[${errorType}] Wager ${wagerId}: ${errorMessage}`, context);
        await supabase.from('wager_transactions').insert({
            wager_id: wagerId, tx_type: `error_${errorType}`,
            wallet_address: (context.walletAddress as string) || 'system',
            amount_lamports: 0, status: 'failed',
            error_message: `${errorType}: ${errorMessage}`, created_at: new Date().toISOString(),
        });
    } catch (e) { console.log('Error log failed:', e); }
}

// ── Main ──────────────────────────────────────────────────────────────────────

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    const respond = (body: unknown, status = 200) =>
        new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    try {
        const supabaseUrl        = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const authoritySecret    = Deno.env.get('AUTHORITY_WALLET_SECRET')!;
        if (!authoritySecret) throw new Error('AUTHORITY_WALLET_SECRET not configured');

        const supabase  = createClient(supabaseUrl, supabaseServiceKey);
        const connection = new Connection(getRpcUrl(), 'confirmed');
        const authority  = loadAuthorityKeypair();

        console.log(`📥 resolve-wager — authority: ${authority.publicKey.toBase58()}`);

        const body = await req.json();
        console.log('Action:', body.action);

        switch (body.action) {

            // ── resolve_wager: winner 90%, platform 10% ──────────────────────
            case 'resolve_wager': {
                const { matchId, playerAWallet, winnerWallet, wagerId, stakeLamports, moderatorWallet } = body;
                if (!matchId || !playerAWallet || !winnerWallet)
                    throw new Error('Missing: matchId, playerAWallet, winnerWallet');

                const playerAPubkey  = new PublicKey(playerAWallet);
                const winnerPubkey   = new PublicKey(winnerWallet);
                const wagerPda       = deriveWagerPda(playerAPubkey, BigInt(matchId));

                console.log(`🎮 Resolving wager PDA: ${wagerPda.toBase58()} → winner: ${winnerWallet}`);

                const ix = buildResolveWagerIx(wagerPda, authority.publicKey, winnerPubkey);
                let txSig: string | null = null;
                try {
                    txSig = await sendAndConfirm(connection, authority, ix);
                    console.log(`resolve_wager tx success: ${txSig}`);
                } catch (onChainErr: any) {
                    const errorMsg = onChainErr?.message || String(onChainErr);
                    console.error('On-chain resolve_wager failed:', errorMsg);
                    if (wagerId) await logError(supabase, wagerId, 'on_chain_resolve', errorMsg, { walletAddress: winnerWallet, wagerPda: wagerPda.toBase58(), matchId });
                }

                if (wagerId) {
                    const { data: wager } = await supabase.from('wagers')
                        .select('status,stake_lamports,player_a_wallet,player_b_wallet').eq('id', wagerId).single();

                    const stake         = stakeLamports || wager?.stake_lamports || 0;
                    const totalPot      = stake * 2;
                    const platformFee   = Math.floor(totalPot * PLATFORM_FEE_BPS / 10_000);
                    const winnerPayout  = totalPot - platformFee;
                    const moderatorCut  = moderatorWallet ? Math.floor(platformFee * MODERATOR_FEE_SHARE) : 0;
                    const netPlatform   = platformFee - moderatorCut;
                    const loserWallet   = winnerWallet === wager?.player_a_wallet ? wager?.player_b_wallet : wager?.player_a_wallet;

                    if (wager?.status !== 'resolved') {
                        await supabase.from('wagers').update({ status: 'resolved', winner_wallet: winnerWallet, resolved_at: new Date().toISOString() }).eq('id', wagerId);
                    }

                    await supabase.rpc('update_winner_stats', { p_wallet: winnerWallet, p_stake: stake, p_earnings: winnerPayout })
                        .then(({ error }) => error && console.log('⚠️ winner stats:', error.message));
                    if (loserWallet) {
                        await supabase.rpc('update_loser_stats', { p_wallet: loserWallet, p_stake: stake })
                            .then(({ error }) => error && console.log('⚠️ loser stats:', error.message));
                    }

                    await logTransaction(supabase, wagerId, 'winner_payout', winnerWallet, winnerPayout, txSig);
                    await logTransaction(supabase, wagerId, 'platform_fee', PLATFORM_WALLET.toBase58(), netPlatform, txSig);
                    if (moderatorWallet && moderatorCut > 0) {
                        await logTransaction(supabase, wagerId, 'moderator_fee', moderatorWallet, moderatorCut, txSig);
                    }

                    return respond({
                        success: true, txSignature: txSig,
                        winner: winnerWallet, winnerPayout, platformFee: netPlatform, moderatorCut,
                        explorerUrl: txSig ? explorerTx(txSig) : null,
                    });
                }

                return respond({ success: true, txSignature: txSig });
            }

            // ── refund_draw: close_wager returns funds to both players ────────
            case 'refund_draw': {
                const { matchId, playerAWallet, playerBWallet, wagerId, stakeLamports } = body;
                if (!matchId || !playerAWallet || !playerBWallet)
                    throw new Error('Missing: matchId, playerAWallet, playerBWallet');

                const playerAPubkey = new PublicKey(playerAWallet);
                const playerBPubkey = new PublicKey(playerBWallet);
                const wagerPda      = deriveWagerPda(playerAPubkey, BigInt(matchId));

                console.log(`🤝 Draw refund PDA: ${wagerPda.toBase58()}`);

                const ix = buildCloseWagerIx(wagerPda, authority.publicKey, playerAPubkey, playerBPubkey);
                let txSig: string | null = null;
                try {
                    txSig = await sendAndConfirm(connection, authority, ix);
                    console.log(`close_wager (draw) tx success: ${txSig}`);
                } catch (onChainErr: any) {
                    const errorMsg = onChainErr?.message || String(onChainErr);
                    console.error('On-chain close_wager (draw) failed:', errorMsg);
                    if (wagerId) await logError(supabase, wagerId, 'on_chain_draw_refund', errorMsg, { walletAddress: playerAWallet, wagerPda: wagerPda.toBase58(), matchId });
                }

                if (wagerId) {
                    const stake = stakeLamports || 0;
                    const { data: wager } = await supabase.from('wagers').select('status').eq('id', wagerId).single();
                    if (wager?.status !== 'resolved') {
                        await supabase.from('wagers').update({ status: 'resolved', winner_wallet: null, resolved_at: new Date().toISOString() }).eq('id', wagerId);
                    }
                    await logTransaction(supabase, wagerId, 'draw_refund', playerAWallet, stake, txSig);
                    await logTransaction(supabase, wagerId, 'draw_refund', playerBWallet, stake, txSig);
                }

                return respond({ success: true, txSignature: txSig, explorerUrl: txSig ? explorerTx(txSig) : null });
            }

            // ── refund_cancelled ──────────────────────────────────────────────
            case 'refund_cancelled': {
                const { matchId, playerAWallet, playerBWallet, wagerId, stakeLamports, cancelledBy, reason } = body;
                if (!matchId || !playerAWallet) throw new Error('Missing: matchId, playerAWallet');

                const playerAPubkey = new PublicKey(playerAWallet);
                const playerBPubkey = playerBWallet ? new PublicKey(playerBWallet) : null;
                const wagerPda      = deriveWagerPda(playerAPubkey, BigInt(matchId));

                console.log(`Cancelled wager refund PDA: ${wagerPda.toBase58()} | Reason: ${reason}`);

                const pdaBalance = await connection.getBalance(wagerPda);
                let txSig: string | null = null;

                if (pdaBalance > 0 && playerBPubkey) {
                    console.log(`PDA has ${pdaBalance} lamports - initiating on-chain refund`);
                    const ix = buildCloseWagerIx(wagerPda, authority.publicKey, playerAPubkey, playerBPubkey);
                    try {
                        txSig = await sendAndConfirm(connection, authority, ix);
                        console.log(`close_wager (cancelled) tx success: ${txSig}`);
                    } catch (onChainErr: any) {
                        const errorMsg = onChainErr?.message || String(onChainErr);
                        console.error('On-chain close_wager (cancelled) failed:', errorMsg);
                        if (wagerId) await logError(supabase, wagerId, 'on_chain_cancel_refund', errorMsg, { walletAddress: cancelledBy, wagerPda: wagerPda.toBase58(), matchId, pdaBalance });
                    }
                } else {
                    console.log(`No on-chain funds to refund (PDA balance: ${pdaBalance})`);
                }

                if (wagerId) {
                    const { data: wager } = await supabase.from('wagers').select('status').eq('id', wagerId).single();
                    if (wager?.status !== 'cancelled') {
                        await supabase.from('wagers').update({ status: 'cancelled', cancelled_at: new Date().toISOString(), cancelled_by: cancelledBy, cancel_reason: reason }).eq('id', wagerId);
                    }
                    const stake = stakeLamports || 0;
                    if (pdaBalance > 0) {
                        await logTransaction(supabase, wagerId, 'cancel_refund', playerAWallet, stake, txSig);
                        if (playerBWallet) await logTransaction(supabase, wagerId, 'cancel_refund', playerBWallet, stake, txSig);
                    }
                }

                return respond({ success: true, txSignature: txSig, refunded: pdaBalance > 0, pdaBalance, explorerUrl: txSig ? explorerTx(txSig) : null });
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
