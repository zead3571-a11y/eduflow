export enum UserRole {
  OWNER = 'مالك',
  ADMIN = 'مدير',
  ACCOUNTANT = 'محاسب',
  RECEPTIONIST = 'ريسبشن',
  TEACHER = 'مدرس',
  PARENT = 'ولي أمر',
  STUDENT = 'طالب',
}

export enum ScreenId {
  LANDING = 'landing',
  LOGIN = 'login',
  ONBOARDING = 'onboarding',
  DASHBOARD = 'dashboard',
  STUDENTS = 'students',
  STUDENT_PROFILE = 'student_profile',
  TEACHERS = 'teachers',
  TEACHER_PROFILE = 'teacher_profile',
  GROUPS = 'groups',
  SCHEDULE = 'schedule',
  TAKE_ATTENDANCE = 'take_attendance',
  ATTENDANCE_SUMMARY = 'attendance_summary',
  ATTENDANCE_HISTORY = 'attendance_history',
  PAYMENTS = 'payments',
  LATE_PAYMENTS = 'late_payments',
  EXPENSES = 'expenses',
  ASSESSMENTS = 'assessments',
  NOTIFICATIONS = 'notifications',
  REPORTS = 'reports',
  SETTINGS = 'settings',
  SUBSCRIPTION = 'subscription',
  PARENT_PORTAL = 'parent_portal',
  STUDENT_LOGIN = 'student_login',
  STUDENT_PORTAL = 'student_portal',
  DESIGN_SYSTEM = 'design_system',
}

export type ListStateMode = 'ready' | 'loading' | 'empty' | 'error';

export type PaymentStatus = 'paid' | 'partial' | 'pending' | 'overdue';
export type AttendanceStatus = 'present' | 'late' | 'absent' | 'unrecorded';
export type AttendanceMethod = 'manual' | 'qr' | 'face';
export type SessionStatus = 'recorded' | 'pending' | 'upcoming';
export type SessionType = 'regular' | 'makeup';
export type CompensationType = 'percentage' | 'fixed_rent';
export type DayOfWeek = 'السبت' | 'الأحد' | 'الاثنين' | 'الثلاثاء' | 'الأربعاء' | 'الخميس' | 'الجمعة';

export interface Center {
  id: string;
  centerId: string;
  name: string;
  governorate: string;
  city: string;
  address: string;
  phone: string;
  stages: string[];
  currentPlanId: 'basic' | 'pro' | 'enterprise';
  createdAt: string;
}

export interface StudentNote {
  id: string;
  date: string;
  author: string;
  text: string;
}

export interface StudentParentInfo {
  name: string;
  phone: string;
}

export interface StandingDiscountConfig {
  type: 'scholarship' | 'waiver';
  value: number;
  reason: string;
  validFrom?: string;
  validTo?: string;
}

export interface Student {
  id: string;
  centerId: string;
  code: string;
  fullName: string;
  name: string;
  stage: string;
  phone?: string;
  parent: StudentParentInfo;
  parentName: string;
  parentPhone: string;
  groupIds: string[];
  standingDiscount?: number;
  standingDiscountConfig?: StandingDiscountConfig;
  monthlyFeeOverride?: number;
  status: 'active' | 'inactive';
  paymentStatus: PaymentStatus;
  lastAttendance: string;
  attendanceRate: number;
  notes: StudentNote[];
  createdAt: string;
}

export interface TeacherCompensation {
  type: 'percent' | 'rent';
  centerPercent?: number;
  rentAmount?: number;
  rentMode?: 'monthly' | 'per_session';
}

export interface Teacher {
  id: string;
  centerId: string;
  name: string;
  phone: string;
  subjects: string[];
  compensation: TeacherCompensation;
  compensationType: CompensationType;
  compensationValue: number;
  rentMode?: 'monthly' | 'per_session';
  hasLoginAccess: boolean;
  color: string;
}

export interface Room {
  id: string;
  centerId?: string;
  name: string;
  capacity: number;
}

