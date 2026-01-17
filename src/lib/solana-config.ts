// Solana Program Configuration
// Note: Authority wallet SECRET is stored securely in environment variables
// and only accessible from edge functions - never exposed to frontend

export const PROGRAM_ID = "CPS82nShfYFBdJPLs4kLMYEUrTwvxieqSrkw6VYRopzx";
export const AUTHORITY_PUBKEY = "45kmAptt386fRtXzjsbschuvhuEo77vRKA5eyYbH4XFs";

// Devnet RPC endpoint (can be overridden in edge functions via env var)
export const DEFAULT_RPC_URL = "https://api.devnet.solana.com";

// Platform fee percentage (10%)
export const PLATFORM_FEE_PERCENT = 10;

// Wager status mapping to match on-chain enum
export const WagerStatusOnChain = {
  Created: 0,
  Joined: 1,
  Voting: 2,
  Retractable: 3,
  Disputed: 4,
  Resolved: 5,
} as const;

// IDL instruction discriminators
export const INSTRUCTION_DISCRIMINATORS = {
  create_wager: [210, 82, 178, 75, 253, 34, 84, 120],
  join_wager: [119, 81, 120, 160, 80, 8, 75, 239],
  submit_vote: [115, 242, 100, 0, 49, 178, 242, 133],
  retract_vote: [227, 0, 85, 234, 243, 42, 133, 162],
  resolve_wager: [31, 179, 1, 228, 83, 224, 1, 123],
  close_wager: [167, 240, 85, 147, 127, 50, 69, 203],
  initialize_player: [79, 249, 88, 177, 220, 62, 56, 128],
  ban_player: [20, 123, 183, 191, 29, 55, 244, 21],
} as const;

// Explorer URL helpers
export const getExplorerUrl = (type: 'tx' | 'address', value: string, cluster: 'devnet' | 'mainnet-beta' = 'devnet') => {
  const base = 'https://explorer.solana.com';
  return `${base}/${type}/${value}?cluster=${cluster}`;
};

export const getProgramExplorerUrl = () => getExplorerUrl('address', PROGRAM_ID);
export const getAuthorityExplorerUrl = () => getExplorerUrl('address', AUTHORITY_PUBKEY);
