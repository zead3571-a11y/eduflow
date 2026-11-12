-- EDUFLOW Sprint 7: notification center and guardian delivery queue.
-- External delivery is queued only; a provider worker/webhook must deliver it.
alter table public.notifications
  add column if not exists category text not null default 'general',
  add column if not exists entity_type text,
  add column if not exists entity_id uuid,
  add constraint notifications_category_check check (category in ('general','attendance','finance','schedule','system'));

alter table public.guardians
  add column if not exists preferred_channel text not null default 'whatsapp',
  add column if not exists allow_notifications boolean not null default true,
  add constraint guardians_preferred_channel_check check (preferred_channel in ('whatsapp','sms','email','none'));

create table if not exists public.communication_outbox (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers(id) on delete cascade,
  guardian_id uuid not null,
  student_id uuid not null,
  channel text not null check (channel in ('whatsapp','sms','email')),
  event_type text not null check (event_type in ('student_absent','student_late','payment_due')),
  destination text not null,
  message_body text not null,
  status text not null default 'queued' check (status in ('queued','processing','sent','failed','cancelled')),
  provider_message_id text,
  error_message text,
  attempts integer not null default 0 check (attempts >= 0),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (center_id, guardian_id, student_id, event_type, created_at)
);
create index if not exists communication_outbox_pending_idx on public.communication_outbox(status, created_at) where status in ('queued','failed');
create index if not exists notifications_user_unread_idx on public.notifications(user_id, created_at desc) where read_at is null;

alter table public.communication_outbox enable row level security;
create policy communication_outbox_select_managers on public.communication_outbox
  for select to authenticated using (
    public.has_center_role(center_id,array['center_owner','center_admin','receptionist']::public.center_role[])
    or public.is_platform_admin()
  );
-- No client insert/update/delete policy: delivery records are created by trusted database triggers/provider workers.

create or replace function public.queue_guardian_attendance_notice()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_student_name text;
  v_group_name text;
  v_center_name text;
  v_event text;
  v_status_label text;
  v_message text;
  v_guardian record;
begin
  if new.status not in ('absent','late') then return new; end if;
  if tg_op = 'UPDATE' and old.status = new.status then return new; end if;
  v_event := case when new.status = 'absent' then 'student_absent' else 'student_late' end;
  v_status_label := case when new.status = 'absent' then 'غائب' else 'متأخر' end;
  select st.full_name, g.name, c.name
    into v_student_name, v_group_name, v_center_name
  from public.students st
  join public.sessions s on s.center_id=st.center_id and s.id=new.session_id
  join public.groups g on g.center_id=s.center_id and g.id=s.group_id
  join public.centers c on c.id=st.center_id
  where st.center_id=new.center_id and st.id=new.student_id;
  if v_student_name is null then return new; end if;
  v_message := 'تنبيه من ' || v_center_name || ': الطالب ' || v_student_name || ' حالته ' || v_status_label || ' في حصة ' || v_group_name || '.';

  for v_guardian in
    select gd.id, gd.phone, gd.email, gd.preferred_channel
    from public.student_guardians sg
    join public.guardians gd on gd.center_id=sg.center_id and gd.id=sg.guardian_id
    where sg.center_id=new.center_id and sg.student_id=new.student_id and gd.allow_notifications
  loop
    if v_guardian.preferred_channel <> 'none'
      and ((v_guardian.preferred_channel = 'email' and coalesce(v_guardian.email,'') <> '')
        or (v_guardian.preferred_channel in ('whatsapp','sms') and coalesce(v_guardian.phone,'') <> '')) then
      insert into public.communication_outbox(center_id,guardian_id,student_id,channel,event_type,destination,message_body)
      values(new.center_id,v_guardian.id,new.student_id,v_guardian.preferred_channel,v_event,
        case v_guardian.preferred_channel when 'email' then coalesce(v_guardian.email,'') else coalesce(v_guardian.phone,'') end,v_message)
      on conflict do nothing;
    end if;
  end loop;

  insert into public.notifications(center_id,user_id,title,body,category,entity_type,entity_id)
  select new.center_id, cm.user_id,
    case when new.status='absent' then 'تسجيل غياب طالب' else 'تسجيل تأخير طالب' end,
    v_student_name || ' — ' || v_group_name || ': ' || v_status_label,
    'attendance','student',new.student_id
  from public.center_members cm
  where cm.center_id=new.center_id and cm.is_active
    and cm.role in ('center_owner','center_admin','receptionist');
  return new;
end; $$;

drop trigger if exists attendance_guardian_notice on public.attendance;
create trigger attendance_guardian_notice after insert or update of status on public.attendance
for each row execute function public.queue_guardian_attendance_notice();

create or replace function public.mark_notification_read(p_notification_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  update public.notifications set read_at=now()
  where id=p_notification_id and user_id=auth.uid();
  if not found then raise exception 'الإشعار غير موجود أو لا تملك صلاحية تعديله.'; end if;
end; $$;
revoke all on function public.mark_notification_read(uuid) from public;
grant execute on function public.mark_notification_read(uuid) to authenticated;
revoke all on function public.queue_guardian_attendance_notice() from public, anon, authenticated;
