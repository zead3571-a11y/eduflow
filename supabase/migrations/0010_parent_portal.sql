-- EDUFLOW Sprint 8: secure guardian portal, account claiming and student assessments.
-- A guardian can claim an invitation only when the authenticated email matches the
-- guardian record. Raw invitation tokens are never stored in the database.

alter table public.guardians
  add column if not exists user_id uuid references auth.users(id) on delete set null;
create unique index if not exists guardians_center_user_unique
  on public.guardians(center_id, user_id) where user_id is not null;

create table if not exists public.guardian_portal_invites (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers(id) on delete cascade,
  guardian_id uuid not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  claimed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (center_id, guardian_id) references public.guardians(center_id, id) on delete cascade
);
create index if not exists guardian_invites_expiry_idx on public.guardian_portal_invites(expires_at) where claimed_at is null;
alter table public.guardian_portal_invites enable row level security;
-- No direct client policies: invite creation/claiming happens through narrowly scoped RPCs.

create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers(id) on delete cascade,
  group_id uuid not null,
  title text not null,
  assessment_date date not null default current_date,
  max_score numeric(8,2) not null default 100 check (max_score > 0),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (center_id, id),
  foreign key (center_id, group_id) references public.groups(center_id, id) on delete cascade
);
create table if not exists public.student_assessments (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers(id) on delete cascade,
  assessment_id uuid not null,
  student_id uuid not null,
  score numeric(8,2) not null check (score >= 0),
  feedback text,
  created_at timestamptz not null default now(),
  unique (assessment_id, student_id),
  foreign key (center_id, assessment_id) references public.assessments(center_id, id) on delete cascade,
  foreign key (center_id, student_id) references public.students(center_id, id) on delete cascade
);
create index if not exists assessments_center_date_idx on public.assessments(center_id, assessment_date desc);
create index if not exists student_assessments_student_idx on public.student_assessments(center_id, student_id, created_at desc);
alter table public.assessments enable row level security;
alter table public.student_assessments enable row level security;

