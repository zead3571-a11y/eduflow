-- EDUFLOW Sprint 10: subscription billing foundation (provider-neutral).
alter table public.subscriptions add constraint subscriptions_center_id_id_key unique(center_id,id);

create table if not exists public.subscription_invoices (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers(id) on delete cascade,
  subscription_id uuid not null,
  invoice_number text not null unique,
  amount numeric(12,2) not null check (amount >= 0),
  currency_code text not null default 'EGP' check (currency_code ~ '^[A-Z]{3}$'),
  billing_interval text not null check (billing_interval in ('monthly','yearly')),
  period_start timestamptz not null,
  period_end timestamptz not null,
  status text not null default 'pending' check (status in ('pending','paid','failed','void','refunded')),
  due_at timestamptz not null default (now() + interval '3 days'),
  paid_at timestamptz,
  provider text,
  provider_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(center_id,id),
  foreign key(center_id,subscription_id) references public.subscriptions(center_id,id) on delete restrict,
  check(period_end > period_start)
);
create index if not exists subscription_invoices_center_created_idx on public.subscription_invoices(center_id,created_at desc);
create index if not exists subscription_invoices_status_due_idx on public.subscription_invoices(status,due_at);

create table if not exists public.billing_payments (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null,
  invoice_id uuid not null,
  provider text not null,
  provider_transaction_id text not null,
  amount numeric(12,2) not null check(amount >= 0),
  currency_code text not null check(currency_code ~ '^[A-Z]{3}$'),
  status text not null check(status in ('succeeded','failed','refunded')),
  provider_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key(center_id,invoice_id) references public.subscription_invoices(center_id,id) on delete restrict,
  unique(provider,provider_transaction_id)
);
create index if not exists billing_payments_center_created_idx on public.billing_payments(center_id,created_at desc);

create table if not exists public.billing_webhook_events (
  id bigint generated always as identity primary key,
  provider text not null,
  event_id text not null,
  event_type text not null,
  payload jsonb not null,
  processing_status text not null default 'received' check(processing_status in ('received','processed','ignored','failed')),
  processing_error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique(provider,event_id)
);

alter table public.subscription_invoices enable row level security;
alter table public.billing_payments enable row level security;
alter table public.billing_webhook_events enable row level security;

drop policy if exists subscription_invoices_read_finance on public.subscription_invoices;
create policy subscription_invoices_read_finance on public.subscription_invoices for select to authenticated
using (public.has_center_role(center_id,array['center_owner','center_admin','accountant']::public.center_role[]) or public.is_platform_admin());
drop policy if exists billing_payments_read_finance on public.billing_payments;
create policy billing_payments_read_finance on public.billing_payments for select to authenticated
using (public.has_center_role(center_id,array['center_owner','center_admin','accountant']::public.center_role[]) or public.is_platform_admin());
-- No authenticated write policies. Billing writes are performed through checked RPCs / trusted webhook only.

