import {
  ActivityLogEntry,
  AppNotification,
  Assessment,
  AttendanceRecord,
  AttendanceSession,
  Center,
  CenterSettings,
  ConsentRecord,
  DiscountRecord,
  Expense,
  FaceTemplateRecord,
  Group,
  Invoice,
  MessageTemplate,
  OutboxMessage,
  PaymentRecord,
  Room,
  SettlementRecord,
  Student,
  StudentDeviceSession,
  StudentPortalAccount,
  SystemUser,
  Teacher,
} from '../types/eduflow';
import {
  DEFAULT_CENTER_ID,
  INITIAL_ACTIVITY_LOG,
  INITIAL_ASSESSMENTS,
  INITIAL_ATTENDANCE_RECORDS,
  INITIAL_CENTERS,
  INITIAL_CENTER_SETTINGS,
  INITIAL_CONSENTS,
  INITIAL_DISCOUNTS,
  INITIAL_EXPENSES,
  INITIAL_FACE_TEMPLATES,
  INITIAL_GROUPS,
  INITIAL_INVOICES,
  INITIAL_MESSAGES,
  INITIAL_NOTIFICATIONS,
  INITIAL_PAYMENTS,
  INITIAL_ROOMS,
  INITIAL_SESSIONS,
  INITIAL_SETTLEMENTS,
  INITIAL_STUDENTS,
  INITIAL_STUDENT_ACCOUNTS,
  INITIAL_STUDENT_SESSIONS,
  INITIAL_TEACHERS,
  INITIAL_TEMPLATES,
  INITIAL_USERS,
  STAGES_LIST,
} from './seedData';

export const CURRENT_SCHEMA_VERSION = 1;

export type EntityKey =
  | 'centers'
  | 'users'
  | 'students'
  | 'teachers'
  | 'groups'
  | 'sessions'
  | 'attendanceRecords'
  | 'invoices'
  | 'payments'
  | 'discounts'
  | 'expenses'
  | 'settlements'
  | 'messages'
  | 'assessments'
  | 'activityLog'
  | 'consents'
  | 'faceTemplates'
  | 'rooms'
  | 'notifications'
  | 'studentAccounts'
  | 'studentSessions';

export interface EntityCollectionsMap {
  centers: Center[];
  users: SystemUser[];
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
  messages: OutboxMessage[];
  assessments: Assessment[];
  activityLog: ActivityLogEntry[];
  consents: ConsentRecord[];
  faceTemplates: FaceTemplateRecord[];
  rooms: Room[];
  notifications: AppNotification[];
  studentAccounts: StudentPortalAccount[];
  studentSessions: StudentDeviceSession[];
}

export interface EduflowMetaMap {
  stages: string[];
  templates: MessageTemplate[];
  centerSettings: CenterSettings;
}

export interface EduflowBackupPayload {
  app: 'EDUFLOW';
  schemaVersion: number;
  exportedAt: string;
  centerId: string;
  collections: EntityCollectionsMap;
  meta: EduflowMetaMap;
}

export const ALL_ENTITY_KEYS: EntityKey[] = [
  'centers',
  'users',
  'students',
  'teachers',
  'groups',
  'sessions',
  'attendanceRecords',
  'invoices',
  'payments',
  'discounts',
  'expenses',
  'settlements',
  'messages',
  'assessments',
  'activityLog',
  'consents',
  'faceTemplates',
  'rooms',
  'notifications',
  'studentAccounts',
  'studentSessions',
];

function deepClone<T>(val: T): T {
  return JSON.parse(JSON.stringify(val)) as T;
}

export function createInitialCollections(): EntityCollectionsMap {
  return deepClone({
    centers: INITIAL_CENTERS,
    users: INITIAL_USERS,
    students: INITIAL_STUDENTS,
    teachers: INITIAL_TEACHERS,
    groups: INITIAL_GROUPS,
    sessions: INITIAL_SESSIONS,
    attendanceRecords: INITIAL_ATTENDANCE_RECORDS,
    invoices: INITIAL_INVOICES,
    payments: INITIAL_PAYMENTS,
    discounts: INITIAL_DISCOUNTS,
    expenses: INITIAL_EXPENSES,
    settlements: INITIAL_SETTLEMENTS,
    messages: INITIAL_MESSAGES,
    assessments: INITIAL_ASSESSMENTS,
    activityLog: INITIAL_ACTIVITY_LOG,
    consents: INITIAL_CONSENTS,
    faceTemplates: INITIAL_FACE_TEMPLATES,
    rooms: INITIAL_ROOMS,
    notifications: INITIAL_NOTIFICATIONS,
    studentAccounts: INITIAL_STUDENT_ACCOUNTS,
    studentSessions: INITIAL_STUDENT_SESSIONS,
  });
}

