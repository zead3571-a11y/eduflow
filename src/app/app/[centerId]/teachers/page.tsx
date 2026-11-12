import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createTeacher } from '@/app/actions/people';

export default async function TeachersPage({ params, searchParams }: { params: Promise<{ centerId: string }>; searchParams: Promise<{ q?: string; created?: string }> }) {
  const { centerId } = await params;
  const { q = '', created } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: center } = await supabase.from('centers').select('id,name').eq('id', centerId).maybeSingle();
  if (!center) notFound();
  let query = supabase.from('teachers').select('id,full_name,phone,email,specialty,is_active').eq('center_id', centerId).order('created_at', { ascending: false }).limit(100);
  if (q.trim()) query = query.ilike('full_name', `%${q.trim()}%`);
  const { data: teachers, error } = await query;
  return <main className="app-shell"><header className="app-header"><div><span className="brand">EDUFLOW<span>.</span></span><p className="muted">{center.name}</p></div><Link href={`/app/${centerId}`} className="secondary-button link-button">لوحة السنتر</Link></header><section className="app-content"><p className="eyebrow">PEOPLE MANAGEMENT</p><h1>إدارة المدرسين</h1><p className="muted">إضافة المدرسين وتسجيل التخصصات وبيانات التواصل.</p>{created && <div className="notice-card">تمت إضافة المدرس بنجاح.</div>}{error && <div className="notice-card">تعذر تحميل المدرسين: {error.message}</div>}<div className="people-layout"><section className="panel"><h2>إضافة مدرس</h2><form action={createTeacher} className="stack-form"><input type="hidden" name="centerId" value={centerId}/><label>اسم المدرس<input name="fullName" required minLength={2}/></label><label>التخصص<input name="specialty" placeholder="رياضيات، لغة عربية..."/></label><label>رقم الهاتف<input name="phone"/></label><label>البريد الإلكتروني<input name="email" type="email"/></label><button className="primary-button" type="submit">حفظ المدرس</button></form></section><section className="panel"><div className="panel-heading"><h2>قائمة المدرسين</h2><span className="muted">{teachers?.length ?? 0} نتيجة</span></div><form className="search-form"><input name="q" defaultValue={q} placeholder="ابحث باسم المدرس"/><button className="secondary-button" type="submit">بحث</button></form><div className="table-wrap"><table><thead><tr><th>الاسم</th><th>التخصص</th><th>الهاتف</th><th>الحالة</th></tr></thead><tbody>{teachers?.map(t=><tr key={t.id}><td>{t.full_name}</td><td>{t.specialty || '—'}</td><td>{t.phone || '—'}</td><td>{t.is_active ? 'نشط' : 'غير نشط'}</td></tr>)}</tbody></table>{!teachers?.length && <p className="empty-state">لا يوجد مدرسون حتى الآن.</p>}</div></section></div></section></main>;
}
