import {
  AttendanceSession,
  Expense,
  Group,
  Invoice,
  PaymentRecord,
  Student,
  Teacher,
} from '../../types/eduflow';
import { calculateTeacherShare, computeAttendanceStats } from '../../utils/eduflowLogic';

/**
 * Neutralizes spreadsheet formula injection (=, +, -, @, tab, CR) and applies RFC-4180 CSV escaping.
 */
export function sanitizeCsvCell(raw: string | number | null | undefined): string {
  const str = raw === null || raw === undefined ? '' : String(raw);
  const formulaSafe = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  if (/[",\n\r]/.test(formulaSafe)) {
    return `"${formulaSafe.replace(/"/g, '""')}"`;
  }
  return formulaSafe;
}

export function buildUtf8BomCsv(
  headers: string[],
  rows: (string | number | null | undefined)[][]
): string {
  const headerLine = headers.map((h) => sanitizeCsvCell(h)).join(',');
  const dataLines = rows.map((row) => row.map((cell) => sanitizeCsvCell(cell)).join(','));
  return `\uFEFF${[headerLine, ...dataLines].join('\r\n')}`;
}

export function downloadCsvFile(filename: string, csvContent: string): void {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const PAYMENT_STATUS_AR: Record<Student['paymentStatus'], string> = {
  paid: 'مدفوع',
  partial: 'جزئي',
  pending: 'مستحق',
  overdue: 'متأخر',
};

export function buildStudentsCsv(students: Student[], groups: Group[]): string {
  const headers = [
    'كود الطالب',
    'اسم الطالب',
    'المرحلة',
    'اسم ولي الأمر',
    'هاتف ولي الأمر',
    'المجموعات',
    'حالة القيد',
    'حالة السداد',
    'نسبة الحضور (%)',
    'آخر حضور',
  ];

  const rows = students.map((st) => {
    const grpNames = st.groupIds
      .map((gid) => groups.find((g) => g.id === gid)?.name || '')
      .filter(Boolean)
      .join(' | ');
    return [
      st.code,
      st.name,
      st.stage,
      st.parentName,
      st.parentPhone,
      grpNames || 'بدون مجموعة',
      st.status === 'active' ? 'نشط' : 'موقوف',
      PAYMENT_STATUS_AR[st.paymentStatus] || st.paymentStatus,
      st.attendanceRate,
      st.lastAttendance,
    ];
  });

  return buildUtf8BomCsv(headers, rows);
}

export function buildInvoicesCsv(
  invoices: Invoice[],
  students: Student[],
  groups: Group[]
): string {
  const headers = [
    'رقم الفاتورة',
    'الطالب',
    'كود الطالب',
    'المجموعة',
    'الشهر',
    'السعر الأساسي (ج)',
    'إجمالي الخصم (ج)',
    'الصافي المطلوب (ج)',
    'المدفوع (ج)',
    'المتبقي (ج)',
    'تاريخ الاستحقاق',
    'الحالة',
  ];

  const rows = invoices.map((inv) => {
    const st = students.find((s) => s.id === inv.studentId);
    const grp = groups.find((g) => g.id === inv.groupId);
    const discountTotal = inv.discountLines.reduce((s, d) => s + d.amount, 0);
    const rem = Math.max(0, inv.netAmount - inv.paid);
    return [
      inv.invoiceNumber,
      st?.name || '',
      st?.code || '',
      grp?.name || '',
      inv.month,
      inv.baseAmount,
      discountTotal,
      inv.netAmount,
      inv.paid,
      rem,
      inv.dueDate,
      inv.isScholarshipFree ? 'منحة' : PAYMENT_STATUS_AR[inv.status] || inv.status,
    ];
  });

  return buildUtf8BomCsv(headers, rows);
}

export function buildReportCsv(
  tab: 'summary' | 'revenue' | 'overdue' | 'teachers' | 'attendance' | 'expenses',
  data: {
    payments: PaymentRecord[];
    expenses: Expense[];
    invoices: Invoice[];
    groups: Group[];
    teachers: Teacher[];
    sessions: AttendanceSession[];
    students: Student[];
  }
): { filename: string; csv: string } {
  if (tab === 'teachers') {
    const headers = [
      'المدرس',
      'المواد',
      'إجمالي المحصّل (ج)',
      'نصيب المدرس (ج)',
      'نصيب السنتر (ج)',
      'نظام التعاقد',
    ];
    const rows = data.teachers.map((t) => {
      const tGroupIds = new Set(data.groups.filter((g) => g.teacherId === t.id).map((g) => g.id));
      const collected = data.payments
        .filter((p) => tGroupIds.has(p.groupId))
        .reduce((s, p) => s + p.amount, 0);
      const split = calculateTeacherShare(
        collected,
        t.compensationType,
        t.compensationValue
      );
      return [
        t.name,
        t.subjects.join(' / '),
        collected,
        split.teacherShare,
        split.centerShare,
        t.compensationType === 'percentage'
          ? `${t.compensationValue}% للمدرس`
          : `إيجار ثابت ${t.compensationValue} ج`,
      ];
    });
    return {
      filename: 'eduflow-teachers-report.csv',
      csv: buildUtf8BomCsv(headers, rows),
    };
  }

  if (tab === 'attendance') {
    const headers = [
      'التاريخ',
      'المجموعة',
      'النوع',
      'الموعد',
      'حاضر',
      'متأخر',
      'غائب',
      'إجمالي الطلاب',
    ];
    const rows = data.sessions.map((s) => {
      const grp = data.groups.find((g) => g.id === s.groupId);
      const st = computeAttendanceStats(s.entries);
      return [
        s.date,
        grp?.name || '',
        s.type === 'makeup' ? 'تعويضية' : 'أساسية',
        s.timeLabel,
        st.present,
        st.late,
        st.absent,
        s.entries.length,
      ];
    });
    return {
      filename: 'eduflow-attendance-report.csv',
      csv: buildUtf8BomCsv(headers, rows),
    };
  }

  if (tab === 'overdue') {
    const headers = ['الطالب', 'كود الطالب', 'رقم الفاتورة', 'أيام التأخير', 'المبلغ المتبقي (ج)', 'تاريخ الاستحقاق'];
    const rows = data.invoices
      .filter((i) => i.status === 'overdue' && i.total > i.paid)
      .map((inv) => {
        const st = data.students.find((s) => s.id === inv.studentId);
        return [
          st?.name || '',
          st?.code || '',
          inv.invoiceNumber,
          inv.daysOverdue,
          Math.max(0, (typeof inv.netAmount === 'number' ? inv.netAmount : inv.total) - inv.paid),
          inv.dueDate,
        ];
      });
    return {
      filename: 'eduflow-overdue-report.csv',
      csv: buildUtf8BomCsv(headers, rows),
    };
  }

  if (tab === 'expenses') {
    const headers = ['التاريخ', 'البند', 'البيان', 'المبلغ (ج)', 'بواسطة'];
    const rows = data.expenses.map((e) => [
      e.date,
      e.category,
      e.description,
      e.amount,
      e.addedBy,
    ]);
    return {
      filename: 'eduflow-expenses-report.csv',
      csv: buildUtf8BomCsv(headers, rows),
    };
  }

  // summary or revenue
  const totalCollected = data.payments.reduce((s, p) => s + p.amount, 0);
  const totalExpenses = data.expenses.reduce((s, e) => s + e.amount, 0);
  const totalOverdue = data.invoices
    .filter((i) => i.status !== 'paid')
    .reduce((s, i) => s + Math.max(0, i.netAmount - i.paid), 0);

  const headers = ['البند', 'القيمة', 'ملاحظات'];
  const rows: (string | number)[][] = [
    ['إجمالي التحصيل (ج)', totalCollected, `${data.payments.length} إيصال`],
    ['إجمالي المصروفات (ج)', totalExpenses, `${data.expenses.length} بند مصروف`],
    ['صافي التدفق قبل حصص المدرسين (ج)', totalCollected - totalExpenses, 'التحصيل ناقص المصروفات'],
    ['إجمالي المتأخرات المفتوحة (ج)', totalOverdue, 'الفواتير غير المسددة بالكامل'],
    ['عدد الطلاب النشطين', data.students.filter((s) => s.status === 'active').length, ''],
  ];
  return {
    filename: tab === 'revenue' ? 'eduflow-revenue-report.csv' : 'eduflow-summary-report.csv',
    csv: buildUtf8BomCsv(headers, rows),
  };
}
