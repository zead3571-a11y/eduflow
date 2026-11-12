-- Admin-assisted center creation for an already registered owner account.
-- This function never trusts a client-supplied actor; auth.uid() must be a platform admin.
create or replace function public.admin_create_center_for_owner(
  p_owner_user_id uuid,
  p_name text,
  p_slug text,
  p_email text default null,
  p_phone text default null,
  p_plan_code text default 'starter'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_center_id uuid;
  v_plan_id uuid;
  v_trial_days integer;
  v_now timestamptz := now();
begin
  if v_actor is null or not public.is_platform_admin() then
    raise exception 'Platform administrator access required' using errcode = '42501';
  end if;
  if p_owner_user_id is null or not exists (select 1 from auth.users u where u.id = p_owner_user_id) then
    raise exception 'Owner account not found';
  end if;
  if length(trim(coalesce(p_name, ''))) < 2 then raise exception 'Center name is required'; end if;
  if p_slug !~ '^[a-z0-9][a-z0-9-]{2,48}[a-z0-9]$' then raise exception 'Invalid center slug'; end if;

  select id, trial_days into v_plan_id, v_trial_days
  from public.plans where code = p_plan_code and is_active = true;
  if v_plan_id is null then raise exception 'Selected plan is unavailable'; end if;

  insert into public.centers(name, slug, owner_user_id, email, phone)
  values (trim(p_name), lower(p_slug), p_owner_user_id, p_email, p_phone)
  returning id into v_center_id;

  insert into public.center_members(center_id, user_id, role)
  values (v_center_id, p_owner_user_id, 'center_owner');

  insert into public.subscriptions(center_id, plan_id, status, billing_interval, trial_started_at, trial_ends_at, current_period_start, current_period_end)
  values (v_center_id, v_plan_id, 'trialing', 'monthly', v_now, v_now + make_interval(days => v_trial_days), v_now, v_now + make_interval(days => v_trial_days));

  insert into public.audit_logs(center_id, actor_user_id, action, entity_table, entity_id, metadata)
  values (v_center_id, v_actor, 'center.created_by_platform_admin', 'centers', v_center_id::text,
    jsonb_build_object('owner_user_id', p_owner_user_id, 'plan_code', p_plan_code, 'trial_days', v_trial_days));

  return v_center_id;
end;
$$;

revoke all on function public.admin_create_center_for_owner(uuid,text,text,text,text,text) from public;
grant execute on function public.admin_create_center_for_owner(uuid,text,text,text,text,text) to authenticated;
