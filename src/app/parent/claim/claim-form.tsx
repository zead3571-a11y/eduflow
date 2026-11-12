'use client';
import { useActionState } from 'react';
import { claimParentInvite } from '@/app/actions/parents';
export function ClaimParentInviteForm({ token }: { token: string }) {
 const [state, action, pending] = useActionState(claimParentInvite, {});
 return <form action={action} className="auth-form"><input type="hidden" name="token" value={token}/>
 <p className="muted">سجّل الدخول بالبريد الإلكتروني الذي استقبل الدعوة، ثم فعّل حساب ولي الأمر.</p>
 <button className="primary-button" disabled={pending}>{pending?'جارٍ التفعيل...':'تفعيل حساب ولي الأمر'}</button>
 {state.error && <p className="form-error">{state.error}</p>}</form>;
}
