import {
  Assessment,
  AttendanceSession,
  CenterSettings,
  Expense,
  Group,
  Invoice,
  PaymentRecord,
  Student,
  Teacher,
} from '../types/eduflow';
import {
  calculateTeacherShare,
  computeAttendanceStats,
  formatEGP,
} from './eduflowLogic';

export type PdfReportKind =
  | 'financial_summary'
  | 'overdue_report'
  | 'teachers_settlement'
  | 'attendance_history'
  | 'attendance_session'
  | 'student_parent_report';

export interface PdfKpiItem {
  label: string;
  value: string;
  tone?: 'navy' | 'teal' | 'success' | 'danger' | 'warning';
}

export interface PdfTableColumn {
  key: string;
  label: string;
  align?: 'right' | 'left';
  tabular?: boolean;
}

export interface PdfTableSection {
  title: string;
  columns: PdfTableColumn[];
  rows: Record<string, string>[];
  emptyText?: string;
}

export interface PdfDocumentPayload {
  kind: PdfReportKind;
  documentCode: string;
  title: string;
  subtitle: string;
  periodLabel: string;
  generatedAt: string;
  centerName: string;
  centerAddress: string;
  centerPhone: string;
  parentPhone?: string;
  parentGreeting?: string;
  kpis: PdfKpiItem[];
  tables: PdfTableSection[];
  shareText: string;
}

