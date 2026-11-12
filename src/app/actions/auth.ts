'use server';

import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { centerSchema, signInSchema, signUpSchema } from '@/lib/validations/auth';

export type ActionState = { error?: string; message?: string };

export async function signInAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signInSchema.safeParse({ email: formData.get('email'), password: formData.get('password') });
  if (!parsed.success) return { error: 'راجع البريد الإلكتروني وكلمة المرور.' };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: 'تعذر تسجيل الدخول. تأكد من البيانات وحاول مرة أخرى.' };
  const next = String(formData.get('next') ?? '/app');
  redirect(next.startsWith('/') && !next.startsWith('//') ? next : '/app');
}

export async function signUpAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signUpSchema.safeParse({
    fullName: formData.get('fullName'), email: formData.get('email'), password: formData.get('password'),
  });
  if (!parsed.success) return { error: 'تأكد من الاسم والبريد وكلمة المرور (8 أحرف على الأقل).' };
  const supabase = await createSupabaseServerClient();
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${origin}/auth/callback?next=/onboarding`,
    },
  });
  if (error) return { error: error.message.includes('already registered') ? 'هذا البريد مسجل بالفعل.' : 'تعذر إنشاء الحساب حالياً.' };
  if (!data.session) return { message: 'تم إنشاء الحساب. افتح رسالة التأكيد في بريدك الإلكتروني لإكمال التسجيل.' };
  redirect('/onboarding');
}

export async function createCenterAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = centerSchema.safeParse({
    name: formData.get('name'), slug: formData.get('slug'), email: formData.get('email') ?? '', phone: formData.get('phone') ?? '',
  });
  if (!parsed.success) return { error: 'راجع اسم السنتر والرابط المختصر. استخدم أحرفاً إنجليزية وأرقاماً وشرطة فقط للرابط.' };
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data, error } = await supabase.rpc('create_center_with_trial', {
    p_name: parsed.data.name,
    p_slug: parsed.data.slug,
    p_email: parsed.data.email || null,
    p_phone: parsed.data.phone || null,
    p_plan_code: 'starter',
  });
  if (error) {
    if (error.message.toLowerCase().includes('duplicate')) return { error: 'الرابط المختصر مستخدم بالفعل، اختر رابطاً آخر.' };
    return { error: 'تعذر إنشاء السنتر. تأكد من تطبيق migrations وتفعيل باقة starter.' };
  }
  redirect(`/app?center=${data}`);
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect('/login');
}
