'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const inputSchema = z.object({ centerId: z.string().uuid(), invoiceId: z.string().uuid() });
const PAYMOB_BASE_URL = 'https://accept.paymob.com';

function normalizeEgyptianPhone(value: string) {
  const digits = value.replace(/[^0-9+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('0020')) return `+${digits.slice(2)}`;
  if (digits.startsWith('20')) return `+${digits}`;
  if (digits.startsWith('0')) return `+20${digits.slice(1)}`;
  return `+${digits}`;
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`إعداد ${name} غير موجود في متغيرات البيئة.`);
  return value;
}

export async function createSubscriptionInvoice(formData: FormData) {
  const parsed = z.object({ centerId: z.string().uuid() }).safeParse({ centerId: formData.get('centerId') });
  if (!parsed.success) throw new Error('بيانات السنتر غير صالحة.');
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { error } = await supabase.rpc('create_subscription_invoice', { p_center_id: parsed.data.centerId });
  if (error) throw new Error(error.message);
  revalidatePath(`/app/${parsed.data.centerId}/subscription`);
}

export async function startPaymobCheckout(formData: FormData) {
  const parsed = inputSchema.safeParse({ centerId: formData.get('centerId'), invoiceId: formData.get('invoiceId') });
  if (!parsed.success) throw new Error('بيانات الفاتورة غير صالحة.');

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: member } = await supabase.from('center_members')
    .select('role,is_active').eq('center_id', parsed.data.centerId).eq('user_id', user.id).maybeSingle();
  if (!member?.is_active || !['center_owner', 'center_admin'].includes(member.role)) {
    throw new Error('بدء الدفع متاح لمالك السنتر أو مديره فقط.');
  }

  const admin = createSupabaseAdminClient();
  const [{ data: invoice, error: invoiceError }, { data: center }, { data: profile }] = await Promise.all([
    admin.from('subscription_invoices').select('id,center_id,invoice_number,amount,currency_code,status,provider,provider_order_id,checkout_expires_at').eq('id', parsed.data.invoiceId).eq('center_id', parsed.data.centerId).maybeSingle(),
    admin.from('centers').select('name,email,phone,currency_code').eq('id', parsed.data.centerId).maybeSingle(),
    admin.from('profiles').select('full_name,phone').eq('id', user.id).maybeSingle(),
  ]);
  if (invoiceError || !invoice || !center) throw new Error('الفاتورة أو بيانات السنتر غير موجودة.');
  if (invoice.status !== 'pending') throw new Error('هذه الفاتورة ليست في حالة انتظار الدفع.');
  if (invoice.provider_order_id && invoice.checkout_expires_at && new Date(invoice.checkout_expires_at).getTime() > Date.now()) throw new Error('هناك جلسة دفع نشطة لهذه الفاتورة. استخدم الصفحة المفتوحة أو انتظر انتهاء صلاحيتها.');
  if (invoice.currency_code !== 'EGP' || center.currency_code !== 'EGP') throw new Error('تكامل Paymob الحالي مضبوط على الجنيه المصري فقط.');

  const phone = center.phone || profile?.phone;
  if (!phone) throw new Error('أضف رقم هاتف السنتر أو رقم هاتفك في الملف الشخصي قبل بدء الدفع.');
  const email = center.email || user.email;
  if (!email) throw new Error('أضف بريدًا إلكترونيًا للسنتر قبل بدء الدفع.');

  const secretKey = requiredEnv('PAYMOB_SECRET_KEY');
  const publicKey = requiredEnv('PAYMOB_PUBLIC_KEY');
  const integrationIds = requiredEnv('PAYMOB_INTEGRATION_IDS').split(',').map((id) => id.trim()).filter(Boolean);
  if (!integrationIds.length || integrationIds.some((id) => !/^\d+$/.test(id))) throw new Error('PAYMOB_INTEGRATION_IDS يجب أن يحتوي على Integration ID رقمي واحد على الأقل.');

  const siteUrl = requiredEnv('NEXT_PUBLIC_SITE_URL').replace(/\/$/, '');
  const amountCents = Math.round(Number(invoice.amount) * 100);
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) throw new Error('قيمة الفاتورة غير صالحة للدفع الإلكتروني.');

  const fullName = (profile?.full_name || user.email?.split('@')[0] || 'EDUFLOW Customer').trim().split(/\s+/);
  const firstName = fullName[0] || 'EDUFLOW';
  const lastName = fullName.slice(1).join(' ') || 'Customer';
  const response = await fetch(`${PAYMOB_BASE_URL}/v1/intention/`, {
    method: 'POST',
    headers: { Authorization: `Token ${secretKey}`, 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify({
      amount: amountCents,
      currency: 'EGP',
      payment_methods: integrationIds.map(Number),
      items: [{ name: `EDUFLOW subscription ${invoice.invoice_number}`, amount: amountCents, description: `Subscription invoice ${invoice.invoice_number}`, quantity: 1 }],
      billing_data: {
        apartment: 'NA', first_name: firstName, last_name: lastName, street: 'NA', building: 'NA',
        phone_number: normalizeEgyptianPhone(phone), city: 'NA', country: 'EG', email, floor: 'NA', state: 'NA', postal_code: 'NA',
      },
      extras: { invoice_id: invoice.id, center_id: parsed.data.centerId, invoice_number: invoice.invoice_number },
      special_reference: invoice.id,
      expiration: 3600,
      notification_url: `${siteUrl}/api/billing/paymob/webhook`,
      redirection_url: `${siteUrl}/app/${parsed.data.centerId}/subscription/return?invoice_id=${invoice.id}`,
    }),
  });

  const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok || !payload || typeof payload.client_secret !== 'string') {
    console.error('Paymob intention creation failed', { status: response.status });
    throw new Error('تعذر إنشاء جلسة الدفع من Paymob. راجع مفاتيح الحساب وIntegration IDs.');
  }
  const orderId = payload.intention_order_id;
  const intentionId = payload.id;
  if (orderId === undefined || intentionId === undefined) throw new Error('استجابة Paymob لا تحتوي على بيانات مرجعية كافية.');

  const { error: updateError } = await admin.from('subscription_invoices').update({
    provider: 'paymob', provider_order_id: String(orderId), provider_intention_id: String(intentionId),
    provider_reference: invoice.id, checkout_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString(),
  }).eq('id', invoice.id).eq('status', 'pending').or(`provider_order_id.is.null,checkout_expires_at.lt.${new Date().toISOString()}`);
  if (updateError) {
    console.error('Could not persist Paymob intention', updateError);
    throw new Error('تم إنشاء جلسة الدفع لكن تعذر حفظها. لا تعاود الدفع قبل مراجعة سجل الفاتورة.');
  }
  redirect(`${PAYMOB_BASE_URL}/unifiedcheckout/?publicKey=${encodeURIComponent(publicKey)}&clientSecret=${encodeURIComponent(payload.client_secret)}`);
}
