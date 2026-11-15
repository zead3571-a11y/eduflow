import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BellRing,
  Check,
  Copy,
  ExternalLink,
  FilePlus2,
  FileText,
  Lock,
  Paperclip,
  Percent,
  Plus,
  Receipt,
  Search,
  Trash2,
  Wallet,
} from 'lucide-react';
import { useEduflow } from '../../context/EduflowContext';
import {
  ExpenseCategory,
  Invoice,
  OutboxMessage,
  PaymentStatus,
  ScreenId,
} from '../../types/eduflow';
import { can, canAccessScreen } from '../../permissions/permissions';
import { Can } from '../../permissions/Can';
import {
  Button,
  Card,
  Drawer,
  EmptyState,
  ErrorState,
  Field,
  ListStateSwitcher,
  Modal,
  SelectInput,
  StatusChip,
  TableSkeleton,
  TextInput,
  paymentStatusChipProps,
} from '../ui/Primitives';
import {
  formatEGP,
  getOverdueBucket,
} from '../../utils/eduflowLogic';
import { buildFinancialReportPdf } from '../../utils/pdfExportLogic';
import {
  canDeleteInvoiceBatch,
  previewBulkInvoices,
} from '../../features/billing/invoicesAndDiscounts';
import {
  buildLatePaymentMessage,
  buildWhatsAppUrl,
} from '../../features/messaging/whatsappService';

