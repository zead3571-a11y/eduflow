import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  ClipboardList,
  Eye,
  EyeOff,
  HelpCircle,
  Home,
  KeyRound,
  Laptop,
  LogOut,
  Phone,
  PlayCircle,
  ShieldCheck,
  Smartphone,
  User,
} from 'lucide-react';
import { useEduflow } from '../../context/EduflowContext';
import { ScreenId, StudentDeviceSession } from '../../types/eduflow';
import {
  Button,
  Card,
  EduflowLogo,
  EmptyState,
  Field,
  InitialAvatar,
  StatusChip,
  TextInput,
} from '../ui/Primitives';
import { formatDateDDMMYYYY } from '../../utils/eduflowLogic';
import {
  DEFAULT_STUDENT_MAX_DEVICES,
  validateStudentPin,
} from '../../features/studentPortal/studentAuthService';

function formatIsoToDDMMYYYY(isoOrMs: string | number | undefined): string {
  if (!isoOrMs) return '—';
  const d = typeof isoOrMs === 'number' ? new Date(isoOrMs) : new Date(isoOrMs);
  if (Number.isNaN(d.getTime())) return '—';
  return formatDateDDMMYYYY(d);
}

// 22) Student Login Screen (Separate Route #/student-login, Mobile-first, Code + PIN)
export const StudentLoginScreen: React.FC = () => {
  const {
    navigate,
    centerSettings,
    studentPortalAvailable,
    loginStudentWithCode,
    completeStudentFirstLoginPin,
    showToast,
  } = useEduflow();

  const [step, setStep] = useState<'login' | 'pin_setup' | 'device_limit'>('login');
  const [accessCode, setAccessCode] = useState('');
  const [pin, setPin] = useState('');
  const [showCode, setShowCode] = useState(true);
  const [showPin, setShowPin] = useState(false);

  // First-login PIN creation state
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showNewPin, setShowNewPin] = useState(false);
  const [pendingSetupFromFirstLogin, setPendingSetupFromFirstLogin] = useState(false);

  // Device limit eviction state
  const [evictionDevices, setEvictionDevices] = useState<StudentDeviceSession[]>([]);
  const [evictionMaxDevices, setEvictionMaxDevices] = useState<number>(
    centerSettings.studentMaxDevices || DEFAULT_STUDENT_MAX_DEVICES
  );

  const [forgotHelpOpen, setForgotHelpOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!accessCode.trim()) {
      setErrorMsg('أدخل كود الدخول الشخصي المسلّم لك من السنتر.');
      return;
    }
    setLoading(true);
    try {
      const res = await loginStudentWithCode({
        accessCode: accessCode.trim(),
        pin: pin.trim() || undefined,
      });
      if (res.ok) return;

      if (res.requiresPinSetup) {
        setPendingSetupFromFirstLogin(true);
        setStep('pin_setup');
        setNewPin('');
        setConfirmPin('');
        setErrorMsg('');
        showToast('أهلاً بك! أنشئ رمز مرور (PIN) لحماية حسابك في المرات القادمة', 'info');
        return;
      }

      if (res.requiresDeviceEviction && res.activeSessions) {
        setPendingSetupFromFirstLogin(false);
        setEvictionDevices(res.activeSessions);
        setEvictionMaxDevices(res.maxDevices || DEFAULT_STUDENT_MAX_DEVICES);
        setStep('device_limit');
        setErrorMsg('');
        return;
      }

      setErrorMsg(res.error || 'تعذر تسجيل الدخول.');
    } finally {
      setLoading(false);
    }
  };

  const handlePinSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const check = validateStudentPin(newPin);
    if (!check.valid) {
      setErrorMsg(check.error || 'رمز المرور غير صالح.');
      return;
    }
    if (newPin.trim() !== confirmPin.trim()) {
      setErrorMsg('تأكيد رمز المرور غير مطابق.');
      return;
    }

    setLoading(true);
    try {
      const res = await completeStudentFirstLoginPin({
        accessCode: accessCode.trim(),
        newPin: newPin.trim(),
      });
      if (res.ok) return;

      if (res.requiresDeviceEviction && res.activeSessions) {
        setPendingSetupFromFirstLogin(true);
        setEvictionDevices(res.activeSessions);
        setEvictionMaxDevices(res.maxDevices || DEFAULT_STUDENT_MAX_DEVICES);
        setStep('device_limit');
        return;
      }

      setErrorMsg(res.error || 'تعذر حفظ رمز المرور.');
    } finally {
      setLoading(false);
    }
  };

  const handleEvictOldestAndLogin = async () => {
    setErrorMsg('');
    setLoading(true);
    try {
      const res = pendingSetupFromFirstLogin
        ? await loginStudentWithCode({
            accessCode: accessCode.trim(),
            pin: newPin.trim(),
            kickOldestDevice: true,
          })
        : await loginStudentWithCode({
            accessCode: accessCode.trim(),
            pin: pin.trim() || undefined,
            kickOldestDevice: true,
          });
      if (!res.ok) {
        setErrorMsg(res.error || 'تعذر إتمام الدخول.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F7FA] flex flex-col">
      {/* Calm Student Header */}
      <header className="bg-white border-b border-[#E2E8F0]">
        <div className="max-w-[760px] mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <EduflowLogo dark={false} compact />
            <div>
              <span className="text-sm font-bold text-[#0F2A4A] block">منصة الطالب</span>
              <span className="text-[11px] text-[#5B6B80] block">{centerSettings.name}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(ScreenId.LANDING)}
              className="text-xs font-bold text-[#5B6B80] hover:text-[#0F2A4A] inline-flex items-center gap-1 cursor-pointer"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>الرئيسية</span>
            </button>
            <button
              type="button"
              onClick={() => navigate(ScreenId.LOGIN)}
              className="text-xs font-bold text-[#0F766E] hover:underline cursor-pointer"
            >
              دخول الإدارة
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md space-y-4">
          {/* Student Hero Banner */}
          <div className="bg-[#0F2A4A] text-white rounded-[12px] p-5 flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-[10px] bg-[#0F766E] flex items-center justify-center shrink-0">
              <KeyRound className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold">بوابة الطالب — {centerSettings.name}</h1>
              <p className="text-xs text-slate-300 mt-0.5">
                تابع جدول حصصك وسجل حضورك ونتائج امتحاناتك بكودك الشخصي
              </p>
            </div>
          </div>

          {!studentPortalAvailable ? (
            <Card className="p-6 text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-[#FEF3C7] text-[#92400E] flex items-center justify-center">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h2 className="text-base font-bold text-[#0F2A4A]">
                منصة الطالب غير مفعّلة حالياً
              </h2>
              <p className="text-xs text-[#5B6B80] leading-relaxed">
                بوابة الطلاب مغلقة حالياً من إعدادات السنتر أو غير مشمولة في الباقة النشطة. يرجى التواصل مع إدارة {centerSettings.name} على الرقم{' '}
                <span className="font-bold text-[#0F2A4A] tabular-nums" dir="ltr">
                  {centerSettings.phone}
                </span>
                .
              </p>
              <div className="pt-2 flex justify-center gap-2">
                <Button variant="secondary" onClick={() => navigate(ScreenId.LANDING)}>
                  الصفحة الرئيسية
                </Button>
                <Button onClick={() => navigate(ScreenId.PARENT_PORTAL)}>
                  بوابة أولياء الأمور
                </Button>
              </div>
            </Card>
          ) : (
            <Card className="p-6 space-y-5">
              {errorMsg && (
                <div
                  role="alert"
                  className="p-3.5 rounded-[8px] bg-[#FEE2E2] border border-red-200 text-[#991B1B] text-xs font-bold flex items-start gap-2"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {step === 'login' && (
                <form onSubmit={handleLoginSubmit} className="space-y-4" noValidate>
                  <div>
                    <h2 className="text-lg font-bold text-[#0F2A4A]">تسجيل دخول الطالب</h2>
                    <p className="text-xs text-[#5B6B80] mt-1">
                      أدخل كود الدخول الشخصي المطبوع في بطاقتك (مثال:{' '}
                      <span dir="ltr" className="inline-block font-bold text-[#0F2A4A]">
                        K7M2-QX9P
                      </span>
                      )
                    </p>
                  </div>

                  <Field label="كود الدخول الشخصي" htmlFor="student-access-code" required>
                    <div className="relative">
                      <TextInput
                        id="student-access-code"
                        type={showCode ? 'text' : 'password'}
                        dir="ltr"
                        autoComplete="username"
                        className="text-center font-bold tracking-widest uppercase tabular-nums pl-11"
                        placeholder="K7M2-QX9P"
                        value={accessCode}
                        onChange={(e) => {
                          setAccessCode(e.target.value.toUpperCase());
                          setErrorMsg('');
                        }}
                      />
                      <button
                        type="button"
                        aria-label={showCode ? 'إخفاء كود الدخول' : 'إظهار كود الدخول'}
                        onClick={() => setShowCode((v) => !v)}
                        className="absolute left-3 top-3 text-[#5B6B80] hover:text-[#1E293B] cursor-pointer"
                      >
                        {showCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </Field>

                  <Field
                    label="رمز المرور (PIN)"
                    htmlFor="student-pin"
                    hint="في أول دخول لك بالكود اترك هذا الحقل فارغاً ليُطلب منك إنشاء رمز مرور خاص بك."
                  >
                    <div className="relative">
                      <TextInput
                        id="student-pin"
                        type={showPin ? 'text' : 'password'}
                        dir="ltr"
                        autoComplete="current-password"
                        className="text-center font-bold tracking-widest tabular-nums pl-11"
                        placeholder="••••"
                        value={pin}
                        onChange={(e) => {
                          setPin(e.target.value);
                          setErrorMsg('');
                        }}
                      />
                      <button
                        type="button"
                        aria-label={showPin ? 'إخفاء رمز المرور' : 'إظهار رمز المرور'}
                        onClick={() => setShowPin((v) => !v)}
                        className="absolute left-3 top-3 text-[#5B6B80] hover:text-[#1E293B] cursor-pointer"
                      >
                        {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </Field>

                  <Button type="submit" loading={loading} className="w-full">
                    دخول إلى منصة الطالب
                  </Button>

                  <div className="pt-2 flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={() => setForgotHelpOpen((v) => !v)}
                      className="inline-flex items-center gap-1 font-bold text-[#0F766E] hover:underline cursor-pointer"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                      <span>نسيت الكود أو رمز المرور؟</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(ScreenId.PARENT_PORTAL)}
                      className="font-semibold text-[#5B6B80] hover:text-[#0F2A4A] cursor-pointer"
                    >
                      حساب ولي الأمر
                    </button>
                  </div>

                  {forgotHelpOpen && (
                    <div className="p-3.5 rounded-[10px] bg-[#F4F7FA] border border-[#E2E8F0] text-xs text-[#1E293B] space-y-2">
                      <p className="font-bold text-[#0F2A4A]">تواصل مع إدارة السنتر</p>
                      <p className="text-[#5B6B80] leading-relaxed">
                        حفاظاً على أمان حسابك، لا يمكن استرجاع الكود ذاتياً. تواصل مع مكتب الاستقبال في {centerSettings.name} لإصدار بطاقة كود دخول جديدة:
                      </p>
                      <a
                        href={`tel:${centerSettings.phone}`}
                        className="inline-flex items-center gap-1.5 font-bold text-[#0F766E] tabular-nums"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span dir="ltr">{centerSettings.phone}</span>
                      </a>
                    </div>
                  )}
                </form>
              )}

              {step === 'pin_setup' && (
                <form onSubmit={handlePinSetupSubmit} className="space-y-4" noValidate>
                  <div className="flex items-center gap-2.5 text-[#0F766E]">
                    <ShieldCheck className="w-5 h-5 shrink-0" />
                    <h2 className="text-lg font-bold text-[#0F2A4A]">
                      إنشاء رمز مرور (PIN) لأول مرة
                    </h2>
                  </div>
                  <p className="text-xs text-[#5B6B80] leading-relaxed">
                    تم التحقق من كود الدخول <strong dir="ltr">{accessCode}</strong>. اختر الآن رمز مرور من 4 إلى 6 أرقام (أو كلمة سر قصيرة) لتستخدمه مع الكود في المرات القادمة.
                  </p>

                  <Field label="رمز المرور الجديد (4-6 أرقام)" htmlFor="student-new-pin" required>
                    <div className="relative">
                      <TextInput
                        id="student-new-pin"
                        type={showNewPin ? 'text' : 'password'}
                        dir="ltr"
                        className="text-center font-bold tracking-widest tabular-nums pl-11"
                        placeholder="مثال: 2580"
                        value={newPin}
                        onChange={(e) => {
                          setNewPin(e.target.value);
                          setErrorMsg('');
                        }}
                      />
                      <button
                        type="button"
                        aria-label={showNewPin ? 'إخفاء الرمز' : 'إظهار الرمز'}
                        onClick={() => setShowNewPin((v) => !v)}
                        className="absolute left-3 top-3 text-[#5B6B80] hover:text-[#1E293B] cursor-pointer"
                      >
                        {showNewPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </Field>

                  <Field label="تأكيد رمز المرور" htmlFor="student-confirm-pin" required>
                    <TextInput
                      id="student-confirm-pin"
                      type={showNewPin ? 'text' : 'password'}
                      dir="ltr"
                      className="text-center font-bold tracking-widest tabular-nums"
                      placeholder="أعد كتابة الرمز"
                      value={confirmPin}
                      onChange={(e) => {
                        setConfirmPin(e.target.value);
                        setErrorMsg('');
                      }}
                    />
                  </Field>

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setStep('login');
                        setErrorMsg('');
                      }}
                    >
                      رجوع
                    </Button>
                    <Button type="submit" loading={loading} className="flex-1">
                      حفظ الرمز والدخول
                    </Button>
                  </div>
                </form>
              )}

              {step === 'device_limit' && (
                <div className="space-y-4">
                  <div className="flex items-start gap-2.5">
                    <Smartphone className="w-5 h-5 text-[#92400E] shrink-0 mt-0.5" />
                    <div>
                      <h2 className="text-base font-bold text-[#0F2A4A]">
                        تم الوصول للحد الأقصى للأجهزة ({evictionMaxDevices})
                      </h2>
                      <p className="text-xs text-[#5B6B80] mt-1">
                        حسابك مفتوح حالياً على الأجهزة التالية. يمكنك تسجيل الخروج من أقدم جهاز والمتابعة على هذا الجهاز:
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {evictionDevices.map((dev, idx) => (
                      <div
                        key={dev.id}
                        className="p-3 rounded-[8px] bg-[#F4F7FA] border border-[#E2E8F0] flex items-center justify-between text-xs"
                      >
                        <div>
                          <p className="font-bold text-[#0F2A4A]">{dev.deviceLabel}</p>
                          <p className="text-[#5B6B80] tabular-nums">
                            آخر نشاط: {formatIsoToDDMMYYYY(dev.lastSeenAt)}
                          </p>
                        </div>
                        {idx === 0 && <StatusChip tone="warning" label="الأقدم" />}
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setStep('login');
                        setErrorMsg('');
                      }}
                    >
                      إلغاء
                    </Button>
                    <Button
                      type="button"
                      loading={loading}
                      onClick={handleEvictOldestAndLogin}
                      className="flex-1"
                    >
                      تسجيل الخروج من أقدم جهاز والدخول
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          )}
        </div>
      </main>
    </div>
  );
};

// 23) Student Portal Shell (Standalone mobile-first layout, 5 bottom tabs)
export const StudentPortalScreen: React.FC = () => {
  const {
    studentAuthSession,
    studentPortalAvailable,
    centerSettings,
    students,
    groups,
    sessions,
    attendanceRecords,
    assessments,
    studentSessions,
    changeStudentPortalPin,
    revokeSingleStudentPortalSession,
    revokeAllStudentPortalSessions,
    logoutStudent,
    navigate,
  } = useEduflow();

  const [tab, setTab] = useState<'home' | 'lessons' | 'exams' | 'attendance' | 'account'>('home');

  // Change PIN form state
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPins, setShowPins] = useState(false);
  const [pinError, setPinError] = useState('');
  const [pinSuccess, setPinSuccess] = useState('');
  const [pinSaving, setPinSaving] = useState(false);

  const student = useMemo(() => {
    if (!studentAuthSession) return students[0];
    return students.find((s) => s.id === studentAuthSession.studentId) || students[0];
  }, [students, studentAuthSession]);

  const studentGroups = useMemo(() => {
    if (!student) return [];
    return groups.filter((g) => student.groupIds.includes(g.id));
  }, [groups, student]);

  const studentSessionsSchedule = useMemo(() => {
    if (!student) return [];
    return sessions.filter(
      (s) =>
        student.groupIds.includes(s.groupId) ||
        s.entries.some((e) => e.studentId === student.id)
    );
  }, [sessions, student]);

  const studentAttendanceRows = useMemo(() => {
    if (!student) return [];
    return studentSessionsSchedule.map((sess) => {
      const grp = groups.find((g) => g.id === sess.groupId);
      const entry = sess.entries.find((e) => e.studentId === student.id);
      const rec = attendanceRecords.find(
        (r) => r.sessionId === sess.id && r.studentId === student.id
      );
      return {
        session: sess,
        groupName: grp?.name || 'مجموعة',
        status: rec?.status || entry?.status || 'unrecorded',
        method: rec?.method,
        compensatedBy: rec?.compensatedBy,
        note: rec?.note || entry?.note,
      };
    });
  }, [studentSessionsSchedule, groups, attendanceRecords, student]);

  const studentAssessments = useMemo(() => {
    if (!student) return [];
    return assessments.filter((a) =>
      a.grades.some((g) => g.studentId === student.id)
    );
  }, [assessments, student]);

  const activeDevices = useMemo(() => {
    if (!student) return [];
    const now = Date.now();
    return studentSessions
      .filter((s) => s.studentId === student.id && !s.revokedAt && s.expiresAt > now)
      .sort((a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime());
  }, [studentSessions, student]);

  if (!studentPortalAvailable) {
    return (
      <div className="min-h-screen bg-[#F4F7FA] flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-6 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-[#92400E] mx-auto" />
          <h1 className="text-lg font-bold text-[#0F2A4A]">منصة الطالب غير متاحة حالياً</h1>
          <p className="text-xs text-[#5B6B80]">
            تم إيقاف منصة الطالب من إعدادات {centerSettings.name}. تواصل مع الإدارة لمزيد من التفاصيل.
          </p>
          <Button onClick={logoutStudent}>العودة لصفحة الدخول</Button>
        </Card>
      </div>
    );
  }

  if (!studentAuthSession || !student) {
    return (
      <div className="min-h-screen bg-[#F4F7FA] flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-6 text-center space-y-3">
          <h1 className="text-lg font-bold text-[#0F2A4A]">انتهت جلسة الطالب</h1>
          <p className="text-xs text-[#5B6B80]">يرجى تسجيل الدخول بكود الطالب للمتابعة.</p>
          <Button onClick={() => navigate(ScreenId.STUDENT_LOGIN)}>صفحة دخول الطالب</Button>
        </Card>
      </div>
    );
  }

  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError('');
    setPinSuccess('');
    if (!oldPin.trim()) {
      setPinError('أدخل رمز المرور الحالي.');
      return;
    }
    const check = validateStudentPin(newPin);
    if (!check.valid) {
      setPinError(check.error || 'رمز المرور الجديد غير صالح.');
      return;
    }
    if (newPin.trim() !== confirmPin.trim()) {
      setPinError('تأكيد رمز المرور الجديد غير مطابق.');
      return;
    }
    setPinSaving(true);
    try {
      const res = await changeStudentPortalPin(oldPin.trim(), newPin.trim());
      if (!res.ok) {
        setPinError(res.error || 'تعذر تغيير رمز المرور.');
        return;
      }
      setOldPin('');
      setNewPin('');
      setConfirmPin('');
      setPinSuccess('تم تحديث رمز المرور (PIN) بنجاح.');
    } finally {
      setPinSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F7FA] pb-24">
      {/* Top Bar */}
      <header className="bg-white border-b border-[#E2E8F0] sticky top-0 z-20">
        <div className="max-w-[760px] mx-auto px-4 h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <EduflowLogo dark={false} compact />
            <div className="min-w-0">
              <span className="text-sm font-bold text-[#0F2A4A] block truncate">
                منصة الطالب — {student.name}
              </span>
              <span className="text-[11px] text-[#5B6B80] block truncate">
                {centerSettings.name} · <span className="tabular-nums" dir="ltr">{student.code}</span>
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={logoutStudent}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[8px] border border-[#E2E8F0] text-xs font-bold text-[#991B1B] hover:bg-red-50 cursor-pointer shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>خروج</span>
          </button>
        </div>
      </header>

      <main className="max-w-[760px] mx-auto px-4 py-5 space-y-5">
        {/* Tab 1: الرئيسية */}
        {tab === 'home' && (
          <div className="space-y-4">
            <div className="p-5 rounded-[12px] bg-[#0F2A4A] text-white space-y-3">
              <div className="flex items-center gap-3">
                <InitialAvatar name={student.name} tint="#0F766E" />
                <div className="min-w-0">
                  <h1 className="text-lg font-bold truncate">أهلاً يا {student.name}</h1>
                  <p className="text-xs text-slate-300">
                    {student.stage} · نسبة حضورك{' '}
                    <span className="font-bold text-teal-300 tabular-nums">
                      {student.attendanceRate}%
                    </span>
                  </p>
                </div>
              </div>
              {studentGroups.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {studentGroups.map((g) => (
                    <span
                      key={g.id}
                      className="px-2.5 py-1 rounded-[8px] bg-white/10 text-xs font-semibold text-white"
                    >
                      {g.name}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Today's / Upcoming Sessions */}
            <Card className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-[#0F2A4A] flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-[#0F766E]" />
                  <span>حصصك القادمة والحديثة</span>
                </h2>
                <span className="text-xs text-[#5B6B80] tabular-nums">
                  {studentGroups.length} مجموعات
                </span>
              </div>

              {studentSessionsSchedule.length === 0 ? (
                <p className="text-xs text-[#5B6B80]">لا توجد حصص مجدولة حالياً.</p>
              ) : (
                <div className="space-y-2">
                  {studentSessionsSchedule.slice(0, 4).map((sess) => {
                    const grp = groups.find((g) => g.id === sess.groupId);
                    return (
                      <div
                        key={sess.id}
                        className="p-3 rounded-[10px] bg-[#F4F7FA] border border-[#E2E8F0] flex items-center justify-between gap-2"
                      >
                        <div>
                          <p className="text-sm font-bold text-[#0F2A4A]">
                            {grp?.name || 'مجموعة'}
                          </p>
                          <p className="text-xs text-[#5B6B80] tabular-nums">
                            {sess.date} · {sess.timeLabel}
                          </p>
                        </div>
                        <StatusChip
                          tone={sess.status === 'recorded' ? 'success' : 'navy'}
                          label={sess.status === 'recorded' ? 'تم الرصد' : 'مجدولة'}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* New Lessons & Open Exams Preview Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card className="p-5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[#0F2A4A] flex items-center gap-2">
                    <PlayCircle className="w-4 h-4 text-[#0F766E]" />
                    <span>دروس جديدة</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => setTab('lessons')}
                    className="text-xs font-bold text-[#0F766E] hover:underline cursor-pointer"
                  >
                    عرض الكل
                  </button>
                </div>
                <p className="text-xs text-[#5B6B80] leading-relaxed">
                  ستظهر هنا محاضرات الفيديو والملفات المرفوعة لمجموعاتك فور إتاحتها.
                </p>
              </Card>

              <Card className="p-5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[#0F2A4A] flex items-center gap-2">
                    <ClipboardList className="w-4 h-4 text-[#0F766E]" />
                    <span>امتحانات مفتوحة</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => setTab('exams')}
                    className="text-xs font-bold text-[#0F766E] hover:underline cursor-pointer"
                  >
                    عرض الكل
                  </button>
                </div>
                <p className="text-xs text-[#5B6B80] leading-relaxed">
                  لا توجد اختبارات أونلاين مفتوحة الآن. راجع نتائج تقييماتك السابقة من تبويب الامتحانات.
                </p>
              </Card>
            </div>

            {/* Latest Assessment Results */}
            <Card className="p-5 space-y-3">
              <h2 className="text-base font-bold text-[#0F2A4A] flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#0F766E]" />
                <span>أحدث درجاتك ونتائجك</span>
              </h2>
              {studentAssessments.length === 0 ? (
                <p className="text-xs text-[#5B6B80]">لا توجد درجات امتحانات مرصودة بعد.</p>
              ) : (
                <div className="space-y-2">
                  {studentAssessments.slice(0, 3).map((as) => {
                    const gr = as.grades.find((g) => g.studentId === student.id);
                    const grp = groups.find((g) => g.id === as.groupId);
                    return (
                      <div
                        key={as.id}
                        className="p-3 rounded-[10px] border border-[#E2E8F0] flex items-center justify-between gap-3"
                      >
                        <div>
                          <p className="text-sm font-bold text-[#0F2A4A]">{as.title}</p>
                          <p className="text-xs text-[#5B6B80]">
                            {grp?.subject || 'مادة'} · {as.date}
                          </p>
                        </div>
                        <div className="text-left shrink-0">
                          {gr?.absent ? (
                            <StatusChip tone="danger" label="غائب" />
                          ) : gr?.score !== null && gr?.score !== undefined ? (
                            <span className="text-base font-bold text-[#0F766E] tabular-nums">
                              {gr.score} / {as.maxScore}
                            </span>
                          ) : (
                            <StatusChip tone="neutral" label="قيد التصحيح" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Tab 2: الدروس */}
        {tab === 'lessons' && (
          <div className="space-y-4">
            <h1 className="text-lg font-bold text-[#0F2A4A]">الدروس المسجلة والمواد التعليمية</h1>
            <EmptyState
              title="لا توجد دروس فيديو منشورة بعد"
              description="عند قيام مدرس مجموعتك بنشر الحصص المسجلة أو ملفات الشرح، ستظهر هنا مرتبة حسب كل مادة."
            />
            {studentGroups.length > 0 && (
              <Card className="p-5 space-y-3">
                <h2 className="text-sm font-bold text-[#0F2A4A]">مجموعاتك المشترك بها</h2>
                <div className="space-y-2">
                  {studentGroups.map((g) => (
                    <div
                      key={g.id}
                      className="p-3 rounded-[8px] bg-[#F4F7FA] border border-[#E2E8F0] flex items-center justify-between text-xs"
                    >
                      <span className="font-bold text-[#0F2A4A]">{g.name}</span>
                      <span className="text-[#5B6B80]">{g.subject}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}

        {/* Tab 3: الامتحانات */}
        {tab === 'exams' && (
          <div className="space-y-4">
            <h1 className="text-lg font-bold text-[#0F2A4A]">الامتحانات والنتائج</h1>

            {studentAssessments.length === 0 ? (
              <EmptyState
                title="لا توجد امتحانات أو درجات مسجلة بعد"
                description="ستظهر هنا الامتحانات الإلكترونية المتاحة وكذلك نتائج تقييماتك داخل السنتر."
              />
            ) : (
              <div className="space-y-3">
                {studentAssessments.map((as) => {
                  const gr = as.grades.find((g) => g.studentId === student.id);
                  const grp = groups.find((g) => g.id === as.groupId);
                  return (
                    <Card key={as.id} className="p-4 flex items-center justify-between gap-3">
                      <div>
                        <span className="text-xs text-[#5B6B80]">
                          {grp?.name} · {as.date}
                        </span>
                        <h3 className="text-sm font-bold text-[#0F2A4A] mt-0.5">{as.title}</h3>
                        <span className="text-[11px] text-[#5B6B80]">{as.type}</span>
                      </div>
                      <div className="text-left shrink-0">
                        {gr?.absent ? (
                          <StatusChip tone="danger" label="غائب" />
                        ) : gr?.score !== null && gr?.score !== undefined ? (
                          <span className="text-lg font-bold text-[#0F766E] tabular-nums">
                            {gr.score} / {as.maxScore}
                          </span>
                        ) : (
                          <StatusChip tone="neutral" label="قيد التصحيح" />
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 4: حضوري */}
        {tab === 'attendance' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Card className="p-4">
                <span className="text-xs text-[#5B6B80]">نسبة الحضور</span>
                <span className="text-2xl font-bold text-[#0F766E] tabular-nums block mt-1">
                  {student.attendanceRate}%
                </span>
              </Card>
              <Card className="p-4">
                <span className="text-xs text-[#5B6B80]">إجمالي الحصص المسجلة</span>
                <span className="text-2xl font-bold text-[#0F2A4A] tabular-nums block mt-1">
                  {studentAttendanceRows.length}
                </span>
              </Card>
              <Card className="p-4 col-span-2 sm:col-span-1">
                <span className="text-xs text-[#5B6B80]">آخر حضور</span>
                <span className="text-sm font-bold text-[#0F2A4A] tabular-nums block mt-2">
                  {student.lastAttendance}
                </span>
              </Card>
            </div>

            {studentAttendanceRows.length === 0 ? (
              <EmptyState
                title="لا يوجد سجل حضور مسجل بعد"
                description="عند حضور الحصص سيتم عرض تفاصيل التاريخ والمجموعة وطريقة التسجيل هنا."
              />
            ) : (
              <Card padding="p-0" className="overflow-hidden divide-y divide-[#E2E8F0]">
                {studentAttendanceRows.map(({ session, groupName, status, method, compensatedBy, note }) => (
                  <div
                    key={session.id}
                    className="p-4 flex flex-wrap items-center justify-between gap-2"
                  >
                    <div>
                      <p className="text-sm font-bold text-[#0F2A4A]">{groupName}</p>
                      <p className="text-xs text-[#5B6B80] tabular-nums">
                        {session.date} · {session.timeLabel}
                      </p>
                      {note && <p className="text-[11px] text-[#5B6B80] mt-0.5">{note}</p>}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {status === 'present' && <StatusChip tone="success" label="حاضر" />}
                      {status === 'late' && <StatusChip tone="warning" label="متأخر" />}
                      {status === 'absent' && <StatusChip tone="danger" label="غائب" />}
                      {status === 'unrecorded' && <StatusChip tone="neutral" label="مجدولة" />}
                      {method === 'qr' && <StatusChip tone="navy" label="QR" />}
                      {method === 'face' && <StatusChip tone="navy" label="بصمة" />}
                      {compensatedBy && <StatusChip tone="success" label="تم التعويض" />}
                    </div>
                  </div>
                ))}
              </Card>
            )}
          </div>
        )}

        {/* Tab 5: حسابي */}
        {tab === 'account' && (
          <div className="space-y-4">
            <Card className="p-5 space-y-3">
              <div className="flex items-center gap-3">
                <InitialAvatar name={student.name} tint="#0F2A4A" />
                <div>
                  <h2 className="text-base font-bold text-[#0F2A4A]">{student.name}</h2>
                  <p className="text-xs text-[#5B6B80]">
                    {student.stage} · كود الطالب:{' '}
                    <span className="font-bold text-[#0F2A4A] tabular-nums" dir="ltr">
                      {student.code}
                    </span>
                  </p>
                </div>
              </div>
              <div className="pt-2 border-t border-[#E2E8F0] grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[#5B6B80]">ولي الأمر: </span>
                  <strong className="text-[#0F2A4A]">{student.parentName}</strong>
                </div>
                <div>
                  <span className="text-[#5B6B80]">هاتف ولي الأمر: </span>
                  <strong className="text-[#0F2A4A] tabular-nums" dir="ltr">
                    {student.parentPhone}
                  </strong>
                </div>
              </div>
            </Card>

            {/* Change PIN Card */}
            <Card className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-[#0F2A4A]">تغيير رمز المرور (PIN)</h3>
                <button
                  type="button"
                  onClick={() => setShowPins((v) => !v)}
                  className="text-xs font-bold text-[#0F766E] inline-flex items-center gap-1 cursor-pointer"
                >
                  {showPins ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{showPins ? 'إخفاء' : 'إظهار'}</span>
                </button>
              </div>

              {pinError && (
                <div
                  role="alert"
                  className="p-3 rounded-[8px] bg-[#FEE2E2] text-[#991B1B] text-xs font-bold"
                >
                  {pinError}
                </div>
              )}
              {pinSuccess && (
                <div
                  role="status"
                  className="p-3 rounded-[8px] bg-[#D1FAE5] text-[#065F46] text-xs font-bold flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{pinSuccess}</span>
                </div>
              )}

              <form onSubmit={handleChangePin} className="space-y-3">
                <Field label="رمز المرور الحالي" htmlFor="sp-old-pin">
                  <TextInput
                    id="sp-old-pin"
                    type={showPins ? 'text' : 'password'}
                    dir="ltr"
                    className="text-right tabular-nums"
                    value={oldPin}
                    onChange={(e) => {
                      setOldPin(e.target.value);
                      setPinError('');
                      setPinSuccess('');
                    }}
                  />
                </Field>
                <Field label="رمز المرور الجديد (4-6 أرقام)" htmlFor="sp-new-pin">
                  <TextInput
                    id="sp-new-pin"
                    type={showPins ? 'text' : 'password'}
                    dir="ltr"
                    className="text-right tabular-nums"
                    value={newPin}
                    onChange={(e) => {
                      setNewPin(e.target.value);
                      setPinError('');
                      setPinSuccess('');
                    }}
                  />
                </Field>
                <Field label="تأكيد رمز المرور الجديد" htmlFor="sp-confirm-pin">
                  <TextInput
                    id="sp-confirm-pin"
                    type={showPins ? 'text' : 'password'}
                    dir="ltr"
                    className="text-right tabular-nums"
                    value={confirmPin}
                    onChange={(e) => {
                      setConfirmPin(e.target.value);
                      setPinError('');
                      setPinSuccess('');
                    }}
                  />
                </Field>
                <Button type="submit" loading={pinSaving}>
                  تحديث رمز المرور
                </Button>
              </form>
            </Card>

            {/* Active Devices Card */}
            <Card className="p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-[#0F2A4A]">
                    الأجهزة النشطة ({activeDevices.length} / {centerSettings.studentMaxDevices || 2})
                  </h3>
                  <p className="text-xs text-[#5B6B80]">
                    جلسة الدخول تستمر لمدة {centerSettings.studentSessionDays || 7} أيام على كل جهاز
                  </p>
                </div>
                {activeDevices.length > 0 && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => revokeAllStudentPortalSessions(student.id)}
                  >
                    تسجيل الخروج من جميع الأجهزة
                  </Button>
                )}
              </div>

              <div className="space-y-2.5">
                {activeDevices.map((dev) => {
                  const isCurrent = dev.id === studentAuthSession.studentSessionId;
                  return (
                    <div
                      key={dev.id}
                      className="p-3.5 rounded-[10px] bg-[#F4F7FA] border border-[#E2E8F0] flex flex-wrap items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5">
                        {dev.deviceLabel.includes('موبايل') ? (
                          <Smartphone className="w-4 h-4 text-[#0F766E]" />
                        ) : (
                          <Laptop className="w-4 h-4 text-[#0F2A4A]" />
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[#0F2A4A]">
                              {dev.deviceLabel}
                            </span>
                            {isCurrent && <StatusChip tone="success" label="هذا الجهاز" />}
                          </div>
                          <p className="text-[11px] text-[#5B6B80] tabular-nums">
                            دخول: {formatIsoToDDMMYYYY(dev.createdAt)} · انتهاء:{' '}
                            {formatIsoToDDMMYYYY(dev.expiresAt)}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => revokeSingleStudentPortalSession(dev.id)}
                      >
                        إنهاء الجلسة
                      </Button>
                    </div>
                  );
                })}
              </div>

              <div className="pt-2 border-t border-[#E2E8F0]">
                <Button
                  variant="secondary"
                  icon={<LogOut className="w-4 h-4 text-[#991B1B]" />}
                  onClick={logoutStudent}
                  className="w-full"
                >
                  تسجيل الخروج من هذا الجهاز
                </Button>
              </div>
            </Card>
          </div>
        )}
      </main>

      {/* Bottom 5-Tab Bar */}
      <nav
        aria-label="تنقل منصة الطالب"
        className="fixed bottom-0 inset-x-0 h-16 bg-white border-t border-[#E2E8F0] z-20"
      >
        <div className="max-w-[760px] mx-auto h-full grid grid-cols-5">
          {(
            [
              { id: 'home', label: 'الرئيسية', icon: <Home className="w-5 h-5" /> },
              { id: 'lessons', label: 'الدروس', icon: <PlayCircle className="w-5 h-5" /> },
              { id: 'exams', label: 'الامتحانات', icon: <ClipboardList className="w-5 h-5" /> },
              { id: 'attendance', label: 'حضوري', icon: <CheckSquare className="w-5 h-5" /> },
              { id: 'account', label: 'حسابي', icon: <User className="w-5 h-5" /> },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`flex flex-col items-center justify-center gap-1 text-[11px] font-bold cursor-pointer ${
                tab === item.id ? 'text-[#0F766E]' : 'text-[#5B6B80]'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
};
