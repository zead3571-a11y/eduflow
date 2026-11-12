import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { signOutAction } from '@/app/actions/auth';

export default async function AppHome() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: memberships, error } = await supabase.from('center_members').select('center_id, role, centers(id,name,slug)').eq('user_id', user.id).eq('is_active', true);
  if (error) throw new Error('تعذر تحميل مساحات السنتر.');
  if (!memberships?.length) redirect('/onboarding');
  return <main className="app-shell"><header className="app-header"><div><span className="brand">EDUFLOW<span>.</span></span><p className="muted">مساحات العمل الخاصة بك</p></div><form action={signOutAction}><button className="secondary-button">تسجيل الخروج</button></form></header><section className="app-content"><p className="eyebrow">YOUR WORKSPACES</p><h1>اختار السنتر</h1><p className="muted">يمكنك الوصول إلى السناتر التي تمتلك صلاحية العمل بها.</p><div className="workspace-grid">{memberships.map((membership) => {
    const center = membership.centers as unknown as { id: string; name: string; slug: string };
    return <article className="workspace-card" key={membership.center_id}><div className="workspace-icon">{center.name.slice(0,1)}</div><h2>{center.name}</h2><p className="muted">{center.slug}</p><span className="role-pill">{membership.role}</span><a className="primary-button link-button" href={`/app/${center.id}`}>فتح مساحة السنتر</a></article>;
  })}</div></section></main>;
}
