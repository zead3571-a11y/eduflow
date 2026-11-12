-- EDUFLOW Sprint 9: platform control plane
create table if not exists public.platform_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.platform_settings(key,value) values
 ('default_trial_days','14'::jsonb),
 ('default_locale','"ar"'::jsonb),
 ('supported_locales','["ar","en"]'::jsonb),
 ('maintenance_mode','false'::jsonb)
on conflict (key) do nothing;

alter table public.platform_settings enable row level security;
create policy platform_settings_admin_only on public.platform_settings
  for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

create or replace function public.platform_dashboard_data()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v jsonb;
begin
 if auth.uid() is null or not public.is_platform_admin() then raise exception 'Platform administrator access required' using errcode='42501'; end if;
 select jsonb_build_object(
  'stats', jsonb_build_object(
   'centers', (select count(*) from public.centers),
   'active_centers', (select count(*) from public.centers where is_active),
   'trialing', (select count(*) from public.subscriptions where status='trialing'),
   'active_subscriptions', (select count(*) from public.subscriptions where status='active'),
   'past_due', (select count(*) from public.subscriptions where status='past_due'),
   'monthly_revenue', coalesce((select sum(case when s.billing_interval='monthly' then p.monthly_price else p.yearly_price/12 end) from public.subscriptions s join public.plans p on p.id=s.plan_id join public.centers c on c.id=s.center_id where s.status='active' and c.is_active),0)
  ),
  'centers', coalesce((select jsonb_agg(x order by x->>'created_at' desc) from (
    select jsonb_build_object('id',c.id,'name',c.name,'slug',c.slug,'email',c.email,'is_active',c.is_active,'created_at',c.created_at,
      'owner_name',pr.full_name,'owner_email',au.email,'subscription_status',s.status,'trial_ends_at',s.trial_ends_at,
      'period_end',s.current_period_end,'billing_interval',s.billing_interval,'plan_name',p.name_en,'plan_id',p.id) x
    from public.centers c left join public.profiles pr on pr.id=c.owner_user_id left join auth.users au on au.id=c.owner_user_id
    left join public.subscriptions s on s.center_id=c.id left join public.plans p on p.id=s.plan_id
  ) q), '[]'::jsonb),
  'plans', coalesce((select jsonb_agg(to_jsonb(p) order by p.monthly_price) from public.plans p),'[]'::jsonb),
  'users', coalesce((select jsonb_agg(x) from (select jsonb_build_object('id',pr.id,'full_name',pr.full_name,'email',au.email,'preferred_locale',pr.preferred_locale,'is_platform_admin',exists(select 1 from public.platform_admins pa where pa.user_id=pr.id)) x from public.profiles pr join auth.users au on au.id=pr.id order by pr.created_at desc limit 200) q),'[]'::jsonb),
  'audit_logs', coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'center_id',a.center_id,'center_name',c.name,'actor_name',pr.full_name,'action',a.action,'entity_table',a.entity_table,'entity_id',a.entity_id,'metadata',a.metadata,'created_at',a.created_at) order by a.created_at desc) from (select * from public.audit_logs order by created_at desc limit 100) a left join public.centers c on c.id=a.center_id left join public.profiles pr on pr.id=a.actor_user_id),'[]'::jsonb),
  'settings', coalesce((select jsonb_object_agg(key,value) from public.platform_settings),'{}'::jsonb)
 ) into v;
 return v;
end; $$;


create or replace function public.platform_create_plan(p_code text,p_name_ar text,p_name_en text,p_monthly_price numeric,p_yearly_price numeric,p_trial_days integer,p_max_students integer,p_max_staff integer)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
 if auth.uid() is null or not public.is_platform_admin() then raise exception 'Platform administrator access required' using errcode='42501'; end if;
 if p_code !~ '^[a-z0-9][a-z0-9_-]{1,38}$' or length(trim(p_name_ar))<2 or length(trim(p_name_en))<2 then raise exception 'Invalid plan identity'; end if;
 if p_monthly_price<0 or p_yearly_price<0 or p_trial_days<0 or p_trial_days>90 or p_max_students<1 or p_max_staff<1 then raise exception 'Invalid plan values'; end if;
 insert into public.plans(code,name_ar,name_en,monthly_price,yearly_price,trial_days,max_students,max_staff,is_active)
 values(lower(p_code),trim(p_name_ar),trim(p_name_en),p_monthly_price,p_yearly_price,p_trial_days,p_max_students,p_max_staff,true) returning id into v_id;
 insert into public.audit_logs(actor_user_id,action,entity_table,entity_id,metadata) values(auth.uid(),'plan.created','plans',v_id::text,jsonb_build_object('code',p_code));
 return v_id;
