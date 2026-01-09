import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface NFT {
  id: string;
  mint_address: string;
  owner_wallet: string;
  wager_id: string | null;
  tier: 'bronze' | 'silver' | 'gold' | 'diamond';
  name: string;
  metadata_uri: string;
  image_uri: string;
  match_id: number | null;
  stake_amount: number | null;
  lichess_game_id: string | null;
  minted_at: string;
  attributes: Record<string, unknown>;
  created_at: string;
}

export interface Achievement {
  id: string;
  player_wallet: string;
  achievement_type: string;
  achievement_value: number | null;
  unlocked_at: string;
  nft_mint_address: string | null;
  created_at: string;
}

// Trophy image URIs on IPFS
export const TROPHY_URIS = {
  bronze: 'https://gateway.pinata.cloud/ipfs/bafybeicdyog7bjcljl5i5c2bjwnpdzjobfx74igq4d3rr43xtojrblvbcm',
  silver: 'https://gateway.pinata.cloud/ipfs/bafybeifzryhfb6uetnd4vixcvcso6woyv6mfsr6f2473zdxs6wwyxdetam',
  gold: 'https://gateway.pinata.cloud/ipfs/bafybeiah2dcbyq6yqluqkc46n7vg3vslgb356en6y6xtcuknl3xiedwu7m',
  diamond: 'https://gateway.pinata.cloud/ipfs/bafybeicaizle7bjcw5wrt2lrecgnyz5vbavu4olkbl6ifjehjnv42wwzda'
} as const;

// Get tier based on stake amount (in lamports)
export function getTierFromStake(stakeLamports: number): 'bronze' | 'silver' | 'gold' | 'diamond' {
  const sol = stakeLamports / 1_000_000_000;
  if (sol >= 10) return 'diamond';
  if (sol >= 5) return 'gold';
  if (sol >= 1) return 'silver';
  return 'bronze';
}

// Tier display info
export const TIER_INFO = {
  bronze: { label: 'Bronze', color: 'text-orange-400', bgColor: 'bg-orange-500/20', emoji: '🥉' },
  silver: { label: 'Silver', color: 'text-slate-300', bgColor: 'bg-slate-400/20', emoji: '🥈' },
  gold: { label: 'Gold', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20', emoji: '🥇' },
  diamond: { label: 'Diamond', color: 'text-cyan-300', bgColor: 'bg-cyan-400/20', emoji: '💎' },
} as const;

// Fetch NFTs for a player
export function usePlayerNFTs(walletAddress: string | null) {
  return useQuery({
    queryKey: ['nfts', walletAddress],
    queryFn: async () => {
      if (!walletAddress) return [];
      
      const { data, error } = await supabase
        .from('nfts')
        .select('*')
        .eq('owner_wallet', walletAddress)
        .order('minted_at', { ascending: false });
      
      if (error) throw error;
      return data as NFT[];
    },
    enabled: !!walletAddress,
  });
}

// Fetch all NFTs (for global gallery)
export function useAllNFTs(limit = 50) {
  return useQuery({
    queryKey: ['nfts', 'all', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('nfts')
        .select('*')
        .order('minted_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return data as NFT[];
    },
  });
}

// Fetch achievements for a player
export function usePlayerAchievements(walletAddress: string | null) {
  return useQuery({
    queryKey: ['achievements', walletAddress],
    queryFn: async () => {
      if (!walletAddress) return [];
      
      const { data, error } = await supabase
        .from('achievements')
        .select('*')
        .eq('player_wallet', walletAddress)
        .order('unlocked_at', { ascending: false });
      
      if (error) throw error;
      return data as Achievement[];
    },
    enabled: !!walletAddress,
  });
}

// Count NFTs by tier for a player
export function useNFTCounts(walletAddress: string | null) {
  const { data: nfts } = usePlayerNFTs(walletAddress);
  
  const counts = {
    bronze: 0,
    silver: 0,
    gold: 0,
    diamond: 0,
    total: 0,
  };
  
  if (nfts) {
    nfts.forEach(nft => {
      counts[nft.tier]++;
      counts.total++;
    });
  }
  
  return counts;
}
