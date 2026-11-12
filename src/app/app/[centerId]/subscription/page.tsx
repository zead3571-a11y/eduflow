import { notFound, redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSubscriptionInvoice, startPaymobCheckout } from './actions';

type Invoice = { id:string; invoice_number:string; amount:number; currency_code:string; billing_interval:string; period_start:string; period_end:string; status:string; due_at:string; paid_at:string|null; created_at:string; provider:string|null; provider_order_id:string|null; checkout_expires_at:string|null };
const money=(n:number,c:string)=>new Intl.NumberFormat('ar-EG',{style:'currency',currency:c,maximumFractionDigits:2}).format(Number(n||0));
const status:Record<string,string>={pending:'بانتظار الدفع',paid:'مدفوعة',failed:'فشل الدفع',void:'ملغاة',refunded:'مستردة'};

export default async function SubscriptionPage({params}:{params:Promise<{centerId:string}>}) {
 const {centerId}=await params; const supabase=await createSupabaseServerClient();
 const {data:{user}}=await supabase.auth.getUser(); if(!user) redirect('/login');
 const {data:member}=await supabase.from('center_members').select('role,is_active').eq('center_id',centerId).eq('user_id',user.id).maybeSingle();
 if(!member?.is_active || !['center_owner','center_admin','accountant'].includes(member.role)) notFound();
 const [{data:sub,error:subError},{data:invoices,error:invoiceError},{data:payments,error:paymentError}]=await Promise.all([
  supabase.from('subscriptions').select('id,status,billing_interval,trial_ends_at,current_period_end,plans(name_ar,name_en,monthly_price,yearly_price)').eq('center_id',centerId).maybeSingle(),
  supabase.from('subscription_invoices').select('id,invoice_number,amount,currency_code,billing_interval,period_start,period_end,status,due_at,paid_at,created_at,provider,provider_order_id,checkout_expires_at').eq('center_id',centerId).order('created_at',{ascending:false}).limit(50),
  supabase.from('billing_payments').select('id,provider,provider_transaction_id,amount,currency_code,status,created_at').eq('center_id',centerId).order('created_at',{ascending:false}).limit(50),
 ]);
 if(subError||invoiceError||paymentError) throw new Error('تعذر تحميل بيانات الاشتراك والفوترة.');
 if(!sub) notFound();
 const plan=Array.isArray(sub.plans)?sub.plans[0]:sub.plans;
 return <main className="app-shell"><header className="app-header"><div><a className="brand" href={`/app/${centerId}`}>EDUFLOW<span>.</span></a><p className="muted">الاشتراك والفوترة</p></div><div className="header-links"><a href={`/app/${centerId}`}>العودة للوحة السنتر</a></div></header>
 <section className="app-content"><p className="eyebrow">SUBSCRIPTION & BILLING</p><h1>اشتراك السنتر</h1>
 <section className="panel platform-section"><h2>الباقة الحالية</h2><div className="stats-grid"><article className="stat-card"><span>الباقة</span><strong>{plan?.name_ar||plan?.name_en||'—'}</strong></article><article className="stat-card"><span>الحالة</span><strong>{sub.status}</strong></article><article className="stat-card"><span>الدورة</span><strong>{sub.billing_interval==='yearly'?'سنوي':'شهري'}</strong></article><article className="stat-card"><span>نهاية الفترة</span><strong className="stat-small">{new Date(sub.current_period_end||sub.trial_ends_at||Date.now()).toLocaleDateString('ar-EG')}</strong></article></div>
 <p className="muted">الأسعار المعروضة حسب الباقة: شهري {money(Number(plan?.monthly_price||0),'EGP')} · سنوي {money(Number(plan?.yearly_price||0),'EGP')}.</p>
 {['center_owner','center_admin'].includes(member.role) && <form action={createSubscriptionInvoice}><input type="hidden" name="centerId" value={centerId}/><button className="primary-button" type="submit">إنشاء فاتورة تجديد</button></form>}
 <p className="muted small-note">يتم تأكيد الدفع من إشعار Paymob الآمن، وليس من صفحة الرجوع وحدها. تأكد من إعداد مفاتيح Paymob على الخادم.</p></section>
 <section className="panel platform-section"><h2>فواتير الاشتراك</h2><div className="table-wrap"><table><thead><tr><th>رقم الفاتورة</th><th>القيمة</th><th>الفترة</th><th>الاستحقاق</th><th>الحالة</th><th>الإجراء</th></tr></thead><tbody>{(invoices as Invoice[]||[]).map(i=><tr key={i.id}><td dir="ltr">{i.invoice_number}</td><td>{money(i.amount,i.currency_code)}</td><td>{new Date(i.period_start).toLocaleDateString('ar-EG')} – {new Date(i.period_end).toLocaleDateString('ar-EG')}</td><td>{new Date(i.due_at).toLocaleDateString('ar-EG')}</td><td>{status[i.status]||i.status}</td><td>{i.status==='pending' && (!i.provider_order_id || !i.checkout_expires_at || new Date(i.checkout_expires_at).getTime() <= Date.now()) && ['center_owner','center_admin'].includes(member.role) ? <form action={startPaymobCheckout}><input type="hidden" name="centerId" value={centerId}/><input type="hidden" name="invoiceId" value={i.id}/><button className="primary-button" type="submit">ادفع عبر Paymob</button></form> : i.provider_order_id ? 'تم إنشاء محاولة الدفع' : '—'}</td></tr>)}</tbody></table>{!invoices?.length&&<p className="empty-state">لا توجد فواتير اشتراك حتى الآن.</p>}</div></section>
 <section className="panel platform-section"><h2>سجل المدفوعات</h2><div className="table-wrap"><table><thead><tr><th>التاريخ</th><th>مزود الدفع</th><th>رقم العملية</th><th>المبلغ</th><th>الحالة</th></tr></thead><tbody>{(payments||[]).map((p:any)=><tr key={p.id}><td>{new Date(p.created_at).toLocaleString('ar-EG')}</td><td>{p.provider}</td><td dir="ltr">{p.provider_transaction_id}</td><td>{money(p.amount,p.currency_code)}</td><td>{p.status}</td></tr>)}</tbody></table>{!payments?.length&&<p className="empty-state">لا توجد مدفوعات مسجلة.</p>}</div></section>
 </section></main>;
}
