'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const inviteSchema = z.object({ centerId: z.string().uuid(), guardianId: z.string().uuid() });

export async function createParentInvite(_: { error?: string; inviteUrl?: string }, formData: FormData) {
  const parsed = inviteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: 'بيانات الدعوة غير صالحة.' };
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: token, error } = await supabase.rpc('create_guardian_portal_invite', {
    p_center_id: parsed.data.centerId, p_guardian_id: parsed.data.guardianId,
  });
  if (error || !token) return { error: error?.message ?? 'تعذر إنشاء الدعوة.' };
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  revalidatePath(`/app/${parsed.data.centerId}/parents`);
  return { inviteUrl: `${origin}/parent/claim?token=${encodeURIComponent(token)}` };
}

export async function claimParentInvite(_: { error?: string; centerId?: string }, formData: FormData) {
  const token = String(formData.get('token') ?? '');
  if (token.length < 32) return { error: 'رابط الدعوة غير صالح.' };
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/parent/claim?token=${token}`)}`);
  const { data: centerId, error } = await supabase.rpc('claim_guardian_portal_invite', { p_token: token });
  if (error || !centerId) return { error: error?.message ?? 'تعذر تفعيل حساب ولي الأمر.' };
  redirect(`/parent/${centerId}`);
}
