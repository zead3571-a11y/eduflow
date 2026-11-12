'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
const schema=z.object({centerId:z.string().uuid(),groupId:z.string().uuid(),title:z.string().trim().min(2).max(160),assessmentDate:z.string().date(),maxScore:z.coerce.number().positive().max(100000),results:z.array(z.object({student_id:z.string().uuid(),score:z.number().min(0),feedback:z.string().max(500).optional()})).min(1)});
export async function recordAssessment(formData:FormData){
 const raw=String(formData.get('results')??'[]'); let results:unknown; try{results=JSON.parse(raw)}catch{throw new Error('بيانات الدرجات غير صالحة.');}
 const parsed=schema.safeParse({centerId:formData.get('centerId'),groupId:formData.get('groupId'),title:formData.get('title'),assessmentDate:formData.get('assessmentDate'),maxScore:formData.get('maxScore'),results});
 if(!parsed.success) throw new Error('راجع بيانات التقييم والدرجات.');
 const supabase=await createSupabaseServerClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user) redirect('/login');
 const {error}=await supabase.rpc('record_group_assessment',{p_center_id:parsed.data.centerId,p_group_id:parsed.data.groupId,p_title:parsed.data.title,p_assessment_date:parsed.data.assessmentDate,p_max_score:parsed.data.maxScore,p_results:parsed.data.results});
 if(error) throw new Error(error.message); revalidatePath(`/app/${parsed.data.centerId}/assessments`); revalidatePath(`/parent/${parsed.data.centerId}`); redirect(`/app/${parsed.data.centerId}/assessments?saved=1`);
}
