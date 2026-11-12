-- EDUFLOW Sprint 1 hardening: teacher scoping + updated_at automation.

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['profiles','centers','subscriptions','students','teachers','groups']
  loop
    execute format('create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

create or replace function public.is_assigned_teacher(p_center_id uuid, p_group_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.groups g
    join public.teachers t on t.id = g.teacher_id and t.center_id = g.center_id
    where g.center_id = p_center_id and g.id = p_group_id
      and t.user_id = (select auth.uid()) and g.is_active and t.is_active
  );
$$;

create or replace function public.can_access_student(p_center_id uuid, p_student_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_center_role(p_center_id, array['center_owner','center_admin','accountant','receptionist']::public.center_role[])
    or exists (
      select 1
      from public.group_students gs
      join public.groups g on g.id = gs.group_id and g.center_id = gs.center_id
      join public.teachers t on t.id = g.teacher_id and t.center_id = g.center_id
      where gs.center_id = p_center_id and gs.student_id = p_student_id
        and gs.is_active and g.is_active and t.is_active and t.user_id = (select auth.uid())
    )
    or public.is_platform_admin();
$$;

-- Students: staff with an operational/finance role, or teachers who teach that student.
drop policy if exists students_select on public.students;
create policy students_select on public.students for select to authenticated
using (public.can_access_student(center_id, id));

-- Group rosters are visible to managers/reception and the teacher assigned to that group.
drop policy if exists group_students_select on public.group_students;
create policy group_students_select on public.group_students for select to authenticated
using (
  public.has_center_role(center_id, array['center_owner','center_admin','receptionist','accountant']::public.center_role[])
  or public.is_assigned_teacher(center_id, group_id)
  or public.is_platform_admin()
);

-- Teachers only see groups and sessions assigned to them; managers retain full center access.
drop policy if exists groups_select on public.groups;
create policy groups_select on public.groups for select to authenticated
using (
  public.has_center_role(center_id, array['center_owner','center_admin','accountant','receptionist']::public.center_role[])
  or public.is_assigned_teacher(center_id, id)
  or public.is_platform_admin()
);

drop policy if exists sessions_select on public.sessions;
create policy sessions_select on public.sessions for select to authenticated
using (
  public.has_center_role(center_id, array['center_owner','center_admin','accountant','receptionist']::public.center_role[])
  or public.is_assigned_teacher(center_id, group_id)
  or public.is_platform_admin()
);

drop policy if exists sessions_write on public.sessions;
create policy sessions_write on public.sessions for all to authenticated
using (
  public.has_center_role(center_id, array['center_owner','center_admin']::public.center_role[])
  or public.is_assigned_teacher(center_id, group_id)
  or public.is_platform_admin()
)
with check (
  public.has_center_role(center_id, array['center_owner','center_admin']::public.center_role[])
  or public.is_assigned_teacher(center_id, group_id)
  or public.is_platform_admin()
);

drop policy if exists attendance_select on public.attendance;
create policy attendance_select on public.attendance for select to authenticated
using (
  public.has_center_role(center_id, array['center_owner','center_admin','accountant','receptionist']::public.center_role[])
  or exists (
    select 1 from public.sessions s
    where s.id = attendance.session_id and s.center_id = attendance.center_id
      and public.is_assigned_teacher(s.center_id, s.group_id)
  )
  or public.is_platform_admin()
);

drop policy if exists attendance_write on public.attendance;
create policy attendance_write on public.attendance for all to authenticated
using (
  public.has_center_role(center_id, array['center_owner','center_admin']::public.center_role[])
  or exists (
    select 1 from public.sessions s
    where s.id = attendance.session_id and s.center_id = attendance.center_id
      and public.is_assigned_teacher(s.center_id, s.group_id)
  )
  or public.is_platform_admin()
)
with check (
  public.has_center_role(center_id, array['center_owner','center_admin']::public.center_role[])
  or exists (
    select 1 from public.sessions s
    where s.id = attendance.session_id and s.center_id = attendance.center_id
      and public.is_assigned_teacher(s.center_id, s.group_id)
  )
  or public.is_platform_admin()
);
