import {
  AttendanceSession,
  Group,
  Invoice,
  PaymentRecord,
  SettlementManualLine,
  SettlementRecord,
  Teacher,
} from '../../types/eduflow';
import { formatMonthArabic, normalizeMonthKey } from '../billing/invoicesAndDiscounts';

export interface TeacherGroupBreakdown {
  groupId: string;
  groupName: string;
  collected: number;
  sessionsHeld: number;
}

export interface TeacherSettlementCalculation {
  monthKey: string;
  monthLabel: string;
  basis: 'cash' | 'invoiced';
  groupBreakdowns: TeacherGroupBreakdown[];
  totalCollected: number;
  sessionsHeldTotal: number;
  centerDeduction: number;
  centerDeductionLabel: string;
  teacherGross: number;
  manualLines: SettlementManualLine[];
  bonusesTotal: number;
  advancesTotal: number;
  deductionsTotal: number;
  carriedForwardIn: number;
  rawNetPayable: number;
  hasNegativeWarning: boolean;
  netPayable: number;
  carriedForwardOut: number;
  existingSettlement?: SettlementRecord;
}

export function calculateTeacherSettlement(params: {
  teacher: Teacher;
  groups: Group[];
  invoices: Invoice[];
  payments: PaymentRecord[];
  sessions: AttendanceSession[];
  settlements: SettlementRecord[];
  monthInput: string;
  basis: 'cash' | 'invoiced';
  manualLines: SettlementManualLine[];
  applyCarryForward?: boolean;
}): TeacherSettlementCalculation {
  const {
    teacher,
    groups,
    invoices,
    payments,
    sessions,
    settlements,
    monthInput,
    basis,
    manualLines,
    applyCarryForward = true,
  } = params;

  const monthKey = normalizeMonthKey(monthInput);
  const monthLabel = formatMonthArabic(monthKey);
  const teacherGroups = groups.filter((g) => g.teacherId === teacher.id);

  const groupBreakdowns: TeacherGroupBreakdown[] = teacherGroups.map((grp) => {
    const grpSessionsHeld = sessions.filter(
      (s) => s.groupId === grp.id && s.date.startsWith(monthKey) && s.status === 'recorded'
    ).length;

    let collected = 0;
    if (basis === 'cash') {
      collected = payments
        .filter((p) => p.groupId === grp.id && p.date.startsWith(monthKey))
        .reduce((sum, p) => sum + p.amount, 0);
    } else {
      collected = invoices
        .filter(
          (inv) =>
            inv.groupId === grp.id &&
            (normalizeMonthKey(inv.monthKey || inv.month) === monthKey ||
              inv.month === monthLabel)
        )
        .reduce((sum, inv) => sum + (typeof inv.netAmount === 'number' ? inv.netAmount : inv.total), 0);
    }

    return {
      groupId: grp.id,
      groupName: grp.name,
      collected,
      sessionsHeld: grpSessionsHeld,
    };
  });

  const totalCollected = groupBreakdowns.reduce((sum, b) => sum + b.collected, 0);
  const sessionsHeldTotal = groupBreakdowns.reduce((sum, b) => sum + b.sessionsHeld, 0);

  let centerDeduction = 0;
  let centerDeductionLabel = '';
  if (teacher.compensation?.type === 'rent' || teacher.compensationType === 'fixed_rent') {
    const rentUnit = teacher.compensation?.rentAmount ?? teacher.compensationValue;
    const rentMode = teacher.rentMode || teacher.compensation?.rentMode || 'monthly';
    if (rentMode === 'per_session') {
      const effectiveSessions = Math.max(1, sessionsHeldTotal);
      centerDeduction = rentUnit * effectiveSessions;
      centerDeductionLabel = `إيجار قاعة (${rentUnit} ج × ${effectiveSessions} حصة)`;
    } else {
      centerDeduction = rentUnit;
      centerDeductionLabel = `إيجار قاعة شهري ثابت (${rentUnit} ج)`;
    }
  } else {
    const centerPct =
      teacher.compensation?.centerPercent ?? Math.max(0, 100 - teacher.compensationValue);
    centerDeduction = Math.round((totalCollected * centerPct) / 100);
    centerDeductionLabel = `نسبة السنتر (${centerPct}%)`;
  }

  const teacherGross = totalCollected - centerDeduction;

  const bonusesTotal = manualLines
    .filter((l) => l.type === 'bonus')
    .reduce((s, l) => s + l.amount, 0);
  const advancesTotal = manualLines
    .filter((l) => l.type === 'advance')
    .reduce((s, l) => s + l.amount, 0);
  const deductionsTotal = manualLines
    .filter((l) => l.type === 'deduction')
    .reduce((s, l) => s + l.amount, 0);

  // Check prior carried forward negative balance from earlier months
  const priorCarried = settlements
    .filter(
      (s) =>
        s.teacherId === teacher.id &&
        s.status === 'settled' &&
        (s.monthKey || normalizeMonthKey(s.month)) < monthKey &&
        (s.carriedForwardOut || 0) > 0
    )
    .sort((a, b) => (b.monthKey || b.month).localeCompare(a.monthKey || a.month))[0];
  const carriedForwardIn = priorCarried?.carriedForwardOut || 0;

  const rawNetPayable =
    teacherGross + bonusesTotal - advancesTotal - deductionsTotal - carriedForwardIn;
  const hasNegativeWarning = rawNetPayable < 0;
  const netPayable = hasNegativeWarning && applyCarryForward ? 0 : rawNetPayable;
  const carriedForwardOut =
    hasNegativeWarning && applyCarryForward ? Math.abs(rawNetPayable) : 0;

  const existingSettlement = settlements.find(
    (s) =>
      s.teacherId === teacher.id &&
      (normalizeMonthKey(s.monthKey || s.month) === monthKey || s.month === monthLabel)
  );

  return {
    monthKey,
    monthLabel,
    basis,
    groupBreakdowns,
    totalCollected,
    sessionsHeldTotal,
    centerDeduction,
    centerDeductionLabel,
    teacherGross,
    manualLines,
    bonusesTotal,
    advancesTotal,
    deductionsTotal,
    carriedForwardIn,
    rawNetPayable,
    hasNegativeWarning,
    netPayable,
    carriedForwardOut,
    existingSettlement,
  };
}
