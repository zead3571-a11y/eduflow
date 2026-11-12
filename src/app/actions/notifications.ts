'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const schema = z.object({ centerId: z.string().uuid(), notificationId: z.string().uuid() });

export async function markNotificationRead(formData: FormData) {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error('بيانات الإشعار غير صالحة.');
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { error } = await supabase.rpc('mark_notification_read', { p_notification_id: parsed.data.notificationId });
  if (error) throw new Error(error.message);
  revalidatePath(`/app/${parsed.data.centerId}/notifications`);
}
