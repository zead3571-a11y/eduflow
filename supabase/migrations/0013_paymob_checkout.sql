-- EDUFLOW Sprint 11: Paymob Unified Checkout references.
-- Secret keys and HMAC secrets are environment variables only; never stored in the database.
alter table public.subscription_invoices
  add column if not exists provider_order_id text,
  add column if not exists provider_intention_id text,
  add column if not exists checkout_expires_at timestamptz;

create unique index if not exists subscription_invoices_provider_order_unique
  on public.subscription_invoices(provider, provider_order_id)
  where provider is not null and provider_order_id is not null;

comment on column public.subscription_invoices.provider_intention_id is
  'Paymob intention identifier returned by POST /v1/intention/.';
