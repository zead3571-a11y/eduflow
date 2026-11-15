import React, { useState } from 'react';
import {
  Check,
  Copy,
  Layers,
  Play,
} from 'lucide-react';
import { useEduflow } from '../../context/EduflowContext';
import { ScreenId } from '../../types/eduflow';
import {
  Button,
  Card,
  Drawer,
  EmptyState,
  ErrorState,
  Field,
  InitialAvatar,
  LockedFeatureCard,
  Modal,
  SelectInput,
  StatusChip,
  TableSkeleton,
  TextInput,
} from '../ui/Primitives';

interface FigmaPromptEntry {
  num: string;
  titleAr: string;
  targetScreen: ScreenId;
  promptEn: string;
}

const FIGMA_PROMPTS_LIST: FigmaPromptEntry[] = [
  {
    num: '0',
    titleAr: 'برومت النظام العام (Design System)',
    targetScreen: ScreenId.DESIGN_SYSTEM,
    promptEn: `You are designing EDUFLOW, an Arabic-first (RTL) web app for managing tutoring centers in Egypt. Users: center owner, admin, accountant, receptionist (daily users, often on phones), teachers, and parents (separate portal).\nLAYOUT: Desktop 1440 wide with a 220px right-side navy sidebar (RTL) and a top bar (page title on the right; search, notifications bell, user menu on the left). Sidebar items: الرئيسية، الطلاب، المدرسين، المجموعات والجدول، الحضور، المدفوعات، التقييمات، التقارير، الإعدادات. Mobile 390 wide: sidebar becomes a bottom tab bar (الرئيسية، الطلاب، الحضور، المدفوعات، المزيد). Content max-width 1200, 24px gutters, 8pt spacing grid.\nTYPE: Cairo (fallback Tajawal). H1 24/700, H2 16/700, body 14/400, caption 12. Western digits.\nCOLOR: navy #0F2A4A (sidebar, headings), primary teal #0F766E (buttons, active states), background #F4F7FA, surface #FFFFFF, border #E2E8F0, text #1E293B, muted text #5B6B80. Status chips: paid/present = bg #D1FAE5 text #065F46; absent/overdue = bg #FEE2E2 text #991B1B; late/partial/pending = bg #FEF3C7 text #92400E. WCAG AA contrast.`,
  },
  {
    num: '1',
    titleAr: 'تسجيل الدخول واستعادة كلمة السر',
    targetScreen: ScreenId.LOGIN,
    promptEn: `Use the EDUFLOW design system. Design Desktop 1440 and Mobile 390.\nDesign the Login page. Split layout: right side navy brand panel with EDUFLOW logo and tagline كل سنترك في مكان واحد; left side white form card titled تسجيل الدخول. Fields: phone or email, password with show/hide toggle. Remember-me checkbox, primary button دخول, link نسيت كلمة السر. Also design forgot-password and set-new-password screens.`,
  },
  {
    num: '2',
    titleAr: 'إنشاء حساب وإعداد السنتر (Onboarding)',
    targetScreen: ScreenId.ONBOARDING,
    promptEn: `Use the EDUFLOW design system. Design Desktop 1440 and Mobile 390.\nDesign a 3-step onboarding wizard with a progress bar at the top: Step 1 account, Step 2 center info (governorate, city, stages ابتدائي، إعدادي، ثانوي), Step 3 rooms inline add and optional first teacher, plus final checklist screen with ادخل لوحة التحكم.`,
  },
  {
    num: '3',
    titleAr: 'لوحة التحكم (الرئيسية)',
    targetScreen: ScreenId.DASHBOARD,
    promptEn: `Use the EDUFLOW design system. Design Desktop 1440 and Mobile 390.\nDesign the Owner Dashboard: KPI cards (حصص اليوم، حاضرون، غائبون، محصّل اليوم), Alerts card, Quick actions (تسجيل حضور، تسجيل دفعة، إضافة طالب), Today's sessions table, 30-day collections line chart, and New-center empty checklist.`,
  },
  {
    num: '4-6',
    titleAr: 'قائمة الطلاب، إضافة طالب، وملف الطالب',
    targetScreen: ScreenId.STUDENTS,
    promptEn: `Use the EDUFLOW design system. Design Desktop 1440 and Mobile 390.\nDesign the Students list with search, filters, bulk actions, Add/Edit Student right-side drawer with duplicate parent phone warning, and Student Profile with 5 tabs (نظرة عامة، الحضور، المدفوعات، التقييمات، ملاحظات).`,
  },
  {
    num: '7-9',
    titleAr: 'المدرسين، المجموعات، والجدول الأسبوعي',
    targetScreen: ScreenId.SCHEDULE,
    promptEn: `Use the EDUFLOW design system. Design Desktop 1440 and Mobile 390.\nDesign Teachers list & profile, Groups list & Create drawer with live room/teacher conflict banner, and Weekly Schedule grid (Saturday to Friday, 2 PM to 10 PM) with toggle by room/teacher.`,
  },
  {
    num: '10-11',
    titleAr: 'تسجيل الحضور، الملخص، وسجل الحضور',
    targetScreen: ScreenId.TAKE_ATTENDANCE,
    promptEn: `Use the EDUFLOW design system. Design Desktop 1440 and Mobile 390.\nDesign Take Attendance with sticky counters, الكل حاضر button, 48px+ 3-option segmented control (حاضر / متأخر / غايب), QR disabled قريباً badge, sticky save footer, Post-save Attendance Summary, and Attendance History.`,
  },
  {
    num: '12-15',
    titleAr: 'الفواتير، تسجيل دفعة والإيصال، المتأخرون، والمصروفات',
    targetScreen: ScreenId.PAYMENTS,
    promptEn: `Use the EDUFLOW design system. Design Desktop 1440 and Mobile 390.\nDesign Payments & Invoices, Record Payment drawer with printable A5 Receipt, Late Payments with 1-7 / 8-30 / 30+ buckets, and Expenses with category donut chart and role lock.`,
  },
  {
    num: '16-18',
    titleAr: 'التقييمات، الإشعارات، والتقارير',
    targetScreen: ScreenId.ASSESSMENTS,
    promptEn: `Use the EDUFLOW design system. Design Desktop 1440 and Mobile 390.\nDesign Assessments & Grade-entry with max-score validation and autosave, Notifications center, and Reports with 4 tabs plus locked-plan blurred upgrade overlay.`,
  },
  {
    num: '19-21',
    titleAr: 'الإعدادات، الاشتراك والباقات، وبوابة أولياء الأمور',
    targetScreen: ScreenId.SUBSCRIPTION,
    promptEn: `Use the EDUFLOW design system. Design Desktop 1440 and Mobile 390.\nDesign Settings (5 tabs), Subscription pricing (1,500 / 2,800 / 4,500 EGP, monthly/annual toggle, billing banners, locked-feature modal), and mobile-first Parent Portal.`,
  },
];

