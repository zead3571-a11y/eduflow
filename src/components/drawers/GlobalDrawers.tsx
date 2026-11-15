import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  MessageCircle,
  Printer,
  Search,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { useEduflow } from '../../context/EduflowContext';
import { can } from '../../permissions/permissions';
import {
  Button,
  Drawer,
  EduflowLogo,
  Field,
  LockedFeatureCard,
  Modal,
  SelectInput,
  StatusChip,
  TextInput,
} from '../ui/Primitives';
import {
  DAYS_ORDER,
  detectGroupConflicts,
  formatEGP,
  formatTimeRangeArabic,
  validatePaymentAmount,
} from '../../utils/eduflowLogic';
import { DayOfWeek, PaymentRecord, ScreenId, StandingDiscountConfig } from '../../types/eduflow';
import { generateQrDataUrl } from '../../features/qr/qrService';
import { buildReceiptMessage, buildWhatsAppUrl } from '../../features/messaging/whatsappService';

// 5) Add / Edit Student Right-Side Drawer
export const StudentFormDrawer: React.FC = () => {
  const {
    currentActor,
    studentDrawerOpen,
    editingStudent,
    closeStudentDrawer,
    students,
    stages,
    groups,
    saveStudent,
    deactivateStudent,
    setSelectedStudentId,
    navigate,
  } = useEduflow();

  const canManageDiscounts = can(currentActor, 'create', 'discounts');

  const [name, setName] = useState('');
  const [stage, setStage] = useState(stages[6] || 'الصف الثالث الثانوي');
  const [phone, setPhone] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [feeOverride, setFeeOverride] = useState('');
  const [discountType, setDiscountType] = useState<'none' | 'scholarship' | 'waiver'>('none');
  const [discountValue, setDiscountValue] = useState('');
  const [discountReason, setDiscountReason] = useState('');
  const [discountValidFrom, setDiscountValidFrom] = useState('');
  const [discountValidTo, setDiscountValidTo] = useState('');
  const [noteText, setNoteText] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirmDeactivateOpen, setConfirmDeactivateOpen] = useState(false);

  useEffect(() => {
    if (editingStudent) {
      setName(editingStudent.name);
      setStage(editingStudent.stage);
      setPhone(editingStudent.phone || '');
      setParentName(editingStudent.parentName);
      setParentPhone(editingStudent.parentPhone);
      setSelectedGroupIds(editingStudent.groupIds);
      setFeeOverride(
        editingStudent.monthlyFeeOverride ? String(editingStudent.monthlyFeeOverride) : ''
      );
      if (editingStudent.standingDiscountConfig) {
        setDiscountType(editingStudent.standingDiscountConfig.type);
        setDiscountValue(String(editingStudent.standingDiscountConfig.value));
        setDiscountReason(editingStudent.standingDiscountConfig.reason);
        setDiscountValidFrom(editingStudent.standingDiscountConfig.validFrom || '');
        setDiscountValidTo(editingStudent.standingDiscountConfig.validTo || '');
      } else {
        setDiscountType('none');
        setDiscountValue('');
        setDiscountReason('');
        setDiscountValidFrom('');
        setDiscountValidTo('');
      }
      setNoteText('');
      setErrors({});
    } else {
      setName('');
      setStage(stages[6] || 'الصف الثالث الثانوي');
      setPhone('');
      setParentName('');
      setParentPhone('');
      setSelectedGroupIds([]);
      setFeeOverride('');
      setDiscountType('none');
      setDiscountValue('');
      setDiscountReason('');
      setDiscountValidFrom('');
      setDiscountValidTo('');
      setNoteText('');
      setErrors({});
    }
  }, [editingStudent, studentDrawerOpen, stages]);

  const duplicateStudent = useMemo(() => {
    const clean = parentPhone.trim();
    if (clean.length < 8) return null;
    return (
      students.find(
        (s) => s.parentPhone === clean && (!editingStudent || s.id !== editingStudent.id)
      ) || null
    );
  }, [parentPhone, students, editingStudent]);

  const toggleGroup = (gid: string) => {
    setSelectedGroupIds((prev) =>
      prev.includes(gid) ? prev.filter((x) => x !== gid) : [...prev, gid]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!name.trim() || name.trim().length < 5) {
      nextErrors.name = 'يرجى إدخال الاسم الثلاثي للطالب على الأقل.';
    }
    if (!parentName.trim()) {
      nextErrors.parentName = 'اسم ولي الأمر مطلوب.';
    }
    if (!/^01[0125][0-9]{8}$/.test(parentPhone.trim())) {
      nextErrors.parentPhone = 'أدخل رقم موبايل مصري صحيح مكون من 11 رقم (مثال: 01001234567).';
    }
    if (selectedGroupIds.length === 0) {
      nextErrors.groups = 'اختر مجموعة واحدة على الأقل لتسجيل الطالب بها.';
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setSaving(true);
    setTimeout(() => {
      const standingDiscountConfig: StandingDiscountConfig | undefined =
        canManageDiscounts && discountType !== 'none' && Number(discountValue) > 0
          ? {
              type: discountType,
              value:
                discountType === 'scholarship'
                  ? Math.min(100, Math.max(0, Number(discountValue)))
                  : Math.max(0, Number(discountValue)),
              reason: discountReason.trim() || 'منحة / خصم إداري دائم',
              validFrom: discountValidFrom || undefined,
              validTo: discountValidTo || undefined,
            }
          : undefined;

      const saved = saveStudent(
        {
          name: name.trim(),
          stage,
          phone: phone.trim() || undefined,
          parentName: parentName.trim(),
          parentPhone: parentPhone.trim(),
          groupIds: selectedGroupIds,
          monthlyFeeOverride: feeOverride ? Number(feeOverride) : undefined,
          standingDiscountConfig,
          standingDiscount:
            standingDiscountConfig?.type === 'waiver' ? standingDiscountConfig.value : undefined,
          status: editingStudent ? editingStudent.status : 'active',
        },
        editingStudent?.id
      );
      if (noteText.trim() && saved) {
        saved.notes.unshift({
          id: `n-${Date.now()}`,
          date: '12 نوفمبر 2026',
          author: 'إدارة السنتر',
          text: noteText.trim(),
        });
      }
      setSaving(false);
      closeStudentDrawer();
    }, 250);
  };

  const selectedGroupObjects = groups.filter((g) => selectedGroupIds.includes(g.id));

  return (
    <>
      <Drawer
        open={studentDrawerOpen}
        onClose={closeStudentDrawer}
        title={editingStudent ? 'تعديل بيانات الطالب' : 'إضافة طالب جديد'}
        subtitle="أدخل البيانات الأساسية والمجموعات المسجل بها الطالب"
        wide
        footer={
          <>
            <Button variant="secondary" onClick={closeStudentDrawer}>
              إلغاء
            </Button>
            <Button onClick={handleSubmit} loading={saving}>
              حفظ البيانات
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="اسم الطالب رباعياً" htmlFor="st-name" required error={errors.name}>
            <TextInput
              id="st-name"
              placeholder="مثال: يوسف أحمد محمود عبد اللطيف"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setErrors((p) => ({ ...p, name: '' }));
              }}
              hasError={Boolean(errors.name)}
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Field label="المرحلة الدراسية" htmlFor="st-stage" required>
              <SelectInput
                id="st-stage"
                value={stage}
                onChange={(e) => setStage(e.target.value)}
              >
                {stages.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </SelectInput>
            </Field>

            <Field label="موبايل الطالب (اختياري)" htmlFor="st-phone">
              <TextInput
                id="st-phone"
                dir="ltr"
                className="text-right tabular-nums"
                placeholder="010XXXXXXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Field label="اسم ولي الأمر" htmlFor="st-parent-name" required error={errors.parentName}>
              <TextInput
                id="st-parent-name"
                placeholder="الاسم الكامل لولي الأمر"
                value={parentName}
                onChange={(e) => {
                  setParentName(e.target.value);
                  setErrors((p) => ({ ...p, parentName: '' }));
                }}
                hasError={Boolean(errors.parentName)}
              />
            </Field>

            <Field
              label="موبايل ولي الأمر"
              htmlFor="st-parent-phone"
              required
              error={errors.parentPhone}
              hint="تُرسل تنبيهات الغياب وتأخر السداد إلى هذا الرقم."
            >
              <TextInput
                id="st-parent-phone"
                dir="ltr"
                className="text-right tabular-nums"
                placeholder="01002349871"
                value={parentPhone}
                onChange={(e) => {
                  setParentPhone(e.target.value);
                  setErrors((p) => ({ ...p, parentPhone: '' }));
                }}
                hasError={Boolean(errors.parentPhone)}
              />
            </Field>
          </div>

          {duplicateStudent && (
            <div className="p-3.5 rounded-[8px] bg-[#FEF3C7] border border-amber-300 text-[#92400E] text-xs flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">تنبيه: رقم ولي الأمر مسجّل لطالب آخر</p>
                  <p className="mt-0.5">
                    الرقم مرتبط بالطالب <strong>{duplicateStudent.name}</strong> ({duplicateStudent.stage}). يمكنك المتابعة إذا كان أخاً له.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  closeStudentDrawer();
                  setSelectedStudentId(duplicateStudent.id);
                  navigate(ScreenId.STUDENT_PROFILE);
                }}
                className="underline font-bold shrink-0 hover:text-amber-950 cursor-pointer"
              >
                عرض الطالب الحالي
              </button>
            </div>
          )}

          <Field label="المجموعات المسجل بها" required error={errors.groups}>
            <div className="border border-[#E2E8F0] rounded-[8px] divide-y divide-[#E2E8F0] max-h-48 overflow-y-auto">
              {groups.map((g) => {
                const checked = selectedGroupIds.includes(g.id);
                return (
                  <label
                    key={g.id}
                    className={`flex items-center justify-between px-3.5 py-2.5 text-xs cursor-pointer transition-colors ${
                      checked ? 'bg-[#0F766E]/5' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          toggleGroup(g.id);
                          setErrors((p) => ({ ...p, groups: '' }));
                        }}
                        className="w-4 h-4 accent-[#0F766E] rounded"
                      />
                      <div>
                        <p className="font-bold text-[#1E293B]">{g.name}</p>
                        <p className="text-[#5B6B80]">
                          {g.days.join('، ')} · {formatTimeRangeArabic(g.startTime, g.endTime)}
                        </p>
                      </div>
                    </div>
                    <span className="font-bold text-[#0F2A4A] tabular-nums">
                      {formatEGP(g.monthlyPrice)}
                    </span>
                  </label>
                );
              })}
            </div>
          </Field>

          {selectedGroupObjects.length > 0 && (
            <div className="p-3 rounded-[8px] bg-[#F4F7FA] border border-[#E2E8F0]">
              <p className="text-xs font-bold text-[#0F2A4A] mb-1.5">معاينة مواعيد الطالب الأسبوعية</p>
              <div className="space-y-1">
                {selectedGroupObjects.map((g) => (
                  <div key={g.id} className="flex items-center justify-between text-xs text-[#5B6B80]">
                    <span>{g.name}</span>
                    <span className="tabular-nums font-medium text-[#1E293B]">
                      {g.days.join(' / ')} ({formatTimeRangeArabic(g.startTime, g.endTime)})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Field
            label="قيمة اشتراك شهري مخصصة (اختياري)"
            htmlFor="st-fee-override"
            hint="اتركه فارغاً لحساب السعر الافتراضي للمجموعات تلقائياً."
          >
            <TextInput
              id="st-fee-override"
              type="number"
              min="0"
              placeholder="مثال: 850"
              value={feeOverride}
              onChange={(e) => setFeeOverride(e.target.value)}
              className="tabular-nums"
            />
          </Field>

          {canManageDiscounts && (
            <div className="p-3.5 rounded-[10px] bg-[#F4F7FA] border border-[#E2E8F0] space-y-3">
              <p className="text-xs font-bold text-[#0F2A4A]">الخصم / المنحة الدائمة على ملف الطالب</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="نوع الخصم الدائم" htmlFor="st-disc-type">
                  <SelectInput
                    id="st-disc-type"
                    value={discountType}
                    onChange={(e) =>
                      setDiscountType(e.target.value as 'none' | 'scholarship' | 'waiver')
                    }
                  >
                    <option value="none">بدون خصم دائم</option>
                    <option value="scholarship">منحة دراسية (نسبة % حتى 100%)</option>
                    <option value="waiver">إعفاء جزئي (مبلغ ثابت ج)</option>
                  </SelectInput>
                </Field>
                {discountType !== 'none' && (
                  <Field
                    label={discountType === 'scholarship' ? 'نسبة المنحة (%)' : 'قيمة الإعفاء (ج)'}
                    htmlFor="st-disc-val"
                  >
                    <TextInput
                      id="st-disc-val"
                      type="number"
                      min="1"
                      max={discountType === 'scholarship' ? '100' : undefined}
                      placeholder={discountType === 'scholarship' ? 'مثال: 100' : 'مثال: 150'}
                      value={discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                      className="tabular-nums"
                    />
                  </Field>
                )}
              </div>
              {discountType !== 'none' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <Field label="سبب المنحة / الخصم" htmlFor="st-disc-reason">
                    <TextInput
                      id="st-disc-reason"
                      placeholder="مثال: تفوق علمي"
                      value={discountReason}
                      onChange={(e) => setDiscountReason(e.target.value)}
                    />
                  </Field>
                  <Field label="صالح من" htmlFor="st-disc-from">
                    <TextInput
                      id="st-disc-from"
                      type="date"
                      value={discountValidFrom}
                      onChange={(e) => setDiscountValidFrom(e.target.value)}
                      className="tabular-nums"
                    />
                  </Field>
                  <Field label="صالح إلى" htmlFor="st-disc-to">
                    <TextInput
                      id="st-disc-to"
                      type="date"
                      value={discountValidTo}
                      onChange={(e) => setDiscountValidTo(e.target.value)}
                      className="tabular-nums"
                    />
                  </Field>
                </div>
              )}
            </div>
          )}

          <Field label="ملاحظات إدارية (اختياري)" htmlFor="st-notes">
            <textarea
              id="st-notes"
              rows={2}
              placeholder="أي ملاحظات حول المستوى الدراسي أو نظام السداد..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              className="w-full p-3 rounded-[8px] bg-white border border-[#E2E8F0] text-sm text-[#1E293B] focus:outline-none focus:border-[#0F766E]"
            />
          </Field>

          {editingStudent && editingStudent.status === 'active' && (
            <div className="pt-4 mt-4 border-t border-[#FEE2E2]">
              <div className="p-4 rounded-[10px] bg-[#FEE2E2]/40 border border-[#FEE2E2] flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-[#991B1B]">منطقة الخطر: إيقاف قيد الطالب</p>
                  <p className="text-xs text-[#5B6B80] mt-0.5">
                    سيتم استبعاد الطالب من قوائم الحضور والفواتير القادمة مع الاحتفاظ بسجله المالي.
                  </p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  icon={<Trash2 className="w-3.5 h-3.5" />}
                  onClick={() => setConfirmDeactivateOpen(true)}
                >
                  إيقاف الطالب
                </Button>
              </div>
            </div>
          )}
        </form>
      </Drawer>

      <Modal
        open={confirmDeactivateOpen}
        onClose={() => setConfirmDeactivateOpen(false)}
        title="تأكيد إيقاف قيد الطالب"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDeactivateOpen(false)}>
              تراجع
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (editingStudent) {
                  deactivateStudent(editingStudent.id);
                }
                setConfirmDeactivateOpen(false);
                closeStudentDrawer();
              }}
            >
              نعم، إيقاف القيد
            </Button>
          </>
        }
      >
        <p className="text-sm text-[#1E293B]">
          هل أنت متأكد من إيقاف الطالب <strong>{editingStudent?.name}</strong>؟ لن يظهر اسمه في كشوف الحضور اليومية الجديدة، ويمكنك إعادة تفعيله لاحقاً.
        </p>
      </Modal>
    </>
  );
};

// 13) Record Payment Drawer & Printable Receipt
export const RecordPaymentDrawerAndReceipt: React.FC = () => {
  const {
    paymentDrawerOpen,
    paymentPreselectedStudentId,
    paymentPreselectedInvoiceId,
    closeRecordPayment,
    students,
    groups,
    invoices,
    recordPayment,
    activeReceipt,
    setActiveReceipt,
    centerSettings,
    openPdfExport,
    queueWhatsAppMessages,
    showToast,
  } = useEduflow();

  const [studentQuery, setStudentQuery] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>('');
  const [amountStr, setAmountStr] = useState<string>('');
  const [method, setMethod] = useState<PaymentRecord['method']>('نقدي');
  const [date, setDate] = useState<string>('2026-11-12');
  const [note, setNote] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [receiptFormat, setReceiptFormat] = useState<'a5' | 'thermal80'>(
    centerSettings.receiptSettings?.defaultFormat || 'a5'
  );
  const [receiptQrUrl, setReceiptQrUrl] = useState<string>('');

  useEffect(() => {
    setReceiptFormat(centerSettings.receiptSettings?.defaultFormat || 'a5');
  }, [centerSettings.receiptSettings?.defaultFormat, activeReceipt?.id]);

  useEffect(() => {
    if (!activeReceipt) {
      setReceiptQrUrl('');
      return;
    }
    let cancelled = false;
    generateQrDataUrl(`EDUFLOW:RECEIPT:${activeReceipt.receiptNumber}:${activeReceipt.amount}`)
      .then((url) => {
        if (!cancelled) setReceiptQrUrl(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [activeReceipt]);

  const openInvoices = useMemo(
    () => invoices.filter((inv) => inv.status !== 'paid'),
    [invoices]
  );

  useEffect(() => {
    if (!paymentDrawerOpen) return;
    setErrorMsg('');
    setNote('');
    if (paymentPreselectedInvoiceId) {
      const inv = invoices.find((i) => i.id === paymentPreselectedInvoiceId);
      if (inv) {
        setSelectedStudentId(inv.studentId);
        setSelectedInvoiceId(inv.id);
        setAmountStr(String(Math.max(0, inv.total - inv.paid)));
        return;
      }
    }
    if (paymentPreselectedStudentId) {
      setSelectedStudentId(paymentPreselectedStudentId);
      const firstOpen = openInvoices.find((i) => i.studentId === paymentPreselectedStudentId);
      if (firstOpen) {
        setSelectedInvoiceId(firstOpen.id);
        setAmountStr(String(Math.max(0, firstOpen.total - firstOpen.paid)));
      } else {
        setSelectedInvoiceId('');
        setAmountStr('');
      }
      return;
    }
    // Default pick first open invoice
    if (openInvoices.length > 0) {
      const first = openInvoices[0];
      setSelectedStudentId(first.studentId);
      setSelectedInvoiceId(first.id);
      setAmountStr(String(Math.max(0, first.total - first.paid)));
    }
  }, [
    paymentDrawerOpen,
    paymentPreselectedStudentId,
    paymentPreselectedInvoiceId,
    invoices,
    openInvoices,
  ]);

  const filteredStudents = useMemo(() => {
    const q = studentQuery.trim();
    if (!q) return students.filter((s) => s.status === 'active');
    return students.filter(
      (s) => s.name.includes(q) || s.parentPhone.includes(q)
    );
  }, [students, studentQuery]);

  const studentOpenInvoices = useMemo(
    () => openInvoices.filter((inv) => inv.studentId === selectedStudentId),
    [openInvoices, selectedStudentId]
  );

  const selectedInvoice = useMemo(
    () => studentOpenInvoices.find((inv) => inv.id === selectedInvoiceId) || null,
    [studentOpenInvoices, selectedInvoiceId]
  );

  const remainingBalance = selectedInvoice
    ? Math.max(0, selectedInvoice.total - selectedInvoice.paid)
    : 0;

  const numericAmount = Number(amountStr);
  const validation = selectedInvoice
    ? validatePaymentAmount(numericAmount, remainingBalance)
    : { valid: false, remainingAfter: 0 };

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) {
      setErrorMsg('يرجى اختيار فاتورة مفتوحة للسداد.');
      return;
    }
    const check = validatePaymentAmount(numericAmount, remainingBalance);
    if (!check.valid) {
      setErrorMsg(check.error || 'قيمة المبلغ غير صحيحة.');
      return;
    }
    const createdReceipt = recordPayment({
      invoiceId: selectedInvoice.id,
      amount: numericAmount,
      method,
      date,
      note: note.trim() || undefined,
    });
    if (createdReceipt) {
      closeRecordPayment();
      setActiveReceipt(createdReceipt);
    }
  };

  const receiptStudent = activeReceipt
    ? students.find((s) => s.id === activeReceipt.studentId)
    : null;
  const receiptGroup = activeReceipt
    ? groups.find((g) => g.id === activeReceipt.groupId)
    : null;
  const receiptInvoice = activeReceipt
    ? invoices.find((i) => i.id === activeReceipt.invoiceId)
    : null;

  const receiptWhatsAppText = activeReceipt
    ? buildReceiptMessage({
        centerName: centerSettings.name,
        student: receiptStudent || undefined,
        group: receiptGroup || undefined,
        payment: activeReceipt,
      })
    : '';

  const receiptWhatsAppUrl =
    activeReceipt && receiptStudent?.parentPhone
      ? buildWhatsAppUrl(receiptStudent.parentPhone, receiptWhatsAppText)
      : '';

  const handleOpenReceiptPdf = () => {
    if (!activeReceipt) return;
    openPdfExport({
      kind: 'financial_summary',
      documentCode: activeReceipt.receiptNumber,
      title: `إيصال سداد رسمي #${activeReceipt.receiptNumber}`,
      subtitle: `${receiptStudent?.name || ''} — ${receiptGroup?.name || ''}`,
      periodLabel: `تاريخ التحصيل: ${activeReceipt.date}`,
      generatedAt: activeReceipt.date,
      centerName: centerSettings.name,
      centerAddress: `${centerSettings.address}، ${centerSettings.city}`,
      centerPhone: centerSettings.phone,
      parentPhone: receiptStudent?.parentPhone,
      kpis: [
        { label: 'المبلغ المسدد', value: formatEGP(activeReceipt.amount), tone: 'success' },
        { label: 'طريقة الدفع', value: activeReceipt.method, tone: 'navy' },
        {
          label: 'المتبقي على الفاتورة',
          value: formatEGP(activeReceipt.remainingAfter),
          tone: activeReceipt.remainingAfter > 0 ? 'warning' : 'teal',
        },
      ],
      tables: [
        {
          title: 'تفاصيل الإيصال المالي',
          columns: [
            { key: 'field', label: 'البيان' },
            { key: 'val', label: 'التفاصيل', align: 'left', tabular: true },
          ],
          rows: [
            { field: 'رقم الإيصال', val: activeReceipt.receiptNumber },
            { field: 'الطالب', val: `${receiptStudent?.name || ''} (${receiptStudent?.code || ''})` },
            { field: 'المجموعة', val: receiptGroup?.name || '' },
            { field: 'الشهر', val: receiptInvoice?.month || '—' },
            { field: 'السعر الأساسي', val: formatEGP(receiptInvoice?.baseAmount ?? activeReceipt.amount) },
            ...(receiptInvoice?.discountLines || []).map((d) => ({
              field: `خصم: ${d.label}`,
              val: `- ${formatEGP(d.amount)}`,
            })),
            { field: 'المبلغ المدفوع', val: formatEGP(activeReceipt.amount) },
            { field: 'المتبقي', val: formatEGP(activeReceipt.remainingAfter) },
            { field: 'المحصّل', val: activeReceipt.recordedBy },
          ],
        },
      ],
      shareText: receiptWhatsAppText,
    });
  };

  return (
    <>
      <Drawer
        open={paymentDrawerOpen}
        onClose={closeRecordPayment}
        title="تسجيل دفعة مالية"
        subtitle="اختر الطالب والفاتورة المستحقة لإصدار إيصال فوري"
        footer={
          <>
            <Button variant="secondary" onClick={closeRecordPayment}>
              إلغاء
            </Button>
            <Button onClick={handleConfirm}>تأكيد التحصيل وإصدار إيصال</Button>
          </>
        }
      >
        <form onSubmit={handleConfirm} className="space-y-4">
          <Field label="البحث عن الطالب (بالاسم أو رقم ولي الأمر)" htmlFor="pay-student-search">
            <div className="relative">
              <Search className="w-4 h-4 text-[#5B6B80] absolute right-3.5 top-3.5 pointer-events-none" />
              <TextInput
                id="pay-student-search"
                className="pr-10"
                placeholder="ابحث باسم الطالب..."
                value={studentQuery}
                onChange={(e) => setStudentQuery(e.target.value)}
              />
            </div>
          </Field>

          <Field label="الطالب" htmlFor="pay-student-select" required>
            <SelectInput
              id="pay-student-select"
              value={selectedStudentId}
              onChange={(e) => {
                const sid = e.target.value;
                setSelectedStudentId(sid);
                const firstInv = openInvoices.find((i) => i.studentId === sid);
                setSelectedInvoiceId(firstInv ? firstInv.id : '');
                setAmountStr(firstInv ? String(firstInv.total - firstInv.paid) : '');
                setErrorMsg('');
              }}
            >
              <option value="">-- اختر الطالب --</option>
              {filteredStudents.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.stage})
                </option>
              ))}
            </SelectInput>
          </Field>

          <Field label="الفواتير المفتوحة للطالب" required>
            {studentOpenInvoices.length === 0 ? (
              <div className="p-4 rounded-[8px] bg-[#F4F7FA] border border-[#E2E8F0] text-xs text-[#5B6B80] text-center">
                لا توجد فواتير مستحقة أو متأخرة لهذا الطالب حالياً.
              </div>
            ) : (
              <div className="space-y-2">
                {studentOpenInvoices.map((inv) => {
                  const grp = groups.find((g) => g.id === inv.groupId);
                  const rem = inv.total - inv.paid;
                  const checked = inv.id === selectedInvoiceId;
                  return (
                    <label
                      key={inv.id}
                      className={`flex items-center justify-between p-3 rounded-[8px] border cursor-pointer transition-colors ${
                        checked
                          ? 'border-[#0F766E] bg-[#0F766E]/5'
                          : 'border-[#E2E8F0] hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="radio"
                          name="open-invoice"
                          checked={checked}
                          onChange={() => {
                            setSelectedInvoiceId(inv.id);
                            setAmountStr(String(rem));
                            setErrorMsg('');
                          }}
                          className="w-4 h-4 accent-[#0F766E]"
                        />
                        <div>
                          <p className="text-xs font-bold text-[#1E293B]">
                            {grp?.name || 'مجموعة دراسية'} — {inv.month}
                          </p>
                          <p className="text-[11px] text-[#5B6B80] tabular-nums">
                            رقم الفاتورة: {inv.invoiceNumber} · الصافي {formatEGP(inv.total)}
                          </p>
                        </div>
                      </div>
                      <div className="text-left">
                        <span className="text-xs font-bold text-[#0F2A4A] tabular-nums block">
                          المتبقي: {formatEGP(rem)}
                        </span>
                        <StatusChip
                          tone={inv.status === 'overdue' ? 'danger' : 'warning'}
                          label={inv.status === 'overdue' ? 'متأخر' : inv.paid > 0 ? 'جزئي' : 'مستحق'}
                        />
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Field
              label="المبلغ المحصّل (ج)"
              htmlFor="pay-amount"
              required
              error={errorMsg}
            >
              <TextInput
                id="pay-amount"
                type="number"
                min="1"
                value={amountStr}
                onChange={(e) => {
                  setAmountStr(e.target.value);
                  setErrorMsg('');
                }}
                hasError={Boolean(errorMsg)}
                className="tabular-nums font-bold"
              />
            </Field>

            <Field label="طريقة الدفع" htmlFor="pay-method" required>
              <SelectInput
                id="pay-method"
                value={method}
                onChange={(e) => setMethod(e.target.value as PaymentRecord['method'])}
              >
                <option value="نقدي">نقدي (الخزينة)</option>
                <option value="إنستاباي">إنستاباي (InstaPay)</option>
                <option value="محفظة">محفظة إلكترونية</option>
                <option value="تحويل بنكي">تحويل بنكي</option>
              </SelectInput>
            </Field>
          </div>

          {selectedInvoice && numericAmount > 0 && validation.valid && (
            <div className="p-3 rounded-[8px] bg-[#F4F7FA] border border-[#E2E8F0] flex items-center justify-between text-xs">
              <span className="text-[#5B6B80]">الرصيد المتبقي بعد هذه الدفعة:</span>
              <span
                className={`font-bold tabular-nums ${
                  validation.remainingAfter === 0 ? 'text-[#065F46]' : 'text-[#92400E]'
                }`}
              >
                {validation.remainingAfter === 0
                  ? '0 ج (سداد كامل)'
                  : `${formatEGP(validation.remainingAfter)} (سداد جزئي)`}
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Field label="تاريخ التحصيل" htmlFor="pay-date">
              <TextInput
                id="pay-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="tabular-nums"
              />
            </Field>
            <Field label="ملاحظة (اختياري)" htmlFor="pay-note">
              <TextInput
                id="pay-note"
                placeholder="مثال: دفعة تحت الحساب"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </Field>
          </div>
        </form>
      </Drawer>

      {/* Receipt Modal: A5 & Thermal 80mm + PDF + WhatsApp */}
      <Modal
        open={Boolean(activeReceipt)}
        onClose={() => setActiveReceipt(null)}
        title="إيصال سداد رسوم دراسية"
        maxWidth={receiptFormat === 'a5' ? 'max-w-xl' : 'max-w-md'}
        footer={
          <div className="w-full flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-[8px] text-xs">
              <button
                type="button"
                onClick={() => setReceiptFormat('a5')}
                className={`px-3 py-1.5 rounded-[6px] font-bold cursor-pointer ${
                  receiptFormat === 'a5' ? 'bg-white text-[#0F2A4A] shadow-xs' : 'text-[#5B6B80]'
                }`}
              >
                مقاس A5
              </button>
              <button
                type="button"
                onClick={() => setReceiptFormat('thermal80')}
                className={`px-3 py-1.5 rounded-[6px] font-bold cursor-pointer ${
                  receiptFormat === 'thermal80'
                    ? 'bg-white text-[#0F2A4A] shadow-xs'
                    : 'text-[#5B6B80]'
                }`}
              >
                حراري 80mm
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {receiptWhatsAppUrl && (
                <a
                  href={receiptWhatsAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    if (!activeReceipt || !receiptStudent) return;
                    queueWhatsAppMessages([
                      {
                        studentId: receiptStudent.id,
                        recipientName: receiptStudent.parentName,
                        recipientPhone: receiptStudent.parentPhone,
                        templateId: 'receipt',
                        body: receiptWhatsAppText,
                      },
                    ]);
                    showToast('تم حفظ نسخة الإيصال في سجل رسائل واتساب');
                  }}
                  className="min-h-[44px] px-3.5 rounded-[8px] border border-[#0F766E] text-[#0F766E] bg-white hover:bg-[#0F766E]/5 text-xs font-bold inline-flex items-center gap-1.5"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>إرسال واتساب</span>
                </a>
              )}
              <Button
                variant="secondary"
                icon={<FileText className="w-4 h-4 text-[#0F766E]" />}
                onClick={handleOpenReceiptPdf}
              >
                تصدير PDF
              </Button>
              <Button
                variant="secondary"
                icon={<Printer className="w-4 h-4" />}
                onClick={() => window.print()}
              >
                {receiptFormat === 'thermal80' ? 'طباعة حرارية 80mm' : 'طباعة A5'}
              </Button>
              <Button onClick={() => setActiveReceipt(null)}>تم</Button>
            </div>
          </div>
        }
      >
        {activeReceipt && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 rounded-[8px] bg-[#D1FAE5] text-[#065F46] text-xs font-bold">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>تم تسجيل الدفعة بنجاح وتحديث كشف حساب الطالب.</span>
            </div>

            {receiptFormat === 'thermal80' ? (
              <div
                id="printable-receipt"
                className="thermal-80mm max-w-[302px] mx-auto border border-dashed border-slate-400 rounded-[8px] bg-white p-4 text-xs text-[#1E293B] space-y-2.5"
              >
                <div className="text-center border-b border-dashed border-slate-300 pb-2.5 space-y-0.5">
                  <p className="text-sm font-bold text-[#0F2A4A]">{centerSettings.name}</p>
                  {centerSettings.receiptSettings?.headerNote && (
                    <p className="text-[11px] text-[#5B6B80]">
                      {centerSettings.receiptSettings.headerNote}
                    </p>
                  )}
                  <p className="text-[11px] text-[#5B6B80] tabular-nums">{centerSettings.phone}</p>
                  <p className="font-bold text-[#0F2A4A] tabular-nums pt-1">
                    إيصال #{activeReceipt.receiptNumber}
                  </p>
                </div>

                <div className="space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-[#5B6B80]">التاريخ:</span>
                    <span className="tabular-nums font-semibold">{activeReceipt.date}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#5B6B80]">الطالب:</span>
                    <span className="font-bold">{receiptStudent?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#5B6B80]">الكود:</span>
                    <span className="tabular-nums">{receiptStudent?.code}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#5B6B80]">المجموعة:</span>
                    <span className="font-semibold">{receiptGroup?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#5B6B80]">الطريقة:</span>
                    <span>{activeReceipt.method}</span>
                  </div>
                </div>

                <div className="border-t border-b border-dashed border-slate-300 py-2 space-y-1 text-[11px]">
                  {receiptInvoice && (
                    <div className="flex justify-between">
                      <span>السعر الأساسي:</span>
                      <span className="tabular-nums">{formatEGP(receiptInvoice.baseAmount)}</span>
                    </div>
                  )}
                  {(receiptInvoice?.discountLines || []).map((dl) => (
                    <div key={dl.id} className="flex justify-between text-[#065F46]">
                      <span>{dl.label}:</span>
                      <span className="tabular-nums">- {formatEGP(dl.amount)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-bold text-sm text-[#0F2A4A] pt-1">
                    <span>المدفوع الآن:</span>
                    <span className="tabular-nums">{formatEGP(activeReceipt.amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>المتبقي:</span>
                    <span className="tabular-nums font-bold">
                      {formatEGP(activeReceipt.remainingAfter)}
                    </span>
                  </div>
                </div>

                <div className="text-center space-y-1.5 pt-1">
                  {receiptQrUrl && (
                    <img
                      src={receiptQrUrl}
                      alt="رمز التحقق من الإيصال"
                      className="w-20 h-20 mx-auto"
                    />
                  )}
                  <p className="text-[10px] text-[#5B6B80]">المحصّل: {activeReceipt.recordedBy}</p>
                  {centerSettings.receiptSettings?.footerNote && (
                    <p className="text-[11px] font-semibold text-[#0F2A4A]">
                      {centerSettings.receiptSettings.footerNote}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div
                id="printable-receipt"
                className="border border-[#E2E8F0] rounded-[12px] bg-white p-6"
              >
                <div className="flex items-start justify-between pb-4 border-b border-[#E2E8F0]">
                  <div>
                    <EduflowLogo dark={false} />
                    <p className="text-xs font-bold text-[#0F2A4A] mt-1.5">{centerSettings.name}</p>
                    <p className="text-[11px] text-[#5B6B80]">{centerSettings.address}</p>
                    {centerSettings.receiptSettings?.headerNote && (
                      <p className="text-[11px] text-[#0F766E] font-semibold mt-0.5">
                        {centerSettings.receiptSettings.headerNote}
                      </p>
                    )}
                  </div>
                  <div className="text-left">
                    <span className="text-xs font-bold text-[#5B6B80] block">إيصال تحصيل رسمي</span>
                    <span className="text-sm font-bold text-[#0F2A4A] tabular-nums block mt-0.5">
                      #{activeReceipt.receiptNumber}
                    </span>
                    <span className="text-xs text-[#5B6B80] tabular-nums block mt-0.5">
                      التاريخ: {activeReceipt.date}
                    </span>
                  </div>
                </div>

                <div className="py-4 space-y-2 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-[#5B6B80]">اسم الطالب / الكود:</span>
                    <span className="font-bold text-[#1E293B] tabular-nums">
                      {receiptStudent?.name} ({receiptStudent?.code})
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-[#5B6B80]">المجموعة الدراسية:</span>
                    <span className="font-semibold text-[#1E293B]">{receiptGroup?.name}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-[#5B6B80]">طريقة الدفع:</span>
                    <span className="font-semibold text-[#1E293B]">{activeReceipt.method}</span>
                  </div>
                  {receiptInvoice && receiptInvoice.discountLines.length > 0 && (
                    <div className="p-2.5 rounded-[8px] bg-[#D1FAE5]/40 space-y-1">
                      <div className="flex justify-between">
                        <span className="text-[#5B6B80]">السعر الأساسي:</span>
                        <span className="tabular-nums font-semibold">
                          {formatEGP(receiptInvoice.baseAmount)}
                        </span>
                      </div>
                      {receiptInvoice.discountLines.map((dl) => (
                        <div key={dl.id} className="flex justify-between text-[#065F46]">
                          <span>{dl.label}:</span>
                          <span className="tabular-nums font-bold">- {formatEGP(dl.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex justify-between py-2 px-3 rounded-[8px] bg-[#F4F7FA]">
                    <span className="font-bold text-[#0F2A4A]">المبلغ المسدد:</span>
                    <span className="text-base font-bold text-[#0F766E] tabular-nums">
                      {formatEGP(activeReceipt.amount)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-[#5B6B80]">الرصيد المتبقي على الفاتورة:</span>
                    <span className="font-bold text-[#1E293B] tabular-nums">
                      {formatEGP(activeReceipt.remainingAfter)}
                    </span>
                  </div>
                </div>

                <div className="pt-4 mt-2 border-t border-[#E2E8F0] flex items-end justify-between text-xs text-[#5B6B80]">
                  <div>
                    <p>المحصّل: {activeReceipt.recordedBy}</p>
                    <p className="text-[11px] mt-0.5">هاتف السنتر: {centerSettings.phone}</p>
                    {centerSettings.receiptSettings?.footerNote && (
                      <p className="text-[11px] text-[#0F2A4A] font-semibold mt-1">
                        {centerSettings.receiptSettings.footerNote}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {receiptQrUrl && (
                      <img
                        src={receiptQrUrl}
                        alt="QR الإيصال"
                        className="w-14 h-14 border border-[#E2E8F0] rounded"
                      />
                    )}
                    <div className="text-center">
                      <div className="w-28 border-b border-slate-400 mb-1" />
                      <span>توقيع وختم الاستلام</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
};

// 8) Create / Edit Group Drawer with Live Conflict Detection + Students Roster Tab
export const GroupFormDrawer: React.FC = () => {
  const {
    groupDrawerOpen,
    editingGroup,
    prefilledSlot,
    closeGroupDrawer,
    groups,
    teachers,
    rooms,
    stages,
    students,
    saveGroup,
    updateGroupStudents,
  } = useEduflow();

  const [activeTab, setActiveTab] = useState<'details' | 'roster'>('details');
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('فيزياء');
  const [teacherId, setTeacherId] = useState(teachers[0]?.id || '');
  const [stage, setStage] = useState(stages[6] || 'الصف الثالث الثانوي');
  const [days, setDays] = useState<DayOfWeek[]>(['السبت', 'الثلاثاء']);
  const [startTime, setStartTime] = useState('16:00');
  const [endTime, setEndTime] = useState('18:00');
  const [roomId, setRoomId] = useState(rooms[0]?.id || '');
  const [capacity, setCapacity] = useState('45');
  const [monthlyPrice, setMonthlyPrice] = useState('450');
  const [startDate, setStartDate] = useState('2026-11-15');
  const [rosterIds, setRosterIds] = useState<string[]>([]);
  const [rosterQuery, setRosterQuery] = useState('');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!groupDrawerOpen) return;
    setActiveTab('details');
    setFormError('');
    if (editingGroup) {
      setName(editingGroup.name);
      setSubject(editingGroup.subject);
      setTeacherId(editingGroup.teacherId);
      setStage(editingGroup.stage);
      setDays(editingGroup.days);
      setStartTime(editingGroup.startTime);
      setEndTime(editingGroup.endTime);
      setRoomId(editingGroup.roomId);
      setCapacity(String(editingGroup.capacity));
      setMonthlyPrice(String(editingGroup.monthlyPrice));
      setStartDate(editingGroup.startDate);
      setRosterIds(
        students.filter((s) => s.groupIds.includes(editingGroup.id)).map((s) => s.id)
      );
    } else {
      setName('');
      setSubject('فيزياء');
      setTeacherId(teachers[0]?.id || '');
      setStage(stages[6] || 'الصف الثالث الثانوي');
      setDays(prefilledSlot?.day ? [prefilledSlot.day as DayOfWeek] : ['السبت', 'الثلاثاء']);
      const st = prefilledSlot?.startTime || '16:00';
      setStartTime(st);
      const startHour = Number(st.split(':')[0] || 16);
      setEndTime(`${String(Math.min(22, startHour + 2)).padStart(2, '0')}:00`);
      setRoomId(prefilledSlot?.roomId || rooms[0]?.id || '');
      setCapacity('40');
      setMonthlyPrice('450');
      setStartDate('2026-11-15');
      setRosterIds([]);
    }
  }, [groupDrawerOpen, editingGroup, prefilledSlot, teachers, rooms, stages, students]);

  const conflicts = useMemo(
    () =>
      detectGroupConflicts(
        {
          id: editingGroup?.id,
          teacherId,
          roomId,
          days,
          startTime,
          endTime,
        },
        groups
      ),
    [editingGroup?.id, teacherId, roomId, days, startTime, endTime, groups]
  );

  const toggleDay = (d: DayOfWeek) => {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('اسم المجموعة مطلوب.');
      return;
    }
    if (days.length === 0) {
      setFormError('يرجى اختيار يوم واحد على الأقل.');
      return;
    }
    if (endTime <= startTime) {
      setFormError('وقت انتهاء الحصة يجب أن يكون بعد وقت البداية.');
      return;
    }
    const saved = saveGroup(
      {
        name: name.trim(),
        subject: subject.trim(),
        teacherId,
        stage,
        days,
        startTime,
        endTime,
        roomId,
        capacity: Number(capacity) || 40,
        monthlyPrice: Number(monthlyPrice) || 400,
        startDate,
        status: 'active',
      },
      editingGroup?.id
    );
    if (editingGroup || rosterIds.length > 0) {
      updateGroupStudents(saved.id, rosterIds);
    }
    closeGroupDrawer();
  };

  const filteredRosterStudents = students.filter(
    (s) => s.status === 'active' && (s.name.includes(rosterQuery) || s.stage.includes(rosterQuery))
  );

  return (
    <Drawer
      open={groupDrawerOpen}
      onClose={closeGroupDrawer}
      title={editingGroup ? 'تعديل المجموعة الدراسية' : 'إنشاء مجموعة جديدة'}
      subtitle="حدد المدرس والقاعة والمواعيد الأسبوعية مع فحص التعارض التلقائي"
      wide
      footer={
        <>
          <Button variant="secondary" onClick={closeGroupDrawer}>
            إلغاء
          </Button>
          <Button onClick={handleSave}>حفظ المجموعة</Button>
        </>
      }
    >
      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-[8px] mb-2">
        <button
          type="button"
          onClick={() => setActiveTab('details')}
          className={`flex-1 py-2 text-xs font-bold rounded-[6px] cursor-pointer transition-colors ${
            activeTab === 'details' ? 'bg-white text-[#0F2A4A] shadow-xs' : 'text-[#5B6B80]'
          }`}
        >
          بيانات ومواعيد المجموعة
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('roster')}
          className={`flex-1 py-2 text-xs font-bold rounded-[6px] cursor-pointer transition-colors ${
            activeTab === 'roster' ? 'bg-white text-[#0F2A4A] shadow-xs' : 'text-[#5B6B80]'
          }`}
        >
          طلاب المجموعة ({rosterIds.length})
        </button>
      </div>

      {formError && (
        <div className="p-3 rounded-[8px] bg-[#FEE2E2] text-[#991B1B] text-xs font-bold">
          {formError}
        </div>
      )}

      {/* Live Conflict Banner */}
      {conflicts.length > 0 && (
        <div
          role="alert"
          className="p-3.5 rounded-[10px] bg-[#FEE2E2] border border-red-300 text-[#991B1B] text-xs space-y-1.5"
        >
          <div className="flex items-center gap-2 font-bold">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>تنبيه تعارض في المواعيد المحجوزة!</span>
          </div>
          {conflicts.map((c, idx) => (
            <p key={idx} className="pr-6">
              • تتعارض يوم <strong>{c.day}</strong> ({c.timeRange}) مع مجموعة{' '}
              <strong>«{c.conflictingGroupName}»</strong> بسبب حجز نفس{' '}
              {c.reason === 'both'
                ? 'القاعة والمدرس'
                : c.reason === 'room'
                ? 'القاعة'
                : 'المدرس'}
              .
            </p>
          ))}
        </div>
      )}

      {activeTab === 'details' ? (
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Field label="اسم المجموعة" htmlFor="grp-name" required>
              <TextInput
                id="grp-name"
                placeholder="مثال: فيزياء - ثالثة ثانوي (مجموعة ج)"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field label="المادة الدراسية" htmlFor="grp-subject" required>
              <TextInput
                id="grp-subject"
                placeholder="مثال: فيزياء"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Field label="المدرس" htmlFor="grp-teacher" required>
              <SelectInput
                id="grp-teacher"
                value={teacherId}
                onChange={(e) => setTeacherId(e.target.value)}
              >
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.subjects.join('، ')})
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="المرحلة الدراسية" htmlFor="grp-stage" required>
              <SelectInput
                id="grp-stage"
                value={stage}
                onChange={(e) => setStage(e.target.value)}
              >
                {stages.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </SelectInput>
            </Field>
          </div>

          <Field label="أيام الحصص الأسبوعية" required>
            <div className="flex flex-wrap gap-2">
              {DAYS_ORDER.map((day) => {
                const selected = days.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={`px-3.5 py-2 rounded-full text-xs font-bold border transition-colors cursor-pointer ${
                      selected
                        ? 'bg-[#0F766E] text-white border-[#0F766E]'
                        : 'bg-white text-[#1E293B] border-[#E2E8F0] hover:bg-slate-50'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <Field label="من الساعة" htmlFor="grp-start">
              <SelectInput
                id="grp-start"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              >
                {['14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'].map(
                  (t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  )
                )}
              </SelectInput>
            </Field>
            <Field label="إلى الساعة" htmlFor="grp-end">
              <SelectInput
                id="grp-end"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              >
                {['15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00'].map(
                  (t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  )
                )}
              </SelectInput>
            </Field>
            <Field label="القاعة" htmlFor="grp-room">
              <SelectInput
                id="grp-room"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
              >
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </SelectInput>
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="سعة القاعة القصوى" htmlFor="grp-cap">
              <TextInput
                id="grp-cap"
                type="number"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                className="tabular-nums"
              />
            </Field>
            <Field label="الاشتراك الشهري (ج)" htmlFor="grp-price">
              <TextInput
                id="grp-price"
                type="number"
                value={monthlyPrice}
                onChange={(e) => setMonthlyPrice(e.target.value)}
                className="tabular-nums"
              />
            </Field>
            <Field label="تاريخ البدء" htmlFor="grp-date">
              <TextInput
                id="grp-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="tabular-nums"
              />
            </Field>
          </div>
        </form>
      ) : (
        <div className="space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-[#5B6B80] absolute right-3.5 top-3.5" />
            <TextInput
              className="pr-10"
              placeholder="ابحث لإضافة أو إزالة طالب من المجموعة..."
              value={rosterQuery}
              onChange={(e) => setRosterQuery(e.target.value)}
            />
          </div>
          <div className="border border-[#E2E8F0] rounded-[8px] divide-y divide-[#E2E8F0] max-h-80 overflow-y-auto">
            {filteredRosterStudents.map((st) => {
              const included = rosterIds.includes(st.id);
              return (
                <label
                  key={st.id}
                  className="flex items-center justify-between px-3.5 py-2.5 text-xs hover:bg-slate-50 cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={included}
                      onChange={() =>
                        setRosterIds((prev) =>
                          included ? prev.filter((id) => id !== st.id) : [...prev, st.id]
                        )
                      }
                      className="w-4 h-4 accent-[#0F766E]"
                    />
                    <div>
                      <p className="font-bold text-[#1E293B]">{st.name}</p>
                      <p className="text-[#5B6B80]">{st.stage}</p>
                    </div>
                  </div>
                  <span className="text-[#0F766E] font-semibold flex items-center gap-1">
                    {included ? 'مسجّل' : <UserPlus className="w-3.5 h-3.5 text-[#5B6B80]" />}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </Drawer>
  );
};

// 20) Reusable Locked-Feature Modal
export const GlobalLockedFeatureModal: React.FC = () => {
  const { lockedFeatureModal, closeLockedFeatureModal, navigate } = useEduflow();
  if (!lockedFeatureModal.open) return null;

  return (
    <Modal
      open={lockedFeatureModal.open}
      onClose={closeLockedFeatureModal}
      title="ميزة ضمن باقة أعلى"
    >
      <LockedFeatureCard
        featureName={lockedFeatureModal.featureName}
        planName={lockedFeatureModal.requiredPlan}
        onUpgrade={() => {
          closeLockedFeatureModal();
          navigate(ScreenId.SUBSCRIPTION);
        }}
      />
    </Modal>
  );
};
