-- EDUFLOW Sprint 4: groups, enrollment capacity and conflict-safe sessions.
-- All schedule timestamps are interpreted in the center's configured timezone.

create index if not exists groups_center_active_idx on public.groups(center_id, is_active);
create index if not exists group_students_center_group_active_idx on public.group_students(center_id, group_id, is_active);
create index if not exists sessions_center_time_idx on public.sessions(center_id, starts_at, ends_at) where status <> 'canceled';

-- Keep group membership writes limited to operational managers.
drop policy if exists group_students_select on public.group_students;
create policy group_students_select on public.group_students for select to authenticated
using (
  public.has_center_role(center_id, array['center_owner','center_admin','receptionist','accountant']::public.center_role[])
  or public.is_assigned_teacher(center_id, group_id)
  or public.is_platform_admin()
);
drop policy if exists group_students_write on public.group_students;
create policy group_students_write on public.group_students for all to authenticated
using (public.has_center_role(center_id, array['center_owner','center_admin','receptionist']::public.center_role[]) or public.is_platform_admin())
with check (public.has_center_role(center_id, array['center_owner','center_admin','receptionist']::public.center_role[]) or public.is_platform_admin());

-- A single trigger serializes writes per center before checking capacity/conflicts,
-- preventing two concurrent requests from bypassing the checks.
create or replace function public.guard_group_student_capacity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_capacity integer; v_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.center_id::text, 4106));
  select capacity into v_capacity from public.groups
   where id = new.group_id and center_id = new.center_id and is_active;
  if not found then raise exception 'المجموعة غير موجودة أو غير نشطة.'; end if;
  if new.is_active then
    select count(*) into v_count from public.group_students
     where center_id = new.center_id and group_id = new.group_id and is_active
       and (tg_op = 'INSERT' or (student_id, group_id) <> (new.student_id, new.group_id));
    if v_capacity is not null and v_count >= v_capacity then
      raise exception 'اكتمل العدد الأقصى للمجموعة.';
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists group_student_capacity_guard on public.group_students;
create trigger group_student_capacity_guard before insert or update of is_active, group_id on public.group_students
for each row execute function public.guard_group_student_capacity();

create or replace function public.guard_session_conflicts()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_teacher uuid; v_room text;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.center_id::text, 4107));
  select teacher_id, nullif(btrim(coalesce(new.room_label, room_label)), '')
    into v_teacher, v_room from public.groups
   where id = new.group_id and center_id = new.center_id and is_active;
  if not found then raise exception 'المجموعة غير موجودة أو غير نشطة.'; end if;
  if new.ends_at <= new.starts_at then raise exception 'وقت نهاية الحصة يجب أن يكون بعد بدايتها.'; end if;
  if new.status <> 'canceled' and exists (
    select 1 from public.sessions s
    join public.groups other_g on other_g.id = s.group_id and other_g.center_id = s.center_id
    where s.center_id = new.center_id and s.status <> 'canceled'
      and s.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
      and tstzrange(s.starts_at, s.ends_at, '[)') && tstzrange(new.starts_at, new.ends_at, '[)')
      and ((v_teacher is not null and other_g.teacher_id = v_teacher)
        or (v_room is not null and nullif(btrim(coalesce(s.room_label, other_g.room_label)), '') = v_room))
  ) then
    raise exception 'تعارض في موعد المدرس أو القاعة. اختر موعداً آخر.';
  end if;
  return new;
end; $$;
drop trigger if exists sessions_conflict_guard on public.sessions;
create trigger sessions_conflict_guard before insert or update of group_id, starts_at, ends_at, status, room_label on public.sessions
for each row execute function public.guard_session_conflicts();

-- Create a session from center-local date/time values; DB converts using center timezone.
create or replace function public.create_group_session(
  p_center_id uuid, p_group_id uuid, p_session_date date,
  p_start_time time, p_end_time time, p_room_label text default null, p_notes text default null
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_timezone text; v_session_id uuid;
begin
  if not (public.has_center_role(p_center_id, array['center_owner','center_admin']::public.center_role[]) or public.is_platform_admin()) then
    raise exception 'ليس لديك صلاحية جدولة الحصص.';
  end if;
  select timezone into v_timezone from public.centers where id = p_center_id and is_active;
  if v_timezone is null then raise exception 'السنتر غير موجود أو غير نشط.'; end if;
  insert into public.sessions(center_id, group_id, starts_at, ends_at, room_label, notes, created_by)
  values (
    p_center_id, p_group_id,
    (p_session_date + p_start_time) at time zone v_timezone,
    (p_session_date + p_end_time) at time zone v_timezone,
    nullif(btrim(p_room_label), ''), nullif(btrim(p_notes), ''), auth.uid()
  ) returning id into v_session_id;
  return v_session_id;
end; $$;
revoke all on function public.create_group_session(uuid,uuid,date,time,time,text,text) from public;
grant execute on function public.create_group_session(uuid,uuid,date,time,time,text,text) to authenticated;

-- Generate a series of weekly sessions atomically (all dates succeed or none do).
create or replace function public.create_weekly_group_sessions(
  p_center_id uuid, p_group_id uuid, p_weekday integer, p_first_date date,
  p_start_time time, p_end_time time, p_weeks integer default 8,
  p_room_label text default null, p_notes text default null
) returns integer language plpgsql security invoker set search_path = '' as $$
declare v_timezone text; v_date date; v_offset integer; v_created integer := 0;
begin
  if not (public.has_center_role(p_center_id, array['center_owner','center_admin']::public.center_role[]) or public.is_platform_admin()) then
    raise exception 'ليس لديك صلاحية جدولة الحصص.';
  end if;
  if p_weekday < 0 or p_weekday > 6 or p_weeks < 1 or p_weeks > 52 then
    raise exception 'بيانات التكرار الأسبوعي غير صحيحة.';
  end if;
  if p_end_time <= p_start_time then raise exception 'وقت نهاية الحصة يجب أن يكون بعد بدايتها.'; end if;
  select timezone into v_timezone from public.centers where id = p_center_id and is_active;
  if v_timezone is null then raise exception 'السنتر غير موجود أو غير نشط.'; end if;
  v_offset := (p_weekday - extract(dow from p_first_date)::integer + 7) % 7;
  v_date := p_first_date + v_offset;
  for i in 1..p_weeks loop
    insert into public.sessions(center_id, group_id, starts_at, ends_at, room_label, notes, created_by)
    values (p_center_id, p_group_id,
      (v_date + p_start_time) at time zone v_timezone,
      (v_date + p_end_time) at time zone v_timezone,
      nullif(btrim(p_room_label), ''), nullif(btrim(p_notes), ''), auth.uid());
    v_created := v_created + 1;
    v_date := v_date + 7;
  end loop;
  return v_created;
end; $$;
revoke all on function public.create_weekly_group_sessions(uuid,uuid,integer,date,time,time,integer,text,text) from public;
grant execute on function public.create_weekly_group_sessions(uuid,uuid,integer,date,time,time,integer,text,text) to authenticated;
