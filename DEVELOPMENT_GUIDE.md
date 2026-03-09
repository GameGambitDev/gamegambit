---
title: Game Gambit Development Guide
description: Guide for developers contributing to Game Gambit
---

# Development Guide

This guide covers the development workflow, architecture decisions, and best practices for Game Gambit.

## Getting Started

### Local Development Setup

```bash
# Clone repository
git clone https://github.com/Web3ProdigyDev/gamegambit.git
cd gamegambit

# Install dependencies
pnpm install

# Setup environment variables
cp .env.example .env.local

# Start development server
pnpm dev
```

Visit `http://localhost:3000` to see the app with hot reload enabled via Turbopack.

### Environment Variables

Required variables for local development:

```env
# Solana (Devnet for testing)
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_PROGRAM_ID=<devnet_program_id>

# Supabase (local or staging)
NEXT_PUBLIC_SUPABASE_URL=<your_supabase_url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your_supabase_anon_key>
```

## Project Architecture

### Frontend Architecture

```
src/
├── app/                    # Next.js 15 App Router
│   ├── (routes)/          # Route groups for organization
│   ├── api/               # Backend API routes (200+ lines per route)
│   └── layout.tsx         # Root layout with providers
│
├── components/            # React components
│   ├── landing/           # Landing page sections
│   ├── layout/            # Persistent layout components
│   ├── modals/            # Dialog components
│   └── ui/                # Shadcn/UI primitive components
│
├── hooks/                 # Custom React hooks
│   ├── useWagers.ts       # Wager CRUD and state
│   ├── useWalletAuth.ts   # Wallet auth & signature
│   ├── useSolanaProgram.ts# Program interaction
│   └── ...
│
├── lib/                   # Pure utility functions
│   ├── idl/               # Solana IDL & types
│   ├── solana-*.ts        # Solana-specific utils
│   ├── database-*.ts      # Database optimization
│   ├── rate-limiting.ts   # Rate limiter logic
│   └── utils.ts           # General utilities
│
├── integrations/          # Third-party integrations
│   └── supabase/          # Supabase client & types
│
└── types/                 # TypeScript definitions
    └── index.ts           # Centralized type exports
```

### Key Design Patterns

#### 1. Custom Hooks for State Management
Avoid Redux - use custom hooks with SWR for client-side caching:

```typescript
// src/hooks/useWagers.ts
export function useWagers(walletAddress: string) {
  const { data, error, isLoading, mutate } = useSWR(
    walletAddress ? `/api/players/${walletAddress}/wagers` : null,
    fetcher,
    { revalidateOnFocus: false }
  )

  return {
    wagers: data,
    isLoading,
    error,
    createWager: (args) => { /* ... */ },
    joinWager: (id) => { /* ... */ }
  }
}
```

#### 2. API Routes for Backend Logic
Each API route handles one specific resource/action:

```typescript
// src/app/api/wagers/route.ts - 200-300 lines
// POST: Create wager
// GET: List wagers (with filtering)

// src/app/api/wagers/[id]/join/route.ts - 150-200 lines
// POST: Join existing wager
```

#### 3. Component Composition
Break components into smaller pieces for reusability:

```typescript
// ✓ Good: Small, focused components
<WagerCard>
  <WagerHeader />
  <WagerStats />
  <WagerActions />
</WagerCard>

// ❌ Avoid: Monolithic components
<CompleteWagerUI /> // 500+ lines
```

#### 4. Type Safety
Centralize all types in `src/types/index.ts`:

```typescript
import {
  type Player,
  type Wager,
  type WagerTransaction,
  SolanaWagerStatus,
  SolanaErrorCode,
} from '@/types'
```

## Development Workflow

### Adding a New Feature

1. **Create the database table** (if needed)
   ```bash
   # Create migration file
   supabase migration new add_feature_table
   
   # Edit migration and apply
   supabase db push
   ```

2. **Update TypeScript types**
   - Update Supabase types: `supabase gen types typescript > src/integrations/supabase/types.ts`
   - Add domain types to `src/types/index.ts`

3. **Create API routes**
   ```typescript
   // src/app/api/feature/route.ts
   export async function POST(req: Request) {
     // Validate input with Zod
     // Check authentication
     // Call database
     // Return response
   }
   ```

4. **Build React components**
   ```typescript
   // src/components/FeatureName.tsx
   import { useFeature } from '@/hooks/useFeature'
   
   export function FeatureComponent() {
     // Component logic
   }
   ```

5. **Add custom hook** (if complex state)
   ```typescript
   // src/hooks/useFeature.ts
   export function useFeature() {
     // Hook implementation
   }
   ```

6. **Update documentation**
   - Add to relevant `.md` file
   - Update API_REFERENCE.md if adding endpoints
   - Update INTEGRATION_CHECKLIST.md

### Code Standards

