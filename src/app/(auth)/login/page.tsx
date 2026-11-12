import Link from 'next/link';
import { AuthForm } from '@/components/auth/auth-form';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next = '/app' } = await searchParams;
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/app';
  return <main className="auth-shell"><section className="auth-card"><Link className="brand" href="/">EDUFLOW<span>.</span></Link><p className="eyebrow">WELCOME BACK</p><h1>أهلاً بعودتك</h1><p className="muted">سجّل الدخول لإدارة السنتر ومتابعة يومك.</p><AuthForm mode="login" next={safeNext} /><p className="auth-footnote">بالمتابعة، أنت توافق على شروط الاستخدام وسياسة الخصوصية.</p></section></main>;
}
