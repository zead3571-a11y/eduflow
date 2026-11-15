import test from 'node:test';
import assert from 'node:assert/strict';
import { LocalStorageAdapter, StorageLike } from '../../data/localStorageAdapter';
import { createRepositories } from '../../data/repositories';
import {
  DEFAULT_CENTER_ID,
  isPlanFeatureEnabled,
  isStudentPortalEnabled,
} from '../../data/seedData';
import {
  PermissionActor,
  PermissionError,
  assertCan,
  canAccessScreen,
} from '../../permissions/permissions';
import { ScreenId, UserRole } from '../../types/eduflow';
import {
  STUDENT_LOCKOUT_DURATION_MS,
  StudentAuthService,
  generateStudentAccessCode,
  normalizeAccessCode,
} from './studentAuthService';

class MockStorage implements StorageLike {
  public map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}

function setupTestEnv() {
  const storage = new MockStorage();
  const adapter = new LocalStorageAdapter({ storage, debounceMs: 0 });
  let activeActor: PermissionActor | null = {
    userId: 'u1',
    role: UserRole.OWNER,
    centerId: DEFAULT_CENTER_ID,
  };
  const repos = createRepositories(adapter, {
    getActor: () => activeActor,
    enforcePermissions: true,
  });
  const service = new StudentAuthService(repos);
  return {
    storage,
    adapter,
    repos,
    service,
    getActor: () => activeActor,
    setActor: (actor: PermissionActor | null) => {
      activeActor = actor;
    },
  };
}

test('generateStudentAccessCode uses unambiguous 8-char alphabet formatted XXXX-XXXX', () => {
  for (let i = 0; i < 60; i += 1) {
    const code = generateStudentAccessCode();
    assert.match(code, /^[A-HJ-KM-NP-Z2-9]{4}-[A-HJ-KM-NP-Z2-9]{4}$/);
    assert.equal(/[0O1Il]/.test(code), false);
    assert.equal(normalizeAccessCode(code).length, 8);
  }
});

test('createOrRegenerateAccessCode stores only salted SHA-256 hash and logs action', async () => {
  const { storage, repos, service, getActor } = setupTestEnv();
  const { account, plainCode } = await service.createOrRegenerateAccessCode('s1', getActor());

  assert.equal(account.studentId, 's1');
  assert.equal(account.status, 'active');
  assert.equal(account.hasPinSet, false);
  assert.ok(account.accessCodeHash.length >= 64);
  assert.ok(account.accessCodeSalt.length >= 16);

  const normalized = normalizeAccessCode(plainCode);
  for (const [, val] of storage.map.entries()) {
    assert.equal(val.includes(plainCode), false, 'Plain code must never be stored');
    assert.equal(val.includes(normalized), false, 'Normalized plain code must never be stored');
  }

  const logs = repos.activityLog.list();
  assert.ok(logs.some((l) => l.action === 'studentPortal.code_generated' && l.resourceId === account.id));
});

test('First login triggers PIN setup, then code + PIN succeeds and persists 7-day session', async () => {
  const { service, getActor } = setupTestEnv();
  const { plainCode } = await service.createOrRegenerateAccessCode('s1', getActor());
  const now = 1_700_000_000_000;

  const firstAttempt = await service.loginWithCode({
    accessCode: plainCode,
    deviceId: 'dev-phone-1',
    deviceLabel: 'موبايل (Chrome)',
    now,
  });
  assert.equal(firstAttempt.ok, false);
  assert.equal(firstAttempt.requiresPinSetup, true);

  const setupRes = await service.completeFirstLoginPinSetup({
    accessCode: plainCode,
    newPin: '4829',
    deviceId: 'dev-phone-1',
    deviceLabel: 'موبايل (Chrome)',
    now,
  });
  assert.equal(setupRes.ok, true);
  assert.ok(setupRes.session);
  assert.equal(setupRes.session.studentId, 's1');
  assert.equal(setupRes.session.expiresAt - now, 7 * 24 * 60 * 60 * 1000);

  // Persisted session valid inside 7 days, invalid after 7 days
  assert.ok(service.getPersistedStudentSession(now + 6 * 24 * 60 * 60 * 1000));
  assert.equal(service.getPersistedStudentSession(now + 7 * 24 * 60 * 60 * 1000 + 1), null);

  // Re-login with valid code + PIN works (even with lowercase / no dash)
  const reLogin = await service.loginWithCode({
    accessCode: normalizeAccessCode(plainCode).toLowerCase(),
    pin: '4829',
    deviceId: 'dev-phone-1',
    now: now + 1000,
  });
  assert.equal(reLogin.ok, true);

  // Wrong PIN and bogus code produce identical non-enumerating Arabic error
  const wrongPinRes = await service.loginWithCode({
    accessCode: plainCode,
    pin: '0000',
    deviceId: 'dev-other-1',
    now: now + 2000,
  });
  const bogusCodeRes = await service.loginWithCode({
    accessCode: 'ZZZZ-2222',
    pin: '0000',
    deviceId: 'dev-other-2',
    now: now + 2000,
  });
  assert.equal(wrongPinRes.ok, false);
  assert.equal(bogusCodeRes.ok, false);
  assert.equal(wrongPinRes.error, bogusCodeRes.error);
});

