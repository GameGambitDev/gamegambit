# GameGambit — Architecture: Web2 Escrow → Solana On-Chain Program

This document explains the architectural decisions behind GameGambit's escrow engine, how a traditional Web2 payment escrow maps to Solana's account model, and the tradeoffs involved.

---

## The Backend Pattern: Escrow Engine

A payment escrow is one of the most common Web2 backend patterns: two parties deposit funds into a neutral holding account, a condition is verified, and the funds release to the appropriate party. Traditional implementations rely entirely on a trusted intermediary — a bank, a payment processor, or a centralized server. GameGambit replaces this entirely with a Solana program.

---

## How This Works in Web2

A traditional escrow backend for a gaming platform would look like this:

```
Player A ──funds──▶ Bank/Stripe account (custody)
Player B ──funds──▶ Bank/Stripe account (custody)
                         │
                    Server verifies winner
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
         Winner gets 90%      Platform keeps 10%
```

**The Web2 implementation requires:**

1. **Custody** — The platform holds user funds in a bank or payment processor account. Users must trust the platform not to run off with their money.

2. **A centralized database** — Wager state (created, joined, resolved) lives in a PostgreSQL or MySQL table. A single server controls all state transitions.

3. **Manual settlement** — A server process or admin triggers fund release. If the server goes down, funds are stuck. If the server is compromised, funds can be stolen.

4. **KYC/AML compliance** — Holding user funds requires financial licensing in most jurisdictions.

5. **Dispute resolution by humans** — No cryptographic proof of who won. Disputes are resolved by customer support.

**Critical weaknesses:**
- Platform is a single point of failure and a single point of trust
- Users have no guarantee funds will be released correctly
- Regulatory overhead is enormous
- Chargebacks are possible — a player can dispute the card charge after losing

---

## How This Works on Solana

GameGambit replaces the entire custody and settlement layer with a Solana program:

```
Player A ──SOL──▶ WagerAccount PDA (program-owned)
Player B ──SOL──▶ WagerAccount PDA (program-owned)
                         │
                 Program verifies conditions
                 (authority signature + winner arg)
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
         Winner gets 90%      Platform gets 10%
         (SystemProgram transfer)  (SystemProgram transfer)
```

**Key differences:**

1. **No custody** — Funds live in a Program Derived Account (PDA) that only the program can spend. Not the platform, not the authority wallet — only valid program instructions can move the lamports.

2. **State is on-chain** — The `WagerAccount` struct is the canonical source of truth. Its `status` field is a Rust enum (`Created | Joined | Voting | Retractable | Disputed | Closed | Resolved`) enforced by the program. Invalid state transitions are rejected at the VM level.

3. **Atomic settlement** — `resolve_wager` is a single transaction that simultaneously closes the PDA and transfers lamports to winner and platform. There is no window where funds can be stuck mid-transfer.

4. **No chargebacks** — SOL transfers are irreversible. Once a player deposits into the escrow PDA, they cannot reverse it unilaterally.

5. **Cryptographic authorization** — The `resolve_wager` instruction requires a signature from the authority keypair. This is enforced by the Solana runtime — no signature, no execution.

---

## Account Model Design

### Why PDAs?

Program Derived Accounts are the core primitive that makes this possible. A PDA has no private key — it can only be spent by the program that owns it, using seeds to derive its address deterministically.

**WagerAccount PDA seeds:**
```
["wager", player_a_pubkey (32 bytes), match_id (8 bytes little-endian)]
```

This means:
- Every wager has a unique, deterministic address
- The address is derivable by anyone given player A's pubkey and the match ID
- No centralized registry is needed to look up wager accounts
- The frontend derives the PDA client-side using the same seeds

**PlayerProfile PDA seeds:**
```
["player", player_pubkey (32 bytes)]
```

One profile per wallet, globally unique, derivable without a lookup.

### Why Store Funds Directly in the PDA?

The WagerAccount PDA holds the actual SOL lamports (not a token). This means:

