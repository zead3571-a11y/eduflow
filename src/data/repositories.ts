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
  UserRole,
} from '../types/eduflow';
import { DEFAULT_CENTER_ID } from './seedData';
import { LocalStorageAdapter } from './localStorageAdapter';
import { EntityCollectionsMap, EntityKey, StorageAdapter } from './storageAdapter';
import {
  assertCan,
  can,
  normalizePhoneDigits,
  PermissionAction,
  PermissionActor,
  PermissionContext,
  PermissionError,
  PermissionResource,
} from '../permissions/permissions';

export interface BaseEntity {
  id: string;
  centerId?: string;
}

export type FilterFn<T> = (item: T) => boolean;

export interface ListFilter<T> {
  centerId?: string;
  where?: Partial<T> | FilterFn<T>;
}

export interface Repository<T extends BaseEntity> {
  list(filters?: ListFilter<T>): T[];
  get(id: string): T | undefined;
  create(data: Omit<T, 'id'> & { id?: string }): T;
  update(id: string, patch: Partial<T>): T | undefined;
  remove(id: string): boolean;
  replaceAll(items: T[]): void;
}

// Module-level active permission actor synced from EduflowContext + scoped system bypass for auth/onboarding
let activeActor: PermissionActor | null = null;
let systemDepth = 0;

export function setActivePermissionActor(actor: PermissionActor | null): void {
  activeActor = actor;
}

export function getActivePermissionActor(): PermissionActor | null {
  if (systemDepth > 0) {
    return { role: 'system', centerId: DEFAULT_CENTER_ID };
  }
  return activeActor;
}

export function runWithSystemActor<T>(fn: () => T): T {
  systemDepth += 1;
  try {
    return fn();
  } finally {
    systemDepth = Math.max(0, systemDepth - 1);
  }
}

