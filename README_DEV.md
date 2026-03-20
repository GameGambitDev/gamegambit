# Game Gambit

![Game Gambit Logo](/public/logo.png)

[![Next.js 15](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org)
[![React 18](https://img.shields.io/badge/React-18.3-blue)](https://react.dev)
[![Solana](https://img.shields.io/badge/Solana-Blockchain-9945FF)](https://solana.com)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E)](https://supabase.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-2D79C7)](https://typescriptlang.org)

**Game Gambit** is a decentralized gaming platform where players can create wagers on chess, Call of Duty Mobile, and PUBG matches on the Solana blockchain. Built for high performance with support for 200k+ monthly active users.

## Live Links

| | |
|---|---|
| **Deployed App** | https://thegamegambit.vercel.app |
| **Admin Panel** | https://thegamegambit.vercel.app/itszaadminlogin |

## Features

### Player Features
- **Decentralized Wagers**: Create and join gaming matches with Solana blockchain settlement
- **Multi-Game Support**: Chess (Lichess OAuth PKCE + platform token game creation), Call of Duty Mobile, PUBG
- **Real-Time Leaderboard**: Live player rankings with skill ratings
- **Voting System**: Dispute resolution with player voting
- **NFT Rewards**: Victory NFTs for achievements and streaks
- **Transaction History**: Complete audit trail of all blockchain transactions with Solana Explorer links
- **Performance Optimized**: Handles 200k+ MAUs with sub-100ms query latency
- **Progressive Web App**: Installable on iOS/Android with offline support
- **Mobile Optimized**: Fully responsive design with mobile-first approach
- **Automated Fund Distribution**: Funds automatically distributed to winners post-game with on-chain validation
- **Animated Game Results**: Victory/defeat/draw modals with confetti and animations auto-trigger on resolution

### Admin Features
- **Hybrid Authentication**: Email/password signup + optional Solana wallet binding
- **Admin Dashboard**: Centralized control panel at `/itszaadminlogin`
- **Wallet Management**: Bind and verify multiple Solana wallets per admin account
- **Role-Based Access Control**: Three-tier hierarchy (moderator, admin, superadmin) with granular permissions
- **Comprehensive Audit Logging**: Complete action history with IP tracking and user agent logging
- **Session Management**: Secure httpOnly cookies with automatic token refresh
- **Profile Management**: Update admin information, manage avatars, two-factor authentication support

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 15, React 18, TypeScript 5.8 |
| **Styling** | Tailwind CSS 3.4, Radix UI components |
| **Database** | Supabase PostgreSQL with Row-Level Security |
| **Blockchain** | Solana Web3.js, Anchor Framework |
| **Authentication** | Solana Wallet Adapter + Lichess OAuth PKCE |
| **Chess** | Lichess Public API + Platform Token game creation |
| **Caching** | Upstash Redis + In-Memory Cache |
| **Analytics** | DuckDB (optional) |

## Getting Started

### Prerequisites

- Node.js 18+ and npm/pnpm
- Solana Devnet/Mainnet wallet (Phantom, Magic Eden, etc.)
- Supabase account

### Installation

```bash
# Clone the repository
git clone https://github.com/GameGambitDev/gamegambit.git
cd gamegambit

# Install dependencies
pnpm install

# Setup environment variables
cp .env.example .env.local
```

### Environment Variables

```env
# Solana Configuration
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_PROGRAM_ID=E2Vd3U91kMrgwp8JCXcLSn7bt3NowDmGwoBYsVRhGfMR

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# App URL — used for Lichess OAuth PKCE callback
NEXT_PUBLIC_SITE_URL=https://thegamegambit.vercel.app

# Admin Authentication (Required for /itszaadminlogin)
ADMIN_JWT_SECRET=your_jwt_secret_key_min_32_chars
ADMIN_SESSION_TIMEOUT=3600000
ADMIN_REFRESH_TIMEOUT=604800000
NEXT_PUBLIC_ADMIN_SOLANA_NETWORK=devnet
ADMIN_SMTP_HOST=smtp.your-email.com
ADMIN_SMTP_PORT=587
ADMIN_SMTP_USER=your-email@example.com
ADMIN_SMTP_PASSWORD=your-app-password

# Edge function secrets (set in Supabase Dashboard → Edge Functions → Secrets)
AUTHORITY_WALLET_SECRET=[your,keypair,bytes,array]
SOLANA_RPC_URL=https://api.devnet.solana.com
LICHESS_PLATFORM_TOKEN=your_gamegambit_lichess_account_token
```

### Running Locally

```bash
# Development server with Turbopack
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Run linter
pnpm lint
```

Visit `http://localhost:3000` to see the application.

### Database Setup

Run `gamegambit-setup.sql` in Supabase SQL Editor — creates all tables, indexes, constraints, RLS policies, RPC functions, and Realtime subscriptions in one shot.

#### Wager Cancellation Features
After deploying wager cancellation features, you need to update your database schema:

**See [SETUP_WAGER_CANCELLATION.md](./SETUP_WAGER_CANCELLATION.md) for detailed instructions.**

Quick setup:
1. Go to Supabase SQL Editor
2. Run the SQL in `WAGER_CANCELLATION_SETUP.sql`
3. Verify columns were created

#### Admin Panel Setup
To enable the admin authentication system at `/itszaadminlogin`:

1. **Run the migration**: Execute `scripts/migrations/001_create_admin_tables.sql` in Supabase SQL Editor
2. **Set environment variables**: Add all `ADMIN_*` variables to your `.env.local` (see Environment Variables section above)
3. **Generate JWT secret**: `openssl rand -base64 32`
4. **Access admin portal**: Navigate to `http://localhost:3000/itszaadminlogin`

**See [ADMIN_SETUP_AND_CHANGES.md](./ADMIN_SETUP_AND_CHANGES.md) for complete setup guide.**

## Project Structure

```
gamegambit/
├── src/
│   ├── app/                    # Next.js 15 App Router
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   └── lichess/
│   │   │   │       └── callback/ # Lichess OAuth PKCE callback route
│   │   │   ├── admin/            # Admin API endpoints (auth, profile, wallet, audit)
│   │   │   └── ...               # Player API routes
│   │   ├── itszaadminlogin/   # Admin panel routes
│   │   │   ├── login/
│   │   │   ├── signup/
│   │   │   ├── dashboard/
│   │   │   ├── profile/
│   │   │   ├── wallet-bindings/
│   │   │   ├── audit-logs/
│   │   │   └── unauthorized/
│   │   ├── arena/             # Wager creation & matching
│   │   ├── dashboard/         # User statistics
│   │   ├── leaderboard/       # Rankings & stats
│   │   ├── profile/           # User profiles
│   │   └── page.tsx           # Landing page
│   │
│   ├── components/            # React components
│   │   ├── admin/             # Admin UI components
│   │   │   ├── LoginForm.tsx
│   │   │   ├── SignupForm.tsx
│   │   │   ├── ProtectedRoute.tsx
│   │   │   ├── ProfileCard.tsx
│   │   │   ├── WalletBindForm.tsx
│   │   │   └── ...
│   │   ├── landing/           # Landing page sections
│   │   ├── layout/            # Layout components
│   │   ├── CreateWagerModal.tsx  # Wager creation (chess time control, Lichess status)
│   │   ├── ReadyRoomModal.tsx    # Ready room + deposit flow + Lichess play links
│   │   └── ui/                # Shadcn/UI components
│   │
│   ├── hooks/                 # Custom React hooks
│   │   ├── admin/             # Admin-specific hooks
│   │   │   ├── useAdminAuth.ts
│   │   │   ├── useAdminProfile.ts
│   │   │   ├── useAdminWallet.ts
│   │   │   └── useAdminSession.ts
│   │   ├── useLichess.ts      # OAuth PKCE flow, connect/disconnect, game hooks
│   │   ├── useWagers.ts       # Wager state management
│   │   ├── usePlayer.ts       # Player data hooks
│   │   ├── useSolanaProgram.ts # Program interaction
│   │   ├── useWalletAuth.ts   # Wallet session tokens
│   │   └── ...
│   │
│   ├── lib/                   # Utility functions
│   │   ├── admin/             # Admin utilities
│   │   │   ├── password.ts    # PBKDF2 hashing
│   │   │   ├── auth.ts        # JWT operations
│   │   │   ├── validators.ts  # Input validation
│   │   │   ├── wallet-verify.ts # Solana signature verification
│   │   │   └── permissions.ts # RBAC matrix
│   │   ├── idl/               # Solana IDL files
│   │   ├── solana-program-utils.ts
│   │   ├── solana-event-bridge.ts
│   │   ├── database-optimization.ts
│   │   ├── rate-limiting.ts
│   │   └── ...
│   │
│   ├── integrations/          # Third-party integrations
│   │   └── supabase/
│   │       ├── client.ts
│   │       ├── types.ts       # Auto-generated DB types (regen after migrations)
│   │       └── admin/         # Admin database operations
│   │           ├── auth.ts
│   │           ├── profile.ts
│   │           ├── wallets.ts
│   │           ├── audit.ts
│   │           └── sessions.ts
│   │
│   ├── types/                 # TypeScript definitions
│   │   ├── admin.ts           # Admin types & interfaces
│   │   └── ...
│   │
├── supabase/
│   └── functions/
│       ├── secure-wager/      # Wager actions + Lichess platform game creation
│       └── secure-player/     # Player profile management
│
├── scripts/
│   └── migrations/
│       └── 001_create_admin_tables.sql
│
├── public/                    # Static assets
├── docs/                      # Documentation files
│   ├── DB_SCHEMA.md
│   ├── BACKEND_ARCHITECTURE.md
│   ├── SOLANA_IDL_INTEGRATION.md
│   └── INTEGRATION_CHECKLIST.md
│
├── gamegambit-setup.sql           # Full DB setup in one file
├── ADMIN_SETUP_AND_CHANGES.md
├── ADMIN_FILES_CREATED.md
├── ADMIN_IMPLEMENTATION_SUMMARY.md
├── ADMIN_BUILD_COMPLETED.md
└── package.json
```

## Documentation

### Core Documentation

- **[Database Schema](./DB_SCHEMA.md)** - PostgreSQL tables, relationships, indexes
- **[Backend Architecture](./BACKEND_ARCHITECTURE.md)** - Performance optimization for 200k+ MAUs
- **[Solana IDL Integration](./SOLANA_IDL_INTEGRATION.md)** - Smart contract type system
- **[Integration Checklist](./INTEGRATION_CHECKLIST.md)** - Development progress tracking

### Admin Panel Documentation

- **[Admin Setup Guide](./ADMIN_SETUP_AND_CHANGES.md)** - Complete installation and configuration instructions
- **[Admin Files Created](./ADMIN_FILES_CREATED.md)** - Detailed manifest of all 47 files with purposes
- **[Implementation Summary](./ADMIN_IMPLEMENTATION_SUMMARY.md)** - Feature overview and API reference
- **[Build Statistics](./ADMIN_BUILD_COMPLETED.md)** - Development breakdown by phase

## Key Features

### Chess — Lichess OAuth PKCE
Players connect their Lichess account via OAuth PKCE — proves account ownership without sharing any password or token with GameGambit. When both players deposit their stakes and the wager enters `voting`, the platform automatically creates a locked Lichess game using a server-side platform token with `users=PlayerA,PlayerB`. Each player gets a per-color play link directly in the Ready Room. When the game ends on Lichess, GameGambit detects it within seconds and automatically pays out the winner on-chain.

**Flow**: Connect Lichess (OAuth) → Create Wager → Both Deposit → Game Auto-Created → Play on Lichess → Auto-Resolved → Winner Paid

### Wager Creation
Players create wagers by selecting a game, stake amount, and opponent. Transactions are settled on Solana with automatic payouts.

**Flow**: Create → Join → Ready Room → Deposits → Match → Voting → Resolution

### Error Recovery & Refunds
- **Cancel Wager**: Players can cancel during ready room if errors occur
- **Automatic Refunds**: Both players automatically refunded on cancellation
- **Error Notifications**: Other player notified when wager is cancelled
- **Transaction Logging**: All errors logged for debugging and support

### Game Results
- **Victory Screen**: Animated trophy with confetti for winners
- **Defeat Screen**: Consolation message with winner info for losers
- **Draw Screen**: Refund information with scale animation

### Multi-Game Support
- **Chess**: Lichess OAuth PKCE — auto-create games server-side, per-color play links, automatic result verification
- **Call of Duty Mobile**: Coming soon
- **PUBG**: Coming soon

### Leaderboard System
Real-time rankings calculated from:
- Total wins/losses
- Win rate percentage
- Total earnings in SOL
- Skill rating (ELO-style)
- Current streaks

### NFT Rewards
Victory NFTs minted to Solana with tier progression:
- Bronze: First victory
- Silver: 5+ consecutive wins
- Gold: 10+ consecutive wins
- Platinum: 20+ consecutive wins

## API Reference

### Authentication
All authenticated edge function calls require a wallet session token:
```javascript
headers: { 'X-Session-Token': sessionToken }
```

### Key Edge Functions

| Function | Actions |
|----------|---------|
| `secure-wager` | `create`, `join`, `vote`, `edit`, `delete`, `setReady`, `startGame`, `recordOnChainCreate`, `recordOnChainJoin`, `checkGameComplete`, `cancelWager` |
| `secure-player` | `create`, `update` |

### Key Next.js API Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/auth/lichess/callback` | Lichess OAuth PKCE callback |
| `POST` | `/api/wagers` | Create a new wager |
| `POST` | `/api/wagers/[id]/join` | Join existing wager |
| `POST` | `/api/wagers/[id]/resolve` | Resolve wager with winner |
| `GET` | `/api/players/[wallet]` | Get player profile |
| `GET` | `/api/leaderboard` | Get top 100 players |

## Database

Game Gambit uses Supabase PostgreSQL with optimizations for high-traffic queries.

### Key Tables
- `players` - User accounts with stats + Lichess OAuth data
- `wagers` - Gaming matches with chess time control + Lichess colored URLs
- `wager_transactions` - Solana blockchain transactions
- `nfts` - Victory NFTs
- `achievements` - User badges & milestones

### Optimization Strategies
- Materialized views for leaderboard calculations
- Composite indexes for 1000x query speedup
- Row-level security for data isolation
- Connection pooling for 200k+ concurrent users

### Regenerating Types
After any DB migration:
```bash
supabase gen types typescript --project-id your_project_ref > src/integrations/supabase/types.ts
```

See [DB_SCHEMA.md](./DB_SCHEMA.md) for complete schema documentation.

## Performance

Game Gambit is optimized to handle **200,000+ monthly active users** with sub-100ms latency:

### Benchmarks (Target)
| Query | Target | Optimization |
|-------|--------|-------------|
| Single player lookup | < 10ms | Cached, indexed |
| Leaderboard (top 100) | < 50ms | Materialized view |
| Wager creation | 100-300ms | Batch processing |
| Live feed | < 30ms | Redis cache |

### Caching Strategy
Three-tier architecture:
1. **Edge Cache** (CDN) - Static assets, 5-60 min
2. **Application Cache** (Redis) - Hot data, 30s-10min
3. **Database** (PostgreSQL views) - Denormalized data

See [BACKEND_ARCHITECTURE.md](./BACKEND_ARCHITECTURE.md) for detailed optimization guide.

## Development

### Adding Features

1. **Create API route**: `src/app/api/[feature]/route.ts`
2. **Add database migrations**: Run SQL in Supabase SQL Editor
3. **Regenerate types**: `supabase gen types typescript ...`
4. **Build components**: `src/components/`
5. **Add hooks**: `src/hooks/`
6. **Update docs**: Add to relevant `.md` files

### Testing

```bash
# Run linter
pnpm lint

# Build check
pnpm build

# Format code
pnpm format
```

### Deployment

```bash
# Deploy edge functions
supabase link --project-ref your_project_ref
supabase functions deploy secure-wager
supabase functions deploy secure-player

# Frontend deploys automatically via Vercel on push to main
```

## Rate Limiting

API endpoints are rate-limited per wallet address:

```typescript
// Configuration by endpoint type
const configs = {
  public: { windowMs: 60s, maxRequests: 100 },
  api: { windowMs: 60s, maxRequests: 50 },
  auth: { windowMs: 900s, maxRequests: 5 },
  wagerCreation: { windowMs: 60s, maxRequests: 10 },
};
```

See `src/lib/rate-limiting.ts` for implementation.

## Security

### Player Security
- **Wallet Verification**: All transactions require valid Solana signatures
- **Lichess OAuth PKCE**: Proves Lichess account ownership — no passwords or tokens shared with GameGambit
- **Row-Level Security**: PostgreSQL RLS policies for data isolation
- **Rate Limiting**: Per-wallet and per-IP rate limits
- **SQL Injection Prevention**: Parameterized queries throughout
- **Input Validation**: Zod schemas on all API endpoints

### Admin Panel Security
- **Password Security**: PBKDF2 hashing with 100,000 iterations
- **Session Management**: httpOnly, Secure, SameSite cookies with automatic refresh
- **JWT Authentication**: Ed25519 signed tokens with expiry validation
- **Wallet Verification**: Ed25519 signature verification for Solana wallet binding
- **Row-Level Security**: Database-level RLS policies per admin account
- **Audit Logging**: Complete action history with IP, user agent, and timestamp tracking
- **Role-Based Access**: Three-tier permission matrix (moderator, admin, superadmin)
- **Token Hashing**: Refresh tokens hashed before storage in database

## Progressive Web App (PWA)

Game Gambit is fully configured as a Progressive Web App, allowing players to:

### Features
- **Install on Home Screen**: Add to iOS/Android home screen without app store
- **Offline Support**: Access cached content when disconnected from internet
- **Push Notifications**: Real-time alerts for match invitations and results
- **Fast Loading**: Service worker caches assets for lightning-fast load times
- **App-like Experience**: Standalone fullscreen mode without browser UI

### Installation

**On Mobile:**
1. Open Game Gambit in your mobile browser
2. Look for "Add to Home Screen" or "Install App" prompt
3. Tap to install - the app will appear as a native app on your home screen

**On Desktop (Chrome/Edge):**
1. Visit the site and click the install icon in the address bar (if present)
2. Or right-click → Create shortcut

### PWA Configuration
- **Manifest**: `/public/manifest.json` - App metadata and icons
- **Service Worker**: `/public/sw.js` - Caching and offline support
- **Setup Component**: `src/components/PWASetup.tsx` - Initialization logic

### Offline Capabilities
- View cached player profiles and leaderboard
- Browse recent match history
- Check wallet balance (last synced data)
- Create wagers queue (synced when online)

## Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

## License

This project is licensed under the MIT License - see LICENSE file for details.

## Support

For issues, questions, or suggestions:
- Open an issue on GitHub
- Contact: [support@gamegambit.com](mailto:support@gamegambit.com)

## Roadmap

- [ ] PUBG integration (official API)
- [ ] Free Fire integration
- [ ] CODM integration
- [ ] Mobile app (React Native)
- [ ] Tournament mode with brackets
- [ ] Streaming integration (Twitch, YouTube)
- [ ] Advanced analytics dashboard
- [ ] Cross-chain settlement (Ethereum, Polygon)
- [ ] Web3 messaging for direct player communication
- [ ] Sponsor integration for prize pools

---

**Made with ❤️ by Web3ProdigyDev**