export interface Group {
  id: string;
  centerId: string;
  name: string;
  subject: string;
  teacherId: string;
  stage: string;
  days: DayOfWeek[];
  startTime: string;
  endTime: string;
  room: string;
  roomId: string;
  capacity: number;
  monthlyPrice: number;
  startDate: string;
  status: 'active' | 'full' | 'paused';
}

export interface GroupConflict {
  conflictingGroupId: string;
  conflictingGroupName: string;
  reason: 'room' | 'teacher' | 'both';
  day: DayOfWeek;
  timeRange: string;
}

export interface AttendanceEntry {
  studentId: string;
  status: AttendanceStatus;
  note?: string;
  messageStatus?: 'ready' | 'sent' | 'failed';
}

export interface AttendanceSession {
  id: string;
  centerId: string;
  groupId: string;
  date: string;
  type: SessionType;
  originalSessionId?: string;
  timeLabel: string;
  roomId: string;
  status: SessionStatus;
  entries: AttendanceEntry[];
  savedAt?: string;
}

export interface AttendanceRecord {
  id: string;
  centerId: string;
  sessionId: string;
  studentId: string;
  status: AttendanceStatus;
  method: AttendanceMethod;
  confidence?: number;
  markedBy: string;
  markedAt: string;
  note?: string;
  compensatedBy?: string;
}

export interface DiscountLine {
  id: string;
  label: string;
  type?: 'sibling' | 'scholarship' | 'waiver' | 'manual';
  amount: number;
  reason?: string;
}

export interface DiscountRecord {
  id: string;
  centerId: string;
  studentId: string;
  invoiceId?: string;
  title: string;
  type: 'fixed' | 'percent';
  category?: 'sibling' | 'scholarship' | 'waiver' | 'manual';
  value: number;
  amount: number;
  reason?: string;
  createdBy: string;
  createdAt: string;
}

export interface Invoice {
  id: string;
  centerId: string;
  number: string;
  invoiceNumber: string;
  studentId: string;
  groupId: string;
  month: string;
  monthKey?: string;
  batchId?: string;
  baseAmount: number;
  discountLines: DiscountLine[];
  netAmount: number;
  isScholarshipFree?: boolean;
  dueDate: string;
  daysOverdue: number;
  total: number;
  paid: number;
  status: PaymentStatus;
  lastReminderDate?: string;
  createdAt: string;
}

export interface PaymentMethodType {
  id: 'cash' | 'instapay' | 'wallet' | 'bank';
  label: string;
}

export interface PaymentRecord {
  id: string;
  centerId: string;
  receiptNumber: string;
  invoiceId: string;
  studentId: string;
  groupId: string;
  amount: number;
  remainingAfter: number;
  method: 'نقدي' | 'إنستاباي' | 'محفظة' | 'تحويل بنكي';
  date: string;
  recordedBy: string;
  note?: string;
}

export type ExpenseCategory = 'إيجار' | 'كهرباء' | 'رواتب' | 'مستلزمات' | 'أخرى';

export interface Expense {
  id: string;
  centerId: string;
  date: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  addedBy: string;
  attachmentName?: string;
}

export interface SettlementManualLine {
  id: string;
  type: 'advance' | 'deduction' | 'bonus';
  amount: number;
  reason: string;
}

export interface SettlementRecord {
  id: string;
  centerId: string;
  teacherId: string;
  month: string;
  monthKey?: string;
  basis?: 'cash' | 'invoiced';
  collectedByGroup?: { groupId: string; groupName: string; collected: number }[];
  grossRevenue: number;
  centerDeduction?: number;
  teacherShare: number;
  centerShare: number;
  manualLines?: SettlementManualLine[];
  carriedForwardIn?: number;
  carriedForwardOut?: number;
  netPayable?: number;
  amountPaid: number;
  paymentMethod?: PaymentRecord['method'];
  status: 'pending' | 'settled';
  settledAt?: string;
  settledBy?: string;
  note?: string;
}

export interface OutboxMessage {
  id: string;
  centerId: string;
  studentId?: string;
  recipientName: string;
  recipientPhone: string;
  channel: 'whatsapp';
  templateId?: string;
  body: string;
  status: 'ready' | 'sent' | 'failed';
  createdAt: string;
  sentAt?: string;
}

