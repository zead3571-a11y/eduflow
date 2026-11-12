import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createStudent } from '@/app/actions/people';

export default async function StudentsPage({ params, searchParams }: { params: Promise<{ centerId: string }>; searchParams: Promise<{ q?: string; created?: string }> }) {
  const { centerId } = await params;
  const { q = '', created } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: center } = await supabase.from('centers').select('id,name').eq('id', centerId).maybeSingle();
  if (!center) notFound();
  let query = supabase.from('students').select('id,student_code,full_name,phone,email,is_active,created_at').eq('center_id', centerId).order('created_at', { ascending: false }).limit(100);
  if (q.trim()) query = query.ilike('full_name', `%${q.trim()}%`);
  const { data: students, error } = await query;
  return <main className="app-shell"><header className="app-header"><div><span className="brand">EDUFLOW<span>.</span></span><p className="muted">{center.name}</p></div><Link href={`/app/${centerId}`} className="secondary-button link-button">لوحة السنتر</Link></header><section className="app-content"><p className="eyebrow">PEOPLE MANAGEMENT</p><h1>إدارة الطلاب</h1><p className="muted">إضافة الطلاب ومراجعة بياناتهم ووسائل التواصل.</p>{created && <div className="notice-card">تمت إضافة الطالب بنجاح.</div>}{error && <div className="notice-card">تعذر تحميل الطلاب: {error.message}</div>}<div className="people-layout"><section className="panel"><h2>إضافة طالب جديد</h2><form action={createStudent} className="stack-form"><input type="hidden" name="centerId" value={centerId}/><label>اسم الطالب<input name="fullName" required minLength={2} placeholder="مثال: أحمد محمد"/></label><label>كود الطالب<input name="studentCode" placeholder="اختياري"/></label><label>رقم الهاتف<input name="phone" placeholder="01xxxxxxxxx"/></label><label>البريد الإلكتروني<input name="email" type="email" placeholder="name@example.com"/></label><hr/><h3>بيانات ولي الأمر (اختياري)</h3><label>اسم ولي الأمر<input name="guardianName" placeholder="اسم ولي الأمر"/></label><label>رقم ولي الأمر<input name="guardianPhone" placeholder="01xxxxxxxxx"/></label><button className="primary-button" type="submit">حفظ الطالب</button></form></section><section className="panel"><div className="panel-heading"><h2>قائمة الطلاب</h2><span className="muted">{students?.length ?? 0} نتيجة</span></div><form className="search-form"><input name="q" defaultValue={q} placeholder="ابحث باسم الطالب"/><button className="secondary-button" type="submit">بحث</button></form><div className="table-wrap"><table><thead><tr><th>الاسم</th><th>الكود</th><th>الهاتف</th><th>الحالة</th></tr></thead><tbody>{students?.map(s=><tr key={s.id}><td>{s.full_name}</td><td>{s.student_code || '—'}</td><td>{s.phone || '—'}</td><td><span className={s.is_active ? 'status-active' : 'status-inactive'}>{s.is_active ? 'نشط' : 'غير نشط'}</span></td></tr>)}</tbody></table>{!students?.length && <p className="empty-state">لا يوجد طلاب مطابقون للبحث.</p>}</div></section></div></section></main>;
}
