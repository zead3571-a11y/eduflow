import { verifyPaymobHmac } from '@/lib/paymob/hmac.mjs';
import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PaymobTransaction = {
  id?: number | string; amount_cents?: number | string; created_at?: string; currency?: string;
  error_occured?: boolean; has_parent_transaction?: boolean; integration_id?: number | string;
  is_3d_secure?: boolean; is_auth?: boolean; is_capture?: boolean; is_refunded?: boolean;
  is_standalone_payment?: boolean; is_voided?: boolean; pending?: boolean; success?: boolean;
  owner?: number | string; order?: { id?: number | string; merchant_order_id?: string | null };
  source_data?: { pan?: string | null; sub_type?: string | null; type?: string | null };
  payment_key_claims?: { extra?: { invoice_id?: string } }; is_live?: boolean;
};


export async function POST(request: Request) {
  const secret = process.env.PAYMOB_HMAC_SECRET;
  if (!secret) return NextResponse.json({ error: 'Paymob webhook is not configured.' }, { status: 503 });

  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > 256_000) return NextResponse.json({ error: 'Payload too large.' }, { status: 413 });

  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, 'utf8') > 256_000) return NextResponse.json({ error: 'Payload too large.' }, { status: 413 });
  let body: { type?: string; obj?: PaymobTransaction };
  try { body = JSON.parse(rawBody); } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }); }
  const obj = body?.obj;
  if (body?.type !== 'TRANSACTION' || !obj || obj.id === undefined) {
    return NextResponse.json({ error: 'Unsupported Paymob callback.' }, { status: 400 });
  }
  const signature = new URL(request.url).searchParams.get('hmac') || '';
  if (!verifyPaymobHmac(obj, signature, secret)) return NextResponse.json({ error: 'Invalid Paymob HMAC.' }, { status: 401 });

  // The browser redirect is not trusted. Only this authenticated server callback updates billing state.
  if (obj.is_refunded === true || obj.is_voided === true || obj.pending === true) {
    return NextResponse.json({ ok: true, ignored: true });
  }
  const invoiceId = obj.order?.merchant_order_id || obj.payment_key_claims?.extra?.invoice_id;
  const orderId = obj.order?.id;
  const transactionId = String(obj.id);
  const amountCents = Number(obj.amount_cents);
  const amount = amountCents / 100;
  const currency = String(obj.currency || '').toUpperCase();
  if (!invoiceId || !orderId || !Number.isSafeInteger(amountCents) || amountCents <= 0 || currency !== 'EGP') {
    return NextResponse.json({ error: 'Incomplete Paymob transaction details.' }, { status: 400 });
  }

  const configuredMode = process.env.PAYMOB_MODE;
  const allowedIntegrationIds = (process.env.PAYMOB_INTEGRATION_IDS || '').split(',').map((id) => id.trim()).filter(Boolean);
  if (!['test', 'live'].includes(configuredMode || '') || allowedIntegrationIds.length === 0) {
    console.error('Paymob webhook configuration is incomplete.');
    return NextResponse.json({ error: 'Paymob webhook is not fully configured.' }, { status: 503 });
  }
  if (!allowedIntegrationIds.includes(String(obj.integration_id))) {
    return NextResponse.json({ error: 'Unexpected Paymob integration.' }, { status: 401 });
  }
  const expectedLive = configuredMode === 'live';
  if (typeof obj.is_live !== 'boolean' || obj.is_live !== expectedLive) {
    return NextResponse.json({ error: 'Paymob environment mismatch.' }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const { data: invoice, error: invoiceError } = await admin.from('subscription_invoices')
    .select('id,provider,provider_order_id,amount,currency_code').eq('id', invoiceId).maybeSingle();
  if (invoiceError) return NextResponse.json({ error: 'Could not verify invoice.' }, { status: 500 });
  if (!invoice || invoice.provider !== 'paymob' || String(invoice.provider_order_id) !== String(orderId)) {
    return NextResponse.json({ error: 'Paymob order does not match an EDUFLOW invoice.' }, { status: 409 });
  }
  if (Math.round(Number(invoice.amount) * 100) !== amountCents || invoice.currency_code !== currency) {
    return NextResponse.json({ error: 'Payment amount or currency mismatch.' }, { status: 409 });
  }

  if (typeof obj.success !== 'boolean' || typeof obj.pending !== 'boolean') {
    return NextResponse.json({ error: 'Paymob transaction state is incomplete.' }, { status: 400 });
  }
  const eventType = obj.success === true && obj.pending === false && obj.error_occured !== true ? 'payment.succeeded' : 'payment.failed';
  const { data, error } = await admin.rpc('process_billing_webhook', {
    p_provider: 'paymob', p_event_id: transactionId, p_event_type: eventType,
    p_payload: { invoice_id: invoice.id, transaction_id: transactionId, amount, currency, reference: String(orderId) },
  });
  if (error || (data && typeof data === 'object' && 'ok' in data && data.ok === false)) {
    console.error('Paymob billing callback processing failed', { transactionId, message: error?.message || 'RPC rejected event' });
    return NextResponse.json({ error: 'Payment callback processing failed.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, transaction_id: transactionId });
}
