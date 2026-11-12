-- EDUFLOW Sprint 5: attendance workflow and student progress reporting.
create index if not exists attendance_center_student_idx on public.attendance(center_id, student_id, marked_at desc);
create index if not exists attendance_center_session_idx on public.attendance(center_id, session_id);

-- Attendance must belong to a student actively enrolled in the session's group.
create or replace function public.validate_attendance_enrollment()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.sessions s
    join public.group_students gs on gs.center_id=s.center_id and gs.group_id=s.group_id
    where s.id=new.session_id and s.center_id=new.center_id
      and gs.student_id=new.student_id and gs.is_active
      and s.status <> 'canceled'
  ) then raise exception 'الطالب غير مسجل في هذه المجموعة أو أن الحصة ملغاة.'; end if;
  return new;
end; $$;
drop trigger if exists attendance_enrollment_guard on public.attendance;
create trigger attendance_enrollment_guard before insert or update of session_id, student_id, center_id on public.attendance
for each row execute function public.validate_attendance_enrollment();

-- Atomic bulk save. One invalid student rejects the whole attendance submission.
create or replace function public.save_session_attendance(p_center_id uuid, p_session_id uuid, p_entries jsonb)
returns integer language plpgsql security invoker set search_path = '' as $$
declare v_group_id uuid; v_count integer := 0; v_entry jsonb; v_student_id uuid; v_status public.attendance_status; v_role_ok boolean;
begin
  if jsonb_typeof(p_entries) <> 'array' or jsonb_array_length(p_entries) = 0 then
    raise exception 'لا توجد سجلات حضور لإرسالها.';
  end if;
  select s.group_id into v_group_id from public.sessions s
   where s.id=p_session_id and s.center_id=p_center_id and s.status <> 'canceled';
  if v_group_id is null then raise exception 'الحصة غير موجودة أو ملغاة.'; end if;
  v_role_ok := public.has_center_role(p_center_id, array['center_owner','center_admin','receptionist']::public.center_role[])
    or public.is_assigned_teacher(p_center_id, v_group_id) or public.is_platform_admin();
  if not v_role_ok then raise exception 'ليس لديك صلاحية تسجيل الحضور لهذه الحصة.'; end if;
  if jsonb_array_length(p_entries) > 500 then raise exception 'عدد الطلاب يتجاوز الحد المسموح.'; end if;
  for v_entry in select value from jsonb_array_elements(p_entries) loop
    v_student_id := (v_entry->>'student_id')::uuid;
    v_status := (v_entry->>'status')::public.attendance_status;
    if not exists (select 1 from public.group_students gs where gs.center_id=p_center_id and gs.group_id=v_group_id and gs.student_id=v_student_id and gs.is_active) then
      raise exception 'يوجد طالب غير مسجل في المجموعة.';
    end if;
    insert into public.attendance(center_id, session_id, student_id, status, marked_by, marked_at, notes)
    values (p_center_id, p_session_id, v_student_id, v_status, auth.uid(), now(), nullif(btrim(v_entry->>'notes'),''))
    on conflict (session_id, student_id) do update set status=excluded.status, marked_by=excluded.marked_by, marked_at=excluded.marked_at, notes=excluded.notes;
    v_count := v_count + 1;
  end loop;
  update public.sessions set status='completed' where id=p_session_id and center_id=p_center_id and status='scheduled';
  return v_count;
end; $$;
revoke all on function public.save_session_attendance(uuid,uuid,jsonb) from public;
grant execute on function public.save_session_attendance(uuid,uuid,jsonb) to authenticated;

-- Tighten attendance writes: accountants can review reports but cannot mark attendance.
drop policy if exists attendance_write on public.attendance;
create policy attendance_write on public.attendance for all to authenticated
using (
  public.has_center_role(center_id, array['center_owner','center_admin','receptionist']::public.center_role[])
  or exists (select 1 from public.sessions s where s.id=attendance.session_id and s.center_id=attendance.center_id and public.is_assigned_teacher(s.center_id,s.group_id))
  or public.is_platform_admin()
)
with check (
  public.has_center_role(center_id, array['center_owner','center_admin','receptionist']::public.center_role[])
  or exists (select 1 from public.sessions s where s.id=attendance.session_id and s.center_id=attendance.center_id and public.is_assigned_teacher(s.center_id,s.group_id))
  or public.is_platform_admin()
);