export function createInitialMeta(): EduflowMetaMap {
  return deepClone({
    stages: STAGES_LIST,
    templates: INITIAL_TEMPLATES,
    centerSettings: INITIAL_CENTER_SETTINGS,
  });
}

/**
 * Migrates persisted or restored snapshots from older schema versions to CURRENT_SCHEMA_VERSION
 * and backfills missing Phase 1B fields (centerId, student code, fullName/parent, compensation, invoice fields).
 */
export function migrateSnapshot(
  rawCollections: Partial<EntityCollectionsMap>,
  rawMeta: Partial<EduflowMetaMap>,
  fromVersion: number
): { schemaVersion: number; collections: EntityCollectionsMap; meta: EduflowMetaMap } {
  const defaults = createInitialCollections();
  const defaultMeta = createInitialMeta();

  const merged: EntityCollectionsMap = {
    centers: Array.isArray(rawCollections.centers) ? rawCollections.centers : defaults.centers,
    users: Array.isArray(rawCollections.users) ? rawCollections.users : defaults.users,
    students: Array.isArray(rawCollections.students) ? rawCollections.students : defaults.students,
    teachers: Array.isArray(rawCollections.teachers) ? rawCollections.teachers : defaults.teachers,
    groups: Array.isArray(rawCollections.groups) ? rawCollections.groups : defaults.groups,
    sessions: Array.isArray(rawCollections.sessions) ? rawCollections.sessions : defaults.sessions,
    attendanceRecords: Array.isArray(rawCollections.attendanceRecords)
      ? rawCollections.attendanceRecords
      : defaults.attendanceRecords,
    invoices: Array.isArray(rawCollections.invoices) ? rawCollections.invoices : defaults.invoices,
    payments: Array.isArray(rawCollections.payments) ? rawCollections.payments : defaults.payments,
    discounts: Array.isArray(rawCollections.discounts) ? rawCollections.discounts : defaults.discounts,
    expenses: Array.isArray(rawCollections.expenses) ? rawCollections.expenses : defaults.expenses,
    settlements: Array.isArray(rawCollections.settlements)
      ? rawCollections.settlements
      : defaults.settlements,
    messages: Array.isArray(rawCollections.messages) ? rawCollections.messages : defaults.messages,
    assessments: Array.isArray(rawCollections.assessments)
      ? rawCollections.assessments
      : defaults.assessments,
    activityLog: Array.isArray(rawCollections.activityLog)
      ? rawCollections.activityLog
      : defaults.activityLog,
    consents: Array.isArray(rawCollections.consents) ? rawCollections.consents : defaults.consents,
    faceTemplates: Array.isArray(rawCollections.faceTemplates)
      ? rawCollections.faceTemplates
      : defaults.faceTemplates,
    rooms: Array.isArray(rawCollections.rooms) ? rawCollections.rooms : defaults.rooms,
    notifications: Array.isArray(rawCollections.notifications)
      ? rawCollections.notifications
      : defaults.notifications,
    studentAccounts: Array.isArray(rawCollections.studentAccounts)
      ? rawCollections.studentAccounts
      : defaults.studentAccounts,
    studentSessions: Array.isArray(rawCollections.studentSessions)
      ? rawCollections.studentSessions
      : defaults.studentSessions,
  };

  // Backfill v0 / partial records into v1 canonical shapes
  if (fromVersion <= CURRENT_SCHEMA_VERSION) {
    merged.students = merged.students.map((st, idx) => {
      const fullName = st.fullName || st.name;
      const parentName = st.parent?.name || st.parentName || '';
      const parentPhone = st.parent?.phone || st.parentPhone || '';
      return {
        ...st,
        centerId: st.centerId || DEFAULT_CENTER_ID,
        code: st.code || `S-${String(101 + idx).padStart(6, '0')}`,
        fullName,
        name: fullName,
        parent: { name: parentName, phone: parentPhone },
        parentName,
        parentPhone,
        createdAt: st.createdAt || '2026-09-01T09:00:00.000Z',
      };
    });

    merged.teachers = merged.teachers.map((t) => ({
      ...t,
      centerId: t.centerId || DEFAULT_CENTER_ID,
      compensation:
        t.compensation ||
        (t.compensationType === 'fixed_rent'
          ? { type: 'rent', rentAmount: t.compensationValue }
          : { type: 'percent', centerPercent: Math.max(0, 100 - t.compensationValue) }),
    }));

    const roomMap = new Map(merged.rooms.map((r) => [r.id, r.name]));
    merged.groups = merged.groups.map((g) => ({
      ...g,
      centerId: g.centerId || DEFAULT_CENTER_ID,
      room: g.room || roomMap.get(g.roomId) || g.roomId,
    }));

    merged.sessions = merged.sessions.map((s) => ({
      ...s,
      centerId: s.centerId || DEFAULT_CENTER_ID,
      type: s.type || 'regular',
    }));

    merged.invoices = merged.invoices.map((inv) => ({
      ...inv,
      centerId: inv.centerId || DEFAULT_CENTER_ID,
      number: inv.number || inv.invoiceNumber,
      invoiceNumber: inv.invoiceNumber || inv.number,
      baseAmount: typeof inv.baseAmount === 'number' ? inv.baseAmount : inv.total,
      discountLines: Array.isArray(inv.discountLines) ? inv.discountLines : [],
      netAmount: typeof inv.netAmount === 'number' ? inv.netAmount : inv.total,
      createdAt: inv.createdAt || '2026-11-01T09:00:00.000Z',
    }));

    merged.payments = merged.payments.map((p) => ({
      ...p,
      centerId: p.centerId || DEFAULT_CENTER_ID,
    }));

    merged.expenses = merged.expenses.map((e) => ({
      ...e,
      centerId: e.centerId || DEFAULT_CENTER_ID,
    }));

    merged.assessments = merged.assessments.map((a) => ({
      ...a,
      centerId: a.centerId || DEFAULT_CENTER_ID,
    }));
  }

  const meta: EduflowMetaMap = {
    stages: Array.isArray(rawMeta.stages) ? rawMeta.stages : defaultMeta.stages,
    templates: Array.isArray(rawMeta.templates) ? rawMeta.templates : defaultMeta.templates,
    centerSettings: rawMeta.centerSettings
      ? {
          ...defaultMeta.centerSettings,
          ...rawMeta.centerSettings,
          discountPolicy: {
            ...defaultMeta.centerSettings.discountPolicy!,
            ...(rawMeta.centerSettings.discountPolicy || {}),
          },
          receiptSettings: {
            ...defaultMeta.centerSettings.receiptSettings!,
            ...(rawMeta.centerSettings.receiptSettings || {}),
          },
        }
      : defaultMeta.centerSettings,
  };

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    collections: merged,
    meta,
  };
}

/**
 * StorageAdapter interface: screens and repositories talk only to this contract.
 * A future SupabaseAdapter can implement these methods against Postgres + RLS
 * without touching any screen component.
 */
export interface StorageAdapter {
  getCollection<K extends EntityKey>(key: K): EntityCollectionsMap[K];
  setCollection<K extends EntityKey>(key: K, items: EntityCollectionsMap[K]): void;
  getMeta<K extends keyof EduflowMetaMap>(key: K): EduflowMetaMap[K];
  setMeta<K extends keyof EduflowMetaMap>(key: K, value: EduflowMetaMap[K]): void;
  getRawValue<T>(key: string, fallback: T): T;
  setRawValue<T>(key: string, value: T, immediate?: boolean): void;
  removeRawValue(key: string): void;
  flush(): void;
  exportBackup(): EduflowBackupPayload;
  validateBackup(payload: unknown): {
    valid: boolean;
    error?: string;
    summary?: { students: number; teachers: number; groups: number; invoices: number; payments: number };
    parsed?: EduflowBackupPayload;
  };
  importBackup(payload: unknown): EduflowBackupPayload;
  resetToSeed(): void;
  subscribe(listener: () => void): () => void;
  setErrorHandler(handler: ((message: string) => void) | null): void;
}
