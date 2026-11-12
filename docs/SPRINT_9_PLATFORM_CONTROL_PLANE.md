# EDUFLOW Sprint 9 — Super Admin & SaaS Control Plane

## Delivered

- `/platform` Super Admin workspace with platform KPIs, center inventory, subscriptions, plans, users, global settings, and the latest 100 audit events and the latest 200 registered users.
- Platform-only authorization checked on the server page and in every server action. Database RPCs repeat the authorization check and run as `SECURITY DEFINER` with an empty search path.
- Plan editing: Arabic/English names, monthly/yearly EGP prices, trial duration, student/staff limits, and visibility/active state.
- Subscription controls: status transitions, plan assignment, trial/period extension, and center access suspension/restoration.
- Platform settings: default trial duration, default language, and maintenance-mode flag.
- Platform administrator grant/revoke for registered users, with self-revocation blocked.
- Platform-wide audit events for plan, subscription, access, settings, and administrator changes.
- `platform_dashboard_data()` returns a bounded dashboard payload (including the latest 100 audit rows); no service-role key is used in the app.

## Migration

Apply `supabase/migrations/0011_platform_control_plane.sql` after migrations `0001`–`0010`.

The global trial setting updates `plans.trial_days` for all plans at the time it is saved. An administrator can subsequently customize an individual plan's trial duration from that plan's editor. Saving the global setting is therefore a bulk reset of every plan's trial duration. Existing subscriptions are not retroactively changed by editing a plan or the global default.

## Important commercial limitations

- Revenue KPI is **estimated monthly recurring value** from active subscription plan prices, not collected cash, recognized accounting revenue, or payment-gateway settlement.
- No payment gateway, tax invoice, refund, proration, coupon, or automated renewal integration is included.
- Subscription status and dates are manually controlled by Super Admin. A production billing provider/webhook layer is a separate integration.
- Maintenance mode is stored as a product setting; middleware enforcement and a customer-facing maintenance page still need to be wired before using it operationally. The default language setting is applied to newly created centers; existing centers are not changed.
- Platform admin assignment is restricted to existing registered accounts. Initial bootstrap of the first platform admin remains a trusted database operation (insert the account UUID into `public.platform_admins`).
- User administration currently covers platform-admin privilege only; it does not yet provide account deletion, email changes, forced password reset, or full center-membership editing.
- Audit log metadata is JSON and can include operational details. Define a retention policy and avoid writing secrets or unnecessary personal data into metadata.

## Security notes

- The page checks `auth.getUser()` and `is_platform_admin()` before loading the dashboard.
- Each action checks the authenticated user again.
- Each privileged SQL RPC independently checks `auth.uid()` and `is_platform_admin()`; client-supplied roles are never trusted.
- Global audit records use `center_id = null`; only platform admins can read them under the existing audit-log RLS policy.
- Never expose Supabase service-role credentials to browser code.

## Verification status

The migration and application code are included in the project. This environment does not contain the project's installed npm dependencies or a connected Supabase project, so a production build, migration application, and live RLS/RPC integration tests have not been confirmed. Run `npm install`, `npm run typecheck`, `npm run lint`, `npm run build`, then apply migrations to a staging Supabase project and test with both platform-admin and ordinary accounts before release.
