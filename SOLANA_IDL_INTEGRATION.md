---
title: Solana Program IDL & Type Integration Guide
description: Complete guide to Game Gambit's Solana program IDL integration with TypeScript types
---

# Solana Program IDL & Type Integration

This document explains how the Game Gambit frontend integrates with the Solana smart contract through its IDL (Interface Definition Language) and TypeScript types.

## Overview

The Game Gambit program (`E2Vd3U91kMrgwp8JCXcLSn7bt3NowDmGwoBYsVRhGfMR`) is an on-chain chess wager system with:
- **7 Instructions**: create_wager, join_wager, resolve_wager, close_wager, initialize_player, ban_player, submit_vote, retract_vote
- **2 Account Types**: PlayerProfile, WagerAccount
- **7 Events**: wager_created, wager_joined, wager_resolved, wager_closed, vote_submitted, vote_retracted, player_banned
- **16 Error Codes**: Detailed error handling for program failures

## Architecture

```
┌─────────────────────────────────────────┐
│      Frontend Application                │
│  (Next.js 15 with TypeScript)           │
└──────────────┬──────────────────────────┘
               │
      ┌────────▼──────────┐
      │   src/types/index.ts    │  ← Centralized type hub
      │  - Solana enums/errors  │
      │  - Account types        │
      │  - Instruction types    │
      │  - Event types          │
      └────────┬──────────────┘
               │
    ┌──────────┴──────────┬──────────────┐
    │                     │              │
┌───▼──────────────┐ ┌──▼───────────────┴───────┐
│  src/lib/idl/    │ │ src/lib/solana-*         │
│ - gamegambit.json│ │ - program-utils.ts       │
│ - gamegambit.ts  │ │ - event-bridge.ts        │
└──────────────────┘ │ - rate-limiting.ts       │
                     │ - database-optimization  │
                     └──────────┬───────────────┘
                                │
                         ┌──────▼───────┐
                         │ Solana Program│
                         │   RPC Node    │
                         └───────────────┘
```

## Key Files

### 1. **src/lib/idl/** - IDL Definitions
- `gamegambit.json`: Raw IDL from the Solana program
- `gamegambit.ts`: TypeScript type helper generated from IDL

### 2. **src/types/index.ts** - Centralized Types
Central hub exporting:
- Supabase auto-generated types
- Solana program enums (WagerStatus, ErrorCodes)
- Instruction discriminators & event discriminators
- Account types (PlayerProfile, WagerAccount)
- Instruction argument types
- Event types
- Domain types (PlayerStats, WagerWithPlayers, etc.)

### 3. **src/lib/solana-program-utils.ts** - Instruction Building
Helper functions to build program instructions:
```typescript
buildCreateWagerInstruction()
buildJoinWagerInstruction()
buildResolveWagerInstruction()
buildSubmitVoteInstruction()
buildBanPlayerInstruction()
buildCloseWagerInstruction()
buildRetractVoteInstruction()
```

### 4. **src/lib/solana-event-bridge.ts** - Event Synchronization
Listens to on-chain events and syncs to Supabase database

## Wager Lifecycle

### 1. Create Wager (Player A)
```typescript
const args: CreateWagerInstructionArgs = {
  matchId: 12345,
  stakeLamports: 5_000_000_000, // 5 SOL
  lichessGameId: 'abc123def456',
  requiresModerator: false,
}

// Validate
validateWagerArgs(args) // true/false

// Build instruction
const ix = await buildCreateWagerInstruction(program, playerA, args)

// Sign and send transaction
const tx = new Transaction().add(ix)
await sendAndConfirmTransaction(connection, tx, [playerA])
```

**Status Transition**: Created → (on-chain account created)

### 2. Join Wager (Player B)
```typescript
const joinArgs: JoinWagerInstructionArgs = {
  stakeLamports: 5_000_000_000, // Must match Player A's stake
}

const ix = await buildJoinWagerInstruction(
  program,
  playerA,
  playerB,
  matchId,
  joinArgs.stakeLamports
)
```

**Status Transition**: Created → Joined

### 3. Vote/Resolve
After the chess match concludes:
```typescript
// Players submit votes
const voteIx = await buildSubmitVoteInstruction(
  program,
  voter,
  playerA,
  matchId,
  votedWinner
)

// After voting period, resolve
const resolveIx = await buildResolveWagerInstruction(
  program,
  playerA,
  playerB,
  matchId,
  winner,
  authorizer,
  platformWallet
)
```

**Status Transition**: Joined → Voting → Retractable → Resolved

## Type Safety Patterns

### Pattern 1: Using Discriminators
```typescript
import { INSTRUCTION_DISCRIMINATORS, EVENT_DISCRIMINATORS } from '@/types'

// Create instruction with proper discriminator
const discriminator = INSTRUCTION_DISCRIMINATORS.create_wager
// [210, 82, 178, 75, 253, 34, 84, 120]

// Listen for events
const wagerCreatedDiscriminator = EVENT_DISCRIMINATORS.wager_created
// [177, 41, 34, 111, 170, 96, 157, 62]
```

