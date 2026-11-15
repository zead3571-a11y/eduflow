import {
  ActivityLogEntry,
  AppNotification,
  Assessment,
  AttendanceRecord,
  AttendanceSession,
  DiscountRecord,
  Expense,
  Group,
  Invoice,
  OutboxMessage,
  PaymentRecord,
  ScreenId,
  SettlementRecord,
  Student,
  SystemUser,
  Teacher,
  UserRole,
} from '../types/eduflow';

export type PermissionAction =
  | 'view'
  | 'create'
  | 'update'
  | 'delete'
  | 'export'
  | 'print'
  | 'send_whatsapp'
  | 'settle'
  | 'take_attendance'
  | 'enter_assessments'
  | 'change_plan'
  | 'delete_center'
  | 'enable_biometrics'
  | 'manage_owners'
  | 'manage_settings'
  | 'manage_backup';

export type PermissionResource =
  | 'dashboard'
  | 'students'
  | 'teachers'
  | 'groups'
  | 'schedule'
  | 'rooms'
  | 'stages'
  | 'sessions'
  | 'attendanceRecords'
  | 'invoices'
  | 'payments'
  | 'discounts'
  | 'expenses'
  | 'settlements'
  | 'assessments'
  | 'reports'
  | 'financialReports'
  | 'teacherShares'
  | 'notifications'
  | 'settings'
  | 'messageTemplates'
  | 'receiptSettings'
  | 'subscription'
  | 'users'
  | 'centers'
  | 'biometrics'
  | 'consents'
  | 'faceTemplates'
  | 'messages'
  | 'activityLog'
  | 'backup'
  | 'parentPortal'
  | 'studentAccounts'
  | 'studentSessions'
  | 'studentPortal'
  | 'designSystem';

export interface PermissionActor {
  userId?: string;
  role: UserRole | 'system';
  centerId?: string;
  teacherId?: string;
  parentPhone?: string;
  studentId?: string;
}

export interface PermissionContext {
  teacherId?: string;
  groupId?: string;
  groupTeacherId?: string;
  studentId?: string;
  studentGroupIds?: string[];
  parentPhone?: string;
  targetUserRole?: UserRole;
  settingTab?: string;
  groups?: Pick<Group, 'id' | 'teacherId'>[];
  students?: Pick<Student, 'id' | 'groupIds' | 'parentPhone'>[];
}

const ACTION_LABELS_AR: Record<PermissionAction, string> = {
  view: 'عرض',
  create: 'إضافة',
  update: 'تعديل',
  delete: 'حذف',
  export: 'تصدير',
  print: 'طباعة',
  send_whatsapp: 'إرسال واتساب',
  settle: 'تسوية المستحقات',
  take_attendance: 'تسجيل الحضور',
  enter_assessments: 'إدخال الدرجات',
  change_plan: 'تغيير الباقة',
  delete_center: 'حذف السنتر',
  enable_biometrics: 'تفعيل البصمة',
  manage_owners: 'إدارة حسابات المالكين',
  manage_settings: 'إدارة الإعدادات',
  manage_backup: 'النسخ الاحتياطي',
};

const RESOURCE_LABELS_AR: Record<PermissionResource, string> = {
  dashboard: 'لوحة التحكم',
  students: 'الطلاب',
  teachers: 'المدرسين',
  groups: 'المجموعات',
  schedule: 'الجدول الأسبوعي',
  rooms: 'القاعات',
  stages: 'المراحل الدراسية',
  sessions: 'الحصص',
  attendanceRecords: 'سجلات الحضور',
  invoices: 'الفواتير',
  payments: 'المدفوعات',
  discounts: 'الخصومات',
  expenses: 'المصروفات',
  settlements: 'تسويات المدرسين',
  assessments: 'التقييمات',
  reports: 'التقارير',
  financialReports: 'التقارير المالية',
  teacherShares: 'أنصبة المدرسين',
  notifications: 'الإشعارات',
  settings: 'إعدادات السنتر',
  messageTemplates: 'قوالب الرسائل',
  receiptSettings: 'تنسيق الإيصالات',
  subscription: 'الاشتراك والباقات',
  users: 'المستخدمين والصلاحيات',
  centers: 'بيانات السنتر',
  biometrics: 'بصمة الوجه',
  consents: 'موافقات أولياء الأمور',
  faceTemplates: 'قوالب الوجوه',
  messages: 'رسائل واتساب',
  activityLog: 'سجل النشاط',
  backup: 'النسخ الاحتياطي',
  parentPortal: 'بوابة أولياء الأمور',
  studentAccounts: 'حسابات منصة الطالب',
  studentSessions: 'جلسات وأجهزة الطالب',
  studentPortal: 'بوابة الطالب',
  designSystem: 'نظام التصميم',
};

