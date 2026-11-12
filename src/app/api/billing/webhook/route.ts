import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
const eventSchema = z.object({
  provider: z.string().min(2).max(40),
  event_id: z.string().min(3).max(200),
  type: z.enum(['payment.succeeded', 'payment.failed']).or(z.string().min(3).max(100)),
  invoice_id: z.string().uuid(),
  transaction_id: z.string().min(1).max(200),
  amount: z.number().nonnegative(),
  currency: z.string().regex(/^[A-Za-z]{3}$/),
  reference: z.string().max(200).optional(),
}).passthrough();

export async function POST(request: Request) {
  const secret = process.env.BILLING_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: 'Webhook is not configured.' }, { status: 503 });
  const rawBody = await request.text();
  const supplied = request.headers.get('x-eduflow-signature') ?? '';
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(supplied, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return NextResponse.json({ error: 'Invalid signature.' }, { status: 401 });

  let body: unknown;
  try { body = JSON.parse(rawBody); } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }); }
  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid billing event.' }, { status: 400 });
  const event = parsed.data;
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc('process_billing_webhook', {
    p_provider: event.provider,
    p_event_id: event.event_id,
    p_event_type: event.type,
    p_payload: {
      invoice_id: event.invoice_id,
      transaction_id: event.transaction_id,
      amount: event.amount,
      currency: event.currency.toUpperCase(),
      reference: event.reference ?? null,
    },
  });
  if (error || (data && data.ok === false)) {
    console.error('Billing webhook processing failed', { provider: event.provider, eventId: event.event_id, message: error.message });
    return NextResponse.json({ error: 'Event processing failed.' }, { status: 500 });
  }
  return NextResponse.json(data ?? { ok: true });
}
