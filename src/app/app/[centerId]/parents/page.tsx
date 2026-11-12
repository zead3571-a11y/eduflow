import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ParentInviteForm } from './invite-form';
export default async function ParentAccountsPage({params}:{params:Promise<{centerId:string}>}) {
 const {centerId}=await params; const supabase=await createSupabaseServerClient();
 const {data:{user}}=await supabase.auth.getUser(); if(!user) redirect('/login');
 const {data:center}=await supabase.from('centers').select('id,name').eq('id',centerId).maybeSingle(); if(!center) notFound();
 const {data:guardians,error}=await supabase.from('guardians').select('id,full_name,email,user_id').eq('center_id',centerId).order('full_name');
 return <main className="app-shell"><header className="app-header"><div><span className="brand">EDUFLOW<span>.</span></span><p className="muted">{center.name}</p></div><nav className="header-links"><Link href={`/app/${centerId}`}>لوحة السنتر</Link><Link href={`/app/${centerId}/students`}>الطلاب</Link><Link href={`/app/${centerId}/notifications`}>الإشعارات</Link></nav></header>
 <section className="app-content"><p className="eyebrow">PARENT ACCOUNTS</p><h1>حسابات أولياء الأمور</h1><p className="muted">أنشئ دعوة آمنة لربط حساب ولي الأمر بالطلاب المسجلين لديه. الدعوة صالحة 7 أيام وتتطلب تطابق البريد الإلكتروني.</p>
 <div className="people-layout"><section className="panel"><h2>دعوة ولي أمر</h2><ParentInviteForm centerId={centerId} guardians={guardians??[]}/></section><section className="panel"><h2>أولياء الأمور ({guardians?.length??0})</h2>{error&&<p className="form-error">تعذر تحميل البيانات: {error.message}</p>}<div className="table-wrap"><table><thead><tr><th>الاسم</th><th>البريد</th><th>حالة الحساب</th></tr></thead><tbody>{(guardians??[]).map(g=><tr key={g.id}><td>{g.full_name}</td><td>{g.email??'—'}</td><td><span className={g.user_id?'status-active':'status-inactive'}>{g.user_id?'مرتبط':'غير مرتبط'}</span></td></tr>)}</tbody></table></div></section></div></section></main>;
}
