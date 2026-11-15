import {
  DiscountLine,
  DiscountPolicySettings,
  Group,
  Invoice,
  Student,
} from '../../types/eduflow';
import { normalizePhoneDigits } from '../../permissions/permissions';
import { computeInvoiceStatus } from '../../utils/eduflowLogic';

const ARABIC_MONTHS: Record<string, string> = {
  '01': 'يناير',
  '02': 'فبراير',
  '03': 'مارس',
  '04': 'أبريل',
  '05': 'مايو',
  '06': 'يونيو',
  '07': 'يوليو',
  '08': 'أغسطس',
  '09': 'سبتمبر',
  '10': 'أكتوبر',
  '11': 'نوفمبر',
  '12': 'ديسمبر',
};

const ARABIC_MONTH_TO_NUM: Record<string, string> = Object.fromEntries(
  Object.entries(ARABIC_MONTHS).map(([num, name]) => [name, num])
);

export function formatMonthArabic(monthKey: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey.trim());
  if (!match) return monthKey;
  const [, year, month] = match;
  return `${ARABIC_MONTHS[month] || month} ${year}`;
}

export function normalizeMonthKey(input: string): string {
  const trimmed = input.trim();
  if (/^\d{4}-\d{2}$/.test(trimmed)) return trimmed;
  const parts = trimmed.split(/\s+/);
  if (parts.length === 2) {
    const monthNum = ARABIC_MONTH_TO_NUM[parts[0]];
    if (monthNum && /^\d{4}$/.test(parts[1])) {
      return `${parts[1]}-${monthNum}`;
    }
  }
  return trimmed;
}

export function buildDueDateForMonth(monthKey: string, dueDay: number): string {
  const key = normalizeMonthKey(monthKey);
  const day = Math.min(28, Math.max(1, Math.floor(dueDay || 1)));
  if (/^\d{4}-\d{2}$/.test(key)) {
    return `${key}-${String(day).padStart(2, '0')}`;
  }
  return '2026-12-01';
}

/**
 * Ranks active siblings sharing the same normalized parent phone number
 * deterministically (1 = first child, 2 = second child, 3+ = third+ child).
 */
export function computeSiblingRanks(students: Student[]): Map<string, number> {
  const byPhone = new Map<string, Student[]>();
  students
    .filter((s) => s.status === 'active')
    .forEach((st) => {
      const phone = normalizePhoneDigits(st.parentPhone || st.parent?.phone);
      if (!phone) return;
      const list = byPhone.get(phone) || [];
      list.push(st);
      byPhone.set(phone, list);
    });

  const ranks = new Map<string, number>();
  byPhone.forEach((group) => {
    if (group.length <= 1) {
      if (group[0]) ranks.set(group[0].id, 1);
      return;
    }
    const sorted = [...group].sort((a, b) => {
      const ca = a.createdAt || '';
      const cb = b.createdAt || '';
      if (ca !== cb) return ca.localeCompare(cb);
      return a.id.localeCompare(b.id);
    });
    sorted.forEach((st, idx) => {
      ranks.set(st.id, idx + 1);
    });
  });

  return ranks;
}

function isStandingDiscountActiveForMonth(
  validFrom: string | undefined,
  validTo: string | undefined,
  monthKey: string
): boolean {
  if (!/^\d{4}-\d{2}$/.test(monthKey)) return true;
  const fromMonth = validFrom ? validFrom.slice(0, 7) : '';
  const toMonth = validTo ? validTo.slice(0, 7) : '';
  if (fromMonth && monthKey < fromMonth) return false;
  if (toMonth && monthKey > toMonth) return false;
  return true;
}

export interface InvoicePricingResult {
  baseAmount: number;
  discountLines: DiscountLine[];
  netAmount: number;
  isScholarshipFree: boolean;
}

