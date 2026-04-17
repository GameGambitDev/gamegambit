# Admin Panel - Complete File Manifest

## Database Files (1 file, 241 lines)

### `/scripts/migrations/001_create_admin_tables.sql`
- SQL migration script for Supabase
- Creates 4 tables: admin_users, admin_sessions, admin_wallet_bindings, admin_audit_logs
- Sets up RLS policies, indices, and custom enum types
- Includes trigger functions for automatic timestamps and cleanup

**Status:** Ready to execute in Supabase SQL editor

---

## Type Definitions (1 file, 155 lines)

### `/src/types/admin.ts`
- TypeScript interfaces for type safety across the app
- AdminUser, AdminSession, AdminWalletBinding, AdminAuditLog types
- API response types and error handling types
- Enums for roles, statuses, and permissions

**Usage:** Import and use throughout the admin system

---

## Utility Libraries (5 files, 770 lines)

### `/src/lib/admin/password.ts` (126 lines)
- Password hashing with PBKDF2
- Password strength validation (12+ chars, mixed case, numbers, symbols)
- Timing-safe comparison to prevent timing attacks
- Functions: `hashPassword`, `comparePassword`, `validatePasswordStrength`

### `/src/lib/admin/auth.ts` (102 lines)
- JWT token generation and verification
- HS256 algorithm signing
- Token payload creation with expiry
- Functions: `generateToken`, `verifyToken`, `generateRefreshToken`

### `/src/lib/admin/validators.ts` (204 lines)
- Email format and uniqueness validation
- Password strength requirements checking
- Solana wallet address format validation
- XSS prevention via input sanitization
- Rate limit helper functions
- Functions: `validateEmail`, `validatePassword`, `validateWallet`, `sanitizeInput`

### `/src/lib/admin/wallet-verify.ts` (126 lines)
- Ed25519 signature verification for Solana wallets
- Nonce-based challenge generation
- Wallet message formatting
- Functions: `generateNonce`, `formatWalletMessage`, `verifySignature`

### `/src/lib/admin/permissions.ts` (212 lines)
- Role-based access control (RBAC) matrix
- Permission inheritance logic (superadmin > admin > moderator)
- Resource-level permission checks
- Dynamic permission validation
- Functions: `checkPermission`, `hasRole`, `getPermissionsForRole`, `canModify`

---

## Supabase Integrations (5 files, 1,399 lines)

### `/src/integrations/supabase/admin/auth.ts` (311 lines)
Core authentication operations:
- `adminSignup(email, password, name)` - Create admin account
- `adminLogin(email, password)` - Authenticate and create session
- `verifySession(token)` - Validate JWT token
- `refreshToken(token)` - Extend session
- `logout(adminId)` - End session

### `/src/integrations/supabase/admin/profile.ts` (253 lines)
Profile management:
- `getProfile(adminId)` - Fetch admin profile
- `updateProfile(adminId, data)` - Update profile info
- `updateAvatar(adminId, url)` - Set profile picture
- Includes error handling and audit logging

### `/src/integrations/supabase/admin/wallets.ts` (306 lines)
Wallet binding operations:
- `initiateWalletBinding(adminId, address)` - Start binding with challenge
- `verifyWalletSignature(adminId, address, signature, nonce)` - Complete binding
- `listWallets(adminId)` - Get all bound wallets
- `setPrimaryWallet(adminId, walletId)` - Set default wallet
- `unbindWallet(adminId, walletId)` - Remove wallet binding

### `/src/integrations/supabase/admin/audit.ts` (285 lines)
Audit trail management:
- `logAuditEvent(adminId, action, description, changes)` - Log action
- `getAuditLogs(adminId, filters)` - Query audit history
- `exportAuditLogs(adminId)` - Export to CSV
- Automatic IP and user agent tracking

### `/src/integrations/supabase/admin/sessions.ts` (234 lines)
Session lifecycle management:
- `createSession(adminId, token)` - Create session record
- `validateSession(token)` - Check session validity
- `revokeSession(sessionId)` - End specific session
- `revokeAllSessions(adminId)` - Force logout everywhere

---

