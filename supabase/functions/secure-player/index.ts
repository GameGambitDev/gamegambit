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

    // Check expiry
    if (payload.exp < Date.now()) {
      console.log('[secure-player] Session token expired');
      return null;
    }

    // Verify hash
    const encoder = new TextEncoder();
    const data = encoder.encode(payloadStr);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const computedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    if (computedHash !== hash) {
      console.log('[secure-player] Invalid session token hash');
      return null;
    }

    return payload.wallet;
  } catch (error) {
    console.error('[secure-player] Token validation error:', error);
    return null;
  }
}

// Validate username format
function validateUsername(username: string): boolean {
  if (!username || username.length < 1 || username.length > 50) return false;
  return /^[a-zA-Z0-9_-]+$/.test(username);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const sessionToken = req.headers.get('x-wallet-session');
    const { action, ...data } = await req.json();
    console.log(`[secure-player] Action: ${action}`);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // CREATE PLAYER - requires session token
    if (action === 'create') {
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

      // Check if player already exists
      const { data: existingPlayer } = await supabase
        .from('players')
        .select('id')
        .eq('wallet_address', walletAddress)
        .single();

      if (existingPlayer) {
        return new Response(JSON.stringify({ error: 'Player already exists' }), {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: newPlayer, error } = await supabase
        .from('players')
        .insert({ wallet_address: walletAddress })
        .select()
        .single();

      if (error) {
        console.error('[secure-player] Create error:', error);
        return new Response(JSON.stringify({ error: 'Failed to create player' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`[secure-player] Created player for wallet: ${walletAddress}`);
      return new Response(JSON.stringify({ player: newPlayer }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // UPDATE PLAYER - requires session token
    if (action === 'update') {
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

      const { updates } = data;
      
      // Validate usernames if provided
      if (updates.lichess_username && !validateUsername(updates.lichess_username)) {
        return new Response(JSON.stringify({ error: 'Invalid Lichess username format' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (updates.codm_username && !validateUsername(updates.codm_username)) {
        return new Response(JSON.stringify({ error: 'Invalid CODM username format' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (updates.pubg_username && !validateUsername(updates.pubg_username)) {
        return new Response(JSON.stringify({ error: 'Invalid PUBG username format' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Only allow safe fields to be updated
      const safeUpdates: Record<string, unknown> = {};
      if (updates.lichess_username !== undefined) safeUpdates.lichess_username = updates.lichess_username;
      if (updates.codm_username !== undefined) safeUpdates.codm_username = updates.codm_username;
      if (updates.pubg_username !== undefined) safeUpdates.pubg_username = updates.pubg_username;

      const { data: updatedPlayer, error } = await supabase
        .from('players')
        .update(safeUpdates)
        .eq('wallet_address', walletAddress)
        .select()
        .single();

      if (error) {
        console.error('[secure-player] Update error:', error);
        return new Response(JSON.stringify({ error: 'Failed to update player' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`[secure-player] Updated player for wallet: ${walletAddress}`);
      return new Response(JSON.stringify({ player: updatedPlayer }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[secure-player] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