export class PermissionError extends Error {
  public readonly code = 'PERMISSION_DENIED';
  public readonly action: PermissionAction;
  public readonly resource: PermissionResource;

  constructor(
    action: PermissionAction,
    resource: PermissionResource,
    customMessage?: string
  ) {
    const actionLabel = ACTION_LABELS_AR[action] || action;
    const resourceLabel = RESOURCE_LABELS_AR[resource] || resource;
    super(
      customMessage ||
        `ليس لديك صلاحية لتنفيذ (${actionLabel}) على (${resourceLabel}).`
    );
    this.name = 'PermissionError';
    this.action = action;
    this.resource = resource;
  }
}

export function normalizePhoneDigits(phone?: string): string {
  if (!phone) return '';
  let digits = phone.replace(/[^\d]/g, '');
  if (digits.startsWith('0020')) digits = `0${digits.slice(4)}`;
  else if (digits.startsWith('20') && digits.length === 12) digits = `0${digits.slice(2)}`;
  return digits;
}

function getTeacherOwnedGroupIds(
  actor: PermissionActor,
  context?: PermissionContext
): Set<string> {
  const ids = new Set<string>();
  if (!actor.teacherId || !context?.groups) return ids;
  for (const g of context.groups) {
    if (g.teacherId === actor.teacherId) ids.add(g.id);
  }
  return ids;
}

function isParentChildMatch(
  actor: PermissionActor,
  context?: PermissionContext
): boolean {
  const actorPhone = normalizePhoneDigits(actor.parentPhone);
  if (!actorPhone) return false;
  if (context?.parentPhone) {
    return normalizePhoneDigits(context.parentPhone) === actorPhone;
  }
  if (context?.studentId && context.students) {
    const st = context.students.find((s) => s.id === context.studentId);
    return Boolean(st && normalizePhoneDigits(st.parentPhone) === actorPhone);
  }
  return false;
}

/**
 * Central RBAC check used by UI (<Can>, route guards) AND enforced inside repositories.
 */
