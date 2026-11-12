import Link from 'next/link';
import { notFound,redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { AssessmentForm } from './assessment-form';
export default async function AssessmentsPage({params,searchParams}:{params:Promise<{centerId:string}>;searchParams:Promise<{saved?:string}>}){
 const {centerId}=await params;const {saved}=await searchParams;const supabase=await createSupabaseServerClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');
 const {data:center}=await supabase.from('centers').select('id,name').eq('id',centerId).maybeSingle();if(!center)notFound();
 const [{data:groups},{data:students},{data:assessments},{data:enrollments}]=await Promise.all([
  supabase.from('groups').select('id,name').eq('center_id',centerId).eq('is_active',true).order('name'),
  supabase.from('students').select('id,full_name').eq('center_id',centerId).eq('is_active',true).order('full_name'),
  supabase.from('assessments').select('id,title,assessment_date,max_score,groups(name),student_assessments(score)').eq('center_id',centerId).order('assessment_date',{ascending:false}).limit(30),
  supabase.from('group_students').select('group_id,student_id').eq('center_id',centerId).eq('is_active',true)
 ]);
 return <main className="app-shell"><header className="app-header"><div><span className="brand">EDUFLOW<span>.</span></span><p className="muted">{center.name}</p></div><nav className="header-links"><Link href={`/app/${centerId}`}>لوحة السنتر</Link><Link href={`/app/${centerId}/students`}>الطلاب</Link><Link href={`/app/${centerId}/parents`}>أولياء الأمور</Link></nav></header><section className="app-content"><p className="eyebrow">ASSESSMENTS</p><h1>التقييمات والدرجات</h1><p className="muted">سجّل تقييم المجموعة ودرجات الطلاب؛ ستظهر النتائج لولي الأمر المرتبط بالطالب فقط.</p>{saved&&<p className="form-success">تم حفظ التقييم والدرجات بنجاح.</p>}<div className="people-layout"><section className="panel"><h2>إضافة تقييم</h2>{groups?.length&&students?.length?<AssessmentForm centerId={centerId} groups={groups} students={students} enrollments={enrollments??[]}/>:<p className="empty-state">أضف مجموعة وطلاباً أولاً لتسجيل التقييمات.</p>}</section><section className="panel"><h2>التقييمات الأخيرة</h2><div className="table-wrap"><table><thead><tr><th>التقييم</th><th>المجموعة</th><th>التاريخ</th><th>عدد الدرجات</th></tr></thead><tbody>{(assessments??[]).map(a=>{const g=Array.isArray(a.groups)?a.groups[0]:a.groups;return <tr key={a.id}><td>{a.title}</td><td>{g?.name??'—'}</td><td>{a.assessment_date}</td><td>{a.student_assessments?.length??0}</td></tr>})}</tbody></table>{!assessments?.length&&<p className="empty-state">لا توجد تقييمات بعد.</p>}</div></section></div></section></main>;
}
