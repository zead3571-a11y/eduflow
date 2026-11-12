import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function StudentProgressPage({params}:{params:Promise<{centerId:string}>}) {
  const {centerId}=await params; const supabase=await createSupabaseServerClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user) redirect('/login');
  const {data:center}=await supabase.from('centers').select('id,name').eq('id',centerId).maybeSingle(); if(!center) notFound();
  const {data:students,error}=await supabase.from('students').select('id,full_name,student_code,is_active').eq('center_id',centerId).eq('is_active',true).order('full_name').limit(500);
  const ids=(students??[]).map(s=>s.id);
  const {data:records}=ids.length?await supabase.from('attendance').select('student_id,status').eq('center_id',centerId).in('student_id',ids):{data:[] as {student_id:string;status:string}[]};
  const stats=new Map<string,{present:number;absent:number;late:number;excused:number;total:number}>();
  for(const r of records??[]){const t=stats.get(r.student_id)??{present:0,absent:0,late:0,excused:0,total:0};if(r.status in t){t[r.status as keyof typeof t]++;t.total++;}stats.set(r.student_id,t);}
  return <main className="app-shell"><header className="app-header"><div><span className="brand">EDUFLOW<span>.</span></span><p className="muted">{center.name}</p></div><nav className="header-links"><Link href={`/app/${centerId}`}>لوحة السنتر</Link><Link href={`/app/${centerId}/attendance`}>الحضور</Link><Link href={`/app/${centerId}/students`}>الطلاب</Link></nav></header><section className="app-content"><p className="eyebrow">STUDENT PROGRESS</p><h1>متابعة مستوى الحضور</h1><p className="muted">ملخص تراكمي لحالات الحضور المسجلة لكل طالب.</p>{error&&<p className="form-error">تعذر تحميل الطلاب: {error.message}</p>}<section className="panel" style={{marginTop:24}}><div className="panel-heading"><h2>ملخص الطلاب</h2><span className="muted">{students?.length??0} طالب</span></div><div className="table-wrap"><table><thead><tr><th>الطالب</th><th>إجمالي التسجيلات</th><th>حاضر</th><th>غائب</th><th>متأخر</th><th>بعذر</th><th>نسبة الحضور</th></tr></thead><tbody>{(students??[]).map(s=>{const t=stats.get(s.id)??{present:0,absent:0,late:0,excused:0,total:0};const rate=t.total?Math.round((t.present+t.late+t.excused)/t.total*100):0;return <tr key={s.id}><td>{s.full_name}{s.student_code?` · ${s.student_code}`:''}</td><td>{t.total}</td><td>{t.present}</td><td>{t.absent}</td><td>{t.late}</td><td>{t.excused}</td><td><strong>{t.total?`${rate}%`:'—'}</strong></td></tr>})}</tbody></table>{!students?.length&&<p className="empty-state">لا يوجد طلاب نشطون.</p>}</div></section></section></main>;
}
