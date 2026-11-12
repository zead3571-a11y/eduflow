# EDUFLOW Sprint 7 — Notifications & Communication

## Delivered
- Center notification page at `/app/[centerId]/notifications`.
- Per-user in-app notification list with unread count and mark-as-read action.
- Attendance trigger: when a student's attendance changes to `absent` or `late`, create an in-app notice for active center owners, admins, and receptionists.
- Guardian contact preferences: `preferred_channel` (`whatsapp`, `sms`, `email`, `none`) and `allow_notifications`.
- Communication outbox: enqueue guardian messages for absent/late events when a valid contact destination exists.
- Dashboard shortcut to the communication center.

## Important delivery boundary
The migration queues outbound messages; it does **not** send WhatsApp, SMS, or email. Actual delivery requires selecting and configuring a provider (for example, WhatsApp Business Cloud API or an Egyptian SMS gateway), then deploying a trusted server-side worker/Edge Function that claims queued rows, sends them, and updates `status`, `attempts`, `provider_message_id`, `sent_at`, and `error_message`. Never put provider secrets in browser code. A queued message must not be described to a parent as sent.

## Apply
Run migrations `0001` through `0009` in order using the Supabase CLI (`supabase db push`) after linking a development project. Do not apply only `0009` to an empty database.

## Acceptance tests
1. A center owner/admin/receptionist sees only their own in-app notifications for the selected center.
2. A teacher attendance submission for an absent/late student creates staff notifications for active owner/admin/receptionist members.
3. If a linked guardian has `allow_notifications=false` or channel `none`, no outbox row is created.
4. If a guardian chooses WhatsApp/SMS but has no phone, or email but no email, no outbox row is created.
5. Valid guardian contact preferences create a `queued` outbox row, never a `sent` row.
6. Changing attendance to `present` does not create an outbound absence/late notice; changing from absent to late creates a new late event.
7. A user cannot mark another user's notification read by calling the RPC with its ID.
8. A member of another center cannot read this center's notifications or outbox rows.
9. Verify duplicate attendance submissions do not create duplicate attendance rows (existing attendance unique constraint) and updates only enqueue when status changes.

## Security notes
- The trigger function is `SECURITY DEFINER` with an empty `search_path`; it is executable only through its trigger, not directly by client roles.
- Outbox has RLS enabled and read access only for center owners/admins/receptionists/platform admins. No client write policy is provided.
- Provider workers should use a server-side service credential and validate row state before sending. Keep secrets server-side and add retry/backoff + idempotency at the provider integration layer.
- Existing notification select policy allows a user to see their own notices or center managers to inspect center notices. This page filters to the signed-in user's own notices.

## Not included yet
- Live WhatsApp/SMS/email delivery.
- Parent portal/login accounts.
- Automated invoice due-date reminders and payment confirmation messages.
- Provider webhooks, retry worker, delivery receipts, and opt-out management UI.

## Verification status
Static file review only. Supabase migrations, RLS behavior, Next.js build, and provider delivery have not been executed against a live/test Supabase project in this environment.
