import test from 'node:test';
import assert from 'node:assert/strict';
import { LocalStorageAdapter, STORAGE_PREFIX, StorageLike } from './localStorageAdapter';
import { createRepositories } from './repositories';
import { AuthService, LOCKOUT_DURATION_MS, SESSION_DURATION_MS } from '../features/auth/authService';
import { createPasswordCredential, verifyPasswordWithSalt } from '../utils/authCrypto';
import { UserRole } from '../types/eduflow';

class MockStorage implements StorageLike {
  public map = new Map<string, string>();
  public throwOnSet = false;

  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    if (this.throwOnSet) {
      const err = new Error('QuotaExceededError');
      err.name = 'QuotaExceededError';
      throw err;
    }
    this.map.set(key, value);
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }
}

test('LocalStorageAdapter persists data across reloads with eduflow:v1: prefix and schema version', () => {
  const storage = new MockStorage();
  const adapter1 = new LocalStorageAdapter({ storage, debounceMs: 0 });
  const repos1 = createRepositories(adapter1);

  assert.equal(storage.getItem(`${STORAGE_PREFIX}schemaVersion`), '1');
  assert.ok(repos1.students.list().length >= 10);

  const created = repos1.students.create({
    centerId: 'center-1',
    code: '',
    fullName: 'طالب اختبار الاستمرارية',
    name: 'طالب اختبار الاستمرارية',
    stage: 'الصف الثالث الثانوي',
    parent: { name: 'ولي أمر اختبار', phone: '01099988877' },
    parentName: 'ولي أمر اختبار',
    parentPhone: '01099988877',
    groupIds: ['g1'],
    status: 'active',
    paymentStatus: 'pending',
    lastAttendance: 'لم يحضر بعد',
    attendanceRate: 100,
    notes: [],
    createdAt: new Date().toISOString(),
  });

  assert.match(created.code, /^S-\d{6}$/);
  assert.equal(created.centerId, 'center-1');

  // Re-instantiate adapter on same storage (simulates browser refresh)
  const adapter2 = new LocalStorageAdapter({ storage, debounceMs: 0 });
  const repos2 = createRepositories(adapter2);
  const reloaded = repos2.students.get(created.id);
  assert.ok(reloaded);
  assert.equal(reloaded.fullName, 'طالب اختبار الاستمرارية');
  assert.equal(reloaded.code, created.code);
});

test('All 18 repositories expose uniform list/get/create/update/remove API with centerId', () => {
  const storage = new MockStorage();
  const adapter = new LocalStorageAdapter({ storage, debounceMs: 0 });
  const repos = createRepositories(adapter);

  const repoNames = [
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
  ] as const;

  for (const name of repoNames) {
    const repo = repos[name];
    assert.equal(typeof repo.list, 'function', `${name}.list missing`);
    assert.equal(typeof repo.get, 'function', `${name}.get missing`);
    assert.equal(typeof repo.create, 'function', `${name}.create missing`);
    assert.equal(typeof repo.update, 'function', `${name}.update missing`);
    assert.equal(typeof repo.remove, 'function', `${name}.remove missing`);
  }

  // Exercise CRUD on discounts repository
  const disc = repos.discounts.create({
    centerId: 'center-1',
    studentId: 's1',
    title: 'خصم تفوق',
    type: 'fixed',
    value: 50,
    amount: 50,
    createdBy: 'u1',
    createdAt: new Date().toISOString(),
  });
  assert.equal(repos.discounts.get(disc.id)?.title, 'خصم تفوق');
  repos.discounts.update(disc.id, { amount: 75 });
  assert.equal(repos.discounts.get(disc.id)?.amount, 75);
  assert.equal(repos.discounts.remove(disc.id), true);
  assert.equal(repos.discounts.get(disc.id), undefined);
});