## API Routes (14 files) *(v1.3.0 baseline + v1.5.0–v1.7.0 additions)*

### `/src/app/api/admin/auth/signup/route.ts`
POST endpoint for account creation
- Validates email and password
- Creates admin user
- Returns JWT token
- Sets httpOnly session cookie

### `/src/app/api/admin/auth/login/route.ts`
POST endpoint for authentication
- Verifies credentials
- Creates session
- Returns token and user data
- Sets secure cookie

### `/src/app/api/admin/auth/logout/route.ts`
POST endpoint for session termination
- Revokes session token
- Clears cookies
- Logs logout event

### `/src/app/api/admin/auth/verify/route.ts`
GET endpoint for session validation
- Verifies JWT token
- Returns current session
- Returns user data or 401

### `/src/app/api/admin/auth/refresh/route.ts`
POST endpoint for token renewal
- Validates existing token
- Issues new token
- Extends session expiry
- Returns new token

### `/src/app/api/admin/profile/route.ts`
GET/PUT endpoint for profile operations
- GET: Returns admin profile
- PUT: Updates name, bio, avatar
- Validates input
- Logs changes

### `/src/app/api/admin/wallet/bind/route.ts`
POST endpoint to initiate wallet binding
- Validates wallet address
- Creates challenge nonce
- Returns message to sign

### `/src/app/api/admin/wallet/verify/route.ts`
POST endpoint to complete wallet binding
- Verifies Ed25519 signature
- Confirms nonce match
- Marks wallet as verified
- Logs binding event

### `/src/app/api/admin/wallet/list/route.ts`
GET endpoint to list bound wallets
- Returns all wallets for admin
- Shows primary wallet indicator
- Includes binding date

### `/src/app/api/admin/wallet/unbind/route.ts`
POST endpoint to remove wallet binding
- Validates wallet exists
- Prevents removing primary wallet
- Logs unbind event
- Revokes sessions if needed

### `/src/app/api/admin/audit-logs/route.ts`
GET endpoint for audit log retrieval
- Filters by action type
- Supports date range filters
- Pagination support
- Returns formatted logs

### `/src/app/api/admin/action/route.ts` *(~128 lines — v1.5.0)*
POST endpoint for wager and player admin actions
- Actions: `forceResolve`, `forceRefund`, `markDisputed`, `banPlayer`, `unbanPlayer`, `flagPlayer`, `unflagPlayer`, `checkPdaBalance`, `addNote`
- Role-gated per action (moderator / admin / superadmin)
- Full audit log entry on every call
- Validates admin session + wallet binding

### `/src/app/api/admin/wagers/inspect/route.ts` *(~69 lines — v1.7.0)*
GET endpoint for wager lookup
- Query by wager UUID, numeric match ID, or player wallet (`?q=`)
- Returns full wager row with player details
- Min role: moderator

### `/src/app/api/admin/wagers/pda-scan/route.ts` *(~303 lines — v1.7.0)*
GET endpoint for bulk on-chain PDA scan
- Params: `status` (optional filter), `limit` (default 200, max 500), `offset`
- Returns per-wager verdict: `STUCK_FUNDS` / `ACTIVE_FUNDED` / `DISTRIBUTED` / `NOT_FOUND` / `PENDING_DEPOSIT` / `RPC_ERROR`
- Min role: moderator

---

## Custom Hooks (5 files, 707 lines)

### `/src/hooks/admin/useAdminAuth.ts` (201 lines)
Authentication state management hook
- `login(email, password)` - Sign in
- `logout()` - Sign out
- `signup(email, password, name)` - Create account
- Returns: loading state, error, user data
- Handles API calls and error management

### `/src/hooks/admin/useAdminProfile.ts` (111 lines)
Profile data management hook
- `profile` - Current profile data
- `updateProfile(data)` - Update profile info
- `isLoading` - Loading state
- `error` - Error messages
- Caches profile data in component state

### `/src/hooks/admin/useAdminWallet.ts` (262 lines)
Wallet binding management hook
- `wallets` - List of bound wallets
- `bindWallet(address)` - Initiate binding
- `unbindWallet(walletId)` - Remove binding
- `listWallets()` - Fetch all wallets
- Handles wallet verification flow