export type AssessmentType = 'امتحان' | 'كويز' | 'واجب';

export interface AssessmentGrade {
  studentId: string;
  score: number | null;
  absent: boolean;
}

export interface Assessment {
  id: string;
  centerId: string;
  title: string;
  type: AssessmentType;
  groupId: string;
  date: string;
  maxScore: number;
  status: 'graded' | 'in_progress' | 'draft';
  grades: AssessmentGrade[];
}

export interface ActivityLogEntry {
  id: string;
  centerId: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole | string;
  action: string;
  resource: string;
  resourceId?: string;
  summary: string;
  before?: unknown;
  after?: unknown;
  timestamp: string;
}

export interface ConsentRecord {
  id: string;
  centerId: string;
  studentId: string;
  parentPhone: string;
  type: 'biometric_face' | 'messaging';
  granted: boolean;
  grantedAt: string;
  revokedAt?: string;
  capturedBy: string;
}

export interface FaceTemplateRecord {
  id: string;
  centerId: string;
  studentId: string;
  descriptorHash: string;
  enrolledAt: string;
  enrolledBy: string;
  status: 'active' | 'deleted';
}

export interface AppNotification {
  id: string;
  centerId?: string;
  category: 'attendance' | 'payments' | 'system';
  title: string;
  body: string;
  relativeTime: string;
  isToday: boolean;
  read: boolean;
  targetScreen: ScreenId;
  targetStudentId?: string;
}

export interface MessageTemplate {
  id: 'absence' | 'late_payment' | 'session_reminder';
  title: string;
  body: string;
}

export interface SystemUser {
  id: string;
  centerId: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  status: 'active' | 'invited';
  teacherId?: string;
  invitationCode?: string;
  // PROTOTYPE-ONLY: hashed with Web Crypto SHA-256 + per-user salt
  passwordHash: string;
  salt: string;
  failedAttempts: number;
  lockedUntil?: number;
}

export interface AuthSession {
  userId: string;
  centerId: string;
  role: UserRole;
  name: string;
  teacherId?: string;
  parentPhone?: string;
  studentId?: string;
  studentSessionId?: string;
  issuedAt: number;
  expiresAt: number;
}

export interface DiscountPolicySettings {
  siblingEnabled: boolean;
  secondChildPercent: number;
  thirdPlusChildPercent: number;
}

export interface ReceiptFormatSettings {
  headerNote: string;
  footerNote: string;
  defaultFormat: 'a5' | 'thermal80';
}

export interface CenterSettings {
  name: string;
  governorate: string;
  city: string;
  address: string;
  phone: string;
  stages: string[];
  currentPlanId: 'basic' | 'pro' | 'enterprise';
  billingBanner: 'none' | 'payment_failed' | 'grace_period' | 'read_only';
  reportsLockedDemo: boolean;
  discountPolicy?: DiscountPolicySettings;
  settlementBasis?: 'cash' | 'invoiced';
  receiptSettings?: ReceiptFormatSettings;
  biometricFaceEnabled?: boolean;
  studentPortalEnabled?: boolean;
  studentMaxDevices?: number;
  studentSessionDays?: number;
}

export interface StudentPortalAccount {
  id: string;
  centerId: string;
  studentId: string;
  status: 'active' | 'suspended';
  // PROTOTYPE-ONLY: Salted SHA-256 hash; plain access code is never persisted
  accessCodeHash: string;
  accessCodeSalt: string;
  codeLastUpdatedAt: string;
  hasPinSet: boolean;
  pinHash?: string;
  pinSalt?: string;
  lastLoginAt?: string;
  failedAttempts: number;
  lockedUntil?: number;
  createdAt: string;
}

export interface StudentDeviceSession {
  id: string;
  centerId: string;
  studentId: string;
  accountId: string;
  deviceId: string;
  deviceLabel: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: number;
  revokedAt?: string;
}

export interface StudentDeviceLockout {
  deviceId: string;
  failedAttempts: number;
  lockedUntil?: number;
}

