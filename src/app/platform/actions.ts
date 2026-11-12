'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';

async function adminClient() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=%2Fplatform');
  const { data, error } = await supabase.rpc('is_platform_admin');
  if (error || data !== true) redirect('/app');
  return supabase;
}

export async function updatePlan(formData: FormData) {
  const parsed = z.object({ planId:z.string().uuid(), nameAr:z.string().min(2), nameEn:z.string().min(2), monthly:z.coerce.number().min(0), yearly:z.coerce.number().min(0), trial:z.coerce.number().int().min(0).max(90), students:z.coerce.number().int().min(1), staff:z.coerce.number().int().min(1), active:z.enum(['true','false']) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error('بيانات الباقة غير صالحة');
  const s = await adminClient(); const v=parsed.data;
  const {error}=await s.rpc('platform_update_plan',{p_plan_id:v.planId,p_name_ar:v.nameAr,p_name_en:v.nameEn,p_monthly_price:v.monthly,p_yearly_price:v.yearly,p_trial_days:v.trial,p_max_students:v.students,p_max_staff:v.staff,p_is_active:v.active==='true'});
  if(error) throw new Error(error.message); revalidatePath('/platform');
}

export async function updateSubscription(formData: FormData) {
  const parsed=z.object({centerId:z.string().uuid(),status:z.enum(['trialing','active','past_due','canceled','expired']),days:z.coerce.number().int().min(0).max(730),planId:z.string().optional()}).safeParse(Object.fromEntries(formData));
  if(!parsed.success) throw new Error('بيانات الاشتراك غير صالحة'); const s=await adminClient(); const v=parsed.data;
  const {error}=await s.rpc('platform_update_subscription',{p_center_id:v.centerId,p_status:v.status,p_extend_days:v.days,p_plan_id:v.planId||null});
  if(error) throw new Error(error.message); revalidatePath('/platform');
}

export async function updateCenterAccess(formData:FormData){
 const parsed=z.object({centerId:z.string().uuid(),active:z.enum(['true','false'])}).safeParse(Object.fromEntries(formData)); if(!parsed.success) throw new Error('بيانات السنتر غير صالحة');
 const s=await adminClient(); const {error}=await s.rpc('platform_set_center_access',{p_center_id:parsed.data.centerId,p_is_active:parsed.data.active==='true'}); if(error) throw new Error(error.message); revalidatePath('/platform');
}

export async function updatePlatformSettings(formData:FormData){
 const parsed=z.object({trial:z.coerce.number().int().min(0).max(90),locale:z.enum(['ar','en']),maintenance:z.enum(['true','false'])}).safeParse(Object.fromEntries(formData)); if(!parsed.success) throw new Error('الإعدادات غير صالحة');
 const s=await adminClient(); const v=parsed.data; const {error}=await s.rpc('platform_update_settings',{p_default_trial_days:v.trial,p_default_locale:v.locale,p_maintenance_mode:v.maintenance==='true'}); if(error) throw new Error(error.message); revalidatePath('/platform');
}

export async function togglePlatformAdmin(formData:FormData){
 const parsed=z.object({userId:z.string().uuid(),makeAdmin:z.enum(['true','false'])}).safeParse(Object.fromEntries(formData)); if(!parsed.success) throw new Error('بيانات المستخدم غير صالحة');
 const s=await adminClient(); const {error}=await s.rpc('platform_set_admin',{p_user_id:parsed.data.userId,p_make_admin:parsed.data.makeAdmin==='true'}); if(error) throw new Error(error.message); revalidatePath('/platform');
}

export async function createPlan(formData:FormData){
 const parsed=z.object({code:z.string().regex(/^[a-z0-9][a-z0-9_-]{1,38}$/),nameAr:z.string().min(2),nameEn:z.string().min(2),monthly:z.coerce.number().min(0),yearly:z.coerce.number().min(0),trial:z.coerce.number().int().min(0).max(90),students:z.coerce.number().int().min(1),staff:z.coerce.number().int().min(1)}).safeParse(Object.fromEntries(formData));
 if(!parsed.success) throw new Error('بيانات الباقة الجديدة غير صالحة'); const s=await adminClient(); const v=parsed.data;
 const {error}=await s.rpc('platform_create_plan',{p_code:v.code,p_name_ar:v.nameAr,p_name_en:v.nameEn,p_monthly_price:v.monthly,p_yearly_price:v.yearly,p_trial_days:v.trial,p_max_students:v.students,p_max_staff:v.staff});
 if(error) throw new Error(error.message); revalidatePath('/platform');
}
