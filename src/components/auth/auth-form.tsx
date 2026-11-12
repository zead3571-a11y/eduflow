'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { signInAction, signUpAction, type ActionState } from '@/app/actions/auth';

const initial: ActionState = {};

export function AuthForm({ mode, next = '/app' }: { mode: 'login' | 'signup'; next?: string }) {
  const action = mode === 'login' ? signInAction : signUpAction;
  const [state, formAction, pending] = useActionState(action, initial);
  const isSignup = mode === 'signup';
  return (
    <form action={formAction} className="auth-form">
      {!isSignup && <input type="hidden" name="next" value={next} />}
      {isSignup && <label>الاسم بالكامل<input name="fullName" autoComplete="name" placeholder="مثال: أحمد محمد" required minLength={2} /></label>}
      <label>البريد الإلكتروني<input name="email" type="email" autoComplete="email" placeholder="name@example.com" required /></label>
      <label>كلمة المرور<input name="password" type="password" autoComplete={isSignup ? 'new-password' : 'current-password'} placeholder="8 أحرف على الأقل" required minLength={8} /></label>
      {state.error && <p className="form-error" role="alert">{state.error}</p>}
      {state.message && <p className="form-success" role="status">{state.message}</p>}
      <button className="primary-button" disabled={pending}>{pending ? 'جارٍ التنفيذ...' : isSignup ? 'إنشاء الحساب' : 'تسجيل الدخول'}</button>
      <p className="auth-switch">{isSignup ? 'لديك حساب بالفعل؟ ' : 'ليس لديك حساب؟ '}<Link href={isSignup ? '/login' : '/signup'}>{isSignup ? 'تسجيل الدخول' : 'ابدأ التجربة المجانية'}</Link></p>
    </form>
  );
}
