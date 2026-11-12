-- EDUFLOW Sprint 6: finance workflow. Financial records are immutable by deletion.
alter table public.invoices add column if not exists paid_amount numeric(12,2) not null default 0 check (paid_amount >= 0 and paid_amount <= total_amount);
alter table public.payments add column if not exists invoice_id uuid;
alter table public.payments add constraint payments_invoice_fk foreign key (center_id, invoice_id) references public.invoices(center_id, id) on delete restrict;
create index if not exists invoices_center_due_idx on public.invoices(center_id, due_at desc);
create index if not exists payments_center_paid_idx on public.payments(center_id, paid_at desc);
create index if not exists expenses_center_spent_idx on public.expenses(center_id, spent_at desc);

-- Keep invoice status synchronized when paid_amount changes.
create or replace function public.sync_invoice_status() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status <> 'void' then
    new.status := case when new.paid_amount >= new.total_amount then 'paid'
      when new.paid_amount > 0 then 'partially_paid' else 'unpaid' end;
  end if;
  return new;
end; $$;
drop trigger if exists invoices_sync_status on public.invoices;
create trigger invoices_sync_status before insert or update of paid_amount,total_amount,status on public.invoices
for each row execute function public.sync_invoice_status();

create or replace function public.create_student_invoice(
 p_center_id uuid, p_student_id uuid, p_invoice_number text, p_total numeric, p_due_at date, p_description text default null
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_id uuid;
begin
 if not (public.has_center_role(p_center_id,array['center_owner','center_admin','accountant']::public.center_role[]) or public.is_platform_admin()) then raise exception 'ليس لديك صلاحية إنشاء فاتورة.'; end if;
 if p_total <= 0 or p_total > 10000000 then raise exception 'قيمة الفاتورة غير صحيحة.'; end if;
 if not exists(select 1 from public.students where id=p_student_id and center_id=p_center_id and is_active) then raise exception 'الطالب غير موجود أو غير نشط.'; end if;
 insert into public.invoices(center_id,student_id,invoice_number,total_amount,due_at)
 values(p_center_id,p_student_id,btrim(p_invoice_number),p_total,p_due_at) returning id into v_id;
 return v_id;
end; $$;

create or replace function public.record_student_payment(
 p_center_id uuid, p_student_id uuid, p_amount numeric, p_method public.payment_method,
 p_invoice_id uuid default null, p_paid_at timestamptz default now(), p_reference text default null, p_description text default null
) returns table(payment_id uuid, receipt_number text) language plpgsql security invoker set search_path = '' as $$
declare v_payment uuid; v_receipt text; v_invoice public.invoices%rowtype;
begin
 if not (public.has_center_role(p_center_id,array['center_owner','center_admin','accountant','receptionist']::public.center_role[]) or public.is_platform_admin()) then raise exception 'ليس لديك صلاحية تسجيل دفعة.'; end if;
 if p_amount <= 0 or p_amount > 10000000 then raise exception 'قيمة الدفعة غير صحيحة.'; end if;
 if not exists(select 1 from public.students where id=p_student_id and center_id=p_center_id) then raise exception 'الطالب غير موجود في هذا السنتر.'; end if;
 if p_invoice_id is not null then
   select * into v_invoice from public.invoices where id=p_invoice_id and center_id=p_center_id and student_id=p_student_id for update;
   if not found or v_invoice.status='void' then raise exception 'الفاتورة غير صالحة.'; end if;
   if v_invoice.paid_amount + p_amount > v_invoice.total_amount then raise exception 'قيمة الدفعة تتجاوز المبلغ المتبقي في الفاتورة.'; end if;
 end if;
 insert into public.payments(center_id,student_id,invoice_id,amount,method,status,paid_at,reference_number,description,recorded_by)
 values(p_center_id,p_student_id,p_invoice_id,p_amount,p_method,'paid',p_paid_at,nullif(btrim(p_reference),''),nullif(btrim(p_description),''),auth.uid()) returning id into v_payment;
 if p_invoice_id is not null then update public.invoices set paid_amount=paid_amount+p_amount where id=p_invoice_id and center_id=p_center_id; end if;
 v_receipt := 'RC-' || to_char(now(),'YYMMDD') || '-' || upper(substr(replace(v_payment::text,'-',''),1,8));
 insert into public.receipts(center_id,payment_id,receipt_number) values(p_center_id,v_payment,v_receipt);
 return query select v_payment,v_receipt;
end; $$;

create or replace function public.create_center_expense(
 p_center_id uuid,p_title text,p_amount numeric,p_category text default null,p_spent_at date default current_date,p_notes text default null
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_id uuid;
begin
 if not (public.has_center_role(p_center_id,array['center_owner','center_admin','accountant']::public.center_role[]) or public.is_platform_admin()) then raise exception 'ليس لديك صلاحية تسجيل مصروف.'; end if;
 if p_amount <= 0 or p_amount > 10000000 then raise exception 'قيمة المصروف غير صحيحة.'; end if;
 insert into public.expenses(center_id,title,amount,category,spent_at,notes,recorded_by)
 values(p_center_id,btrim(p_title),p_amount,nullif(btrim(p_category),''),p_spent_at,nullif(btrim(p_notes),''),auth.uid()) returning id into v_id;
 return v_id;
end; $$;

revoke all on function public.create_student_invoice(uuid,uuid,text,numeric,date,text) from public;
revoke all on function public.record_student_payment(uuid,uuid,numeric,public.payment_method,uuid,timestamptz,text,text) from public;
revoke all on function public.create_center_expense(uuid,text,numeric,text,date,text) from public;
grant execute on function public.create_student_invoice(uuid,uuid,text,numeric,date,text) to authenticated;
grant execute on function public.record_student_payment(uuid,uuid,numeric,public.payment_method,uuid,timestamptz,text,text) to authenticated;
grant execute on function public.create_center_expense(uuid,text,numeric,text,date,text) to authenticated;

-- Narrow write access; accountants manage finance, receptionists can record payments only.
drop policy if exists payments_insert on public.payments;
create policy payments_insert on public.payments for insert to authenticated with check (
 public.has_center_role(center_id,array['center_owner','center_admin','accountant','receptionist']::public.center_role[]) or public.is_platform_admin());
drop policy if exists payments_update on public.payments;
create policy payments_update on public.payments for update to authenticated using (
 public.has_center_role(center_id,array['center_owner','center_admin','accountant']::public.center_role[]) or public.is_platform_admin()) with check (
 public.has_center_role(center_id,array['center_owner','center_admin','accountant']::public.center_role[]) or public.is_platform_admin());
drop policy if exists receipts_insert on public.receipts;
create policy receipts_insert on public.receipts for insert to authenticated with check (
 public.has_center_role(center_id,array['center_owner','center_admin','accountant','receptionist']::public.center_role[]) or public.is_platform_admin());
