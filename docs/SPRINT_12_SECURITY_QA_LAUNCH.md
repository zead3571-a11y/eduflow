# EDUFLOW — Sprint 12: Security, QA & Production Launch

## Delivered in this sprint

- Extracted Paymob SHA-512 HMAC calculation and constant-time verification into a small testable server module.
- Added automated Node.js tests for valid HMAC, tampered payload, and malformed signatures.
- Paymob webhook now fails closed if `PAYMOB_MODE` or the allowed Integration ID list is missing.
- Paymob webhook requires the callback's `is_live` flag to match configured test/live mode.
- Paymob webhook enforces a 256 KB request body ceiling (including chunked requests).
- Failed Paymob transactions with `error_occured=true` are recorded as failed rather than rejected before reaching the billing ledger.
- Added baseline HTTP security headers: HSTS, frame denial, MIME sniffing protection, restrictive referrer policy, and disabled unused browser permissions.
- Added least-privilege SQL grants for subscription billing tables. Authenticated users can read only invoice/payment rows permitted by existing RLS; webhook inbox is service-role only.
- Added a GitHub Actions quality workflow for tests, typecheck, lint, and production build.
- Added a pre-launch checklist and operational runbook.

## Database migration

Apply `supabase/migrations/0014_production_security_hardening.sql` after `0013_paymob_checkout.sql`.

The migration does not create client write policies. It revokes direct writes from `anon` and `authenticated`, grants read-only access to billing invoices/payments (still subject to RLS), and reserves webhook inbox access for `service_role`.

## Automated checks performed in this delivery

- `node --test tests/*.test.mjs`: **4 passed, 0 failed**.
- ZIP integrity check: performed after packaging.

## Checks not performed here

- `npm install`, Next.js production build, TypeScript typecheck, and ESLint: not run successfully in this environment because project dependencies are not installed and package installation previously timed out.
- PostgreSQL migration execution: not run; no connected staging Supabase database was provided.
- Paymob sandbox payment: not run; merchant test credentials and integration IDs were not provided.
- End-to-end browser checkout, webhook retry, and Vercel deployment: not run.

A green HMAC unit test does not prove the complete Paymob integration is live. Keep `PAYMOB_MODE=test` until the merchant sandbox checklist below passes.

## Required staging checklist

### Supabase

- [ ] Apply migrations `0001` through `0014` in order in a staging project.
- [ ] Run Supabase Security Advisor and resolve every relevant error.
- [ ] Verify RLS is enabled on every exposed table, including all newly added billing tables.
- [ ] Verify `anon` cannot read invoices, payments, or webhook inbox.
- [ ] Verify authenticated users cannot insert/update/delete billing invoices or payments through the Data API.
- [ ] Verify an accountant can read billing history but cannot start checkout.
- [ ] Verify one center cannot read another center's invoices/payments.
- [ ] Confirm service-role credentials exist only in server runtime variables.

### Paymob sandbox

- [ ] Use TEST Secret Key, Public Key, HMAC Secret, and TEST Integration ID.
- [ ] Set `PAYMOB_MODE=test` and `PAYMOB_INTEGRATION_IDS` to the exact enabled TEST IDs.
- [ ] Configure the public HTTPS notification URL `/api/billing/paymob/webhook`.
- [ ] Complete a successful test payment; verify exactly one succeeded ledger row and a paid invoice.
- [ ] Complete a failed test payment; verify a failed ledger row and no period extension.
- [ ] Replay the same callback; verify no duplicate payment and no second period extension.
- [ ] Change one HMAC field; verify HTTP 401 and no billing state change.
- [ ] Try wrong amount, currency, order ID, integration ID, and test/live mode; verify rejection.
- [ ] Close the browser before the return page; verify webhook still settles the invoice.
- [ ] Confirm the return URL alone never marks an invoice paid.

### Deployment

- [ ] Set environment variables separately for Preview and Production.
- [ ] Set `PAYMOB_MODE=test` on Preview; do not copy live secrets into Preview.
- [ ] Set `NEXT_PUBLIC_SITE_URL` to the canonical HTTPS origin and redeploy after changing it.
- [ ] Set Supabase Auth Site URL and redirect allow-list to the production domain.
- [ ] Configure custom SMTP and email confirmation before public signup.
- [ ] Enable MFA for platform operators and Supabase organization members.
- [ ] Add domain, SSL, backups/PITR, monitoring, error alerts, and a documented restore test.
- [ ] Configure edge/WAF rate limits for login, signup, checkout-intention creation, and webhook endpoints; do not rely on in-memory rate limits in serverless instances.
- [ ] Deploy and pass the entire sandbox checklist before requesting Paymob live activation.
- [ ] Only after approval, set `PAYMOB_MODE=live`, use LIVE credentials/Integration IDs, and redeploy.

## Operational notes

- A 401 from the Paymob webhook usually means missing/invalid HMAC, integration mismatch, or test/live mismatch.
- A 409 means the callback does not match the current invoice/order/amount/currency.
- A 500 means the trusted billing RPC failed; inspect server logs and `billing_webhook_events` with service-role access.
- Do not manually mark an invoice paid to bypass a failed callback. Reconcile it against Paymob's merchant dashboard first.
- Never log full callback payloads, API keys, HMAC secrets, card numbers, or billing PII.
- The current system does not implement refunds, chargebacks, automatic recurring collection, or scheduled provider reconciliation.

## Official references

- Paymob Create Intention: https://developers.paymob.com/paymob-docs/intention-apis/create-intention
- Paymob transaction callbacks: https://developers.paymob.com/paymob-docs/developers/transaction-callbacks
- Paymob HMAC: https://developers.paymob.com/paymob-docs/developers/webhook-callbacks-and-hmac/hmac
- Supabase production security checklist: https://supabase.com/docs/guides/security/production-checklist
- Supabase Next.js quickstart production requirements: https://supabase.com/docs/guides/getting-started/quickstarts/nextjs
- Vercel environment variables: https://vercel.com/docs/environment-variables
