'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const groupSchema = z.object({ centerId: z.string().uuid(), name: z.string().trim().min(2).max(120), subjectId: z.string().uuid().optional().or(z.literal('')), teacherId: z.string().uuid().optional().or(z.literal('')), gradeLabel: z.string().trim().max(80).optional(), monthlyFee: z.coerce.number().min(0).max(1000000), capacity: z.preprocess((v: unknown) => v === '' || v == null ? null : Number(v), z.number().int().positive().max(10000).nullable()), roomLabel: z.string().trim().max(80).optional() });
const subjectSchema = z.object({ centerId: z.string().uuid(), name: z.string().trim().min(2).max(100) });
const enrollSchema = z.object({ centerId: z.string().uuid(), groupId: z.string().uuid(), studentId: z.string().uuid() });
const sessionSchema = z.object({ centerId: z.string().uuid(), groupId: z.string().uuid(), sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), roomLabel: z.string().trim().max(80).optional(), notes: z.string().trim().max(500).optional() });
const weeklySchema = z.object({ centerId: z.string().uuid(), groupId: z.string().uuid(), weekday: z.coerce.number().int().min(0).max(6), firstDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), weeks: z.coerce.number().int().min(1).max(52), roomLabel: z.string().trim().max(80).optional(), notes: z.string().trim().max(500).optional() });

async function requireManager() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return supabase;
}

export async function createSubject(formData: FormData) {
  const parsed = subjectSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error('اسم المادة غير صحيح.');
  const v = parsed.data; const supabase = await requireManager();
  const { error } = await supabase.from('subjects').insert({ center_id: v.centerId, name: v.name });
  if (error) throw new Error(error.message);
  revalidatePath(`/app/${v.centerId}/groups`); redirect(`/app/${v.centerId}/groups?subjectCreated=1`);
}

export async function createGroup(formData: FormData) {
  const parsed = groupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error('راجع بيانات المجموعة.');
  const v = parsed.data; const supabase = await requireManager();
  const { error } = await supabase.from('groups').insert({ center_id: v.centerId, name: v.name, subject_id: v.subjectId || null, teacher_id: v.teacherId || null, grade_label: v.gradeLabel || null, monthly_fee: v.monthlyFee, capacity: v.capacity, room_label: v.roomLabel || null });
  if (error) throw new Error(error.message);
  revalidatePath(`/app/${v.centerId}/groups`); redirect(`/app/${v.centerId}/groups?created=1`);
}

export async function enrollStudent(formData: FormData) {
  const parsed = enrollSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error('بيانات التسجيل غير صحيحة.');
  const v = parsed.data; const supabase = await requireManager();
  const { error } = await supabase.from('group_students').upsert({ center_id: v.centerId, group_id: v.groupId, student_id: v.studentId, is_active: true }, { onConflict: 'group_id,student_id' });
  if (error) throw new Error(error.message);
  revalidatePath(`/app/${v.centerId}/groups`); redirect(`/app/${v.centerId}/groups?enrolled=1`);
}

export async function createGroupSession(formData: FormData) {
  const parsed = sessionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error('راجع تاريخ ووقت الحصة.');
  const v = parsed.data; const supabase = await requireManager();
  const { error } = await supabase.rpc('create_group_session', { p_center_id: v.centerId, p_group_id: v.groupId, p_session_date: v.sessionDate, p_start_time: v.startTime, p_end_time: v.endTime, p_room_label: v.roomLabel || null, p_notes: v.notes || null });
  if (error) throw new Error(error.message);
  revalidatePath(`/app/${v.centerId}/groups`); revalidatePath(`/app/${v.centerId}/schedule`);
  redirect(`/app/${v.centerId}/schedule?created=1`);
}

export async function createWeeklyGroupSessions(formData: FormData) {
  const parsed = weeklySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error('راجع بيانات التكرار الأسبوعي.');
  const v = parsed.data; const supabase = await requireManager();
  const { error } = await supabase.rpc('create_weekly_group_sessions', { p_center_id: v.centerId, p_group_id: v.groupId, p_weekday: v.weekday, p_first_date: v.firstDate, p_start_time: v.startTime, p_end_time: v.endTime, p_weeks: v.weeks, p_room_label: v.roomLabel || null, p_notes: v.notes || null });
  if (error) throw new Error(error.message);
  revalidatePath(`/app/${v.centerId}/schedule`); redirect(`/app/${v.centerId}/schedule?weeklyCreated=1`);
}
