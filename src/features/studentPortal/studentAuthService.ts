import {
  ActivityLogEntry,
  CenterSettings,
  Student,
  StudentDeviceLockout,
  StudentDeviceSession,
  StudentPortalAccount,
  UserRole,
} from '../../types/eduflow';
import {
  EduflowRepositories,
  repositories as defaultRepositories,
  runWithSystemActor,
  runWithSystemActorAsync,
} from '../../data/repositories';
import { DEFAULT_CENTER_ID, isStudentPortalEnabled } from '../../data/seedData';
import {
  createPasswordCredential,
  generateSalt,
  hashPasswordWithSalt,
  verifyPasswordWithSalt,
} from '../../utils/authCrypto';
import { PermissionActor } from '../../permissions/permissions';

export const STUDENT_AUTH_SESSION_STORAGE_KEY = 'studentAuthSession';
export const STUDENT_DEVICE_ID_STORAGE_KEY = 'deviceId';
export const STUDENT_DEVICE_LOCKOUTS_KEY = 'studentDeviceLockouts';

export const STUDENT_ACCESS_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const STUDENT_ACCESS_CODE_LENGTH = 8;
export const STUDENT_LOCKOUT_DURATION_MS = 10 * 60 * 1000; // 10 minutes
export const MAX_STUDENT_FAILED_ATTEMPTS = 5;
export const DEFAULT_STUDENT_SESSION_DAYS = 7;
export const DEFAULT_STUDENT_MAX_DEVICES = 2;

export interface StudentAuthSession {
  studentId: string;
  centerId: string;
  studentSessionId: string;
  deviceId: string;
  studentName: string;
  studentCode: string;
  issuedAt: number;
  expiresAt: number;
}

export interface StudentLoginResult {
  ok: boolean;
  session?: StudentAuthSession;
  account?: StudentPortalAccount;
  requiresPinSetup?: boolean;
  requiresDeviceEviction?: boolean;
  activeSessions?: StudentDeviceSession[];
  maxDevices?: number;
  lockedUntil?: number;
  error?: string;
}

export interface BulkPrintSlipItem {
  studentId: string;
  studentName: string;
  studentCode: string;
  stage: string;
  groupNames: string[];
  accessCode: string;
}

const UNIFORM_INVALID_LOGIN_ERROR =
  'بيانات الدخول غير صحيحة. تأكد من كود الدخول ورمز المرور ثم أعد المحاولة.';

function getRandomBytes(count: number): Uint8Array {
  const bytes = new Uint8Array(count);
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
    return bytes;
  }
  for (let i = 0; i < count; i += 1) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return bytes;
}

/**
 * Generates an 8-character student access code from an unambiguous alphabet (no 0/O/1/I/l),
 * formatted as XXXX-XXXX using crypto.getRandomValues rejection sampling.
 */
export function generateStudentAccessCode(): string {
  const len = STUDENT_ACCESS_CODE_ALPHABET.length; // 31
  const maxValidByte = 256 - (256 % len); // 248 -> zero modulo bias
  let raw = '';
  while (raw.length < STUDENT_ACCESS_CODE_LENGTH) {
    const chunk = getRandomBytes(16);
    for (let i = 0; i < chunk.length && raw.length < STUDENT_ACCESS_CODE_LENGTH; i += 1) {
      if (chunk[i] < maxValidByte) {
        raw += STUDENT_ACCESS_CODE_ALPHABET[chunk[i] % len];
      }
    }
  }
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
}

export function normalizeAccessCode(input: string): string {
  return input
    .trim()
    .toUpperCase()
    .replace(/[\s\-_]+/g, '');
}

export function formatAccessCodeDisplay(rawOrGrouped: string): string {
  const norm = normalizeAccessCode(rawOrGrouped);
  if (norm.length === 8) {
    return `${norm.slice(0, 4)}-${norm.slice(4, 8)}`;
  }
  return norm;
}

export function validateStudentPin(pin: string): { valid: boolean; error?: string } {
  const trimmed = pin.trim();
  if (trimmed.length < 4 || trimmed.length > 16) {
    return {
      valid: false,
      error: 'يجب أن يتكون رمز المرور (PIN) من 4 إلى 6 أرقام أو كلمة سر قصيرة (4 أحرف على الأقل).',
    };
  }
  return { valid: true };
}

