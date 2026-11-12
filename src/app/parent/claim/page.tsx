import Link from 'next/link';
import { ClaimParentInviteForm } from './claim-form';
export default async function ParentClaimPage({ searchParams }: { searchParams: Promise<{token?:string}> }) {
 const {token=''}=await searchParams;
 return <main className="auth-shell"><section className="auth-card"><span className="brand">EDUFLOW<span>.</span></span><p className="eyebrow">PARENT PORTAL</p><h1>تفعيل حساب ولي الأمر</h1>
 {token.length>=32 ? <ClaimParentInviteForm token={token}/> : <p className="form-error">رابط الدعوة غير صالح أو غير مكتمل.</p>}
 <p className="auth-footnote"><Link href="/login">تسجيل الدخول</Link></p></section></main>;
}
