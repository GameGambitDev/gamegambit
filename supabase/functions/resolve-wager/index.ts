import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Program ID for GameGambit contract
const PROGRAM_ID = "CPS82nShfYFBdJPLs4kLMYEUrTwvxieqSrkw6VYRopzx";
const AUTHORITY_PUBKEY = "45kmAptt386fRtXzjsbschuvhuEo77vRKA5eyYbH4XFs";

// Instruction discriminators from IDL
const DISCRIMINATORS = {
  resolve_wager: [31, 179, 1, 228, 83, 224, 1, 123],
  ban_player: [20, 123, 183, 191, 29, 55, 244, 21],
  close_wager: [167, 240, 85, 147, 127, 50, 69, 203],
};

interface ResolveWagerRequest {
  action: 'resolve_wager' | 'ban_player' | 'get_balance';
  matchId?: number;
  playerAWallet?: string;
  winnerWallet?: string;
  wagerId?: string;
  playerPubkey?: string;
  banDurationSeconds?: number;
}

// Helper to derive wager PDA
function deriveWagerPda(playerA: string, matchId: number): string {
  // Note: For actual PDA derivation, we'd need full Solana SDK
  // This is a placeholder - the actual derivation happens client-side
  console.log(`Deriving wager PDA for player ${playerA}, match ${matchId}`);
  return `wager_pda_${playerA}_${matchId}`;
}

// Helper to build resolve instruction data
function buildResolveInstructionData(winnerPubkey: string): Uint8Array {
  // Discriminator (8 bytes) + pubkey (32 bytes)
  const data = new Uint8Array(40);
  
  // Add discriminator
  DISCRIMINATORS.resolve_wager.forEach((byte, i) => {
    data[i] = byte;
  });
  
  // Add winner pubkey (base58 decode would be needed for real implementation)
  console.log(`Building resolve instruction for winner: ${winnerPubkey}`);
  
  return data;
}

serve(async (req) => {
  // Handle CORS preflight
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
        // Check platform wallet balance via RPC
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

      case 'resolve_wager': {
        const { matchId, playerAWallet, winnerWallet, wagerId } = body;

        if (!matchId || !playerAWallet || !winnerWallet) {
          throw new Error('Missing required fields: matchId, playerAWallet, winnerWallet');
        }

        console.log('🎮 Resolving wager on-chain...');
        console.log('   Match ID:', matchId);
        console.log('   Player A:', playerAWallet);
        console.log('   Winner:', winnerWallet);

        // Parse authority secret key
        const secretKeyArray = JSON.parse(authoritySecret);
        console.log('🔑 Authority wallet loaded');

        // Build the transaction using Solana JSON-RPC
        // Step 1: Get recent blockhash
        const blockhashResponse = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'getLatestBlockhash',
            params: [{ commitment: 'finalized' }]
          })
        });
        
        const blockhashResult = await blockhashResponse.json();
        const recentBlockhash = blockhashResult.result?.value?.blockhash;

        if (!recentBlockhash) {
          throw new Error('Failed to get recent blockhash');
        }

        console.log('📦 Blockhash:', recentBlockhash);

        // For now, update database status and log intent
        // Full on-chain resolution requires proper Anchor client setup
        // which is complex in Deno environment

        // Update wager in database (only if not already resolved)
        if (wagerId) {
          // First check current status
          const { data: currentWager } = await supabase
            .from('wagers')
            .select('status, stake_lamports, player_a_wallet, player_b_wallet')
            .eq('id', wagerId)
            .single();

          // Only update if not already resolved (secure-wager may have already updated it)
          if (currentWager && currentWager.status !== 'resolved') {
            const { error: updateError } = await supabase
              .from('wagers')
              .update({
                status: 'resolved',
                winner_wallet: winnerWallet,
                resolved_at: new Date().toISOString()
              })
              .eq('id', wagerId);

            if (updateError) {
              console.error('❌ Database update error:', updateError);
              throw updateError;
            }
          }

          // Always update player stats (handles the payout calculation)
          if (currentWager) {
            const stake = currentWager.stake_lamports;
            const totalPot = stake * 2;
            const platformFee = Math.floor(totalPot * 0.1); // 10% fee
            const winnerPayout = totalPot - platformFee;

            // Update winner stats
            const { error: winnerError } = await supabase.rpc('update_winner_stats', {
              p_wallet: winnerWallet,
              p_stake: stake,
              p_earnings: winnerPayout
            });
            
            if (winnerError) {
              console.log('⚠️ Winner stats update error (may already be updated):', winnerError.message);
            }

            // Update loser stats
            const loserWallet = winnerWallet === currentWager.player_a_wallet 
              ? currentWager.player_b_wallet 
              : currentWager.player_a_wallet;

            if (loserWallet) {
              const { error: loserError } = await supabase.rpc('update_loser_stats', {
                p_wallet: loserWallet,
                p_stake: stake
              });
              
              if (loserError) {
                console.log('⚠️ Loser stats update error (may already be updated):', loserError.message);
              }
            }

            console.log('✅ Player stats updated');
            console.log(`   Winner payout: ${winnerPayout / 1e9} SOL (90%)`);
            console.log(`   Platform fee: ${platformFee / 1e9} SOL (10%)`);
          }
        }

        // Log the on-chain transaction intent
        console.log('📝 On-chain resolution logged');
        console.log('   Program:', PROGRAM_ID);
        console.log('   Authority:', AUTHORITY_PUBKEY);

        return new Response(JSON.stringify({
          success: true,
          message: 'Wager resolved successfully',
          matchId,
          winner: winnerWallet,
          programId: PROGRAM_ID,
          authorityWallet: AUTHORITY_PUBKEY,
          note: 'Database updated, on-chain transaction pending full Anchor integration'
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

        // Update player ban status in database
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
