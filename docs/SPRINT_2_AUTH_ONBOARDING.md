# EDUFLOW — Sprint 2: Authentication & Tenant Onboarding

## Included
- Email/password sign-up and sign-in via Supabase Auth.
- Email confirmation callback route.
- Cookie-aware session middleware for protected routes.
- Owner self-service center onboarding using `create_center_with_trial` RPC.
- Platform-admin-assisted center creation RPC for an already registered owner account, with role verification and audit logging (`admin_create_center_for_owner`).
- Workspace list based on active `center_members` memberships.
- Tenant landing page with server-side membership-protected queries under RLS.
- Sign-out action.
- Arabic-first auth UI foundation; locale plumbing remains a follow-up task.

## Required environment
```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## Supabase Auth configuration
1. Enable Email provider.
2. Set Site URL to the deployed application URL.
3. Add `http://localhost:3000/auth/callback` and the production `/auth/callback` to Redirect URLs.
4. Keep email confirmation enabled for production.
5. Ensure the `starter` plan exists and is active before testing center onboarding.

## Run
```bash
npm install
npm run dev
```

## User flow
`/signup` → confirm email → `/auth/callback?next=/onboarding` → create center → `/app` → choose workspace → `/app/[centerId]`.

## Security notes
- Passwords are handled by Supabase Auth; the app never stores password hashes.
- Protected server routes call `auth.getUser()`; do not trust client session state alone.
- Center creation uses the existing security-definer RPC, which derives the owner from `auth.uid()`.
- Center queries are subject to database RLS; never remove tenant filters from application queries as a substitute for RLS.
- The service-role key is not used in this sprint and must never be exposed to browser code.
- Admin-assisted center creation is available as a database RPC for an existing auth user; a Super Admin UI and email invitation flow are not included yet. The RPC verifies `is_platform_admin()` and writes an audit log. Do not impersonate an owner by calling the self-service RPC as an admin.

## Admin-assisted creation
Call `admin_create_center_for_owner` only from an authenticated platform-admin session, passing the existing owner user UUID. The function checks platform-admin status, creates the center, assigns the owner membership, starts the trial, and writes an audit record. A user who is not a platform admin must receive SQLSTATE `42501`.

## Manual acceptance tests
1. Sign up with a new email; verify the confirmation email and callback.
2. Attempt to access `/app` while signed out; expect redirect to `/login`.
3. Create a center with a unique slug; expect owner membership and trial subscription.
4. Create a second center under the same owner; both should appear in workspace selection.
5. Sign in as a user with no center; expect redirect to `/onboarding`.
6. Sign in as a different tenant user and try opening the first tenant URL; expect not found/denied by RLS.
7. Sign out; protected routes should redirect to `/login`.

## Not yet production-verified
This source scaffold has not been connected to a real Supabase project. Run migrations, configure Auth URLs, and execute the acceptance tests before treating it as deployed or production-ready.