export function buildFinancialReportPdf(params: {
  centerSettings: CenterSettings;
  payments: PaymentRecord[];
  expenses: Expense[];
  invoices: Invoice[];
  groups: Group[];
  students: Student[];
  teachers: Teacher[];
  fromDate: string;
  toDate: string;
  groupFilter: string;
  focusTab?: 'revenue' | 'overdue' | 'teachers' | 'all';
}): PdfDocumentPayload {
  const {
    centerSettings,
    payments,
    expenses,
    invoices,
    groups,
    students,
    teachers,
    fromDate,
    toDate,
    groupFilter,
    focusTab = 'all',
  } = params;

  const filteredPayments = payments.filter((p) => {
    if (groupFilter !== 'all' && p.groupId !== groupFilter) return false;
    if (fromDate && p.date < fromDate) return false;
    if (toDate && p.date > toDate) return false;
    return true;
  });

  const filteredExpenses = expenses.filter((e) => {
    if (fromDate && e.date < fromDate) return false;
    if (toDate && e.date > toDate) return false;
    return true;
  });

  const filteredInvoices = invoices.filter((inv) => {
    if (groupFilter !== 'all' && inv.groupId !== groupFilter) return false;
    return true;
  });

  const totalPaymentsAmount = filteredPayments.reduce((sum, p) => sum + p.amount, 0);
  const totalExpensesAmount = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  const netBalance = totalPaymentsAmount - totalExpensesAmount;
  const overdueInvoices = filteredInvoices.filter((i) => i.status === 'overdue');
  const overdueTotal = overdueInvoices.reduce(
    (sum, i) => sum + Math.max(0, i.total - i.paid),
    0
  );

  const selectedGroupName =
    groupFilter === 'all'
      ? 'جميع المجموعات'
      : groups.find((g) => g.id === groupFilter)?.name || 'مجموعة محددة';

  const tables: PdfTableSection[] = [];

  if (focusTab === 'all' || focusTab === 'revenue') {
    tables.push({
      title: 'تفاصيل المتحصلات المالية والإيصالات',
      columns: [
        { key: 'receiptNumber', label: 'رقم الإيصال', tabular: true },
        { key: 'studentName', label: 'الطالب' },
        { key: 'groupName', label: 'المجموعة' },
        { key: 'method', label: 'الطريقة' },
        { key: 'date', label: 'التاريخ', tabular: true },
        { key: 'amount', label: 'المبلغ', align: 'left', tabular: true },
      ],
      rows: filteredPayments.map((pay) => ({
        receiptNumber: pay.receiptNumber,
        studentName: students.find((s) => s.id === pay.studentId)?.name || '—',
        groupName: groups.find((g) => g.id === pay.groupId)?.name || '—',
        method: pay.method,
        date: pay.date,
        amount: formatEGP(pay.amount),
      })),
      emptyText: 'لا توجد مدفوعات مسجلة في النطاق المحدد.',
    });

    tables.push({
      title: 'بيان المصروفات التشغيلية للسنتر',
      columns: [
        { key: 'date', label: 'التاريخ', tabular: true },
        { key: 'category', label: 'الفئة' },
        { key: 'description', label: 'البيان' },
        { key: 'addedBy', label: 'المسؤول' },
        { key: 'amount', label: 'القيمة', align: 'left', tabular: true },
      ],
      rows: filteredExpenses.map((exp) => ({
        date: exp.date,
        category: exp.category,
        description: exp.description,
        addedBy: exp.addedBy,
        amount: formatEGP(exp.amount),
      })),
      emptyText: 'لا توجد مصروفات مسجلة في هذه الفترة.',
    });
  }

  if (focusTab === 'all' || focusTab === 'overdue') {
    tables.push({
      title: 'كشف الفواتير والمتأخرات المستحقة',
      columns: [
        { key: 'invoiceNumber', label: 'رقم الفاتورة', tabular: true },
        { key: 'studentName', label: 'الطالب' },
        { key: 'parentPhone', label: 'هاتف ولي الأمر', tabular: true },
        { key: 'daysOverdue', label: 'التأخير', tabular: true },
        { key: 'remaining', label: 'المتبقي', align: 'left', tabular: true },
      ],
      rows: overdueInvoices.map((inv) => {
        const st = students.find((s) => s.id === inv.studentId);
        return {
          invoiceNumber: inv.invoiceNumber,
          studentName: st?.name || '—',
          parentPhone: st?.parentPhone || '—',
          daysOverdue: `${inv.daysOverdue} يوم`,
          remaining: formatEGP(Math.max(0, inv.total - inv.paid)),
        };
      }),
      emptyText: 'لا توجد متأخرات مستحقة في هذه الفترة.',
    });
  }

  if (focusTab === 'all' || focusTab === 'teachers') {
    tables.push({
      title: 'تسوية مستحقات المدرسين وحصة السنتر',
      columns: [
        { key: 'teacherName', label: 'المدرس' },
        { key: 'contract', label: 'نظام التعاقد' },
        { key: 'gross', label: 'إجمالي التحصيل', tabular: true },
        { key: 'teacherShare', label: 'مستحق المدرس', tabular: true },
        { key: 'centerShare', label: 'حصة السنتر', align: 'left', tabular: true },
      ],
      rows: teachers.map((t, idx) => {
        const gross = [28400, 22100, 19500, 24000, 16800][idx % 5];
        const split = calculateTeacherShare(
          gross,
          t.compensationType,
          t.compensationValue
        );
        return {
          teacherName: t.name,
          contract:
            t.compensationType === 'percentage'
              ? `نسبة ${t.compensationValue}%`
              : `إيجار ثابت ${formatEGP(t.compensationValue)}`,
          gross: formatEGP(gross),
          teacherShare: formatEGP(split.teacherShare),
          centerShare: formatEGP(split.centerShare),
        };
      }),
    });
  }

  const titleMap = {
    revenue: 'التقرير المالي للإيرادات والمصروفات',
    overdue: 'تقرير الفواتير والمتأخرات المالية',
    teachers: 'كشف تسوية حسابات المدرسين',
    all: 'التقرير المالي الشامل للسنتر',
  };

  const kindMap: Record<string, PdfReportKind> = {
    revenue: 'financial_summary',
    overdue: 'overdue_report',
    teachers: 'teachers_settlement',
    all: 'financial_summary',
  };

  const shareText = [
    `تقرير ${centerSettings.name} — ${titleMap[focusTab]}`,
    `الفترة: من ${fromDate || 'البداية'} إلى ${toDate || 'اليوم'} (${selectedGroupName})`,
    `• إجمالي المتحصلات: ${formatEGP(totalPaymentsAmount)}`,
    `• إجمالي المصروفات: ${formatEGP(totalExpensesAmount)}`,
    `• صافي الرصيد: ${formatEGP(netBalance)}`,
    `• إجمالي المتأخرات: ${formatEGP(overdueTotal)}`,
  ].join('\n');

  return {
    kind: kindMap[focusTab],
    documentCode: `FIN-${toDate.replace(/-/g, '') || '20261112'}`,
    title: titleMap[focusTab],
    subtitle: `النطاق: ${selectedGroupName}`,
    periodLabel: `من ${fromDate || '—'} إلى ${toDate || '—'}`,
    generatedAt: '12 نوفمبر 2026',
    centerName: centerSettings.name,
    centerAddress: `${centerSettings.address}، ${centerSettings.city}، ${centerSettings.governorate}`,
    centerPhone: centerSettings.phone,
    kpis: [
      { label: 'إجمالي المتحصلات', value: formatEGP(totalPaymentsAmount), tone: 'success' },
      { label: 'المصروفات التشغيلية', value: formatEGP(totalExpensesAmount), tone: 'danger' },
      {
        label: 'صافي الرصيد المالي',
        value: formatEGP(netBalance),
        tone: netBalance >= 0 ? 'teal' : 'danger',
      },
      { label: 'متأخرات غير محصلة', value: formatEGP(overdueTotal), tone: 'warning' },
    ],
    tables,
    shareText,
  };
}

