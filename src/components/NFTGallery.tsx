import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ExternalLink, Trophy, Sparkles, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { usePlayerNFTs, NFT, TIER_INFO, TROPHY_URIS } from '@/hooks/useNFTs';
import { formatSol, truncateAddress } from '@/lib/constants';

interface NFTGalleryProps {
  walletAddress: string | null;
  showFilters?: boolean;
}

type TierFilter = 'all' | 'bronze' | 'silver' | 'gold' | 'diamond';

export function NFTGallery({ walletAddress, showFilters = true }: NFTGalleryProps) {
  const { data: nfts, isLoading } = usePlayerNFTs(walletAddress);
  const [filterTier, setFilterTier] = useState<TierFilter>('all');
  const [selectedNFT, setSelectedNFT] = useState<NFT | null>(null);

  const filteredNFTs = nfts?.filter(nft => 
    filterTier === 'all' || nft.tier === filterTier
  ) || [];

  const tierCounts = {
    bronze: nfts?.filter(n => n.tier === 'bronze').length || 0,
    silver: nfts?.filter(n => n.tier === 'silver').length || 0,
    gold: nfts?.filter(n => n.tier === 'gold').length || 0,
    diamond: nfts?.filter(n => n.tier === 'diamond').length || 0,
  };

  if (isLoading) {
    return (
      <Card variant="gaming">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-accent" />
            Trophy Collection
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="aspect-square rounded-lg bg-muted/30 animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!nfts || nfts.length === 0) {
    return (
      <Card variant="gaming">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-accent" />
            Trophy Collection
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No victory trophies yet</p>
            <p className="text-sm text-muted-foreground mt-2">Win wagers to earn NFT trophies!</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card variant="gaming">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-accent" />
              Trophy Collection
              <Badge variant="outline" className="ml-2">{nfts.length}</Badge>
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Tier Summary */}
          <div className="grid grid-cols-4 gap-2">
            {(['diamond', 'gold', 'silver', 'bronze'] as const).map(tier => (
              <motion.button
                key={tier}
                onClick={() => setFilterTier(filterTier === tier ? 'all' : tier)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`p-3 rounded-lg text-center transition-all ${
                  filterTier === tier 
                    ? `${TIER_INFO[tier].bgColor} ring-2 ring-primary` 
                    : 'bg-muted/30 hover:bg-muted/50'
                }`}
              >
                <div className="text-2xl mb-1">{TIER_INFO[tier].emoji}</div>
                <div className={`font-gaming text-lg ${TIER_INFO[tier].color}`}>
                  {tierCounts[tier]}
                </div>
                <div className="text-xs text-muted-foreground">{TIER_INFO[tier].label}</div>
              </motion.button>
            ))}
          </div>

          {/* Filter indicator */}
          {filterTier !== 'all' && showFilters && (
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Showing {TIER_INFO[filterTier].label} trophies
              </span>
              <Button variant="ghost" size="sm" onClick={() => setFilterTier('all')}>
                Clear
              </Button>
            </div>
          )}

          {/* NFT Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            <AnimatePresence mode="popLayout">
              {filteredNFTs.map((nft, index) => (
                <motion.div
                  key={nft.id}
                  layout
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ scale: 1.05, y: -4 }}
                  onClick={() => setSelectedNFT(nft)}
                  className="cursor-pointer"
                >
                  <div className={`aspect-square rounded-lg overflow-hidden border-2 ${
                    nft.tier === 'diamond' ? 'border-cyan-400/50 shadow-lg shadow-cyan-500/20' :
                    nft.tier === 'gold' ? 'border-yellow-400/50 shadow-lg shadow-yellow-500/20' :
                    nft.tier === 'silver' ? 'border-slate-300/50' :
                    'border-orange-400/50'
                  } bg-gradient-to-b from-muted/50 to-muted/20`}>
                    <img
                      src={TROPHY_URIS[nft.tier]}
                      alt={nft.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="mt-2 text-center">
                    <div className={`text-xs font-gaming ${TIER_INFO[nft.tier].color}`}>
                      {TIER_INFO[nft.tier].emoji} #{nft.match_id}
                    </div>
                    {nft.stake_amount && (
                      <div className="text-xs text-muted-foreground">
                        {formatSol(nft.stake_amount)} SOL
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </CardContent>
      </Card>

      {/* NFT Detail Modal */}
      <Dialog open={!!selectedNFT} onOpenChange={() => setSelectedNFT(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedNFT?.name}</DialogTitle>
          </DialogHeader>
          {selectedNFT && (
            <div className="space-y-4">
              <div className={`rounded-lg overflow-hidden border border-border bg-muted/30 ${TIER_INFO[selectedNFT.tier].bgColor}`}>
                <div className="p-3">
                  <img
                    src={TROPHY_URIS[selectedNFT.tier]}
                    alt={selectedNFT.name}
                    loading="lazy"
                    className="mx-auto max-h-[40vh] w-auto object-contain"
                  />
                </div>
              </div>
              
              <div className="flex items-center justify-center gap-2">
                <span className="text-2xl">{TIER_INFO[selectedNFT.tier].emoji}</span>
                <Badge className={TIER_INFO[selectedNFT.tier].bgColor}>
                  {TIER_INFO[selectedNFT.tier].label} Trophy
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 rounded-lg bg-muted/30">
                  <div className="text-muted-foreground text-xs">Match ID</div>
                  <div className="font-gaming">{selectedNFT.match_id}</div>
                </div>
                <div className="p-3 rounded-lg bg-muted/30">
                  <div className="text-muted-foreground text-xs">Prize</div>
                  <div className="font-gaming text-success">
                    {selectedNFT.stake_amount ? formatSol(selectedNFT.stake_amount * 2) : '—'} SOL
                  </div>
                </div>
                {selectedNFT.lichess_game_id && (
                  <div className="col-span-2 p-3 rounded-lg bg-muted/30">
                    <div className="text-muted-foreground text-xs">Lichess Game</div>
                    <a
                      href={`https://lichess.org/${selectedNFT.lichess_game_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-gaming text-primary hover:underline flex items-center gap-1"
                    >
                      {selectedNFT.lichess_game_id}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
                <div className="col-span-2 p-3 rounded-lg bg-muted/30">
                  <div className="text-muted-foreground text-xs">Minted</div>
                  <div className="font-gaming">
                    {new Date(selectedNFT.minted_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </div>
                </div>
                <div className="col-span-2 p-3 rounded-lg bg-muted/30">
                  <div className="text-muted-foreground text-xs">Mint Address</div>
                  <div className="font-gaming text-xs break-all">
                    {truncateAddress(selectedNFT.mint_address, 8)}
                  </div>
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => window.open(`https://explorer.solana.com/address/${selectedNFT.mint_address}?cluster=devnet`, '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                View on Solana Explorer
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
