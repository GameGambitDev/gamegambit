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

    // Must include the service key in hash computation (matching verify-wallet)
    const encoder = new TextEncoder();
    const data = encoder.encode(payloadStr + supabaseServiceKey);
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

    // EDIT WAGER
    if (action === 'edit') {
      const { wagerId, stake_lamports, lichess_game_id, stream_url, is_public } = data;

      if (!wagerId) {
        return new Response(JSON.stringify({ error: 'Wager ID required' }), {
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

      // Only owner can edit
      if (wager.player_a_wallet !== walletAddress) {
        return new Response(JSON.stringify({ error: 'Only the wager owner can edit' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const updateData: Record<string, any> = {};
      
      // Only allow certain edits based on status
      if (wager.status === 'created') {
        if (stake_lamports !== undefined) updateData.stake_lamports = stake_lamports;
        if (lichess_game_id !== undefined) updateData.lichess_game_id = lichess_game_id || null;
        if (is_public !== undefined) updateData.is_public = is_public;
      }
      
      // Stream URL can always be edited
      if (stream_url !== undefined) updateData.stream_url = stream_url || null;

      const { data: updatedWager, error: updateError } = await supabase
        .from('wagers')
        .update(updateData)
        .eq('id', wagerId)
        .select()
        .single();

      if (updateError) {
        console.error('[secure-wager] Edit error:', updateError);
        return new Response(JSON.stringify({ error: 'Failed to edit wager' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`[secure-wager] Wager ${wagerId} edited by verified wallet: ${walletAddress}`);
      return new Response(JSON.stringify({ wager: updatedWager }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // DELETE WAGER
    if (action === 'delete') {
      const { wagerId } = data;

      if (!wagerId) {
        return new Response(JSON.stringify({ error: 'Wager ID required' }), {
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

      // Only owner can delete
      if (wager.player_a_wallet !== walletAddress) {
        return new Response(JSON.stringify({ error: 'Only the wager owner can delete' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Can only delete if in 'created' status (no opponent joined yet)
      if (wager.status !== 'created') {
        return new Response(JSON.stringify({ error: 'Cannot delete a wager that has been accepted' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { error: deleteError } = await supabase
        .from('wagers')
        .delete()
        .eq('id', wagerId);

      if (deleteError) {
        console.error('[secure-wager] Delete error:', deleteError);
        return new Response(JSON.stringify({ error: 'Failed to delete wager' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`[secure-wager] Wager ${wagerId} deleted by verified wallet: ${walletAddress}`);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // SET READY STATUS
    if (action === 'setReady') {
      const { wagerId, ready } = data;

      if (!wagerId || ready === undefined) {
        return new Response(JSON.stringify({ error: 'Wager ID and ready status required' }), {
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

      // Only joined wagers can have ready status
      if (wager.status !== 'joined') {
        return new Response(JSON.stringify({ error: 'Wager must be in joined status' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const isPlayerA = wager.player_a_wallet === walletAddress;
      const isPlayerB = wager.player_b_wallet === walletAddress;

      if (!isPlayerA && !isPlayerB) {
        return new Response(JSON.stringify({ error: 'You are not a participant' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const updateData: Record<string, any> = isPlayerA
        ? { ready_player_a: ready }
        : { ready_player_b: ready };

      // Check if both will be ready after this update
      const otherReady = isPlayerA ? wager.ready_player_b : wager.ready_player_a;
      if (ready && otherReady) {
        // Both ready, start countdown
        updateData.countdown_started_at = new Date().toISOString();
      } else {
        // Someone not ready, clear countdown
        updateData.countdown_started_at = null;
      }

      const { data: updatedWager, error: updateError } = await supabase
        .from('wagers')
        .update(updateData)
        .eq('id', wagerId)
        .select()
        .single();

      if (updateError) {
        console.error('[secure-wager] SetReady error:', updateError);
        return new Response(JSON.stringify({ error: 'Failed to set ready status' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`[secure-wager] Ready status set for wager ${wagerId} by wallet: ${walletAddress}`);
      return new Response(JSON.stringify({ wager: updatedWager }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // START GAME (when countdown completes)
    if (action === 'startGame') {
      const { wagerId } = data;

      if (!wagerId) {
        return new Response(JSON.stringify({ error: 'Wager ID required' }), {
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

      // Verify both players are ready
      if (!wager.ready_player_a || !wager.ready_player_b) {
        return new Response(JSON.stringify({ error: 'Both players must be ready' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Verify countdown has passed
      if (!wager.countdown_started_at) {
        return new Response(JSON.stringify({ error: 'Countdown not started' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const countdownStart = new Date(wager.countdown_started_at).getTime();
      const now = Date.now();
      if (now - countdownStart < 10000) { // 10 seconds
        return new Response(JSON.stringify({ error: 'Countdown not complete' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Update status to voting (game in progress)
      const { data: updatedWager, error: updateError } = await supabase
        .from('wagers')
        .update({ status: 'voting' })
        .eq('id', wagerId)
        .select()
        .single();

      if (updateError) {
        console.error('[secure-wager] StartGame error:', updateError);
        return new Response(JSON.stringify({ error: 'Failed to start game' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`[secure-wager] Game started for wager ${wagerId}`);
      return new Response(JSON.stringify({ wager: updatedWager }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // CHECK GAME COMPLETE (polls Lichess API to detect game end)
    if (action === 'checkGameComplete') {
      const { wagerId } = data;

      if (!wagerId) {
        return new Response(JSON.stringify({ error: 'Wager ID required' }), {
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

      // Only check games that are in voting status
      if (wager.status !== 'voting') {
        return new Response(JSON.stringify({ 
          gameComplete: false, 
          message: 'Wager not in active game state' 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Only check for chess (Lichess) games for now
      if (wager.game !== 'chess' || !wager.lichess_game_id) {
        return new Response(JSON.stringify({ 
          gameComplete: false, 
          message: 'No Lichess game linked' 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      try {
        // Fetch game from Lichess API
        const lichessResponse = await fetch(`https://lichess.org/api/game/${wager.lichess_game_id}`);
        
        if (!lichessResponse.ok) {
          console.log(`[secure-wager] Lichess API error: ${lichessResponse.status}`);
          return new Response(JSON.stringify({ 
            gameComplete: false, 
            message: 'Could not fetch game from Lichess' 
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const game = await lichessResponse.json();
        console.log(`[secure-wager] Lichess game status: ${game.status}`);

        // Check if game is finished
        const finishedStatuses = ['mate', 'resign', 'outoftime', 'draw', 'stalemate', 'timeout', 'cheat', 'noStart', 'aborted'];
        const isFinished = finishedStatuses.includes(game.status);

        if (!isFinished) {
          return new Response(JSON.stringify({ 
            gameComplete: false, 
            status: game.status,
            message: 'Game still in progress' 
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Get player Lichess usernames
        const { data: playerAData } = await supabase
          .from('players')
          .select('lichess_username')
          .eq('wallet_address', wager.player_a_wallet)
          .single();

        const { data: playerBData } = await supabase
          .from('players')
          .select('lichess_username')
          .eq('wallet_address', wager.player_b_wallet)
          .single();

        const playerAUsername = playerAData?.lichess_username?.toLowerCase();
        const playerBUsername = playerBData?.lichess_username?.toLowerCase();
        // Lichess API returns user.id as the reliable lowercase username field
        // user.name may have different casing or be absent in some responses
        const whiteUser = (game.players?.white?.user?.id || game.players?.white?.user?.name || '').toLowerCase();
        const blackUser = (game.players?.black?.user?.id || game.players?.black?.user?.name || '').toLowerCase();

        console.log(`[secure-wager] Username matching - PlayerA: ${playerAUsername}, PlayerB: ${playerBUsername}, White: ${whiteUser}, Black: ${blackUser}, Winner: ${game.winner}`);

        // Determine winner wallet
        let winnerWallet: string | null = null;
        let resultType: 'playerA' | 'playerB' | 'draw' | 'unknown' = 'unknown';

        // First, verify at least one player is in this game
        const playerAIsWhite = whiteUser === playerAUsername;
        const playerAIsBlack = blackUser === playerAUsername;
        const playerBIsWhite = whiteUser === playerBUsername;
        const playerBIsBlack = blackUser === playerBUsername;
        
        const playerAInGame = playerAIsWhite || playerAIsBlack;
        const playerBInGame = playerBIsWhite || playerBIsBlack;
        
        console.log(`[secure-wager] Player matching - PlayerA in game: ${playerAInGame}, PlayerB in game: ${playerBInGame}`);

        if (game.status === 'draw' || game.status === 'stalemate') {
          resultType = 'draw';
        } else if (game.winner === 'white') {
          if (playerAIsWhite) {
            winnerWallet = wager.player_a_wallet;
            resultType = 'playerA';
          } else if (playerBIsWhite) {
            winnerWallet = wager.player_b_wallet;
            resultType = 'playerB';
          }
        } else if (game.winner === 'black') {
          if (playerAIsBlack) {
            winnerWallet = wager.player_a_wallet;
            resultType = 'playerA';
          } else if (playerBIsBlack) {
            winnerWallet = wager.player_b_wallet;
            resultType = 'playerB';
          }
        }
        
        console.log(`[secure-wager] Result determination - ResultType: ${resultType}, WinnerWallet: ${winnerWallet}`);

        // If we could determine the result, auto-resolve the wager
        if (resultType !== 'unknown') {
          console.log(`[secure-wager] Resolving wager ${wagerId}. Result: ${resultType}, Winner: ${winnerWallet}`);
          
          const { data: updatedWager, error: updateError } = await supabase
            .from('wagers')
            .update({ 
              status: 'resolved',
              winner_wallet: resultType === 'draw' ? null : winnerWallet,
              resolved_at: new Date().toISOString()
            })
            .eq('id', wagerId)
            .select()
            .single();

          if (updateError) {
            console.error('[secure-wager] Auto-resolve error:', updateError);
            return new Response(JSON.stringify({ 
              gameComplete: true,
              status: game.status,
              winner: game.winner,
              resultType,
              winnerWallet,
              error: 'Failed to update wager status',
              errorDetails: updateError.message
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          
          console.log(`[secure-wager] Wager ${wagerId} auto-resolved. Result: ${resultType}`);
          
          // Call resolve-wager edge function to handle on-chain resolution (or refund for draws)
          try {
            console.log(`[secure-wager] Triggering on-chain resolution for wager ${wagerId}`);
            const resolveResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/resolve-wager`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
              },
              body: JSON.stringify({
                action: resultType === 'draw' ? 'refund_draw' : 'resolve_wager',
                matchId: wager.match_id,
                playerAWallet: wager.player_a_wallet,
                playerBWallet: wager.player_b_wallet,
                winnerWallet: winnerWallet,
                wagerId: wager.id,
                stakeLamports: wager.stake_lamports,
              }),
            });
            const resolveResult = await resolveResponse.json();
            if (resolveResult.success) {
              console.log(`[secure-wager] On-chain resolution successful: ${JSON.stringify(resolveResult)}`);
            } else {
              console.log('[secure-wager] On-chain resolution failed:', resolveResult.error);
            }
          } catch (resolveError) {
            console.error('[secure-wager] On-chain resolution error:', resolveError);
          }

          // Mint victory NFT for winner (only if not a draw)
          if (winnerWallet && resultType !== 'draw') {
            try {
              console.log(`[secure-wager] Minting NFT for winner ${winnerWallet}`);
              const mintResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/mint-nft`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                },
                body: JSON.stringify({
                  wagerId: wager.id,
                  winnerWallet: winnerWallet,
                }),
              });
              const mintResult = await mintResponse.json();
              if (mintResult.success) {
                console.log(`[secure-wager] NFT minted successfully: ${mintResult.nft?.mintAddress}`);
              } else {
                console.log('[secure-wager] NFT minting failed:', mintResult.error);
              }
            } catch (mintError) {
              console.error('[secure-wager] NFT minting error:', mintError);
            }
          }

          return new Response(JSON.stringify({ 
            gameComplete: true,
            status: game.status,
            winner: game.winner,
            resultType,
            winnerWallet: resultType === 'draw' ? null : winnerWallet,
            isDraw: resultType === 'draw',
            wager: updatedWager
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Game finished but couldn't determine winner (usernames don't match)
        return new Response(JSON.stringify({ 
          gameComplete: true,
          status: game.status,
          winner: game.winner,
          resultType: 'unknown',
          message: 'Game complete but could not verify players. Manual vote required.'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      } catch (lichessError) {
        console.error('[secure-wager] Lichess API error:', lichessError);
        return new Response(JSON.stringify({ 
          gameComplete: false, 
          message: 'Error checking Lichess game' 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
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
