---
title: Game Gambit - Complete Integration Checklist
description: Step-by-step checklist for integrating Game Gambit frontend with Solana smart contract
---

# Game Gambit Integration Checklist

## Phase 1: Foundation ✅ Complete

- [x] Next.js 15 App Router setup
- [x] TypeScript configuration with path aliases
- [x] Tailwind CSS with cyberpunk theme
- [x] Supabase integration configured
- [x] Wallet integration (Solana)

## Phase 2: Solana IDL & Types ✅ Complete

- [x] IDL files copied to `src/lib/idl/`
  - [x] `gamegambit.json` - Raw program IDL
  - [x] `gamegambit.ts` - TypeScript type definitions

- [x] Centralized type system (`src/types/index.ts`)
  - [x] Instruction discriminators (8 instructions)
  - [x] Event discriminators (7 events)
  - [x] Account discriminators (2 account types)
  - [x] Wager status enum (7 statuses)
  - [x] Error codes enum (16 error types)
  - [x] Account type interfaces
  - [x] Event type interfaces
  - [x] Instruction argument types
  - [x] Domain model types

- [x] Program utilities (`src/lib/solana-program-utils.ts`)
  - [x] `getGameGambitProgram()` - Initialize Anchor program
  - [x] `derivePlayerProfilePDA()` - Derive player account address
  - [x] `deriveWagerAccountPDA()` - Derive wager account address
  - [x] `buildCreateWagerInstruction()` - Build create instruction
  - [x] `buildJoinWagerInstruction()` - Build join instruction
  - [x] `buildResolveWagerInstruction()` - Build resolve instruction
  - [x] `buildSubmitVoteInstruction()` - Build vote instruction
  - [x] `buildRetractVoteInstruction()` - Build retract instruction
  - [x] `buildBanPlayerInstruction()` - Build ban instruction
  - [x] `buildCloseWagerInstruction()` - Build close instruction
  - [x] `validateWagerArgs()` - Validate instruction args
  - [x] `lamportsToSol()` - Convert units
  - [x] `solToLamports()` - Convert units

- [x] Event bridge (`src/lib/solana-event-bridge.ts`)
  - [x] `GameGambitEventBridge` class
  - [x] Event listener setup
  - [x] WagerCreated event handler
  - [x] WagerJoined event handler
  - [x] WagerResolved event handler
  - [x] WagerClosed event handler
  - [x] VoteSubmitted event handler
  - [x] VoteRetracted event handler
  - [x] PlayerBanned event handler
  - [x] Manual state sync methods

## Phase 3: API Routes ✅ Partial Complete

- [x] Wager creation API (`src/app/api/wagers/route.ts`)
  - [x] POST endpoint for creating wagers
  - [x] Type validation
  - [x] Player verification
  - [x] Database sync
  - [x] Instruction data generation

- [ ] Wager joining API (`src/app/api/wagers/[wagerId]/join/route.ts`)
  - [ ] POST endpoint for joining wagers
  - [ ] Duplicate join prevention
  - [ ] Balance verification

- [ ] Wager resolution API (`src/app/api/wagers/[wagerId]/resolve/route.ts`)
  - [ ] POST endpoint for resolving wagers
  - [ ] Winner validation
  - [ ] Payout calculation
  - [ ] Fee distribution

- [ ] Voting API (`src/app/api/wagers/[wagerId]/votes/route.ts`)
  - [ ] POST for submit vote
  - [ ] DELETE for retract vote
  - [ ] Voting period validation

- [ ] Player management API (`src/app/api/players/route.ts`)
  - [ ] GET leaderboard
  - [ ] GET player profile
  - [ ] POST player initialization

- [ ] Admin API (`src/app/api/admin/wagers/[wagerId]/ban/route.ts`)
  - [ ] POST for banning players
  - [ ] Duration configuration

## Phase 4: Frontend Components

### Home Page
- [ ] Update Hero with interactive Solana integration demo
- [ ] Add "Connect Wallet" flow with error handling
- [ ] Display connected wallet address
- [ ] Show user's balance and stats

### Arena Page
- [ ] Display active wagers with real-time updates
- [ ] Show wager creation form with validation
- [ ] Display player search/discovery
- [ ] Handle instruction signing flow

### Dashboard
- [ ] Show player stats (wins, losses, earnings)
- [ ] Display transaction history
- [ ] Show active wagers
- [ ] Display pending votes/resolutions

### Leaderboard
- [ ] Fetch leaderboard data from optimized database queries
- [ ] Display rankings with Solana sync status
- [ ] Filter by game type
- [ ] Sort by wins/earnings/winrate

### Profile
- [ ] Display player achievements
- [ ] Show transaction history
- [ ] Display NFT collection
- [ ] Show connected Lichess account

## Phase 5: Backend Optimization

- [x] Database indexing migration
  - [x] Player stats indexes
  - [x] Wager lookup indexes
  - [x] Transaction history indexes

