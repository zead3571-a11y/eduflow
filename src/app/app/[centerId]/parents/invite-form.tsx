'use client';
import { useActionState } from 'react';
import { createParentInvite } from '@/app/actions/parents';

export function ParentInviteForm({ centerId, guardians }: { centerId: string; guardians: { id: string; full_name: string; email: string | null; user_id: string | null }[] }) {
  const [state, action, pending] = useActionState(createParentInvite, {});
  const available = guardians.filter(g => g.email && !g.user_id);
  return <form action={action} className="stack-form">
    <input type="hidden" name="centerId" value={centerId}/>
    <label>ولي الأمر
      <select name="guardianId" required defaultValue="">
        <option value="" disabled>اختر ولي الأمر</option>
        {available.map(g => <option key={g.id} value={g.id}>{g.full_name} — {g.email}</option>)}
      </select>
    </label>
    <button className="primary-button" disabled={pending || !available.length}>{pending ? 'جارٍ إنشاء الدعوة...' : 'إنشاء رابط دعوة'}</button>
    {!available.length && <p className="muted">لا يوجد أولياء أمور ببريد إلكتروني غير مرتبط بحساب.</p>}
    {state.error && <p className="form-error">{state.error}</p>}
    {state.inviteUrl && <div className="invite-result"><p>تم إنشاء رابط صالح لمدة 7 أيام. أرسله لولي الأمر عبر قناة موثوقة.</p><input readOnly value={state.inviteUrl} onFocus={e=>e.currentTarget.select()}/><button type="button" className="secondary-button" onClick={()=>navigator.clipboard.writeText(state.inviteUrl!)}>نسخ الرابط</button></div>}
  </form>;
}
