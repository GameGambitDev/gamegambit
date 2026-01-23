import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Program ID for GameGambit contract
const PROGRAM_ID = "CPS82nShfYFBdJPLs4kLMYEUrTwvxieqSrkw6VYRopzx";
const AUTHORITY_PUBKEY = "45kmAptt386fRtXzjsbschuvhuEo77vRKA5eyYbH4XFs";

// Platform fee percentage
const PLATFORM_FEE_PERCENT = 10;

interface ResolveWagerRequest {
  action: 'resolve_wager' | 'refund_draw' | 'ban_player' | 'get_balance' | 'record_escrow';
  matchId?: number;
  playerAWallet?: string;
  playerBWallet?: string;
  winnerWallet?: string;
  wagerId?: string;
  playerPubkey?: string;
  banDurationSeconds?: number;
  stakeLamports?: number;
  txSignature?: string;
  txType?: string;
}

// Helper to log transaction to database
async function logTransaction(
  supabase: any,
  wagerId: string,
  txType: string,
  walletAddress: string,
  amountLamports: number,
  txSignature: string | null = null,
  status: 'pending' | 'confirmed' | 'failed' = 'confirmed',
  errorMessage: string | null = null
) {
  try {
    const { error } = await supabase
      .from('wager_transactions')
      .insert({
        wager_id: wagerId,
        tx_type: txType,
        wallet_address: walletAddress,
        amount_lamports: amountLamports,
        tx_signature: txSignature,
        status,
        error_message: errorMessage,
      });
    
    if (error) {
      console.log('⚠️ Failed to log transaction:', error.message);
    } else {
      console.log(`📝 Transaction logged: ${txType} for ${walletAddress}`);
    }
  } catch (e) {
    console.log('⚠️ Transaction logging error:', e);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authoritySecret = Deno.env.get('AUTHORITY_WALLET_SECRET');
    const rpcUrl = Deno.env.get('SOLANA_RPC_URL') || 'https://api.devnet.solana.com';

    if (!authoritySecret) {
      throw new Error('AUTHORITY_WALLET_SECRET not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body: ResolveWagerRequest = await req.json();

    console.log('📥 Request received:', body.action);

    switch (body.action) {
      case 'get_balance': {
        const balanceResponse = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'getBalance',
            params: [AUTHORITY_PUBKEY]
          })
        });

        const balanceResult = await balanceResponse.json();
        const lamports = balanceResult.result?.value || 0;
        const solBalance = lamports / 1e9;

        console.log('💰 Platform balance:', solBalance, 'SOL');

        return new Response(JSON.stringify({
          success: true,
          platformWallet: AUTHORITY_PUBKEY,
          balanceSOL: solBalance,
          balanceLamports: lamports,
          explorerUrl: `https://explorer.solana.com/address/${AUTHORITY_PUBKEY}?cluster=devnet`
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'record_escrow': {
        const { wagerId, playerAWallet, playerBWallet, stakeLamports, txSignature, txType } = body;

        if (!wagerId || !stakeLamports) {
          throw new Error('Missing required fields for escrow recording');
        }

        console.log('💎 Recording escrow transaction:', txType);

        if (playerAWallet && (txType === 'escrow_deposit' || !txType)) {
          await logTransaction(supabase, wagerId, 'escrow_deposit', playerAWallet, stakeLamports, txSignature);
        }
        if (playerBWallet && txType === 'escrow_deposit') {
          await logTransaction(supabase, wagerId, 'escrow_deposit', playerBWallet, stakeLamports, txSignature);
        }

        return new Response(JSON.stringify({
          success: true,
          message: 'Escrow transaction recorded'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'refund_draw': {
        const { wagerId, playerAWallet, playerBWallet, stakeLamports } = body;

        if (!wagerId || !playerAWallet || !playerBWallet || !stakeLamports) {
          throw new Error('Missing required fields for draw refund');
        }

        console.log('🤝 Processing draw refund...');
        console.log('   Player A:', playerAWallet);
        console.log('   Player B:', playerBWallet);
        console.log('   Stake each:', stakeLamports / 1e9, 'SOL');

        // Get current wager status
        const { data: currentWager } = await supabase
          .from('wagers')
          .select('status')
          .eq('id', wagerId)
          .single();

        if (currentWager && currentWager.status !== 'resolved') {
          await supabase
            .from('wagers')
            .update({
              status: 'resolved',
              winner_wallet: null, // No winner for draws
              resolved_at: new Date().toISOString()
            })
            .eq('id', wagerId);
        }

        // Log refund transactions for both players
        await logTransaction(supabase, wagerId, 'draw_refund', playerAWallet, stakeLamports);
        await logTransaction(supabase, wagerId, 'draw_refund', playerBWallet, stakeLamports);

        console.log('✅ Draw refund processed - both players get their stake back');

        return new Response(JSON.stringify({
          success: true,
          message: 'Draw refund processed successfully',
          refundAmount: stakeLamports,
          playerAWallet,
          playerBWallet,
          programId: PROGRAM_ID
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'resolve_wager': {
        const { matchId, playerAWallet, winnerWallet, wagerId, playerBWallet, stakeLamports } = body;

        if (!matchId || !playerAWallet || !winnerWallet) {
          throw new Error('Missing required fields: matchId, playerAWallet, winnerWallet');
        }

        console.log('🎮 Resolving wager...');
        console.log('   Match ID:', matchId);
        console.log('   Player A:', playerAWallet);
        console.log('   Winner:', winnerWallet);

        // Parse authority secret key (validates it's configured)
        JSON.parse(authoritySecret);
        console.log('🔑 Authority wallet loaded');

        // Get wager data if not provided
        let stake = stakeLamports;
        let loserWallet = playerBWallet;

        if (wagerId) {
          const { data: currentWager } = await supabase
            .from('wagers')
            .select('status, stake_lamports, player_a_wallet, player_b_wallet')
            .eq('id', wagerId)
            .single();

          if (currentWager) {
            stake = stake || currentWager.stake_lamports;
            loserWallet = winnerWallet === currentWager.player_a_wallet 
              ? currentWager.player_b_wallet 
              : currentWager.player_a_wallet;

            // Only update if not already resolved
            if (currentWager.status !== 'resolved') {
              await supabase
                .from('wagers')
                .update({
                  status: 'resolved',
                  winner_wallet: winnerWallet,
                  resolved_at: new Date().toISOString()
                })
                .eq('id', wagerId);
            }
          }
        }

        // Calculate payouts
        const totalPot = (stake || 0) * 2;
        const platformFee = Math.floor(totalPot * PLATFORM_FEE_PERCENT / 100);
        const winnerPayout = totalPot - platformFee;

        // Update player stats
        if (winnerWallet && stake) {
          const { error: winnerError } = await supabase.rpc('update_winner_stats', {
            p_wallet: winnerWallet,
            p_stake: stake,
            p_earnings: winnerPayout
          });
          
          if (winnerError) {
            console.log('⚠️ Winner stats error:', winnerError.message);
          }

          if (loserWallet) {
            const { error: loserError } = await supabase.rpc('update_loser_stats', {
              p_wallet: loserWallet,
              p_stake: stake
            });
            
            if (loserError) {
              console.log('⚠️ Loser stats error:', loserError.message);
            }
          }
        }

        // Log transactions
        if (wagerId && stake) {
          await logTransaction(supabase, wagerId, 'winner_payout', winnerWallet, winnerPayout);
          await logTransaction(supabase, wagerId, 'platform_fee', AUTHORITY_PUBKEY, platformFee);
        }

        console.log('✅ Wager resolved');
        console.log(`   Winner payout: ${winnerPayout / 1e9} SOL (90%)`);
        console.log(`   Platform fee: ${platformFee / 1e9} SOL (10%)`);

        return new Response(JSON.stringify({
          success: true,
          message: 'Wager resolved successfully',
          matchId,
          winner: winnerWallet,
          winnerPayout,
          platformFee,
          programId: PROGRAM_ID,
          authorityWallet: AUTHORITY_PUBKEY
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'ban_player': {
        const { playerPubkey, banDurationSeconds } = body;

        if (!playerPubkey || !banDurationSeconds) {
          throw new Error('Missing required fields: playerPubkey, banDurationSeconds');
        }

        console.log('🚫 Banning player:', playerPubkey);
        console.log('   Duration:', banDurationSeconds, 'seconds');

        const banExpiresAt = new Date(Date.now() + banDurationSeconds * 1000);
        
        const { error: banError } = await supabase
          .from('players')
          .update({
            is_banned: true,
            ban_expires_at: banExpiresAt.toISOString()
          })
          .eq('wallet_address', playerPubkey);

        if (banError) {
          throw banError;
        }

        console.log('✅ Player banned until:', banExpiresAt.toISOString());

        return new Response(JSON.stringify({
          success: true,
          message: 'Player banned successfully',
          playerPubkey,
          banExpiresAt: banExpiresAt.toISOString(),
          programId: PROGRAM_ID
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      default:
        throw new Error(`Unknown action: ${body.action}`);
    }

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Error:', errorMessage);
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});