'use client';
import { useActionState } from 'react';
import { createCenterAction, type ActionState } from '@/app/actions/auth';
const initial: ActionState = {};
export function CenterOnboardingForm() {
  const [state, action, pending] = useActionState(createCenterAction, initial);
  return <form action={action} className="auth-form">
    <label>اسم السنتر<input name="name" placeholder="مثال: أكاديمية المستقبل" required minLength={2} /></label>
    <label>الرابط المختصر<input name="slug" dir="ltr" placeholder="future-academy" pattern="[a-z0-9][a-z0-9-]{2,48}[a-z0-9]" required /><small>يُستخدم في رابط مساحة السنتر، ويجب أن يكون بالإنجليزية.</small></label>
    <label>البريد الإلكتروني للسنتر<input name="email" type="email" placeholder="center@example.com" /></label>
    <label>رقم الهاتف<input name="phone" type="tel" dir="ltr" placeholder="01xxxxxxxxx" /></label>
    {state.error && <p className="form-error" role="alert">{state.error}</p>}
    <button className="primary-button" disabled={pending}>{pending ? 'جارٍ إنشاء السنتر...' : 'إنشاء السنتر وبدء التجربة'}</button>
  </form>;
}