export function buildAttendanceHistoryPdf(params: {
  centerSettings: CenterSettings;
  sessions: AttendanceSession[];
  groups: Group[];
  teachers: Teacher[];
  students: Student[];
  fromDate: string;
  toDate: string;
  groupFilter: string;
  studentFilter: string;
}): PdfDocumentPayload {
  const {
    centerSettings,
    sessions,
    groups,
    teachers,
    students,
    fromDate,
    toDate,
    groupFilter,
    studentFilter,
  } = params;

  const filtered = sessions.filter((s) => {
    if (groupFilter !== 'all' && s.groupId !== groupFilter) return false;
    if (studentFilter !== 'all' && !s.entries.some((e) => e.studentId === studentFilter))
      return false;
    if (fromDate && s.date < fromDate) return false;
    if (toDate && s.date > toDate) return false;
    return true;
  });

  let totalPresent = 0;
  let totalLate = 0;
  let totalAbsent = 0;

  const rows = filtered.map((sess) => {
    const grp = groups.find((g) => g.id === sess.groupId);
    const tch = teachers.find((t) => t.id === grp?.teacherId);
    const stats = computeAttendanceStats(sess.entries);
    totalPresent += stats.present;
    totalLate += stats.late;
    totalAbsent += stats.absent;

    const total = stats.present + stats.late + stats.absent;
    const rate = total > 0 ? Math.round(((stats.present + stats.late) / total) * 100) : 0;

    return {
      date: sess.date,
      groupName: grp?.name || '—',
      teacherName: tch?.name || '—',
      present: String(stats.present),
      late: String(stats.late),
      absent: String(stats.absent),
      rate: `${rate}%`,
    };
  });

  const totalAll = totalPresent + totalLate + totalAbsent;
  const avgRate =
    totalAll > 0 ? Math.round(((totalPresent + totalLate) / totalAll) * 100) : 0;

  const selectedStudent =
    studentFilter !== 'all' ? students.find((s) => s.id === studentFilter) : null;

  const subtitle = selectedStudent
    ? `تقرير حضور الطالب: ${selectedStudent.name}`
    : groupFilter === 'all'
    ? 'جميع المجموعات الدراسية'
    : `المجموعة: ${groups.find((g) => g.id === groupFilter)?.name || ''}`;

  const tables: PdfTableSection[] = [
    {
      title: 'ملخص جلسات الحضور والغياب',
      columns: [
        { key: 'date', label: 'التاريخ', tabular: true },
        { key: 'groupName', label: 'المجموعة' },
        { key: 'teacherName', label: 'المدرس' },
        { key: 'present', label: 'حاضر', tabular: true },
        { key: 'late', label: 'متأخر', tabular: true },
        { key: 'absent', label: 'غائب', tabular: true },
        { key: 'rate', label: 'نسبة الالتزام', align: 'left', tabular: true },
      ],
      rows,
      emptyText: 'لا توجد حصص مسجلة في النطاق المحدد.',
    },
  ];

  // If filtered to a specific student, also attach per-session personal breakdown for parent sharing
  if (selectedStudent) {
    const statusLabelMap = {
      present: 'حاضر',
      late: 'متأخر',
      absent: 'غائب',
      unrecorded: 'لم يُسجّل',
    };
    tables.push({
      title: `سجل حضور الطالب (${selectedStudent.name}) التفصيلي`,
      columns: [
        { key: 'date', label: 'تاريخ الحصة', tabular: true },
        { key: 'groupName', label: 'المجموعة' },
        { key: 'status', label: 'الحالة' },
        { key: 'note', label: 'ملاحظات المدرس / المشرف' },
      ],
      rows: filtered.map((sess) => {
        const entry = sess.entries.find((e) => e.studentId === selectedStudent.id);
        const grp = groups.find((g) => g.id === sess.groupId);
        return {
          date: sess.date,
          groupName: grp?.name || '—',
          status: entry ? statusLabelMap[entry.status] : '—',
          note: entry?.note || '—',
        };
      }),
    });
  }

  const shareText = [
    `${centerSettings.name} — سجل الحضور والغياب`,
    subtitle,
    `الفترة: من ${fromDate || '—'} إلى ${toDate || '—'}`,
    `• إجمالي الحصص: ${filtered.length}`,
    `• إجمالي الحضور: ${totalPresent + totalLate} | الغياب: ${totalAbsent}`,
    `• متوسط نسبة الالتزام: ${avgRate}%`,
  ].join('\n');

  return {
    kind: 'attendance_history',
    documentCode: `ATT-${toDate.replace(/-/g, '') || '20261112'}`,
    title: 'سجل الحضور والانصراف الرسمي',
    subtitle,
    periodLabel: `من ${fromDate || '—'} إلى ${toDate || '—'}`,
    generatedAt: '12 نوفمبر 2026',
    centerName: centerSettings.name,
    centerAddress: `${centerSettings.address}، ${centerSettings.city}، ${centerSettings.governorate}`,
    centerPhone: centerSettings.phone,
    parentPhone: selectedStudent?.parentPhone,
    parentGreeting: selectedStudent
      ? `السيد ولي أمر الطالب / ${selectedStudent.name} (${selectedStudent.parentName}) — تحية طيبة، مرفق لسيادتكم سجل حضور الطالب في الفترة الموضحة.`
      : undefined,
    kpis: [
      { label: 'عدد الحصص المرصودة', value: String(filtered.length), tone: 'navy' },
      { label: 'إجمالي الحضور', value: String(totalPresent + totalLate), tone: 'success' },
      { label: 'حالات الغياب', value: String(totalAbsent), tone: 'danger' },
      { label: 'نسبة الالتزام العامة', value: `${avgRate}%`, tone: 'teal' },
    ],
    tables,
    shareText,
  };
}