// Shared Finance Sub-Nav (Payments #12, Late Payments #14, Expenses #15)
const FinanceSubNav: React.FC<{ active: ScreenId }> = ({ active }) => {
  const { currentActor, navigate } = useEduflow();
  const items = [
    { id: ScreenId.PAYMENTS, label: 'الفواتير والدفعات' },
    { id: ScreenId.LATE_PAYMENTS, label: 'المتأخرون في الدفع' },
    { id: ScreenId.EXPENSES, label: 'المصروفات' },
  ].filter((t) =>
    t.id === ScreenId.LATE_PAYMENTS
      ? can(currentActor, 'view', 'financialReports')
      : canAccessScreen(currentActor, t.id)
  );

  return (
    <div className="inline-flex items-center gap-1 p-1 bg-white border border-[#E2E8F0] rounded-[8px]">
      {items.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => navigate(t.id)}
          className={`px-3.5 py-2 rounded-[6px] text-xs font-bold cursor-pointer transition-colors ${
            active === t.id
              ? 'bg-[#0F2A4A] text-white'
              : 'text-[#5B6B80] hover:text-[#0F2A4A]'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
};

// 12) Payments & Invoices Screen
export const PaymentsScreen: React.FC = () => {
  const {
    currentActor,
    invoices,
    payments,
    expenses,
    teachers,
    students,
    groups,
    centerSettings,
    openPdfExport,
    listStateMode,
    setListStateMode,
    openRecordPayment,
    setActiveReceipt,
    generateMonthlyInvoices,
    deleteInvoiceBatch,
    applyInvoiceDiscount,
    showToast,
  } = useEduflow();

  const canCreateInvoices = can(currentActor, 'create', 'invoices');
  const canCreatePayments = can(currentActor, 'create', 'payments');
  const canCreateDiscounts = can(currentActor, 'create', 'discounts');
  const canViewFinancialTotals = can(currentActor, 'view', 'financialReports');

  const [tab, setTab] = useState<'invoices' | 'payments'>('invoices');
  const [search, setSearch] = useState('');
  const [monthFilter, setMonthFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | PaymentStatus>('all');
  const [groupFilter, setGroupFilter] = useState('all');

  // Generate Month Invoices Modal (Phase 4)
  const [genModalOpen, setGenModalOpen] = useState(false);
  const [genMonth, setGenMonth] = useState('2026-12');
  const [genDueDay, setGenDueDay] = useState(1);
  const [genGroupIds, setGenGroupIds] = useState<string[]>(groups.map((g) => g.id));
  const [lastBatchInfo, setLastBatchInfo] = useState<{
    batchId: string;
    monthLabel: string;
    createdCount: number;
    skippedCount: number;
  } | null>(null);

  // Discount Modal (Phase 4B)
  const [discountTargetInv, setDiscountTargetInv] = useState<Invoice | null>(null);
  const [discCategory, setDiscCategory] = useState<'scholarship' | 'waiver' | 'manual'>('manual');
  const [discMode, setDiscMode] = useState<'fixed' | 'percent'>('fixed');
  const [discValue, setDiscValue] = useState('50');
  const [discReason, setDiscReason] = useState('');
  const [discError, setDiscError] = useState('');

  const collectedThisMonth = payments.reduce((sum, p) => sum + p.amount, 0);
  const overdueTotal = invoices
    .filter((i) => i.status === 'overdue')
    .reduce((sum, i) => sum + Math.max(0, i.total - i.paid), 0);
  const openInvoicesCount = invoices.filter((i) => i.status !== 'paid').length;

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const st = students.find((s) => s.id === inv.studentId);
      if (
        search.trim() &&
        !st?.name.includes(search.trim()) &&
        !inv.invoiceNumber.toLowerCase().includes(search.trim().toLowerCase())
      ) {
        return false;
      }
      if (monthFilter !== 'all' && inv.month !== monthFilter) return false;
      if (statusFilter !== 'all' && inv.status !== statusFilter) return false;
      if (groupFilter !== 'all' && inv.groupId !== groupFilter) return false;
      return true;
    });
  }, [invoices, students, search, monthFilter, statusFilter, groupFilter]);

  const bulkPreview = useMemo(
    () =>
      previewBulkInvoices({
        students,
        groups,
        existingInvoices: invoices,
        monthInput: genMonth,
        groupIds: genGroupIds,
        dueDay: genDueDay,
        discountPolicy: centerSettings.discountPolicy,
      }),
    [students, groups, invoices, genMonth, genGroupIds, genDueDay, centerSettings.discountPolicy]
  );

  const uniqueMonths = useMemo(
    () => Array.from(new Set(invoices.map((i) => i.month))),
    [invoices]
  );

  const canDeleteLastBatch =
    lastBatchInfo !== null && canDeleteInvoiceBatch(invoices, lastBatchInfo.batchId);

  return (
    <div className="space-y-5 relative pb-14">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FinanceSubNav active={ScreenId.PAYMENTS} />

        <div className="flex flex-wrap items-center gap-2">
          <ListStateSwitcher mode={listStateMode} onChange={setListStateMode} />
          <Can action="export" resource="financialReports">
            <Button
              variant="secondary"
              icon={<FileText className="w-4 h-4 text-[#0F766E]" />}
              onClick={() =>
                openPdfExport(
                  buildFinancialReportPdf({
                    centerSettings,
                    payments,
                    expenses,
                    invoices,
                    groups,
                    students,
                    teachers,
                    fromDate: '2026-11-01',
                    toDate: '2026-11-30',
                    groupFilter,
                    focusTab: 'all',
                  })
                )
              }
            >
              تصدير تقرير مالي PDF
            </Button>
          </Can>
          <Can action="create" resource="invoices">
            <Button
              variant="secondary"
              onClick={() => {
                setGenGroupIds(groups.map((g) => g.id));
                setGenModalOpen(true);
              }}
              icon={<FilePlus2 className="w-4 h-4 text-[#0F2A4A]" />}
            >
              توليد فواتير الشهر
            </Button>
          </Can>
          <Can action="create" resource="payments">
            <Button
              onClick={() => openRecordPayment()}
              icon={<Wallet className="w-4 h-4" />}
            >
              تسجيل دفعة
            </Button>
          </Can>
        </div>
      </div>

      {/* Latest Generated Batch Banner with Safe Delete Guard */}
      {lastBatchInfo && (
        <Card className="p-3.5 bg-[#F4F7FA] border-[#0F766E]/30 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-[#0F2A4A]">
            <strong>نتيجة إصدار {lastBatchInfo.monthLabel}:</strong>{' '}
            <span>
              تم إنشاء {lastBatchInfo.createdCount} فاتورة وتخطي {lastBatchInfo.skippedCount} فاتورة مكررة.
            </span>
          </div>
          <div className="flex items-center gap-2">
            {canCreateInvoices && canDeleteLastBatch && (
              <Button
                size="sm"
                variant="destructive"
                icon={<Trash2 className="w-3.5 h-3.5" />}
                onClick={() => {
                  const ok = deleteInvoiceBatch(lastBatchInfo.batchId);
                  if (ok) setLastBatchInfo(null);
                }}
              >
                حذف دفعة الفواتير
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setLastBatchInfo(null)}
            >
              إخفاء
            </Button>
          </div>
        </Card>
      )}

      {/* KPIs (Hidden from Receptionist to keep center financial totals private) */}
      {canViewFinancialTotals && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="p-4">
            <span className="text-xs font-semibold text-[#5B6B80]">محصّل هذا الشهر</span>
            <span className="text-2xl font-bold text-[#0F766E] tabular-nums block mt-1">
              {formatEGP(collectedThisMonth)}
            </span>
          </Card>
          <Card className="p-4">
            <span className="text-xs font-semibold text-[#5B6B80]">إجمالي المتأخرات</span>
            <span className="text-2xl font-bold text-[#991B1B] tabular-nums block mt-1">
              {formatEGP(overdueTotal)}
            </span>
          </Card>
          <Card className="p-4">
            <span className="text-xs font-semibold text-[#5B6B80]">فواتير مفتوحة</span>
            <span className="text-2xl font-bold text-[#0F2A4A] tabular-nums block mt-1">
              {openInvoicesCount}
            </span>
          </Card>
        </div>
      )}

      {/* Inner Tabs: الفواتير / الدفعات */}
      <div className="flex items-center gap-2 border-b border-[#E2E8F0]">
        <button
          type="button"
          onClick={() => setTab('invoices')}
          className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-colors cursor-pointer ${
            tab === 'invoices'
              ? 'border-[#0F766E] text-[#0F766E]'
              : 'border-transparent text-[#5B6B80] hover:text-[#1E293B]'
          }`}
        >
          الفواتير ({invoices.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('payments')}
          className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-colors cursor-pointer ${
            tab === 'payments'
              ? 'border-[#0F766E] text-[#0F766E]'
              : 'border-transparent text-[#5B6B80] hover:text-[#1E293B]'
          }`}
        >
          سجل الدفعات والإيصالات ({payments.length})
        </button>
      </div>

      {tab === 'invoices' && (
        <Card className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-[#5B6B80] absolute right-3.5 top-3.5 pointer-events-none" />
            <TextInput
              className="pr-10"
              placeholder="بحث بالطالب أو رقم الفاتورة..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <SelectInput
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
          >
            <option value="all">كل الشهور</option>
            {uniqueMonths.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </SelectInput>
          <SelectInput
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | PaymentStatus)}
          >
            <option value="all">كل الحالات</option>
            <option value="paid">مدفوع</option>
            <option value="partial">جزئي</option>
            <option value="pending">مستحق</option>
            <option value="overdue">متأخر</option>
          </SelectInput>
          <SelectInput
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
          >
            <option value="all">كل المجموعات</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </SelectInput>
        </Card>
      )}

      {listStateMode === 'loading' ? (
        <TableSkeleton rows={5} />
      ) : listStateMode === 'error' ? (
        <ErrorState onRetry={() => setListStateMode('ready')} />
      ) : listStateMode === 'empty' ? (
        <EmptyState
          title="لا توجد فواتير أو دفعات مسجلة"
          description="قم بإنشاء فواتير الشهر للمجموعات النشطة للبدء في متابعة التحصيل."
          actionLabel={canCreateInvoices ? 'إنشاء فواتير الشهر' : undefined}
          onAction={canCreateInvoices ? () => setGenModalOpen(true) : undefined}
        />
      ) : tab === 'invoices' ? (
        <Card padding="p-0" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-[#E2E8F0] text-xs font-bold text-[#5B6B80]">
                  <th className="py-3.5 px-4">رقم الفاتورة</th>
                  <th className="py-3.5 px-4">الطالب</th>
                  <th className="py-3.5 px-4">المجموعة</th>
                  <th className="py-3.5 px-4">الاستحقاق</th>
                  <th className="py-3.5 px-4">الإجمالي</th>
                  <th className="py-3.5 px-4">المدفوع</th>
                  <th className="py-3.5 px-4">المتبقي</th>
                  <th className="py-3.5 px-4">الحالة</th>
                  <th className="py-3.5 px-4 text-left">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] text-sm">
                {filteredInvoices.map((inv) => {
                  const st = students.find((s) => s.id === inv.studentId);
                  const grp = groups.find((g) => g.id === inv.groupId);
                  const rem = Math.max(0, inv.total - inv.paid);
                  const ch = paymentStatusChipProps(inv.status);
                  const matchingReceipt = payments.find((p) => p.invoiceId === inv.id);
                  const discountSum = (inv.discountLines || []).reduce((s, d) => s + d.amount, 0);

                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/80">
                      <td className="py-3.5 px-4 tabular-nums text-xs font-bold text-[#0F2A4A]">
                        <span>{inv.invoiceNumber}</span>
                        <span className="block text-[11px] font-normal text-[#5B6B80]">
                          {inv.month}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-[#1E293B]">{st?.name}</td>
                      <td className="py-3.5 px-4 text-xs text-[#5B6B80]">{grp?.name}</td>
                      <td className="py-3.5 px-4 tabular-nums text-xs">{inv.dueDate}</td>
                      <td className="py-3.5 px-4 tabular-nums">
                        <span className="font-bold block">{formatEGP(inv.total)}</span>
                        {discountSum > 0 && (
                          <span className="text-[11px] text-[#065F46] block">
                            خصم -{formatEGP(discountSum)}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 tabular-nums text-[#065F46]">
                        {formatEGP(inv.paid)}
                      </td>
                      <td className="py-3.5 px-4 tabular-nums font-bold">{formatEGP(rem)}</td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap items-center gap-1">
                          <StatusChip tone={ch.tone} label={ch.label} />
                          {inv.isScholarshipFree && (
                            <StatusChip tone="navy" label="منحة" />
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-left">
                        <div className="inline-flex items-center gap-1.5">
                          {rem > 0 && canCreatePayments && (
                            <Button
                              size="sm"
                              onClick={() => openRecordPayment(inv.studentId, inv.id)}
                            >
                              تسجيل دفعة
                            </Button>
                          )}
                          {rem > 0 && canCreateDiscounts && (
                            <Button
                              size="sm"
                              variant="secondary"
                              icon={<Percent className="w-3.5 h-3.5 text-[#0F766E]" />}
                              onClick={() => {
                                setDiscountTargetInv(inv);
                                setDiscCategory('manual');
                                setDiscMode('fixed');
                                setDiscValue('50');
                                setDiscReason('');
                                setDiscError('');
                              }}
                            >
                              إضافة خصم
                            </Button>
                          )}
                          {matchingReceipt && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => setActiveReceipt(matchingReceipt)}
                            >
                              إيصال
                            </Button>
                          )}
                          {rem > 0 && (
                            <Can action="create" resource="messages">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  showToast(
                                    `تم تجهيز رسالة تذكير سداد لولي أمر ${st?.name}`,
                                    'info'
                                  )
                                }
                              >
                                تذكير
                              </Button>
                            </Can>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card padding="p-0" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-[#E2E8F0] text-xs font-bold text-[#5B6B80]">
                  <th className="py-3.5 px-4">رقم الإيصال</th>
                  <th className="py-3.5 px-4">الطالب</th>
                  <th className="py-3.5 px-4">المبلغ</th>
                  <th className="py-3.5 px-4">طريقة الدفع</th>
                  <th className="py-3.5 px-4">التاريخ</th>
                  <th className="py-3.5 px-4">بواسطة</th>
                  <th className="py-3.5 px-4 text-left">عرض</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] text-sm">
                {payments.map((pay) => {
                  const st = students.find((s) => s.id === pay.studentId);
                  return (
                    <tr key={pay.id} className="hover:bg-slate-50/80">
                      <td className="py-3.5 px-4 tabular-nums font-bold text-[#0F2A4A]">
                        {pay.receiptNumber}
                      </td>
                      <td className="py-3.5 px-4 font-bold">{st?.name}</td>
                      <td className="py-3.5 px-4 tabular-nums font-bold text-[#0F766E]">
                        {formatEGP(pay.amount)}
                      </td>
                      <td className="py-3.5 px-4 text-xs">{pay.method}</td>
                      <td className="py-3.5 px-4 tabular-nums text-xs">{pay.date}</td>
                      <td className="py-3.5 px-4 text-xs text-[#5B6B80]">{pay.recordedBy}</td>
                      <td className="py-3.5 px-4 text-left">
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={<Receipt className="w-3.5 h-3.5" />}
                          onClick={() => setActiveReceipt(pay)}
                        >
                          الإيصال
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Mobile Floating Action Button */}
      <Can action="create" resource="payments">
        <button
          type="button"
          aria-label="تسجيل دفعة سريعة"
          onClick={() => openRecordPayment()}
          className="md:hidden fixed bottom-20 left-5 w-14 h-14 rounded-full bg-[#0F766E] text-white shadow-lg flex items-center justify-center z-20 cursor-pointer"
        >
          <Plus className="w-6 h-6" />
        </button>
      </Can>

      {/* Bulk Generate Monthly Invoices Modal with Live Preview & Idempotency */}
      <Modal
        open={genModalOpen}
        onClose={() => setGenModalOpen(false)}
        title="توليد فواتير الشهر للمجموعات"
        maxWidth="max-w-3xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setGenModalOpen(false)}>
              إلغاء
            </Button>
            <Button
              disabled={bulkPreview.itemsToCreate.length === 0}
              onClick={() => {
                const res = generateMonthlyInvoices(genMonth, genGroupIds, genDueDay);
                if (res.batchId) {
                  setLastBatchInfo({
                    batchId: res.batchId,
                    monthLabel: bulkPreview.monthLabel,
                    createdCount: res.createdCount,
                    skippedCount: res.skippedCount,
                  });
                }
                setGenModalOpen(false);
              }}
            >
              تأكيد وتوليد ({bulkPreview.itemsToCreate.length} فاتورة)
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="الشهر المستحق" htmlFor="gen-month">
              <TextInput
                id="gen-month"
                type="month"
                value={genMonth}
                onChange={(e) => setGenMonth(e.target.value)}
                className="tabular-nums"
              />
            </Field>
            <Field label="يوم الاستحقاق في الشهر (1 - 28)" htmlFor="gen-due-day">
              <TextInput
                id="gen-due-day"
                type="number"
                min={1}
                max={28}
                value={genDueDay}
                onChange={(e) => setGenDueDay(Math.min(28, Math.max(1, Number(e.target.value) || 1)))}
                className="tabular-nums"
              />
            </Field>
          </div>

          <Field label="المجموعات المشمولة">
            <div className="border border-[#E2E8F0] rounded-[8px] divide-y divide-[#E2E8F0] max-h-36 overflow-y-auto">
              {groups.map((g) => {
                const checked = genGroupIds.includes(g.id);
                return (
                  <label
                    key={g.id}
                    className="flex items-center justify-between px-3.5 py-2 text-xs cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setGenGroupIds((prev) =>
                            checked ? prev.filter((id) => id !== g.id) : [...prev, g.id]
                          )
                        }
                        className="w-4 h-4 accent-[#0F766E]"
                      />
                      <span className="font-semibold text-[#1E293B]">{g.name}</span>
                    </div>
                    <span className="tabular-nums font-bold">{formatEGP(g.monthlyPrice)}</span>
                  </label>
                );
              })}
            </div>
          </Field>

          {/* Preview Table */}
          <div className="border border-[#E2E8F0] rounded-[10px] overflow-hidden">
            <div className="px-3.5 py-2.5 bg-slate-50 border-b border-[#E2E8F0] flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-bold text-[#0F2A4A]">
                معاينة الإصدار ({bulkPreview.monthLabel} — استحقاق {bulkPreview.dueDate})
              </span>
              <span className="text-[#5B6B80] tabular-nums">
                جديدة: <strong>{bulkPreview.itemsToCreate.length}</strong> · متخطاة (موجودة مسبقاً):{' '}
                <strong>{bulkPreview.skippedCount}</strong>
              </span>
            </div>
            <div className="max-h-48 overflow-y-auto">
              <table className="w-full text-right border-collapse text-xs">
                <thead className="sticky top-0 bg-white border-b border-[#E2E8F0] text-[#5B6B80]">
                  <tr>
                    <th className="py-2 px-3">الطالب</th>
                    <th className="py-2 px-3">المجموعة</th>
                    <th className="py-2 px-3">الأساسي</th>
                    <th className="py-2 px-3">الخصم</th>
                    <th className="py-2 px-3">الصافي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {bulkPreview.itemsToCreate.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-5 text-center text-[#5B6B80]">
                        جميع الطلاب المختارين لديهم فواتير مُصدرة بالفعل لهذا الشهر.
                      </td>
                    </tr>
                  ) : (
                    bulkPreview.itemsToCreate.map((item) => (
                      <tr key={`${item.student.id}-${item.group.id}`}>
                        <td className="py-2 px-3 font-bold text-[#1E293B]">
                          {item.student.name}
                          {item.siblingRank >= 2 && (
                            <span className="mr-1.5 text-[10px] px-1.5 py-0.5 rounded bg-[#D1FAE5] text-[#065F46]">
                              أخ #{item.siblingRank}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-[#5B6B80]">{item.group.subject}</td>
                        <td className="py-2 px-3 tabular-nums">{formatEGP(item.baseAmount)}</td>
                        <td className="py-2 px-3 tabular-nums text-[#065F46]">
                          {item.discountTotal > 0 ? `-${formatEGP(item.discountTotal)}` : '—'}
                        </td>
                        <td className="py-2 px-3 tabular-nums font-bold text-[#0F2A4A]">
                          {item.isScholarshipFree ? 'منحة (0 ج)' : formatEGP(item.netAmount)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-3.5 py-2.5 bg-[#F4F7FA] border-t border-[#E2E8F0] flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-[#5B6B80] tabular-nums">
                إجمالي الأساسي: {formatEGP(bulkPreview.totalBase)} · إجمالي الخصومات:{' '}
                {formatEGP(bulkPreview.totalDiscount)}
              </span>
              <span className="text-sm font-bold text-[#0F766E] tabular-nums">
                صافي الدفعة: {formatEGP(bulkPreview.totalNet)}
              </span>
            </div>
          </div>
        </div>
      </Modal>

      {/* Apply Invoice Discount / Waiver Modal */}
      <Modal
        open={Boolean(discountTargetInv)}
        onClose={() => setDiscountTargetInv(null)}
        title={
          discountTargetInv
            ? `تطبيق خصم أو منحة — ${discountTargetInv.invoiceNumber}`
            : 'تطبيق خصم'
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setDiscountTargetInv(null)}>
              إلغاء
            </Button>
            <Button
              onClick={() => {
                if (!discountTargetInv) return;
                if (!discReason.trim()) {
                  setDiscError('يرجى كتابة سبب الخصم أو التسوية.');
                  return;
                }
                const ok = applyInvoiceDiscount({
                  invoiceId: discountTargetInv.id,
                  category: discCategory,
                  mode: discMode,
                  value: Number(discValue) || 0,
                  reason: discReason.trim(),
                });
                if (ok) setDiscountTargetInv(null);
              }}
            >
              تطبيق الخصم
            </Button>
          </>
        }
      >
        {discountTargetInv && (
          <div className="space-y-3.5">
            {discError && (
              <div className="p-2.5 rounded-[8px] bg-[#FEE2E2] text-[#991B1B] text-xs font-bold">
                {discError}
              </div>
            )}
            <div className="p-3 rounded-[8px] bg-[#F4F7FA] border border-[#E2E8F0] text-xs flex justify-between">
              <span>الصافي الحالي للفاتورة:</span>
              <strong className="tabular-nums text-[#0F2A4A]">
                {formatEGP(discountTargetInv.total)}
              </strong>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="نوع الخصم" htmlFor="disc-cat">
                <SelectInput
                  id="disc-cat"
                  value={discCategory}
                  onChange={(e) =>
                    setDiscCategory(e.target.value as 'scholarship' | 'waiver' | 'manual')
                  }
                >
                  <option value="manual">تسوية يدوية</option>
                  <option value="waiver">إعفاء جزئي</option>
                  <option value="scholarship">منحة دراسية</option>
                </SelectInput>
              </Field>
              <Field label="طريقة الحساب" htmlFor="disc-mode">
                <SelectInput
                  id="disc-mode"
                  value={discMode}
                  onChange={(e) => setDiscMode(e.target.value as 'fixed' | 'percent')}
                >
                  <option value="fixed">مبلغ ثابت (ج)</option>
                  <option value="percent">نسبة مئوية (%)</option>
                </SelectInput>
              </Field>
            </div>
            <Field label={discMode === 'percent' ? 'النسبة (%)' : 'قيمة الخصم (ج)'} htmlFor="disc-val">
              <TextInput
                id="disc-val"
                type="number"
                value={discValue}
                onChange={(e) => setDiscValue(e.target.value)}
                className="tabular-nums font-bold"
              />
            </Field>
            <Field label="سبب الخصم أو التسوية" htmlFor="disc-reason" required>
              <TextInput
                id="disc-reason"
                placeholder="مثال: ظروف اجتماعية / تفوق دراسي / خصم أخوة يدوي"
                value={discReason}
                onChange={(e) => {
                  setDiscReason(e.target.value);
                  setDiscError('');
                }}
              />
            </Field>
          </div>
        )}
      </Modal>
    </div>
  );
};

// 14) Late Payments Screen
export const LatePaymentsScreen: React.FC = () => {
  const {
    invoices,
    students,
    groups,
    templates,
    openRecordPayment,
    queueWhatsAppMessages,
    markOutboxMessageSent,
    showToast,
  } = useEduflow();

  const [bucket, setBucket] = useState<'all' | '1-7' | '8-30' | '30+'>('all');
  const [selectedInvIds, setSelectedInvIds] = useState<string[]>([]);
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [bulkOutboxQueue, setBulkOutboxQueue] = useState<
    { msg: OutboxMessage; invoiceId: string }[]
  >([]);
  const [allUpToDateDemo, setAllUpToDateDemo] = useState(false);

  const overdueInvoices = useMemo(
    () => invoices.filter((inv) => inv.status === 'overdue' && inv.total > inv.paid),
    [invoices]
  );

  const filteredOverdue = useMemo(() => {
    if (allUpToDateDemo) return [];
    if (bucket === 'all') return overdueInvoices;
    return overdueInvoices.filter((inv) => getOverdueBucket(inv.daysOverdue) === bucket);
  }, [overdueInvoices, bucket, allUpToDateDemo]);

  const totalOverdueSum = overdueInvoices.reduce(
    (sum, i) => sum + Math.max(0, i.total - i.paid),
    0
  );

  const lateTemplate =
    templates.find((t) => t.id === 'late_payment')?.body ||
    'ولي أمر الطالب {اسم_الطالب}، يوجد مبلغ مستحق {المبلغ} ج.';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FinanceSubNav active={ScreenId.LATE_PAYMENTS} />
        <button
          type="button"
          onClick={() => setAllUpToDateDemo((v) => !v)}
          className="text-xs font-semibold text-[#5B6B80] hover:text-[#0F2A4A] underline cursor-pointer"
        >
          {allUpToDateDemo ? 'عرض المتأخرين الفعليين' : 'معاينة حالة التزام جميع الطلاب'}
        </button>
      </div>

      {/* Summary Header */}
      <Card className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#FEE2E2]/35 border-red-200">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-[#FEE2E2] text-[#991B1B] flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#991B1B] tabular-nums">
              إجمالي المتأخرات المستحقة: {formatEGP(allUpToDateDemo ? 0 : totalOverdueSum)}
            </h2>
            <p className="text-xs text-[#5B6B80] tabular-nums">
              موزعة على {allUpToDateDemo ? 0 : overdueInvoices.length} فواتير طلاب متأخرة عن السداد
            </p>
          </div>
        </div>

        {/* Bucket Tabs */}
        <div className="inline-flex items-center gap-1 p-1 bg-white border border-[#E2E8F0] rounded-[8px] text-xs">
          {(
            [
              { id: 'all', label: 'الكل' },
              { id: '1-7', label: '1 - 7 أيام' },
              { id: '8-30', label: '8 - 30 يوم' },
              { id: '30+', label: 'أكثر من 30 يوم' },
            ] as const
          ).map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setBucket(b.id)}
              className={`px-3 py-1.5 rounded-[6px] font-bold cursor-pointer ${
                bucket === b.id ? 'bg-[#0F2A4A] text-white' : 'text-[#5B6B80]'
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>
      </Card>

      {/* Bulk Reminder Bar */}
      {selectedInvIds.length > 0 && (
        <div className="px-4 py-3 rounded-[10px] bg-[#0F2A4A] text-white flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs font-bold tabular-nums">
            تم تحديد {selectedInvIds.length} طلاب لتجهيز رسائل التذكير
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                const items = selectedInvIds
                  .map((invId) => {
                    const inv = invoices.find((i) => i.id === invId);
                    if (!inv) return null;
                    const st = students.find((s) => s.id === inv.studentId);
                    if (!st) return null;
                    const grp = groups.find((g) => g.id === inv.groupId);
                    return {
                      studentId: st.id,
                      recipientName: st.parentName,
                      recipientPhone: st.parentPhone,
                      templateId: 'late_payment',
                      body: buildLatePaymentMessage(lateTemplate, {
                        student: st,
                        group: grp,
                        invoice: inv,
                      }),
                      invoiceId: inv.id,
                    };
                  })
                  .filter((x): x is NonNullable<typeof x> => x !== null);
                const created = queueWhatsAppMessages(items);
                setBulkOutboxQueue(
                  created.map((msg, idx) => ({
                    msg,
                    invoiceId: items[idx]?.invoiceId || '',
                  }))
                );
                showToast(`تم تجهيز ${created.length} رسائل تذكير في قائمة واتساب`);
              }}
            >
              إرسال جماعي عبر واتساب
            </Button>
          </div>
        </div>
      )}

      {filteredOverdue.length === 0 ? (
        <EmptyState
          title="جميع الطلاب ملتزمون بالسداد!"
          description="لا توجد أي فواتير متأخرة في هذه الفئة الزمنية حالياً."
        />
      ) : (
        <Card padding="p-0" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-[#E2E8F0] text-xs font-bold text-[#5B6B80]">
                  <th className="py-3.5 px-4 w-10">
                    <input
                      type="checkbox"
                      aria-label="تحديد كل المتأخرين"
                      checked={
                        filteredOverdue.length > 0 &&
                        filteredOverdue.every((i) => selectedInvIds.includes(i.id))
                      }
                      onChange={() => {
                        if (selectedInvIds.length === filteredOverdue.length) {
                          setSelectedInvIds([]);
                        } else {
                          setSelectedInvIds(filteredOverdue.map((i) => i.id));
                        }
                      }}
                      className="w-4 h-4 accent-[#0F766E]"
                    />
                  </th>
                  <th className="py-3.5 px-4">الطالب</th>
                  <th className="py-3.5 px-4">هاتف ولي الأمر</th>
                  <th className="py-3.5 px-4">المبلغ المستحق</th>
                  <th className="py-3.5 px-4">مدة التأخير</th>
                  <th className="py-3.5 px-4">آخر تذكير</th>
                  <th className="py-3.5 px-4 text-left">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] text-sm">
                {filteredOverdue.map((inv) => {
                  const st = students.find((s) => s.id === inv.studentId);
                  const due = inv.total - inv.paid;
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50">
                      <td className="py-3.5 px-4">
                        <input
                          type="checkbox"
                          aria-label={`تحديد ${st?.name}`}
                          checked={selectedInvIds.includes(inv.id)}
                          onChange={() =>
                            setSelectedInvIds((prev) =>
                              prev.includes(inv.id)
                                ? prev.filter((x) => x !== inv.id)
                                : [...prev, inv.id]
                            )
                          }
                          className="w-4 h-4 accent-[#0F766E]"
                        />
                      </td>
                      <td className="py-3.5 px-4 font-bold text-[#1E293B]">{st?.name}</td>
                      <td className="py-3.5 px-4 tabular-nums text-xs">{st?.parentPhone}</td>
                      <td className="py-3.5 px-4 tabular-nums font-bold text-[#991B1B]">
                        {formatEGP(due)}
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusChip
                          tone={inv.daysOverdue > 30 ? 'danger' : 'warning'}
                          label={`متأخر ${inv.daysOverdue} يوم`}
                        />
                      </td>
                      <td className="py-3.5 px-4 tabular-nums text-xs text-[#5B6B80]">
                        {inv.lastReminderDate || 'لم يُرسل بعد'}
                      </td>
                      <td className="py-3.5 px-4 text-left">
                        <div className="inline-flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            icon={<BellRing className="w-3.5 h-3.5 text-[#0F766E]" />}
                            onClick={() => setPreviewInvoice(inv)}
                          >
                            تجهيز تذكير
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => openRecordPayment(inv.studentId, inv.id)}
                          >
                            تسجيل دفعة
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Reminder Template Preview Modal */}
      <Modal
        open={Boolean(previewInvoice)}
        onClose={() => setPreviewInvoice(null)}
        title="معاينة رسالة التذكير لولي الأمر"
        footer={
          previewInvoice &&
          (() => {
            const st = students.find((s) => s.id === previewInvoice.studentId);
            const grp = groups.find((g) => g.id === previewInvoice.groupId);
            const msg = st
              ? buildLatePaymentMessage(lateTemplate, {
                  student: st,
                  group: grp,
                  invoice: previewInvoice,
                })
              : '';
            const waUrl = st ? buildWhatsAppUrl(st.parentPhone, msg) : '#';
            return (
              <>
                <Button variant="secondary" onClick={() => setPreviewInvoice(null)}>
                  إغلاق
                </Button>
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    if (!st) return;
                    const [queued] = queueWhatsAppMessages([
                      {
                        studentId: st.id,
                        recipientName: st.parentName,
                        recipientPhone: st.parentPhone,
                        templateId: 'late_payment',
                        body: msg,
                        invoiceId: previewInvoice.id,
                      },
                    ]);
                    if (queued) {
                      markOutboxMessageSent(queued.id, { invoiceId: previewInvoice.id });
                    }
                    setPreviewInvoice(null);
                  }}
                  className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-[8px] bg-[#0F766E] hover:bg-[#0D655E] text-white text-sm font-bold"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>فتح واتساب وإرسال</span>
                </a>
              </>
            );
          })()
        }
      >
        {previewInvoice &&
          (() => {
            const st = students.find((s) => s.id === previewInvoice.studentId);
            const grp = groups.find((g) => g.id === previewInvoice.groupId);
            const msg = st
              ? buildLatePaymentMessage(lateTemplate, {
                  student: st,
                  group: grp,
                  invoice: previewInvoice,
                })
              : '';
            return (
              <div className="space-y-3">
                <p className="text-xs text-[#5B6B80] tabular-nums">
                  إلى ولي الأمر: <strong>{st?.parentName}</strong> ({st?.parentPhone})
                </p>
                <div className="p-4 rounded-[10px] bg-[#F4F7FA] border border-[#E2E8F0] text-sm leading-relaxed text-[#1E293B]">
                  {msg}
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Copy className="w-3.5 h-3.5" />}
                  onClick={() => {
                    navigator.clipboard?.writeText(msg);
                    showToast('تم نسخ نص الرسالة للحافظة');
                  }}
                >
                  نسخ نص الرسالة الجاهزة
                </Button>
              </div>
            );
          })()}
      </Modal>

      {/* Bulk WhatsApp Queue Modal */}
      <Modal
        open={bulkOutboxQueue.length > 0}
        onClose={() => {
          setBulkOutboxQueue([]);
          setSelectedInvIds([]);
        }}
        title={`إرسال رسائل التذكير عبر واتساب (${bulkOutboxQueue.length})`}
        maxWidth="max-w-2xl"
        footer={
          <Button
            onClick={() => {
              setBulkOutboxQueue([]);
              setSelectedInvIds([]);
            }}
          >
            إغلاق
          </Button>
        }
      >
        <div className="divide-y divide-[#E2E8F0] border border-[#E2E8F0] rounded-[10px] max-h-96 overflow-y-auto">
          {bulkOutboxQueue.map(({ msg, invoiceId }) => (
            <div key={msg.id} className="p-3.5 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-bold text-[#0F2A4A]">{msg.recipientName}</span>
                  <span className="text-xs text-[#5B6B80] mr-2 tabular-nums">
                    {msg.recipientPhone}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<Copy className="w-3.5 h-3.5" />}
                    onClick={() => {
                      navigator.clipboard?.writeText(msg.body);
                      showToast('تم نسخ نص الرسالة');
                    }}
                  >
                    نسخ
                  </Button>
                  <a
                    href={buildWhatsAppUrl(msg.recipientPhone, msg.body)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                      markOutboxMessageSent(msg.id, { invoiceId });
                      setBulkOutboxQueue((prev) =>
                        prev.map((item) =>
                          item.msg.id === msg.id
                            ? { ...item, msg: { ...item.msg, status: 'sent' } }
                            : item
                        )
                      );
                    }}
                    className="inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-[8px] bg-[#0F766E] text-white text-xs font-bold"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>{msg.status === 'sent' ? 'تم الفتح' : 'فتح واتساب'}</span>
                  </a>
                  {msg.status !== 'sent' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Check className="w-3.5 h-3.5 text-[#065F46]" />}
                      onClick={() => {
                        markOutboxMessageSent(msg.id, { invoiceId });
                        setBulkOutboxQueue((prev) =>
                          prev.map((item) =>
                            item.msg.id === msg.id
                              ? { ...item, msg: { ...item.msg, status: 'sent' } }
                              : item
                          )
                        );
                      }}
                    >
                      تحديد كمُرسَل
                    </Button>
                  )}
                </div>
              </div>
              <p className="text-xs text-[#5B6B80] bg-[#F4F7FA] p-2 rounded-[6px]">{msg.body}</p>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
};

// 15) Expenses Screen (KPI + Category Donut Chart + Role Permission Lock)
const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  إيجار: '#0F2A4A',
  رواتب: '#0F766E',
  كهرباء: '#D97706',
  مستلزمات: '#2563EB',
  أخرى: '#64748B',
};

export const ExpensesScreen: React.FC = () => {
  const {
    currentActor,
    expenses,
    payments,
    invoices,
    groups,
    students,
    teachers,
    centerSettings,
    openPdfExport,
    currentRole,
    listStateMode,
    setListStateMode,
    addExpense,
    deleteExpense,
  } = useEduflow();

  const [categoryFilter, setCategoryFilter] = useState<'all' | ExpenseCategory>('all');
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [cat, setCat] = useState<ExpenseCategory>('مستلزمات');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('2026-11-12');
  const [desc, setDesc] = useState('');
  const [attachment, setAttachment] = useState('');
  const [err, setErr] = useState('');

  const canManageExpenses = can(currentActor, 'create', 'expenses');

  const filteredExpenses = expenses.filter(
    (e) => categoryFilter === 'all' || e.category === categoryFilter
  );

  const totalMonthExpenses = expenses.reduce((s, e) => s + e.amount, 0);

  // Donut segments
  const categories: ExpenseCategory[] = ['إيجار', 'رواتب', 'كهرباء', 'مستلزمات', 'أخرى'];
  const breakdown = categories.map((c) => {
    const sum = expenses.filter((e) => e.category === c).reduce((a, b) => a + b.amount, 0);
    const pct = totalMonthExpenses > 0 ? (sum / totalMonthExpenses) * 100 : 0;
    return { category: c, sum, pct, color: CATEGORY_COLORS[c] };
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number(amount);
    if (!val || val <= 0 || !desc.trim()) {
      setErr('يرجى إدخال البيان وقيمة مصروف صحيحة.');
      return;
    }
    addExpense({
      category: cat,
      amount: val,
      date,
      description: desc.trim(),
      attachmentName: attachment.trim() || undefined,
    });
    setAmount('');
    setDesc('');
    setAttachment('');
    setDrawerOpen(false);
  };

  let cumulativePct = 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FinanceSubNav active={ScreenId.EXPENSES} />
        <div className="flex flex-wrap items-center gap-2">
          <ListStateSwitcher mode={listStateMode} onChange={setListStateMode} />
          <Button
            variant="secondary"
            icon={<FileText className="w-4 h-4 text-[#0F766E]" />}
            onClick={() =>
              openPdfExport(
                buildFinancialReportPdf({
                  centerSettings,
                  payments,
                  expenses,
                  invoices,
                  groups,
                  students,
                  teachers,
                  fromDate: '2026-11-01',
                  toDate: '2026-11-30',
                  groupFilter: 'all',
                  focusTab: 'revenue',
                })
              )
            }
          >
            تصدير تقرير الإيرادات والمصروفات PDF
          </Button>
          <Button
            disabled={!canManageExpenses}
            onClick={() => setDrawerOpen(true)}
            icon={<Plus className="w-4 h-4" />}
          >
            إضافة مصروف
          </Button>
        </div>
      </div>

      {/* Permission Lock Notice for Receptionist / Teacher */}
      {!canManageExpenses && (
        <div className="p-4 rounded-[10px] bg-[#FEF3C7] border border-amber-300 text-[#92400E] flex items-center gap-3 text-xs font-bold">
          <Lock className="w-4 h-4 shrink-0" />
          <span>
            وضع العرض المقيد: تعديل أو حذف المصروفات متاح فقط للمدير والمحاسب (دورك الحالي: {currentRole}).
          </span>
        </div>
      )}

      {/* KPI + Donut Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <Card className="lg:col-span-4 p-5 flex flex-col justify-between">
          <div>
            <span className="text-xs font-semibold text-[#5B6B80]">إجمالي مصروفات الشهر</span>
            <span className="text-3xl font-bold text-[#0F2A4A] tabular-nums block mt-2">
              {formatEGP(totalMonthExpenses)}
            </span>
            <p className="text-xs text-[#5B6B80] mt-1">شهر نوفمبر 2026 — {expenses.length} قيود</p>
          </div>

          <div className="pt-4 border-t border-[#E2E8F0]">
            <SelectInput
              aria-label="تصفية فئة المصروفات"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as 'all' | ExpenseCategory)}
            >
              <option value="all">كل بنود المصروفات</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </SelectInput>
          </div>
        </Card>

        <Card className="lg:col-span-8 p-5 flex flex-col sm:flex-row items-center gap-6">
          <svg
            viewBox="0 0 42 42"
            className="w-36 h-36 shrink-0"
            role="img"
            aria-label="توزيع المصروفات حسب الفئة"
          >
            <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#E2E8F0" strokeWidth="5" />
            {breakdown.map((b) => {
              const dashArray = `${b.pct} ${100 - b.pct}`;
              const dashOffset = 25 - cumulativePct;
              cumulativePct += b.pct;
              return (
                <circle
                  key={b.category}
                  cx="21"
                  cy="21"
                  r="15.915"
                  fill="transparent"
                  stroke={b.color}
                  strokeWidth="5"
                  strokeDasharray={dashArray}
                  strokeDashoffset={dashOffset}
                />
              );
            })}
          </svg>

          <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
            {breakdown.map((b) => (
              <div
                key={b.category}
                className="p-2.5 rounded-[8px] bg-[#F4F7FA] flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-xs shrink-0"
                    style={{ backgroundColor: b.color }}
                  />
                  <span className="font-bold text-[#1E293B]">{b.category}</span>
                </div>
                <span className="tabular-nums font-bold text-[#0F2A4A]">
                  {formatEGP(b.sum)} ({Math.round(b.pct)}%)
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {listStateMode === 'loading' ? (
        <TableSkeleton rows={4} />
      ) : listStateMode === 'error' ? (
        <ErrorState onRetry={() => setListStateMode('ready')} />
      ) : listStateMode === 'empty' || filteredExpenses.length === 0 ? (
        <EmptyState
          title="لا توجد مصروفات مسجلة"
          description="سجّل مصروفات الإيجار والكهرباء والرواتب لمتابعة صافي ربح السنتر الشهري."
        />
      ) : (
        <Card padding="p-0" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-[#E2E8F0] text-xs font-bold text-[#5B6B80]">
                  <th className="py-3.5 px-4">التاريخ</th>
                  <th className="py-3.5 px-4">البند</th>
                  <th className="py-3.5 px-4">البيان</th>
                  <th className="py-3.5 px-4">المبلغ</th>
                  <th className="py-3.5 px-4">أُضيف بواسطة</th>
                  <th className="py-3.5 px-4 text-left">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] text-sm">
                {filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50">
                    <td className="py-3.5 px-4 tabular-nums text-xs">{exp.date}</td>
                    <td className="py-3.5 px-4">
                      <StatusChip tone="navy" label={exp.category} />
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-[#1E293B]">
                      <span>{exp.description}</span>
                      {exp.attachmentName && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-[#0F766E] mr-2">
                          <Paperclip className="w-3 h-3" />
                          {exp.attachmentName}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 tabular-nums font-bold text-[#0F2A4A]">
                      {formatEGP(exp.amount)}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-[#5B6B80]">{exp.addedBy}</td>
                    <td className="py-3.5 px-4 text-left">
                      {canManageExpenses ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`حذف مصروف ${exp.description}`}
                          onClick={() => deleteExpense(exp.id)}
                        >
                          <Trash2 className="w-4 h-4 text-[#991B1B]" />
                        </Button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-[#5B6B80]">
                          <Lock className="w-3.5 h-3.5" />
                          مقفل
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Add Expense Drawer */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="تسجيل مصروف جديد"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDrawerOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={handleAdd}>حفظ المصروف</Button>
          </>
        }
      >
        <form onSubmit={handleAdd} className="space-y-4">
          {err && (
            <div className="p-3 rounded-[8px] bg-[#FEE2E2] text-[#991B1B] text-xs font-bold">
              {err}
            </div>
          )}
          <Field label="فئة المصروف" htmlFor="exp-cat" required>
            <SelectInput
              id="exp-cat"
              value={cat}
              onChange={(e) => setCat(e.target.value as ExpenseCategory)}
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </SelectInput>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="المبلغ (ج)" htmlFor="exp-amount" required>
              <TextInput
                id="exp-amount"
                type="number"
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="tabular-nums font-bold"
              />
            </Field>
            <Field label="التاريخ" htmlFor="exp-date" required>
              <TextInput
                id="exp-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="tabular-nums"
              />
            </Field>
          </div>

          <Field label="البيان / الوصف" htmlFor="exp-desc" required>
            <TextInput
              id="exp-desc"
              placeholder="مثال: فاتورة كهرباء شهر نوفمبر"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            />
          </Field>

          <Field label="اسم مرفق الإيصال (اختياري)" htmlFor="exp-att">
            <TextInput
              id="exp-att"
              placeholder="مثال: إيصال_كهرباء.pdf"
              value={attachment}
              onChange={(e) => setAttachment(e.target.value)}
            />
          </Field>
        </form>
      </Drawer>
    </div>
  );
};