export function calculateInvoicePricing(params: {
  student: Student;
  group: Group;
  siblingRank: number;
  discountPolicy?: DiscountPolicySettings;
  monthKey: string;
}): InvoicePricingResult {
  const { student, group, siblingRank, discountPolicy, monthKey } = params;
  const baseAmount = Math.max(0, group.monthlyPrice);
  const discountLines: DiscountLine[] = [];
  let running = baseAmount;

  // 1) Standing scholarship / waiver on student profile
  const cfg = student.standingDiscountConfig;
  if (cfg && cfg.value > 0 && isStandingDiscountActiveForMonth(cfg.validFrom, cfg.validTo, monthKey)) {
    if (cfg.type === 'scholarship') {
      const pct = Math.min(100, Math.max(0, cfg.value));
      const amt = Math.min(running, Math.round((baseAmount * pct) / 100));
      if (amt > 0) {
        discountLines.push({
          id: `disc-standing-${student.id}`,
          label: pct === 100 ? `منحة كاملة 100% (${cfg.reason})` : `منحة دراسية ${pct}% (${cfg.reason})`,
          type: 'scholarship',
          amount: amt,
          reason: cfg.reason,
        });
        running = Math.max(0, running - amt);
      }
    } else if (cfg.type === 'waiver') {
      const amt = Math.min(running, Math.round(cfg.value));
      if (amt > 0) {
        discountLines.push({
          id: `disc-standing-${student.id}`,
          label: `إعفاء جزئي ثابت (${cfg.reason})`,
          type: 'waiver',
          amount: amt,
          reason: cfg.reason,
        });
        running = Math.max(0, running - amt);
      }
    }
  } else if (!cfg && student.standingDiscount && student.standingDiscount > 0) {
    const amt = Math.min(running, Math.round(student.standingDiscount));
    if (amt > 0) {
      discountLines.push({
        id: `disc-standing-${student.id}`,
        label: 'خصم دائم على ملف الطالب',
        type: 'waiver',
        amount: amt,
      });
      running = Math.max(0, running - amt);
    }
  }

  // 2) Automatic Sibling Discount
  if (discountPolicy?.siblingEnabled && running > 0 && siblingRank >= 2) {
    const pct =
      siblingRank === 2
        ? Math.min(100, Math.max(0, discountPolicy.secondChildPercent))
        : Math.min(100, Math.max(0, discountPolicy.thirdPlusChildPercent));
    if (pct > 0) {
      const amt = Math.min(running, Math.round((baseAmount * pct) / 100));
      if (amt > 0) {
        discountLines.push({
          id: `disc-sibling-${student.id}`,
          label: `خصم الأخوة (${siblingRank === 2 ? 'الابن الثاني' : 'الابن الثالث فأكثر'} - ${pct}%)`,
          type: 'sibling',
          amount: amt,
        });
        running = Math.max(0, running - amt);
      }
    }
  }

  const netAmount = Math.max(0, running);
  const isScholarshipFree =
    netAmount === 0 &&
    discountLines.some((d) => d.type === 'scholarship' || d.label.includes('100%'));

  return { baseAmount, discountLines, netAmount, isScholarshipFree };
}

export interface BulkInvoicePreviewItem {
  student: Student;
  group: Group;
  siblingRank: number;
  baseAmount: number;
  discountLines: DiscountLine[];
  discountTotal: number;
  netAmount: number;
  isScholarshipFree: boolean;
}

export interface BulkInvoicePreviewResult {
  monthKey: string;
  monthLabel: string;
  dueDate: string;
  itemsToCreate: BulkInvoicePreviewItem[];
  skippedCount: number;
  totalBase: number;
  totalDiscount: number;
  totalNet: number;
}

