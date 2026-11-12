'use client';
import { useState } from 'react';
import { recordAssessment } from '@/app/actions/assessments';
type Student={id:string;full_name:string};
export function AssessmentForm({centerId,groups,students,enrollments}:{centerId:string;groups:{id:string;name:string}[];students:Student[];enrollments:{group_id:string;student_id:string}[]}){
 const [groupId,setGroupId]=useState(groups[0]?.id??'');
 const [scores,setScores]=useState<Record<string,string>>({});
 const [feedback,setFeedback]=useState<Record<string,string>>({});
 const [maxScore,setMaxScore]=useState('100');
 const [selected,setSelected]=useState<string[]>(enrollments.filter(e=>e.group_id===groups[0]?.id).map(e=>e.student_id));
 const groupStudentIds=enrollments.filter(e=>e.group_id===groupId).map(e=>e.student_id);
 const visible=students.filter(s=>groupStudentIds.includes(s.id)&&selected.includes(s.id));
 const results=visible.filter(s=>scores[s.id]!==undefined&&scores[s.id]!=='').map(s=>({student_id:s.id,score:Number(scores[s.id]),feedback:feedback[s.id]??''}));
 return <form action={recordAssessment} className="stack-form">
  <input type="hidden" name="centerId" value={centerId}/><input type="hidden" name="results" value={JSON.stringify(results)}/>
  <label>المجموعة<select name="groupId" value={groupId} onChange={e=>{setGroupId(e.target.value);setSelected(enrollments.filter(x=>x.group_id===e.target.value).map(x=>x.student_id));}} required>{groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
  <label>اسم التقييم<input name="title" placeholder="اختبار الوحدة الأولى" required minLength={2}/></label>
  <label>تاريخ التقييم<input name="assessmentDate" type="date" defaultValue={new Date().toISOString().slice(0,10)} required/></label>
  <label>الدرجة النهائية<input name="maxScore" type="number" min="1" step="0.5" value={maxScore} onChange={e=>setMaxScore(e.target.value)} required/></label>
  <hr/><h3>درجات الطلاب</h3>
  {students.filter(s=>groupStudentIds.includes(s.id)).map(s=><div className="score-row" key={s.id}><label className="score-student"><input type="checkbox" checked={selected.includes(s.id)} onChange={e=>setSelected(old=>e.target.checked?[...old,s.id]:old.filter(id=>id!==s.id))}/>{s.full_name}</label><input aria-label={`درجة ${s.full_name}`} type="number" min="0" max={maxScore} step="0.5" placeholder="الدرجة" value={scores[s.id]??''} onChange={e=>setScores(old=>({...old,[s.id]:e.target.value}))}/><input aria-label={`ملاحظة ${s.full_name}`} placeholder="ملاحظة اختيارية" value={feedback[s.id]??''} onChange={e=>setFeedback(old=>({...old,[s.id]:e.target.value}))}/></div>)}
  <p className="muted">سيتم حفظ الطلاب الذين أدخلت لهم درجة فقط. يجب أن تكون الدرجة ضمن الدرجة النهائية.</p>
  <button className="primary-button" disabled={!groupId||!results.length}>حفظ التقييم والدرجات ({results.length})</button>
 </form>;
}