create or replace function public.create_subscription_invoice(p_center_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_sub public.subscriptions%rowtype; v_plan public.plans%rowtype; v_id uuid; v_start timestamptz; v_end timestamptz; v_amount numeric(12,2); v_number text;
begin
 if auth.uid() is null or not public.has_center_role(p_center_id,array['center_owner','center_admin']::public.center_role[]) then
   raise exception 'Center owner/admin access required' using errcode='42501';
 end if;
 select * into v_sub from public.subscriptions where center_id=p_center_id for update;
 if not found then raise exception 'Subscription not found'; end if;
 if v_sub.status in ('canceled','expired') then raise exception 'Canceled or expired subscriptions cannot be invoiced'; end if;
 select * into v_plan from public.plans where id=v_sub.plan_id;
 if not found then raise exception 'Selected plan was not found'; end if;
 v_start:=greatest(coalesce(v_sub.current_period_end,now()),now());
 v_end:=case when v_sub.billing_interval='yearly' then v_start+interval '1 year' else v_start+interval '1 month' end;
 v_amount:=case when v_sub.billing_interval='yearly' then v_plan.yearly_price else v_plan.monthly_price end;
 if v_amount<=0 then raise exception 'This plan does not require a paid invoice'; end if;
 if exists(select 1 from public.subscription_invoices where subscription_id=v_sub.id and status='pending' and period_end>now()) then raise exception 'There is already a pending invoice for this subscription'; end if;
 v_number:='EDU-'||to_char(now(),'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
 insert into public.subscription_invoices(center_id,subscription_id,invoice_number,amount,currency_code,billing_interval,period_start,period_end)
 values(p_center_id,v_sub.id,v_number,v_amount,(select currency_code from public.centers where id=p_center_id),v_sub.billing_interval,v_start,v_end) returning id into v_id;
 insert into public.audit_logs(center_id,actor_user_id,action,entity_table,entity_id,metadata)
 values(p_center_id,auth.uid(),'subscription_invoice.created','subscription_invoices',v_id::text,jsonb_build_object('amount',v_amount,'currency',(select currency_code from public.centers where id=p_center_id),'invoice_number',v_number));
 return v_id;
end; $$;

-- Called only by the server's trusted webhook adapter using the service-role key.
-- Event payload contract: {type:'payment.succeeded'|'payment.failed', invoice_id, transaction_id, amount, currency, reference?}
create or replace function public.process_billing_webhook(p_provider text,p_event_id text,p_event_type text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_event_id bigint; v_invoice public.subscription_invoices%rowtype; v_tx text; v_amount numeric; v_currency text; v_rows integer; v_existing_status text; v_existing_payload jsonb; v_existing_type text;
begin
 if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Trusted billing worker required' using errcode='42501'; end if;
 if length(trim(coalesce(p_provider,'')))<2 or length(trim(coalesce(p_event_id,'')))<3 then raise exception 'Invalid provider event identity'; end if;
 insert into public.billing_webhook_events(provider,event_id,event_type,payload)
 values(p_provider,p_event_id,p_event_type,coalesce(p_payload,'{}'::jsonb))
 on conflict(provider,event_id) do nothing returning id into v_event_id;
 if v_event_id is null then
   select id,processing_status,payload,event_type into v_event_id,v_existing_status,v_existing_payload,v_existing_type from public.billing_webhook_events where provider=p_provider and event_id=p_event_id for update;
   if v_existing_payload is distinct from coalesce(p_payload,'{}'::jsonb) or v_existing_type is distinct from p_event_type then raise exception 'Webhook event ID reused with a different payload'; end if;
   if v_existing_status in ('processed','ignored') then return jsonb_build_object('ok',true,'duplicate',true); end if;
   update public.billing_webhook_events set processing_status='received',processing_error=null where id=v_event_id;
 end if;
 begin
 if p_event_type not in ('payment.succeeded','payment.failed') then
   update public.billing_webhook_events set processing_status='ignored',processed_at=now() where id=v_event_id;
   return jsonb_build_object('ok',true,'ignored',true);
 end if;
 select * into v_invoice from public.subscription_invoices where id=(p_payload->>'invoice_id')::uuid for update;
 if not found then raise exception 'Subscription invoice not found'; end if;
 v_tx:=trim(coalesce(p_payload->>'transaction_id',''));
 v_amount:=(p_payload->>'amount')::numeric;
 v_currency:=upper(coalesce(p_payload->>'currency',''));
 if v_tx='' or v_amount is null or v_currency='' then raise exception 'Incomplete payment payload'; end if;
 if v_amount<>v_invoice.amount or v_currency<>v_invoice.currency_code then raise exception 'Payment amount or currency mismatch'; end if;
 if p_event_type='payment.succeeded' then
   if v_invoice.status in ('void','refunded') then raise exception 'Invoice is not payable'; end if;
   if v_invoice.status='paid' then
     update public.billing_webhook_events set processing_status='processed',processed_at=now() where id=v_event_id;
     return jsonb_build_object('ok',true,'already_paid',true);
   end if;
   insert into public.billing_payments(center_id,invoice_id,provider,provider_transaction_id,amount,currency_code,status,provider_payload)
   values(v_invoice.center_id,v_invoice.id,p_provider,v_tx,v_amount,v_currency,'succeeded',p_payload)
   on conflict(provider,provider_transaction_id) do update set status=excluded.status,provider_payload=excluded.provider_payload where billing_payments.invoice_id=excluded.invoice_id;
   get diagnostics v_rows = row_count;
   if v_rows=0 then raise exception 'Provider transaction is already linked to another invoice'; end if;
   update public.subscription_invoices set status='paid',paid_at=now(),provider=p_provider,provider_reference=v_tx,updated_at=now() where id=v_invoice.id;
   update public.subscriptions set status='active',current_period_start=v_invoice.period_start,current_period_end=v_invoice.period_end,canceled_at=null,updated_at=now() where id=v_invoice.subscription_id;
   insert into public.audit_logs(center_id,action,entity_table,entity_id,metadata)
   values(v_invoice.center_id,'subscription.payment_succeeded','subscription_invoices',v_invoice.id::text,jsonb_build_object('provider',p_provider,'transaction_id',v_tx,'amount',v_amount,'currency',v_currency));
 else
   insert into public.billing_payments(center_id,invoice_id,provider,provider_transaction_id,amount,currency_code,status,provider_payload)
   values(v_invoice.center_id,v_invoice.id,p_provider,v_tx,v_amount,v_currency,'failed',p_payload)
   on conflict(provider,provider_transaction_id) do update set status=excluded.status,provider_payload=excluded.provider_payload where billing_payments.invoice_id=excluded.invoice_id;
   get diagnostics v_rows = row_count;
   if v_rows=0 then raise exception 'Provider transaction is already linked to another invoice'; end if;
   update public.subscription_invoices set status='failed',provider=p_provider,provider_reference=v_tx,updated_at=now() where id=v_invoice.id and status<>'paid';
   update public.subscriptions set status=case when current_period_end is null or current_period_end<=now() then 'past_due'::public.subscription_status else status end,updated_at=now() where id=v_invoice.subscription_id;
 end if;
 update public.billing_webhook_events set processing_status='processed',processed_at=now() where id=v_event_id;
 return jsonb_build_object('ok',true,'duplicate',false);
 exception when others then
   update public.billing_webhook_events set processing_status='failed',processing_error=left(sqlerrm,500),processed_at=now() where id=v_event_id;
   return jsonb_build_object('ok',false,'error','event_processing_failed');
 end;
end; $$;

revoke all on function public.create_subscription_invoice(uuid) from public;
revoke all on function public.process_billing_webhook(text,text,text,jsonb) from public,authenticated,anon;
grant execute on function public.create_subscription_invoice(uuid) to authenticated;
grant execute on function public.process_billing_webhook(text,text,text,jsonb) to service_role;


create or replace function public.platform_billing_metrics()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v jsonb;
begin
 if auth.uid() is null or not public.is_platform_admin() then raise exception 'Platform administrator access required' using errcode='42501'; end if;
 select jsonb_build_object(
  'collected_this_month',coalesce((select sum(amount) from public.billing_payments where status='succeeded' and currency_code='EGP' and created_at>=date_trunc('month',now())),0),
  'collected_all_time',coalesce((select sum(amount) from public.billing_payments where status='succeeded' and currency_code='EGP'),0),
  'outstanding',coalesce((select sum(amount) from public.subscription_invoices where status='pending' and currency_code='EGP'),0),
  'failed_this_month',coalesce((select count(*) from public.billing_payments where status='failed' and created_at>=date_trunc('month',now())),0),
  'recent_invoices',coalesce((select jsonb_agg(x order by x->>'created_at' desc) from (select jsonb_build_object('id',i.id,'invoice_number',i.invoice_number,'center_name',c.name,'amount',i.amount,'currency_code',i.currency_code,'status',i.status,'created_at',i.created_at) x from public.subscription_invoices i join public.centers c on c.id=i.center_id order by i.created_at desc limit 100) q),'[]'::jsonb)
 ) into v;
 return v;
end; $$;
revoke all on function public.platform_billing_metrics() from public;
grant execute on function public.platform_billing_metrics() to authenticated;


-- Hourly maintenance job: expire ended trials and mark ended paid periods past due.
create or replace function public.run_billing_maintenance()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_expired integer:=0; v_past_due integer:=0;
begin
 if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Trusted billing worker required' using errcode='42501'; end if;
 with changed as (
   update public.subscriptions set status='expired',updated_at=now()
   where status='trialing' and trial_ends_at is not null and trial_ends_at<=now()
   returning center_id
 ) insert into public.audit_logs(center_id,action,entity_table,entity_id,metadata)
   select center_id,'subscription.trial_expired','subscriptions',center_id::text,'{}'::jsonb from changed;
 get diagnostics v_expired = row_count;
 with changed as (
   update public.subscriptions set status='past_due',updated_at=now()
   where status='active' and current_period_end is not null and current_period_end<=now()
   returning center_id
 ) insert into public.audit_logs(center_id,action,entity_table,entity_id,metadata)
   select center_id,'subscription.period_overdue','subscriptions',center_id::text,'{}'::jsonb from changed;
 get diagnostics v_past_due = row_count;
 return jsonb_build_object('expired_trials',v_expired,'past_due_subscriptions',v_past_due);
end; $$;
revoke all on function public.run_billing_maintenance() from public,authenticated,anon;
grant execute on function public.run_billing_maintenance() to service_role;