export async function runWithSystemActorAsync<T>(fn: () => Promise<T>): Promise<T> {
  systemDepth += 1;
  try {
    return await fn();
  } finally {
    systemDepth = Math.max(0, systemDepth - 1);
  }
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function matchesFilter<T extends BaseEntity>(item: T, filters?: ListFilter<T>): boolean {
  if (!filters) return true;
  if (filters.centerId && item.centerId && item.centerId !== filters.centerId) {
    return false;
  }
  if (!filters.where) return true;
  if (typeof filters.where === 'function') {
    return filters.where(item);
  }
  return Object.entries(filters.where).every(([key, value]) => {
    if (value === undefined) return true;
    return (item as Record<string, unknown>)[key] === value;
  });
}

export interface CreateRepositoriesOptions {
  getActor?: () => PermissionActor | null;
  enforcePermissions?: boolean;
}

const ENTITY_TO_RESOURCE: Record<EntityKey, PermissionResource> = {
  centers: 'centers',
  users: 'users',
  students: 'students',
  teachers: 'teachers',
  groups: 'groups',
  sessions: 'sessions',
  attendanceRecords: 'attendanceRecords',
  invoices: 'invoices',
  payments: 'payments',
  discounts: 'discounts',
  expenses: 'expenses',
  settlements: 'settlements',
  messages: 'messages',
  assessments: 'assessments',
  activityLog: 'activityLog',
  consents: 'consents',
  faceTemplates: 'faceTemplates',
  rooms: 'rooms',
  notifications: 'notifications',
  studentAccounts: 'studentAccounts',
  studentSessions: 'studentSessions',
};

function buildPermissionContextForItem(
  adapter: StorageAdapter,
  entityKey: EntityKey,
  item?: unknown
): PermissionContext {
  const groups = adapter.getCollection('groups');
  const students = adapter.getCollection('students');
  const sessions = adapter.getCollection('sessions');
  const rec = (item || {}) as Record<string, unknown>;

  const ctx: PermissionContext = {
    groups,
    students,
  };

  if (entityKey === 'teachers') {
    ctx.teacherId = rec.id as string | undefined;
  } else if (entityKey === 'groups') {
    ctx.groupId = rec.id as string | undefined;
    ctx.groupTeacherId = rec.teacherId as string | undefined;
  } else if (entityKey === 'students') {
    ctx.studentId = rec.id as string | undefined;
    ctx.studentGroupIds = Array.isArray(rec.groupIds)
      ? (rec.groupIds as string[])
      : undefined;
    ctx.parentPhone = rec.parentPhone as string | undefined;
  } else if (entityKey === 'sessions' || entityKey === 'assessments') {
    const groupId = rec.groupId as string | undefined;
    ctx.groupId = groupId;
    if (groupId) {
      ctx.groupTeacherId = groups.find((g) => g.id === groupId)?.teacherId;
    }
  } else if (entityKey === 'attendanceRecords') {
    const sessionId = rec.sessionId as string | undefined;
    const sess = sessionId ? sessions.find((s) => s.id === sessionId) : undefined;
    if (sess) {
      ctx.groupId = sess.groupId;
      ctx.groupTeacherId = groups.find((g) => g.id === sess.groupId)?.teacherId;
    }
    ctx.studentId = rec.studentId as string | undefined;
  } else if (entityKey === 'settlements') {
    ctx.teacherId = rec.teacherId as string | undefined;
  } else if (entityKey === 'users') {
    ctx.targetUserRole = rec.role as UserRole | undefined;
  } else if (entityKey === 'studentAccounts' || entityKey === 'studentSessions') {
    ctx.studentId = rec.studentId as string | undefined;
  }

  return ctx;
}

function filterItemsForActor<T>(
  adapter: StorageAdapter,
  entityKey: EntityKey,
  items: T[],
  actor: PermissionActor | null
): T[] {
  if (!actor) return [];
  if (
    actor.role === 'system' ||
    actor.role === UserRole.OWNER ||
    actor.role === UserRole.ADMIN
  ) {
    return items;
  }

  const resource = ENTITY_TO_RESOURCE[entityKey];
  if (!can(actor, 'view', resource)) {
    return [];
  }

  if (actor.role === UserRole.ACCOUNTANT) {
    if (entityKey === 'users') {
      return items.filter((u) => (u as unknown as SystemUser).id === actor.userId);
    }
    return items;
  }

  if (actor.role === UserRole.RECEPTIONIST) {
    if (entityKey === 'users') {
      return items.filter((u) => (u as unknown as SystemUser).id === actor.userId);
    }
    return items;
  }

  if (actor.role === UserRole.TEACHER) {
    const allGroups = adapter.getCollection('groups');
    const teacherGroups = allGroups.filter((g) => g.teacherId === actor.teacherId);
    const teacherGroupIds = new Set(teacherGroups.map((g) => g.id));

    if (entityKey === 'groups') {
      return items.filter((g) => (g as unknown as Group).teacherId === actor.teacherId);
    }
    if (entityKey === 'students') {
      return items.filter((s) =>
        (s as unknown as Student).groupIds.some((gid) => teacherGroupIds.has(gid))
      );
    }
    if (entityKey === 'teachers') {
      return items.filter((t) => (t as unknown as Teacher).id === actor.teacherId);
    }
    if (entityKey === 'sessions') {
      return items.filter((s) =>
        teacherGroupIds.has((s as unknown as AttendanceSession).groupId)
      );
    }
    if (entityKey === 'attendanceRecords') {
      const teacherSessionIds = new Set(
        adapter
          .getCollection('sessions')
          .filter((s) => teacherGroupIds.has(s.groupId))
          .map((s) => s.id)
      );
      return items.filter((r) =>
        teacherSessionIds.has((r as unknown as AttendanceRecord).sessionId)
      );
    }
    if (entityKey === 'assessments') {
      return items.filter((a) =>
        teacherGroupIds.has((a as unknown as Assessment).groupId)
      );
    }
    if (entityKey === 'settlements') {
      return items.filter((s) => (s as unknown as SettlementRecord).teacherId === actor.teacherId);
    }
    if (entityKey === 'users') {
      return items.filter((u) => (u as unknown as SystemUser).id === actor.userId);
    }
    if (entityKey === 'notifications') {
      return items.filter((n) => (n as unknown as AppNotification).category === 'attendance');
    }
    return items;
  }

  if (actor.role === UserRole.PARENT) {
    const cleanPhone = normalizePhoneDigits(actor.parentPhone);
    const myChildren = cleanPhone
      ? adapter
          .getCollection('students')
          .filter(
            (st) =>
              normalizePhoneDigits(st.parentPhone) === cleanPhone ||
              normalizePhoneDigits(st.parent?.phone) === cleanPhone
          )
      : [];
    const childIds = new Set(myChildren.map((c) => c.id));
    const childGroupIds = new Set<string>();
    myChildren.forEach((c) => c.groupIds.forEach((gid) => childGroupIds.add(gid)));

    if (entityKey === 'students') {
      return items.filter((s) => childIds.has((s as unknown as Student).id));
    }
    if (entityKey === 'groups') {
      return items.filter((g) => childGroupIds.has((g as unknown as Group).id));
    }
    if (entityKey === 'sessions') {
      return items.filter((s) => childGroupIds.has((s as unknown as AttendanceSession).groupId));
    }
    if (entityKey === 'attendanceRecords') {
      return items.filter((r) => childIds.has((r as unknown as AttendanceRecord).studentId));
    }
    if (entityKey === 'invoices') {
      return items.filter((inv) => childIds.has((inv as unknown as Invoice).studentId));
    }
    if (entityKey === 'payments') {
      return items.filter((p) => childIds.has((p as unknown as PaymentRecord).studentId));
    }
    if (entityKey === 'assessments') {
      return items.filter((a) => {
        const ass = a as unknown as Assessment;
        return childGroupIds.has(ass.groupId) || ass.grades.some((g) => childIds.has(g.studentId));
      });
    }
    if (entityKey === 'users') {
      return items.filter((u) => (u as unknown as SystemUser).id === actor.userId);
    }
    return [];
  }

  if (actor.role === UserRole.STUDENT) {
    const sid = actor.studentId || '';
    const me = adapter.getCollection('students').find((s) => s.id === sid);
    const myGroupIds = new Set<string>(me?.groupIds || []);

    if (entityKey === 'students') {
      return items.filter((s) => (s as unknown as Student).id === sid);
    }
    if (entityKey === 'groups') {
      return items.filter((g) => myGroupIds.has((g as unknown as Group).id));
    }
    if (entityKey === 'sessions') {
      return items.filter((s) => myGroupIds.has((s as unknown as AttendanceSession).groupId));
    }
    if (entityKey === 'attendanceRecords') {
      return items.filter((r) => (r as unknown as AttendanceRecord).studentId === sid);
    }
    if (entityKey === 'invoices') {
      return items.filter((inv) => (inv as unknown as Invoice).studentId === sid);
    }
    if (entityKey === 'assessments') {
      return items
        .filter((a) => {
          const ass = a as unknown as Assessment;
          return myGroupIds.has(ass.groupId) || ass.grades.some((g) => g.studentId === sid);
        })
        .map((a) => {
          const ass = a as unknown as Assessment;
          return {
            ...ass,
            grades: ass.grades.filter((g) => g.studentId === sid),
          } as unknown as T;
        });
    }
    if (entityKey === 'studentSessions') {
      return items.filter((s) => (s as unknown as StudentDeviceSession).studentId === sid);
    }
    return [];
  }

  return items;
}

function createEntityRepository<K extends EntityKey, T extends BaseEntity>(
  adapter: StorageAdapter,
  entityKey: K,
  idPrefix: string,
  normalizeOnWrite?: (item: T, existingItems: T[]) => T,
  options?: CreateRepositoriesOptions
): Repository<T> {
  const getItems = (): T[] => adapter.getCollection(entityKey) as unknown as T[];
  const saveItems = (items: T[]): void =>
    adapter.setCollection(entityKey, items as unknown as EntityCollectionsMap[K]);

  const checkWritePermission = (action: PermissionAction, targetItem?: unknown) => {
    if (!options?.enforcePermissions) return;
    const actor = options.getActor ? options.getActor() : null;
    const resource = ENTITY_TO_RESOURCE[entityKey];
    const ctx = buildPermissionContextForItem(adapter, entityKey, targetItem);
    assertCan(actor, action, resource, ctx);
  };

  return {
    list(filters?: ListFilter<T>): T[] {
      const all = getItems();
      const visible =
        options?.enforcePermissions && options.getActor
          ? filterItemsForActor(adapter, entityKey, all, options.getActor())
          : all;
      if (!filters) return [...visible];
      return visible.filter((item) => matchesFilter(item, filters));
    },

    get(id: string): T | undefined {
      const found = getItems().find((item) => item.id === id);
      if (!found) return undefined;
      if (options?.enforcePermissions && options.getActor) {
        const visible = filterItemsForActor(adapter, entityKey, [found], options.getActor());
        return visible[0];
      }
      return found;
    },

    create(data: Omit<T, 'id'> & { id?: string }): T {
      checkWritePermission('create', data);
      const current = getItems();
      const raw: T = {
        ...data,
        id: data.id || generateId(idPrefix),
        centerId: data.centerId || DEFAULT_CENTER_ID,
      } as T;
      const normalized = normalizeOnWrite ? normalizeOnWrite(raw, current) : raw;
      saveItems([normalized, ...current]);
      return normalized;
    },

    update(id: string, patch: Partial<T>): T | undefined {
      const current = getItems();
      const existing = current.find((item) => item.id === id);
      if (!existing) return undefined;

      // Enforce permission against BOTH existing item AND patched target (e.g., role escalation to Owner)
      checkWritePermission('update', existing);
      const mergedPreview = { ...existing, ...patch, id: existing.id };
      checkWritePermission('update', mergedPreview);

      let updatedItem: T | undefined;
      const next = current.map((item) => {
        if (item.id !== id) return item;
        const merged = {
          ...item,
          ...patch,
          id: item.id,
          centerId: patch.centerId || item.centerId || DEFAULT_CENTER_ID,
        } as T;
        updatedItem = normalizeOnWrite ? normalizeOnWrite(merged, current) : merged;
        return updatedItem;
      });
      if (!updatedItem) return undefined;
      saveItems(next);
      return updatedItem;
    },

    remove(id: string): boolean {
      const current = getItems();
      const existing = current.find((item) => item.id === id);
      if (!existing) return false;
      checkWritePermission('delete', existing);
      const filtered = current.filter((item) => item.id !== id);
      saveItems(filtered);
      return true;
    },

    replaceAll(items: T[]): void {
      if (options?.enforcePermissions) {
        const actor = options.getActor ? options.getActor() : null;
        if (!actor || actor.role !== 'system') {
          if (!can(actor, 'manage_backup', 'backup')) {
            throw new PermissionError('manage_backup', 'backup');
          }
        }
      }
      saveItems(items);
    },
  };
}

function generateNextStudentCode(existing: Student[], centerId: string): string {
  let maxNum = 100;
  for (const st of existing) {
    if ((st.centerId || DEFAULT_CENTER_ID) !== centerId) continue;
    const match = /^S-(\d+)$/.exec(st.code || '');
    if (match) {
      const parsed = Number(match[1]);
      if (parsed > maxNum) maxNum = parsed;
    }
  }
  return `S-${String(maxNum + 1).padStart(6, '0')}`;
}

export interface EduflowRepositories {
  adapter: StorageAdapter;
  centers: Repository<Center>;
  users: Repository<SystemUser>;
  students: Repository<Student>;
  teachers: Repository<Teacher>;
  groups: Repository<Group>;
  sessions: Repository<AttendanceSession>;
  attendanceRecords: Repository<AttendanceRecord>;
  invoices: Repository<Invoice>;
  payments: Repository<PaymentRecord>;
  discounts: Repository<DiscountRecord>;
  expenses: Repository<Expense>;
  settlements: Repository<SettlementRecord>;
  messages: Repository<OutboxMessage>;
  assessments: Repository<Assessment>;
  activityLog: Repository<ActivityLogEntry>;
  consents: Repository<ConsentRecord>;
  faceTemplates: Repository<FaceTemplateRecord>;
  rooms: Repository<Room>;
  notifications: Repository<AppNotification>;
  studentAccounts: Repository<StudentPortalAccount>;
  studentSessions: Repository<StudentDeviceSession>;
  meta: {
    getStages(): string[];
    setStages(stages: string[]): void;
    getTemplates(): MessageTemplate[];
    setTemplates(templates: MessageTemplate[]): void;
    getCenterSettings(): CenterSettings;
    setCenterSettings(settings: CenterSettings): void;
  };
}

export function createRepositories(
  adapter: StorageAdapter,
  options?: CreateRepositoriesOptions
): EduflowRepositories {
  const checkMetaWrite = (action: PermissionAction, resource: PermissionResource) => {
    if (!options?.enforcePermissions) return;
    const actor = options.getActor ? options.getActor() : null;
    assertCan(actor, action, resource);
  };

  return {
    adapter,
    centers: createEntityRepository<'centers', Center>(
      adapter,
      'centers',
      'center',
      undefined,
      options
    ),
    users: createEntityRepository<'users', SystemUser>(
      adapter,
      'users',
      'u',
      undefined,
      options
    ),
    students: createEntityRepository<'students', Student>(
      adapter,
      'students',
      's',
      (st, existing) => {
        const centerId = st.centerId || DEFAULT_CENTER_ID;
        const fullName = st.fullName || st.name;
        const parentName = st.parent?.name || st.parentName || '';
        const parentPhone = st.parent?.phone || st.parentPhone || '';
        const code =
          st.code && st.code.trim().length > 0
            ? st.code
            : generateNextStudentCode(existing, centerId);
        return {
          ...st,
          centerId,
          code,
          fullName,
          name: fullName,
          parent: { name: parentName, phone: parentPhone },
          parentName,
          parentPhone,
          createdAt: st.createdAt || new Date().toISOString(),
        };
      },
      options
    ),
    teachers: createEntityRepository<'teachers', Teacher>(
      adapter,
      'teachers',
      't',
      (t) => ({
        ...t,
        centerId: t.centerId || DEFAULT_CENTER_ID,
        compensation:
          t.compensation ||
          (t.compensationType === 'fixed_rent'
            ? { type: 'rent', rentAmount: t.compensationValue }
            : { type: 'percent', centerPercent: Math.max(0, 100 - t.compensationValue) }),
      }),
      options
    ),
    groups: createEntityRepository<'groups', Group>(
      adapter,
      'groups',
      'g',
      (g) => {
        const rooms = adapter.getCollection('rooms');
        const roomObj = rooms.find((r) => r.id === g.roomId);
        return {
          ...g,
          centerId: g.centerId || DEFAULT_CENTER_ID,
          room: g.room || roomObj?.name || g.roomId,
        };
      },
      options
    ),
    sessions: createEntityRepository<'sessions', AttendanceSession>(
      adapter,
      'sessions',
      'sess',
      (s) => ({
        ...s,
        centerId: s.centerId || DEFAULT_CENTER_ID,
        type: s.type || 'regular',
      }),
      options
    ),
    attendanceRecords: createEntityRepository<'attendanceRecords', AttendanceRecord>(
      adapter,
      'attendanceRecords',
      'att',
      undefined,
      options
    ),
    invoices: createEntityRepository<'invoices', Invoice>(
      adapter,
      'invoices',
      'inv',
      (inv) => {
        const number = inv.number || inv.invoiceNumber;
        const netAmount = typeof inv.netAmount === 'number' ? inv.netAmount : inv.total;
        return {
          ...inv,
          centerId: inv.centerId || DEFAULT_CENTER_ID,
          number,
          invoiceNumber: number,
          baseAmount: typeof inv.baseAmount === 'number' ? inv.baseAmount : netAmount,
          discountLines: Array.isArray(inv.discountLines) ? inv.discountLines : [],
          netAmount,
          total: netAmount,
          createdAt: inv.createdAt || new Date().toISOString(),
        };
      },
      options
    ),
    payments: createEntityRepository<'payments', PaymentRecord>(
      adapter,
      'payments',
      'pay',
      undefined,
      options
    ),
    discounts: createEntityRepository<'discounts', DiscountRecord>(
      adapter,
      'discounts',
      'disc',
      undefined,
      options
    ),
    expenses: createEntityRepository<'expenses', Expense>(
      adapter,
      'expenses',
      'exp',
      undefined,
      options
    ),
    settlements: createEntityRepository<'settlements', SettlementRecord>(
      adapter,
      'settlements',
      'stl',
      undefined,
      options
    ),
    messages: createEntityRepository<'messages', OutboxMessage>(
      adapter,
      'messages',
      'msg',
      undefined,
      options
    ),
    assessments: createEntityRepository<'assessments', Assessment>(
      adapter,
      'assessments',
      'as',
      undefined,
      options
    ),
    activityLog: createEntityRepository<'activityLog', ActivityLogEntry>(
      adapter,
      'activityLog',
      'act',
      undefined,
      options
    ),
    consents: createEntityRepository<'consents', ConsentRecord>(
      adapter,
      'consents',
      'con',
      undefined,
      options
    ),
    faceTemplates: createEntityRepository<'faceTemplates', FaceTemplateRecord>(
      adapter,
      'faceTemplates',
      'face',
      undefined,
      options
    ),
    rooms: createEntityRepository<'rooms', Room>(
      adapter,
      'rooms',
      'r',
      undefined,
      options
    ),
    notifications: createEntityRepository<'notifications', AppNotification>(
      adapter,
      'notifications',
      'not',
      undefined,
      options
    ),
    studentAccounts: createEntityRepository<'studentAccounts', StudentPortalAccount>(
      adapter,
      'studentAccounts',
      'stacc',
      undefined,
      options
    ),
    studentSessions: createEntityRepository<'studentSessions', StudentDeviceSession>(
      adapter,
      'studentSessions',
      'stsess',
      undefined,
      options
    ),
    meta: {
      getStages: () => adapter.getMeta('stages'),
      setStages: (stages) => {
        checkMetaWrite('update', 'stages');
        adapter.setMeta('stages', stages);
      },
      getTemplates: () => adapter.getMeta('templates'),
      setTemplates: (templates) => {
        checkMetaWrite('update', 'messageTemplates');
        adapter.setMeta('templates', templates);
      },
      getCenterSettings: () => adapter.getMeta('centerSettings'),
      setCenterSettings: (settings) => {
        const prev = adapter.getMeta('centerSettings');
        if (prev.currentPlanId !== settings.currentPlanId) {
          checkMetaWrite('change_plan', 'subscription');
        } else if (
          Boolean(prev.biometricFaceEnabled) !== Boolean(settings.biometricFaceEnabled)
        ) {
          checkMetaWrite('enable_biometrics', 'biometrics');
        } else {
          checkMetaWrite('update', 'settings');
        }
        adapter.setMeta('centerSettings', settings);
      },
    },
  };
}

export const defaultStorageAdapter = new LocalStorageAdapter();
export const repositories = createRepositories(defaultStorageAdapter, {
  getActor: getActivePermissionActor,
  enforcePermissions: true,
});
