import Link from 'next/link';
import { AuthForm } from '@/components/auth/auth-form';

export default function SignupPage() {
  return <main className="auth-shell"><section className="auth-card"><Link className="brand" href="/">EDUFLOW<span>.</span></Link><p className="eyebrow">START YOUR FREE TRIAL</p><h1>أنشئ حسابك</h1><p className="muted">ابدأ حسابك، ثم أضف بيانات السنتر لتفعيل فترة التجربة.</p><AuthForm mode="signup" /><p className="auth-footnote">لن نطلب منك بيانات بطاقة بنكية لإنشاء الحساب.</p></section></main>;
}