- [x] Query optimization (`src/lib/database-optimization.ts`)
  - [x] Selective field retrieval
  - [x] Batch query operations
  - [x] Pagination strategies
  - [x] Cache invalidation patterns

- [x] Rate limiting (`src/lib/rate-limiting.ts`)
  - [x] User-based rate limits
  - [x] IP-based rate limits
  - [x] Endpoint-specific configs
  - [x] Cache-control headers

- [x] Data consistency (`src/lib/data-consistency.ts`)
  - [x] Optimistic locking
  - [x] Pessimistic locking
  - [x] Transactional operations
  - [x] Eventual consistency patterns

- [x] Performance tradeoffs (`src/lib/performance-tradeoffs.ts`)
  - [x] SQL vs DuckDB guidance
  - [x] Scaling checklist
  - [x] Analytics strategy

## Phase 6: Error Handling & Monitoring

- [ ] Implement global error boundary
- [ ] Add error logging service
- [ ] Create error recovery flows
- [ ] Add transaction confirmation monitoring
- [ ] Implement retry logic with exponential backoff

## Phase 7: Security

- [ ] Input validation on all forms
- [ ] SQL injection prevention (Supabase RLS policies)
- [ ] CORS configuration
- [ ] Rate limiting enforcement
- [ ] Wallet signature verification
- [ ] Transaction verification

## Phase 8: Testing

- [ ] Unit tests for type guards
- [ ] Integration tests for API routes
- [ ] Solana program simulation tests
- [ ] Database transaction tests
- [ ] End-to-end flow tests

## Phase 9: Deployment

- [ ] Environment variable setup
- [ ] Database migrations applied
- [ ] IDL files bundled correctly
- [ ] Build optimization
- [ ] Performance monitoring setup

## Quick Reference

### Key Type Imports
```typescript
import {
  PROGRAM_ADDRESS,
  INSTRUCTION_DISCRIMINATORS,
  EVENT_DISCRIMINATORS,
  SolanaWagerStatus,
  SolanaErrorCode,
  PlayerProfile,
  WagerAccount,
  CreateWagerInstructionArgs,
  type Gamegambit,
} from '@/types'
```

### Key Function Imports
```typescript
import {
  getGameGambitProgram,
  derivePlayerProfilePDA,
  deriveWagerAccountPDA,
  buildCreateWagerInstruction,
  buildJoinWagerInstruction,
  buildResolveWagerInstruction,
  validateWagerArgs,
  lamportsToSol,
  solToLamports,
} from '@/lib/solana-program-utils'
```

### Connection Setup
```typescript
import { Connection, PublicKey } from '@solana/web3.js'
import * as anchor from '@coral-xyz/anchor'

const connection = new Connection(
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'
)

const provider = new anchor.AnchorProvider(connection, wallet, {
  commitment: 'confirmed',
})

const program = getGameGambitProgram(provider)
```

### Wager Creation Flow
```typescript
// 1. Validate inputs
const args = { matchId: 123, stakeLamports: 5e9, lichessGameId: 'id', requiresModerator: false }
if (!validateWagerArgs(args)) throw Error('Invalid args')

// 2. Build instruction
const ix = await buildCreateWagerInstruction(program, playerA, args)

// 3. Create and sign transaction
const tx = new Transaction().add(ix)
const { blockhash } = await connection.getLatestBlockhash()
tx.recentBlockhash = blockhash
tx.feePayer = playerA

const signed = await wallet.signTransaction(tx)

// 4. Send and confirm
const sig = await connection.sendRawTransaction(signed.serialize())
await connection.confirmTransaction(sig, 'confirmed')

// 5. Database sync (via event bridge or manual call)
await syncWagerState(wagerId)
```

## Documentation Files

1. **SOLANA_IDL_INTEGRATION.md** - Complete IDL integration guide
2. **BACKEND_ARCHITECTURE.md** - Backend optimization strategies
3. **src/types/index.ts** - Type definitions with JSDoc
4. **src/lib/solana-program-utils.ts** - Program utilities with examples

## Environment Variables Required

```env
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta
NEXT_PUBLIC_PROGRAM_ID=E2Vd3U91kMrgwp8JCXcLSn7bt3NowDmGwoBYsVRhGfMR

SUPABASE_URL=
SUPABASE_ANON_KEY=
```

## Success Criteria

- [x] Type-safe Solana program interactions
- [x] Proper IDL integration with discriminators
- [x] Event-driven database synchronization
- [x] Error handling and validation
- [x] Performance optimization for 200k+ MAUs
- [x] Complete documentation
- [ ] All API routes implemented
- [ ] Frontend components connected
- [ ] End-to-end testing complete
- [ ] Deployed to production

## Next Steps

1. **Implement remaining API routes** (join, resolve, voting)
2. **Connect frontend components** to API routes
3. **Add error handling** and user feedback
4. **Implement transaction monitoring** and confirmations
5. **Add comprehensive testing** suite
6. **Deploy and monitor** in production
