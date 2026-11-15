import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Edit3,
  Plus,
  Printer,
  Receipt,
  Trash2,
  Users,
  Wallet,
} from 'lucide-react';
import { useEduflow } from '../../context/EduflowContext';
import {
  CompensationType,
  PaymentRecord,
  ScreenId,
  SettlementManualLine,
  SettlementRecord,
  Teacher,
  UserRole,
} from '../../types/eduflow';
import { can } from '../../permissions/permissions';
import { Can } from '../../permissions/Can';
import {
  Button,
  Card,
  Drawer,
  EmptyState,
  ErrorState,
  Field,
  InitialAvatar,
  ListStateSwitcher,
  Modal,
  SelectInput,
  StatusChip,
  TableSkeleton,
  TextInput,
} from '../ui/Primitives';
import {
  DAYS_ORDER,
  formatEGP,
  formatTimeRangeArabic,
} from '../../utils/eduflowLogic';

function formatSettlementDate(value?: string): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  const dd = String(parsed.getDate()).padStart(2, '0');
  const mm = String(parsed.getMonth() + 1).padStart(2, '0');
  const yyyy = parsed.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}
import { calculateTeacherSettlement } from '../../features/settlements/teacherSettlement';

const AVAILABLE_SUBJECTS = [
  'فيزياء',
  'كيمياء',
  'رياضيات',
  'ميكانيكا',
  'أحياء',
  'لغة عربية',
  'لغة إنجليزية',
  'لغة فرنسية',
  'علوم',
  'دراسات اجتماعية',
];

