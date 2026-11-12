# EDUFLOW — Sprint 6: Finance & Payments

## Delivered
- Finance dashboard at `/app/[centerId]/finance`.
- Student invoices with due date, total and paid amount.
- Partial and full payments linked to invoices; overpayment is rejected under a row lock.
- Receipt record automatically created for each successful payment.
- Expense entry and recent transaction tables.
- Summary cards for collected payments, recorded expenses, invoice outstanding balance and net cash movement.
- Finance Server Actions validate inputs with Zod; mutations use authenticated PostgreSQL RPC functions.
- Dashboard navigation includes Finance.

## Migration
Apply `supabase/migrations/0008_finance_payments.sql` after migrations 0001–0007.

## Permissions
- Owner/Admin/Accountant: invoices, payments and expenses.
- Receptionist: record payments and receipts; read finance records according to existing policies; cannot create invoices or expenses.
- Teachers: no finance write access.
- Platform admin: administrative access through existing helper.
- Financial history is not deletable through authenticated app access.

## Important implementation notes
- `invoices.paid_amount` tracks allocated payment total. The trigger derives `unpaid`, `partially_paid`, or `paid` status unless the invoice is explicitly `void`.
- Payment + invoice balance update + receipt insertion execute inside one PostgreSQL function transaction. Any failure rolls back all steps.
- Payment allocations are one payment to one optional invoice in this sprint. Split payments across multiple invoices and refunds/credit notes are future work.
- Dashboard figures are all-time totals for the latest 100 rows fetched per category, not date-filtered accounting statements. Do not present these cards as audited ledger balances.
- `create_student_invoice` currently accepts a description argument for forward compatibility; the base invoices table has no description column, so it is not persisted.
- Receipt numbers are generated from date and payment UUID fragment; they are unique enough for practical use but should be reviewed against any statutory numbering requirements before production.

## Manual verification checklist
1. Apply all migrations in order to a disposable Supabase project.
2. Create an active student and create an invoice.
3. Record a partial payment; verify invoice status becomes `partially_paid` and a receipt exists.
4. Record the remaining amount; verify invoice status becomes `paid`.
5. Attempt an overpayment; verify the RPC rejects it and no payment/receipt is created.
6. Attempt a payment against another student's invoice; verify rejection.
7. Record an expense and verify totals/list update.
8. Test owner, accountant, receptionist and teacher accounts separately.
9. Test two simultaneous payments against the same invoice; row locking must prevent overpayment.
10. Confirm tenant A cannot read or mutate tenant B records.

## Not included
Payroll calculations/payouts, recurring tuition generation, split allocations, refunds, void/reversal workflow, PDF receipt rendering, tax compliance, bank reconciliation, date-range exports and audited double-entry ledger.

## Test status
Files and ZIP integrity can be checked locally. No production Supabase project is connected here; migration execution, RLS integration tests and full Next.js build must be run by the team before deployment.