- Settlement is a simple `SystemProgram::transfer` from the PDA to the winner
- No token mints, no associated token accounts, no approval steps
- Gas costs are minimal (~6,725 compute units for resolve_wager, as seen in devnet transactions)
- The PDA's lamport balance is publicly auditable in real time

### Instruction Flow

```
initialize_player  →  Creates PlayerProfile PDA
        ↓
create_wager       →  Creates WagerAccount PDA, transfers stake from Player A
        ↓
join_wager         →  Player B transfers matching stake into PDA
        ↓
[game is played]
        ↓
submit_vote        →  Each player submits winner claim (CODM/PUBG)
   OR
[Lichess API auto-resolves for Chess]
        ↓
resolve_wager      →  Authority signs, 90% → winner, 10% → platform
   OR
close_wager        →  Draw or cancel: 100% → both players equally
```

### State Machine

The `WagerStatus` enum enforces valid transitions in Rust:

```rust
pub enum WagerStatus {
    Created,      // PDA exists, only Player A has deposited
    Joined,       // Both players deposited, game about to start
    Voting,       // Game in progress, awaiting vote submission
    Retractable,  // Both votes agree — 15-second retract window
    Disputed,     // Votes disagree — moderator required
    Closed,       // Draw or cancelled — funds returned
    Resolved,     // Winner paid out — PDA closed
}
```

The program rejects any instruction that would produce an invalid transition. For example, `join_wager` fails if status is not `Created`. `resolve_wager` fails if status is not `Voting` or `Joined`. This is enforced by the Solana runtime — not by application logic that could be bypassed.

---

## Chess Auto-Resolution

For Chess wagers, the settlement is fully automatic with no human in the loop:

```
Lichess game ends
       ↓
Supabase Edge Function polls Lichess API
       ↓
Matches Lichess usernames to wallet addresses (via PlayerProfile)
       ↓
Calls resolve_wager with authority keypair
       ↓
SOL releases to winner automatically
```

This is a direct replacement of the Web2 pattern where a webhook or cron job would trigger a database update and then a Stripe payout. Here, the "payout" is a signed Solana transaction — cryptographically verifiable, irreversible, and settled in ~400ms.

---

## Tradeoffs & Constraints

### What Solana Does Better

| Web2 | Solana |
|---|---|
| Funds held in custody | Funds held in program-owned PDA — trustless |
| Settlement takes days (ACH) or seconds (Stripe) with fees | Settlement in ~400ms, fee ~0.000005 SOL |
| Chargebacks possible | Irreversible by design |
| State in a database anyone could edit | State in on-chain account — program-enforced |
| Requires financial licensing to hold funds | Anyone can deploy this program |
| Audit trail requires trust in the platform | Audit trail is public and permanent on-chain |

### What Solana Sacrifices

**1. Complexity of key management**
The authority keypair must be kept secure. If lost, no wagers can be resolved. In Web2, you'd just reset a database password. Here, a lost key means permanently locked funds in any open PDAs.

**2. Account rent**
Every on-chain account costs rent (lamports proportional to byte size). WagerAccount PDAs hold ~320 bytes, costing ~0.00224 SOL. This is returned when the account is closed (on resolve or cancel), but it's an upfront cost Web2 doesn't have.

**3. No free queries**
Reading on-chain state costs RPC calls. High-frequency reads (live wager updates) are served from Supabase (off-chain mirror) to avoid hammering the RPC. This creates a dual-state architecture that must be kept in sync.

**4. Irreversibility cuts both ways**
While irreversibility protects users, it also means bugs in the program cannot be corrected for already-deployed accounts. A Web2 backend can run a database migration. An on-chain program cannot retroactively fix a resolved wager.

**5. Transaction ordering**
Solana's parallel execution means two players could theoretically both try to `join_wager` simultaneously. The program handles this with a status check (`require!(wager.status == WagerStatus::Created)`), which means only one will succeed, but it requires careful account locking.

