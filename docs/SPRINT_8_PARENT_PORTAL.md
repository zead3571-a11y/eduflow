# EDUFLOW Sprint 8 — Parent Portal & Student Progress

## Delivered

- Guardian account linking through expiring, single-use invitation tokens.
- Invitation tokens are generated server-side, hashed with SHA-256 before storage, and expire after seven days.
- Claiming requires an authenticated account whose verified JWT email matches the guardian email stored by the center.
- Parent dashboard at `/parent/[centerId]` for all linked children in that center.
- Read-only parent views for attendance, upcoming scheduled sessions, assessments/scores, invoices, payments, and receipt numbers.
- Staff page at `/app/[centerId]/parents` to generate and share invitations.
- Staff assessment page at `/app/[centerId]/assessments` with transactional score entry for enrolled group students.
- Login preserves the `next` destination so an invited parent returns to the claim flow after authentication.
- RLS policies scope parent reads to guardian-linked students only. Parents receive no insert/update/delete policies for student, attendance, academic, or financial records.

## Migration

Apply `supabase/migrations/0010_parent_portal.sql` after migrations `0001` through `0009`.

## Routes

- `/app/[centerId]/parents` — center staff invitation management.
- `/parent/claim?token=...` — authenticated invitation claim.
- `/parent/[centerId]` — parent dashboard.
- `/app/[centerId]/assessments` — staff assessment entry.

## Invitation workflow

1. Add a guardian with a valid email and link them to one or more students.
2. An owner, admin, or receptionist opens Parent Accounts and creates an invite.
3. Share the one-time link with the guardian through a trusted channel. The raw token is not stored in the database.
4. Guardian creates/signs into an account using the same email address and opens the link.
5. The claim RPC validates token expiry, one-time use, and exact normalized email match before linking `guardians.user_id`.

## Security notes

- `guardian_portal_invites` has RLS enabled and no direct client policies.
- Token creation and claiming are performed through narrowly scoped RPCs.
- Parent access is derived from `student_guardians` + `guardians.user_id`; knowing a student UUID or center UUID is not sufficient.
- Parent financial policies are SELECT-only and only expose linked students' invoices, paid payments, and receipts.
- The parent dashboard is read-only. Assessment creation is staff-only and saved in one database transaction; every score must belong to an active enrollment in the selected group and be within the maximum score.
- The invitation URL must be shared privately. Do not publish it or place it in public channels.

## Known limitations / next work

- No automated email/WhatsApp invitation delivery; staff copy and share the link. Provider delivery requires a separately configured worker.
- Receipt PDF download is not exposed yet; only receipt numbers are displayed. Add a private Storage bucket and signed URL endpoint before exposing files.
- Parent payment is view-only; online payment gateway integration is out of scope.
- Multi-center guardians must claim a separate invitation for each center.
- Guardian profile/contact editing and invite revocation UI are not included yet.
- The current dashboard's upcoming-session list uses the browser/server runtime date; verify timezone formatting against the center timezone before production rollout.

## Verification checklist

- [ ] Apply migrations 0001–0010 to a disposable Supabase project.
- [ ] Test invite creation as owner/admin/receptionist; deny teacher/accountant.
- [ ] Confirm a wrong-email account cannot claim an invitation.
- [ ] Confirm expired and already-claimed tokens fail.
- [ ] Confirm one guardian account can see multiple linked children in the same center.
- [ ] Confirm an unrelated authenticated user cannot read the children, attendance, sessions, grades, invoices, payments, or receipts.
- [ ] Confirm parent cannot insert/update/delete any student or financial records.
- [ ] Confirm a score above max or for a non-enrolled student rolls back the whole assessment transaction.
- [ ] Run `npm ci`, `npm run typecheck`, `npm run lint`, and `npm run build`.
