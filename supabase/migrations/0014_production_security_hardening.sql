-- EDUFLOW Sprint 12: least-privilege grants for subscription billing tables.
-- RLS remains the row-level boundary; SQL grants are the table/operation boundary.

alter table public.subscription_invoices enable row level security;
alter table public.billing_payments enable row level security;
alter table public.billing_webhook_events enable row level security;

-- Browser roles may read only the two billing views protected by existing RLS policies.
revoke all on table public.subscription_invoices from public, anon, authenticated;
revoke all on table public.billing_payments from public, anon, authenticated;
revoke all on table public.billing_webhook_events from public, anon, authenticated;
grant select on table public.subscription_invoices to authenticated;
grant select on table public.billing_payments to authenticated;

-- Only trusted server-side service-role code can read/write callback inbox records.
revoke all on table public.billing_webhook_events from public;
grant all on table public.subscription_invoices to service_role;
grant all on table public.billing_payments to service_role;
grant all on table public.billing_webhook_events to service_role;

-- Helpful operational indexes for support and reconciliation screens.
create index if not exists subscription_invoices_provider_reference_idx
  on public.subscription_invoices(provider, provider_reference)
  where provider is not null and provider_reference is not null;
create index if not exists billing_webhook_events_failed_received_idx
  on public.billing_webhook_events(received_at desc)
  where processing_status = 'failed';

comment on table public.billing_webhook_events is
  'Private server-side webhook inbox. No anon/authenticated grants or client RLS policies.';