**6. Mobile wallet complexity**
Triggering `sendTransaction` from a mobile browser requires either a dApp browser (Phantom's built-in browser) or WalletConnect. The standard browser `window.phantom` injection is not available in external browsers, requiring additional infrastructure for mobile users.

### The Dual-State Architecture

GameGambit uses Solana for financial settlement and Supabase for game state:

```
Solana (source of truth for funds)
  - WagerAccount PDA holds lamports
  - resolve_wager releases funds
  - All financial events are on-chain

Supabase (source of truth for game state)
  - Wager metadata (game type, Lichess ID, player usernames)
  - Real-time updates via Postgres Realtime
  - Vote tracking for CODM/PUBG
  - Off-chain mirror of on-chain deposit status
```

This is a deliberate tradeoff: storing game metadata on-chain would cost significant rent for string data (game IDs, usernames), and real-time updates would require constant RPC polling. Supabase handles the high-frequency read/write workload while Solana handles the financial layer where trustlessness matters.

---

## Security Model

**What the program enforces (cannot be bypassed):**
- Only the depositing player can create/join a wager
- Stake amounts must match exactly on join
- Status transitions are validated
- Only the authority can call `resolve_wager`
- Only participants can call `submit_vote`

**What the off-chain layer enforces (server-side):**
- Session token authentication (Ed25519 wallet signature → JWT)
- Lichess username verification before auto-resolution
- Rate limiting on wager creation
- Admin-only dispute resolution for non-chess games

**What the user must trust:**
- That the authority keypair is kept secure (multi-sig planned for mainnet)
- That the Lichess API result is accurate (public API, independently verifiable)
- That the Supabase mirror reflects on-chain state correctly

---

## Devnet Transactions

| Instruction | Transaction | Detail |
|---|---|---|
| `create_wager` | [`3rUc3Sb...`](https://explorer.solana.com/tx/3rUc3SbENp5UcnsLYs5AdZkPuknte4dhUYRFusxueFon7LRaSZxJvN3mBrzkQpcZEFHrJcVsHWdfcZrgLDbzG1Qf?cluster=devnet) | Player A deposits 0.5 SOL into WagerAccount PDA |
| `join_wager` | [`3tB5F8w...`](https://explorer.solana.com/tx/3tB5F8wZMkvFrfUqTw4WhrAmrohsktaxsHT7Z8iDc3wXjB54RbrDrBFt32boBRvnwek6bBVMRteachqPnMHuxnwf?cluster=devnet) | Player B matches stake — PDA now holds 1 SOL |
| `resolve_wager` | [`4amRCjE...`](https://explorer.solana.com/tx/4amRCjEFo3NwfExitnbf5F8x9asyxaxYW1tjjG8AHBznHuxER4LjyDXXMeQnTraxYMLoXJGfgprZbDrGvRZwjPBu?cluster=devnet) | Winner gets 0.9 SOL, platform gets 0.1 SOL, PDA closed |
| `close_wager` (draw) | [`63Z4uvP...`](https://explorer.solana.com/tx/63Z4uvPFpYdsMScowXQhfSk4uvfVs3hB2zBNrr2f7Jsst3odEUADFnsWXUV1TfGdu1yRWDmZ6USeGVjjYGdG3xhx?cluster=devnet) | Draw — full refund to both players |
| `close_wager` (cancel) | [`2VyA5SF...`](https://explorer.solana.com/tx/2VyA5SFMqWSKeG68aY73aYQ4gd4zFe6C2W37zAMoXPtaevpdJAyudNfSwXhnBmpVaDvMXZ9B3ScxaoHKvrA3TDyM?cluster=devnet) | Cancelled wager — on-chain refund triggered |

All transactions are finalized on Solana Devnet. The `resolve_wager` transaction shows the `WagerResolved` event emitted on-chain with `total_payout: 900,000,000` lamports and `platform_fee: 100,000,000` lamports — exactly matching the 10% fee configured in the program constants.

---

*For the full codebase see [github.com/GameGambitDev/gamegambit](https://github.com/GameGambitDev/gamegambit) and [github.com/Web3ProdigyDev/gamegambit-sol](https://github.com/Web3ProdigyDev/gamegambit-sol)*