### `/src/hooks/admin/useAdminSession.ts` (132 lines)
Session lifecycle management hook
- `session` - Current session data
- `isAuthenticated` - Boolean auth status
- `logout()` - End session
- `refreshSession()` - Extend session
- Auto-refresh before expiry
- Detects and handles expiration

### `/src/hooks/admin/index.ts` (1 line)
Export barrel file for all admin hooks
- Central export point for hook usage

---

## React Components (7 files, 407 lines)

### `/src/components/admin/LoginForm.tsx` (101 lines)
Login form component
- Email and password inputs
- Form validation
- Error display
- Loading state
- Link to signup
- Handles form submission

### `/src/components/admin/SignupForm.tsx` (164 lines)
Signup form component
- Name, email, password fields
- Password confirmation
- Password strength display
- Error handling
- Success redirect
- Form validation

### `/src/components/admin/ProtectedRoute.tsx` (53 lines)
Protected route wrapper component
- Checks session validity
- Verifies role-based access
- Handles loading state
- Auto-redirects on auth failure
- Shows 403 for insufficient permissions

### `/src/components/admin/ProfileCard.tsx` (74 lines)
Admin profile display component
- Avatar with fallback
- Name and email display
- Role badge
- Account creation date
- Edit profile link

### `/src/components/admin/WalletBindForm.tsx` (81 lines)
Wallet binding form component
- Wallet address input
- Bind button with loading
- Error and success messages
- Integration with wallet signing
- Instructions for user

### `/src/components/admin/WalletsList.tsx` (81 lines)
List of bound wallets component
- Shows all wallets
- Primary indicator
- Creation dates
- Unbind button with confirmation
- Empty state display

### `/src/components/admin/index.ts` (7 lines)
Export barrel file for all admin components
- Central export point for component usage

---

## Admin Pages (17 files) *(v1.3.0 baseline + v1.5.0–v1.7.0 additions)*

### `/src/app/itszaadminlogin/layout.tsx`
Shared layout for all admin routes
- Sets metadata
- Provides consistent styling
- Background and padding

### `/src/app/itszaadminlogin/login/page.tsx`
Login page
- Uses LoginForm component
- Centered layout
- Redirects on success
- Public route

### `/src/app/itszaadminlogin/signup/page.tsx`
Signup page
- Uses SignupForm component
- Centered layout
- Redirects to login after signup
- Public route

### `/src/app/itszaadminlogin/dashboard/page.tsx`
Main admin dashboard
- Protected route with session check
- Profile summary card
- Navigation grid to other pages
- Account status display
- Logout button

### `/src/app/itszaadminlogin/profile/page.tsx`
Profile settings page
- Protected route
- Edit name and bio
- Email display (read-only)
- Save/cancel actions
- Success/error messages

### `/src/app/itszaadminlogin/wallet-bindings/page.tsx`
Wallet management page
- Protected route
- Wallet binding form
- List of bound wallets
- Instructions sidebar
- Unbind functionality

### `/src/app/itszaadminlogin/audit-logs/page.tsx`
Activity log page
- Protected route
- Logs display with formatting
- Filter by action type
- IP and user agent info
- Pagination and sorting

### `/src/app/itszaadminlogin/unauthorized/page.tsx`
403 error page
- Shows unauthorized message
- Link back to dashboard
- Proper HTTP status

### `/src/app/itszaadminlogin/disputes/page.tsx` *(~694 lines — v1.5.0)*
Dispute management page
- Full dispute queue with filters (open / assigned / resolved)
- Assign moderator, force-resolve, mark disputed actions
- Per-wager vote breakdown and timeline
- Min role: moderator

### `/src/app/itszaadminlogin/wagers/page.tsx` *(~750 lines — v1.5.0)*
Wager oversight page
- Searchable wager list with status filters
- Per-wager detail panel: players, deposits, status history
- Quick actions: forceRefund, markDisputed, addNote
- Min role: moderator

### `/src/app/itszaadminlogin/users/page.tsx` *(~641 lines — v1.5.0)*
Player management page
- Player search by wallet or username
- Suspension, flag, unflag controls
- Punishment history and behaviour log view
- Min role: admin