export function detectDeviceLabel(): string {
  if (typeof navigator === 'undefined') return 'جهاز غير معروف';
  const ua = navigator.userAgent || '';
  const isMobile = /Android|iPhone|iPad|Mobile/i.test(ua);
  const browser = /Edg/i.test(ua)
    ? 'Edge'
    : /Chrome/i.test(ua)
    ? 'Chrome'
    : /Safari/i.test(ua)
    ? 'Safari'
    : /Firefox/i.test(ua)
    ? 'Firefox'
    : 'متصفح ويب';
  return `${isMobile ? 'موبايل' : 'كمبيوتر'} (${browser})`;
}

function buildLockoutMessage(lockedUntil: number, now: number): string {
  const remainingSec = Math.max(1, Math.ceil((lockedUntil - now) / 1000));
  const mins = Math.floor(remainingSec / 60);
  const secs = remainingSec % 60;
  const waitText = mins > 0 ? `${mins} دقيقة و${secs} ثانية` : `${secs} ثانية`;
  return `تم إيقاف محاولات الدخول مؤقتاً لمدة 10 دقائق بعد 5 محاولات غير صحيحة. حاول مجدداً بعد ${waitText}.`;
}

export class StudentAuthService {
  private repos: EduflowRepositories;

  constructor(repos: EduflowRepositories) {
    this.repos = repos;
  }

  public getOrCreateDeviceId(): string {
    const existing = this.repos.adapter.getRawValue<string | null>(
      STUDENT_DEVICE_ID_STORAGE_KEY,
      null
    );
    if (existing) return existing;
    const generated = `dev-${generateSalt(6)}`;
    this.repos.adapter.setRawValue(STUDENT_DEVICE_ID_STORAGE_KEY, generated, true);
    return generated;
  }

  private getDeviceLockouts(): Record<string, StudentDeviceLockout> {
    return this.repos.adapter.getRawValue<Record<string, StudentDeviceLockout>>(
      STUDENT_DEVICE_LOCKOUTS_KEY,
      {}
    );
  }

  private setDeviceLockouts(map: Record<string, StudentDeviceLockout>): void {
    this.repos.adapter.setRawValue(STUDENT_DEVICE_LOCKOUTS_KEY, map, true);
  }

  private recordDeviceFailure(deviceId: string, now: number): StudentDeviceLockout {
    const map = this.getDeviceLockouts();
    const prev = map[deviceId];
    const baseAttempts =
      prev && prev.lockedUntil && now >= prev.lockedUntil ? 0 : prev?.failedAttempts || 0;
    const nextAttempts = baseAttempts + 1;
    const lockedUntil =
      nextAttempts >= MAX_STUDENT_FAILED_ATTEMPTS ? now + STUDENT_LOCKOUT_DURATION_MS : undefined;
    const next: StudentDeviceLockout = {
      deviceId,
      failedAttempts: nextAttempts,
      lockedUntil,
    };
    this.setDeviceLockouts({ ...map, [deviceId]: next });
    return next;
  }

  private clearDeviceFailure(deviceId: string): void {
    const map = this.getDeviceLockouts();
    if (map[deviceId]) {
      const next = { ...map };
      delete next[deviceId];
      this.setDeviceLockouts(next);
    }
  }

  private writeActivityLog(
    actor: PermissionActor | null,
    entry: Omit<ActivityLogEntry, 'id' | 'centerId' | 'actorId' | 'actorName' | 'actorRole' | 'timestamp'> & {
      centerId?: string;
      actorId?: string;
      actorName?: string;
      actorRole?: UserRole;
      timestamp?: string;
    }
  ): void {
    runWithSystemActor(() => {
      const userRecord = actor?.userId ? this.repos.users.get(actor.userId) : undefined;
      this.repos.activityLog.create({
        centerId: entry.centerId || actor?.centerId || DEFAULT_CENTER_ID,
        actorId: entry.actorId || actor?.userId || 'system',
        actorName: entry.actorName || userRecord?.name || 'النظام',
        actorRole: entry.actorRole || actor?.role || UserRole.OWNER,
        action: entry.action,
        resource: entry.resource,
        resourceId: entry.resourceId,
        summary: entry.summary,
        before: entry.before,
        after: entry.after,
        timestamp: entry.timestamp || new Date().toISOString(),
      });
    });
  }

