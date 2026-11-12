# EDUFLOW — Sprint 11: Paymob Unified Checkout

## Delivered

- Paymob Egypt Intention API integration (`POST https://accept.paymob.com/v1/intention/`).
- Paymob Unified Checkout redirect; EDUFLOW never receives or stores raw card data.
- Server action checks the signed-in user's active center membership and requires `center_owner` or `center_admin` before creating a checkout session.
- Billing amount and currency are read from the persisted subscription invoice, never from browser input.
- Egyptian contact phone is normalized to international format; phone and email are required for Paymob billing data.
- Paymob transaction-processed webhook at `POST /api/billing/paymob/webhook`.
- HMAC-SHA512 verification using the 20 transaction fields in Paymob's documented order, with constant-time comparison.
- Webhook validates invoice reference, Paymob order ID, amount, currency, configured Integration IDs, and test/live mode before calling the service-role-only billing RPC.
- Browser redirect is informational only; the webhook is the source of truth for payment status.
- Subscription page exposes an `ادفع عبر Paymob` action for pending invoices and shows payment history.
- Return page clearly distinguishes a confirmed payment from a callback still pending.

## Database migration

Apply `supabase/migrations/0013_paymob_checkout.sql` after migrations through `0012_billing_foundation.sql`.

It adds Paymob order/intention references and checkout expiry to `subscription_invoices`, plus a unique provider/order index. No API key, public key, or HMAC secret is stored in PostgreSQL.

## Environment variables

Copy these into the server environment (Vercel Project Settings → Environment Variables). Use Paymob test credentials first:

```env
PAYMOB_MODE=test
PAYMOB_SECRET_KEY=sk_test_...
PAYMOB_PUBLIC_KEY=pk_test_...
PAYMOB_HMAC_SECRET=...
PAYMOB_INTEGRATION_IDS=123456
NEXT_PUBLIC_SITE_URL=https://your-eduflow-domain.example
```

`PAYMOB_INTEGRATION_IDS` accepts comma-separated numeric Integration IDs enabled for the merchant account. The current implementation supports EGP and the Egypt base URL only.

Keep `PAYMOB_SECRET_KEY`, `PAYMOB_HMAC_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, and `CRON_SECRET` server-only. Never prefix them with `NEXT_PUBLIC_`.

## Paymob Dashboard configuration

1. Complete Paymob merchant onboarding and enable the payment methods you intend to accept.
2. In Developers / Payment Integrations, create or select a TEST integration and copy its numeric Integration ID.
3. Obtain the test Secret Key, Public Key, and HMAC Secret from the Paymob dashboard.
4. Set the Transaction Processed Callback / notification endpoint to:
   `https://YOUR_DOMAIN/api/billing/paymob/webhook`
5. Set the Transaction Response Callback to a valid EDUFLOW subscription return URL if the dashboard requires one. The Intention request also sends its own `redirection_url`.
6. Add the environment variables above and redeploy.

Paymob's notification URL is sent with each intention. The server endpoint must be publicly reachable over HTTPS; localhost callbacks require a secure tunnel during local development.

## Payment flow

1. Owner/admin creates a subscription invoice in EDUFLOW.
2. Owner/admin presses `ادفع عبر Paymob`.
3. Server re-checks membership and invoice state, reads the amount from the database, and creates a Paymob Intention.
4. Browser is redirected to Paymob Unified Checkout using the Public Key and the one-time Client Secret.
5. Paymob posts a transaction-processed callback to EDUFLOW.
6. EDUFLOW verifies HMAC-SHA512, checks the invoice/order/amount/currency/integration/mode, then calls `process_billing_webhook` using the service-role client.
7. The billing RPC deduplicates the transaction and marks the invoice paid / advances the subscription only on a verified successful transaction.

The return page never marks an invoice paid. A customer may close the browser before returning; the callback still updates the invoice.

## Sandbox QA checklist

- [ ] Successful card payment updates invoice and subscription after callback.
- [ ] Failed payment records a failed transaction and does not extend the subscription.
- [ ] Tampered or missing HMAC returns HTTP 401.
- [ ] Duplicate callback is idempotent.
- [ ] Callback for unknown invoice or mismatched Paymob order is rejected.
- [ ] Wrong amount or currency is rejected.
- [ ] Unexpected Integration ID is rejected.
- [ ] Test/live mismatch is rejected when `obj.is_live` is present.
- [ ] Redirect success query parameters alone do not mark the invoice paid.
- [ ] Owner/admin can start checkout; accountant and other roles cannot.
- [ ] No secret key or HMAC secret appears in client bundles or browser requests.

## Known limitations / not yet live

- This is a Paymob TEST-capable integration foundation. It has not been exercised against the user's merchant account because no merchant credentials or integration IDs were provided.
- No live payment has been made; do not set `PAYMOB_MODE=live` until the merchant account is approved and the full sandbox checklist passes.
- Current integration supports Egypt / EGP only and the Paymob Intention API + Unified Checkout path.
- Refund, partial refund, void, chargeback, saved-card, and recurring auto-charge flows are not implemented.
- An invoice has one active checkout intention at a time. Expired checkout attempts can be replaced; stale callbacks from an older order are rejected because only the current Paymob order ID is accepted.
- There is no automated reconciliation job against Paymob's transaction API yet.
- Build/typecheck and live database migration were not run in this environment; apply migration and test in a Supabase staging project before production.

## Official references

- [Paymob APIs overview](https://developers.paymob.com/paymob-docs/integration-paths/apis)
- [Create Intention](https://developers.paymob.com/paymob-docs/intention-apis/create-intention)
- [Transaction callbacks](https://developers.paymob.com/paymob-docs/developers/transaction-callbacks)
- [HMAC](https://developers.paymob.com/paymob-docs/developers/webhook-callbacks-and-hmac/hmac)
