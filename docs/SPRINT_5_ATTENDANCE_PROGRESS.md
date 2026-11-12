# EDUFLOW — Sprint 5: Attendance & Student Progress

## Delivered
- Session attendance page at `/app/[centerId]/attendance/[sessionId]`.
- Attendance overview at `/app/[centerId]/attendance` with per-session counts.
- Student progress report at `/app/[centerId]/attendance/progress` with present, absent, late, excused and total counts plus an attendance rate.
- Server action validates submitted IDs/statuses with Zod and calls a database RPC.
- Migration `0007_attendance_progress.sql` adds indexes, enrollment validation trigger and an atomic bulk attendance RPC.

## Attendance rules
- A student must be actively enrolled in the session's group.
- Canceled sessions cannot receive attendance records.
- Only center owners, center admins, receptionists, assigned teachers and platform admins can submit attendance.
- Accountants can read attendance reports but cannot mark attendance.
- The RPC validates all entries and saves them in one transaction; invalid entries roll back the whole submission.
- Saving attendance changes a scheduled session to completed.
- Statuses: `present`, `absent`, `late`, `excused`.

## Apply
Apply migrations in order, including `0007_attendance_progress.sql`, then run the app with configured Supabase environment variables.

## Manual QA checklist
1. Enroll 2+ students in a group and create a session.
2. Open attendance as the assigned teacher; verify only the assigned group can be managed.
3. Mark students present/absent/late/excused and save; reload and verify persisted values.
4. Try submitting a student who is not enrolled; the entire RPC call must fail without partial writes.
5. Cancel a session and verify attendance submission is rejected.
6. Sign in as accountant; verify reports are readable but attendance editing is denied.
7. Verify student progress totals and rate: `(present + late + excused) / total * 100`.
8. Verify one center cannot read another center's attendance or students.

## Known limitations
- No parent notifications (SMS/WhatsApp/email) in this sprint.
- No attendance correction audit history yet; current status is overwritten on correction.
- Progress is a simple attendance summary, not academic grades or exam analytics.
- No CSV/PDF export yet.
- Server-side build and live Supabase migration execution must be performed in the deployment environment; this package has not been validated against a live project.