export function can(
  actor: PermissionActor | null | undefined,
  action: PermissionAction,
  resource: PermissionResource,
  context?: PermissionContext
): boolean {
  if (!actor) return false;
  if (actor.role === 'system') return true;

  const role = actor.role;

  // Center Owner: unrestricted across all actions & resources
  if (role === UserRole.OWNER) {
    return true;
  }

  // Center Admin: everything EXCEPT plan changes, deleting center, enabling biometrics, managing owner accounts
  if (role === UserRole.ADMIN) {
    if (action === 'change_plan' || action === 'delete_center' || action === 'enable_biometrics' || action === 'manage_owners') {
      return false;
    }
    if (resource === 'subscription' && action !== 'view') {
      return false;
    }
    if (resource === 'centers' && action === 'delete') {
      return false;
    }
    if (resource === 'biometrics' && action !== 'view') {
      return false;
    }
    if (
      resource === 'users' &&
      context?.targetUserRole === UserRole.OWNER &&
      action !== 'view'
    ) {
      return false;
    }
    return true;
  }

  // Accountant: invoices, payments, discounts, expenses, settlements, financial reports, exports.
  // View-only on students, teachers, groups. Settings restricted strictly to message templates & receipt format.
  if (role === UserRole.ACCOUNTANT) {
    if (
      resource === 'invoices' ||
      resource === 'payments' ||
      resource === 'discounts' ||
      resource === 'expenses' ||
      resource === 'settlements' ||
      resource === 'financialReports' ||
      resource === 'reports' ||
      resource === 'teacherShares'
    ) {
      return ['view', 'create', 'update', 'delete', 'export', 'print', 'settle'].includes(
        action
      );
    }
    if (resource === 'messages') {
      return ['view', 'create', 'send_whatsapp'].includes(action);
    }
    if (resource === 'messageTemplates' || resource === 'receiptSettings') {
      return ['view', 'create', 'update'].includes(action);
    }
    if (resource === 'settings') {
      if (context?.settingTab) {
        return ['templates', 'receipts', 'account'].includes(context.settingTab);
      }
      return action === 'view';
    }
    if (
      resource === 'dashboard' ||
      resource === 'students' ||
      resource === 'teachers' ||
      resource === 'groups' ||
      resource === 'schedule' ||
      resource === 'rooms' ||
      resource === 'stages' ||
      resource === 'notifications' ||
      resource === 'designSystem'
    ) {
      return action === 'view' || action === 'print';
    }
    if (resource === 'activityLog') {
      return action === 'view' || action === 'create';
    }
    return false;
  }

  // Receptionist: create/edit students, take attendance (manual/QR/makeup), record payments (create only),
  // print receipts, send WhatsApp messages.
  // Cannot edit/delete payments, expenses, discounts, settlements, settings, financial reports, or teacher shares.
  if (role === UserRole.RECEPTIONIST) {
    if (resource === 'students') {
      return ['view', 'create', 'update', 'print'].includes(action);
    }
    if (resource === 'sessions' || resource === 'attendanceRecords') {
      return ['view', 'create', 'update', 'take_attendance', 'print', 'export'].includes(
        action
      );
    }
    if (resource === 'payments') {
      return ['view', 'create', 'print'].includes(action);
    }
    if (resource === 'invoices') {
      return action === 'view' || action === 'print';
    }
    if (resource === 'messages') {
      return ['view', 'create', 'update', 'send_whatsapp'].includes(action);
    }
    if (
      resource === 'dashboard' ||
      resource === 'teachers' ||
      resource === 'groups' ||
      resource === 'schedule' ||
      resource === 'rooms' ||
      resource === 'stages' ||
      resource === 'assessments' ||
      resource === 'notifications' ||
      resource === 'messageTemplates' ||
      resource === 'consents' ||
      resource === 'faceTemplates' ||
      resource === 'designSystem'
    ) {
      return action === 'view' || action === 'print';
    }
    if (resource === 'studentAccounts') {
      return ['view', 'create', 'update', 'print'].includes(action);
    }
    if (resource === 'studentSessions') {
      return ['view', 'update', 'delete'].includes(action);
    }
    if (resource === 'activityLog') {
      return action === 'create';
    }
    return false;
  }

  // Teacher: sees ONLY own groups & students in them; takes attendance & enters assessments for those groups;
  // sees ONLY own share and settlement; NEVER sees other teachers' revenue, expenses, or center totals.
  if (role === UserRole.TEACHER) {
    if (
      resource === 'dashboard' ||
      resource === 'schedule' ||
      resource === 'rooms' ||
      resource === 'stages' ||
      resource === 'notifications' ||
      resource === 'consents' ||
      resource === 'faceTemplates' ||
      resource === 'designSystem'
    ) {
      return action === 'view';
    }
    if (resource === 'groups') {
      if (action !== 'view') return false;
      if (context?.groupTeacherId) {
        return context.groupTeacherId === actor.teacherId;
      }
      if (context?.groupId && context.groups) {
        const g = context.groups.find((gr) => gr.id === context.groupId);
        return Boolean(g && g.teacherId === actor.teacherId);
      }
      return true;
    }
    if (resource === 'students') {
      if (action !== 'view') return false;
      if (context?.studentGroupIds && context.groups) {
        const ownGroups = getTeacherOwnedGroupIds(actor, context);
        return context.studentGroupIds.some((gid) => ownGroups.has(gid));
      }
      if (context?.studentId && context.students && context.groups) {
        const ownGroups = getTeacherOwnedGroupIds(actor, context);
        const st = context.students.find((s) => s.id === context.studentId);
        return Boolean(st && st.groupIds.some((gid) => ownGroups.has(gid)));
      }
      return true;
    }
    if (resource === 'sessions' || resource === 'attendanceRecords') {
      if (!['view', 'create', 'update', 'take_attendance'].includes(action)) return false;
      if (context?.groupTeacherId) {
        return context.groupTeacherId === actor.teacherId;
      }
      if (context?.groupId && context.groups) {
        const g = context.groups.find((gr) => gr.id === context.groupId);
        return Boolean(g && g.teacherId === actor.teacherId);
      }
      return true;
    }
    if (resource === 'assessments') {
      if (!['view', 'create', 'update', 'enter_assessments'].includes(action)) return false;
      if (context?.groupTeacherId) {
        return context.groupTeacherId === actor.teacherId;
      }
      if (context?.groupId && context.groups) {
        const g = context.groups.find((gr) => gr.id === context.groupId);
        return Boolean(g && g.teacherId === actor.teacherId);
      }
      return true;
    }
    if (resource === 'teachers' || resource === 'teacherShares' || resource === 'settlements') {
      if (action !== 'view') return false;
      if (context?.teacherId) {
        return context.teacherId === actor.teacherId;
      }
      return true;
    }
    if (resource === 'activityLog') {
      return action === 'create';
    }
    return false;
  }

  // Parent: logs in with registered phone number; sees ONLY own children (attendance, assessments, invoices, receipts).
  if (role === UserRole.PARENT) {
    if (resource === 'parentPortal') {
      return action === 'view';
    }
    if (
      resource === 'students' ||
      resource === 'attendanceRecords' ||
      resource === 'assessments' ||
      resource === 'invoices' ||
      resource === 'payments' ||
      resource === 'groups' ||
      resource === 'sessions'
    ) {
      if (action !== 'view' && action !== 'print') return false;
      if (context?.parentPhone || (context?.studentId && context.students)) {
        return isParentChildMatch(actor, context);
      }
      return true;
    }
    if (resource === 'activityLog') {
      return action === 'create';
    }
    return false;
  }

  // Student: reads ONLY own groups, sessions, attendance, assessments/results, and invoice summary;
  // manages ONLY own active device sessions; NEVER reads other students, teachers, finance totals, or settings.
  if (role === UserRole.STUDENT) {
    if (resource === 'studentPortal') {
      return action === 'view';
    }
    if (resource === 'studentSessions') {
      if (!['view', 'update', 'delete'].includes(action)) return false;
      if (context?.studentId) {
        return context.studentId === actor.studentId;
      }
      return true;
    }
    if (
      resource === 'students' ||
      resource === 'attendanceRecords' ||
      resource === 'invoices'
    ) {
      if (action !== 'view') return false;
      if (context?.studentId) {
        return context.studentId === actor.studentId;
      }
      return true;
    }
    if (
      resource === 'groups' ||
      resource === 'sessions' ||
      resource === 'assessments'
    ) {
      return action === 'view';
    }
    if (resource === 'activityLog') {
      return action === 'create';
    }
    return false;
  }

  return false;
}

