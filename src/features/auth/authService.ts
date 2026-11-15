import {
  AuthSession,
  Center,
  Room,
  SystemUser,
  Teacher,
  UserRole,
} from '../../types/eduflow';
import {
  EduflowRepositories,
  repositories as defaultRepositories,
  runWithSystemActor,
  runWithSystemActorAsync,
} from '../../data/repositories';
import { DEFAULT_CENTER_ID } from '../../data/seedData';
import { createPasswordCredential, verifyPasswordWithSalt } from '../../utils/authCrypto';
import { normalizePhoneDigits } from '../../permissions/permissions';

export const AUTH_SESSION_STORAGE_KEY = 'authSession';
export const DEMO_MODE_STORAGE_KEY = 'demoMode';
export const LAST_SCREEN_STORAGE_KEY = 'lastScreen';

export const SESSION_DURATION_MS = 12 * 60 * 60 * 1000; // 12 hours
export const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes
export const MAX_FAILED_LOGIN_ATTEMPTS = 5;

export interface LoginResult {
  ok: boolean;
  session?: AuthSession;
  user?: SystemUser;
  error?: string;
  lockedUntil?: number;
  remainingAttempts?: number;
}

function normalizePhoneOrEmail(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, '');
}

export class AuthService {
  private repos: EduflowRepositories;

  constructor(repos: EduflowRepositories) {
    this.repos = repos;
  }

  public getPersistedSession(now = Date.now()): AuthSession | null {
    const raw = this.repos.adapter.getRawValue<AuthSession | null>(
      AUTH_SESSION_STORAGE_KEY,
      null
    );
    if (!raw || !raw.userId || !raw.expiresAt) return null;
    if (now >= raw.expiresAt) {
      this.repos.adapter.removeRawValue(AUTH_SESSION_STORAGE_KEY);
      return null;
    }
    const existingUser = runWithSystemActor(() => this.repos.users.get(raw.userId));
    if (!existingUser) {
      this.repos.adapter.removeRawValue(AUTH_SESSION_STORAGE_KEY);
      return null;
    }
    return raw;
  }

  public getDemoMode(): boolean {
    return this.repos.adapter.getRawValue<boolean>(DEMO_MODE_STORAGE_KEY, false);
  }

  public setDemoMode(enabled: boolean): void {
    this.repos.adapter.setRawValue<boolean>(DEMO_MODE_STORAGE_KEY, enabled, true);
  }

  public getLastScreen(): string | null {
    return this.repos.adapter.getRawValue<string | null>(LAST_SCREEN_STORAGE_KEY, null);
  }

  public setLastScreen(screen: string): void {
    this.repos.adapter.setRawValue<string>(LAST_SCREEN_STORAGE_KEY, screen, false);
  }

