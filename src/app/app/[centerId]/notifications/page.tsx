import { notFound, redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { markNotificationRead } from '@/app/actions/notifications';

const labels: Record<string, string> = { attendance: 'الحضور', finance: 'المالية', schedule: 'الجدول', system: 'النظام', general: 'عام' };

export default async function NotificationsPage({ params }: { params: Promise<{ centerId: string }> }) {
  const { centerId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const [{ data: center }, { data: notifications, error }] = await Promise.all([
    supabase.from('centers').select('id,name').eq('id', centerId).maybeSingle(),
    supabase.from('notifications').select('id,title,body,category,read_at,created_at').eq('center_id', centerId).eq('user_id', user.id).order('created_at', { ascending: false }).limit(100),
  ]);
  if (!center) notFound();
  if (error) throw new Error('تعذر تحميل الإشعارات.');
  const unread = (notifications ?? []).filter((n) => !n.read_at).length;
  const { data: outbox } = await supabase.from('communication_outbox').select('id,channel,event_type,status,destination,created_at,error_message').eq('center_id', centerId).eq('user_id', user.id).order('created_at', { ascending: false }).limit(30);
  return <main className="app-shell"><header className="app-header"><div><span className="brand">EDUFLOW<span>.</span></span><p className="muted">{center.name}</p></div><a href={`/app/${centerId}`} className="secondary-button link-button">لوحة السنتر</a></header><section className="app-content"><p className="eyebrow">COMMUNICATION CENTER</p><h1>مركز الإشعارات</h1><p className="muted">متابعة تنبيهات فريق السنتر ورسائل أولياء الأمور.</p><div className="stats-grid"><article className="stat-card"><span>إجمالي الإشعارات</span><strong>{notifications?.length ?? 0}</strong></article><article className="stat-card"><span>غير المقروءة</span><strong>{unread}</strong></article><article className="stat-card"><span>رسائل بانتظار الإرسال</span><strong>{outbox?.filter((x) => x.status === 'queued').length ?? 0}</strong></article></div><div className="notice-card"><h2>إشعارات فريق السنتر</h2>{!notifications?.length ? <p className="muted">لا توجد إشعارات حتى الآن.</p> : <div className="communication-list">{notifications.map((item) => <article className="communication-row" key={item.id}><div><strong>{item.title}</strong><p>{item.body}</p><small className="muted">{labels[item.category] ?? 'عام'} · {new Date(item.created_at).toLocaleString('ar-EG')}</small></div><div>{item.read_at ? <span className="muted">تمت القراءة</span> : <form action={markNotificationRead}><input type="hidden" name="centerId" value={centerId}/><input type="hidden" name="notificationId" value={item.id}/><button className="secondary-button" type="submit">تحديد كمقروء</button></form>}</div></article>)}</div>}</div><div className="notice-card"><h2>سجل رسائل أولياء الأمور</h2><p className="muted">الرسائل تُنشأ تلقائياً عند تسجيل الغياب أو التأخير. الإرسال الخارجي يحتاج ربط مزود واتساب أو SMS.</p>{!outbox?.length ? <p className="muted">لا توجد رسائل في قائمة الإرسال.</p> : <div className="communication-list">{outbox.map((item) => <article className="communication-row" key={item.id}><div><strong>{item.event_type === 'student_absent' ? 'إشعار غياب' : item.event_type === 'student_late' ? 'إشعار تأخير' : 'تذكير مالي'}</strong><p>{item.channel.toUpperCase()} · {item.destination}</p><small className="muted">{new Date(item.created_at).toLocaleString('ar-EG')}</small>{item.error_message && <p className="muted">{item.error_message}</p>}</div><span className="communication-status">{item.status === 'queued' ? 'في قائمة الانتظار' : item.status === 'sent' ? 'تم الإرسال' : item.status === 'failed' ? 'فشل الإرسال' : item.status}</span></article>)}</div>}</div></section></main>;
}