// 7a) Teachers List & Add/Edit Drawer
export const TeachersListScreen: React.FC = () => {
  const {
    currentActor,
    teachers,
    groups,
    students,
    listStateMode,
    setListStateMode,
    addOrUpdateTeacher,
    setSelectedTeacherId,
    navigate,
  } = useEduflow();

  const canCreateTeacher = can(currentActor, 'create', 'teachers');

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [subjects, setSubjects] = useState<string[]>(['فيزياء']);
  const [compType, setCompType] = useState<CompensationType>('percentage');
  const [rentMode, setRentMode] = useState<'monthly' | 'per_session'>('monthly');
  const [compVal, setCompVal] = useState('70');
  const [hasLogin, setHasLogin] = useState(true);
  const [formErr, setFormErr] = useState('');

  const openAdd = () => {
    setEditingTeacher(null);
    setName('');
    setPhone('');
    setSubjects(['فيزياء']);
    setCompType('percentage');
    setRentMode('monthly');
    setCompVal('70');
    setHasLogin(true);
    setFormErr('');
    setDrawerOpen(true);
  };

  const openEdit = (t: Teacher) => {
    setEditingTeacher(t);
    setName(t.name);
    setPhone(t.phone);
    setSubjects(t.subjects);
    setCompType(t.compensationType);
    setRentMode(t.rentMode || t.compensation?.rentMode || 'monthly');
    setCompVal(String(t.compensationValue));
    setHasLogin(t.hasLoginAccess);
    setFormErr('');
    setDrawerOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormErr('يرجى إدخال اسم المدرس.');
      return;
    }
    if (subjects.length === 0) {
      setFormErr('يرجى اختيار مادة دراسية واحدة على الأقل.');
      return;
    }
    addOrUpdateTeacher(
      {
        name: name.trim(),
        phone: phone.trim() || '01000000000',
        subjects,
        compensationType: compType,
        compensationValue: Number(compVal) || 70,
        rentMode: compType === 'fixed_rent' ? rentMode : undefined,
        hasLoginAccess: hasLogin,
      },
      editingTeacher?.id
    );
    setDrawerOpen(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Can action="create" resource="teachers">
          <Button onClick={openAdd} icon={<Plus className="w-4 h-4" />}>
            إضافة مدرس
          </Button>
        </Can>
        <ListStateSwitcher mode={listStateMode} onChange={setListStateMode} />
      </div>

      {listStateMode === 'loading' ? (
        <TableSkeleton rows={5} />
      ) : listStateMode === 'error' ? (
        <ErrorState onRetry={() => setListStateMode('ready')} />
      ) : listStateMode === 'empty' ? (
        <EmptyState
          title="لم تتم إضافة مدرسين بعد"
          description="أضف مدرسي السنتر وحدد نظام التعاقد (نسبة مئوية أو إيجار قاعة ثابت) لحساب مستحقاتهم تلقائياً."
          actionLabel={canCreateTeacher ? 'إضافة أول مدرس' : undefined}
          onAction={canCreateTeacher ? openAdd : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teachers.map((tch) => {
            const tchGroups = groups.filter((g) => g.teacherId === tch.id);
            const tchGroupIds = tchGroups.map((g) => g.id);
            const tchStudentsCount = students.filter(
              (s) => s.status === 'active' && s.groupIds.some((gid) => tchGroupIds.includes(gid))
            ).length;

            return (
              <Card key={tch.id} className="p-5 flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <InitialAvatar name={tch.name} tint={tch.color} />
                      <div>
                        <h3 className="text-base font-bold text-[#0F2A4A]">{tch.name}</h3>
                        <p className="text-xs text-[#5B6B80] mt-0.5">
                          {tch.subjects.join(' · ')}
                        </p>
                      </div>
                    </div>
                    <StatusChip
                      tone={tch.compensationType === 'percentage' ? 'success' : 'navy'}
                      label={
                        tch.compensationType === 'percentage'
                          ? `نسبة ${tch.compensationValue}%`
                          : `إيجار ${formatEGP(tch.compensationValue)}`
                      }
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[#E2E8F0] text-xs">
                    <div>
                      <span className="text-[#5B6B80] block">المجموعات</span>
                      <span className="text-base font-bold text-[#1E293B] tabular-nums">
                        {tchGroups.length}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#5B6B80] block">إجمالي الطلاب</span>
                      <span className="text-base font-bold text-[#1E293B] tabular-nums">
                        {tchStudentsCount}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="flex-1"
                    onClick={() => {
                      setSelectedTeacherId(tch.id);
                      navigate(ScreenId.TEACHER_PROFILE);
                    }}
                  >
                    {can(currentActor, 'view', 'teacherShares', { teacherId: tch.id })
                      ? 'عرض الملف والإيرادات'
                      : 'عرض ملف المدرس'}
                  </Button>
                  <Can action="update" resource="teachers">
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`تعديل ${tch.name}`}
                      onClick={() => openEdit(tch)}
                    >
                      <Edit3 className="w-4 h-4" />
                    </Button>
                  </Can>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add/Edit Teacher Drawer */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editingTeacher ? 'تعديل بيانات المدرس' : 'إضافة مدرس جديد'}
        subtitle="حدد المواد ونظام حساب مستحقات المدرس مع السنتر"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDrawerOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={handleSave}>حفظ المدرس</Button>
          </>
        }
      >
        <form onSubmit={handleSave} className="space-y-4">
          {formErr && (
            <div className="p-3 rounded-[8px] bg-[#FEE2E2] text-[#991B1B] text-xs font-bold">
              {formErr}
            </div>
          )}

          <Field label="اسم المدرس" htmlFor="tch-name" required>
            <TextInput
              id="tch-name"
              placeholder="مثال: أ. محمد عبد السلام"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>

          <Field label="رقم الموبايل" htmlFor="tch-phone" required>
            <TextInput
              id="tch-phone"
              dir="ltr"
              className="text-right tabular-nums"
              placeholder="01012345678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </Field>

          <Field label="المواد الدراسية" required>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_SUBJECTS.map((subj) => {
                const active = subjects.includes(subj);
                return (
                  <button
                    key={subj}
                    type="button"
                    onClick={() =>
                      setSubjects((prev) =>
                        active ? prev.filter((s) => s !== subj) : [...prev, subj]
                      )
                    }
                    className={`px-3 py-1.5 rounded-full text-xs font-bold border cursor-pointer ${
                      active
                        ? 'bg-[#0F766E] text-white border-[#0F766E]'
                        : 'bg-white text-[#1E293B] border-[#E2E8F0]'
                    }`}
                  >
                    {subj}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="نظام التعاقد المالي" required>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-[8px]">
              <button
                type="button"
                onClick={() => {
                  setCompType('percentage');
                  setCompVal('70');
                }}
                className={`py-2 rounded-[6px] text-xs font-bold cursor-pointer ${
                  compType === 'percentage'
                    ? 'bg-white text-[#0F2A4A] shadow-xs'
                    : 'text-[#5B6B80]'
                }`}
              >
                نسبة مئوية من التحصيل (%)
              </button>
              <button
                type="button"
                onClick={() => {
                  setCompType('fixed_rent');
                  setCompVal('3500');
                }}
                className={`py-2 rounded-[6px] text-xs font-bold cursor-pointer ${
                  compType === 'fixed_rent'
                    ? 'bg-white text-[#0F2A4A] shadow-xs'
                    : 'text-[#5B6B80]'
                }`}
              >
                إيجار قاعة شهري ثابت (ج)
              </button>
            </div>
          </Field>

          {compType === 'fixed_rent' && (
            <Field label="طريقة احتساب الإيجار" htmlFor="tch-rent-mode">
              <SelectInput
                id="tch-rent-mode"
                value={rentMode}
                onChange={(e) => setRentMode(e.target.value as 'monthly' | 'per_session')}
              >
                <option value="monthly">إيجار شهري ثابت</option>
                <option value="per_session">إيجار لكل حصة منعقدة</option>
              </SelectInput>
            </Field>
          )}

          <Field
            label={
              compType === 'percentage'
                ? 'نسبة المدرس (%) — الباقي حصة السنتر'
                : rentMode === 'per_session'
                ? 'إيجار القاعة للحصة الواحدة (ج)'
                : 'قيمة إيجار القاعة الشهري للسنتر (ج)'
            }
            htmlFor="tch-comp-val"
          >
            <TextInput
              id="tch-comp-val"
              type="number"
              value={compVal}
              onChange={(e) => setCompVal(e.target.value)}
              className="tabular-nums font-bold"
            />
          </Field>

          <label className="flex items-center justify-between p-3.5 rounded-[10px] bg-[#F4F7FA] border border-[#E2E8F0] cursor-pointer">
            <div>
              <p className="text-xs font-bold text-[#0F2A4A]">دعوة المدرس لتسجيل الدخول</p>
              <p className="text-[11px] text-[#5B6B80]">
                يسمح للمدرس برؤية مجموعاته ودرجات طلابه فقط
              </p>
            </div>
            <input
              type="checkbox"
              checked={hasLogin}
              onChange={(e) => setHasLogin(e.target.checked)}
              className="w-4 h-4 accent-[#0F766E]"
            />
          </label>
        </form>
      </Drawer>
    </div>
  );
};

// 7b) Teacher Profile (Tabs: المجموعات، المستحقات، الجدول)
export const TeacherProfileScreen: React.FC = () => {
  const {
    currentActor,
    currentRole,
    selectedTeacherId,
    teachers,
    groups,
    students,
    rooms,
    invoices,
    payments,
    sessions,
    settlements,
    centerSettings,
    settleTeacherMonth,
    showToast,
    navigate,
  } = useEduflow();

  const [tab, setTab] = useState<'groups' | 'revenue' | 'timetable'>('groups');

  // Phase 5: Teacher Settlement state
  const [settleMonth, setSettleMonth] = useState('2026-11');
  const [basis, setBasis] = useState<'cash' | 'invoiced'>(
    centerSettings.settlementBasis || 'cash'
  );
  const [manualLines, setManualLines] = useState<SettlementManualLine[]>([]);
  const [lineType, setLineType] = useState<SettlementManualLine['type']>('bonus');
  const [lineAmount, setLineAmount] = useState('');
  const [lineReason, setLineReason] = useState('');
  const [applyCarryForward, setApplyCarryForward] = useState(true);

  const [settleModalOpen, setSettleModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentRecord['method']>('نقدي');
  const [settleNote, setSettleNote] = useState('');
  const [recordAsExpense, setRecordAsExpense] = useState(true);
  const [activeSettlementReceipt, setActiveSettlementReceipt] =
    useState<SettlementRecord | null>(null);

  const teacher = teachers.find((t) => t.id === selectedTeacherId) || teachers[0];

  const teacherSettlementCalc = useMemo(() => {
    if (!teacher) return null;
    return calculateTeacherSettlement({
      teacher,
      groups,
      invoices,
      payments,
      sessions,
      settlements,
      monthInput: settleMonth,
      basis,
      manualLines,
      applyCarryForward,
    });
  }, [
    teacher,
    groups,
    invoices,
    payments,
    sessions,
    settlements,
    settleMonth,
    basis,
    manualLines,
    applyCarryForward,
  ]);

  if (!teacher) return null;

  const canViewTeacherShare = can(currentActor, 'view', 'teacherShares', {
    teacherId: teacher.id,
  });
  const canSettleTeacher = can(currentActor, 'settle', 'settlements');

  const teacherGroups = groups.filter((g) => g.teacherId === teacher.id);
  const teacherPastSettlements = settlements.filter((s) => s.teacherId === teacher.id);

  const availableTabs = [
    { id: 'groups' as const, label: `المجموعات (${teacherGroups.length})` },
    ...(canViewTeacherShare
      ? [{ id: 'revenue' as const, label: 'المستحقات' }]
      : []),
    { id: 'timetable' as const, label: 'الجدول الأسبوعي' },
  ];

  const activeTab =
    tab === 'revenue' && !canViewTeacherShare ? 'groups' : tab;

  const addManualLine = () => {
    const val = Number(lineAmount);
    if (!val || val <= 0 || !lineReason.trim()) {
      showToast('يرجى إدخال قيمة صحيحة وسبب واضح للبند اليدوي', 'error');
      return;
    }
    setManualLines((prev) => [
      ...prev,
      {
        id: `ml-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        type: lineType,
        amount: Math.round(val),
        reason: lineReason.trim(),
      },
    ]);
    setLineAmount('');
    setLineReason('');
  };

  return (
    <div className="space-y-5">
      {currentRole !== UserRole.TEACHER && (
        <button
          type="button"
          onClick={() => navigate(ScreenId.TEACHERS)}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#5B6B80] hover:text-[#0F2A4A] cursor-pointer"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة لقائمة المدرسين</span>
        </button>
      )}

      <Card className="p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <InitialAvatar name={teacher.name} size="lg" tint={teacher.color} />
            <div>
              <h2 className="text-xl font-bold text-[#0F2A4A]">{teacher.name}</h2>
              <p className="text-xs text-[#5B6B80] mt-1 tabular-nums">
                {teacher.subjects.join(' · ')} · هاتف: {teacher.phone}
              </p>
            </div>
          </div>
          {canViewTeacherShare && (
            <StatusChip
              tone="success"
              label={
                teacher.compensationType === 'percentage'
                  ? `نظام النسبة: ${teacher.compensationValue}% للمدرس`
                  : teacher.rentMode === 'per_session'
                  ? `إيجار قاعة: ${formatEGP(teacher.compensationValue)} / حصة`
                  : `إيجار شهري ثابت: ${formatEGP(teacher.compensationValue)}`
              }
            />
          )}
        </div>

        <div className="flex items-center gap-1 border-t border-[#E2E8F0] mt-5 pt-3">
          {availableTabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`px-4 py-2 rounded-[8px] text-xs font-bold cursor-pointer ${
                activeTab === item.id
                  ? 'bg-[#0F2A4A] text-white'
                  : 'text-[#5B6B80] hover:bg-slate-100'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </Card>

      {activeTab === 'groups' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {teacherGroups.length === 0 ? (
            <div className="md:col-span-2">
              <EmptyState
                title="لا توجد مجموعات مسندة لهذا المدرس"
                description="يمكنك إنشاء مجموعة جديدة واختيار المدرس من شاشة المجموعات."
              />
            </div>
          ) : (
            teacherGroups.map((g) => {
              const count = students.filter(
                (s) => s.status === 'active' && s.groupIds.includes(g.id)
              ).length;
              const rm = rooms.find((r) => r.id === g.roomId);
              return (
                <Card key={g.id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-[#0F2A4A]">{g.name}</h3>
                    <span className="text-xs font-bold text-[#0F766E] tabular-nums">
                      {formatEGP(g.monthlyPrice)}
                    </span>
                  </div>
                  <p className="text-xs text-[#5B6B80]">
                    {g.days.join('، ')} · {formatTimeRangeArabic(g.startTime, g.endTime)} ·{' '}
                    {rm?.name}
                  </p>
                  <div className="pt-2 flex items-center gap-2 text-xs font-semibold text-[#1E293B]">
                    <Users className="w-4 h-4 text-[#5B6B80]" />
                    <span className="tabular-nums">
                      {count} طالب مسجل من أصل {g.capacity}
                    </span>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}

      {activeTab === 'revenue' && canViewTeacherShare && teacherSettlementCalc && (
        <div className="space-y-5">
          {/* Month & Basis Controls */}
          <Card className="p-4 flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-wrap items-end gap-3">
              <Field label="الشهر المحاسبي" htmlFor="settle-month">
                <TextInput
                  id="settle-month"
                  type="month"
                  value={settleMonth}
                  onChange={(e) => setSettleMonth(e.target.value)}
                  className="tabular-nums w-44"
                />
              </Field>
              <Field label="أساس الاحتساب" htmlFor="settle-basis">
                <SelectInput
                  id="settle-basis"
                  value={basis}
                  onChange={(e) => setBasis(e.target.value as 'cash' | 'invoiced')}
                  className="w-48"
                >
                  <option value="cash">الأساس النقدي (المحصّل فعلياً)</option>
                  <option value="invoiced">أساس الاستحقاق (الفواتير المصدرة)</option>
                </SelectInput>
              </Field>
            </div>

            {teacherSettlementCalc.existingSettlement ? (
              <div className="flex items-center gap-2">
                <StatusChip tone="success" label="تمت التسوية لهذا الشهر" />
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<Receipt className="w-4 h-4 text-[#0F766E]" />}
                  onClick={() =>
                    setActiveSettlementReceipt(teacherSettlementCalc.existingSettlement!)
                  }
                >
                  عرض إيصال التسوية
                </Button>
              </div>
            ) : (
              canSettleTeacher && (
                <Button
                  icon={<Wallet className="w-4 h-4" />}
                  onClick={() => setSettleModalOpen(true)}
                >
                  تسوية وتسليم مستحقات الشهر
                </Button>
              )
            )}
          </Card>

          {/* Negative Net Warning */}
          {teacherSettlementCalc.hasNegativeWarning && (
            <Card className="p-4 bg-[#FEE2E2]/40 border-red-300 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-start gap-2.5 text-xs text-[#991B1B]">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">
                    تحذير: صافي مستحقات المدرس بالسالب ({formatEGP(teacherSettlementCalc.rawNetPayable)})
                  </p>
                  <p className="mt-0.5">
                    إجمالي الخصومات أو الإيجار أكبر من التحصيل. يمكنك ترحيل العجز للشهر القادم لصرف 0 ج حالياً.
                  </p>
                </div>
              </div>
              <label className="inline-flex items-center gap-2 text-xs font-bold text-[#0F2A4A] cursor-pointer">
                <input
                  type="checkbox"
                  checked={applyCarryForward}
                  onChange={(e) => setApplyCarryForward(e.target.checked)}
                  className="w-4 h-4 accent-[#0F766E]"
                />
                <span>ترحيل السالب للشهر التالي</span>
              </label>
            </Card>
          )}

          {/* Breakdown + Summary Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <Card padding="p-0" className="lg:col-span-7 overflow-hidden">
              <div className="px-4 py-3.5 border-b border-[#E2E8F0] bg-slate-50">
                <h3 className="text-sm font-bold text-[#0F2A4A]">
                  تفصيل تحصيل مجموعات المدرس ({teacherSettlementCalc.monthLabel})
                </h3>
              </div>
              <table className="w-full text-right border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] text-xs text-[#5B6B80]">
                    <th className="py-3 px-4">المجموعة</th>
                    <th className="py-3 px-4">الحصص المنعقدة</th>
                    <th className="py-3 px-4">
                      {basis === 'cash' ? 'المحصّل الفعلي' : 'إجمالي الفواتير'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {teacherSettlementCalc.groupBreakdowns.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-6 text-center text-xs text-[#5B6B80]">
                        لا توجد مجموعات لهذا المدرس.
                      </td>
                    </tr>
                  ) : (
                    teacherSettlementCalc.groupBreakdowns.map((gb) => (
                      <tr key={gb.groupId}>
                        <td className="py-3 px-4 font-bold text-[#1E293B]">{gb.groupName}</td>
                        <td className="py-3 px-4 tabular-nums text-xs text-[#5B6B80]">
                          {gb.sessionsHeld} حصة
                        </td>
                        <td className="py-3 px-4 tabular-nums font-bold text-[#0F766E]">
                          {formatEGP(gb.collected)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              {/* Manual Lines Builder */}
              {canSettleTeacher && !teacherSettlementCalc.existingSettlement && (
                <div className="p-4 border-t border-[#E2E8F0] bg-[#F4F7FA] space-y-3">
                  <p className="text-xs font-bold text-[#0F2A4A]">
                    بنود يدوية (سلف / مكافآت / خصومات إضافية)
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                    <div className="sm:col-span-3">
                      <SelectInput
                        aria-label="نوع البند"
                        value={lineType}
                        onChange={(e) =>
                          setLineType(e.target.value as SettlementManualLine['type'])
                        }
                      >
                        <option value="bonus">مكافأة (+)</option>
                        <option value="advance">سلفة (-)</option>
                        <option value="deduction">خصم (-)</option>
                      </SelectInput>
                    </div>
                    <div className="sm:col-span-3">
                      <TextInput
                        type="number"
                        placeholder="المبلغ (ج)"
                        value={lineAmount}
                        onChange={(e) => setLineAmount(e.target.value)}
                        className="tabular-nums"
                      />
                    </div>
                    <div className="sm:col-span-4">
                      <TextInput
                        placeholder="السبب (مطلوب)..."
                        value={lineReason}
                        onChange={(e) => setLineReason(e.target.value)}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Button size="sm" variant="secondary" className="w-full" onClick={addManualLine}>
                        إضافة
                      </Button>
                    </div>
                  </div>
                  {manualLines.length > 0 && (
                    <div className="space-y-1.5">
                      {manualLines.map((ml) => (
                        <div
                          key={ml.id}
                          className="flex items-center justify-between px-3 py-2 bg-white rounded-[8px] border border-[#E2E8F0] text-xs"
                        >
                          <div>
                            <StatusChip
                              tone={ml.type === 'bonus' ? 'success' : 'warning'}
                              label={
                                ml.type === 'bonus'
                                  ? 'مكافأة'
                                  : ml.type === 'advance'
                                  ? 'سلفة'
                                  : 'خصم'
                              }
                            />
                            <span className="mr-2 font-semibold text-[#1E293B]">{ml.reason}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="tabular-nums font-bold">
                              {ml.type === 'bonus' ? '+' : '-'}
                              {formatEGP(ml.amount)}
                            </span>
                            <button
                              type="button"
                              aria-label="حذف البند"
                              onClick={() =>
                                setManualLines((prev) => prev.filter((x) => x.id !== ml.id))
                              }
                              className="text-[#991B1B] cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Card>

            {/* Summary KPI Card */}
            <Card className="lg:col-span-5 p-5 space-y-3 h-fit">
              <h3 className="text-base font-bold text-[#0F2A4A]">ملخص التسوية المالية</h3>
              <div className="space-y-2.5 text-sm border-t border-[#E2E8F0] pt-3">
                <div className="flex justify-between">
                  <span className="text-[#5B6B80]">إجمالي التحصيل:</span>
                  <span className="font-bold tabular-nums">
                    {formatEGP(teacherSettlementCalc.totalCollected)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#5B6B80]">
                    خصم السنتر ({teacherSettlementCalc.centerDeductionLabel}):
                  </span>
                  <span className="font-bold tabular-nums text-[#991B1B]">
                    -{formatEGP(teacherSettlementCalc.centerDeduction)}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-100">
                  <span className="font-semibold text-[#0F2A4A]">إجمالي مستحق المدرس:</span>
                  <span className="font-bold tabular-nums">
                    {formatEGP(teacherSettlementCalc.teacherGross)}
                  </span>
                </div>
                {teacherSettlementCalc.bonusesTotal > 0 && (
                  <div className="flex justify-between text-xs text-[#065F46]">
                    <span>+ المكافآت الإضافية:</span>
                    <span className="tabular-nums font-bold">
                      +{formatEGP(teacherSettlementCalc.bonusesTotal)}
                    </span>
                  </div>
                )}
                {teacherSettlementCalc.advancesTotal + teacherSettlementCalc.deductionsTotal > 0 && (
                  <div className="flex justify-between text-xs text-[#991B1B]">
                    <span>- السلف والخصومات:</span>
                    <span className="tabular-nums font-bold">
                      -
                      {formatEGP(
                        teacherSettlementCalc.advancesTotal + teacherSettlementCalc.deductionsTotal
                      )}
                    </span>
                  </div>
                )}
                {teacherSettlementCalc.carriedForwardIn > 0 && (
                  <div className="flex justify-between text-xs text-[#92400E]">
                    <span>- رصيد سالب مرحّل من شهر سابق:</span>
                    <span className="tabular-nums font-bold">
                      -{formatEGP(teacherSettlementCalc.carriedForwardIn)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-3 border-t border-[#E2E8F0]">
                  <span className="font-bold text-[#0F2A4A]">صافي المستحق للصرف:</span>
                  <span className="text-2xl font-bold text-[#0F766E] tabular-nums">
                    {formatEGP(teacherSettlementCalc.netPayable)}
                  </span>
                </div>
                {teacherSettlementCalc.carriedForwardOut > 0 && (
                  <p className="text-xs font-semibold text-[#92400E] bg-[#FEF3C7] p-2 rounded-[6px]">
                    سيتم ترحيل عجز بقيمة {formatEGP(teacherSettlementCalc.carriedForwardOut)} للشهر القادم.
                  </p>
                )}
              </div>
            </Card>
          </div>

          {/* Past Settlements History */}
          {teacherPastSettlements.length > 0 && (
            <Card padding="p-0" className="overflow-hidden">
              <div className="px-4 py-3.5 border-b border-[#E2E8F0] bg-slate-50">
                <h3 className="text-sm font-bold text-[#0F2A4A]">سجل التسويات السابقة للمدرس</h3>
              </div>
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#E2E8F0] text-[#5B6B80]">
                    <th className="py-3 px-4">الشهر</th>
                    <th className="py-3 px-4">الإيراد</th>
                    <th className="py-3 px-4">حصة السنتر</th>
                    <th className="py-3 px-4">صافي الصرف</th>
                    <th className="py-3 px-4">التاريخ والطريقة</th>
                    <th className="py-3 px-4 text-left">إيصال</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {teacherPastSettlements.map((s) => (
                    <tr key={s.id}>
                      <td className="py-3 px-4 font-bold text-[#0F2A4A]">{s.month}</td>
                      <td className="py-3 px-4 tabular-nums">{formatEGP(s.grossRevenue)}</td>
                      <td className="py-3 px-4 tabular-nums">{formatEGP(s.centerDeduction ?? s.centerShare)}</td>
                      <td className="py-3 px-4 tabular-nums font-bold text-[#0F766E]">
                        {formatEGP(s.netPayable ?? s.teacherShare)}
                      </td>
                      <td className="py-3 px-4 tabular-nums text-[#5B6B80]">
                        {formatSettlementDate(s.settledAt)} · {s.paymentMethod || 'نقدي'}
                      </td>
                      <td className="py-3 px-4 text-left">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setActiveSettlementReceipt(s)}
                        >
                          عرض الإيصال
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      )}

      {activeTab === 'timetable' && (
        <Card className="p-5 space-y-3">
          <h3 className="text-sm font-bold text-[#0F2A4A] flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-[#0F766E]" />
            <span>الجدول الأسبوعي المصغر للمدرس</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {DAYS_ORDER.map((day) => {
              const dayGroups = teacherGroups.filter((g) => g.days.includes(day));
              return (
                <div
                  key={day}
                  className="p-3 rounded-[10px] bg-[#F4F7FA] border border-[#E2E8F0] space-y-2"
                >
                  <span className="text-xs font-bold text-[#0F2A4A] block">{day}</span>
                  {dayGroups.length === 0 ? (
                    <span className="text-xs text-[#5B6B80] block">لا توجد حصص</span>
                  ) : (
                    dayGroups.map((dg) => (
                      <div
                        key={dg.id}
                        className="p-2 rounded-[6px] bg-white border border-[#E2E8F0] text-xs"
                      >
                        <p className="font-bold text-[#1E293B]">{dg.name}</p>
                        <p className="text-[#0F766E] font-semibold tabular-nums mt-0.5">
                          {formatTimeRangeArabic(dg.startTime, dg.endTime)}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Settle & Pay Confirmation Modal */}
      <Modal
        open={settleModalOpen}
        onClose={() => setSettleModalOpen(false)}
        title={`تأكيد تسوية مستحقات — ${teacher.name}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setSettleModalOpen(false)}>
              إلغاء
            </Button>
            <Button
              onClick={() => {
                const created = settleTeacherMonth({
                  teacherId: teacher.id,
                  monthInput: settleMonth,
                  basis,
                  manualLines,
                  paymentMethod,
                  applyCarryForward,
                  note: settleNote,
                  recordAsExpense,
                });
                setSettleModalOpen(false);
                if (created) {
                  setManualLines([]);
                  setActiveSettlementReceipt(created);
                }
              }}
            >
              تأكيد التسوية وإصدار الإيصال
            </Button>
          </>
        }
      >
        {teacherSettlementCalc && (
          <div className="space-y-4 text-sm">
            <div className="p-3.5 rounded-[10px] bg-[#F4F7FA] border border-[#E2E8F0] space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span>الشهر:</span>
                <strong>{teacherSettlementCalc.monthLabel}</strong>
              </div>
              <div className="flex justify-between">
                <span>إجمالي التحصيل:</span>
                <strong className="tabular-nums">
                  {formatEGP(teacherSettlementCalc.totalCollected)}
                </strong>
              </div>
              <div className="flex justify-between">
                <span>خصم السنتر:</span>
                <strong className="tabular-nums text-[#991B1B]">
                  -{formatEGP(teacherSettlementCalc.centerDeduction)}
                </strong>
              </div>
              <div className="flex justify-between pt-2 border-t border-[#E2E8F0] text-sm">
                <span className="font-bold text-[#0F2A4A]">صافي المستحق للتسليم:</span>
                <strong className="tabular-nums text-[#0F766E]">
                  {formatEGP(teacherSettlementCalc.netPayable)}
                </strong>
              </div>
            </div>

            <Field label="طريقة التسليم" htmlFor="stl-method">
              <SelectInput
                id="stl-method"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentRecord['method'])}
              >
                <option value="نقدي">نقدي</option>
                <option value="تحويل بنكي">تحويل بنكي</option>
                <option value="محفظة">محفظة (فودافون كاش / أورانج)</option>
                <option value="إنستاباي">إنستاباي</option>
              </SelectInput>
            </Field>

            <Field label="ملاحظات التسوية (اختياري)" htmlFor="stl-note">
              <TextInput
                id="stl-note"
                placeholder="رقم الحوالة أو ملاحظات التسليم..."
                value={settleNote}
                onChange={(e) => setSettleNote(e.target.value)}
              />
            </Field>

            <label className="flex items-center gap-2 text-xs font-semibold text-[#1E293B] cursor-pointer">
              <input
                type="checkbox"
                checked={recordAsExpense}
                onChange={(e) => setRecordAsExpense(e.target.checked)}
                className="w-4 h-4 accent-[#0F766E]"
              />
              <span>تسجيل صافي المنصرف تلقائياً في بند مصروفات الرواتب</span>
            </label>
          </div>
        )}
      </Modal>

      {/* Settlement Receipt Modal */}
      <Modal
        open={Boolean(activeSettlementReceipt)}
        onClose={() => setActiveSettlementReceipt(null)}
        title="إيصال تسوية مستحقات مدرس"
        footer={
          <>
            <Button variant="secondary" onClick={() => setActiveSettlementReceipt(null)}>
              إغلاق
            </Button>
            <Button icon={<Printer className="w-4 h-4" />} onClick={() => window.print()}>
              طباعة إيصال التسوية
            </Button>
          </>
        }
      >
        {activeSettlementReceipt && (
          <div
            id="printable-receipt"
            className="p-4 rounded-[12px] border border-[#E2E8F0] space-y-3 text-sm bg-white"
          >
            <div className="text-center border-b border-dashed border-[#E2E8F0] pb-3">
              <CheckCircle2 className="w-8 h-8 text-[#0F766E] mx-auto mb-1" />
              <p className="font-bold text-[#0F2A4A]">{centerSettings.name}</p>
              <p className="text-xs text-[#5B6B80]">
                إيصال تسوية مستحقات — {activeSettlementReceipt.month}
              </p>
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-[#5B6B80]">المدرس:</span>
                <strong>{teacher.name}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5B6B80]">إجمالي التحصيل:</span>
                <span className="tabular-nums">
                  {formatEGP(activeSettlementReceipt.grossRevenue)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5B6B80]">حصة السنتر:</span>
                <span className="tabular-nums text-[#991B1B]">
                  -{formatEGP(activeSettlementReceipt.centerDeduction ?? activeSettlementReceipt.centerShare)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5B6B80]">تاريخ وطريقة التسليم:</span>
                <span className="tabular-nums">
                  {formatSettlementDate(activeSettlementReceipt.settledAt)} ·{' '}
                  {activeSettlementReceipt.paymentMethod || 'نقدي'}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-dashed border-[#E2E8F0] text-sm">
                <strong className="text-[#0F2A4A]">صافي المستلم:</strong>
                <strong className="tabular-nums text-[#0F766E]">
                  {formatEGP(activeSettlementReceipt.netPayable ?? activeSettlementReceipt.teacherShare)}
                </strong>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
