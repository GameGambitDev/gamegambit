import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Trophy image URIs on IPFS
const TROPHY_URIS = {
  bronze: 'https://gateway.pinata.cloud/ipfs/bafybeicdyog7bjcljl5i5c2bjwnpdzjobfx74igq4d3rr43xtojrblvbcm',
  silver: 'https://gateway.pinata.cloud/ipfs/bafybeifzryhfb6uetnd4vixcvcso6woyv6mfsr6f2473zdxs6wwyxdetam',
  gold: 'https://gateway.pinata.cloud/ipfs/bafybeiah2dcbyq6yqluqkc46n7vg3vslgb356en6y6xtcuknl3xiedwu7m',
  diamond: 'https://gateway.pinata.cloud/ipfs/bafybeicaizle7bjcw5wrt2lrecgnyz5vbavu4olkbl6ifjehjnv42wwzda'
};

function getTierFromStake(stakeLamports: number): 'bronze' | 'silver' | 'gold' | 'diamond' {
  const sol = stakeLamports / 1_000_000_000;
  if (sol >= 10) return 'diamond';
  if (sol >= 5) return 'gold';
  if (sol >= 1) return 'silver';
  return 'bronze';
}

function generateMintAddress(): string {
  // Generate a pseudo-random base58-like address for demo
  // In production, this would be the actual Solana mint address
  const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < 44; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { wagerId, winnerWallet } = await req.json();
    
    if (!wagerId || !winnerWallet) {
      return new Response(
        JSON.stringify({ error: 'wagerId and winnerWallet are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Minting NFT for wager ${wagerId}, winner: ${winnerWallet}`);

    // Fetch wager data
    const { data: wager, error: wagerError } = await supabase
      .from('wagers')
      .select('*')
      .eq('id', wagerId)
      .single();

    if (wagerError || !wager) {
      console.error('Wager not found:', wagerError);
      return new Response(
        JSON.stringify({ error: 'Wager not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if NFT already minted for this wager
    const { data: existingNFT } = await supabase
      .from('nfts')
      .select('id')
      .eq('wager_id', wagerId)
      .single();

    if (existingNFT) {
      console.log('NFT already minted for this wager');
      return new Response(
        JSON.stringify({ error: 'NFT already minted for this wager' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine tier based on stake
    const tier = getTierFromStake(wager.stake_lamports);
    const mintAddress = generateMintAddress();
    const prizeSol = (wager.stake_lamports * 2) / 1_000_000_000;

    // Create NFT metadata
    const metadata = {
      name: `GameGambit Victory #${wager.match_id}`,
      symbol: 'GGWIN',
      description: `Victory trophy from GameGambit - ${tier.charAt(0).toUpperCase() + tier.slice(1)} tier. Won ${prizeSol} SOL in Match #${wager.match_id}.`,
      image: TROPHY_URIS[tier],
      external_url: 'https://gamegambit.io',
      attributes: [
        { trait_type: 'Tier', value: tier.charAt(0).toUpperCase() + tier.slice(1) },
        { trait_type: 'Match ID', value: wager.match_id.toString() },
        { trait_type: 'Prize (SOL)', value: prizeSol.toFixed(4) },
        { trait_type: 'Game', value: wager.game || 'chess' },
      ],
    };

    if (wager.lichess_game_id) {
      metadata.attributes.push({ trait_type: 'Lichess Game', value: wager.lichess_game_id });
    }

    // Upload metadata to Pinata
    let metadataUri = '';
    const pinataJwt = Deno.env.get('PINATA_JWT');
    
    if (pinataJwt) {
      try {
        console.log('Uploading metadata to Pinata...');
        const pinataResponse = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${pinataJwt}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            pinataContent: metadata,
            pinataMetadata: {
              name: `GameGambit-Victory-${wager.match_id}`,
            },
          }),
        });

        if (pinataResponse.ok) {
          const pinataData = await pinataResponse.json();
          metadataUri = `https://gateway.pinata.cloud/ipfs/${pinataData.IpfsHash}`;
          console.log('Metadata uploaded to IPFS:', metadataUri);
        } else {
          console.error('Pinata upload failed:', await pinataResponse.text());
          metadataUri = `data:application/json,${encodeURIComponent(JSON.stringify(metadata))}`;
        }
      } catch (pinataError) {
        console.error('Pinata error:', pinataError);
        metadataUri = `data:application/json,${encodeURIComponent(JSON.stringify(metadata))}`;
      }
    } else {
      console.log('PINATA_JWT not configured, using data URI');
      metadataUri = `data:application/json,${encodeURIComponent(JSON.stringify(metadata))}`;
    }

    // Insert NFT record
    const { data: nft, error: nftError } = await supabase
      .from('nfts')
      .insert({
        mint_address: mintAddress,
        owner_wallet: winnerWallet,
        wager_id: wagerId,
        tier,
        name: metadata.name,
        metadata_uri: metadataUri,
        image_uri: TROPHY_URIS[tier],
        match_id: wager.match_id,
        stake_amount: wager.stake_lamports,
        lichess_game_id: wager.lichess_game_id,
        attributes: metadata,
      })
      .select()
      .single();

    if (nftError) {
      console.error('Failed to insert NFT:', nftError);
      return new Response(
        JSON.stringify({ error: 'Failed to create NFT record' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('NFT minted successfully:', nft.id);

    // Check for achievements
    const { data: playerNFTs } = await supabase
      .from('nfts')
      .select('tier')
      .eq('owner_wallet', winnerWallet);

    if (playerNFTs) {
      const totalWins = playerNFTs.length;
      const achievements: Array<{ type: string; value: number }> = [];

      // First win
      if (totalWins === 1) {
        achievements.push({ type: 'first_win', value: 1 });
      }
      // Milestone wins
      if (totalWins === 5) {
        achievements.push({ type: 'wins_5', value: 5 });
      }
      if (totalWins === 10) {
        achievements.push({ type: 'wins_10', value: 10 });
      }
      if (totalWins === 25) {
        achievements.push({ type: 'wins_25', value: 25 });
      }
      if (totalWins === 50) {
        achievements.push({ type: 'wins_50', value: 50 });
      }

      // Tier-specific achievements
      const diamondCount = playerNFTs.filter(n => n.tier === 'diamond').length;
      const goldCount = playerNFTs.filter(n => n.tier === 'gold').length;

      if (diamondCount === 1) {
        achievements.push({ type: 'first_diamond', value: 1 });
      }
      if (goldCount === 1) {
        achievements.push({ type: 'first_gold', value: 1 });
      }

      // Insert achievements
      for (const ach of achievements) {
        await supabase
          .from('achievements')
          .upsert({
            player_wallet: winnerWallet,
            achievement_type: ach.type,
            achievement_value: ach.value,
          }, { onConflict: 'player_wallet,achievement_type' });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        nft: {
          id: nft.id,
          mintAddress,
          tier,
          metadataUri,
          imageUri: TROPHY_URIS[tier],
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error minting NFT:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