### Pattern 2: Type-Safe Account Access
```typescript
import { PlayerProfile, WagerAccount, derivePlayerProfilePDA, deriveWagerAccountPDA } from '@/types'
import { PublicKey } from '@solana/web3.js'

// Derive PDA with full type info
const [playerPDA, playerBump] = derivePlayerProfilePDA(playerWallet)
const [wagerPDA, wagerBump] = deriveWagerAccountPDA(playerA, matchId)

// Fetch account data
const accountInfo = await connection.getAccountInfo(wagerPDA)
// Data is WagerAccount type-safe
```

### Pattern 3: Enum Safety
```typescript
import { SolanaWagerStatus, WAGER_STATUS_NAMES } from '@/types'

// Enum values map to IDL: 0=Created, 1=Joined, 2=Voting, etc.
const status: SolanaWagerStatus = SolanaWagerStatus.Voting

// Display user-friendly names
console.log(WAGER_STATUS_NAMES[status]) // "Voting"
```

### Pattern 4: Error Handling
```typescript
import { SolanaErrorCode, GameGambitError, ERROR_CODES } from '@/types'

try {
  // Solana transaction
} catch (error) {
  if (error.code === SolanaErrorCode.PlayerBanned) {
    // Handle ban
  } else if (error.code === SolanaErrorCode.InsufficientFunds) {
    // Handle insufficient funds
  }
}
```

## Event Bridge: Solana ↔ Database

The `GameGambitEventBridge` listens to program events and syncs state:

```typescript
// On WagerCreated event
- Create wager in Supabase 'wagers' table
- Update player wager count

// On WagerJoined event
- Update wager status → 'joined'
- Add player_b_wallet
- Create transaction record

// On WagerResolved event
- Update wager status → 'resolved'
- Record winner's payout
- Update player win/loss stats
- Calculate and record platform fee

// On PlayerBanned event
- Update players table: is_banned = true
- Set ban expiration time
```

## Performance Considerations for 200k+ MAUs

### 1. Instruction Batch Processing
```typescript
// Build multiple instructions in single transaction
const instructions = [
  await buildCreateWagerInstruction(program, player1, args1),
  await buildCreateWagerInstruction(program, player2, args2),
  await buildCreateWagerInstruction(program, player3, args3),
]

const tx = new Transaction().add(...instructions)
```

### 2. PDA Derivation Caching
```typescript
const playerPDACache = new Map<string, PublicKey>()

function getCachedPlayerPDA(wallet: string): PublicKey {
  if (!playerPDACache.has(wallet)) {
    const [pda] = derivePlayerProfilePDA(new PublicKey(wallet))
    playerPDACache.set(wallet, pda)
  }
  return playerPDACache.get(wallet)!
}
```

### 3. Lamports ↔ SOL Conversion
```typescript
// Always store lamports on-chain, convert for display
const displayAmount = lamportsToSol(stakeLamports) // 5_000_000_000 → 5.0
const chainAmount = solToLamports(displayAmount) // 5.0 → 5_000_000_000
```

### 4. Database Query Optimization
See `src/lib/database-optimization.ts` for:
- Selective field queries
- Batch operations
- Pagination strategies
- Cache invalidation

## Integration with Anchor Framework

The frontend uses Anchor.js to interact with the program:

```typescript
import * as anchor from '@coral-xyz/anchor'
import { Gamegambit } from '@/lib/idl/gamegambit'

const provider = new anchor.AnchorProvider(connection, wallet, opts)
const program = new anchor.Program<Gamegambit>(IDL, programId, provider)

// All methods are type-safe via IDL
await program.methods
  .createWager(matchId, stakeLamports, lichessGameId, requiresModerator)
  .accounts({...})
  .instruction()
```

## Testing Type Safety

```typescript
// ✅ Correct - matches CreateWagerInstructionArgs
const goodArgs = {
  matchId: 123,
  stakeLamports: 1_000_000,
  lichessGameId: 'game123',
  requiresModerator: false,
}

// ❌ Error - missing required fields
const badArgs = {
  matchId: 123,
  // TS Error: Property 'stakeLamports' is missing
}
```

## Migration from Old Types

If upgrading from previous type definitions:

1. Import from centralized `src/types/index.ts`
2. Replace Solana account types with `PlayerProfile`, `WagerAccount`
3. Update instruction calls to use `*InstructionArgs` types
4. Use error codes from `SolanaErrorCode` enum
5. Leverage discriminators from `INSTRUCTION_DISCRIMINATORS`, `EVENT_DISCRIMINATORS`

## Common Gotchas

1. **Lamports vs SOL**: Always use lamports internally, convert for display
2. **PDA Seeds**: Match exactly with on-chain program (const "player", const "wager")
3. **Account Writable**: Mark `writable: true` in account metadata for state-modifying instructions
4. **Signer Requirements**: Only transaction payer or specific accounts can be signers
5. **Discriminators**: Exact byte-for-byte match required for instruction/event parsing

## Resources

- [Gamegambit IDL](./src/lib/idl/gamegambit.json)
- [Solana Program Types](./src/types/index.ts)
- [Program Utils](./src/lib/solana-program-utils.ts)
- [Event Bridge](./src/lib/solana-event-bridge.ts)
- [API Examples](./src/app/api/wagers/route.ts)