export function buildSessionAttendancePdf(params: {
  centerSettings: CenterSettings;
  session: AttendanceSession;
  group?: Group;
  teacher?: Teacher;
  students: Student[];
}): PdfDocumentPayload {
  const { centerSettings, session, group, teacher, students } = params;
  const stats = computeAttendanceStats(session.entries);
  const total = stats.present + stats.late + stats.absent;
  const rate = total > 0 ? Math.round(((stats.present + stats.late) / total) * 100) : 0;

  const statusArabic = {
    present: 'حاضر',
    late: 'متأخر',
    absent: 'غائب',
    unrecorded: 'لم يُسجّل',
  };

  const rows = session.entries.map((entry, index) => {
    const st = students.find((s) => s.id === entry.studentId);
    return {
      index: String(index + 1),
      studentName: st?.name || 'طالب',
      parentPhone: st?.parentPhone || '—',
      status: statusArabic[entry.status],
      note: entry.note || '—',
    };
  });

  const absentNames = session.entries
    .filter((e) => e.status === 'absent')
    .map((e) => students.find((s) => s.id === e.studentId)?.name)
    .filter(Boolean);

  const shareText = [
    `${centerSettings.name} — كشف حضور حصة ${group?.name || ''}`,
    `التاريخ: ${session.date} (${session.timeLabel})`,
    `حاضر: ${stats.present} | متأخر: ${stats.late} | غائب: ${stats.absent} (${rate}%)`,
    absentNames.length > 0 ? `الطلاب الغائبون: ${absentNames.join('، ')}` : 'حضور مكتمل بدون غياب.',
  ].join('\n');

  return {
    kind: 'attendance_session',
    documentCode: `SES-${session.date.replace(/-/g, '')}`,
    title: `كشف حضور الحصة: ${group?.name || 'مجموعة'}`,
    subtitle: `المدرس: ${teacher?.name || '—'} · الموعد: ${session.timeLabel}`,
    periodLabel: `تاريخ الحصة: ${session.date}`,
    generatedAt: '12 نوفمبر 2026',
    centerName: centerSettings.name,
    centerAddress: `${centerSettings.address}، ${centerSettings.city}، ${centerSettings.governorate}`,
    centerPhone: centerSettings.phone,
    kpis: [
      { label: 'حاضر', value: String(stats.present), tone: 'success' },
      { label: 'متأخر', value: String(stats.late), tone: 'warning' },
      { label: 'غائب', value: String(stats.absent), tone: 'danger' },
      { label: 'نسبة الحضور', value: `${rate}%`, tone: 'teal' },
    ],
    tables: [
      {
        title: 'بيان حضور طلاب الحصة',
        columns: [
          { key: 'index', label: '#', tabular: true },
          { key: 'studentName', label: 'اسم الطالب' },
          { key: 'parentPhone', label: 'هاتف ولي الأمر', tabular: true },
          { key: 'status', label: 'الحالة' },
          { key: 'note', label: 'ملاحظات' },
        ],
        rows,
      },
    ],
    shareText,
  };
}

