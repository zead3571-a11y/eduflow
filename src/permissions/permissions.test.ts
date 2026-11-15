import test from 'node:test';
import assert from 'node:assert/strict';
import { LocalStorageAdapter, StorageLike } from '../data/localStorageAdapter';
import { createRepositories } from '../data/repositories';
import {
  can,
  canAccessScreen,
  getDefaultHomeScreen,
  normalizePhoneDigits,
  PermissionActor,
  PermissionError,
} from './permissions';
import { ScreenId, UserRole } from '../types/eduflow';

class MockStorage implements StorageLike {
  private map = new Map<string, string>();
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

const ownerActor: PermissionActor = {
  userId: 'u1',
  role: UserRole.OWNER,
  centerId: 'center-1',
};

const adminActor: PermissionActor = {
  userId: 'u2',
  role: UserRole.ADMIN,
  centerId: 'center-1',
};

const accountantActor: PermissionActor = {
  userId: 'u3',
  role: UserRole.ACCOUNTANT,
  centerId: 'center-1',
};

const receptionistActor: PermissionActor = {
  userId: 'u4',
  role: UserRole.RECEPTIONIST,
  centerId: 'center-1',
};

const teacherActor: PermissionActor = {
  userId: 'u5',
  role: UserRole.TEACHER,
  centerId: 'center-1',
  teacherId: 't1',
};

const parentActor: PermissionActor = {
  userId: 'u6',
  role: UserRole.PARENT,
  centerId: 'center-1',
  parentPhone: '01002349871',
};

test('Permission matrix: Owner & Admin boundaries', () => {
  // Owner has full access
  assert.equal(can(ownerActor, 'change_plan', 'subscription'), true);
  assert.equal(can(ownerActor, 'delete_center', 'centers'), true);
  assert.equal(can(ownerActor, 'enable_biometrics', 'biometrics'), true);
  assert.equal(can(ownerActor, 'manage_owners', 'users'), true);

  // Admin: full operational control EXCEPT plan change, delete center, enable biometrics, managing owners
  assert.equal(can(adminActor, 'create', 'students'), true);
  assert.equal(can(adminActor, 'settle', 'settlements'), true);
  assert.equal(can(adminActor, 'update', 'settings'), true);
  assert.equal(can(adminActor, 'view', 'subscription'), true);

  assert.equal(can(adminActor, 'change_plan', 'subscription'), false);
  assert.equal(can(adminActor, 'delete_center', 'centers'), false);
  assert.equal(can(adminActor, 'enable_biometrics', 'biometrics'), false);
  assert.equal(can(adminActor, 'manage_owners', 'users'), false);
  assert.equal(
    can(adminActor, 'update', 'users', { targetUserRole: UserRole.OWNER }),
    false
  );
  assert.equal(
    can(adminActor, 'update', 'users', { targetUserRole: UserRole.RECEPTIONIST }),
    true
  );
});

test('Permission matrix: Accountant, Receptionist, Teacher, and Parent', () => {
  // Accountant: finance + exports; view-only on students/teachers/groups; templates & account only in settings
  assert.equal(can(accountantActor, 'create', 'invoices'), true);
  assert.equal(can(accountantActor, 'create', 'expenses'), true);
  assert.equal(can(accountantActor, 'settle', 'settlements'), true);
  assert.equal(can(accountantActor, 'export', 'financialReports'), true);
  assert.equal(can(accountantActor, 'view', 'students'), true);
  assert.equal(can(accountantActor, 'create', 'students'), false);
  assert.equal(can(accountantActor, 'update', 'students'), false);
  assert.equal(can(accountantActor, 'take_attendance', 'sessions'), false);
  assert.equal(can(accountantActor, 'update', 'messageTemplates'), true);
  assert.equal(can(accountantActor, 'update', 'settings'), false);
  assert.equal(can(accountantActor, 'view', 'settings', { settingTab: 'templates' }), true);
  assert.equal(can(accountantActor, 'view', 'settings', { settingTab: 'center' }), false);

  // Receptionist: students, attendance, create payments, print receipts, WhatsApp; blocked from editing/deleting payments, expenses, discounts, reports
  assert.equal(can(receptionistActor, 'create', 'students'), true);
  assert.equal(can(receptionistActor, 'take_attendance', 'sessions'), true);
  assert.equal(can(receptionistActor, 'create', 'payments'), true);
  assert.equal(can(receptionistActor, 'print', 'payments'), true);
  assert.equal(can(receptionistActor, 'send_whatsapp', 'messages'), true);
  assert.equal(can(receptionistActor, 'update', 'payments'), false);
  assert.equal(can(receptionistActor, 'delete', 'payments'), false);
  assert.equal(can(receptionistActor, 'view', 'expenses'), false);
  assert.equal(can(receptionistActor, 'create', 'expenses'), false);
  assert.equal(can(receptionistActor, 'create', 'discounts'), false);
  assert.equal(can(receptionistActor, 'view', 'financialReports'), false);
  assert.equal(can(receptionistActor, 'view', 'settlements'), false);

  // Teacher: scoped to own teacherId / groups
  const sampleGroups = [
    { id: 'g1', teacherId: 't1' },
    { id: 'g2', teacherId: 't2' },
  ];
  assert.equal(
    can(teacherActor, 'take_attendance', 'sessions', { groupId: 'g1', groups: sampleGroups }),
    true
  );
  assert.equal(
    can(teacherActor, 'take_attendance', 'sessions', { groupId: 'g2', groups: sampleGroups }),
    false
  );
  assert.equal(
    can(teacherActor, 'enter_assessments', 'assessments', { groupId: 'g1', groups: sampleGroups }),
    true
  );
  assert.equal(
    can(teacherActor, 'enter_assessments', 'assessments', { groupId: 'g2', groups: sampleGroups }),
    false
  );
  assert.equal(can(teacherActor, 'view', 'teacherShares', { teacherId: 't1' }), true);
  assert.equal(can(teacherActor, 'view', 'teacherShares', { teacherId: 't2' }), false);
  assert.equal(can(teacherActor, 'view', 'expenses'), false);
  assert.equal(can(teacherActor, 'view', 'invoices'), false);

  // Parent: parentPortal only + own children phone normalization
  assert.equal(normalizePhoneDigits('+20 100-234-9871'), '01002349871');
  assert.equal(can(parentActor, 'view', 'parentPortal'), true);
  assert.equal(
    can(parentActor, 'view', 'students', { parentPhone: '01002349871' }),
    true
  );
  assert.equal(
    can(parentActor, 'view', 'students', { parentPhone: '01119998887' }),
    false
  );
  assert.equal(can(parentActor, 'create', 'students'), false);
  assert.equal(can(parentActor, 'view', 'expenses'), false);
});

test('Screen guards & default home screen by role', () => {
  assert.equal(getDefaultHomeScreen(ownerActor), ScreenId.DASHBOARD);
  assert.equal(getDefaultHomeScreen(parentActor), ScreenId.PARENT_PORTAL);
  assert.equal(getDefaultHomeScreen(null), ScreenId.LOGIN);

  assert.equal(canAccessScreen(parentActor, ScreenId.DASHBOARD), false);
  assert.equal(canAccessScreen(parentActor, ScreenId.STUDENTS), false);
  assert.equal(canAccessScreen(parentActor, ScreenId.PARENT_PORTAL), true);

  assert.equal(canAccessScreen(receptionistActor, ScreenId.PAYMENTS), true);
  assert.equal(canAccessScreen(receptionistActor, ScreenId.EXPENSES), false);
  assert.equal(canAccessScreen(receptionistActor, ScreenId.REPORTS), false);
  assert.equal(canAccessScreen(receptionistActor, ScreenId.SETTINGS), false);

  assert.equal(canAccessScreen(accountantActor, ScreenId.SETTINGS), true);
  assert.equal(canAccessScreen(accountantActor, ScreenId.TAKE_ATTENDANCE), false);
  assert.equal(canAccessScreen(accountantActor, ScreenId.SUBSCRIPTION), false);

  assert.equal(canAccessScreen(teacherActor, ScreenId.TEACHERS), false);
  assert.equal(canAccessScreen(teacherActor, ScreenId.TEACHER_PROFILE), true);
  assert.equal(canAccessScreen(teacherActor, ScreenId.PAYMENTS), false);
  assert.equal(canAccessScreen(teacherActor, ScreenId.REPORTS), false);
});

test('Repository-level enforcement throws PermissionError on unauthorized writes across roles', () => {
  const storage = new MockStorage();
  const adapter = new LocalStorageAdapter({ storage, debounceMs: 0 });

  let activeActor: PermissionActor | null = ownerActor;
  const repos = createRepositories(adapter, {
    getActor: () => activeActor,
    enforcePermissions: true,
  });

  // 1) Receptionist can create student & payment, CANNOT create expense or update/delete payment
  activeActor = receptionistActor;
  const createdPay = repos.payments.create({
    centerId: 'center-1',
    receiptNumber: 'RCP-TEST-1',
    invoiceId: 'inv1',
    studentId: 's1',
    groupId: 'g1',
    amount: 100,
    remainingAfter: 380,
    method: 'نقدي',
    date: '2026-11-12',
    recordedBy: 'استقبال',
  });
  assert.equal(createdPay.receiptNumber, 'RCP-TEST-1');

  assert.throws(
    () => repos.payments.update(createdPay.id, { amount: 200 }),
    PermissionError
  );
  assert.throws(() => repos.payments.remove(createdPay.id), PermissionError);
  assert.throws(
    () =>
      repos.expenses.create({
        centerId: 'center-1',
        date: '2026-11-12',
        category: 'أخرى',
        description: 'محاولة غير مصرح بها',
        amount: 50,
        addedBy: 'u4',
      }),
    PermissionError
  );
  assert.throws(
    () =>
      repos.discounts.create({
        centerId: 'center-1',
        studentId: 's1',
        title: 'خصم غير مصرح',
        type: 'fixed',
        value: 50,
        amount: 50,
        createdBy: 'u4',
        createdAt: new Date().toISOString(),
      }),
    PermissionError
  );

  // 2) Accountant CANNOT create or update students, CANNOT update general settings
  activeActor = accountantActor;
  assert.throws(
    () =>
      repos.students.create({
        centerId: 'center-1',
        code: '',
        fullName: 'طالب غير مصرح',
        name: 'طالب غير مصرح',
        stage: 'الصف الثالث الثانوي',
        parent: { name: 'ولي أمر', phone: '01000000001' },
        parentName: 'ولي أمر',
        parentPhone: '01000000001',
        groupIds: ['g1'],
        status: 'active',
        paymentStatus: 'pending',
        lastAttendance: 'لم يحضر بعد',
        attendanceRate: 100,
        notes: [],
        createdAt: new Date().toISOString(),
      }),
    PermissionError
  );
  assert.throws(() => repos.students.update('s1', { status: 'inactive' }), PermissionError);
  assert.throws(
    () =>
      repos.meta.setCenterSettings({
        ...repos.meta.getCenterSettings(),
        name: 'تعديل غير مصرح',
      }),
    PermissionError
  );
  // Accountant CAN create expenses & update message templates
  const accExp = repos.expenses.create({
    centerId: 'center-1',
    date: '2026-11-12',
    category: 'مستلزمات',
    description: 'أقلام سبورة',
    amount: 120,
    addedBy: 'u3',
  });
  assert.equal(accExp.amount, 120);

  // 3) Admin CANNOT change subscription plan or edit Owner user
  activeActor = adminActor;
  assert.throws(
    () =>
      repos.meta.setCenterSettings({
        ...repos.meta.getCenterSettings(),
        currentPlanId: 'enterprise',
      }),
    PermissionError
  );
  assert.throws(() => repos.users.update('u1', { name: 'تعديل المالك' }), PermissionError);
  assert.throws(() => repos.users.update('u4', { role: UserRole.OWNER }), PermissionError);

  // 4) Teacher CANNOT create assessment for another teacher's group
  activeActor = teacherActor;
  const foreignGroup = repos.groups.list(); // scoped to t1 only!
  assert.ok(foreignGroup.every((g) => g.teacherId === 't1'));

  activeActor = ownerActor;
  const t2Group = repos.groups.list().find((g) => g.teacherId !== 't1');
  assert.ok(t2Group, 'Seed should include at least one group owned by another teacher');

  activeActor = teacherActor;
  assert.throws(
    () =>
      repos.assessments.create({
        centerId: 'center-1',
        title: 'اختبار غير مصرح',
        type: 'كويز',
        groupId: t2Group.id,
        date: '2026-11-12',
        maxScore: 50,
        status: 'draft',
        grades: [],
      }),
    PermissionError
  );

  // 5) Parent CANNOT write anything
  activeActor = parentActor;
  assert.throws(
    () => repos.students.update('s1', { fullName: 'تعديل ولي الأمر' }),
    PermissionError
  );
});

test('Repository-level read scoping isolates Teacher and Parent data cleanly', () => {
  const storage = new MockStorage();
  const adapter = new LocalStorageAdapter({ storage, debounceMs: 0 });

  let activeActor: PermissionActor | null = teacherActor;
  const repos = createRepositories(adapter, {
    getActor: () => activeActor,
    enforcePermissions: true,
  });

  // Teacher t1 sees ONLY own groups, own students, own teacher record, NO invoices/expenses
  const teacherGroups = repos.groups.list();
  assert.ok(teacherGroups.length > 0);
  assert.ok(teacherGroups.every((g) => g.teacherId === 't1'));

  const teacherGroupIdSet = new Set(teacherGroups.map((g) => g.id));
  const teacherStudents = repos.students.list();
  assert.ok(teacherStudents.length > 0);
  assert.ok(
    teacherStudents.every((s) => s.groupIds.some((gid) => teacherGroupIdSet.has(gid)))
  );

  assert.equal(repos.invoices.list().length, 0);
  assert.equal(repos.payments.list().length, 0);
  assert.equal(repos.expenses.list().length, 0);
  assert.equal(repos.teachers.list().length, 1);
  assert.equal(repos.teachers.get('t2'), undefined);

  // Parent sees ONLY children sharing parentPhone 01002349871 (s1 & s9)
  activeActor = parentActor;
  const parentStudents = repos.students.list();
  assert.equal(parentStudents.length, 2);
  assert.ok(parentStudents.every((s) => s.id === 's1' || s.id === 's9'));
  assert.equal(repos.students.get('s2'), undefined);
  assert.ok(repos.invoices.list().every((inv) => inv.studentId === 's1' || inv.studentId === 's9'));
  assert.ok(repos.payments.list().every((p) => p.studentId === 's1' || p.studentId === 's9'));
  assert.equal(repos.expenses.list().length, 0);
  assert.equal(repos.teachers.list().length, 0);
});
