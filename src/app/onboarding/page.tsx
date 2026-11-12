import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { CenterOnboardingForm } from './form';

export default async function OnboardingPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: memberships } = await supabase.from('center_members').select('center_id').eq('user_id', user.id).eq('is_active', true).limit(1);
  if (memberships?.length) redirect('/app');
  return <main className="auth-shell"><section className="auth-card onboarding-card"><p className="eyebrow">CENTER SETUP · STEP 1 OF 1</p><h1>خلينا نجهّز السنتر</h1><p className="muted">أدخل البيانات الأساسية. سيتم إنشاء مساحة مستقلة للسنتر وتفعيل فترة التجربة تلقائياً.</p><CenterOnboardingForm /></section></main>;
}
