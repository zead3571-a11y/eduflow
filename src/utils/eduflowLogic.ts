import {
  AttendanceEntry,
  AttendanceSession,
  AssessmentGrade,
  CompensationType,
  DayOfWeek,
  Group,
  GroupConflict,
  Invoice,
  PaymentRecord,
  PaymentStatus,
  Student,
} from '../types/eduflow';

export const DAYS_ORDER: DayOfWeek[] = [
  'السبت',
  'الأحد',
  'الاثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
];

/**
 * Formats numbers strictly with Western Arabic digits (0-9) as required by EDUFLOW rules.
 */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(Math.round(value));
}

export function formatEGP(value: number): string {
  return `${formatNumber(value)} ج`;
}

export function formatDateDDMMYYYY(input: Date | string | number): string {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = String(d.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

export function getInitials(fullName: string): string {
  const cleaned = fullName
    .replace(/^(أ\.|د\.|م\.)\s*/u, '')
    .trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'إ';
  if (parts.length === 1) return parts[0].slice(0, 2);
  return `${parts[0][0]} ${parts[1][0]}`;
}

export function timeToMinutes(time24: string): number {
  const [hStr, mStr] = time24.split(':');
  const h = Number(hStr);
  const m = Number(mStr || '0');
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

export function formatTimeArabic12h(time24: string): string {
  const [hStr, mStr] = time24.split(':');
  const h = Number(hStr);
  const m = mStr || '00';
  if (Number.isNaN(h)) return time24;
  const period = h >= 12 ? 'م' : 'ص';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === '00' ? `${h12} ${period}` : `${h12}:${m} ${period}`;
}

export function formatTimeRangeArabic(start: string, end: string): string {
  return `${formatTimeArabic12h(start)} - ${formatTimeArabic12h(end)}`;
}

/**
 * Detects room or teacher booking overlaps across days and times.
 */
export function detectGroupConflicts(
  candidate: {
    id?: string;
    teacherId: string;
    roomId: string;
    days: DayOfWeek[];
    startTime: string;
    endTime: string;
  },
  existingGroups: Group[]
): GroupConflict[] {
  const conflicts: GroupConflict[] = [];
  const startA = timeToMinutes(candidate.startTime);
  const endA = timeToMinutes(candidate.endTime);

  if (endA <= startA || candidate.days.length === 0) {
    return conflicts;
  }

  for (const existing of existingGroups) {
    if (candidate.id && existing.id === candidate.id) continue;
    if (existing.status === 'paused') continue;

    const sharedDays = candidate.days.filter((d) => existing.days.includes(d));
    if (sharedDays.length === 0) continue;

    const startB = timeToMinutes(existing.startTime);
    const endB = timeToMinutes(existing.endTime);

    const overlaps = startA < endB && endA > startB;
    if (!overlaps) continue;

    const sameRoom = Boolean(candidate.roomId && existing.roomId === candidate.roomId);
    const sameTeacher = Boolean(candidate.teacherId && existing.teacherId === candidate.teacherId);

    if (sameRoom || sameTeacher) {
      const reason: 'room' | 'teacher' | 'both' =
        sameRoom && sameTeacher ? 'both' : sameRoom ? 'room' : 'teacher';

      for (const day of sharedDays) {
        conflicts.push({
          conflictingGroupId: existing.id,
          conflictingGroupName: existing.name,
          reason,
          day,
          timeRange: formatTimeRangeArabic(existing.startTime, existing.endTime),
        });
      }
    }
  }

  return conflicts;
}

/**
 * Checks whether a group conflicts with any other active group on a specific day
 * (and optionally at a specific hour slot).
 */
export function isGroupConflictingAt(
  group: Group,
  day: DayOfWeek,
  existingGroups: Group[],
  slotHour?: number
): boolean {
  if (!group.days.includes(day) || group.status === 'paused') return false;
  const startA = timeToMinutes(group.startTime);
  const endA = timeToMinutes(group.endTime);

  for (const other of existingGroups) {
    if (other.id === group.id || other.status === 'paused') continue;
    if (!other.days.includes(day)) continue;

    const sameRoom = Boolean(group.roomId && other.roomId === group.roomId);
    const sameTeacher = Boolean(group.teacherId && other.teacherId === group.teacherId);
    if (!sameRoom && !sameTeacher) continue;

    const startB = timeToMinutes(other.startTime);
    const endB = timeToMinutes(other.endTime);
    const overlaps = startA < endB && endA > startB;
    if (!overlaps) continue;

    if (slotHour !== undefined) {
      const slotStart = slotHour * 60;
      const slotEnd = (slotHour + 1) * 60;
      // Highlight red specifically during the overlapping hour window, or any hour where both groups run
      if (slotStart < Math.min(endA, endB) && slotEnd > Math.max(startA, startB)) {
        return true;
      }
    } else {
      return true;
    }
  }

  return false;
}

export function validatePaymentAmount(
  amount: number,
  remainingBalance: number
): { valid: boolean; error?: string; remainingAfter: number } {
  if (!Number.isFinite(amount) || amount <= 0) {
    return {
      valid: false,
      error: 'يرجى إدخال مبلغ صحيح أكبر من صفر.',
      remainingAfter: remainingBalance,
    };
  }
  if (amount > remainingBalance) {
    return {
      valid: false,
      error: `المبلغ المدخل (${formatEGP(amount)}) يتجاوز المتبقي المستحق (${formatEGP(remainingBalance)}).`,
      remainingAfter: remainingBalance,
    };
  }
  return {
    valid: true,
    remainingAfter: Math.max(0, remainingBalance - amount),
  };
}

export function computeInvoiceStatus(
  total: number,
  paid: number,
  daysOverdue: number
): PaymentStatus {
  if (paid >= total && total > 0) return 'paid';
  if (daysOverdue > 0) return 'overdue';
  if (paid > 0 && paid < total) return 'partial';
  return 'pending';
}

export function getOverdueBucket(daysOverdue: number): '1-7' | '8-30' | '30+' | null {
  if (daysOverdue <= 0) return null;
  if (daysOverdue <= 7) return '1-7';
  if (daysOverdue <= 30) return '8-30';
  return '30+';
}

export function computeAttendanceStats(entries: AttendanceEntry[]): {
  present: number;
  late: number;
  absent: number;
  unrecorded: number;
  total: number;
} {
  let present = 0;
  let late = 0;
  let absent = 0;
  let unrecorded = 0;

  for (const entry of entries) {
    if (entry.status === 'present') present++;
    else if (entry.status === 'late') late++;
    else if (entry.status === 'absent') absent++;
    else unrecorded++;
  }

  return {
    present,
    late,
    absent,
    unrecorded,
    total: entries.length,
  };
}

export function calculateTeacherShare(
  collectedAmount: number,
  compensationType: CompensationType,
  compensationValue: number
): { teacherShare: number; centerShare: number } {
  if (compensationType === 'percentage') {
    const pct = Math.min(100, Math.max(0, compensationValue));
    const teacherShare = Math.round((collectedAmount * pct) / 100);
    return {
      teacherShare,
      centerShare: Math.max(0, collectedAmount - teacherShare),
    };
  }
  // fixed_rent: Center takes fixed rent from collected revenue, teacher gets remainder
  const centerShare = Math.min(collectedAmount, Math.max(0, compensationValue));
  const teacherShare = Math.max(0, collectedAmount - centerShare);
  return { teacherShare, centerShare };
}

export function validateAssessmentScore(
  score: number | null,
  maxScore: number,
  absent: boolean
): { valid: boolean; error?: string } {
  if (absent) return { valid: true };
  if (score === null || Number.isNaN(score)) return { valid: true };
  if (score < 0) {
    return { valid: false, error: 'الدرجة لا يمكن أن تكون أقل من صفر.' };
  }
  if (score > maxScore) {
    return { valid: false, error: `الدرجة تتجاوز النهاية العظمى (${maxScore}).` };
  }
  return { valid: true };
}

export function computeAssessmentSummary(
  grades: AssessmentGrade[],
  maxScore: number
): {
  average: number;
  highest: number;
  lowest: number;
  gradedCount: number;
  absentCount: number;
  distribution: { label: string; count: number }[];
} {
  const validScores = grades
    .filter((g) => !g.absent && g.score !== null && !Number.isNaN(g.score))
    .map((g) => g.score as number);
  const absentCount = grades.filter((g) => g.absent).length;

  if (validScores.length === 0 || maxScore <= 0) {
    return {
      average: 0,
      highest: 0,
      lowest: 0,
      gradedCount: 0,
      absentCount,
      distribution: [
        { label: 'أقل من 50%', count: 0 },
        { label: '50% - 69%', count: 0 },
        { label: '70% - 84%', count: 0 },
        { label: '85% - 100%', count: 0 },
      ],
    };
  }

  const sum = validScores.reduce((acc, s) => acc + s, 0);
  const average = Math.round((sum / validScores.length) * 10) / 10;
  const highest = Math.max(...validScores);
  const lowest = Math.min(...validScores);

  const buckets = [0, 0, 0, 0];
  for (const s of validScores) {
    const pct = (s / maxScore) * 100;
    if (pct < 50) buckets[0]++;
    else if (pct < 70) buckets[1]++;
    else if (pct < 85) buckets[2]++;
    else buckets[3]++;
  }

  return {
    average,
    highest,
    lowest,
    gradedCount: validScores.length,
    absentCount,
    distribution: [
      { label: 'أقل من 50%', count: buckets[0] },
      { label: '50% - 69%', count: buckets[1] },
      { label: '70% - 84%', count: buckets[2] },
      { label: '85% - 100%', count: buckets[3] },
    ],
  };
}

export function interpolateTemplate(
  template: string,
  variables: Record<string, string>
): string {
  let result = template;
  for (const [key, val] of Object.entries(variables)) {
    result = result.replaceAll(`{${key}}`, val).replaceAll(key, val);
  }
  return result;
}

export interface AttendanceTrendPoint {
  date: string;
  label: string;
  present: number;
  late: number;
  absent: number;
  attendanceRate: number;
}

const SHORT_AR_MONTHS: Record<string, string> = {
  '09': 'سبت',
  '10': 'أكت',
  '11': 'نوف',
  '12': 'ديس',
};

function formatShortArabicDate(isoDate: string): string {
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  const monthLabel = SHORT_AR_MONTHS[parts[1]] || parts[1];
  return `${parts[2]} ${monthLabel}`;
}

const DEFAULT_ATTENDANCE_BASELINE: AttendanceTrendPoint[] = [
  { date: '2026-11-04', label: '04 نوف', present: 42, late: 4, absent: 5, attendanceRate: 90 },
  { date: '2026-11-05', label: '05 نوف', present: 44, late: 3, absent: 4, attendanceRate: 92 },
  { date: '2026-11-07', label: '07 نوف', present: 39, late: 5, absent: 7, attendanceRate: 86 },
  { date: '2026-11-08', label: '08 نوف', present: 45, late: 2, absent: 4, attendanceRate: 92 },
  { date: '2026-11-09', label: '09 نوف', present: 41, late: 4, absent: 6, attendanceRate: 88 },
];

export function buildAttendanceTrendSeries(
  sessions: AttendanceSession[],
  includeBaseline = true
): AttendanceTrendPoint[] {
  const byDate = new Map<string, { present: number; late: number; absent: number }>();

  for (const sess of sessions) {
    const stats = computeAttendanceStats(sess.entries);
    const recordedTotal = stats.present + stats.late + stats.absent;
    if (recordedTotal === 0) continue;

    const existing = byDate.get(sess.date) || { present: 0, late: 0, absent: 0 };
    byDate.set(sess.date, {
      present: existing.present + stats.present,
      late: existing.late + stats.late,
      absent: existing.absent + stats.absent,
    });
  }

  const combined = new Map<string, AttendanceTrendPoint>();
  if (includeBaseline) {
    for (const base of DEFAULT_ATTENDANCE_BASELINE) {
      combined.set(base.date, base);
    }
  }

  for (const [date, counts] of byDate.entries()) {
    const total = counts.present + counts.late + counts.absent;
    const rate = total > 0 ? Math.round(((counts.present + counts.late) / total) * 100) : 0;
    combined.set(date, {
      date,
      label: formatShortArabicDate(date),
      present: counts.present,
      late: counts.late,
      absent: counts.absent,
      attendanceRate: rate,
    });
  }

  return Array.from(combined.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export interface RevenueDistributionSlice {
  subject: string;
  amount: number;
  percentage: number;
  color: string;
}

const SUBJECT_PALETTE = [
  '#0F766E',
  '#0F2A4A',
  '#1D4ED8',
  '#D97706',
  '#7E22CE',
  '#059669',
];

export function buildMonthlyRevenueDistribution(
  groups: Group[],
  students: Student[],
  invoices: Invoice[],
  payments: PaymentRecord[]
): RevenueDistributionSlice[] {
  const totalsBySubject = new Map<string, number>();

  for (const grp of groups) {
    if (grp.status === 'paused') continue;
    const activeEnrolled = students.filter(
      (s) => s.status === 'active' && s.groupIds.includes(grp.id)
    ).length;
    // Combine actual payments/invoices with realistic baseline center volume per active group
    const groupPayments = payments
      .filter((p) => p.groupId === grp.id)
      .reduce((sum, p) => sum + p.amount, 0);
    const groupInvoiced = invoices
      .filter((inv) => inv.groupId === grp.id)
      .reduce((sum, inv) => sum + inv.paid, 0);

    const estimatedBase = Math.max(activeEnrolled, 1) * grp.monthlyPrice * 6;
    const amount = estimatedBase + Math.max(groupPayments, groupInvoiced);
    totalsBySubject.set(
      grp.subject,
      (totalsBySubject.get(grp.subject) || 0) + amount
    );
  }

  const entries = Array.from(totalsBySubject.entries())
    .map(([subject, amount]) => ({ subject, amount }))
    .sort((a, b) => b.amount - a.amount);

  const grandTotal = entries.reduce((acc, item) => acc + item.amount, 0);
  if (grandTotal <= 0) return [];

  return entries.map((item, idx) => ({
    subject: item.subject,
    amount: Math.round(item.amount),
    percentage: Math.round((item.amount / grandTotal) * 100),
    color: SUBJECT_PALETTE[idx % SUBJECT_PALETTE.length],
  }));
}