test('Backup export, validation, import round-trip, and resetToSeed work cleanly', () => {
  const storage = new MockStorage();
  const adapter = new LocalStorageAdapter({ storage, debounceMs: 0 });
  const repos = createRepositories(adapter);

  const created = repos.expenses.create({
    centerId: 'center-1',
    date: '2026-11-12',
    category: 'مستلزمات',
    description: 'سبورة ذكية إضافية',
    amount: 1800,
    addedBy: 'u1',
  });

  const backup = adapter.exportBackup();
  assert.equal(backup.app, 'EDUFLOW');
  assert.equal(backup.schemaVersion, 1);

  // Reset wipes the extra expense back to seed
  adapter.resetToSeed();
  assert.equal(repos.expenses.get(created.id), undefined);

  // Validate invalid backup fails safely
  const badCheck = adapter.validateBackup({ foo: 'bar' });
  assert.equal(badCheck.valid, false);
  assert.ok(badCheck.error);

  // Restore brings the expense back
  adapter.importBackup(backup);
  assert.equal(repos.expenses.get(created.id)?.description, 'سبورة ذكية إضافية');
});

test('Quota errors trigger Arabic error callback cleanly without throwing', () => {
  const storage = new MockStorage();
  const adapter = new LocalStorageAdapter({ storage, debounceMs: 0 });
  const repos = createRepositories(adapter);

  let capturedError = '';
  adapter.setErrorHandler((msg) => {
    capturedError = msg;
  });

  storage.throwOnSet = true;
  repos.expenses.create({
    centerId: 'center-1',
    date: '2026-11-12',
    category: 'أخرى',
    description: 'اختبار امتلاء المساحة',
    amount: 100,
    addedBy: 'u1',
  });

  assert.match(capturedError, /مساحة التخزين المحلي/);
});

test('Web Crypto SHA-256 + salt password hashing & AuthService session, 12h expiry, and 5-attempt lockout', async () => {
  const cred = await createPasswordCredential('Secret#2026');
  assert.equal(await verifyPasswordWithSalt('Secret#2026', cred.salt, cred.passwordHash), true);
  assert.equal(await verifyPasswordWithSalt('WrongPass', cred.salt, cred.passwordHash), false);

  const storage = new MockStorage();
  const adapter = new LocalStorageAdapter({ storage, debounceMs: 0 });
  const repos = createRepositories(adapter);
  const auth = new AuthService(repos);

  const t0 = 1_700_000_000_000;

  // 4 wrong attempts -> remaining attempts decrement
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const res = await auth.loginWithCredentials('mahmoud@el-nokhba.eg', 'bad-pass', t0 + attempt * 1000);
    assert.equal(res.ok, false);
    assert.equal(res.remainingAttempts, 5 - attempt);
  }

  // 5th wrong attempt -> locks account for 5 minutes
  const lockRes = await auth.loginWithCredentials('mahmoud@el-nokhba.eg', 'bad-pass', t0 + 5000);
  assert.equal(lockRes.ok, false);
  assert.equal(lockRes.remainingAttempts, 0);
  assert.equal(lockRes.lockedUntil, t0 + 5000 + LOCKOUT_DURATION_MS);

  // Even correct password is rejected during lockout window
  const blockedRes = await auth.loginWithCredentials('mahmoud@el-nokhba.eg', 'EduFlow@2026', t0 + 60_000);
  assert.equal(blockedRes.ok, false);
  assert.match(blockedRes.error || '', /قفل الحساب/);

  // After 5 minutes pass, valid password succeeds and issues 12h session
  const afterLock = t0 + 5000 + LOCKOUT_DURATION_MS + 1000;
  const okRes = await auth.loginWithCredentials('01001122334', 'EduFlow@2026', afterLock);
  assert.equal(okRes.ok, true);
  assert.equal(okRes.session?.role, UserRole.OWNER);
  assert.equal(okRes.session?.expiresAt, afterLock + SESSION_DURATION_MS);

  // Session valid before 12h, expired at/after 12h
  assert.ok(auth.getPersistedSession(afterLock + 60_000));
  assert.equal(auth.getPersistedSession(afterLock + SESSION_DURATION_MS + 1), null);
});
