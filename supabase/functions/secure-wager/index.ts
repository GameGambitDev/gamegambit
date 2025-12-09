import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wallet-session',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Validate session token and extract wallet address
async function validateSessionToken(token: string): Promise<string | null> {
  try {
    const [payloadB64, hash] = token.split('.');
    if (!payloadB64 || !hash) return null;

    const payloadStr = atob(payloadB64);
    const payload = JSON.parse(payloadStr);

    if (payload.exp < Date.now()) {
      console.log('[secure-wager] Session token expired');
      return null;
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(payloadStr);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const computedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    if (computedHash !== hash) {
      console.log('[secure-wager] Invalid session token hash');
      return null;
    }

    return payload.wallet;
  } catch (error) {
    console.error('[secure-wager] Token validation error:', error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const sessionToken = req.headers.get('x-wallet-session');
    const { action, ...data } = await req.json();
    console.log(`[secure-wager] Action: ${action}`);

    if (!sessionToken) {
      return new Response(JSON.stringify({ error: 'Wallet verification required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const walletAddress = await validateSessionToken(sessionToken);
    if (!walletAddress) {
      return new Response(JSON.stringify({ error: 'Invalid or expired session' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // CREATE WAGER
    if (action === 'create') {
      const { game, stake_lamports, lichess_game_id, is_public, stream_url } = data;

      // Validate required fields
      if (!game || !['chess', 'codm', 'pubg'].includes(game)) {
        return new Response(JSON.stringify({ error: 'Invalid game type' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!stake_lamports || stake_lamports <= 0) {
        return new Response(JSON.stringify({ error: 'Invalid stake amount' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Generate match_id
      const match_id = Date.now();

      const { data: newWager, error } = await supabase
        .from('wagers')
        .insert({
          match_id,
          player_a_wallet: walletAddress, // Server-verified wallet
          game,
          stake_lamports,
          lichess_game_id: lichess_game_id || null,
          is_public: is_public !== false,
          stream_url: stream_url || null,
        })
        .select()
        .single();

      if (error) {
        console.error('[secure-wager] Create error:', error);
        return new Response(JSON.stringify({ error: 'Failed to create wager' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`[secure-wager] Created wager ${newWager.id} by verified wallet: ${walletAddress}`);
      return new Response(JSON.stringify({ wager: newWager }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // JOIN WAGER
    if (action === 'join') {
      const { wagerId } = data;

      if (!wagerId) {
        return new Response(JSON.stringify({ error: 'Wager ID required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get the wager first
      const { data: wager, error: fetchError } = await supabase
        .from('wagers')
        .select('*')
        .eq('id', wagerId)
        .single();

      if (fetchError || !wager) {
        return new Response(JSON.stringify({ error: 'Wager not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Validate wager state
      if (wager.status !== 'created') {
        return new Response(JSON.stringify({ error: 'Wager is not available to join' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (wager.player_a_wallet === walletAddress) {
        return new Response(JSON.stringify({ error: 'Cannot join your own wager' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: updatedWager, error: updateError } = await supabase
        .from('wagers')
        .update({
          player_b_wallet: walletAddress, // Server-verified wallet
          status: 'joined',
        })
        .eq('id', wagerId)
        .eq('status', 'created') // Ensure still in created state
        .select()
        .single();

      if (updateError) {
        console.error('[secure-wager] Join error:', updateError);
        return new Response(JSON.stringify({ error: 'Failed to join wager' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`[secure-wager] Wager ${wagerId} joined by verified wallet: ${walletAddress}`);
      return new Response(JSON.stringify({ wager: updatedWager }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // SUBMIT VOTE
    if (action === 'vote') {
      const { wagerId, votedWinner } = data;

      if (!wagerId || !votedWinner) {
        return new Response(JSON.stringify({ error: 'Wager ID and voted winner required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get the wager
      const { data: wager, error: fetchError } = await supabase
        .from('wagers')
        .select('*')
        .eq('id', wagerId)
        .single();

      if (fetchError || !wager) {
        return new Response(JSON.stringify({ error: 'Wager not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Verify the voter is a participant
      const isPlayerA = wager.player_a_wallet === walletAddress;
      const isPlayerB = wager.player_b_wallet === walletAddress;

      if (!isPlayerA && !isPlayerB) {
        return new Response(JSON.stringify({ error: 'You are not a participant in this wager' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Validate voted winner is one of the participants
      if (votedWinner !== wager.player_a_wallet && votedWinner !== wager.player_b_wallet) {
        return new Response(JSON.stringify({ error: 'Invalid winner selection' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check if already voted
      if (isPlayerA && wager.vote_player_a) {
        return new Response(JSON.stringify({ error: 'You have already voted' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (isPlayerB && wager.vote_player_b) {
        return new Response(JSON.stringify({ error: 'You have already voted' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const updateData = isPlayerA
        ? { vote_player_a: votedWinner, vote_timestamp: new Date().toISOString(), status: 'voting' }
        : { vote_player_b: votedWinner, vote_timestamp: new Date().toISOString(), status: 'voting' };

      const { data: updatedWager, error: updateError } = await supabase
        .from('wagers')
        .update(updateData)
        .eq('id', wagerId)
        .select()
        .single();

      if (updateError) {
        console.error('[secure-wager] Vote error:', updateError);
        return new Response(JSON.stringify({ error: 'Failed to submit vote' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`[secure-wager] Vote submitted for wager ${wagerId} by verified wallet: ${walletAddress}`);
      return new Response(JSON.stringify({ wager: updatedWager }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[secure-wager] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
