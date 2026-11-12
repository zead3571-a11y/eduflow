# EDUFLOW Sprint 10 — Billing Foundation & Production Readiness

## Delivered

- Subscription invoices are separate from student invoices (`subscription_invoices`).
- Provider transaction ledger (`billing_payments`) with unique provider transaction IDs.
- Webhook inbox (`billing_webhook_events`) with unique `(provider,event_id)` idempotency.
- `create_subscription_invoice(center_id)` lets a center owner/admin create a renewal invoice for the current subscription interval and plan price.
- `/app/[centerId]/subscription` shows the active plan, subscription state, invoices, and confirmed payment records.
- `/api/billing/webhook` accepts a normalized provider event signed with HMAC-SHA256 in `x-eduflow-signature` and calls a service-role-only SQL RPC.
- Successful payment events validate invoice ID, exact amount, currency, and provider transaction identity before marking the invoice paid and advancing the subscription period.
- Failed payments are recorded; the subscription only becomes `past_due` when the current paid period has ended.
- Hourly Vercel Cron endpoint `/api/billing/maintenance` expires ended trials and marks ended paid periods as `past_due`, with audit records.
- Platform dashboard now distinguishes actual confirmed collections from estimated monthly recurring revenue and pending invoice totals.
- All billing tables have RLS enabled. Center users have read-only access limited to owner/admin/accountant roles; writes are only via checked RPCs or the trusted server webhook.

## Migration

Apply `supabase/migrations/0012_billing_foundation.sql` after `0011_platform_control_plane.sql`.

## Environment

Set server-side `BILLING_WEBHOOK_SECRET` and `CRON_SECRET` to separate long random secrets. Keep `SUPABASE_SERVICE_ROLE_KEY` server-only. Vercel Cron calls the maintenance route hourly using the configured `CRON_SECRET` in the `Authorization: Bearer` header. Neither value may be prefixed with `NEXT_PUBLIC_`.

## Normalized webhook contract

The route expects a JSON body similar to:

```json
{
  "provider": "provider_adapter_name",
  "event_id": "evt_unique_id",
  "type": "payment.succeeded",
  "invoice_id": "00000000-0000-0000-0000-000000000000",
  "transaction_id": "provider_transaction_reference",
  "amount": 500,
  "currency": "EGP"
}
```

Signature is lowercase/uppercase hex HMAC-SHA256 of the exact raw request body using `BILLING_WEBHOOK_SECRET`, sent in `x-eduflow-signature`.

A real gateway adapter must verify the gateway's native signature first, map its verified payload into this normalized contract, and sign the normalized request with the shared secret. Do not forward an unverified public gateway payload directly to this endpoint.

## Not yet live / production blockers

- No specific payment gateway (Paymob, Stripe, Fawry, etc.) is connected; there are no live checkout URLs or card capture flows.
- No automatic recurring charge mandate or scheduled payment collection is configured. The hourly worker only updates expired/overdue subscription statuses; invoice creation remains manual.
- No provider credentials, live webhook URL, sandbox transaction, or settlement reconciliation have been supplied/tested.
- Tax invoice requirements, refund workflow, chargeback handling, and accounting export need country/legal review.
- Webhook signature is the internal normalized adapter signature, not a claim of compatibility with a gateway's native signature format.

## Required pre-launch verification

1. Apply migrations 0001–0012 in order to a non-production Supabase project.
2. Confirm a center owner can create an invoice and a teacher/receptionist/parent cannot.
3. Confirm invoice and payment rows are invisible across tenants.
4. Send a valid signed test event; confirm invoice paid, payment ledger row, subscription period extension, and audit entry.
5. Replay the same event; confirm duplicate response and no second payment row.
6. Try wrong amount, currency, invoice ID, signature, and transaction reuse across invoices; all must fail safely.
7. Confirm the service-role key and webhook secret never reach client bundles or logs.
8. Verify the hourly Vercel Cron executes and records trial/period status transitions.
9. Add and test a real provider adapter in sandbox before enabling payment instructions to customers.

## Known implementation constraints

This sprint supplies the secure provider-neutral billing core and normalized webhook boundary, not a finished payment-gateway integration. Do not collect or claim customer payments until a real adapter is implemented and sandbox-tested.