export function buildStudentParentReportPdf(params: {
  centerSettings: CenterSettings;
  student: Student;
  groups: Group[];
  sessions: AttendanceSession[];
  invoices: Invoice[];
  assessments: Assessment[];
}): PdfDocumentPayload {
  const { centerSettings, student, groups, sessions, invoices, assessments } = params;

  const studentGroups = groups.filter((g) => student.groupIds.includes(g.id));
  const studentInvoices = invoices.filter((i) => i.studentId === student.id);
  const totalPaid = studentInvoices.reduce((acc, i) => acc + i.paid, 0);
  const totalDue = studentInvoices.reduce((acc, i) => acc + Math.max(0, i.total - i.paid), 0);

  const studentSessions = sessions.filter((s) =>
    s.entries.some((e) => e.studentId === student.id)
  );
  const studentAssessments = assessments.filter((a) =>
    a.grades.some((g) => g.studentId === student.id)
  );

  const statusMap = {
    present: 'حاضر',
    late: 'متأخر',
    absent: 'غائب',
    unrecorded: 'لم يُسجّل',
  };

  const invoiceStatusMap = {
    paid: 'مدفوع',
    partial: 'مدفوع جزئياً',
    pending: 'مستحق',
    overdue: 'متأخر',
  };

  const shareText = [
    `تحية طيبة من ${centerSettings.name}`,
    `تقرير متابعة الطالب: ${student.name} (${student.stage})`,
    `ولي الأمر: ${student.parentName}`,
    `• نسبة الحضور: ${student.attendanceRate}%`,
    `• المدفوعات المسددة: ${formatEGP(totalPaid)} | المتبقي: ${formatEGP(totalDue)}`,
    `• المجموعات: ${studentGroups.map((g) => g.name).join('، ') || 'لا يوجد'}`,
    `للاستفسار: ${centerSettings.phone}`,
  ].join('\n');

  return {
    kind: 'student_parent_report',
    documentCode: `STD-${student.id.toUpperCase()}`,
    title: `تقرير متابعة الطالب لولي الأمر`,
    subtitle: `${student.name} — ${student.stage}`,
    periodLabel: 'التقرير الشهري الشامل — نوفمبر 2026',
    generatedAt: '12 نوفمبر 2026',
    centerName: centerSettings.name,
    centerAddress: `${centerSettings.address}، ${centerSettings.city}، ${centerSettings.governorate}`,
    centerPhone: centerSettings.phone,
    parentPhone: student.parentPhone,
    parentGreeting: `السيد ولي الأمر / ${student.parentName} — يسعدنا مشاركة تقرير الأداء المالي والحضور والدرجات الخاص بالطالب/ة (${student.name}).`,
    kpis: [
      { label: 'نسبة الحضور', value: `${student.attendanceRate}%`, tone: 'teal' },
      { label: 'إجمالي المسدد', value: formatEGP(totalPaid), tone: 'success' },
      {
        label: 'المتبقي المستحق',
        value: formatEGP(totalDue),
        tone: totalDue > 0 ? 'danger' : 'success',
      },
      { label: 'التقييمات المرصودة', value: String(studentAssessments.length), tone: 'navy' },
    ],
    tables: [
      {
        title: 'سجل الحضور في الحصص الأخيرة',
        columns: [
          { key: 'date', label: 'التاريخ', tabular: true },
          { key: 'groupName', label: 'المجموعة' },
          { key: 'status', label: 'الحالة' },
          { key: 'note', label: 'ملاحظات' },
        ],
        rows: studentSessions.map((sess) => {
          const entry = sess.entries.find((e) => e.studentId === student.id);
          const grp = groups.find((g) => g.id === sess.groupId);
          return {
            date: sess.date,
            groupName: grp?.name || '—',
            status: entry ? statusMap[entry.status] : '—',
            note: entry?.note || '—',
          };
        }),
        emptyText: 'لا توجد حصص مسجلة بعد.',
      },
      {
        title: 'كشف الفواتير والمدفوعات',
        columns: [
          { key: 'invoiceNumber', label: 'الفاتورة', tabular: true },
          { key: 'month', label: 'الشهر' },
          { key: 'total', label: 'الإجمالي', tabular: true },
          { key: 'paid', label: 'المدفوع', tabular: true },
          { key: 'remaining', label: 'المتبقي', tabular: true },
          { key: 'status', label: 'الحالة', align: 'left' },
        ],
        rows: studentInvoices.map((inv) => ({
          invoiceNumber: inv.invoiceNumber,
          month: inv.month,
          total: formatEGP(inv.total),
          paid: formatEGP(inv.paid),
          remaining: formatEGP(Math.max(0, inv.total - inv.paid)),
          status: invoiceStatusMap[inv.status],
        })),
        emptyText: 'لا توجد فواتير مسجلة.',
      },
      {
        title: 'نتائج التقييمات والامتحانات',
        columns: [
          { key: 'date', label: 'التاريخ', tabular: true },
          { key: 'title', label: 'الاختبار' },
          { key: 'subject', label: 'المادة' },
          { key: 'score', label: 'الدرجة', align: 'left', tabular: true },
        ],
        rows: studentAssessments.map((as) => {
          const grade = as.grades.find((g) => g.studentId === student.id);
          const grp = groups.find((g) => g.id === as.groupId);
          return {
            date: as.date,
            title: as.title,
            subject: grp?.subject || '—',
            score: grade?.absent
              ? 'غائب'
              : grade?.score !== null && grade?.score !== undefined
              ? `${grade.score} / ${as.maxScore}`
              : '—',
          };
        }),
        emptyText: 'لا توجد درجات تقييم مسجلة.',
      },
    ],
    shareText,
  };
}