export function previewBulkInvoices(params: {
  students: Student[];
  groups: Group[];
  existingInvoices: Invoice[];
  monthInput: string;
  groupIds: string[];
  dueDay: number;
  discountPolicy?: DiscountPolicySettings;
}): BulkInvoicePreviewResult {
  const monthKey = normalizeMonthKey(params.monthInput);
  const monthLabel = formatMonthArabic(monthKey);
  const dueDate = buildDueDateForMonth(monthKey, params.dueDay);
  const siblingRanks = computeSiblingRanks(params.students);

  const itemsToCreate: BulkInvoicePreviewItem[] = [];
  let skippedCount = 0;

  params.students
    .filter((s) => s.status === 'active')
    .forEach((student) => {
      student.groupIds
        .filter((gid) => params.groupIds.includes(gid))
        .forEach((gid) => {
          const group = params.groups.find((g) => g.id === gid);
          if (!group) return;

          const duplicate = params.existingInvoices.some((inv) => {
            if (inv.studentId !== student.id || inv.groupId !== gid) return false;
            const invKey = normalizeMonthKey(inv.monthKey || inv.month);
            return invKey === monthKey || inv.month === monthLabel;
          });

          if (duplicate) {
            skippedCount += 1;
            return;
          }

          const rank = siblingRanks.get(student.id) || 1;
          const pricing = calculateInvoicePricing({
            student,
            group,
            siblingRank: rank,
            discountPolicy: params.discountPolicy,
            monthKey,
          });
          const discountTotal = pricing.discountLines.reduce((s, d) => s + d.amount, 0);

          itemsToCreate.push({
            student,
            group,
            siblingRank: rank,
            baseAmount: pricing.baseAmount,
            discountLines: pricing.discountLines,
            discountTotal,
            netAmount: pricing.netAmount,
            isScholarshipFree: pricing.isScholarshipFree,
          });
        });
    });

  return {
    monthKey,
    monthLabel,
    dueDate,
    itemsToCreate,
    skippedCount,
    totalBase: itemsToCreate.reduce((s, i) => s + i.baseAmount, 0),
    totalDiscount: itemsToCreate.reduce((s, i) => s + i.discountTotal, 0),
    totalNet: itemsToCreate.reduce((s, i) => s + i.netAmount, 0),
  };
}

export function applyDiscountToInvoiceState(params: {
  invoice: Invoice;
  category: 'scholarship' | 'waiver' | 'manual';
  mode: 'fixed' | 'percent';
  value: number;
  reason: string;
}): { ok: boolean; error?: string; updatedInvoice?: Invoice; appliedAmount?: number } {
  const { invoice, category, mode, value, reason } = params;
  if (!reason.trim()) {
    return { ok: false, error: 'يجب كتابة سبب الخصم أو التسوية.' };
  }
  if (!Number.isFinite(value) || value <= 0) {
    return { ok: false, error: 'قيمة الخصم يجب أن تكون أكبر من صفر.' };
  }
  if (mode === 'percent' && value > 100) {
    return { ok: false, error: 'نسبة الخصم لا يمكن أن تتجاوز 100%.' };
  }

  const base = typeof invoice.baseAmount === 'number' ? invoice.baseAmount : invoice.total;
  const existingDiscountSum = invoice.discountLines.reduce((s, d) => s + d.amount, 0);
  const currentNet = Math.max(0, base - existingDiscountSum);

  const rawDiscount =
    mode === 'percent' ? Math.round((base * value) / 100) : Math.round(value);
  const appliedAmount = Math.min(currentNet, rawDiscount);
  if (appliedAmount <= 0) {
    return { ok: false, error: 'صافي الفاتورة وصل بالفعل إلى صفر ج.' };
  }

  const labelPrefix =
    category === 'scholarship'
      ? `منحة دراسية ${mode === 'percent' ? `${value}%` : `${appliedAmount} ج`}`
      : category === 'waiver'
        ? 'إعفاء جزئي'
        : 'تسوية يدوية';

  const newLine: DiscountLine = {
    id: `dl-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    label: `${labelPrefix} (${reason.trim()})`,
    type: category,
    amount: appliedAmount,
    reason: reason.trim(),
  };

  const nextLines = [...invoice.discountLines, newLine];
  const nextNet = Math.max(0, base - nextLines.reduce((s, d) => s + d.amount, 0));
  const isScholarshipFree =
    nextNet === 0 && (category === 'scholarship' || invoice.isScholarshipFree);
  const nextStatus =
    nextNet === 0 || invoice.paid >= nextNet
      ? 'paid'
      : computeInvoiceStatus(nextNet, invoice.paid, invoice.daysOverdue);

  return {
    ok: true,
    appliedAmount,
    updatedInvoice: {
      ...invoice,
      baseAmount: base,
      discountLines: nextLines,
      netAmount: nextNet,
      total: nextNet,
      isScholarshipFree,
      status: nextStatus,
      daysOverdue: nextStatus === 'paid' ? 0 : invoice.daysOverdue,
    },
  };
}

export function canDeleteInvoiceBatch(invoices: Invoice[], batchId: string): boolean {
  const batchInvoices = invoices.filter((inv) => inv.batchId === batchId);
  if (batchInvoices.length === 0) return false;
  return batchInvoices.every((inv) => inv.paid === 0);
}