export function assertCan(
  actor: PermissionActor | null | undefined,
  action: PermissionAction,
  resource: PermissionResource,
  context?: PermissionContext
): void {
  if (!can(actor, action, resource, context)) {
    throw new PermissionError(action, resource);
  }
}

export function canAccessScreen(
  actor: PermissionActor | null | undefined,
  screenId: ScreenId,
  context?: PermissionContext
): boolean {
  // Public entry screens
  if (
    screenId === ScreenId.LANDING ||
    screenId === ScreenId.LOGIN ||
    screenId === ScreenId.ONBOARDING ||
    screenId === ScreenId.STUDENT_LOGIN
  ) {
    if (actor?.role === UserRole.STUDENT && screenId !== ScreenId.STUDENT_LOGIN) {
      return false;
    }
    return true;
  }

  if (screenId === ScreenId.PARENT_PORTAL) {
    if (!actor) return true;
    return actor.role === UserRole.PARENT || actor.role === UserRole.OWNER || actor.role === UserRole.ADMIN;
  }

  if (screenId === ScreenId.STUDENT_PORTAL) {
    if (!actor) return false;
    return (
      actor.role === UserRole.STUDENT ||
      actor.role === UserRole.OWNER ||
      actor.role === UserRole.ADMIN
    );
  }

  if (!actor) return false;

  if (actor.role === UserRole.PARENT || actor.role === UserRole.STUDENT) {
    return false;
  }

  switch (screenId) {
    case ScreenId.DASHBOARD:
      return can(actor, 'view', 'dashboard');
    case ScreenId.STUDENTS:
    case ScreenId.STUDENT_PROFILE:
      return can(actor, 'view', 'students', context);
    case ScreenId.TEACHERS:
      return actor.role !== UserRole.TEACHER && can(actor, 'view', 'teachers');
    case ScreenId.TEACHER_PROFILE:
      return can(actor, 'view', 'teachers', context);
    case ScreenId.GROUPS:
    case ScreenId.SCHEDULE:
      return can(actor, 'view', 'groups', context);
    case ScreenId.TAKE_ATTENDANCE:
    case ScreenId.ATTENDANCE_SUMMARY:
      return can(actor, 'take_attendance', 'sessions', context);
    case ScreenId.ATTENDANCE_HISTORY:
      return can(actor, 'view', 'attendanceRecords', context);
    case ScreenId.PAYMENTS:
    case ScreenId.LATE_PAYMENTS:
      return can(actor, 'view', 'payments') || can(actor, 'view', 'invoices');
    case ScreenId.EXPENSES:
      return can(actor, 'view', 'expenses');
    case ScreenId.ASSESSMENTS:
      return can(actor, 'view', 'assessments');
    case ScreenId.NOTIFICATIONS:
      return can(actor, 'view', 'notifications');
    case ScreenId.REPORTS:
      return can(actor, 'view', 'financialReports') || can(actor, 'view', 'reports');
    case ScreenId.SETTINGS:
      return (
        can(actor, 'view', 'settings') ||
        can(actor, 'update', 'messageTemplates') ||
        can(actor, 'update', 'receiptSettings')
      );
    case ScreenId.SUBSCRIPTION:
      return can(actor, 'view', 'subscription');
    case ScreenId.DESIGN_SYSTEM:
      return can(actor, 'view', 'designSystem');
    default:
      return false;
  }
}

