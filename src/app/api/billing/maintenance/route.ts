import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'Billing maintenance is not configured.' }, { status: 503 });
  const supplied = request.headers.get('authorization') ?? '';
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc('run_billing_maintenance');
  if (error) {
    console.error('Billing maintenance failed', error.message);
    return NextResponse.json({ error: 'Maintenance failed.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, ...data });
}