  public async loginWithCredentials(
    identifier: string,
    password: string,
    now = Date.now()
  ): Promise<LoginResult> {
    return runWithSystemActorAsync(async () => {
      const cleanId = normalizePhoneOrEmail(identifier);
      const cleanPhone = normalizePhoneDigits(identifier);
      if (!cleanId || !password) {
        return {
          ok: false,
          error: 'أدخل رقم الموبايل أو البريد الإلكتروني وكلمة السر.',
        };
      }

      const allUsers = this.repos.users.list();
      const matchedUser = allUsers.find(
        (u) =>
          normalizePhoneOrEmail(u.email) === cleanId ||
          normalizePhoneOrEmail(u.phone) === cleanId ||
          (cleanPhone.length >= 10 && normalizePhoneDigits(u.phone) === cleanPhone)
      );

      if (!matchedUser) {
        return {
          ok: false,
          error: 'بيانات الدخول غير صحيحة. تأكد من رقم الموبايل أو البريد الإلكتروني وكلمة السر.',
        };
      }

    // Check active lockout window
    if (matchedUser.lockedUntil && now < matchedUser.lockedUntil) {
      const remainingSec = Math.ceil((matchedUser.lockedUntil - now) / 1000);
      const mins = Math.floor(remainingSec / 60);
      const secs = remainingSec % 60;
      const waitText =
        mins > 0
          ? `${mins} دقيقة و${secs} ثانية`
          : `${secs} ثانية`;
      return {
        ok: false,
        lockedUntil: matchedUser.lockedUntil,
        error: `تم قفل الحساب مؤقتاً بعد 5 محاولات دخول خاطئة. حاول مجدداً بعد ${waitText}.`,
      };
    }

    const isPasswordValid = await verifyPasswordWithSalt(
      password,
      matchedUser.salt,
      matchedUser.passwordHash
    );

    if (!isPasswordValid) {
      const baseAttempts =
        matchedUser.lockedUntil && now >= matchedUser.lockedUntil
          ? 0
          : matchedUser.failedAttempts || 0;
      const nextAttempts = baseAttempts + 1;

      if (nextAttempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
        const lockedUntil = now + LOCKOUT_DURATION_MS;
        this.repos.users.update(matchedUser.id, {
          failedAttempts: nextAttempts,
          lockedUntil,
        });
        this.repos.adapter.flush();
        this.repos.activityLog.create({
          centerId: matchedUser.centerId || DEFAULT_CENTER_ID,
          actorId: matchedUser.id,
          actorName: matchedUser.name,
          actorRole: matchedUser.role,
          action: 'auth.lockout',
          resource: 'users',
          resourceId: matchedUser.id,
          summary: `قفل مؤقت للحساب (${matchedUser.email}) لمدة 5 دقائق بعد 5 محاولات فاشلة`,
          timestamp: new Date(now).toISOString(),
        });
        return {
          ok: false,
          lockedUntil,
          remainingAttempts: 0,
          error:
            'تم قفل الحساب لمدة 5 دقائق بعد 5 محاولات دخول خاطئة متتالية لحماية بيانات السنتر.',
        };
      }

      this.repos.users.update(matchedUser.id, {
        failedAttempts: nextAttempts,
        lockedUntil: undefined,
      });
      this.repos.adapter.flush();
      const remaining = MAX_FAILED_LOGIN_ATTEMPTS - nextAttempts;
      return {
        ok: false,
        remainingAttempts: remaining,
        error: `كلمة السر غير صحيحة. متبقي ${remaining} محاولات قبل قفل الحساب مؤقتاً.`,
      };
    }

    // Successful login: reset failedAttempts & persist 12h session
    const updatedUser =
      this.repos.users.update(matchedUser.id, {
        failedAttempts: 0,
        lockedUntil: undefined,
        status: 'active',
      }) || matchedUser;

    const session: AuthSession = {
      userId: updatedUser.id,
      centerId: updatedUser.centerId || DEFAULT_CENTER_ID,
      role: updatedUser.role,
      name: updatedUser.name,
      teacherId: updatedUser.teacherId,
      parentPhone: updatedUser.role === UserRole.PARENT ? updatedUser.phone : undefined,
      issuedAt: now,
      expiresAt: now + SESSION_DURATION_MS,
    };

    this.repos.adapter.setRawValue(AUTH_SESSION_STORAGE_KEY, session, true);
    this.repos.activityLog.create({
      centerId: session.centerId,
      actorId: updatedUser.id,
      actorName: updatedUser.name,
      actorRole: updatedUser.role,
      action: 'auth.login',
      resource: 'authSession',
      resourceId: updatedUser.id,
      summary: `تسجيل دخول ناجح (${updatedUser.name} - ${updatedUser.role})`,
      timestamp: new Date(now).toISOString(),
    });
    this.repos.adapter.flush();

    return { ok: true, session, user: updatedUser };
    });
  }

  public logout(actor?: AuthSession | null): void {
    runWithSystemActor(() => {
      const active = actor || this.getPersistedSession();
      if (active) {
        this.repos.activityLog.create({
          centerId: active.centerId,
          actorId: active.userId,
          actorName: active.name,
          actorRole: active.role,
          action: 'auth.logout',
          resource: 'authSession',
          resourceId: active.userId,
          summary: `تسجيل خروج المستخدم ${active.name}`,
          timestamp: new Date().toISOString(),
        });
      }
      this.repos.adapter.removeRawValue(AUTH_SESSION_STORAGE_KEY);
      this.repos.adapter.flush();
    });
  }

  public async resetPasswordByEmail(email: string, newPassword: string): Promise<{ ok: boolean; error?: string }> {
    return runWithSystemActorAsync(async () => {
      const clean = normalizePhoneOrEmail(email);
      const user = this.repos.users
        .list()
        .find((u) => normalizePhoneOrEmail(u.email) === clean);
      if (!user) {
        return { ok: false, error: 'لا يوجد حساب مسجل بهذا البريد الإلكتروني.' };
      }
      const cred = await createPasswordCredential(newPassword);
      this.repos.users.update(user.id, {
        salt: cred.salt,
        passwordHash: cred.passwordHash,
        failedAttempts: 0,
        lockedUntil: undefined,
      });
      this.repos.activityLog.create({
        centerId: user.centerId || DEFAULT_CENTER_ID,
        actorId: user.id,
        actorName: user.name,
        actorRole: user.role,
        action: 'auth.password_reset',
        resource: 'users',
        resourceId: user.id,
        summary: `إعادة تعيين كلمة السر للحساب ${user.email}`,
        timestamp: new Date().toISOString(),
      });
      this.repos.adapter.flush();
      return { ok: true };
    });
  }

