# Sprint 3 — Students & Teachers

## Delivered in this starter
- Center-scoped students listing and search.
- Student creation with optional primary guardian creation/linking.
- Center-scoped teachers listing and search.
- Teacher creation with specialty and contact fields.
- Zod server-side validation and Supabase RLS enforcement.
- Indexes for common center-scoped people queries.

## Apply
1. Ensure migrations 0001–0004 from Sprint 2 have been applied.
2. Run `npx supabase db push` to apply 0005.
3. Start with `npm run dev`.
4. Visit `/app/<center-uuid>/students` and `/app/<center-uuid>/teachers`.

## Permissions
- Students: owner, center admin, receptionist can create/update; accountant can view; teacher visibility is scoped by existing `can_access_student` policy.
- Teachers: existing `teachers_write` policy allows center managers (and platform admin).
- Guardian details: visible only to owner/admin/reception/accountant and platform admin after migration 0005.

## Important scope notes
This sprint implements create/list/search for students and teachers. Edit/archive workflows, bulk import, detailed student profiles, group enrollment UI, pagination, and guardian editing are planned follow-ups. Existing RLS policies are the authorization boundary; do not replace them with client-side role checks.
