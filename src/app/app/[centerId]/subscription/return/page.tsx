import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function SubscriptionPaymentReturn({ params, searchParams }: {
  params: Promise<{ centerId: string }>;
  searchParams: Promise<{ invoice_id?: string }>;
}) {
  const { centerId } = await params;
  const { invoice_id: invoiceId } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: member } = await supabase.from('center_members').select('is_active')
    .eq('center_id', centerId).eq('user_id', user.id).maybeSingle();
  if (!member?.is_active) redirect('/app');

  let invoiceStatus = 'pending';
  if (invoiceId) {
    const { data: invoice } = await supabase.from('subscription_invoices').select('status')
      .eq('id', invoiceId).eq('center_id', centerId).maybeSingle();
    invoiceStatus = invoice?.status || 'pending';
  }
  const paid = invoiceStatus === 'paid';
  return <main className="app-shell"><section className="app-content"><div className="panel platform-section">
    <p className="eyebrow">PAYMOB CHECKOUT</p>
    <h1>{paid ? 'تم تأكيد الدفع' : 'جاري تأكيد عملية الدفع'}</h1>
    <p className="muted">{paid ? 'تم استلام تأكيد الدفع من Paymob وتحديث اشتراك السنتر.' : 'رجوعك من صفحة الدفع لا يؤكد نجاح العملية وحده. ننتظر إشعار Paymob الآمن لتحديث حالة الفاتورة.'}</p>
    <p>حالة الفاتورة الحالية: <strong>{invoiceStatus === 'paid' ? 'مدفوعة' : invoiceStatus === 'failed' ? 'فشل الدفع' : invoiceStatus}</strong></p>
    <div className="header-links"><Link href={`/app/${centerId}/subscription`}>العودة إلى صفحة الاشتراك</Link></div>
  </div></section></main>;
}