// Closing Screen: EDUFLOW RTL Design System & Prototype Flows + Copyable Figma Prompts
export const DesignSystemScreen: React.FC = () => {
  const {
    navigate,
    openAddStudent,
    openRecordPayment,
    showToast,
  } = useEduflow();

  const [section, setSection] = useState<'components' | 'flows' | 'prompts'>('components');
  const [demoDrawerOpen, setDemoDrawerOpen] = useState(false);
  const [demoModalOpen, setDemoModalOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyPrompt = (id: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    showToast('تم نسخ البرومت جاهزاً للصق في Figma Make');
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Sub-navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 p-1 bg-white border border-[#E2E8F0] rounded-[8px]">
          <button
            type="button"
            onClick={() => setSection('components')}
            className={`px-3.5 py-2 rounded-[6px] text-xs font-bold cursor-pointer ${
              section === 'components' ? 'bg-[#0F2A4A] text-white' : 'text-[#5B6B80]'
            }`}
          >
            مكتبة المكونات (Design System)
          </button>
          <button
            type="button"
            onClick={() => setSection('flows')}
            className={`px-3.5 py-2 rounded-[6px] text-xs font-bold cursor-pointer ${
              section === 'flows' ? 'bg-[#0F2A4A] text-white' : 'text-[#5B6B80]'
            }`}
          >
            مسارات البروتوتايب التفاعلية
          </button>
          <button
            type="button"
            onClick={() => setSection('prompts')}
            className={`px-3.5 py-2 rounded-[6px] text-xs font-bold cursor-pointer ${
              section === 'prompts' ? 'bg-[#0F2A4A] text-white' : 'text-[#5B6B80]'
            }`}
          >
            دليل برومتات Figma جاهزة للنسخ
          </button>
        </div>
      </div>

      {section === 'components' && (
        <div className="space-y-6">
          {/* Color Tokens */}
          <Card className="p-5 space-y-4">
            <h2 className="text-base font-bold text-[#0F2A4A]">1. نظام الألوان (WCAG AA)</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-xs">
              {[
                { name: 'Navy الأساسي', hex: '#0F2A4A', bg: 'bg-[#0F2A4A] text-white' },
                { name: 'Teal التفاعلي', hex: '#0F766E', bg: 'bg-[#0F766E] text-white' },
                { name: 'الخلفية العامة', hex: '#F4F7FA', bg: 'bg-[#F4F7FA] text-[#1E293B] border border-[#E2E8F0]' },
                { name: 'الأسطح والبطاقات', hex: '#FFFFFF', bg: 'bg-white text-[#1E293B] border border-[#E2E8F0]' },
                { name: 'مدفوع / حاضر', hex: '#D1FAE5', bg: 'bg-[#D1FAE5] text-[#065F46]' },
                { name: 'غائب / متأخر', hex: '#FEE2E2', bg: 'bg-[#FEE2E2] text-[#991B1B]' },
                { name: 'جزئي / معلق', hex: '#FEF3C7', bg: 'bg-[#FEF3C7] text-[#92400E]' },
              ].map((sw) => (
                <div key={sw.hex} className="rounded-[10px] overflow-hidden border border-[#E2E8F0]">
                  <div className={`h-14 px-3 flex items-center justify-center font-bold ${sw.bg}`}>
                    {sw.hex}
                  </div>
                  <div className="p-2 bg-white text-center font-semibold text-[#1E293B]">
                    {sw.name}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Typography */}
          <Card className="p-5 space-y-3">
            <h2 className="text-base font-bold text-[#0F2A4A]">
              2. التدرج الطباعي (خط Cairo + أرقام غربية 0-9)
            </h2>
            <div className="divide-y divide-[#E2E8F0]">
              <div className="py-3 flex items-center justify-between">
                <span className="text-[24px] font-bold text-[#0F2A4A]">
                  عنوان صفحة رئيسي H1 — 24px / 700
                </span>
                <span className="text-xs text-[#5B6B80] tabular-nums">24 / Bold</span>
              </div>
              <div className="py-3 flex items-center justify-between">
                <span className="text-[16px] font-bold text-[#0F2A4A]">
                  عنوان قسم فرعي H2 — 16px / 700
                </span>
                <span className="text-xs text-[#5B6B80] tabular-nums">16 / Bold</span>
              </div>
              <div className="py-3 flex items-center justify-between">
                <span className="text-[14px] text-[#1E293B] tabular-nums">
                  نص المحتوى الأساسي Body — إجمالي التحصيل 14,850 ج لعدد 42 طالب.
                </span>
                <span className="text-xs text-[#5B6B80] tabular-nums">14 / Regular</span>
              </div>
              <div className="py-3 flex items-center justify-between">
                <span className="text-[12px] text-[#5B6B80]">
                  نص فرعي توضيحي Caption — آخر تحديث منذ 5 دقائق
                </span>
                <span className="text-xs text-[#5B6B80] tabular-nums">12 / Muted</span>
              </div>
            </div>
          </Card>

          {/* Buttons, Chips, Avatars */}
          <Card className="p-5 space-y-5">
            <h2 className="text-base font-bold text-[#0F2A4A]">
              3. الأزرار (ارتفاع أدنى 44px) وشارات الحالة
            </h2>
            <div className="flex flex-wrap items-center gap-3">
              <Button>زر أساسي (Primary)</Button>
              <Button variant="secondary">زر ثانوي (Secondary)</Button>
              <Button variant="destructive">حذف / إيقاف (Destructive)</Button>
              <Button loading>جاري الحفظ</Button>
              <Button variant="secondary" soon>
                ميزة قادمة
              </Button>
            </div>

            <div className="pt-4 border-t border-[#E2E8F0] flex flex-wrap items-center gap-3">
              <StatusChip tone="success" label="مدفوع / حاضر" />
              <StatusChip tone="danger" label="متأخر / غائب" />
              <StatusChip tone="warning" label="سداد جزئي / بانتظار الحضور" />
              <StatusChip tone="neutral" label="لم تبدأ" />
              <InitialAvatar name="يوسف أحمد" size="sm" />
              <InitialAvatar name="سارة نبيل" size="md" tint="#0F766E" />
            </div>
          </Card>

          {/* Inputs, Drawers, Modals, Toasts */}
          <Card className="p-5 space-y-4">
            <h2 className="text-base font-bold text-[#0F2A4A]">
              4. الحقول واللوحات الجانبية والنوافذ والتنبيهات
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="حقل نصي افتراضي (44px)" htmlFor="ds-in-1">
                <TextInput id="ds-in-1" placeholder="أدخل اسم الطالب..." />
              </Field>
              <Field label="قائمة منسدلة" htmlFor="ds-in-2">
                <SelectInput id="ds-in-2">
                  <option>الصف الثالث الثانوي</option>
                  <option>الصف الثاني الثانوي</option>
                </SelectInput>
              </Field>
              <Field
                label="حقل مع رسالة تحقق"
                htmlFor="ds-in-3"
                error="رقم الهاتف غير مكتمل (11 رقم)."
              >
                <TextInput id="ds-in-3" defaultValue="01012" hasError />
              </Field>
            </div>

            <div className="pt-3 flex flex-wrap gap-2.5">
              <Button variant="secondary" onClick={() => setDemoDrawerOpen(true)}>
                تجربة اللوحة الجانبية (Right Drawer)
              </Button>
              <Button variant="secondary" onClick={() => setDemoModalOpen(true)}>
                تجربة نافذة التأكيد (Modal)
              </Button>
              <Button
                variant="secondary"
                onClick={() => showToast('تم تنفيذ العملية بنجاح — تنبيه Toast')}
              >
                إظهار إشعار Toast
              </Button>
            </div>
          </Card>

          {/* States & Locked Feature Pattern */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-[#0F2A4A]">5. حالات التحميل والفراغ والخطأ</h3>
              <TableSkeleton rows={3} />
              <EmptyState
                title="نموذج الحالة الفارغة"
                description="وصف موجز وواضح مع زر إجراء مباشر لإضافة أول عنصر."
                actionLabel="إضافة عنصر"
                onAction={() => showToast('تم الضغط على زر الحالة الفارغة', 'info')}
              />
              <ErrorState onRetry={() => showToast('جاري إعادة المحاولة...', 'info')} />
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-bold text-[#0F2A4A]">6. نمط الميزة المقفلة (Locked Feature)</h3>
              <LockedFeatureCard
                featureName="تصدير التقارير المتقدمة وإشعارات واتساب"
                planName="الباقة الاحترافية"
                onUpgrade={() => navigate(ScreenId.SUBSCRIPTION)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Interactive Prototype Flows Section */}
      {section === 'flows' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            {
              title: '1. مسار الدخول إلى لوحة التحكم',
              desc: 'شاشة تسجيل الدخول ← التحقق من البيانات أو استعادة كلمة السر ← لوحة تحكم المالك.',
              cta: 'ابدأ من تسجيل الدخول',
              action: () => navigate(ScreenId.LOGIN),
            },
            {
              title: '2. مسار تسجيل الحضور السريع والملخص',
              desc: 'لوحة التحكم ← تسجيل حضور حصة (الكل حاضر / حاضر / غايب) ← حفظ ← شاشة ملخص الحضور وتنبيهات الغياب.',
              cta: 'ابدأ تسجيل الحضور',
              action: () => navigate(ScreenId.TAKE_ATTENDANCE),
            },
            {
              title: '3. مسار تحصيل دفعة وإصدار إيصال A5',
              desc: 'اختيار طالب وفاتورة مفتوحة ← إدخال المبلغ وطريقة الدفع ← إصدار إيصال رسمي قابل للطباعة.',
              cta: 'افتح تسجيل دفعة الآن',
              action: () => openRecordPayment(),
            },
            {
              title: '4. مسار الطلاب إلى ملف الطالب الشامل',
              desc: 'قائمة الطلاب والتصفية ← إضافة طالب أو اختيار طالب ← استعراض تبويبات الحضور والمدفوعات والتقييمات.',
              cta: 'انتقل لقائمة الطلاب',
              action: () => navigate(ScreenId.STUDENTS),
            },
            {
              title: '5. مسار ترقية الباقة والمزايا المقفلة',
              desc: 'التقارير المقفلة ← زر ترقية الباقة ← مقارنة الباقات والخصم السنوي ← إتمام الترقية.',
              cta: 'افتح الاشتراك والباقات',
              action: () => navigate(ScreenId.SUBSCRIPTION),
            },
            {
              title: '6. مسار بوابة أولياء الأمور (Mobile-First)',
              desc: 'قبول كود الدعوة ← التبديل بين الأبناء ← متابعة الحضور والدرجات والتواصل مع السنتر.',
              cta: 'افتح بوابة ولي الأمر',
              action: () => navigate(ScreenId.PARENT_PORTAL),
            },
          ].map((flow, idx) => (
            <Card key={idx} className="p-5 flex flex-col justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-[#0F2A4A]">{flow.title}</h3>
                <p className="text-xs text-[#5B6B80] mt-1 leading-relaxed">{flow.desc}</p>
              </div>
              <div>
                <Button
                  size="sm"
                  icon={<Play className="w-3.5 h-3.5" />}
                  onClick={flow.action}
                >
                  {flow.cta}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Figma Prompts Quick Reference & Copy */}
      {section === 'prompts' && (
        <div className="space-y-4">
          <Card className="p-4 bg-[#0F2A4A] text-white flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Layers className="w-5 h-5 text-teal-300" />
              <div className="text-xs">
                <p className="font-bold text-sm">مرجع برومتات Figma Make المنظم</p>
                <p className="text-slate-300">
                  انسخ البرومت رقم 0 أولاً، ثم انسخ برومت أي شاشة أو انتقل لمعاينتها الحية مباشرة.
                </p>
              </div>
            </div>
            <Button size="sm" onClick={openAddStudent}>
              تجربة لوحة الإضافة الحية
            </Button>
          </Card>

          <div className="grid grid-cols-1 gap-3">
            {FIGMA_PROMPTS_LIST.map((item) => (
              <Card key={item.num} className="p-4 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded bg-[#0F2A4A] text-white text-xs font-bold tabular-nums">
                      #{item.num}
                    </span>
                    <h4 className="text-sm font-bold text-[#0F2A4A]">{item.titleAr}</h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => navigate(item.targetScreen)}
                    >
                      معاينة الشاشة الحية
                    </Button>
                    <Button
                      size="sm"
                      icon={
                        copiedId === item.num ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )
                      }
                      onClick={() => copyPrompt(item.num, item.promptEn)}
                    >
                      {copiedId === item.num ? 'تم النسخ' : 'نسخ البرومت'}
                    </Button>
                  </div>
                </div>
                <pre
                  dir="ltr"
                  className="p-3 rounded-[8px] bg-[#F4F7FA] border border-[#E2E8F0] text-xs text-[#1E293B] whitespace-pre-wrap font-mono text-left"
                >
                  {item.promptEn}
                </pre>
              </Card>
            ))}
          </div>
        </div>
      )}

      <Drawer
        open={demoDrawerOpen}
        onClose={() => setDemoDrawerOpen(false)}
        title="مثال اللوحة الجانبية (Right-Side Drawer)"
        subtitle="تظهر من اليمين في واجهة RTL وتتحول لشاشة كاملة على الموبايل"
        footer={<Button onClick={() => setDemoDrawerOpen(false)}>حفظ وإغلاق</Button>}
      >
        <p className="text-sm text-[#5B6B80]">
          تُستخدم اللوحات الجانبية في EDUFLOW لإضافة وتعديل الطلاب والمدرسين والمجموعات وتسجيل الدفعات دون فقدان سياق الجدول الحالي.
        </p>
      </Drawer>

      <Modal
        open={demoModalOpen}
        onClose={() => setDemoModalOpen(false)}
        title="مثال نافذة التأكيد (Confirmation Modal)"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDemoModalOpen(false)}>
              إلغاء
            </Button>
            <Button variant="destructive" onClick={() => setDemoModalOpen(false)}>
              تأكيد الإجراء
            </Button>
          </>
        }
      >
        <p className="text-sm text-[#1E293B]">
          تُستخدم النوافذ المنبثقة لتأكيد العمليات الحساسة مثل إيقاف قيد طالب أو إصدار فواتير شهر جديد.
        </p>
      </Modal>
    </div>
  );
};