### `/src/app/itszaadminlogin/on-chain/page.tsx` *(~497 lines — v1.7.0)*
On-chain wager tooling page
- Manual PDA inspection by wager ID
- On-chain balance vs DB deposit cross-check
- Trigger `checkPdaBalance` admin-action
- Min role: admin

### `/src/app/itszaadminlogin/pda-scanner/page.tsx` *(~1,278 lines — v1.7.0)*
Bulk PDA scanner page
- Paginated scan of all wager PDAs (up to 500 per request)
- Per-wager verdict: `STUCK_FUNDS` / `ACTIVE_FUNDED` / `DISTRIBUTED` / `NOT_FOUND` / `PENDING_DEPOSIT` / `RPC_ERROR`
- Powered by `/api/admin/wagers/pda-scan`
- Min role: moderator

### `/src/app/itszaadminlogin/stuck-wagers/page.tsx` *(~753 lines — v1.7.0)*
Stuck wager triage page
- Filters to wagers with `STUCK_FUNDS` PDA verdict
- One-click forceRefund flow per stuck wager
- Audit trail of all refund actions taken
- Min role: admin

### `/src/app/itszaadminlogin/behaviour-flags/page.tsx` *(~512 lines — v1.7.0)*
Player behaviour flags page
- Lists flagged players with flag reason and date
- Unflag, suspend, or add note actions
- Links to per-player punishment log
- Min role: admin

### `/src/app/itszaadminlogin/username-appeals/page.tsx` *(~754 lines — v1.7.0)*
Username appeal review page
- Queue of open username ownership disputes
- Approve (transfer binding) or reject with reason
- Appeal history per player
- Min role: admin

### `/src/app/itszaadminlogin/username-changes/page.tsx` *(~656 lines — v1.7.0)*
Username change request review page
- Formal rebind requests (max 2 per game per rolling 12 months)
- Approve or reject; fires notification to player
- Change history per player
- Min role: admin

---

## Documentation Files (3 files)

### `ADMIN_IMPLEMENTATION_SUMMARY.md`
High-level overview of implementation
- Feature summary
- Architecture overview
- Environment variables needed
- Testing checklist

### `ADMIN_BUILD_COMPLETED.md`
Detailed build completion report
- Phase breakdown
- File counts and line numbers
- Feature checklist
- Next steps

### `ADMIN_SETUP_AND_CHANGES.md` (636 lines)
Complete setup guide (this file!)
- Database schema documentation
- Types and utilities overview
- Supabase integration guide
- API endpoint documentation
- Hook and component reference
- Page structure explanation
- Security features
- Environment setup
- Production deployment guide

### `ADMIN_FILES_CREATED.md`
This manifest file documenting all created files

---

## Summary Statistics

| Category | Files | Purpose |
|----------|-------|---------|
| Database | 1 | Schema and migrations |
| Types | 1 | TypeScript definitions |
| Utilities | 5 | Core business logic |
| Integrations | 5 | Supabase operations |
| API Routes | 14 | HTTP endpoints (11 auth/profile/wallet + 3 action/wager routes) |
| Hooks | 5 | React state management |
| Components | 7 | React UI components |
| Pages | 17 | Admin portal pages (8 original + 9 added v1.5.0–v1.7.0) |
| Docs | 4 | Setup and guides |
| **TOTAL** | **59** | **Production-ready admin system — v1.8.0** |

---

## How to Use This Implementation

### For Developers
1. Read `ADMIN_SETUP_AND_CHANGES.md` for complete documentation
2. Review the database schema in `001_create_admin_tables.sql`
3. Understand the API layer in API Routes section
4. Study the hooks for state management patterns
5. Customize components for your branding

### For DevOps/Admin
1. Execute the database migration
2. Set required environment variables
3. Deploy to Vercel or your hosting
4. Monitor audit logs for security
5. Setup backups and monitoring

### For Customization
1. Update colors in components
2. Add your logo and branding
3. Customize role structure if needed
4. Add additional permissions
5. Integrate with your services

---

**All files are production-ready and follow Next.js, TypeScript, and security best practices!**