test('5 failed attempts enforce 10-minute lockout per account and per device', async () => {
  const { service, getActor } = setupTestEnv();
  const { plainCode } = await service.createOrRegenerateAccessCode('s1', getActor());
  const baseNow = 1_700_000_000_000;

  await service.completeFirstLoginPinSetup({
    accessCode: plainCode,
    newPin: '1234',
    deviceId: 'dev-init',
    now: baseNow,
  });

  // 1) Per-account lockout across 5 different devices
  for (let i = 1; i <= 5; i += 1) {
    const res = await service.loginWithCode({
      accessCode: plainCode,
      pin: '9999',
      deviceId: `dev-attacker-${i}`,
      now: baseNow + i * 1000,
    });
    assert.equal(res.ok, false);
    if (i === 5) {
      assert.ok(res.lockedUntil);
      assert.equal(res.lockedUntil, baseNow + 5000 + STUDENT_LOCKOUT_DURATION_MS);
    }
  }

  // Even correct PIN from a fresh device is blocked during 10-minute account lockout
  const blockedDuringLockout = await service.loginWithCode({
    accessCode: plainCode,
    pin: '1234',
    deviceId: 'dev-clean',
    now: baseNow + 60_000,
  });
  assert.equal(blockedDuringLockout.ok, false);
  assert.ok(blockedDuringLockout.lockedUntil);

  // After 10 minutes lockout lifts
  const unlockedRes = await service.loginWithCode({
    accessCode: plainCode,
    pin: '1234',
    deviceId: 'dev-clean',
    now: baseNow + 5000 + STUDENT_LOCKOUT_DURATION_MS + 100,
  });
  assert.equal(unlockedRes.ok, true);

  // 2) Per-device lockout on bogus codes blocks even valid code on that device
  const devBase = baseNow + 2_000_000;
  for (let i = 1; i <= 5; i += 1) {
    await service.loginWithCode({
      accessCode: `ABCD-234${i}`,
      pin: '0000',
      deviceId: 'dev-locked-browser',
      now: devBase + i * 100,
    });
  }
  const blockedByDevice = await service.loginWithCode({
    accessCode: plainCode,
    pin: '1234',
    deviceId: 'dev-locked-browser',
    now: devBase + 5000,
  });
  assert.equal(blockedByDevice.ok, false);
  assert.ok(blockedByDevice.lockedUntil);
});

test('Regenerating code invalidates old code and active sessions; device limit of 2 supports evicting oldest', async () => {
  const { service, getActor } = setupTestEnv();
  const { plainCode: code1 } = await service.createOrRegenerateAccessCode('s1', getActor());
  const t0 = 1_700_000_000_000;

  await service.completeFirstLoginPinSetup({
    accessCode: code1,
    newPin: '5555',
    deviceId: 'dev-1',
    deviceLabel: 'هاتف 1',
    now: t0,
  });
  const dev2 = await service.loginWithCode({
    accessCode: code1,
    pin: '5555',
    deviceId: 'dev-2',
    deviceLabel: 'لابتوب 2',
    now: t0 + 1000,
  });
  assert.equal(dev2.ok, true);

  // 3rd device hits limit of 2
  const dev3 = await service.loginWithCode({
    accessCode: code1,
    pin: '5555',
    deviceId: 'dev-3',
    deviceLabel: 'تابلت 3',
    now: t0 + 2000,
  });
  assert.equal(dev3.ok, false);
  assert.equal(dev3.requiresDeviceEviction, true);
  assert.equal(dev3.activeSessions?.length, 2);

  // Evict oldest (dev-1) and sign in on dev-3
  const dev3Confirmed = await service.loginWithCode({
    accessCode: code1,
    pin: '5555',
    deviceId: 'dev-3',
    deviceLabel: 'تابلت 3',
    kickOldestDevice: true,
    now: t0 + 3000,
  });
  assert.equal(dev3Confirmed.ok, true);
  const activeNow = service.getActiveSessionsForStudent('s1', t0 + 4000);
  assert.equal(activeNow.length, 2);
  assert.deepEqual(
    activeNow.map((s) => s.deviceId).sort(),
    ['dev-2', 'dev-3']
  );

  // Regenerate code -> invalidates code1 and clears all active sessions
  const { plainCode: code2 } = await service.createOrRegenerateAccessCode('s1', getActor(), {
    isRegenerate: true,
  });
  assert.notEqual(code1, code2);
  assert.equal(service.getActiveSessionsForStudent('s1', t0 + 5000).length, 0);
  assert.equal(service.getPersistedStudentSession(t0 + 5000), null);

  const oldCodeLogin = await service.loginWithCode({
    accessCode: code1,
    pin: '5555',
    deviceId: 'dev-fresh',
    now: t0 + 6000,
  });
  assert.equal(oldCodeLogin.ok, false);
});

