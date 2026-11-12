# EDUFLOW — Sprint 8

**Parent Portal & Student Progress** — continuation of the multi-tenant EDUFLOW SaaS starter.

## New capabilities

- Secure guardian account invitations and claims.
- Parent dashboard for linked children: attendance, upcoming sessions, assessments, invoices, payments, receipt references.
- Staff invitation management and transactional group assessment entry.
- Parent-specific row-level security policies.

## Quick start

1. Copy `.env.example` to `.env.local` and configure the Supabase URL and anon key.
2. Install dependencies with `npm ci`.
3. Apply Supabase migrations in order, `0001` through `0010`.
4. Run `npm run dev`.

See [Sprint 8 implementation and security notes](docs/SPRINT_8_PARENT_PORTAL.md).

## Important

This is a development starter, not a production-certified deployment. The new migration and routes have not been run against a live Supabase project in this environment. Run typecheck, lint, build, and the RLS verification checklist before deployment. External messaging and receipt PDF downloads are not enabled.


## Sprint 9 — Platform Control Plane

See `docs/SPRINT_9_PLATFORM_CONTROL_PLANE.md`. Apply migration `0011_platform_control_plane.sql` after Sprint 8. Super Admin dashboard is available at `/platform` for accounts registered in `public.platform_admins`.


## Sprint 10 — Billing Foundation

See `docs/SPRINT_10_BILLING_READINESS.md`. Apply migration `0012_billing_foundation.sql` after Sprint 9. Configure server-only `BILLING_WEBHOOK_SECRET`, `CRON_SECRET`, and `SUPABASE_SERVICE_ROLE_KEY` when deploying the trusted billing adapter and hourly Vercel Cron. No live gateway is connected in this sprint.


## Sprint 11 — Paymob checkout

See `docs/SPRINT_11_PAYMOB_INTEGRATION.md` for the Paymob Intention API, Unified Checkout, HMAC-SHA512 callback, environment variables, dashboard setup, and sandbox QA checklist. Apply migration `0013_paymob_checkout.sql` after Sprint 10.


## Sprint 12 — Security, QA & Production Launch

See `docs/SPRINT_12_SECURITY_QA_LAUNCH.md`. Apply migration `0014_production_security_hardening.sql` after Sprint 11. Run `npm test` for the Paymob HMAC unit tests. This sprint adds baseline security headers, stricter webhook configuration checks, request-size limits, least-privilege billing grants, and CI checks. The integration is not declared production-live until staging migrations, Paymob sandbox, and deployment checks pass.