end; $$;

create or replace function public.platform_update_plan(p_plan_id uuid,p_name_ar text,p_name_en text,p_monthly_price numeric,p_yearly_price numeric,p_trial_days integer,p_max_students integer,p_max_staff integer,p_is_active boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_old jsonb; v_new jsonb;
begin
 if auth.uid() is null or not public.is_platform_admin() then raise exception 'Platform administrator access required' using errcode='42501'; end if;
 if p_monthly_price<0 or p_yearly_price<0 or p_trial_days<0 or p_max_students<1 or p_max_staff<1 then raise exception 'Invalid plan values'; end if;
 select to_jsonb(p) into v_old from public.plans p where id=p_plan_id;
 if v_old is null then raise exception 'Plan not found'; end if;
 update public.plans as p set name_ar=trim(p_name_ar),name_en=trim(p_name_en),monthly_price=p_monthly_price,yearly_price=p_yearly_price,trial_days=p_trial_days,max_students=p_max_students,max_staff=p_max_staff,is_active=p_is_active where id=p_plan_id returning to_jsonb(p) into v_new;
 insert into public.audit_logs(actor_user_id,action,entity_table,entity_id,metadata) values(auth.uid(),'plan.updated','plans',p_plan_id::text,jsonb_build_object('before',v_old,'after',v_new));
end; $$;

create or replace function public.platform_update_subscription(p_center_id uuid,p_status public.subscription_status,p_extend_days integer default 0,p_plan_id uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_old jsonb; v_new jsonb;
begin
 if auth.uid() is null or not public.is_platform_admin() then raise exception 'Platform administrator access required' using errcode='42501'; end if;
 if p_extend_days<0 or p_extend_days>730 then raise exception 'Extension must be between 0 and 730 days'; end if;
 select to_jsonb(s) into v_old from public.subscriptions s where center_id=p_center_id for update;
 if v_old is null then raise exception 'Subscription not found'; end if;
 update public.subscriptions set status=p_status, plan_id=coalesce(p_plan_id,plan_id),
  trial_ends_at=case when p_extend_days>0 and p_status='trialing' then greatest(coalesce(trial_ends_at,now()),now())+make_interval(days=>p_extend_days) else trial_ends_at end,
  current_period_end=case when p_extend_days>0 and p_status<>'trialing' then greatest(coalesce(current_period_end,now()),now())+make_interval(days=>p_extend_days) else current_period_end end,
  canceled_at=case when p_status='canceled' then now() when p_status in ('active','trialing') then null else canceled_at end,
  updated_at=now() where center_id=p_center_id returning to_jsonb(subscriptions.*) into v_new;
 insert into public.audit_logs(center_id,actor_user_id,action,entity_table,entity_id,metadata) values(p_center_id,auth.uid(),'subscription.updated','subscriptions',p_center_id::text,jsonb_build_object('before',v_old,'after',v_new,'extension_days',p_extend_days));
end; $$;

create or replace function public.platform_set_center_access(p_center_id uuid,p_is_active boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_old boolean;
begin
 if auth.uid() is null or not public.is_platform_admin() then raise exception 'Platform administrator access required' using errcode='42501'; end if;
 update public.centers set is_active=p_is_active,updated_at=now() where id=p_center_id returning is_active into v_old;
 if not found then raise exception 'Center not found'; end if;
 insert into public.audit_logs(center_id,actor_user_id,action,entity_table,entity_id,metadata) values(p_center_id,auth.uid(),case when p_is_active then 'center.access_restored' else 'center.access_suspended' end,'centers',p_center_id::text,jsonb_build_object('is_active',p_is_active));
end; $$;

create or replace function public.platform_update_settings(p_default_trial_days integer,p_default_locale text,p_maintenance_mode boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null or not public.is_platform_admin() then raise exception 'Platform administrator access required' using errcode='42501'; end if;
 if p_default_trial_days<0 or p_default_trial_days>90 or p_default_locale not in ('ar','en') then raise exception 'Invalid platform settings'; end if;
 update public.plans set trial_days=p_default_trial_days;
 insert into public.platform_settings(key,value,updated_by,updated_at) values
 ('default_trial_days',to_jsonb(p_default_trial_days),auth.uid(),now()),
 ('default_locale',to_jsonb(p_default_locale),auth.uid(),now()),
 ('maintenance_mode',to_jsonb(p_maintenance_mode),auth.uid(),now())
 on conflict(key) do update set value=excluded.value,updated_by=excluded.updated_by,updated_at=now();
 insert into public.audit_logs(actor_user_id,action,entity_table,metadata) values(auth.uid(),'platform.settings_updated','platform_settings',jsonb_build_object('default_trial_days',p_default_trial_days,'default_locale',p_default_locale,'maintenance_mode',p_maintenance_mode));
end; $$;

create or replace function public.platform_set_admin(p_user_id uuid,p_make_admin boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null or not public.is_platform_admin() then raise exception 'Platform administrator access required' using errcode='42501'; end if;
 if p_user_id=auth.uid() and not p_make_admin then raise exception 'You cannot remove your own platform administrator access'; end if;
 if not exists(select 1 from auth.users where id=p_user_id) then raise exception 'User not found'; end if;
 if p_make_admin then insert into public.platform_admins(user_id) values(p_user_id) on conflict do nothing;
 else delete from public.platform_admins where user_id=p_user_id; end if;
 insert into public.audit_logs(actor_user_id,action,entity_table,entity_id,metadata) values(auth.uid(),case when p_make_admin then 'platform_admin.granted' else 'platform_admin.revoked' end,'platform_admins',p_user_id::text,'{}'::jsonb);
end; $$;

revoke all on function public.platform_dashboard_data() from public;
revoke all on function public.platform_create_plan(text,text,text,numeric,numeric,integer,integer,integer) from public;
revoke all on function public.platform_update_plan(uuid,text,text,numeric,numeric,integer,integer,integer,boolean) from public;
revoke all on function public.platform_update_subscription(uuid,public.subscription_status,integer,uuid) from public;
revoke all on function public.platform_set_center_access(uuid,boolean) from public;
revoke all on function public.platform_update_settings(integer,text,boolean) from public;
revoke all on function public.platform_set_admin(uuid,boolean) from public;
grant execute on function public.platform_dashboard_data() to authenticated;
grant execute on function public.platform_create_plan(text,text,text,numeric,numeric,integer,integer,integer) to authenticated;
grant execute on function public.platform_update_plan(uuid,text,text,numeric,numeric,integer,integer,integer,boolean) to authenticated;
grant execute on function public.platform_update_subscription(uuid,public.subscription_status,integer,uuid) to authenticated;
grant execute on function public.platform_set_center_access(uuid,boolean) to authenticated;
grant execute on function public.platform_update_settings(integer,text,boolean) to authenticated;
grant execute on function public.platform_set_admin(uuid,boolean) to authenticated;

-- Suspension is an access-control boundary for both staff and parent portal accounts.
create or replace function public.center_is_active(p_center_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.centers c where c.id=p_center_id and c.is_active);
$$;
revoke all on function public.center_is_active(uuid) from public;
grant execute on function public.center_is_active(uuid) to authenticated;

create or replace function public.is_center_member(p_center_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.center_is_active(p_center_id) and exists (
    select 1 from public.center_members cm
    where cm.center_id=p_center_id and cm.user_id=(select auth.uid()) and cm.is_active
  );
$$;

create or replace function public.has_center_role(p_center_id uuid,p_roles public.center_role[])
returns boolean language sql stable security definer set search_path = '' as $$
  select public.center_is_active(p_center_id) and exists (
    select 1 from public.center_members cm
    where cm.center_id=p_center_id and cm.user_id=(select auth.uid())
      and cm.is_active and cm.role=any(p_roles)
  );
$$;

-- PostgreSQL permissive policies combine with OR; these restrictive policies
-- additionally gate every parent-portal read when a center is suspended.
do $$
declare t text;
begin
 foreach t in array array['guardians','students','student_guardians','group_students','groups','sessions','attendance','invoices','payments','receipts','assessments','student_assessments'] loop
  execute format('drop policy if exists center_active_gate on public.%I',t);
  execute format('create policy center_active_gate on public.%I as restrictive for select to authenticated using (public.center_is_active(center_id) or public.is_platform_admin())',t);
 end loop;
end $$;
drop policy if exists center_active_gate on public.centers;
create policy center_active_gate on public.centers as restrictive for select to authenticated using (public.center_is_active(id) or public.is_platform_admin());

create or replace function public.apply_platform_center_defaults()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_locale text;
begin
 select value #>> '{}' into v_locale from public.platform_settings where key='default_locale';
 if v_locale in ('ar','en') then new.default_locale:=v_locale; end if;
 return new;
end; $$;
revoke all on function public.apply_platform_center_defaults() from public;
drop trigger if exists centers_apply_platform_defaults on public.centers;
create trigger centers_apply_platform_defaults before insert on public.centers
for each row execute function public.apply_platform_center_defaults();