test('Strict UserRole.STUDENT permissions isolate data and block staff screens/mutations', () => {
  const { repos, setActor } = setupTestEnv();
  const studentActor: PermissionActor = {
    userId: 's1',
    role: UserRole.STUDENT,
    centerId: DEFAULT_CENTER_ID,
    studentId: 's1',
  };
  setActor(studentActor);

  // Screen isolation
  assert.equal(canAccessScreen(studentActor, ScreenId.STUDENT_PORTAL), true);
  assert.equal(canAccessScreen(studentActor, ScreenId.DASHBOARD), false);
  assert.equal(canAccessScreen(studentActor, ScreenId.STUDENTS), false);
  assert.equal(canAccessScreen(studentActor, ScreenId.PAYMENTS), false);
  assert.equal(canAccessScreen(studentActor, ScreenId.SETTINGS), false);

  // Scoped repository reads
  const visibleStudents = repos.students.list();
  assert.equal(visibleStudents.length, 1);
  assert.equal(visibleStudents[0].id, 's1');

  const visibleAssessments = repos.assessments.list();
  visibleAssessments.forEach((a) => {
    assert.ok(a.grades.every((g) => g.studentId === 's1'));
  });

  // Blocked staff resources: filtered list returns empty and assertCan/writes throw PermissionError
  assert.deepEqual(repos.teachers.list(), []);
  assert.deepEqual(repos.payments.list(), []);
  assert.deepEqual(repos.expenses.list(), []);
  assert.deepEqual(repos.users.list(), []);

  assert.throws(() => assertCan(studentActor, 'view', 'teachers'), PermissionError);
  assert.throws(() => assertCan(studentActor, 'view', 'payments'), PermissionError);
  assert.throws(() => assertCan(studentActor, 'view', 'expenses'), PermissionError);
  assert.throws(() => assertCan(studentActor, 'view', 'users'), PermissionError);
  assert.throws(() => repos.students.update('s1', { name: 'اختراق' }), PermissionError);
  assert.throws(
    () =>
      repos.payments.create({
        centerId: DEFAULT_CENTER_ID,
        receiptNumber: 'R-999',
        invoiceId: 'inv1',
        studentId: 's1',
        groupId: 'g1',
        amount: 100,
        method: 'نقدي',
        date: '2026-11-15',
        recordedBy: 's1',
        remainingAfter: 0,
      }),
    PermissionError
  );
});

test('Plan feature flag studentPortal and Settings switch gate student login', async () => {
  const { repos, service, getActor } = setupTestEnv();
  const { plainCode } = await service.createOrRegenerateAccessCode('s1', getActor());

  assert.equal(isPlanFeatureEnabled('basic', 'studentPortal'), false);
  assert.equal(isPlanFeatureEnabled('pro', 'studentPortal'), true);

  // Turn off Settings switch
  const curr = repos.meta.getCenterSettings();
  repos.meta.setCenterSettings({ ...curr, studentPortalEnabled: false });
  assert.equal(isStudentPortalEnabled(repos.meta.getCenterSettings()), false);

  const resWhenOff = await service.loginWithCode({
    accessCode: plainCode,
    deviceId: 'dev-1',
  });
  assert.equal(resWhenOff.ok, false);

  // Enable Settings switch, downgrade plan to 'basic'
  repos.meta.setCenterSettings({ ...curr, studentPortalEnabled: true, currentPlanId: 'basic' });
  assert.equal(isStudentPortalEnabled(repos.meta.getCenterSettings()), false);
  const resBasicPlan = await service.loginWithCode({
    accessCode: plainCode,
    deviceId: 'dev-1',
  });
  assert.equal(resBasicPlan.ok, false);
});
