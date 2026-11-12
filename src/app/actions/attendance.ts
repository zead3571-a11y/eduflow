'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const schema = z.object({
  centerId: z.string().uuid(),
  sessionId: z.string().uuid(),
  entries: z.array(z.object({ student_id: z.string().uuid(), status: z.enum(['present','absent','late','excused']), notes: z.string().max(300).optional() })).min(1).max(500),
});

export async function saveAttendance(formData: FormData) {
  const rawIds = formData.get('studentIds');
  let ids: unknown;
  try { ids = JSON.parse(String(rawIds ?? '[]')); } catch { throw new Error('قائمة الطلاب غير صالحة.'); }
  if (!Array.isArray(ids)) throw new Error('قائمة الطلاب غير صالحة.');
  const entries = ids.map((id) => ({ student_id: String(id), status: String(formData.get(`status_${id}`) ?? 'present'), notes: String(formData.get(`notes_${id}`) ?? '') }));
  const parsed = schema.safeParse({ centerId: formData.get('centerId'), sessionId: formData.get('sessionId'), entries });
  if (!parsed.success) throw new Error('راجع بيانات الحضور وحاول مرة أخرى.');
  const v = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { error } = await supabase.rpc('save_session_attendance', { p_center_id: v.centerId, p_session_id: v.sessionId, p_entries: v.entries });
  if (error) throw new Error(error.message);
  revalidatePath(`/app/${v.centerId}/attendance`);
  revalidatePath(`/app/${v.centerId}/attendance/${v.sessionId}`);
  revalidatePath(`/app/${v.centerId}/schedule`);
  redirect(`/app/${v.centerId}/attendance/${v.sessionId}?saved=1`);
}