create or replace function public.create_guardian_portal_invite(p_center_id uuid, p_guardian_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare v_token text; v_email text;
begin
  if not public.has_center_role(p_center_id, array['center_owner','center_admin','receptionist']::public.center_role[]) then
    raise exception 'غير مصرح بإنشاء دعوة ولي الأمر.';
  end if;
  select email into v_email from public.guardians where center_id=p_center_id and id=p_guardian_id;
  if not found or coalesce(v_email,'') = '' then raise exception 'ولي الأمر غير موجود أو لا يملك بريداً إلكترونياً.'; end if;
  v_token := encode(gen_random_bytes(32),'hex');
  update public.guardian_portal_invites set claimed_at=now()
    where center_id=p_center_id and guardian_id=p_guardian_id and claimed_at is null;
  insert into public.guardian_portal_invites(center_id,guardian_id,token_hash,expires_at,created_by)
    values(p_center_id,p_guardian_id,encode(digest(v_token,'sha256'),'hex'),now()+interval '7 days',auth.uid());
  return v_token;
end; $$;
revoke all on function public.create_guardian_portal_invite(uuid,uuid) from public, anon;
grant execute on function public.create_guardian_portal_invite(uuid,uuid) to authenticated;

create or replace function public.claim_guardian_portal_invite(p_token text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_invite public.guardian_portal_invites%rowtype; v_email text; v_guardian_email text;
begin
  if auth.uid() is null then raise exception 'يجب تسجيل الدخول أولاً.'; end if;
  v_email := lower(coalesce(auth.jwt()->>'email',''));
  if length(coalesce(p_token,'')) < 32 then raise exception 'رابط الدعوة غير صالح.'; end if;
  select * into v_invite from public.guardian_portal_invites
   where token_hash=encode(digest(p_token,'sha256'),'hex') and claimed_at is null and expires_at > now()
   for update;
  if not found then raise exception 'الدعوة غير صالحة أو انتهت صلاحيتها.'; end if;
  select lower(email) into v_guardian_email from public.guardians
   where center_id=v_invite.center_id and id=v_invite.guardian_id;
  if v_email = '' or v_email <> coalesce(v_guardian_email,'') then
    raise exception 'يجب تسجيل الدخول بالبريد الإلكتروني المسجل لدى السنتر.';
  end if;
  if exists(select 1 from public.guardians where center_id=v_invite.center_id and user_id=auth.uid() and id<>v_invite.guardian_id) then
    raise exception 'هذا الحساب مرتبط بولي أمر آخر داخل السنتر.';
  end if;
  update public.guardians set user_id=auth.uid()
   where center_id=v_invite.center_id and id=v_invite.guardian_id;
  update public.guardian_portal_invites set claimed_at=now() where id=v_invite.id;
  return v_invite.center_id;
end; $$;
revoke all on function public.claim_guardian_portal_invite(text) from public, anon;
grant execute on function public.claim_guardian_portal_invite(text) to authenticated;

-- Parent read access is limited to students explicitly linked to a guardian account.
drop policy if exists guardians_parent_self on public.guardians;
create policy guardians_parent_self on public.guardians for select to authenticated using (user_id=(select auth.uid()));
drop policy if exists students_parent_linked on public.students;
create policy students_parent_linked on public.students for select to authenticated using (
  exists(select 1 from public.student_guardians sg join public.guardians gd
    on gd.center_id=sg.center_id and gd.id=sg.guardian_id
    where sg.center_id=students.center_id and sg.student_id=students.id and gd.user_id=(select auth.uid()))
);
drop policy if exists student_guardians_parent_self on public.student_guardians;
create policy student_guardians_parent_self on public.student_guardians for select to authenticated using (
  exists(select 1 from public.guardians gd where gd.center_id=student_guardians.center_id
    and gd.id=student_guardians.guardian_id and gd.user_id=(select auth.uid()))
);
drop policy if exists group_students_parent_linked on public.group_students;
create policy group_students_parent_linked on public.group_students for select to authenticated using (
  exists(select 1 from public.student_guardians sg join public.guardians gd
    on gd.center_id=sg.center_id and gd.id=sg.guardian_id
    where sg.center_id=group_students.center_id and sg.student_id=group_students.student_id and gd.user_id=(select auth.uid()))
);
drop policy if exists groups_parent_linked on public.groups;
create policy groups_parent_linked on public.groups for select to authenticated using (
  exists(select 1 from public.group_students gs join public.student_guardians sg
    on sg.center_id=gs.center_id and sg.student_id=gs.student_id
    join public.guardians gd on gd.center_id=sg.center_id and gd.id=sg.guardian_id
    where gs.center_id=groups.center_id and gs.group_id=groups.id and gd.user_id=(select auth.uid()))
);
drop policy if exists sessions_parent_linked on public.sessions;
create policy sessions_parent_linked on public.sessions for select to authenticated using (
  exists(select 1 from public.group_students gs join public.student_guardians sg
    on sg.center_id=gs.center_id and sg.student_id=gs.student_id
    join public.guardians gd on gd.center_id=sg.center_id and gd.id=sg.guardian_id
    where gs.center_id=sessions.center_id and gs.group_id=sessions.group_id and gd.user_id=(select auth.uid()))
);
drop policy if exists attendance_parent_linked on public.attendance;
create policy attendance_parent_linked on public.attendance for select to authenticated using (
  exists(select 1 from public.student_guardians sg join public.guardians gd
    on gd.center_id=sg.center_id and gd.id=sg.guardian_id
    where sg.center_id=attendance.center_id and sg.student_id=attendance.student_id and gd.user_id=(select auth.uid()))
);
drop policy if exists invoices_parent_linked on public.invoices;
create policy invoices_parent_linked on public.invoices for select to authenticated using (
  exists(select 1 from public.student_guardians sg join public.guardians gd
    on gd.center_id=sg.center_id and gd.id=sg.guardian_id
    where sg.center_id=invoices.center_id and sg.student_id=invoices.student_id and gd.user_id=(select auth.uid()))
);
drop policy if exists payments_parent_linked on public.payments;
create policy payments_parent_linked on public.payments for select to authenticated using (
  exists(select 1 from public.student_guardians sg join public.guardians gd
    on gd.center_id=sg.center_id and gd.id=sg.guardian_id
    where sg.center_id=payments.center_id and sg.student_id=payments.student_id and gd.user_id=(select auth.uid()))
);
drop policy if exists receipts_parent_linked on public.receipts;
create policy receipts_parent_linked on public.receipts for select to authenticated using (
  exists(select 1 from public.payments p join public.student_guardians sg
    on sg.center_id=p.center_id and sg.student_id=p.student_id
    join public.guardians gd on gd.center_id=sg.center_id and gd.id=sg.guardian_id
    where p.center_id=receipts.center_id and p.id=receipts.payment_id and gd.user_id=(select auth.uid()))
);

create policy assessments_staff_read on public.assessments for select to authenticated using (
  public.is_center_member(center_id) or public.is_platform_admin()
);
create policy assessments_staff_write on public.assessments for all to authenticated using (
  public.has_center_role(center_id,array['center_owner','center_admin','teacher']::public.center_role[]) or public.is_platform_admin()
) with check (
  public.has_center_role(center_id,array['center_owner','center_admin','teacher']::public.center_role[]) or public.is_platform_admin()
);
create policy assessments_parent_linked on public.assessments for select to authenticated using (
  exists(select 1 from public.group_students gs join public.student_guardians sg
    on sg.center_id=gs.center_id and sg.student_id=gs.student_id
    join public.guardians gd on gd.center_id=sg.center_id and gd.id=sg.guardian_id
    where gs.center_id=assessments.center_id and gs.group_id=assessments.group_id and gd.user_id=(select auth.uid()))
);
create policy student_assessments_staff_read on public.student_assessments for select to authenticated using (
  public.is_center_member(center_id) or public.is_platform_admin()
);
create policy student_assessments_staff_write on public.student_assessments for all to authenticated using (
  public.has_center_role(center_id,array['center_owner','center_admin','teacher']::public.center_role[]) or public.is_platform_admin()
) with check (
  public.has_center_role(center_id,array['center_owner','center_admin','teacher']::public.center_role[]) or public.is_platform_admin()
);
create policy student_assessments_parent_linked on public.student_assessments for select to authenticated using (
  exists(select 1 from public.student_guardians sg join public.guardians gd
    on gd.center_id=sg.center_id and gd.id=sg.guardian_id
    where sg.center_id=student_assessments.center_id and sg.student_id=student_assessments.student_id and gd.user_id=(select auth.uid()))
);
drop policy if exists centers_parent_linked on public.centers;
create policy centers_parent_linked on public.centers for select to authenticated using (
  exists(select 1 from public.guardians gd where gd.center_id=centers.id and gd.user_id=(select auth.uid()))
);

create or replace function public.record_group_assessment(
  p_center_id uuid, p_group_id uuid, p_title text, p_assessment_date date,
  p_max_score numeric, p_results jsonb
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_assessment_id uuid; v_item jsonb; v_student_id uuid; v_score numeric; v_feedback text;
begin
  if not public.has_center_role(p_center_id,array['center_owner','center_admin','teacher']::public.center_role[]) then
    raise exception 'غير مصرح بتسجيل التقييمات.';
  end if;
  if p_max_score <= 0 or jsonb_typeof(p_results) <> 'array' then raise exception 'بيانات التقييم غير صالحة.'; end if;
  if not exists(select 1 from public.groups where center_id=p_center_id and id=p_group_id and is_active) then
    raise exception 'المجموعة غير موجودة أو غير نشطة.';
  end if;
  insert into public.assessments(center_id,group_id,title,assessment_date,max_score,created_by)
    values(p_center_id,p_group_id,left(trim(p_title),160),p_assessment_date,p_max_score,auth.uid())
    returning id into v_assessment_id;
  for v_item in select value from jsonb_array_elements(p_results) loop
    v_student_id := (v_item->>'student_id')::uuid;
    v_score := (v_item->>'score')::numeric;
    v_feedback := nullif(left(coalesce(v_item->>'feedback',''),500),'');
    if v_score < 0 or v_score > p_max_score then raise exception 'الدرجة يجب أن تكون بين صفر والدرجة النهائية.'; end if;
    if not exists(select 1 from public.group_students where center_id=p_center_id and group_id=p_group_id and student_id=v_student_id and is_active) then
      raise exception 'يوجد طالب غير مسجل في هذه المجموعة.';
    end if;
    insert into public.student_assessments(center_id,assessment_id,student_id,score,feedback)
      values(p_center_id,v_assessment_id,v_student_id,v_score,v_feedback);
  end loop;
  return v_assessment_id;
end; $$;
revoke all on function public.record_group_assessment(uuid,uuid,text,date,numeric,jsonb) from public, anon;
grant execute on function public.record_group_assessment(uuid,uuid,text,date,numeric,jsonb) to authenticated;
