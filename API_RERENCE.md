---
title: Game Gambit API Reference
description: Complete API documentation for Game Gambit backend endpoints
---

# Game Gambit API Reference

## Overview

Game Gambit provides a REST API for managing wagers, players, and transactions on the Solana blockchain. All endpoints require wallet authentication via signed messages.

## Authentication

All API requests require a valid Solana wallet signature for authentication.

### Headers
```
Authorization: Bearer <signed_solana_message>
Content-Type: application/json
```

### Example Authentication
```typescript
import { sign } from 'tweetnacl'
import { PublicKey } from '@solana/web3.js'

// Create message to sign
const message = new TextEncoder().encode(`Sign this message to authenticate: ${Date.now()}`)

// Sign with wallet
const signature = await wallet.signMessage(message)

// Include in headers
const headers = {
  'Authorization': `Bearer ${signature}`,
  'Content-Type': 'application/json'
}
```

## Rate Limiting

Endpoints are rate-limited per wallet address:

- **Public endpoints**: 100 requests/minute
- **API endpoints**: 50 requests/minute  
- **Wager creation**: 10 requests/minute
- **Trading/transfers**: 3 requests/10 seconds
- **Auth endpoints**: 5 requests/15 minutes

Rate limit headers are included in all responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1647891234
```

## Base URL

```
https://gamegambit.com/api
```

## Endpoints

### Wagers

#### Create Wager
Create a new gaming wager.

**POST** `/wagers`

##### Request Body
```json
{
  "game": "chess",
  "stake_lamports": 5000000000,
  "lichess_game_id": "abc123def456",
  "is_public": true,
  "requires_moderator": false
}
```

##### Parameters
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `game` | `string` | Yes | Game type: `chess`, `codm`, `pubg` |
| `stake_lamports` | `number` | Yes | Stake per player in lamports (1 SOL = 1e9 lamports) |
| `lichess_game_id` | `string` | No | Lichess game ID (for chess) |
| `is_public` | `boolean` | No | Make wager visible to all players (default: true) |
| `requires_moderator` | `boolean` | No | Require moderator for disputes (default: false) |

##### Response
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "match_id": 12345,
  "player_a_wallet": "G1R2k...",
  "game": "chess",
  "stake_lamports": 5000000000,
  "status": "created",
  "created_at": "2026-03-09T10:30:00Z",
  "transaction_signature": "5yBGvU...xyz"
}
```

##### Error Codes
| Code | Message |
|------|---------|
| 400 | Invalid game type |
| 400 | Insufficient balance |
| 401 | Unauthorized |
| 429 | Rate limit exceeded |

---

#### Join Wager
Join an existing wager as Player B.

**POST** `/wagers/{wager_id}/join`

##### Request Body
```json
{
  "stake_lamports": 5000000000
}
```

##### Response
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "joined",
  "player_b_wallet": "xyz789...",
  "ready_player_a": false,
  "ready_player_b": false,
  "countdown_started_at": null
}
```

---

#### Resolve Wager
Resolve a completed wager with a winner.

**POST** `/wagers/{wager_id}/resolve`

##### Request Body
```json
{
  "winner_wallet": "G1R2k...",
  "proof_url": "https://lichess.org/game123"
}
```

##### Response
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "resolved",
  "winner_wallet": "G1R2k...",
  "resolved_at": "2026-03-09T10:45:00Z",
  "transactions": [
    {
      "id": "tx-001",
      "type": "payout",
      "amount_lamports": 9500000000,
      "tx_signature": "5yBGvU..."
    }
  ]
}
```

---

#### Cancel Wager
Cancel a wager and initiate refunds to both players. Can only be called by participants when wager is in 'joined' or 'voting' status.

**POST** `/wagers/{wager_id}/cancel`

##### Request Body
```json
{
  "reason": "transaction_failed"
}
```

##### Parameters
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `reason` | `string` | No | Reason for cancellation: `user_cancelled`, `transaction_failed`, `timeout` |

##### Response
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "cancelled",
  "cancelled_at": "2026-03-09T10:40:00Z",
  "cancelled_by": "G1R2k...",
  "cancel_reason": "transaction_failed",
  "message": "Wager cancelled. Refunds will be processed automatically.",
  "refundInitiated": true
}
```

##### Error Responses
| Status | Code | Description |
|--------|------|-------------|
| `400` | `INVALID_STATUS` | Wager cannot be cancelled in current status |
| `403` | `NOT_PARTICIPANT` | Only participants can cancel the wager |
| `404` | `NOT_FOUND` | Wager not found |

##### Notes
- Cancellation triggers automatic refunds to both players
- The other player receives a notification about the cancellation
- All deposited funds are returned (minus any gas fees)
- Cancellation is logged in `wager_transactions` table

---

#### Get Wager Details
Get details of a specific wager.

**GET** `/wagers/{wager_id}`

##### Response
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "match_id": 12345,
  "player_a_wallet": "G1R2k...",
  "player_b_wallet": "xyz789...",
  "game": "chess",
  "stake_lamports": 5000000000,
  "status": "voting",
  "winner_wallet": null,
  "lichess_game_id": "abc123def456",
  "requires_moderator": false,
  "ready_player_a": true,
  "ready_player_b": true,
  "countdown_started_at": "2026-03-09T10:35:00Z",
  "created_at": "2026-03-09T10:30:00Z",
  "updated_at": "2026-03-09T10:35:00Z",
  "votes": {
    "player_a": "G1R2k...",
    "player_b": "xyz789..."
  }
}
```

