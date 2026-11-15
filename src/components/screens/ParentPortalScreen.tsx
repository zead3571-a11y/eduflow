import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Bell,
  BookOpen,
  CheckSquare,
  FileText,
  Home,
  LogOut,
  MessageCircle,
  Phone,
  Wallet,
} from 'lucide-react';
import { useEduflow } from '../../context/EduflowContext';
import { ScreenId, UserRole } from '../../types/eduflow';
import { normalizePhoneDigits } from '../../permissions/permissions';
import {
  Button,
  Card,
  EduflowLogo,
  EmptyState,
  Field,
  InitialAvatar,
  StatusChip,
  TextInput,
  paymentStatusChipProps,
} from '../ui/Primitives';
import { formatEGP } from '../../utils/eduflowLogic';
import { buildStudentParentReportPdf } from '../../utils/pdfExportLogic';

// 21) Parent Portal (Mobile-first calm tone, large type, centered 720px on Desktop, no sidebar)
export const ParentPortalScreen: React.FC = () => {
  const {
    authSession,
    currentActor,
    currentRole,
    students,
    groups,
    sessions,
    invoices,
    payments,
    assessments,
    studentAccounts,
    centerSettings,
    loginWithCredentials,
    activateParentByPhone,
    logout,
    openPdfExport,
    navigate,
    showToast,
  } = useEduflow();

  const [portalScreen, setPortalScreen] = useState<'home' | 'invite' | 'login' | 'notifications'>('home');
  const [childTab, setChildTab] = useState<'attendance' | 'assessments' | 'payments'>('attendance');
  const [noDueDemo, setNoDueDemo] = useState(false);

  const targetPhone = normalizePhoneDigits(currentActor?.parentPhone || '01002349871');
  const childrenList =
    currentRole === UserRole.PARENT
      ? students
      : students.filter(
          (s) =>
            normalizePhoneDigits(s.parentPhone) === targetPhone ||
            normalizePhoneDigits(s.parent?.phone) === targetPhone
        );

  const [activeChildId, setActiveChildId] = useState(childrenList[0]?.id || '');
  const activeChild = childrenList.find((c) => c.id === activeChildId) || childrenList[0];

  // Invite / Login inputs
  const [invitePhone, setInvitePhone] = useState('01002349871');
  const [inviteCode, setInviteCode] = useState('NK-4829');
  const [invitePass, setInvitePass] = useState('');
  const [loginPhone, setLoginPhone] = useState('01002349871');
  const [loginPass, setLoginPass] = useState('EduFlow@2026');
  const [portalError, setPortalError] = useState('');
  const [portalLoading, setPortalLoading] = useState(false);

  const childInvoices =
    noDueDemo || !activeChild
      ? []
      : invoices.filter((i) => i.studentId === activeChild.id && i.status !== 'paid');
  const childReceipts = activeChild
    ? payments.filter((p) => p.studentId === activeChild.id)
    : [];
  const childAssessments = activeChild
    ? assessments.filter((a) => a.grades.some((g) => g.studentId === activeChild.id))
    : [];

  return (
    <div className="min-h-screen bg-[#F4F7FA] pb-20">
      {/* Calm Top Bar */}
      <header className="bg-white border-b border-[#E2E8F0] sticky top-0 z-20">
        <div className="max-w-[720px] mx-auto px-4 h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <EduflowLogo dark={false} compact />
            <div>
              <span className="text-sm font-bold text-[#0F2A4A] block">
                بوابة أولياء الأمور
              </span>
              <span className="text-[11px] text-[#5B6B80] block">{centerSettings.name}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:inline-flex items-center gap-1 p-1 bg-slate-100 rounded-[8px] text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setPortalScreen('home')}
                className={`px-2.5 py-1 rounded cursor-pointer ${
                  portalScreen === 'home' ? 'bg-white text-[#0F2A4A]' : 'text-[#5B6B80]'
                }`}
              >
                الرئيسية
              </button>
              <button
                type="button"
                onClick={() => setPortalScreen('invite')}
                className={`px-2.5 py-1 rounded cursor-pointer ${
                  portalScreen === 'invite' ? 'bg-white text-[#0F2A4A]' : 'text-[#5B6B80]'
                }`}
              >
                قبول الدعوة
              </button>
              <button
                type="button"
                onClick={() => setPortalScreen('login')}
                className={`px-2.5 py-1 rounded cursor-pointer ${
                  portalScreen === 'login' ? 'bg-white text-[#0F2A4A]' : 'text-[#5B6B80]'
                }`}
              >
                دخول الهاتف
              </button>
            </div>

            {authSession?.role === UserRole.PARENT ? (
              <button
                type="button"
                onClick={logout}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-[#E2E8F0] text-xs font-bold text-[#991B1B] hover:bg-red-50 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>تسجيل الخروج</span>
              </button>
            ) : authSession ? (
              <button
                type="button"
                onClick={() => navigate(ScreenId.DASHBOARD)}
                className="inline-flex items-center gap-1 text-xs font-bold text-[#0F766E] hover:underline cursor-pointer"
              >
                <span>لوحة السنتر</span>
                <ArrowRight className="w-3.5 h-3.5 rotate-180" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => navigate(ScreenId.LOGIN)}
                className="inline-flex items-center gap-1 text-xs font-bold text-[#0F766E] hover:underline cursor-pointer"
              >
                <span>دخول الإدارة</span>
                <ArrowRight className="w-3.5 h-3.5 rotate-180" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Centered 720px Column */}
      <main className="max-w-[720px] mx-auto px-4 py-6 space-y-5">
        {portalScreen === 'invite' && (
          <Card className="p-6 space-y-4">
            <h1 className="text-xl font-bold text-[#0F2A4A]">تفعيل حساب ولي الأمر لأول مرة</h1>
            <p className="text-sm text-[#5B6B80]">
              أدخل رقم هاتفك المسجل لدى السنتر وكود الدعوة وأنشئ كلمة سر خاصة بك لمتابعة أبنائك.
            </p>
            {portalError && (
              <div
                role="alert"
                className="p-3 rounded-[8px] bg-[#FEE2E2] text-[#991B1B] text-xs font-bold flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{portalError}</span>
              </div>
            )}
            <Field label="رقم موبايل ولي الأمر المسجل" htmlFor="pp-invite-phone">
              <TextInput
                id="pp-invite-phone"
                dir="ltr"
                className="text-right tabular-nums"
                value={invitePhone}
                onChange={(e) => {
                  setInvitePhone(e.target.value);
                  setPortalError('');
                }}
              />
            </Field>
            <Field label="كود الدعوة من السنتر" htmlFor="pp-code">
              <TextInput
                id="pp-code"
                dir="ltr"
                className="text-right font-bold tabular-nums"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
              />
            </Field>
            <Field label="إنشاء كلمة سر جديدة" htmlFor="pp-pass">
              <TextInput
                id="pp-pass"
                type="password"
                dir="ltr"
                className="text-right"
                placeholder="6 أحرف أو أرقام على الأقل"
                value={invitePass}
                onChange={(e) => {
                  setInvitePass(e.target.value);
                  setPortalError('');
                }}
              />
            </Field>
            <Button
              className="w-full"
              loading={portalLoading}
              onClick={async () => {
                setPortalError('');
                if (!inviteCode.trim()) {
                  setPortalError('أدخل كود الدعوة المرسل من السنتر.');
                  return;
                }
                setPortalLoading(true);
                const res = await activateParentByPhone(invitePhone, invitePass);
                setPortalLoading(false);
                if (!res.ok) {
                  setPortalError(res.error || 'تعذر تفعيل الحساب.');
                  return;
                }
                setInvitePass('');
                setPortalScreen('home');
              }}
            >
              تفعيل الحساب ومتابعة الأبناء
            </Button>
          </Card>
        )}

        {portalScreen === 'login' && (
          <Card className="p-6 space-y-4">
            <h1 className="text-xl font-bold text-[#0F2A4A]">دخول أولياء الأمور</h1>
            {portalError && (
              <div
                role="alert"
                className="p-3 rounded-[8px] bg-[#FEE2E2] text-[#991B1B] text-xs font-bold flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{portalError}</span>
              </div>
            )}
            <Field label="رقم موبايل ولي الأمر" htmlFor="pp-phone">
              <TextInput
                id="pp-phone"
                dir="ltr"
                className="text-right tabular-nums"
                value={loginPhone}
                onChange={(e) => {
                  setLoginPhone(e.target.value);
                  setPortalError('');
                }}
              />
            </Field>
            <Field label="كلمة السر" htmlFor="pp-lpass">
              <TextInput
                id="pp-lpass"
                type="password"
                dir="ltr"
                className="text-right"
                value={loginPass}
                onChange={(e) => {
                  setLoginPass(e.target.value);
                  setPortalError('');
                }}
              />
            </Field>
            <Button
              className="w-full"
              loading={portalLoading}
              onClick={async () => {
                setPortalError('');
                setPortalLoading(true);
                const res = await loginWithCredentials(loginPhone, loginPass);
                setPortalLoading(false);
                if (!res.ok) {
                  setPortalError(res.error || 'رقم الهاتف أو كلمة السر غير صحيحة.');
                  return;
                }
                setPortalScreen('home');
              }}
            >
              دخول
            </Button>
          </Card>
        )}

        {portalScreen === 'notifications' && (
          <div className="space-y-4">
            <h1 className="text-xl font-bold text-[#0F2A4A]">إشعارات متابعة الأبناء</h1>
            <Card padding="p-0" className="divide-y divide-[#E2E8F0]">
              <div className="p-4">
                <p className="text-sm font-bold text-[#0F2A4A]">تم رصد درجة امتحان الفيزياء</p>
                <p className="text-sm text-[#5B6B80] mt-1">
                  حصل يوسف أحمد محمود على 48 من 50 في امتحان التأثير المغناطيسي.
                </p>
                <span className="text-xs text-[#5B6B80] mt-1 block">أمس</span>
              </div>
              <div className="p-4">
                <p className="text-sm font-bold text-[#0F2A4A]">تأكيد استلام اشتراك نوفمبر</p>
                <p className="text-sm text-[#5B6B80] mt-1">
                  تم سداد 480 ج لمجموعة الفيزياء — إيصال رقم RCP-8841.
                </p>
                <span className="text-xs text-[#5B6B80] mt-1 block">12 نوفمبر 2026</span>
              </div>
            </Card>
          </div>
        )}

        {portalScreen === 'home' && !activeChild && (
          <EmptyState
            title="لا يوجد طلاب مسجلون برقم ولي الأمر هذا"
            description="تأكد من تسجيل رقم الموبايل لدى إدارة السنتر لربطه بملف أبنائك."
          />
        )}

        {portalScreen === 'home' && activeChild && (
          <>
            {/* Child Switcher Cards */}
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-[#5B6B80]">
                  اختر الابن / الابنة للمتابعة:
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<FileText className="w-4 h-4 text-[#0F766E]" />}
                  onClick={() =>
                    openPdfExport(
                      buildStudentParentReportPdf({
                        centerSettings,
                        student: activeChild,
                        groups,
                        sessions,
                        invoices,
                        assessments,
                      })
                    )
                  }
                >
                  تقرير الابن الشامل PDF
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {childrenList.map((child) => {
                  const selected = child.id === activeChild.id;
                  const childPortalAcc = studentAccounts.find((a) => a.studentId === child.id);
                  return (
                    <button
                      key={child.id}
                      type="button"
                      onClick={() => setActiveChildId(child.id)}
                      className={`p-4 rounded-[12px] border text-right flex items-center gap-3.5 transition-colors cursor-pointer ${
                        selected
                          ? 'bg-white border-2 border-[#0F766E] shadow-xs'
                          : 'bg-white/80 border-[#E2E8F0] hover:bg-white'
                      }`}
                    >
                      <InitialAvatar
                        name={child.name}
                        tint={selected ? '#0F766E' : '#0F2A4A'}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-base font-bold text-[#0F2A4A] truncate">
                          {child.name}
                        </p>
                        <p className="text-xs text-[#5B6B80]">{child.stage}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className="text-xs font-bold text-[#0F766E] tabular-nums">
                            الحضور: {child.attendanceRate}%
                          </span>
                          <StatusChip
                            tone={
                              !childPortalAcc
                                ? 'neutral'
                                : childPortalAcc.status === 'active'
                                ? 'success'
                                : 'danger'
                            }
                            label={
                              !childPortalAcc
                                ? 'منصة الطالب: غير مفعّل'
                                : childPortalAcc.status === 'active'
                                ? 'منصة الطالب: مفعّل'
                                : 'منصة الطالب: موقوف'
                            }
                          />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Child Detail Tabs */}
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-white border border-[#E2E8F0] rounded-[10px]">
              {[
                { id: 'attendance', label: 'الحضور', icon: <CheckSquare className="w-4 h-4" /> },
                { id: 'assessments', label: 'التقييمات', icon: <BookOpen className="w-4 h-4" /> },
                { id: 'payments', label: 'المدفوعات', icon: <Wallet className="w-4 h-4" /> },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setChildTab(t.id as typeof childTab)}
                  className={`py-2.5 rounded-[8px] text-sm font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                    childTab === t.id ? 'bg-[#0F2A4A] text-white' : 'text-[#5B6B80]'
                  }`}
                >
                  {t.icon}
                  <span>{t.label}</span>
                </button>
              ))}
            </div>

            {/* Attendance Tab */}
            {childTab === 'attendance' && (
              <Card className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-[#0F2A4A]">
                    ملخص حضور شهر نوفمبر 2026
                  </h2>
                  <StatusChip tone="success" label={`حضور ${activeChild.attendanceRate}%`} />
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {[
                    { d: '02 نوف', s: 'present' },
                    { d: '05 نوف', s: 'present' },
                    { d: '07 نوف', s: 'present' },
                    { d: '09 نوف', s: 'late' },
                    { d: '10 نوف', s: 'present' },
                    { d: '12 نوف', s: 'present' },
                  ].map((item, idx) => (
                    <div
                      key={idx}
                      className={`p-2.5 rounded-[8px] text-center tabular-nums ${
                        item.s === 'present'
                          ? 'bg-[#D1FAE5] text-[#065F46]'
                          : 'bg-[#FEF3C7] text-[#92400E]'
                      }`}
                    >
                      <span className="text-xs font-bold block">{item.d}</span>
                      <span className="text-[11px]">
                        {item.s === 'present' ? 'حاضر' : 'متأخر'}
                      </span>
                    </div>
                  ))}
                </div>

                <p className="text-sm text-[#5B6B80] pt-2 border-t border-[#E2E8F0]">
                  لا توجد أيام غياب غير مبررة خلال الأسبوعين الماضيين.
                </p>
              </Card>
            )}

            {/* Assessments Tab */}
            {childTab === 'assessments' && (
              <div className="space-y-3">
                {childAssessments.map((as) => {
                  const gr = as.grades.find((g) => g.studentId === activeChild.id);
                  const grp = groups.find((g) => g.id === as.groupId);
                  return (
                    <Card key={as.id} className="p-5 flex items-center justify-between gap-4">
                      <div>
                        <span className="text-xs text-[#5B6B80]">
                          {grp?.subject} · {as.date}
                        </span>
                        <h3 className="text-base font-bold text-[#0F2A4A] mt-0.5">
                          {as.title}
                        </h3>
                      </div>
                      <div className="text-left shrink-0">
                        <span className="text-xl font-bold text-[#0F766E] tabular-nums block">
                          {gr?.score ?? '—'} / {as.maxScore}
                        </span>
                        <span className="text-xs text-[#5B6B80]">الدرجة</span>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Payments Tab */}
            {childTab === 'payments' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-[#0F2A4A]">الفواتير المستحقة</h3>
                  <button
                    type="button"
                    onClick={() => setNoDueDemo((v) => !v)}
                    className="text-xs font-semibold text-[#5B6B80] underline cursor-pointer"
                  >
                    {noDueDemo ? 'عرض الفواتير' : 'معاينة حالة لا توجد مستحقات'}
                  </button>
                </div>

                {childInvoices.length === 0 ? (
                  <EmptyState
                    title="لا توجد فواتير مستحقة"
                    description="جميع الاشتراكات الشهرية الخاصة بالابن مسددة بالكامل. شكراً لالتزامكم."
                  />
                ) : (
                  childInvoices.map((inv) => {
                    const ch = paymentStatusChipProps(inv.status);
                    return (
                      <Card key={inv.id} className="p-4 flex items-center justify-between">
                        <div>
                          <p className="text-base font-bold text-[#0F2A4A]">{inv.month}</p>
                          <p className="text-xs text-[#5B6B80] tabular-nums">
                            المتبقي: {formatEGP(inv.total - inv.paid)}
                          </p>
                        </div>
                        <StatusChip tone={ch.tone} label={ch.label} />
                      </Card>
                    );
                  })
                )}

                <h3 className="text-base font-bold text-[#0F2A4A] pt-2">الإيصالات المسددة</h3>
                <Card padding="p-0" className="divide-y divide-[#E2E8F0]">
                  {childReceipts.map((rcp) => (
                    <div key={rcp.id} className="p-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-[#1E293B]">
                          إيصال #{rcp.receiptNumber} ({rcp.method})
                        </p>
                        <p className="text-xs text-[#5B6B80] tabular-nums">{rcp.date}</p>
                      </div>
                      <span className="text-base font-bold text-[#065F46] tabular-nums">
                        {formatEGP(rcp.amount)}
                      </span>
                    </div>
                  ))}
                </Card>
              </div>
            )}

            {/* Contact the Center Card */}
            <Card className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-[#0F2A4A]">تواصل مع إدارة السنتر</h3>
                <p className="text-xs text-[#5B6B80]">
                  للاستفسار عن المواعيد أو إبلاغ الإدارة بعذر غياب مسبق
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`tel:${centerSettings.phone}`}
                  className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-[8px] border border-[#E2E8F0] bg-white text-sm font-bold text-[#0F2A4A] hover:bg-slate-50"
                >
                  <Phone className="w-4 h-4 text-[#0F766E]" />
                  <span>اتصال هاتفي</span>
                </a>
                <button
                  type="button"
                  onClick={() =>
                    showToast(`تم فتح محادثة واتساب مع استقبال السنتر (${centerSettings.phone})`, 'info')
                  }
                  className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-[8px] bg-[#0F766E] text-white text-sm font-bold hover:bg-[#0D655E] cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>واتساب السنتر</span>
                </button>
              </div>
            </Card>
          </>
        )}
      </main>

      {/* Bottom Tabs for Parent Portal */}
      <nav
        aria-label="تنقل بوابة ولي الأمر"
        className="fixed bottom-0 inset-x-0 h-16 bg-white border-t border-[#E2E8F0] z-20"
      >
        <div className="max-w-[720px] mx-auto h-full grid grid-cols-3">
          <button
            type="button"
            onClick={() => setPortalScreen('home')}
            className={`flex flex-col items-center justify-center gap-1 text-xs font-bold cursor-pointer ${
              portalScreen === 'home' ? 'text-[#0F766E]' : 'text-[#5B6B80]'
            }`}
          >
            <Home className="w-5 h-5" />
            <span>أبنائي</span>
          </button>
          <button
            type="button"
            onClick={() => setPortalScreen('notifications')}
            className={`flex flex-col items-center justify-center gap-1 text-xs font-bold cursor-pointer ${
              portalScreen === 'notifications' ? 'text-[#0F766E]' : 'text-[#5B6B80]'
            }`}
          >
            <Bell className="w-5 h-5" />
            <span>الإشعارات</span>
          </button>
          <button
            type="button"
            onClick={() => setPortalScreen('invite')}
            className={`flex flex-col items-center justify-center gap-1 text-xs font-bold cursor-pointer ${
              portalScreen === 'invite' ? 'text-[#0F766E]' : 'text-[#5B6B80]'
            }`}
          >
            <CheckSquare className="w-5 h-5" />
            <span>كود دعوة جديد</span>
          </button>
        </div>
      </nav>
    </div>
  );
};