  public async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
    displayName?: string
  ): Promise<{ ok: boolean; error?: string; user?: SystemUser }> {
    return runWithSystemActorAsync(async () => {
      const user = this.repos.users.get(userId);
      if (!user) return { ok: false, error: 'المستخدم غير موجود.' };

      if (oldPassword || newPassword) {
        const validOld = await verifyPasswordWithSalt(oldPassword, user.salt, user.passwordHash);
        if (!validOld) {
          return { ok: false, error: 'كلمة السر الحالية غير صحيحة.' };
        }
        if (newPassword.length < 6) {
          return { ok: false, error: 'كلمة السر الجديدة يجب ألا تقل عن 6 أحرف.' };
        }
      }

      const patch: Partial<SystemUser> = {};
      if (displayName && displayName.trim()) {
        patch.name = displayName.trim();
      }
      if (newPassword) {
        const cred = await createPasswordCredential(newPassword);
        patch.salt = cred.salt;
        patch.passwordHash = cred.passwordHash;
      }

      const updated = this.repos.users.update(userId, patch);
      if (updated && patch.name) {
        const currentSession = this.getPersistedSession();
        if (currentSession && currentSession.userId === userId) {
          this.repos.adapter.setRawValue(
            AUTH_SESSION_STORAGE_KEY,
            { ...currentSession, name: updated.name },
            true
          );
        }
      }
      this.repos.adapter.flush();
      return { ok: true, user: updated };
    });
  }

  public async activateParentByPhone(
    phone: string,
    newPassword: string
  ): Promise<LoginResult> {
    return runWithSystemActorAsync(async () => {
      const cleanPhone = normalizePhoneDigits(phone);
      if (!/^01[0125]\d{8}$/.test(cleanPhone)) {
        return { ok: false, error: 'أدخل رقم موبايل مصري صحيح مسجل لولي الأمر.' };
      }
      if (!newPassword || newPassword.length < 6) {
        return { ok: false, error: 'كلمة السر يجب ألا تقل عن 6 أحرف أو أرقام.' };
      }

      const matchedStudent = this.repos.students
        .list()
        .find(
          (st) =>
            normalizePhoneDigits(st.parentPhone) === cleanPhone ||
            normalizePhoneDigits(st.parent?.phone) === cleanPhone
        );
      if (!matchedStudent) {
        return {
          ok: false,
          error: 'رقم الموبايل غير مسجل كولي أمر لأي طالب حالياً في السنتر.',
        };
      }

      const cred = await createPasswordCredential(newPassword);
      const existingParentUser = this.repos.users
        .list()
        .find(
          (u) => u.role === UserRole.PARENT && normalizePhoneDigits(u.phone) === cleanPhone
        );

      const parentUser = existingParentUser
        ? this.repos.users.update(existingParentUser.id, {
            passwordHash: cred.passwordHash,
            salt: cred.salt,
            failedAttempts: 0,
            lockedUntil: undefined,
            status: 'active',
          }) || existingParentUser
        : this.repos.users.create({
            centerId: matchedStudent.centerId || DEFAULT_CENTER_ID,
            name: `${matchedStudent.parentName} (ولي أمر)`,
            email: `parent.${cleanPhone}@eduflow.local`,
            phone: cleanPhone,
            role: UserRole.PARENT,
            status: 'active',
            passwordHash: cred.passwordHash,
            salt: cred.salt,
            failedAttempts: 0,
          });

      const now = Date.now();
      const session: AuthSession = {
        userId: parentUser.id,
        centerId: parentUser.centerId || DEFAULT_CENTER_ID,
        role: UserRole.PARENT,
        name: parentUser.name,
        parentPhone: cleanPhone,
        issuedAt: now,
        expiresAt: now + SESSION_DURATION_MS,
      };

      this.repos.adapter.setRawValue(AUTH_SESSION_STORAGE_KEY, session, true);
      this.repos.activityLog.create({
        centerId: session.centerId,
        actorId: parentUser.id,
        actorName: parentUser.name,
        actorRole: UserRole.PARENT,
        action: 'auth.parent_activate',
        resource: 'authSession',
        resourceId: parentUser.id,
        summary: `تفعيل دخول ولي الأمر برقم ${cleanPhone}`,
        timestamp: new Date(now).toISOString(),
      });
      this.repos.adapter.flush();
      return { ok: true, session, user: parentUser };
    });
  }

  public async registerCenterOwner(payload: {
    ownerName: string;
    ownerPhone: string;
    ownerEmail: string;
    password: string;
    centerName: string;
    governorate: string;
    city: string;
    centerPhone: string;
    stages: string[];
    rooms: { name: string; capacity: number }[];
    firstTeacher?: { name: string; subject: string; phone: string };
  }): Promise<AuthSession> {
    return runWithSystemActorAsync(async () => {
    const centerId = DEFAULT_CENTER_ID;
    const existingCenters = this.repos.centers.list();
    if (existingCenters.length > 0) {
      this.repos.centers.update(existingCenters[0].id, {
        name: payload.centerName,
        governorate: payload.governorate,
        city: payload.city,
        phone: payload.centerPhone,
        stages: payload.stages,
      });
    } else {
      const createdCenter: Omit<Center, 'id'> = {
        centerId,
        name: payload.centerName,
        governorate: payload.governorate,
        city: payload.city,
        address: `${payload.city}، ${payload.governorate}`,
        phone: payload.centerPhone,
        stages: payload.stages,
        currentPlanId: 'pro',
        createdAt: new Date().toISOString(),
      };
      this.repos.centers.create(createdCenter);
    }

    const prevSettings = this.repos.meta.getCenterSettings();
    this.repos.meta.setCenterSettings({
      ...prevSettings,
      name: payload.centerName,
      governorate: payload.governorate,
      city: payload.city,
      phone: payload.centerPhone,
      stages: payload.stages,
    });

    payload.rooms.forEach((rm) => {
      const alreadyExists = this.repos.rooms.list().some((r) => r.name === rm.name);
      if (!alreadyExists) {
        const roomData: Omit<Room, 'id'> = {
          centerId,
          name: rm.name,
          capacity: rm.capacity,
        };
        this.repos.rooms.create(roomData);
      }
    });

    if (payload.firstTeacher && payload.firstTeacher.name.trim()) {
      const teacherData: Omit<Teacher, 'id'> = {
        centerId,
        name: payload.firstTeacher.name.trim(),
        phone: payload.firstTeacher.phone.trim() || '01000000000',
        subjects: [payload.firstTeacher.subject.trim() || 'فيزياء'],
        compensation: { type: 'percent', centerPercent: 30 },
        compensationType: 'percentage',
        compensationValue: 70,
        hasLoginAccess: true,
        color: '#0F766E',
      };
      this.repos.teachers.create(teacherData);
    }

    const cred = await createPasswordCredential(payload.password);
    const cleanEmail = normalizePhoneOrEmail(payload.ownerEmail);
    const existingOwner = this.repos.users
      .list()
      .find(
        (u) =>
          normalizePhoneOrEmail(u.email) === cleanEmail || u.role === UserRole.OWNER
      );

    let ownerUser: SystemUser;
    if (existingOwner) {
      ownerUser =
        this.repos.users.update(existingOwner.id, {
          name: payload.ownerName.trim(),
          phone: payload.ownerPhone.trim(),
          email: payload.ownerEmail.trim(),
          salt: cred.salt,
          passwordHash: cred.passwordHash,
          failedAttempts: 0,
          lockedUntil: undefined,
          status: 'active',
        }) || existingOwner;
    } else {
      ownerUser = this.repos.users.create({
        centerId,
        name: payload.ownerName.trim(),
        phone: payload.ownerPhone.trim(),
        email: payload.ownerEmail.trim(),
        role: UserRole.OWNER,
        status: 'active',
        salt: cred.salt,
        passwordHash: cred.passwordHash,
        failedAttempts: 0,
      });
    }

    const now = Date.now();
    const session: AuthSession = {
      userId: ownerUser.id,
      centerId,
      role: UserRole.OWNER,
      name: ownerUser.name,
      issuedAt: now,
      expiresAt: now + SESSION_DURATION_MS,
    };
    this.repos.adapter.setRawValue(AUTH_SESSION_STORAGE_KEY, session, true);
    this.repos.activityLog.create({
      centerId,
      actorId: ownerUser.id,
      actorName: ownerUser.name,
      actorRole: ownerUser.role,
      action: 'center.onboarding',
      resource: 'centers',
      resourceId: centerId,
      summary: `إعداد سنتر "${payload.centerName}" وتسجيل المالك ${ownerUser.name}`,
      timestamp: new Date(now).toISOString(),
    });
    this.repos.adapter.flush();
    return session;
    });
  }
}

export const authService = new AuthService(defaultRepositories);