  public getPersistedStudentSession(now = Date.now()): StudentAuthSession | null {
    const raw = this.repos.adapter.getRawValue<StudentAuthSession | null>(
      STUDENT_AUTH_SESSION_STORAGE_KEY,
      null
    );
    if (!raw || !raw.studentId || !raw.studentSessionId || !raw.expiresAt) {
      return null;
    }
    if (now >= raw.expiresAt) {
      this.repos.adapter.removeRawValue(STUDENT_AUTH_SESSION_STORAGE_KEY);
      return null;
    }

    const settings = this.repos.meta.getCenterSettings();
    if (!isStudentPortalEnabled(settings)) {
      this.repos.adapter.removeRawValue(STUDENT_AUTH_SESSION_STORAGE_KEY);
      return null;
    }

    const valid = runWithSystemActor(() => {
      const account = this.repos.studentAccounts
        .list()
        .find((a) => a.studentId === raw.studentId);
      if (!account || account.status !== 'active') return false;
      const student = this.repos.students.get(raw.studentId);
      if (!student || student.status !== 'active') return false;
      const sess = this.repos.studentSessions.get(raw.studentSessionId);
      if (!sess || sess.revokedAt || now >= sess.expiresAt) return false;
      return true;
    });

    if (!valid) {
      this.repos.adapter.removeRawValue(STUDENT_AUTH_SESSION_STORAGE_KEY);
      return null;
    }
    return raw;
  }

