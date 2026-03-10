# Game Gambit

![Game Gambit Logo](/public/logo.png)

[![Next.js 15](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org)
[![React 18](https://img.shields.io/badge/React-18.3-blue)](https://react.dev)
[![Solana](https://img.shields.io/badge/Solana-Blockchain-9945FF)](https://solana.com)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E)](https://supabase.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-2D79C7)](https://typescriptlang.org)

**Game Gambit** is a decentralized gaming platform where players can create wagers on chess, Call of Duty Mobile, and PUBG matches on the Solana blockchain. Built for high performance with support for 200k+ monthly active users.

## Features

- **Decentralized Wagers**: Create and join gaming matches with Solana blockchain settlement
- **Multi-Game Support**: Chess (Lichess integration), Call of Duty Mobile, PUBG
- **Real-Time Leaderboard**: Live player rankings with skill ratings
- **Voting System**: Dispute resolution with player voting
- **NFT Rewards**: Victory NFTs for achievements and streaks
- **Transaction History**: Complete audit trail of all blockchain transactions
- **Performance Optimized**: Handles 200k+ MAUs with sub-100ms query latency
- **Progressive Web App**: Installable on iOS/Android with offline support
- **Mobile Optimized**: Fully responsive design with mobile-first approach

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 15, React 18, TypeScript 5.8 |
| **Styling** | Tailwind CSS 3.4, Radix UI components |
| **Database** | Supabase PostgreSQL with Row-Level Security |
| **Blockchain** | Solana Web3.js, Anchor Framework |
| **Authentication** | Solana Wallet Adapter |
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
git clone https://github.com/Web3ProdigyDev/gamegambit.git
cd gamegambit

# Install dependencies
pnpm install

# Setup environment variables
cp .env.example .env.local
```

### Environment Variables

```env
# Solana Configuration
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta
NEXT_PUBLIC_PROGRAM_ID=E2Vd3U91kMrgwp8JCXcLSn7bt3NowDmGwoBYsVRhGfMR

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Optional: Lichess API
NEXT_PUBLIC_LICHESS_API_URL=https://lichess.org/api
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

## Project Structure

```
gamegambit/
├── src/
│   ├── app/                    # Next.js 15 App Router
│   │   ├── api/               # API routes
│   │   ├── arena/             # Wager creation & matching
│   │   ├── dashboard/         # User statistics
│   │   ├── leaderboard/       # Rankings & stats
│   │   ├── profile/           # User profiles
│   │   └── page.tsx           # Landing page
│   │
│   ├── components/            # React components
│   │   ├── landing/           # Landing page sections
│   │   ├── layout/            # Layout components
│   │   ├── modals/            # Dialog modals
│   │   └── ui/                # Shadcn/UI components
│   │
│   ├── hooks/                 # Custom React hooks
│   │   ├── useWagers.ts       # Wager state management
│   │   ├── useWalletAuth.ts   # Wallet authentication
│   │   ├── useSolanaProgram.ts # Program interaction
│   │   └── ...
│   │
│   ├── lib/                   # Utility functions
│   │   ├── idl/               # Solana IDL files
│   │   ├── solana-program-utils.ts
│   │   ├── solana-event-bridge.ts
│   │   ├── database-optimization.ts
│   │   ├── rate-limiting.ts
│   │   └── ...
│   │
│   ├── integrations/          # Third-party integrations
│   │   └── supabase/          # Supabase client & types
│   │
│   └── types/                 # TypeScript definitions
│
├── public/                    # Static assets
├── docs/                      # Documentation files
│   ├── DB_SCHEMA.md          # Database schema reference
│   ├── BACKEND_ARCHITECTURE.md
│   ├── SOLANA_IDL_INTEGRATION.md
│   └── INTEGRATION_CHECKLIST.md
│
└── package.json              # Dependencies & scripts
```

## Documentation

### Core Documentation

- **[Database Schema](./DB_SCHEMA.md)** - PostgreSQL tables, relationships, indexes
- **[Backend Architecture](./BACKEND_ARCHITECTURE.md)** - Performance optimization for 200k+ MAUs
- **[Solana IDL Integration](./SOLANA_IDL_INTEGRATION.md)** - Smart contract type system
- **[Integration Checklist](./INTEGRATION_CHECKLIST.md)** - Development progress tracking

### Key Features

#### Wager Creation
Players create wagers by selecting a game, stake amount, and opponent. Transactions are settled on Solana with automatic payouts.

**Flow**: Create → Join → Ready Room → Match → Voting → Resolution

#### Error Recovery & Refunds
- **Cancel Wager**: Players can cancel during ready room if errors occur
- **Automatic Refunds**: Both players automatically refunded on cancellation
- **Error Notifications**: Other player notified when wager is cancelled
- **Transaction Logging**: All errors logged for debugging and support

#### Game Results
- **Victory Screen**: Animated trophy with confetti for winners
- **Defeat Screen**: Consolation message with winner info for losers
- **Draw Screen**: Refund information with scale animation

#### Multi-Game Support
- **Chess**: Integrated with Lichess API for live game data
- **Call of Duty Mobile**: Leaderboard-based rank validation
- **PUBG**: Streamer.gg integration for match statistics

#### Leaderboard System
Real-time rankings calculated from:
- Total wins/losses
- Win rate percentage
- Total earnings in SOL
- Skill rating (ELO-style)
- Current streaks

#### NFT Rewards
Victory NFTs minted to Solana with tier progression:
- Bronze: First victory
- Silver: 5+ consecutive wins
- Gold: 10+ consecutive wins
- Platinum: 20+ consecutive wins

## API Reference

### Authentication
All authenticated endpoints require a signed Solana message in headers:
```javascript
Authorization: Bearer <signed_message>
```

### Key Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/wagers` | Create a new wager |
| `POST` | `/api/wagers/[id]/join` | Join existing wager |
| `POST` | `/api/wagers/[id]/resolve` | Resolve wager with winner |
| `GET` | `/api/players/[wallet]` | Get player profile |
| `GET` | `/api/leaderboard` | Get top 100 players |

See individual route files in `src/app/api/` for detailed documentation.

## Database

Game Gambit uses Supabase PostgreSQL with optimizations for high-traffic queries:

### Key Tables
- `players` - User accounts with stats
- `wagers` - Gaming matches & bets
- `wager_transactions` - Solana blockchain transactions
- `nfts` - Victory NFTs
- `achievements` - User badges & milestones

### Optimization Strategies
- Materialized views for leaderboard calculations
- Composite indexes for 1000x query speedup
- Row-level security for data isolation
- Connection pooling for 200k+ concurrent users

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
2. **Add database migrations**: `supabase/migrations/`
3. **Build components**: `src/components/`
4. **Add types**: `src/types/index.ts`
5. **Update docs**: Add to relevant `.md` files

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

The project is deployed on Vercel with:
- Automatic deployments on Git push
- Environment variables configured in Vercel dashboard
- Database migrations applied before deployment
- Performance monitoring via Vercel Analytics

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

- **Wallet Verification**: All transactions require valid Solana signatures
- **Row-Level Security**: PostgreSQL RLS policies for data isolation
- **Rate Limiting**: Per-wallet and per-IP rate limits
- **SQL Injection Prevention**: Parameterized queries throughout
- **Input Validation**: Zod schemas on all API endpoints

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

- [ ] Mobile app (React Native)
- [ ] Additional games (Fortnite, Valorant)
- [ ] Tournament mode with brackets
- [ ] Streaming integration (Twitch, YouTube)
- [ ] Advanced analytics dashboard
- [ ] Cross-chain settlement (Ethereum, Polygon)
- [ ] Web3 messaging for direct player communication
- [ ] Sponsor integration for prize pools

---

**Made with ❤️ by Web3ProdigyDev**
