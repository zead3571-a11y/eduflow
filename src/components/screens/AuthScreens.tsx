import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  Plus,
  Trash2,
} from 'lucide-react';
import { useEduflow } from '../../context/EduflowContext';
import { ScreenId, UserRole } from '../../types/eduflow';
import {
  Button,
  Card,
  EduflowLogo,
  Field,
  SelectInput,
  TextInput,
} from '../ui/Primitives';

// 1) Login & Password Recovery
export const LoginScreen: React.FC = () => {
  const { navigate, loginWithCredentials, resetPasswordByEmail, showToast } = useEduflow();

  const [mode, setMode] = useState<'login' | 'forgot' | 'sent' | 'reset'>('login');
  const [identifier, setIdentifier] = useState('mahmoud@el-nokhba.eg');
  const [password, setPassword] = useState('EduFlow@2026');
  const [showPass, setShowPass] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ identifier?: string; password?: string }>({});

  // Forgot & Reset state
  const [resetEmail, setResetEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [resetError, setResetError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    const errs: { identifier?: string; password?: string } = {};
    if (!identifier.trim()) {
      errs.identifier = 'أدخل رقم الموبايل أو البريد الإلكتروني.';
    }
    if (!password.trim()) {
      errs.password = 'أدخل كلمة السر.';
    } else if (password.length < 6) {
      errs.password = 'كلمة السر يجب ألا تقل عن 6 أحرف.';
    }
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    setLoading(true);
    try {
      const result = await loginWithCredentials(identifier, password);
      if (!result.ok) {
        setAuthError(result.error || 'بيانات الدخول غير صحيحة.');
      }
    } catch {
      setAuthError('حدث خطأ غير متوقع أثناء التحقق من بيانات الدخول.');
    } finally {
      setLoading(false);
    }
  };

  const passwordStrength = (() => {
    if (!newPassword) return { score: 0, label: 'لم يتم الإدخال', color: 'bg-slate-200' };
    let s = 1;
    if (newPassword.length >= 8) s++;
    if (/[A-Z]/.test(newPassword) && /[0-9]/.test(newPassword)) s++;
    if (/[^A-Za-z0-9]/.test(newPassword)) s++;
    if (s <= 1) return { score: 1, label: 'ضعيفة', color: 'bg-[#DC2626]' };
    if (s === 2) return { score: 2, label: 'متوسطة', color: 'bg-amber-500' };
    return { score: 3, label: 'قوية وآمنة', color: 'bg-[#0F766E]' };
  })();

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#F4F7FA]">
      {/* Right Side (first child in RTL): Navy Brand Panel */}
      <div className="lg:w-[46%] bg-[#0F2A4A] text-white p-8 lg:p-14 flex flex-col justify-between">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate(ScreenId.LANDING)}
            className="cursor-pointer text-right"
          >
            <EduflowLogo dark />
          </button>
          <button
            type="button"
            onClick={() => navigate(ScreenId.LANDING)}
            className="text-xs font-bold text-slate-300 hover:text-white inline-flex items-center gap-1 cursor-pointer"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            <span>الصفحة الرئيسية</span>
          </button>
        </div>

        <div className="my-10 lg:my-0 space-y-5 max-w-md">
          <h1 className="text-2xl lg:text-4xl font-bold leading-tight">
            كل سنترك في مكان واحد
          </h1>
          <p className="text-sm lg:text-base text-slate-300 leading-relaxed">
            منصة عربية مصممة خصيصاً لإدارة السناتر والمراكز التعليمية في مصر: تسجيل حضور سريع بالموبايل، متابعة المدفوعات والمتأخرات، جدول القاعات بدون تعارض، وبوابة أولياء الأمور.
          </p>

          <div className="pt-4 grid grid-cols-3 gap-4 border-t border-white/15 text-right">
            <div>
              <span className="text-xl font-bold text-white tabular-nums block">100%</span>
              <span className="text-xs text-slate-300">دعم عربي RTL</span>
            </div>
            <div>
              <span className="text-xl font-bold text-white tabular-nums block">3 ثوانٍ</span>
              <span className="text-xs text-slate-300">لتسجيل حضور الطالب</span>
            </div>
            <div>
              <span className="text-xl font-bold text-white tabular-nums block">24/7</span>
              <span className="text-xs text-slate-300">متابعة أولياء الأمور</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
          <span>EDUFLOW لإدارة المراكز التعليمية — مصر</span>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => navigate(ScreenId.STUDENT_LOGIN)}
              className="text-teal-300 hover:underline font-semibold cursor-pointer"
            >
              دخول منصة الطالب
            </button>
            <button
              type="button"
              onClick={() => navigate(ScreenId.PARENT_PORTAL)}
              className="text-teal-300 hover:underline font-semibold cursor-pointer"
            >
              بوابة أولياء الأمور
            </button>
          </div>
        </div>
      </div>

      {/* Left Side: White Form Card */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <Card className="w-full max-w-md p-6 sm:p-8 shadow-xs">
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-5" noValidate>
              <div>
                <h2 className="text-[24px] font-bold text-[#0F2A4A]">تسجيل الدخول</h2>
                <p className="text-xs text-[#5B6B80] mt-1">
                  أدخل بيانات حسابك للوصول إلى لوحة إدارة السنتر
                </p>
              </div>

              {authError && (
                <div
                  role="alert"
                  className="p-3.5 rounded-[8px] bg-[#FEE2E2] border border-red-200 text-[#991B1B] text-xs font-bold flex items-start gap-2"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{authError}</span>
                </div>
              )}

              <Field
                label="رقم الموبايل أو البريد الإلكتروني"
                htmlFor="login-id"
                error={fieldErrors.identifier}
              >
                <TextInput
                  id="login-id"
                  dir="ltr"
                  className="text-right"
                  placeholder="01001122334 أو name@center.eg"
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    setFieldErrors((p) => ({ ...p, identifier: undefined }));
                  }}
                  hasError={Boolean(fieldErrors.identifier)}
                />
              </Field>

              <Field
                label="كلمة السر"
                htmlFor="login-password"
                error={fieldErrors.password}
              >
                <div className="relative">
                  <TextInput
                    id="login-password"
                    type={showPass ? 'text' : 'password'}
                    dir="ltr"
                    className="text-right pl-11"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setFieldErrors((p) => ({ ...p, password: undefined }));
                    }}
                    hasError={Boolean(fieldErrors.password)}
                  />
                  <button
                    type="button"
                    aria-label={showPass ? 'إخفاء كلمة السر' : 'إظهار كلمة السر'}
                    onClick={() => setShowPass((s) => !s)}
                    className="absolute left-3 top-3 text-[#5B6B80] hover:text-[#1E293B] cursor-pointer"
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </Field>

              <div className="flex items-center justify-between text-xs">
                <label className="inline-flex items-center gap-2 cursor-pointer text-[#1E293B] font-medium">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 accent-[#0F766E] rounded"
                  />
                  <span>تذكرني على هذا الجهاز</span>
                </label>

                <button
                  type="button"
                  onClick={() => setMode('forgot')}
                  className="font-bold text-[#0F766E] hover:underline cursor-pointer"
                >
                  نسيت كلمة السر؟
                </button>
              </div>

              <Button type="submit" loading={loading} className="w-full">
                دخول
              </Button>

              <div className="pt-4 border-t border-[#E2E8F0] space-y-3 text-center text-xs">
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-[#5B6B80] block">
                    حسابات تجريبية (كلمة السر الموحدة: EduFlow@2026):
                  </span>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                    {[
                      { role: UserRole.OWNER, email: 'mahmoud@el-nokhba.eg', label: 'المالك' },
                      { role: UserRole.ADMIN, email: 'eman.admin@el-nokhba.eg', label: 'المدير' },
                      { role: UserRole.ACCOUNTANT, email: 'adel.finance@el-nokhba.eg', label: 'المحاسب' },
                      { role: UserRole.RECEPTIONIST, email: 'nada.desk@el-nokhba.eg', label: 'ريسبشن' },
                      { role: UserRole.TEACHER, email: 'm.abdelsalam@el-nokhba.eg', label: 'المدرس' },
                      { role: UserRole.PARENT, email: '01002349871', label: 'ولي أمر' },
                    ].map((preset) => (
                      <button
                        key={preset.role}
                        type="button"
                        onClick={async () => {
                          setAuthError('');
                          setFieldErrors({});
                          setIdentifier(preset.email);
                          setPassword('EduFlow@2026');
                          setLoading(true);
                          const res = await loginWithCredentials(preset.email, 'EduFlow@2026');
                          setLoading(false);
                          if (!res.ok) setAuthError(res.error || 'تعذر تسجيل الدخول.');
                        }}
                        className="py-1.5 px-2 rounded-[6px] border border-[#E2E8F0] bg-[#F4F7FA] hover:bg-[#0F766E]/10 hover:border-[#0F766E] text-[#0F2A4A] font-bold transition-colors cursor-pointer"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="text-[#5B6B80] pt-1">
                  سنتر جديد على المنصة؟{' '}
                  <button
                    type="button"
                    onClick={() => navigate(ScreenId.ONBOARDING)}
                    className="font-bold text-[#0F2A4A] hover:text-[#0F766E] underline cursor-pointer"
                  >
                    إنشاء حساب وإعداد السنتر
                  </button>
                </div>
              </div>
            </form>
          )}

          {mode === 'forgot' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!resetEmail.trim() || !resetEmail.includes('@')) {
                  setResetError('يرجى إدخال بريد إلكتروني صحيح.');
                  return;
                }
                setResetError('');
                setMode('sent');
              }}
              className="space-y-5"
            >
              <div>
                <h2 className="text-xl font-bold text-[#0F2A4A]">استعادة كلمة السر</h2>
                <p className="text-xs text-[#5B6B80] mt-1">
                  أدخل بريدك الإلكتروني المسجل وسنرسل لك رابط تعيين كلمة سر جديدة.
                </p>
              </div>

              <Field label="البريد الإلكتروني" htmlFor="reset-email" error={resetError}>
                <TextInput
                  id="reset-email"
                  type="email"
                  dir="ltr"
                  className="text-right"
                  placeholder="name@center.eg"
                  value={resetEmail}
                  onChange={(e) => {
                    setResetEmail(e.target.value);
                    setResetError('');
                  }}
                  hasError={Boolean(resetError)}
                />
              </Field>

              <Button type="submit" className="w-full">
                إرسال رابط الاستعادة
              </Button>

              <button
                type="button"
                onClick={() => setMode('login')}
                className="w-full text-center text-xs font-bold text-[#5B6B80] hover:text-[#0F2A4A] cursor-pointer"
              >
                العودة لتسجيل الدخول
              </button>
            </form>
          )}

          {mode === 'sent' && (
            <div className="space-y-5 text-center py-2">
              <div className="w-12 h-12 rounded-full bg-[#D1FAE5] text-[#065F46] flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#0F2A4A]">تم إرسال رابط الاستعادة</h2>
                <p className="text-xs text-[#5B6B80] mt-1.5 leading-relaxed">
                  أرسلنا رسالة إلى <strong>{resetEmail}</strong> تحتوي على رابط صالح لمدة 30 دقيقة لإعادة تعيين كلمة السر.
                </p>
              </div>
              <Button onClick={() => setMode('reset')} className="w-full">
                متابعة لتعيين كلمة سر جديدة
              </Button>
              <button
                type="button"
                onClick={() => setMode('login')}
                className="text-xs font-bold text-[#5B6B80] hover:text-[#0F2A4A] cursor-pointer"
              >
                العودة لتسجيل الدخول
              </button>
            </div>
          )}

          {mode === 'reset' && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (newPassword.length < 8) {
                  setResetError('كلمة السر الجديدة يجب أن تتكون من 8 أحرف على الأقل.');
                  return;
                }
                if (newPassword !== confirmNewPassword) {
                  setResetError('تأكيد كلمة السر غير مطابق.');
                  return;
                }
                const res = await resetPasswordByEmail(resetEmail, newPassword);
                if (!res.ok) {
                  setResetError(res.error || 'تعذر تحديث كلمة السر.');
                  return;
                }
                setIdentifier(resetEmail);
                setPassword('');
                setNewPassword('');
                setConfirmNewPassword('');
                setMode('login');
              }}
              className="space-y-4"
            >
              <div>
                <h2 className="text-lg font-bold text-[#0F2A4A]">تعيين كلمة سر جديدة</h2>
                <p className="text-xs text-[#5B6B80] mt-1">
                  اختر كلمة سر قوية تحتوي على أحرف كبيرة وأرقام.
                </p>
              </div>

              <Field label="كلمة السر الجديدة" htmlFor="new-pass" error={resetError}>
                <TextInput
                  id="new-pass"
                  type="password"
                  dir="ltr"
                  className="text-right"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    setResetError('');
                  }}
                />
              </Field>

              {/* Password Strength Hint */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#5B6B80]">قوة كلمة السر:</span>
                  <span className="font-bold text-[#1E293B]">{passwordStrength.label}</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 h-1.5">
                  {[1, 2, 3].map((bar) => (
                    <div
                      key={bar}
                      className={`rounded-full ${
                        passwordStrength.score >= bar ? passwordStrength.color : 'bg-slate-200'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <Field label="تأكيد كلمة السر الجديدة" htmlFor="confirm-new-pass">
                <TextInput
                  id="confirm-new-pass"
                  type="password"
                  dir="ltr"
                  className="text-right"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                />
              </Field>

              <Button type="submit" className="w-full">
                حفظ كلمة السر والدخول
              </Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
};

// 2) 3-Step Onboarding Wizard
export const OnboardingScreen: React.FC = () => {
  const { navigate, registerCenterOwner, showToast } = useEduflow();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSignupPass, setShowSignupPass] = useState(false);

  // Step 1: Account
  const [ownerName, setOwnerName] = useState('أ. محمود عبد الرحمن');
  const [ownerPhone, setOwnerPhone] = useState('01001122334');
  const [ownerEmail, setOwnerEmail] = useState('mahmoud@el-nokhba.eg');
  const [pass, setPass] = useState('EduFlow@2026');
  const [passConfirm, setPassConfirm] = useState('EduFlow@2026');

  // Step 2: Center Info
  const [centerName, setCenterName] = useState('سنتر النخبة التعليمي');
  const [governorate, setGovernorate] = useState('القاهرة');
  const [city, setCity] = useState('مدينة نصر');
  const [centerPhone, setCenterPhone] = useState('01001122334');
  const [selectedStages, setSelectedStages] = useState<string[]>(['إعدادي', 'ثانوي']);

  // Step 3: First Setup (Rooms + Optional First Teacher)
  const [wizardRooms, setWizardRooms] = useState<{ name: string; capacity: string }[]>([
    { name: 'قاعة 1 - الرئيسية', capacity: '50' },
    { name: 'قاعة 2 - المعمل', capacity: '35' },
  ]);
  const [firstTeacherName, setFirstTeacherName] = useState('');
  const [firstTeacherSubject, setFirstTeacherSubject] = useState('فيزياء');
  const [firstTeacherPhone, setFirstTeacherPhone] = useState('');

  const toggleStage = (st: string) => {
    setSelectedStages((prev) =>
      prev.includes(st) ? prev.filter((x) => x !== st) : [...prev, st]
    );
  };

  const handleNext = async () => {
    setError('');
    if (step === 1) {
      if (!ownerName.trim() || !ownerPhone.trim() || !ownerEmail.trim()) {
        setError('يرجى استكمال جميع حقول الحساب الأساسية.');
        return;
      }
      if (pass.length < 6 || pass !== passConfirm) {
        setError('تأكد من إدخال كلمة سر من 6 أحرف على الأقل وتطابق التأكيد.');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!centerName.trim() || !city.trim()) {
        setError('يرجى إدخال اسم السنتر والمدينة.');
        return;
      }
      if (selectedStages.length === 0) {
        setError('يرجى اختيار مرحلة دراسية واحدة على الأقل.');
        return;
      }
      setStep(3);
    } else if (step === 3) {
      if (wizardRooms.some((r) => !r.name.trim())) {
        setError('يرجى كتابة اسم لكل قاعة مضافة.');
        return;
      }
      setLoading(true);
      try {
        await registerCenterOwner({
          ownerName,
          ownerPhone,
          ownerEmail,
          password: pass,
          centerName: centerName.trim(),
          governorate,
          city: city.trim(),
          centerPhone: centerPhone.trim(),
          stages: selectedStages,
          rooms: wizardRooms
            .filter((rm) => rm.name.trim())
            .map((rm) => ({ name: rm.name.trim(), capacity: Number(rm.capacity) || 40 })),
          firstTeacher: firstTeacherName.trim()
            ? {
                name: firstTeacherName.trim(),
                subject: firstTeacherSubject,
                phone: firstTeacherPhone.trim() || '01000000000',
              }
            : undefined,
        });
        setStep(4);
      } catch {
        setError('تعذر إتمام إعداد الحساب حالياً. يرجى المحاولة مرة أخرى.');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F7FA] flex flex-col">
      <header className="h-16 bg-white border-b border-[#E2E8F0] px-4 sm:px-6 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate(ScreenId.LANDING)}
          className="cursor-pointer"
        >
          <EduflowLogo dark={false} />
        </button>
        <div className="flex items-center gap-4 text-xs font-bold">
          <button
            type="button"
            onClick={() => navigate(ScreenId.LANDING)}
            className="text-[#5B6B80] hover:text-[#0F2A4A] cursor-pointer"
          >
            الصفحة الرئيسية
          </button>
          <button
            type="button"
            onClick={() => navigate(ScreenId.LOGIN)}
            className="text-[#0F766E] hover:underline cursor-pointer"
          >
            لديك حساب بالفعل؟ تسجيل الدخول
          </button>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-2xl space-y-6">
          {/* Progress Bar */}
          {step < 4 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className={step >= 1 ? 'text-[#0F766E]' : 'text-[#5B6B80]'}>
                  1. بيانات الحساب
                </span>
                <span className={step >= 2 ? 'text-[#0F766E]' : 'text-[#5B6B80]'}>
                  2. بيانات السنتر
                </span>
                <span className={step >= 3 ? 'text-[#0F766E]' : 'text-[#5B6B80]'}>
                  3. القاعات وأول مدرس
                </span>
              </div>
              <div className="h-2 rounded-full bg-[#E2E8F0] overflow-hidden">
                <div
                  className="h-full bg-[#0F766E] transition-all duration-200"
                  style={{ width: `${(step / 3) * 100}%` }}
                />
              </div>
            </div>
          )}

          <Card className="p-6 sm:p-8">
            {error && (
              <div
                role="alert"
                className="mb-4 p-3 rounded-[8px] bg-[#FEE2E2] text-[#991B1B] text-xs font-bold flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <h1 className="text-xl font-bold text-[#0F2A4A]">إنشاء حساب مالك السنتر</h1>
                  <p className="text-xs text-[#5B6B80] mt-1">
                    ابدأ بإعداد حساب المدير العام للتحكم في الفروع والمستخدمين
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="الاسم الكامل" htmlFor="ob-name" required>
                    <TextInput
                      id="ob-name"
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                    />
                  </Field>
                  <Field label="رقم الموبايل" htmlFor="ob-phone" required>
                    <TextInput
                      id="ob-phone"
                      dir="ltr"
                      className="text-right tabular-nums"
                      value={ownerPhone}
                      onChange={(e) => setOwnerPhone(e.target.value)}
                    />
                  </Field>
                </div>
                <Field label="البريد الإلكتروني" htmlFor="ob-email" required>
                  <TextInput
                    id="ob-email"
                    type="email"
                    dir="ltr"
                    className="text-right"
                    value={ownerEmail}
                    onChange={(e) => setOwnerEmail(e.target.value)}
                  />
                </Field>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="كلمة السر" htmlFor="ob-pass" required>
                    <div className="relative">
                      <TextInput
                        id="ob-pass"
                        type={showSignupPass ? 'text' : 'password'}
                        dir="ltr"
                        className="text-right pl-11"
                        value={pass}
                        onChange={(e) => setPass(e.target.value)}
                      />
                      <button
                        type="button"
                        aria-label={showSignupPass ? 'إخفاء كلمة السر' : 'إظهار كلمة السر'}
                        onClick={() => setShowSignupPass((s) => !s)}
                        className="absolute left-3 top-3 text-[#5B6B80] hover:text-[#1E293B] cursor-pointer"
                      >
                        {showSignupPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </Field>
                  <Field label="تأكيد كلمة السر" htmlFor="ob-pass-confirm" required>
                    <TextInput
                      id="ob-pass-confirm"
                      type={showSignupPass ? 'text' : 'password'}
                      dir="ltr"
                      className="text-right"
                      value={passConfirm}
                      onChange={(e) => setPassConfirm(e.target.value)}
                    />
                  </Field>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <h1 className="text-xl font-bold text-[#0F2A4A]">بيانات السنتر التعليمي</h1>
                  <p className="text-xs text-[#5B6B80] mt-1">
                    تظهر هذه البيانات على إيصالات الدفع وبوابة أولياء الأمور
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="اسم السنتر" htmlFor="ob-cname" required>
                    <TextInput
                      id="ob-cname"
                      value={centerName}
                      onChange={(e) => setCenterName(e.target.value)}
                    />
                  </Field>
                  <Field label="هاتف الاستقبال بالسنتر" htmlFor="ob-cphone" required>
                    <TextInput
                      id="ob-cphone"
                      dir="ltr"
                      className="text-right tabular-nums"
                      value={centerPhone}
                      onChange={(e) => setCenterPhone(e.target.value)}
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="المحافظة" htmlFor="ob-gov" required>
                    <SelectInput
                      id="ob-gov"
                      value={governorate}
                      onChange={(e) => setGovernorate(e.target.value)}
                    >
                      {['القاهرة', 'الجيزة', 'الإسكندرية', 'الدقهلية', 'الشرقية', 'الغربية', 'أسيوط'].map(
                        (g) => (
                          <option key={g} value={g}>
                            {g}
                          </option>
                        )
                      )}
                    </SelectInput>
                  </Field>
                  <Field label="المدينة / الحي" htmlFor="ob-city" required>
                    <TextInput
                      id="ob-city"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                    />
                  </Field>
                </div>

                <Field label="المراحل الدراسية المتاحة بالسنتر" required>
                  <div className="grid grid-cols-3 gap-3 pt-1">
                    {['ابتدائي', 'إعدادي', 'ثانوي'].map((st) => {
                      const active = selectedStages.includes(st);
                      return (
                        <label
                          key={st}
                          className={`flex items-center justify-center gap-2 h-11 rounded-[8px] border text-sm font-bold cursor-pointer transition-colors ${
                            active
                              ? 'border-[#0F766E] bg-[#0F766E]/10 text-[#0F766E]'
                              : 'border-[#E2E8F0] text-[#1E293B] hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={active}
                            onChange={() => toggleStage(st)}
                            className="w-4 h-4 accent-[#0F766E]"
                          />
                          <span>{st}</span>
                        </label>
                      );
                    })}
                  </div>
                </Field>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5">
                <div>
                  <h1 className="text-xl font-bold text-[#0F2A4A]">التجهيز الأولي للقاعات والمدرسين</h1>
                  <p className="text-xs text-[#5B6B80] mt-1">
                    أضف قاعات السنتر الحالية لتفعيل جدول المواعيد الذكي
                  </p>
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#0F2A4A]">قاعات السنتر</span>
                    <button
                      type="button"
                      onClick={() =>
                        setWizardRooms((prev) => [
                          ...prev,
                          { name: `قاعة ${prev.length + 1}`, capacity: '40' },
                        ])
                      }
                      className="inline-flex items-center gap-1 text-xs font-bold text-[#0F766E] hover:underline cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>إضافة قاعة</span>
                    </button>
                  </div>

                  {wizardRooms.map((rm, idx) => (
                    <div key={idx} className="flex items-center gap-2.5">
                      <TextInput
                        aria-label={`اسم القاعة ${idx + 1}`}
                        placeholder="اسم القاعة"
                        value={rm.name}
                        onChange={(e) =>
                          setWizardRooms((prev) =>
                            prev.map((item, i) =>
                              i === idx ? { ...item, name: e.target.value } : item
                            )
                          )
                        }
                      />
                      <TextInput
                        aria-label={`سعة القاعة ${idx + 1}`}
                        type="number"
                        placeholder="السعة"
                        className="w-28 tabular-nums"
                        value={rm.capacity}
                        onChange={(e) =>
                          setWizardRooms((prev) =>
                            prev.map((item, i) =>
                              i === idx ? { ...item, capacity: e.target.value } : item
                            )
                          )
                        }
                      />
                      {wizardRooms.length > 1 && (
                        <button
                          type="button"
                          aria-label="حذف القاعة"
                          onClick={() =>
                            setWizardRooms((prev) => prev.filter((_, i) => i !== idx))
                          }
                          className="w-11 h-11 rounded-[8px] border border-[#E2E8F0] text-[#991B1B] hover:bg-red-50 flex items-center justify-center shrink-0 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="pt-4 border-t border-[#E2E8F0] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#0F2A4A]">
                      إضافة أول مدرس (اختياري)
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setFirstTeacherName('');
                        handleNext();
                      }}
                      className="text-xs font-semibold text-[#5B6B80] hover:text-[#0F2A4A] underline cursor-pointer"
                    >
                      تخطي هذه الخطوة الآن
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <TextInput
                      placeholder="اسم المدرس (مثال: أ. طارق علي)"
                      value={firstTeacherName}
                      onChange={(e) => setFirstTeacherName(e.target.value)}
                    />
                    <TextInput
                      placeholder="المادة (فيزياء، رياضيات...)"
                      value={firstTeacherSubject}
                      onChange={(e) => setFirstTeacherSubject(e.target.value)}
                    />
                    <TextInput
                      dir="ltr"
                      className="text-right tabular-nums"
                      placeholder="رقم الهاتف"
                      value={firstTeacherPhone}
                      onChange={(e) => setFirstTeacherPhone(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="text-center space-y-6 py-3">
                <div className="w-14 h-14 rounded-full bg-[#D1FAE5] text-[#065F46] flex items-center justify-center mx-auto">
                  <Building2 className="w-7 h-7" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-[#0F2A4A]">
                    تم تجهيز «{centerName}» بنجاح!
                  </h1>
                  <p className="text-sm text-[#5B6B80] mt-1">
                    سنترك جاهز الآن لاستقبال الطلاب وتسجيل المجموعات والحصص اليومية.
                  </p>
                </div>

                <div className="text-right bg-[#F4F7FA] border border-[#E2E8F0] rounded-[10px] p-4 space-y-2.5 max-w-md mx-auto">
                  <p className="text-xs font-bold text-[#0F2A4A]">قائمة البداية السريعة:</p>
                  <div className="flex items-center gap-2 text-xs text-[#065F46] font-semibold">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>تم إنشاء حساب الإدارة وتحديد المراحل الدراسية</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[#065F46] font-semibold">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>تم تجهيز {wizardRooms.length} قاعات دراسية في الجدول</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[#5B6B80]">
                    <span className="w-4 h-4 rounded-full border border-slate-400 inline-block shrink-0" />
                    <span>أنشئ أول مجموعة دراسية وأضف الطلاب من لوحة التحكم</span>
                  </div>
                </div>

                <Button
                  onClick={() => {
                    showToast('أهلاً بك في لوحة تحكم السنتر');
                    navigate(ScreenId.DASHBOARD);
                  }}
                  className="w-full max-w-xs mx-auto"
                >
                  ادخل لوحة التحكم
                </Button>
              </div>
            )}

            {step < 4 && (
              <div className="mt-7 pt-4 border-t border-[#E2E8F0] flex items-center justify-between">
                {step > 1 ? (
                  <Button
                    variant="secondary"
                    onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}
                    icon={<ArrowRight className="w-4 h-4" />}
                  >
                    السابق
                  </Button>
                ) : (
                  <div />
                )}

                <Button
                  onClick={handleNext}
                  loading={loading}
                  icon={<ArrowLeft className="w-4 h-4" />}
                >
                  {step === 3 ? 'إنهاء الإعداد' : 'التالي'}
                </Button>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};
