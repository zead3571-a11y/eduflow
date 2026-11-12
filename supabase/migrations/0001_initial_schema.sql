-- EDUFLOW initial multi-tenant schema
-- Apply with: supabase db push
create extension if not exists pgcrypto;

create type public.center_role as enum ('center_owner','center_admin','accountant','teacher','receptionist');
create type public.subscription_status as enum ('trialing','active','past_due','canceled','expired');
create type public.attendance_status as enum ('present','absent','late','excused');
create type public.payment_status as enum ('pending','paid','void','refunded');
create type public.payment_method as enum ('cash','bank_transfer','card','wallet','other');
create type public.session_status as enum ('scheduled','completed','canceled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  preferred_locale text not null default 'ar' check (preferred_locale in ('ar','en')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_ar text not null,
  name_en text not null,
  monthly_price numeric(12,2) not null default 0 check (monthly_price >= 0),
  yearly_price numeric(12,2) not null default 0 check (yearly_price >= 0),
  trial_days integer not null default 14 check (trial_days >= 0),
  max_students integer,
  max_staff integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.centers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  owner_user_id uuid not null references auth.users(id),
  email text,
  phone text,
  address text,
  timezone text not null default 'Africa/Cairo',
  default_locale text not null default 'ar' check (default_locale in ('ar','en')),
  currency_code text not null default 'EGP',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.center_members (
  center_id uuid not null references public.centers(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.center_role not null,
  is_active boolean not null default true,
  joined_at timestamptz not null default now(),
  primary key (center_id, user_id)
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null unique references public.centers(id) on delete cascade,
  plan_id uuid not null references public.plans(id),
  status public.subscription_status not null default 'trialing',
  billing_interval text not null default 'monthly' check (billing_interval in ('monthly','yearly')),
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers(id) on delete cascade,
  student_code text,
  full_name text not null,
  phone text,
  email text,
  birth_date date,
  gender text check (gender in ('male','female','other')),
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (center_id, student_code),
  unique (center_id, id)
);

create table public.guardians (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers(id) on delete cascade,
  full_name text not null,
  phone text not null,
  email text,
  relationship text,
  created_at timestamptz not null default now(),
  unique (center_id, id)
);

create table public.student_guardians (
  center_id uuid not null references public.centers(id) on delete cascade,
  student_id uuid not null,
  guardian_id uuid not null,
  is_primary boolean not null default false,
  primary key (student_id, guardian_id),
  foreign key (center_id, student_id) references public.students(center_id, id) on delete cascade,
  foreign key (center_id, guardian_id) references public.guardians(center_id, id) on delete cascade
);

create table public.teachers (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  full_name text not null,
  phone text,
  email text,
  specialty text,
  compensation_type text not null default 'fixed' check (compensation_type in ('fixed','per_session','percentage')),
  compensation_amount numeric(12,2) not null default 0 check (compensation_amount >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (center_id, id)
);

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (center_id, name),
  unique (center_id, id)
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers(id) on delete cascade,
  subject_id uuid,
  teacher_id uuid,
  name text not null,
  grade_label text,
  monthly_fee numeric(12,2) not null default 0 check (monthly_fee >= 0),
  capacity integer check (capacity is null or capacity > 0),
  room_label text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (center_id, id),
  foreign key (center_id, subject_id) references public.subjects(center_id, id),
  foreign key (center_id, teacher_id) references public.teachers(center_id, id)
);

create table public.group_students (
  center_id uuid not null references public.centers(id) on delete cascade,
  group_id uuid not null,
  student_id uuid not null,
  enrolled_at date not null default current_date,
  is_active boolean not null default true,
  primary key (group_id, student_id),
  foreign key (center_id, group_id) references public.groups(center_id, id) on delete cascade,
  foreign key (center_id, student_id) references public.students(center_id, id) on delete cascade
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers(id) on delete cascade,
  group_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.session_status not null default 'scheduled',
  room_label text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  unique (center_id, id),
  foreign key (center_id, group_id) references public.groups(center_id, id) on delete cascade
);

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers(id) on delete cascade,
  session_id uuid not null,
  student_id uuid not null,
  status public.attendance_status not null,
  marked_by uuid references auth.users(id) on delete set null,
  marked_at timestamptz not null default now(),
  notes text,
  unique (session_id, student_id),
  foreign key (center_id, session_id) references public.sessions(center_id, id) on delete cascade,
  foreign key (center_id, student_id) references public.students(center_id, id) on delete cascade
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers(id) on delete cascade,
  student_id uuid not null,
  amount numeric(12,2) not null check (amount > 0),
  currency_code text not null default 'EGP',
  method public.payment_method not null default 'cash',
  status public.payment_status not null default 'paid',
  paid_at timestamptz,
  reference_number text,
  description text,
  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (center_id, id),
  foreign key (center_id, student_id) references public.students(center_id, id)
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers(id) on delete cascade,
  student_id uuid not null,
  invoice_number text not null,
  total_amount numeric(12,2) not null check (total_amount >= 0),
  due_at date,
  status text not null default 'unpaid' check (status in ('unpaid','partially_paid','paid','void')),
  created_at timestamptz not null default now(),
  unique (center_id, invoice_number),
  unique (center_id, id),
  foreign key (center_id, student_id) references public.students(center_id, id)
);

create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers(id) on delete cascade,
  payment_id uuid not null unique,
  receipt_number text not null,
  issued_at timestamptz not null default now(),
  pdf_storage_path text,
  created_at timestamptz not null default now(),
  unique (center_id, receipt_number),
  foreign key (center_id, payment_id) references public.payments(center_id, id) on delete restrict
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers(id) on delete cascade,
  title text not null,
  amount numeric(12,2) not null check (amount > 0),
  category text,
  spent_at date not null default current_date,
  notes text,
  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  center_id uuid references public.centers(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_table text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_students_center_name on public.students(center_id, full_name);
create index idx_groups_center on public.groups(center_id);
create index idx_sessions_center_start on public.sessions(center_id, starts_at);
create index idx_attendance_center_session on public.attendance(center_id, session_id);
create index idx_payments_center_paid_at on public.payments(center_id, paid_at desc);
create index idx_notifications_user on public.notifications(user_id, created_at desc);

-- Bootstrap profile on Supabase Auth signup.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Helper functions run as the function owner to avoid recursive RLS on center_members.
create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.platform_admins pa where pa.user_id = (select auth.uid()));
$$;

create or replace function public.is_center_member(p_center_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.center_members cm
    where cm.center_id = p_center_id and cm.user_id = (select auth.uid()) and cm.is_active
  );
$$;

create or replace function public.has_center_role(p_center_id uuid, p_roles public.center_role[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.center_members cm
    where cm.center_id = p_center_id and cm.user_id = (select auth.uid())
      and cm.is_active and cm.role = any(p_roles)
  );
$$;

create or replace function public.can_manage_center(p_center_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_platform_admin() or public.has_center_role(
    p_center_id, array['center_owner','center_admin']::public.center_role[]
  );
$$;

-- Secure center creation: authenticated owner creates center + membership + trial atomically.
create or replace function public.create_center_with_trial(
  p_name text, p_slug text, p_email text default null, p_phone text default null,
  p_plan_code text default 'starter'
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := auth.uid();
  v_center_id uuid;
  v_plan_id uuid;
  v_trial_days integer;
  v_now timestamptz := now();
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if length(trim(coalesce(p_name,''))) < 2 then raise exception 'Center name is required'; end if;
  if p_slug !~ '^[a-z0-9][a-z0-9-]{2,48}[a-z0-9]$' then raise exception 'Invalid center slug'; end if;

  select id, trial_days into v_plan_id, v_trial_days
  from public.plans where code = p_plan_code and is_active = true;
  if v_plan_id is null then raise exception 'Selected plan is unavailable'; end if;

  insert into public.centers(name, slug, owner_user_id, email, phone)
  values (trim(p_name), lower(p_slug), v_user_id, p_email, p_phone)
  returning id into v_center_id;

  insert into public.center_members(center_id, user_id, role)
  values (v_center_id, v_user_id, 'center_owner');

  insert into public.subscriptions(center_id, plan_id, status, billing_interval, trial_started_at, trial_ends_at, current_period_start, current_period_end)
  values (v_center_id, v_plan_id, 'trialing', 'monthly', v_now, v_now + make_interval(days => v_trial_days), v_now, v_now + make_interval(days => v_trial_days));

  return v_center_id;
end;
$$;
revoke all on function public.create_center_with_trial(text,text,text,text,text) from public;
grant execute on function public.create_center_with_trial(text,text,text,text,text) to authenticated;

-- Enable RLS on all tenant and account tables.
do $$
declare r record;
begin
  for r in select schemaname, tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table %I.%I enable row level security', r.schemaname, r.tablename);
  end loop;
end $$;

-- Profile policies
create policy profiles_select_self on public.profiles for select to authenticated using (id = (select auth.uid()) or public.is_platform_admin());
create policy profiles_update_self on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Platform admins can inspect platform data; only service-role/dashboard provisioning should grant admin membership.
create policy platform_admins_select_self on public.platform_admins for select to authenticated using (user_id = (select auth.uid()));

create policy plans_read_active on public.plans for select to authenticated using (is_active or public.is_platform_admin());
create policy plans_admin_all on public.plans for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy centers_select_member on public.centers for select to authenticated using (public.is_center_member(id) or public.is_platform_admin());
create policy centers_update_manager on public.centers for update to authenticated using (public.can_manage_center(id)) with check (public.can_manage_center(id));
create policy centers_admin_all on public.centers for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy members_select_center on public.center_members for select to authenticated using (user_id = (select auth.uid()) or public.is_center_member(center_id) or public.is_platform_admin());
create policy members_manage_center on public.center_members for all to authenticated using (public.can_manage_center(center_id)) with check (public.can_manage_center(center_id));

create policy subscriptions_select_center on public.subscriptions for select to authenticated using (public.is_center_member(center_id) or public.is_platform_admin());
create policy subscriptions_admin_manage on public.subscriptions for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

-- Tenant tables: members can read; managers can write. More granular role policies can be added per module.
create policy students_select on public.students for select to authenticated using (public.is_center_member(center_id) or public.is_platform_admin());
create policy students_insert on public.students for insert to authenticated with check (public.has_center_role(center_id, array['center_owner','center_admin','receptionist']::public.center_role[]) or public.is_platform_admin());
create policy students_update on public.students for update to authenticated using (public.has_center_role(center_id, array['center_owner','center_admin','receptionist']::public.center_role[]) or public.is_platform_admin()) with check (public.has_center_role(center_id, array['center_owner','center_admin','receptionist']::public.center_role[]) or public.is_platform_admin());
create policy students_delete on public.students for delete to authenticated using (public.can_manage_center(center_id));

create policy guardians_select on public.guardians for select to authenticated using (public.is_center_member(center_id) or public.is_platform_admin());
create policy guardians_write on public.guardians for all to authenticated using (public.has_center_role(center_id, array['center_owner','center_admin','receptionist']::public.center_role[]) or public.is_platform_admin()) with check (public.has_center_role(center_id, array['center_owner','center_admin','receptionist']::public.center_role[]) or public.is_platform_admin());
create policy student_guardians_select on public.student_guardians for select to authenticated using (public.is_center_member(center_id) or public.is_platform_admin());
create policy student_guardians_write on public.student_guardians for all to authenticated using (public.has_center_role(center_id, array['center_owner','center_admin','receptionist']::public.center_role[]) or public.is_platform_admin()) with check (public.has_center_role(center_id, array['center_owner','center_admin','receptionist']::public.center_role[]) or public.is_platform_admin());

create policy teachers_select on public.teachers for select to authenticated using (public.is_center_member(center_id) or public.is_platform_admin());
create policy teachers_write on public.teachers for all to authenticated using (public.can_manage_center(center_id) or public.is_platform_admin()) with check (public.can_manage_center(center_id) or public.is_platform_admin());
create policy subjects_select on public.subjects for select to authenticated using (public.is_center_member(center_id) or public.is_platform_admin());
create policy subjects_write on public.subjects for all to authenticated using (public.can_manage_center(center_id) or public.is_platform_admin()) with check (public.can_manage_center(center_id) or public.is_platform_admin());
create policy groups_select on public.groups for select to authenticated using (public.is_center_member(center_id) or public.is_platform_admin());
create policy groups_write on public.groups for all to authenticated using (public.can_manage_center(center_id) or public.is_platform_admin()) with check (public.can_manage_center(center_id) or public.is_platform_admin());
create policy group_students_select on public.group_students for select to authenticated using (public.is_center_member(center_id) or public.is_platform_admin());
create policy group_students_write on public.group_students for all to authenticated using (public.has_center_role(center_id, array['center_owner','center_admin','receptionist']::public.center_role[]) or public.is_platform_admin()) with check (public.has_center_role(center_id, array['center_owner','center_admin','receptionist']::public.center_role[]) or public.is_platform_admin());

create policy sessions_select on public.sessions for select to authenticated using (public.is_center_member(center_id) or public.is_platform_admin());
create policy sessions_write on public.sessions for all to authenticated using (public.has_center_role(center_id, array['center_owner','center_admin','teacher']::public.center_role[]) or public.is_platform_admin()) with check (public.has_center_role(center_id, array['center_owner','center_admin','teacher']::public.center_role[]) or public.is_platform_admin());
create policy attendance_select on public.attendance for select to authenticated using (public.is_center_member(center_id) or public.is_platform_admin());
create policy attendance_write on public.attendance for all to authenticated using (public.has_center_role(center_id, array['center_owner','center_admin','teacher']::public.center_role[]) or public.is_platform_admin()) with check (public.has_center_role(center_id, array['center_owner','center_admin','teacher']::public.center_role[]) or public.is_platform_admin());

create policy payments_select on public.payments for select to authenticated using (public.has_center_role(center_id, array['center_owner','center_admin','accountant','receptionist']::public.center_role[]) or public.is_platform_admin());
create policy payments_insert on public.payments for insert to authenticated with check (public.has_center_role(center_id, array['center_owner','center_admin','accountant','receptionist']::public.center_role[]) or public.is_platform_admin());
create policy payments_update on public.payments for update to authenticated using (public.has_center_role(center_id, array['center_owner','center_admin','accountant']::public.center_role[]) or public.is_platform_admin()) with check (public.has_center_role(center_id, array['center_owner','center_admin','accountant']::public.center_role[]) or public.is_platform_admin());
create policy payments_delete on public.payments for delete to authenticated using (public.can_manage_center(center_id));

create policy invoices_select on public.invoices for select to authenticated using (public.has_center_role(center_id, array['center_owner','center_admin','accountant','receptionist']::public.center_role[]) or public.is_platform_admin());
create policy invoices_write on public.invoices for all to authenticated using (public.has_center_role(center_id, array['center_owner','center_admin','accountant']::public.center_role[]) or public.is_platform_admin()) with check (public.has_center_role(center_id, array['center_owner','center_admin','accountant']::public.center_role[]) or public.is_platform_admin());
create policy receipts_select on public.receipts for select to authenticated using (public.has_center_role(center_id, array['center_owner','center_admin','accountant','receptionist']::public.center_role[]) or public.is_platform_admin());
create policy receipts_write on public.receipts for all to authenticated using (public.has_center_role(center_id, array['center_owner','center_admin','accountant']::public.center_role[]) or public.is_platform_admin()) with check (public.has_center_role(center_id, array['center_owner','center_admin','accountant']::public.center_role[]) or public.is_platform_admin());
create policy expenses_select on public.expenses for select to authenticated using (public.has_center_role(center_id, array['center_owner','center_admin','accountant']::public.center_role[]) or public.is_platform_admin());
create policy expenses_write on public.expenses for all to authenticated using (public.has_center_role(center_id, array['center_owner','center_admin','accountant']::public.center_role[]) or public.is_platform_admin()) with check (public.has_center_role(center_id, array['center_owner','center_admin','accountant']::public.center_role[]) or public.is_platform_admin());

create policy notifications_select on public.notifications for select to authenticated using (user_id = (select auth.uid()) or public.can_manage_center(center_id) or public.is_platform_admin());
create policy notifications_update on public.notifications for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy audit_logs_select on public.audit_logs for select to authenticated using (public.can_manage_center(center_id) or public.is_platform_admin());
create policy audit_logs_insert on public.audit_logs for insert to authenticated with check (public.is_center_member(center_id) or public.is_platform_admin());

-- Seed a starter plan. Trial duration can be changed by platform admins from the plans table.
insert into public.plans(code, name_ar, name_en, monthly_price, yearly_price, trial_days, max_students, max_staff)
values ('starter', 'الباقة الأساسية', 'Starter', 499, 4990, 14, 300, 10)
on conflict (code) do nothing;
