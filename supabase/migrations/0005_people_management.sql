-- EDUFLOW Sprint 3: People management indexes and guardian relationship hardening.
create index if not exists idx_students_center_created on public.students(center_id, created_at desc);
create index if not exists idx_students_center_phone on public.students(center_id, phone);
create index if not exists idx_teachers_center_created on public.teachers(center_id, created_at desc);
create index if not exists idx_teachers_center_phone on public.teachers(center_id, phone);
create index if not exists idx_guardians_center_phone on public.guardians(center_id, phone);
create index if not exists idx_student_guardians_center_student on public.student_guardians(center_id, student_id);

-- Restrict guardian reads to center operational roles; writes remain limited to management/reception.
drop policy if exists guardians_select on public.guardians;
create policy guardians_select on public.guardians for select to authenticated
using (
  public.has_center_role(center_id, array['center_owner','center_admin','receptionist','accountant']::public.center_role[])
  or public.is_platform_admin()
);

drop policy if exists student_guardians_select on public.student_guardians;
create policy student_guardians_select on public.student_guardians for select to authenticated
using (
  public.has_center_role(center_id, array['center_owner','center_admin','receptionist','accountant']::public.center_role[])
  or public.is_platform_admin()
);
