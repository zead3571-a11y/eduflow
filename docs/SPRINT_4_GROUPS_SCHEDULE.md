# EDUFLOW — Sprint 4: Groups & Schedule

## Delivered
- Create academic subjects.
- Create groups and assign an optional subject and teacher.
- Set grade/level, monthly fee, room, and optional capacity.
- Enroll active students into a group; repeated enrollment is idempotent.
- Add dated sessions using the center's configured timezone.
- Generate a weekly series (1–52 occurrences) for a selected weekday; the entire series is transactional, so one conflict rolls back the whole series.
- View the upcoming/recorded sessions in the schedule page.
- Database-side capacity guard and schedule-conflict guard.

## Routes
- `/app/[centerId]/groups`
- `/app/[centerId]/schedule`

## Migration
Apply `supabase/migrations/0006_groups_schedule.sql` after migrations 0001–0005:

```bash
supabase db push
```

The session creation RPC accepts a local date and local start/end times, then converts them using `centers.timezone`. The session trigger serializes schedule writes per center and rejects overlapping sessions when the same assigned teacher or room is in use. Canceled sessions do not block a new booking. End times must be later than start times.

## Important scope notes
- Weekly scheduling currently generates concrete session rows for 1–52 weeks; it does not store a reusable recurrence template.
- There is no drag-and-drop calendar, editing/canceling sessions, or automatic attendance generation yet.
- Group creation currently supports one assigned teacher and one subject per group.
- Enrollment capacity is enforced in the database, including concurrent insert attempts.
- A teacher/room conflict check is enforced for sessions. It assumes a group has one primary teacher in `groups.teacher_id`.
- The pages are server-rendered and rely on Supabase RLS; do not expose the Supabase service-role key in the browser.

## Manual verification checklist
1. Apply all migrations in order to a disposable Supabase project.
2. Create a center, add at least one subject, teacher, and student.
3. Create a group with capacity 1 and enroll one student; enrolling a second student must fail.
4. Generate a weekly series for a group; verify the expected number of session rows and center-local times.
5. Create two groups assigned to the same teacher and try overlapping sessions; the second must fail.
6. Repeat the conflict test with the same room and different teachers.
7. Confirm that a session at an overlapping time in a different center is allowed.
8. Confirm that teacher and receptionist accounts see only the rows allowed by RLS.
9. Run `npm run typecheck`, `npm run lint`, and `npm run build`.

## Known follow-up
The current schema stores individual session instances, not reusable weekly recurrence rules. Sprint 5 should add attendance workflows, session lifecycle actions, and optionally recurrence templates with explicit timezone/DST behavior.