#### TypeScript
- Use strict mode: `"strict": true`
- Export types from single location
- Use `type` for type-only exports
- Avoid `any` - use unknown if needed

#### React
- Use functional components
- Use hooks (no class components)
- Avoid prop drilling - use context for shared state
- Memoize expensive components with `React.memo`

#### API Routes
- Validate input with Zod
- Check authentication first
- Use consistent error responses
- Include proper HTTP status codes
- Add rate limiting headers

#### Database
- Use parameterized queries
- Index frequently queried columns
- Limit queries to necessary fields
- Use materialized views for complex aggregations
- Document query performance expectations

### Testing

```bash
# Run linter
pnpm lint

# Type check
pnpm tsc --noEmit

# Build check
pnpm build
```

Before committing, ensure:
- No TypeScript errors
- No linting issues
- Code builds successfully

## Performance Optimization

### Database Queries

```typescript
// ✓ Good: Selective fields, indexed lookup
SELECT id, username, total_wins FROM players 
WHERE wallet_address = $1

// ❌ Avoid: Fetching all columns, full scan
SELECT * FROM players WHERE username ILIKE $1
```

### Component Rendering

```typescript
// ✓ Good: Memoized child components
const WagerList = React.memo(({ wagers }) => {
  return wagers.map(wager => (
    <WagerCard key={wager.id} wager={wager} />
  ))
})

// ❌ Avoid: Re-rendering entire list
function WagerList({ wagers }) {
  return wagers.map(wager => <WagerCard />)
}
```

### Caching Strategy

```typescript
// For user data (changes frequently)
useSWR('/api/player', fetcher, { revalidateOnFocus: true })

// For leaderboard (changes infrequently)
useSWR('/api/leaderboard', fetcher, { 
  revalidateOnFocus: false,
  dedupingInterval: 60000 // 1 minute
})

// For static data (never changes)
const GAME_TYPES = ['chess', 'codm', 'pubg'] // Constant
```

## Git Workflow

### Branch Naming
- Feature: `feature/short-description`
- Bug fix: `fix/short-description`
- Documentation: `docs/short-description`

### Commit Messages
```
feat: add wager voting system
fix: prevent duplicate wager joins
docs: update API reference for new endpoints
refactor: extract WagerCard component
```

### Pull Requests
1. Create branch from `main`
2. Make changes with clear commits
3. Push and create PR with description
4. Address review feedback
5. Merge after approval

## Debugging

### Console Logging
Use structured logging for debugging:

```typescript
console.log('[v0] Creating wager:', { wagerId, stake, game })
console.error('[v0] Database error:', error.message)
```

### Solana Transactions
Use Solana CLI to inspect transactions:

```bash
# Set RPC endpoint
solana config set --url https://api.devnet.solana.com

# Check transaction
solana confirm <tx_signature>
```

### Database Inspection
Connect to Supabase database directly:

```bash
# List tables
SELECT * FROM information_schema.tables WHERE table_schema = 'public'

# Query specific data
SELECT * FROM players WHERE wallet_address = '<wallet>'
```

## Deployment

### Vercel Deployment

1. **Connect GitHub repository** to Vercel
2. **Configure environment variables** in Vercel dashboard
3. **Set up database** (Supabase)
4. **Run migrations** before deploying
5. **Deploy**: Push to `main` branch

### Pre-Deployment Checklist

- [ ] All TypeScript checks pass
- [ ] No linting warnings
- [ ] Database migrations tested on staging
- [ ] Environment variables configured
- [ ] API endpoints documented
- [ ] Tests updated
- [ ] CHANGELOG updated

### Monitoring

After deployment:
- Check Vercel Analytics for performance
- Monitor Supabase database metrics
- Track error rates in Sentry (if configured)
- Monitor Solana RPC endpoint for availability

## Common Issues & Solutions

### Issue: Wallet not connecting
**Solution**: Check `NEXT_PUBLIC_SOLANA_RPC_URL` is accessible and correct network

### Issue: Database errors
**Solution**: Check Supabase connection string and that migrations have been applied

### Issue: Rate limiting errors
**Solution**: Implement exponential backoff in retry logic

### Issue: Slow queries
**Solution**: Check query plans in Supabase, add indexes, use caching

### Issue: Transaction failures
**Solution**: Check account balance, verify instruction arguments, inspect tx logs

## Resources

- [Next.js Docs](https://nextjs.org/docs)
- [React Docs](https://react.dev)
- [TypeScript Docs](https://www.typescriptlang.org/docs)
- [Supabase Docs](https://supabase.com/docs)
- [Solana Docs](https://docs.solana.com)
- [Anchor Docs](https://www.anchor-lang.com)
- [Tailwind CSS](https://tailwindcss.com/docs)

## Support

For development questions:
- Check existing documentation
- Search GitHub issues
- Ask in team Discord channel
- Create GitHub issue for bugs

---

**Last Updated**: March 2026