  public getActiveSessionsForStudent(
    studentId: string,
    now = Date.now()
  ): StudentDeviceSession[] {
    return this.repos.studentSessions
      .list()
      .filter((s) => s.studentId === studentId && !s.revokedAt && s.expiresAt > now)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  /**
   * Staff action: Create or regenerate a personal access code for a student.
   * Plain code is returned ONCE and NEVER persisted.
   */
  public async createOrRegenerateAccessCode(
    studentId: string,
    actor: PermissionActor | null,
    options?: { isRegenerate?: boolean }
  ): Promise<{ account: StudentPortalAccount; plainCode: string }> {
    const student = this.repos.students.get(studentId);
    if (!student) {
      throw new Error('ملف الطالب غير موجود.');
    }

    const existing = this.repos.studentAccounts
      .list()
      .find((a) => a.studentId === studentId);
    const isRegen = Boolean(existing || options?.isRegenerate);

    const plainCode = generateStudentAccessCode();
    const normalized = normalizeAccessCode(plainCode);
    const cred = await createPasswordCredential(normalized);
    const nowIso = new Date().toISOString();

    let saved: StudentPortalAccount;
    if (existing) {
      // Regenerating invalidates old code, resets PIN so the new slip works cleanly on first login,
      // and revokes every active student session immediately.
      const updated = this.repos.studentAccounts.update(existing.id, {
        accessCodeHash: cred.passwordHash,
        accessCodeSalt: cred.salt,
        hasPinSet: false,
        pinHash: undefined,
        pinSalt: undefined,
        status: 'active',
        failedAttempts: 0,
        lockedUntil: undefined,
        codeLastUpdatedAt: nowIso,
      });
      if (!updated) throw new Error('تعذر تحديث حساب الطالب.');
      saved = updated;

      const activeSessions = this.repos.studentSessions
        .list()
        .filter((s) => s.studentId === studentId && !s.revokedAt);
      activeSessions.forEach((s) => {
        this.repos.studentSessions.update(s.id, { revokedAt: nowIso });
      });

      const localSess = this.repos.adapter.getRawValue<StudentAuthSession | null>(
        STUDENT_AUTH_SESSION_STORAGE_KEY,
        null
      );
      if (localSess && localSess.studentId === studentId) {
        this.repos.adapter.removeRawValue(STUDENT_AUTH_SESSION_STORAGE_KEY);
      }
    } else {
      saved = this.repos.studentAccounts.create({
        centerId: student.centerId || actor?.centerId || DEFAULT_CENTER_ID,
        studentId: student.id,
        accessCodeHash: cred.passwordHash,
        accessCodeSalt: cred.salt,
        hasPinSet: false,
        status: 'active',
        failedAttempts: 0,
        codeLastUpdatedAt: nowIso,
        createdAt: nowIso,
      });
    }

    this.writeActivityLog(actor, {
      action: isRegen ? 'studentPortal.code_regenerated' : 'studentPortal.code_generated',
      resource: 'studentAccounts',
      resourceId: saved.id,
      summary: isRegen
        ? `إعادة توليد كود دخول منصة الطالب وإنهاء الجلسات النشطة للطالب "${student.name}" (${student.code})`
        : `إنشاء كود دخول منصة الطالب للطالب "${student.name}" (${student.code})`,
      before: existing
        ? { codeLastUpdatedAt: existing.codeLastUpdatedAt, status: existing.status }
        : undefined,
      after: { accountId: saved.id, studentId: student.id, status: saved.status },
    });

    this.repos.adapter.flush();
    return { account: saved, plainCode };
  }

  /**
   * Staff action: Bulk generate (or regenerate) access codes for multiple students for immediate A4 slip printing.
   * Plain codes exist ONLY in the returned array during the print modal session.
   */
  public async bulkGenerateCodesForPrint(
    studentIds: string[],
    actor: PermissionActor | null
  ): Promise<BulkPrintSlipItem[]> {
    const groups = this.repos.groups.list();
    const results: BulkPrintSlipItem[] = [];

    for (const sid of studentIds) {
      const student = this.repos.students.get(sid);
      if (!student) continue;
      const { plainCode } = await this.createOrRegenerateAccessCode(sid, actor, {
        isRegenerate: true,
      });
      const stGroups = groups
        .filter((g) => student.groupIds.includes(g.id))
        .map((g) => g.name);
      results.push({
        studentId: student.id,
        studentName: student.name,
        studentCode: student.code,
        stage: student.stage,
        groupNames: stGroups,
        accessCode: plainCode,
      });
    }

    if (results.length > 0) {
      this.writeActivityLog(actor, {
        action: 'studentPortal.bulk_codes_generated',
        resource: 'studentAccounts',
        summary: `توليد وطباعة بطاقات دخول المنصة لـ ${results.length} طلاب`,
        after: { count: results.length, studentIds: results.map((r) => r.studentId) },
      });
      this.repos.adapter.flush();
    }

    return results;
  }

  public suspendOrActivateAccount(
    studentId: string,
    status: 'active' | 'suspended',
    actor: PermissionActor | null
  ): StudentPortalAccount | null {
    const existing = this.repos.studentAccounts
      .list()
      .find((a) => a.studentId === studentId);
    if (!existing) return null;
    const student = this.repos.students.get(studentId);
    const prevStatus = existing.status;
    const updated = this.repos.studentAccounts.update(existing.id, { status });
    const nowIso = new Date().toISOString();

    if (status === 'suspended') {
      this.repos.studentSessions
        .list()
        .filter((s) => s.studentId === studentId && !s.revokedAt)
        .forEach((s) => {
          this.repos.studentSessions.update(s.id, { revokedAt: nowIso });
        });
      const localSess = this.repos.adapter.getRawValue<StudentAuthSession | null>(
        STUDENT_AUTH_SESSION_STORAGE_KEY,
        null
      );
      if (localSess && localSess.studentId === studentId) {
        this.repos.adapter.removeRawValue(STUDENT_AUTH_SESSION_STORAGE_KEY);
      }
    }

    this.writeActivityLog(actor, {
      action:
        status === 'suspended'
          ? 'studentPortal.account_suspended'
          : 'studentPortal.account_activated',
      resource: 'studentAccounts',
      resourceId: existing.id,
      summary:
        status === 'suspended'
          ? `إيقاف حساب منصة الطالب "${student?.name || studentId}"`
          : `تفعيل حساب منصة الطالب "${student?.name || studentId}"`,
      before: { status: prevStatus },
      after: { status },
    });

    this.repos.adapter.flush();
    return updated || null;
  }

  public revokeAllStudentSessions(
    studentId: string,
    actor: PermissionActor | null
  ): number {
    const student = this.repos.students.get(studentId);
    const active = this.repos.studentSessions
      .list()
      .filter((s) => s.studentId === studentId && !s.revokedAt);
    const nowIso = new Date().toISOString();
    active.forEach((s) => {
      this.repos.studentSessions.update(s.id, { revokedAt: nowIso });
    });

    const localSess = this.repos.adapter.getRawValue<StudentAuthSession | null>(
      STUDENT_AUTH_SESSION_STORAGE_KEY,
      null
    );
    if (localSess && localSess.studentId === studentId) {
      this.repos.adapter.removeRawValue(STUDENT_AUTH_SESSION_STORAGE_KEY);
    }

    this.writeActivityLog(actor, {
      action: 'studentPortal.sessions_revoked',
      resource: 'studentSessions',
      resourceId: studentId,
      summary: `إنهاء كل جلسات المنصة النشطة (${active.length}) للطالب "${student?.name || studentId}"`,
      after: { revokedCount: active.length },
    });

    this.repos.adapter.flush();
    return active.length;
  }

  public revokeSingleSession(
    sessionId: string,
    actor: PermissionActor | null
  ): boolean {
    const target = this.repos.studentSessions.get(sessionId);
    if (!target || target.revokedAt) return false;
    const nowIso = new Date().toISOString();
    this.repos.studentSessions.update(sessionId, { revokedAt: nowIso });

    const localSess = this.repos.adapter.getRawValue<StudentAuthSession | null>(
      STUDENT_AUTH_SESSION_STORAGE_KEY,
      null
    );
    if (localSess && localSess.studentSessionId === sessionId) {
      this.repos.adapter.removeRawValue(STUDENT_AUTH_SESSION_STORAGE_KEY);
    }

    this.writeActivityLog(actor, {
      action: 'studentPortal.device_signed_out',
      resource: 'studentSessions',
      resourceId: sessionId,
      summary: `تسجيل خروج جهاز (${target.deviceLabel}) من حساب الطالب`,
      after: { studentId: target.studentId, deviceId: target.deviceId },
    });
    this.repos.adapter.flush();
    return true;
  }

  private async findAccountByAccessCode(
    normalizedCode: string
  ): Promise<StudentPortalAccount | null> {
    const accounts = this.repos.studentAccounts.list();
    let matched: StudentPortalAccount | null = null;
    // Iterate through all accounts (constant-time hash comparison per record)
    // without early exit so account index does not leak timing information.
    for (const acc of accounts) {
      const ok = await verifyPasswordWithSalt(
        normalizedCode,
        acc.accessCodeSalt,
        acc.accessCodeHash
      );
      if (ok) {
        matched = acc;
      }
    }
    return matched;
  }

  private issueDeviceSession(params: {
    account: StudentPortalAccount;
    student: Student;
    deviceId: string;
    deviceLabel: string;
    kickOldestDevice?: boolean;
    settings: CenterSettings;
    now: number;
  }): StudentLoginResult {
    const maxDevices = Math.max(1, params.settings.studentMaxDevices || DEFAULT_STUDENT_MAX_DEVICES);
    const sessionDays = Math.max(1, params.settings.studentSessionDays || DEFAULT_STUDENT_SESSION_DAYS);
    const expiresAt = params.now + sessionDays * 24 * 60 * 60 * 1000;
    const nowIso = new Date(params.now).toISOString();

    const active = this.getActiveSessionsForStudent(params.account.studentId, params.now);
    const existingSameDevice = active.find((s) => s.deviceId === params.deviceId);

    let deviceSession: StudentDeviceSession;
    if (existingSameDevice) {
      deviceSession =
        this.repos.studentSessions.update(existingSameDevice.id, {
          lastSeenAt: nowIso,
          expiresAt,
          deviceLabel: params.deviceLabel,
        }) || existingSameDevice;
    } else {
      if (active.length >= maxDevices) {
        if (!params.kickOldestDevice) {
          return {
            ok: false,
            requiresDeviceEviction: true,
            activeSessions: active,
            maxDevices,
            error: `تم الوصول للحد الأقصى للأجهزة (${maxDevices} جهاز). سجّل الخروج من أقدم جهاز للمتابعة.`,
          };
        }
        const sortedOldest = [...active].sort(
          (a, b) => new Date(a.lastSeenAt).getTime() - new Date(b.lastSeenAt).getTime()
        );
        const toEvictCount = active.length - maxDevices + 1;
        for (let i = 0; i < toEvictCount; i += 1) {
          const victim = sortedOldest[i];
          if (victim) {
            this.repos.studentSessions.update(victim.id, { revokedAt: nowIso });
            this.repos.activityLog.create({
              centerId: params.account.centerId,
              actorId: params.student.id,
              actorName: params.student.name,
              actorRole: UserRole.STUDENT,
              action: 'studentPortal.device_evicted',
              resource: 'studentSessions',
              resourceId: victim.id,
              summary: `تسجيل خروج أقدم جهاز تلقائياً (${victim.deviceLabel}) لتجاوز حد الأجهزة`,
              timestamp: nowIso,
            });
          }
        }
      }

      deviceSession = this.repos.studentSessions.create({
        centerId: params.account.centerId,
        studentId: params.student.id,
        accountId: params.account.id,
        deviceId: params.deviceId,
        deviceLabel: params.deviceLabel,
        createdAt: nowIso,
        lastSeenAt: nowIso,
        expiresAt,
      });
    }

    const updatedAccount =
      this.repos.studentAccounts.update(params.account.id, {
        failedAttempts: 0,
        lockedUntil: undefined,
        lastLoginAt: nowIso,
      }) || params.account;

    this.clearDeviceFailure(params.deviceId);

    const authSession: StudentAuthSession = {
      studentId: params.student.id,
      centerId: params.account.centerId,
      studentSessionId: deviceSession.id,
      deviceId: params.deviceId,
      studentName: params.student.name,
      studentCode: params.student.code,
      issuedAt: params.now,
      expiresAt,
    };

    // Ensure staff session is cleared so student login stays isolated in Student role
    this.repos.adapter.removeRawValue('authSession');
    this.repos.adapter.setRawValue(STUDENT_AUTH_SESSION_STORAGE_KEY, authSession, true);

    this.repos.activityLog.create({
      centerId: params.account.centerId,
      actorId: params.student.id,
      actorName: params.student.name,
      actorRole: UserRole.STUDENT,
      action: 'studentPortal.student_login',
      resource: 'studentSessions',
      resourceId: deviceSession.id,
      summary: `دخول الطالب "${params.student.name}" إلى بوابة الطالب (${params.deviceLabel})`,
      timestamp: nowIso,
    });
    this.repos.adapter.flush();

    return { ok: true, session: authSession, account: updatedAccount };
  }

  /**
   * Student Portal Login:
   * - Validates portal enabled (plan flag + Settings switch).
   * - Enforces per-device 5-fail / 10-min lockout AND per-account 5-fail / 10-min lockout.
   * - Uses constant-time compare without leaking whether an access code exists.
   * - Triggers first-login PIN setup when `!account.hasPinSet`, otherwise validates code + PIN.
   */
  public async loginWithCode(params: {
    accessCode: string;
    pin?: string;
    kickOldestDevice?: boolean;
    deviceId?: string;
    deviceLabel?: string;
    now?: number;
  }): Promise<StudentLoginResult> {
    return runWithSystemActorAsync(async () => {
      const now = params.now ?? Date.now();
      const settings = this.repos.meta.getCenterSettings();
      if (!isStudentPortalEnabled(settings)) {
        return {
          ok: false,
          error: 'بوابة الطالب غير مفعّلة حالياً في إعدادات السنتر أو الباقة.',
        };
      }

      const deviceId = params.deviceId || this.getOrCreateDeviceId();
      const deviceLabel = params.deviceLabel || detectDeviceLabel();

      // 1) Per-device lockout check
      const deviceLockout = this.getDeviceLockouts()[deviceId];
      if (deviceLockout?.lockedUntil && now < deviceLockout.lockedUntil) {
        return {
          ok: false,
          lockedUntil: deviceLockout.lockedUntil,
          error: buildLockoutMessage(deviceLockout.lockedUntil, now),
        };
      }

      const normalizedCode = normalizeAccessCode(params.accessCode);
      if (normalizedCode.length !== STUDENT_ACCESS_CODE_LENGTH) {
        const nextDev = this.recordDeviceFailure(deviceId, now);
        this.repos.adapter.flush();
        if (nextDev.lockedUntil) {
          return {
            ok: false,
            lockedUntil: nextDev.lockedUntil,
            error: buildLockoutMessage(nextDev.lockedUntil, now),
          };
        }
        return { ok: false, error: UNIFORM_INVALID_LOGIN_ERROR };
      }

      // 2) Constant-time comparison across accounts (no code existence hint)
      const matchedAccount = await this.findAccountByAccessCode(normalizedCode);
      if (!matchedAccount) {
        const nextDev = this.recordDeviceFailure(deviceId, now);
        this.repos.adapter.flush();
        if (nextDev.lockedUntil) {
          return {
            ok: false,
            lockedUntil: nextDev.lockedUntil,
            error: buildLockoutMessage(nextDev.lockedUntil, now),
          };
        }
        return { ok: false, error: UNIFORM_INVALID_LOGIN_ERROR };
      }

      // 3) Per-account lockout check
      if (matchedAccount.lockedUntil && now < matchedAccount.lockedUntil) {
        return {
          ok: false,
          lockedUntil: matchedAccount.lockedUntil,
          error: buildLockoutMessage(matchedAccount.lockedUntil, now),
        };
      }

      const student = this.repos.students.get(matchedAccount.studentId);
      if (!student || student.status !== 'active') {
        return {
          ok: false,
          error: 'تعذر تسجيل الدخول لأن ملف الطالب موقوف لدى السنتر.',
        };
      }

      // 4) If PIN is already set, verify PIN in constant time
      if (matchedAccount.hasPinSet && matchedAccount.pinHash && matchedAccount.pinSalt) {
        const pinCandidate = (params.pin || '').trim();
        const pinValid = pinCandidate
          ? await verifyPasswordWithSalt(
              pinCandidate,
              matchedAccount.pinSalt,
              matchedAccount.pinHash
            )
          : false;

        if (!pinValid) {
          const baseAttempts =
            matchedAccount.lockedUntil && now >= matchedAccount.lockedUntil
              ? 0
              : matchedAccount.failedAttempts || 0;
          const nextAttempts = baseAttempts + 1;
          const accLockedUntil =
            nextAttempts >= MAX_STUDENT_FAILED_ATTEMPTS
              ? now + STUDENT_LOCKOUT_DURATION_MS
              : undefined;

          this.repos.studentAccounts.update(matchedAccount.id, {
            failedAttempts: nextAttempts,
            lockedUntil: accLockedUntil,
          });
          const nextDev = this.recordDeviceFailure(deviceId, now);

          if (accLockedUntil || nextDev.lockedUntil) {
            this.repos.activityLog.create({
              centerId: matchedAccount.centerId,
              actorId: student.id,
              actorName: student.name,
              actorRole: UserRole.STUDENT,
              action: 'studentPortal.lockout',
              resource: 'studentAccounts',
              resourceId: matchedAccount.id,
              summary: `قفل مؤقت لدخول الطالب "${student.name}" لمدة 10 دقائق بعد 5 محاولات خاطئة`,
              timestamp: new Date(now).toISOString(),
            });
            this.repos.adapter.flush();
            const lockTs = accLockedUntil || nextDev.lockedUntil!;
            return {
              ok: false,
              lockedUntil: lockTs,
              error: buildLockoutMessage(lockTs, now),
            };
          }

          this.repos.adapter.flush();
          return { ok: false, error: UNIFORM_INVALID_LOGIN_ERROR };
        }
      }

      // Check suspended status only after validating code (and PIN if set)
      if (matchedAccount.status === 'suspended') {
        return {
          ok: false,
          error: 'حساب المنصة الخاص بك موقوف حالياً. يرجى مراجعة إدارة السنتر.',
        };
      }

      // 5) First login: require student to create a 4-6 digit PIN or password
      if (!matchedAccount.hasPinSet) {
        return {
          ok: false,
          requiresPinSetup: true,
          account: matchedAccount,
        };
      }

      // 6) Returning student with valid code + PIN -> issue 7-day device session
      return this.issueDeviceSession({
        account: matchedAccount,
        student,
        deviceId,
        deviceLabel,
        kickOldestDevice: params.kickOldestDevice,
        settings,
        now,
      });
    });
  }

  public async completeFirstLoginPinSetup(params: {
    accessCode: string;
    newPin: string;
    kickOldestDevice?: boolean;
    deviceId?: string;
    deviceLabel?: string;
    now?: number;
  }): Promise<StudentLoginResult> {
    return runWithSystemActorAsync(async () => {
      const now = params.now ?? Date.now();
      const settings = this.repos.meta.getCenterSettings();
      if (!isStudentPortalEnabled(settings)) {
        return { ok: false, error: 'بوابة الطالب غير مفعّلة حالياً.' };
      }

      const pinCheck = validateStudentPin(params.newPin);
      if (!pinCheck.valid) {
        return { ok: false, error: pinCheck.error };
      }

      const normalizedCode = normalizeAccessCode(params.accessCode);
      const account = await this.findAccountByAccessCode(normalizedCode);
      if (!account) {
        return { ok: false, error: UNIFORM_INVALID_LOGIN_ERROR };
      }
      if (account.lockedUntil && now < account.lockedUntil) {
        return {
          ok: false,
          lockedUntil: account.lockedUntil,
          error: buildLockoutMessage(account.lockedUntil, now),
        };
      }
      if (account.status === 'suspended') {
        return { ok: false, error: 'حساب المنصة موقوف حالياً. تواصل مع إدارة السنتر.' };
      }
      if (account.hasPinSet) {
        return {
          ok: false,
          error: 'تم تعيين رمز المرور لهذا الحساب مسبقاً. يرجى تسجيل الدخول بالكود والرمز.',
        };
      }

      const student = this.repos.students.get(account.studentId);
      if (!student || student.status !== 'active') {
        return { ok: false, error: 'ملف الطالب غير نشط.' };
      }

      const pinCred = await createPasswordCredential(params.newPin.trim());
      const updatedAcc =
        this.repos.studentAccounts.update(account.id, {
          pinHash: pinCred.passwordHash,
          pinSalt: pinCred.salt,
          hasPinSet: true,
        }) || account;

      this.repos.activityLog.create({
        centerId: account.centerId,
        actorId: student.id,
        actorName: student.name,
        actorRole: UserRole.STUDENT,
        action: 'studentPortal.pin_created',
        resource: 'studentAccounts',
        resourceId: account.id,
        summary: `تعيين رمز المرور (PIN) لأول مرة للطالب "${student.name}"`,
        timestamp: new Date(now).toISOString(),
      });

      const deviceId = params.deviceId || this.getOrCreateDeviceId();
      const deviceLabel = params.deviceLabel || detectDeviceLabel();

      return this.issueDeviceSession({
        account: updatedAcc,
        student,
        deviceId,
        deviceLabel,
        kickOldestDevice: params.kickOldestDevice,
        settings,
        now,
      });
    });
  }

  public async changeStudentPin(params: {
    studentId: string;
    oldPin: string;
    newPin: string;
  }): Promise<{ ok: boolean; error?: string }> {
    return runWithSystemActorAsync(async () => {
      const account = this.repos.studentAccounts
        .list()
        .find((a) => a.studentId === params.studentId);
      if (!account || !account.pinHash || !account.pinSalt) {
        return { ok: false, error: 'حساب الطالب غير موجود.' };
      }

      const validOld = await verifyPasswordWithSalt(
        params.oldPin.trim(),
        account.pinSalt,
        account.pinHash
      );
      if (!validOld) {
        return { ok: false, error: 'رمز المرور الحالي غير صحيح.' };
      }

      const pinCheck = validateStudentPin(params.newPin);
      if (!pinCheck.valid) {
        return { ok: false, error: pinCheck.error };
      }

      const nextCred = await createPasswordCredential(params.newPin.trim());
      this.repos.studentAccounts.update(account.id, {
        pinHash: nextCred.passwordHash,
        pinSalt: nextCred.salt,
        hasPinSet: true,
      });

      const student = this.repos.students.get(params.studentId);
      this.repos.activityLog.create({
        centerId: account.centerId,
        actorId: params.studentId,
        actorName: student?.name || 'طالب',
        actorRole: UserRole.STUDENT,
        action: 'studentPortal.pin_changed',
        resource: 'studentAccounts',
        resourceId: account.id,
        summary: `تغيير رمز المرور (PIN) من داخل بوابة الطالب "${student?.name || params.studentId}"`,
        timestamp: new Date().toISOString(),
      });
      this.repos.adapter.flush();
      return { ok: true };
    });
  }

  public logoutCurrentDevice(session?: StudentAuthSession | null): void {
    runWithSystemActor(() => {
      const current = session || this.getPersistedStudentSession();
      if (current) {
        const target = this.repos.studentSessions.get(current.studentSessionId);
        if (target && !target.revokedAt) {
          this.repos.studentSessions.update(target.id, {
            revokedAt: new Date().toISOString(),
          });
        }
        this.repos.activityLog.create({
          centerId: current.centerId,
          actorId: current.studentId,
          actorName: current.studentName,
          actorRole: UserRole.STUDENT,
          action: 'studentPortal.student_logout',
          resource: 'studentSessions',
          resourceId: current.studentSessionId,
          summary: `تسجيل خروج الطالب "${current.studentName}" من الجهاز الحالي`,
          timestamp: new Date().toISOString(),
        });
      }
      this.repos.adapter.removeRawValue(STUDENT_AUTH_SESSION_STORAGE_KEY);
      this.repos.adapter.flush();
    });
  }
}

export const studentAuthService = new StudentAuthService(defaultRepositories);

export function hashCodePreviewNote(salt: string, hash: string): Promise<boolean> {
  return hashPasswordWithSalt('', salt).then((h) => h === hash);
}
