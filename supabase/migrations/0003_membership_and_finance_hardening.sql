-- Prevent tenant admins from changing ownership or deleting financial history.
create or replace function public.is_center_owner(p_center_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.center_members cm
    where cm.center_id = p_center_id and cm.user_id = (select auth.uid())
      and cm.role = 'center_owner' and cm.is_active
  );
$$;

drop policy if exists members_manage_center on public.center_members;
create policy members_insert_by_owner on public.center_members for insert to authenticated
with check (
  (public.is_center_owner(center_id) and role <> 'center_owner')
  or public.is_platform_admin()
);
create policy members_update_by_owner on public.center_members for update to authenticated
using (
  (public.is_center_owner(center_id) and user_id <> (select c.owner_user_id from public.centers c where c.id = center_members.center_id))
  or public.is_platform_admin()
)
with check (
  (public.is_center_owner(center_id) and role <> 'center_owner'
    and user_id <> (select c.owner_user_id from public.centers c where c.id = center_members.center_id))
  or public.is_platform_admin()
);
create policy members_delete_by_owner on public.center_members for delete to authenticated
using (
  (public.is_center_owner(center_id) and user_id <> (select c.owner_user_id from public.centers c where c.id = center_members.center_id))
  or public.is_platform_admin()
);

-- Financial history is not physically deleted through normal authenticated app access.
drop policy if exists payments_delete on public.payments;
create policy payments_no_delete on public.payments for delete to authenticated using (false);
create policy receipts_no_delete on public.receipts for delete to authenticated using (false);
create policy expenses_no_delete on public.expenses for delete to authenticated using (false);

-- Replace FOR ALL finance policies: PostgreSQL combines permissive policies with OR,
-- so a separate DELETE=false policy would not override a broad FOR ALL policy.
drop policy if exists invoices_write on public.invoices;
create policy invoices_insert on public.invoices for insert to authenticated
with check (public.has_center_role(center_id, array['center_owner','center_admin','accountant']::public.center_role[]) or public.is_platform_admin());
create policy invoices_update on public.invoices for update to authenticated
using (public.has_center_role(center_id, array['center_owner','center_admin','accountant']::public.center_role[]) or public.is_platform_admin())
with check (public.has_center_role(center_id, array['center_owner','center_admin','accountant']::public.center_role[]) or public.is_platform_admin());

 drop policy if exists receipts_write on public.receipts;
create policy receipts_insert on public.receipts for insert to authenticated
with check (public.has_center_role(center_id, array['center_owner','center_admin','accountant']::public.center_role[]) or public.is_platform_admin());
create policy receipts_update on public.receipts for update to authenticated
using (public.has_center_role(center_id, array['center_owner','center_admin','accountant']::public.center_role[]) or public.is_platform_admin())
with check (public.has_center_role(center_id, array['center_owner','center_admin','accountant']::public.center_role[]) or public.is_platform_admin());

drop policy if exists expenses_write on public.expenses;
create policy expenses_insert on public.expenses for insert to authenticated
with check (public.has_center_role(center_id, array['center_owner','center_admin','accountant']::public.center_role[]) or public.is_platform_admin());
create policy expenses_update on public.expenses for update to authenticated
using (public.has_center_role(center_id, array['center_owner','center_admin','accountant']::public.center_role[]) or public.is_platform_admin())
with check (public.has_center_role(center_id, array['center_owner','center_admin','accountant']::public.center_role[]) or public.is_platform_admin());