export function getDefaultHomeScreen(actor: PermissionActor | null | undefined): ScreenId {
  if (!actor) return ScreenId.LOGIN;
  if (actor.role === UserRole.PARENT) return ScreenId.PARENT_PORTAL;
  if (actor.role === UserRole.STUDENT) return ScreenId.STUDENT_PORTAL;
  return ScreenId.DASHBOARD;
}

export interface ScopedCollectionsInput {
  students: Student[];
  teachers: Teacher[];
  groups: Group[];
  sessions: AttendanceSession[];
  attendanceRecords: AttendanceRecord[];
  invoices: Invoice[];
  payments: PaymentRecord[];
  discounts: DiscountRecord[];
  expenses: Expense[];
  settlements: SettlementRecord[];
  assessments: Assessment[];
  messages: OutboxMessage[];
  notifications: AppNotification[];
  users: SystemUser[];
  activityLog: ActivityLogEntry[];
}

export function scopeCollectionsForActor(
  actor: PermissionActor | null | undefined,
  data: ScopedCollectionsInput
): ScopedCollectionsInput {
  if (!actor || actor.role === 'system' || actor.role === UserRole.OWNER || actor.role === UserRole.ADMIN) {
    return data;
  }

  if (actor.role === UserRole.ACCOUNTANT) {
    return {
      ...data,
      sessions: [],
      attendanceRecords: [],
      assessments: [],
      users: data.users.filter((u) => u.id === actor.userId),
    };
  }

  if (actor.role === UserRole.RECEPTIONIST) {
    return {
      ...data,
      expenses: [],
      settlements: [],
      discounts: [],
      users: data.users.filter((u) => u.id === actor.userId),
      activityLog: [],
    };
  }

  if (actor.role === UserRole.TEACHER) {
    const teacherGroups = data.groups.filter((g) => g.teacherId === actor.teacherId);
    const groupIds = new Set(teacherGroups.map((g) => g.id));
    const scopedStudents = data.students.filter((st) =>
      st.groupIds.some((gid) => groupIds.has(gid))
    );
    const studentIds = new Set(scopedStudents.map((s) => s.id));
    const scopedSessions = data.sessions.filter((s) => groupIds.has(s.groupId));
    const sessionIds = new Set(scopedSessions.map((s) => s.id));

    return {
      ...data,
      groups: teacherGroups,
      students: scopedStudents,
      teachers: data.teachers.filter((t) => t.id === actor.teacherId),
      sessions: scopedSessions,
      attendanceRecords: data.attendanceRecords.filter(
        (r) => sessionIds.has(r.sessionId) || studentIds.has(r.studentId)
      ),
      assessments: data.assessments.filter((a) => groupIds.has(a.groupId)),
      settlements: data.settlements.filter((s) => s.teacherId === actor.teacherId),
      invoices: [],
      payments: [],
      discounts: [],
      expenses: [],
      messages: [],
      notifications: data.notifications.filter((n) => n.category === 'attendance'),
      users: data.users.filter((u) => u.id === actor.userId),
      activityLog: [],
    };
  }

  if (actor.role === UserRole.PARENT) {
    const cleanPhone = normalizePhoneDigits(actor.parentPhone);
    const myChildren = cleanPhone
      ? data.students.filter(
          (st) =>
            normalizePhoneDigits(st.parentPhone) === cleanPhone ||
            normalizePhoneDigits(st.parent?.phone) === cleanPhone
        )
      : [];
    const childIds = new Set(myChildren.map((c) => c.id));
    const childGroupIds = new Set<string>();
    myChildren.forEach((c) => c.groupIds.forEach((gid) => childGroupIds.add(gid)));
    const scopedSessions = data.sessions.filter((s) => childGroupIds.has(s.groupId));
    const sessionIds = new Set(scopedSessions.map((s) => s.id));

    return {
      ...data,
      students: myChildren,
      groups: data.groups.filter((g) => childGroupIds.has(g.id)),
      sessions: scopedSessions,
      attendanceRecords: data.attendanceRecords.filter(
        (r) => childIds.has(r.studentId) && sessionIds.has(r.sessionId)
      ),
      invoices: data.invoices.filter((inv) => childIds.has(inv.studentId)),
      payments: data.payments.filter((pay) => childIds.has(pay.studentId)),
      assessments: data.assessments.filter(
        (a) => childGroupIds.has(a.groupId) || a.grades.some((g) => childIds.has(g.studentId))
      ),
      teachers: [],
      discounts: [],
      expenses: [],
      settlements: [],
      messages: [],
      notifications: [],
      users: data.users.filter((u) => u.id === actor.userId),
      activityLog: [],
    };
  }

  if (actor.role === UserRole.STUDENT) {
    const me = data.students.filter((st) => st.id === actor.studentId);
    const myGroupIds = new Set<string>(me[0]?.groupIds || []);
    const mySessions = data.sessions.filter((s) => myGroupIds.has(s.groupId));
    const myAssessments = data.assessments
      .filter(
        (a) =>
          myGroupIds.has(a.groupId) || a.grades.some((g) => g.studentId === actor.studentId)
      )
      .map((a) => ({
        ...a,
        grades: a.grades.filter((g) => g.studentId === actor.studentId),
      }));

    return {
      ...data,
      students: me,
      groups: data.groups.filter((g) => myGroupIds.has(g.id)),
      sessions: mySessions,
      attendanceRecords: data.attendanceRecords.filter(
        (r) => r.studentId === actor.studentId
      ),
      invoices: data.invoices.filter((inv) => inv.studentId === actor.studentId),
      assessments: myAssessments,
      teachers: [],
      payments: [],
      discounts: [],
      expenses: [],
      settlements: [],
      messages: [],
      notifications: [],
      users: [],
      activityLog: [],
    };
  }

  return data;
}
