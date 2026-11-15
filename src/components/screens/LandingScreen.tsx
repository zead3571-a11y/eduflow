import React from 'react';
import {
  ArrowLeft,
  CalendarCheck2,
  Check,
  CheckCircle2,
  FileText,
  Printer,
  ShieldCheck,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react';
import { useEduflow } from '../../context/EduflowContext';
import { ScreenId } from '../../types/eduflow';
import { SUBSCRIPTION_PLANS } from '../../data/seedData';
import { formatEGP } from '../../utils/eduflowLogic';
import { Button, Card, EduflowLogo } from '../ui/Primitives';

export const LandingScreen: React.FC = () => {
  const { navigate, centerSettings, students, sessions } = useEduflow();

  const activeStudentsCount = students.filter((s) => s.status === 'active').length;
  const todaySessionsCount = sessions.filter((s) => s.date === '2026-11-12').length;

  return (
    <div className="min-h-screen bg-[#F4F7FA] text-[#1E293B] flex flex-col">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-[#E2E8F0]">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-8">
            <EduflowLogo dark={false} />

            <nav aria-label="روابط الصفحة الرئيسية" className="hidden md:flex items-center gap-6 text-sm font-semibold text-[#5B6B80]">
              <a href="#features" className="hover:text-[#0F2A4A] transition-colors">
                المميزات
              </a>
              <a href="#pricing" className="hover:text-[#0F2A4A] transition-colors">
                الباقات والأسعار
              </a>
              <button
                type="button"
                onClick={() => navigate(ScreenId.PARENT_PORTAL)}
                className="hover:text-[#0F2A4A] transition-colors cursor-pointer"
              >
                بوابة أولياء الأمور
              </button>
              <button
                type="button"
                onClick={() => navigate(ScreenId.STUDENT_LOGIN)}
                className="hover:text-[#0F2A4A] transition-colors cursor-pointer"
              >
                بوابة الطالب
              </button>
              <button
                type="button"
                onClick={() => navigate(ScreenId.DASHBOARD)}
                className="hover:text-[#0F766E] text-[#0F2A4A] transition-colors cursor-pointer"
              >
                معاينة لوحة التحكم
              </button>
            </nav>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate(ScreenId.LOGIN)}
            >
              تسجيل الدخول
            </Button>
            <Button
              size="sm"
              onClick={() => navigate(ScreenId.ONBOARDING)}
            >
              إنشاء حساب
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-[#0F2A4A] text-white">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-12 lg:py-20 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="text-xs font-bold text-teal-300 tracking-wide">
              نظام إدارة المراكز والسناتر التعليمية في مصر
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-bold leading-tight text-white">
              كل سنترك في مكان واحد — حضور، تحصيل، وتقارير PDF جاهزة للمشاركة
            </h1>

            <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
              منصة عربية مصممة لمديري السناتر والمحاسبين ومشرفي الاستقبال: سجّل حضور الحصة بالموبايل في ثوانٍ، امنع تعارض القاعات والمدرسين، وأصدر تقارير مالية وسجلات حضور PDF واضحة لطباعتها ومشاركتها مع أولياء الأمور.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button
                onClick={() => navigate(ScreenId.ONBOARDING)}
                icon={<ArrowLeft className="w-4 h-4" />}
                className="px-6"
              >
                إنشاء حساب وإعداد سنترك
              </Button>
              <Button
                variant="secondary"
                onClick={() => navigate(ScreenId.LOGIN)}
                className="bg-white/10 text-white border-white/25 hover:bg-white/20"
              >
                تسجيل الدخول
              </Button>
              <button
                type="button"
                onClick={() => navigate(ScreenId.DASHBOARD)}
                className="text-sm font-bold text-teal-300 hover:underline px-2 py-2 cursor-pointer"
              >
                دخول تجريبي للوحة التحكم
              </button>
            </div>

            <div className="pt-6 border-t border-white/15 grid grid-cols-3 gap-4 max-w-lg">
              <div>
                <span className="text-2xl font-bold text-white tabular-nums block">3 ثوانٍ</span>
                <span className="text-xs text-slate-300">تسجيل حضور الطالب</span>
              </div>
              <div>
                <span className="text-2xl font-bold text-white tabular-nums block">PDF</span>
                <span className="text-xs text-slate-300">تقارير مالية وحضور فورية</span>
              </div>
              <div>
                <span className="text-2xl font-bold text-white tabular-nums block">100%</span>
                <span className="text-xs text-slate-300">عربي RTL ومناسب للموبايل</span>
              </div>
            </div>
          </div>

          {/* Crisp Operational Preview Surface */}
          <div className="lg:col-span-5">
            <div className="bg-white text-[#1E293B] rounded-[12px] border border-[#E2E8F0] shadow-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F4F7FA]">
                <div>
                  <span className="text-xs text-[#5B6B80] block">معاينة حية من داخل النظام</span>
                  <span className="text-sm font-bold text-[#0F2A4A]">{centerSettings.name}</span>
                </div>
                <span className="text-xs font-bold text-[#065F46] bg-[#D1FAE5] px-2.5 py-1 rounded-full">
                  متصل
                </span>
              </div>

              <div className="p-5 space-y-4">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3 rounded-[8px] bg-[#F4F7FA]">
                    <span className="text-[11px] text-[#5B6B80] block">حصص اليوم</span>
                    <span className="text-lg font-bold text-[#0F2A4A] tabular-nums">
                      {todaySessionsCount}
                    </span>
                  </div>
                  <div className="p-3 rounded-[8px] bg-[#D1FAE5]/50">
                    <span className="text-[11px] text-[#065F46] block">طلاب نشطون</span>
                    <span className="text-lg font-bold text-[#065F46] tabular-nums">
                      {activeStudentsCount}
                    </span>
                  </div>
                  <div className="p-3 rounded-[8px] bg-[#0F766E]/10">
                    <span className="text-[11px] text-[#0F766E] block">إيصال PDF</span>
                    <span className="text-lg font-bold text-[#0F766E]">فوري</span>
                  </div>
                </div>

                <div className="divide-y divide-[#E2E8F0] border border-[#E2E8F0] rounded-[10px]">
                  <div className="p-3.5 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-[#0F2A4A]">تصدير كشف الحضور والغياب</p>
                      <p className="text-[#5B6B80] mt-0.5">كيمياء - ثالثة ثانوي · 2026-11-12</p>
                    </div>
                    <span className="font-bold text-[#0F766E]">PDF جاهز</span>
                  </div>
                  <div className="p-3.5 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-[#0F2A4A]">التقرير المالي الشهري وحسابات المدرسين</p>
                      <p className="text-[#5B6B80] mt-0.5">الإيرادات والمصروفات وصافي السنتر</p>
                    </div>
                    <span className="font-bold text-[#0F766E]">طباعة / مشاركة</span>
                  </div>
                  <div className="p-3.5 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-[#0F2A4A]">تقرير متابعة ولي الأمر</p>
                      <p className="text-[#5B6B80] mt-0.5">الحضور + الدرجات + حالة المصروفات</p>
                    </div>
                    <span className="font-bold text-[#065F46]">جاهز للإرسال</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="flex-1"
                    onClick={() => navigate(ScreenId.REPORTS)}
                  >
                    تجربة تصدير التقارير PDF
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => navigate(ScreenId.TAKE_ATTENDANCE)}
                  >
                    شاشة تسجيل الحضور
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Capabilities Section */}
      <section id="features" className="py-14 lg:py-16">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 space-y-8">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold text-[#0F2A4A]">
              كل أدوات تشغيل السنتر اليومي في واجهة واحدة واضحة
            </h2>
            <p className="text-sm text-[#5B6B80] mt-1.5">
              تم تصميم كل شاشة لتناسب ضغط العمل الفعلي عند الاستقبال أو في نهاية اليوم المالي.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Card className="p-6 space-y-2.5">
              <div className="w-10 h-10 rounded-[8px] bg-[#0F766E]/10 text-[#0F766E] flex items-center justify-center">
                <CalendarCheck2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#0F2A4A]">
                تسجيل حضور سريع ومنع تعارض القاعات
              </h3>
              <p className="text-sm text-[#5B6B80] leading-relaxed">
                أزرار حضور كبيرة مناسبة للموبايل (حاضر / متأخر / غائب)، وزر تحضير جماعي، مع جدول أسبوعي ينبّهك فوراً عند حجز قاعة أو مدرس في نفس الموعد.
              </p>
            </Card>

            <Card className="p-6 space-y-2.5">
              <div className="w-10 h-10 rounded-[8px] bg-[#0F2A4A]/10 text-[#0F2A4A] flex items-center justify-center">
                <Printer className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#0F2A4A]">
                تصدير التقارير المالية وسجلات الحضور PDF
              </h3>
              <p className="text-sm text-[#5B6B80] leading-relaxed">
                أصدر ملفات PDF منظمة باللغة العربية للتقارير المالية، مستحقات المدرسين، وسجلات الحضور والغياب، مع ملخص نصي جاهز للطباعة أو المشاركة الفورية مع أولياء الأمور.
              </p>
            </Card>

            <Card className="p-6 space-y-2.5">
              <div className="w-10 h-10 rounded-[8px] bg-[#D1FAE5] text-[#065F46] flex items-center justify-center">
                <Wallet className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#0F2A4A]">
                تحصيل الاشتراكات وإيصالات A5 والمتأخرين
              </h3>
              <p className="text-sm text-[#5B6B80] leading-relaxed">
                إنشاء فواتير الشهر بضغطة واحدة، تسجيل الدفعات الجزئية والكاملة مع إيصال رسمي للطباعة، وتصنيف المتأخرين تلقائياً حسب مدة التأخير.
              </p>
            </Card>

            <Card className="p-6 space-y-2.5">
              <div className="w-10 h-10 rounded-[8px] bg-[#FEF3C7] text-[#92400E] flex items-center justify-center">
                <UserCheck className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#0F2A4A]">
                بوابة مخصصة لأولياء الأمور وصلاحيات الفريق
              </h3>
              <p className="text-sm text-[#5B6B80] leading-relaxed">
                يتابع ولي الأمر حضور أبنائه ودرجات الامتحانات والفواتير من جواله بواجهة هادئة، مع توزيع صلاحيات دقيق للمالك والمدير والمحاسب والاستقبال والمدرس.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing Summary Section */}
      <section id="pricing" className="py-12 bg-white border-y border-[#E2E8F0]">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-[#0F2A4A]">باقات واضحة بالعملة المحلية</h2>
              <p className="text-sm text-[#5B6B80] mt-1">
                ابدأ بسنترك اليوم، ويمكنك الترقية في أي وقت مع نمو عدد الطلاب.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate(ScreenId.SUBSCRIPTION)}
              className="text-xs font-bold text-[#0F766E] hover:underline cursor-pointer"
            >
              عرض تفاصيل الباقات والفواتير
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {SUBSCRIPTION_PLANS.map((plan) => (
              <Card
                key={plan.id}
                className={`p-6 flex flex-col justify-between ${
                  plan.popular ? 'border-2 border-[#0F766E]' : ''
                }`}
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-lg font-bold text-[#0F2A4A]">{plan.name}</h3>
                    {plan.popular && (
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#D1FAE5] text-[#065F46]">
                        الأكثر اختياراً
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#5B6B80]">{plan.subtitle}</p>
                  <div className="pb-4 border-b border-[#E2E8F0]">
                    <span className="text-3xl font-bold text-[#0F2A4A] tabular-nums">
                      {formatEGP(plan.monthlyPrice)}
                    </span>
                    <span className="text-xs text-[#5B6B80] mr-1">/ شهرياً</span>
                  </div>
                  <ul className="space-y-2 text-xs text-[#1E293B]">
                    {plan.features.slice(0, 4).map((f) => (
                      <li key={f.text} className="flex items-center gap-2">
                        <CheckCircle2
                          className={`w-4 h-4 shrink-0 ${
                            f.included ? 'text-[#0F766E]' : 'text-slate-300'
                          }`}
                        />
                        <span className={!f.included ? 'text-[#5B6B80] line-through' : ''}>
                          {f.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Button
                  variant={plan.popular ? 'primary' : 'secondary'}
                  className="w-full mt-6"
                  onClick={() => navigate(ScreenId.ONBOARDING)}
                >
                  إنشاء حساب بهذه الباقة
                </Button>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section className="py-12">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
          <div className="bg-[#0F2A4A] text-white rounded-[12px] p-6 sm:p-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1.5">
              <h2 className="text-xl sm:text-2xl font-bold">جاهز لتنظيم سنترك في دقائق؟</h2>
              <p className="text-sm text-slate-300">
                سجّل حسابك الآن وأضف قاعاتك، أو ادخل فوراً بحسابك الحالي لمتابعة الحصص والتقارير.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <Button
                variant="secondary"
                onClick={() => navigate(ScreenId.LOGIN)}
                className="bg-white text-[#0F2A4A] border-white hover:bg-slate-100"
              >
                تسجيل الدخول
              </Button>
              <Button onClick={() => navigate(ScreenId.ONBOARDING)}>
                إنشاء حساب جديد
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto bg-white border-t border-[#E2E8F0] py-6">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#5B6B80]">
          <div className="flex items-center gap-3">
            <EduflowLogo dark={false} compact />
            <span>EDUFLOW — كل سنترك في مكان واحد</span>
          </div>
          <div className="flex flex-wrap items-center gap-4 font-semibold">
            <button
              type="button"
              onClick={() => navigate(ScreenId.LOGIN)}
              className="hover:text-[#0F2A4A] cursor-pointer"
            >
              تسجيل الدخول
            </button>
            <button
              type="button"
              onClick={() => navigate(ScreenId.ONBOARDING)}
              className="hover:text-[#0F2A4A] cursor-pointer"
            >
              إنشاء حساب
            </button>
            <button
              type="button"
              onClick={() => navigate(ScreenId.PARENT_PORTAL)}
              className="hover:text-[#0F2A4A] cursor-pointer"
            >
              بوابة أولياء الأمور
            </button>
            <button
              type="button"
              onClick={() => navigate(ScreenId.STUDENT_LOGIN)}
              className="hover:text-[#0F2A4A] cursor-pointer"
            >
              بوابة الطالب
            </button>
            <button
              type="button"
              onClick={() => navigate(ScreenId.DASHBOARD)}
              className="text-[#0F766E] hover:underline cursor-pointer"
            >
              لوحة التحكم
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