---

#### List Wagers
Get paginated list of active wagers.

**GET** `/wagers?status=created&game=chess&limit=50&offset=0`

##### Query Parameters
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `status` | `string` | - | Filter by status: created, joined, voting, disputed, resolved, cancelled |
| `game` | `string` | - | Filter by game: chess, codm, pubg |
| `limit` | `number` | 50 | Results per page (max 100) |
| `offset` | `number` | 0 | Pagination offset |
| `sort` | `string` | `-created_at` | Sort field (prefix with `-` for descending) |

##### Response
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "match_id": 12345,
      "player_a_wallet": "G1R2k...",
      "game": "chess",
      "stake_lamports": 5000000000,
      "status": "created",
      "created_at": "2026-03-09T10:30:00Z"
    }
  ],
  "total": 1523,
  "limit": 50,
  "offset": 0
}
```

---

### Players

#### Get Player Profile
Get player stats and profile information.

**GET** `/players/{wallet_address}`

##### Response
```json
{
  "id": 1,
  "wallet_address": "G1R2k...",
  "username": "ChessMaster",
  "bio": "Competitive chess player",
  "avatar_url": "https://...",
  "is_banned": false,
  "verified": true,
  "total_wins": 142,
  "total_losses": 38,
  "win_rate": 78.89,
  "total_earnings": 125500000000,
  "total_spent": 50000000000,
  "current_streak": 12,
  "best_streak": 28,
  "skill_rating": 1840,
  "lichess_username": "ChessMaster2024",
  "codm_username": "CM_Warfare",
  "pubg_username": "ChessMaster_PUBG",
  "last_active": "2026-03-09T10:35:00Z",
  "created_at": "2026-01-15T08:00:00Z"
}
```

---

#### Get Leaderboard
Get top players by various metrics.

**GET** `/leaderboard?sort=earnings&limit=100&game=chess`

##### Query Parameters
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `sort` | `string` | `total_earnings` | Sort by: `total_earnings`, `total_wins`, `win_rate`, `skill_rating` |
| `limit` | `number` | 100 | Number of results (max 1000) |
| `game` | `string` | - | Filter by preferred game |

##### Response
```json
{
  "data": [
    {
      "rank": 1,
      "wallet_address": "G1R2k...",
      "username": "ChessMaster",
      "total_wins": 542,
      "total_losses": 58,
      "win_rate": 90.33,
      "total_earnings": 12550000000000,
      "skill_rating": 2400,
      "current_streak": 45
    }
  ],
  "timestamp": "2026-03-09T10:35:00Z"
}
```

---

#### Create Player Profile
Initialize a new player account.

**POST** `/players`

##### Request Body
```json
{
  "username": "NewPlayer",
  "bio": "Just getting started!",
  "preferred_game": "chess",
  "lichess_username": "NewPlayer2024"
}
```

##### Response
```json
{
  "id": 1234,
  "wallet_address": "G1R2k...",
  "username": "NewPlayer",
  "created_at": "2026-03-09T10:30:00Z"
}
```

---

#### Update Player Profile
Update player information.

**PATCH** `/players/{wallet_address}`

##### Request Body
```json
{
  "bio": "Updated bio",
  "avatar_url": "https://...",
  "lichess_username": "NewUsername",
  "codm_username": "NewCODMName"
}
```

##### Response
```json
{
  "wallet_address": "G1R2k...",
  "username": "NewPlayer",
  "bio": "Updated bio",
  "avatar_url": "https://...",
  "updated_at": "2026-03-09T10:40:00Z"
}
```

---

### Transactions

#### Get Transaction History
Get all transactions for a player.

**GET** `/players/{wallet_address}/transactions?limit=50&offset=0`

##### Response
```json
{
  "data": [
    {
      "id": "tx-550e8400-e29b-41d4-a716-446655440000",
      "wager_id": "550e8400-e29b-41d4-a716-446655440001",
      "wallet_address": "G1R2k...",
      "tx_type": "payout",
      "amount_lamports": 9500000000,
      "tx_signature": "5yBGvU...",
      "status": "confirmed",
      "created_at": "2026-03-09T10:45:00Z"
    }
  ],
  "total": 342,
  "limit": 50,
  "offset": 0
}
```

#### Transaction Fields
| Field | Type | Description |
|-------|------|-------------|
| `tx_type` | `string` | `deposit`, `withdraw`, `payout`, `refund`, `cancel_refund`, `cancelled`, `error_on_chain_resolve`, `error_resolution_call` |
| `status` | `string` | pending, confirmed, failed |
| `tx_signature` | `string` | Solana transaction hash |
| `error_message` | `string` | Error details if status is failed |

#### Transaction Types Reference
| Type | Description |
|------|-------------|
| `deposit` | Initial stake deposited to wager |
| `withdraw` | Player withdrawal request |
| `payout` | Winner receives winnings |
| `refund` | Refund on draw (both players get funds back) |
| `cancel_refund` | Refund when wager was cancelled |
| `cancelled` | Log entry for wager cancellation |
| `error_on_chain_resolve` | Error occurred during on-chain resolution to winner |
| `error_resolution_call` | Error occurred during resolution API call |

---

### Voting (Dispute Resolution)

#### Submit Vote
Vote for a winner in a disputed wager.

**POST** `/wagers/{wager_id}/votes`

##### Request Body
```json
{
  "voted_winner": "G1R2k..."
}
```

##### Response
```json
{
  "wager_id": "550e8400-e29b-41d4-a716-446655440000",
  "voter_wallet": "xyz789...",
  "voted_winner": "G1R2k...",
  "vote_timestamp": "2026-03-09T10:50:00Z"
}
```

---

#### Retract Vote
Retract a vote before the voting period ends.

**DELETE** `/wagers/{wager_id}/votes/{voter_wallet}`

##### Response
```json
{
  "success": true,
  "message": "Vote retracted successfully"
}
```

---

## Error Responses

All error responses follow this format:

```json
{
  "error": {
    "code": "INSUFFICIENT_FUNDS",
    "message": "Player balance insufficient for wager stake",
    "details": {
      "required": 5000000000,
      "available": 2000000000
    }
  }
}
```

### Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `INVALID_WALLET` | 400 | Wallet address is invalid |
| `UNAUTHORIZED` | 401 | Authentication signature invalid |
| `INSUFFICIENT_FUNDS` | 400 | Wallet balance insufficient |
| `WAGER_NOT_FOUND` | 404 | Wager does not exist |
| `INVALID_GAME_TYPE` | 400 | Game type not supported |
| `WAGER_STATUS_INVALID` | 400 | Operation invalid for current wager status |
| `DUPLICATE_JOIN` | 400 | Player already joined this wager |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error occurred |

---

## Webhooks (Optional)

Game Gambit can send webhooks for important events. Configure at `/settings/webhooks`.

### Webhook Events

#### wager.created
```json
{
  "event": "wager.created",
  "timestamp": "2026-03-09T10:30:00Z",
  "data": {
    "wager_id": "550e8400-e29b-41d4-a716-446655440000",
    "player_a": "G1R2k...",
    "game": "chess",
    "stake_lamports": 5000000000
  }
}
```

#### wager.resolved
```json
{
  "event": "wager.resolved",
  "timestamp": "2026-03-09T10:45:00Z",
  "data": {
    "wager_id": "550e8400-e29b-41d4-a716-446655440000",
    "winner": "G1R2k...",
    "loser": "xyz789...",
    "winner_payout": 9500000000
  }
}
```

---

## Examples

### Create a Wager (JavaScript)

```typescript
const createWager = async (stake, game) => {
  const message = `Sign to create wager: ${Date.now()}`
  const encodedMessage = new TextEncoder().encode(message)
  const signature = await wallet.signMessage(encodedMessage)

  const response = await fetch('https://gamegambit.com/api/wagers', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${signature}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      game: game,
      stake_lamports: stake,
      is_public: true
    })
  })

  return response.json()
}
```

### Get Leaderboard (JavaScript)

```typescript
const getLeaderboard = async (sort = 'total_earnings', limit = 100) => {
  const response = await fetch(
    `https://gamegambit.com/api/leaderboard?sort=${sort}&limit=${limit}`
  )
  return response.json()
}
```

---

## SDK

Official JavaScript SDK available:

```bash
npm install @gamegambit/sdk
```

```typescript
import { GameGambit } from '@gamegambit/sdk'

const gamegambit = new GameGambit({
  connection: connection,
  wallet: wallet
})

// Create wager
const wager = await gamegambit.wagers.create({
  game: 'chess',
  stakeLamports: 5_000_000_000
})

// Get leaderboard
const leaderboard = await gamegambit.leaderboard.get({ limit: 100 })

// Join wager
await gamegambit.wagers.join(wagerId)
```

---

**Last Updated**: March 2026  
**API Version**: 1.0.0
