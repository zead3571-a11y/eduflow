import test from 'node:test';
import assert from 'node:assert/strict';
import { LocalStorageAdapter, StorageLike } from '../data/localStorageAdapter';
import {
  createRepositories,
  getActivePermissionActor,
  setActivePermissionActor,
} from '../data/repositories';
import { PermissionError } from '../permissions/permissions';
import { UserRole } from '../types/eduflow';
import {
  buildInvoicesCsv,
  buildReportCsv,
  buildStudentsCsv,
  sanitizeCsvCell,
} from './export/excelExport';
import {
  applyDiscountToInvoiceState,
  canDeleteInvoiceBatch,
  previewBulkInvoices,
} from './billing/invoicesAndDiscounts';
import { calculateTeacherSettlement } from './settlements/teacherSettlement';
import {
  buildAbsenceMessage,
  buildLatePaymentMessage,
  buildReceiptMessage,
  buildWhatsAppUrl,
  toWhatsAppPhone,
} from './messaging/whatsappService';
import {
  encodeStudentQrPayload,
  generateQrDataUrl,
  parseStudentQrPayload,
} from './qr/qrService';
import {
  createDeterministicFaceHash,
  verifyFaceAttendanceMatch,
} from './biometrics/faceAttendanceService';

class MemStorage implements StorageLike {
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

test('Phase 3: CSV export neutralizes spreadsheet formula injection and includes UTF-8 BOM', () => {
  assert.equal(sanitizeCsvCell('=SUM(A1:A2)'), "'=SUM(A1:A2)");
  assert.equal(sanitizeCsvCell('+cmd|calc'), "'+cmd|calc");
  assert.equal(sanitizeCsvCell('@evil'), "'@evil");
  assert.equal(sanitizeCsvCell('أحمد, علي'), '"أحمد, علي"');

  const adapter = new LocalStorageAdapter({ storage: new MemStorage(), debounceMs: 0 });
  const repos = createRepositories(adapter);
  const csv = buildStudentsCsv(repos.students.list(), repos.groups.list());
  assert.ok(csv.startsWith('\uFEFF'), 'CSV should start with UTF-8 BOM');
  assert.ok(csv.includes('كود الطالب'));
  assert.ok(csv.includes('S-000'));

  const invCsv = buildInvoicesCsv(
    repos.invoices.list(),
    repos.students.list(),
    repos.groups.list()
  );
  assert.ok(invCsv.includes('رقم الفاتورة'));

  const overdueReport = buildReportCsv('overdue', {
    payments: repos.payments.list(),
    expenses: repos.expenses.list(),
    invoices: repos.invoices.list(),
    groups: repos.groups.list(),
    teachers: repos.teachers.list(),
    sessions: repos.sessions.list(),
    students: repos.students.list(),
  });
  assert.equal(overdueReport.filename, 'eduflow-overdue-report.csv');
  assert.ok(overdueReport.csv.includes('أيام التأخير'));
});

test('Phase 4: Bulk invoice preview applies sibling & scholarship discounts idempotently', () => {
  const adapter = new LocalStorageAdapter({ storage: new MemStorage(), debounceMs: 0 });
  const repos = createRepositories(adapter);
  const students = repos.students.list();
  const groups = repos.groups.list();
  const existingInvoices = repos.invoices.list();
  const settings = repos.meta.getCenterSettings();

  // Give 2nd student the same parent phone as 1st student to test sibling detection,
  // and give 3rd student a 100% standing scholarship.
  const firstPhone = students[0].parentPhone;
  const testStudents = students.map((s, idx) => {
    if (idx === 1) {
      return {
        ...s,
        parentPhone: firstPhone,
        parent: { ...s.parent, phone: firstPhone },
        groupIds: [groups[0].id],
      };
    }
    if (idx === 2) {
      return {
        ...s,
        groupIds: [groups[0].id],
        standingDiscountConfig: {
          type: 'scholarship' as const,
          value: 100,
          reason: 'منحة تفوق 100%',
        },
      };
    }
    return s;
  });

  const preview1 = previewBulkInvoices({
    students: testStudents,
    groups,
    existingInvoices,
    monthInput: '2026-12',
    groupIds: groups.map((g) => g.id),
    dueDay: 1,
    discountPolicy: {
      siblingEnabled: true,
      secondChildPercent: 10,
      thirdPlusChildPercent: 20,
    },
  });

  assert.ok(preview1.itemsToCreate.length > 0);
  const sibItem = preview1.itemsToCreate.find((i) => i.student.id === testStudents[1].id);
  assert.ok(sibItem);
  assert.equal(sibItem.siblingRank, 2);
  assert.ok(sibItem.discountTotal > 0, 'Second sibling should receive discount');

  const freeItem = preview1.itemsToCreate.find((i) => i.student.id === testStudents[2].id);
  assert.ok(freeItem);
  assert.equal(freeItem.netAmount, 0);
  assert.equal(freeItem.isScholarshipFree, true);

  // Batch deletion guard: unpaid batch can be deleted, paid batch cannot
  const batchInvoices = [
    { ...existingInvoices[0], id: 'b-inv-1', batchId: 'batch-1', paid: 0 },
    { ...existingInvoices[0], id: 'b-inv-2', batchId: 'batch-1', paid: 0 },
  ];
  assert.equal(canDeleteInvoiceBatch(batchInvoices, 'batch-1'), true);
  assert.equal(
    canDeleteInvoiceBatch(
      [{ ...batchInvoices[0], paid: 100 }, batchInvoices[1]],
      'batch-1'
    ),
    false
  );

  // Manual discount requires non-empty reason and clamps net >= 0
  const invTarget = existingInvoices[0];
  const badRes = applyDiscountToInvoiceState({
    invoice: invTarget,
    category: 'manual',
    mode: 'fixed',
    value: 50,
    reason: '   ',
  });
  assert.equal(badRes.ok, false);

  const goodRes = applyDiscountToInvoiceState({
    invoice: { ...invTarget, baseAmount: 400, netAmount: 400, total: 400, discountLines: [] },
    category: 'manual',
    mode: 'fixed',
    value: 600,
    reason: 'تسوية إدارية خاصة',
  });
  assert.equal(goodRes.ok, true);
  assert.equal(goodRes.updatedInvoice?.netAmount, 0);
  assert.ok(settings);
});

test('Phase 5: Teacher settlement calculates percent/rent, manual lines, and negative carry-forward', () => {
  const adapter = new LocalStorageAdapter({ storage: new MemStorage(), debounceMs: 0 });
  const repos = createRepositories(adapter);
  const teachers = repos.teachers.list();
  const groups = repos.groups.list();
  const invoices = repos.invoices.list();
  const payments = repos.payments.list();
  const sessions = repos.sessions.list();

  const pctTeacher = teachers.find((t) => t.compensationType === 'percentage')!;
  const calc1 = calculateTeacherSettlement({
    teacher: pctTeacher,
    groups,
    invoices,
    payments,
    sessions,
    settlements: [],
    monthInput: '2026-11',
    basis: 'cash',
    manualLines: [{ id: 'ml-1', type: 'bonus', amount: 200, reason: 'حافز التزام' }],
    applyCarryForward: true,
  });

  assert.equal(calc1.bonusesTotal, 200);
  assert.equal(calc1.netPayable, Math.max(0, calc1.teacherGross + 200));

  // Negative balance carry-forward check
  const calcNegative = calculateTeacherSettlement({
    teacher: pctTeacher,
    groups,
    invoices,
    payments,
    sessions,
    settlements: [],
    monthInput: '2026-11',
    basis: 'cash',
    manualLines: [{ id: 'ml-2', type: 'advance', amount: 999999, reason: 'سلفة كبيرة' }],
    applyCarryForward: true,
  });
  assert.equal(calcNegative.hasNegativeWarning, true);
  assert.equal(calcNegative.netPayable, 0);
  assert.ok(calcNegative.carriedForwardOut > 0);
});

test('Phase 8: WhatsApp formatting normalizes Egyptian phone numbers and builds wa.me URL', () => {
  assert.equal(toWhatsAppPhone('01002349871'), '201002349871');
  assert.equal(toWhatsAppPhone('+201002349871'), '201002349871');

  const url = buildWhatsAppUrl('01002349871', 'مرحباً بكم في سنتر النخبة');
  assert.ok(url.startsWith('https://wa.me/201002349871?text='));

  const adapter = new LocalStorageAdapter({ storage: new MemStorage(), debounceMs: 0 });
  const repos = createRepositories(adapter);
  const student = repos.students.list()[0];
  const group = repos.groups.list()[0];
  const session = repos.sessions.list()[0];
  const invoice = repos.invoices.list()[0];
  const payment = repos.payments.list()[0];

  const absMsg = buildAbsenceMessage('تغيب {اسم_الطالب} عن {المجموعة} بتاريخ {التاريخ}', {
    student,
    group,
    session,
  });
  assert.ok(absMsg.includes(student.name));

  const lateMsg = buildLatePaymentMessage('مستحق {المبلغ} ج للطالب {اسم_الطالب}', {
    student,
    group,
    invoice,
  });
  assert.ok(lateMsg.includes(student.name));

  const recMsg = buildReceiptMessage({
    centerName: 'سنتر النخبة',
    student,
    group,
    payment,
  });
  assert.ok(recMsg.includes(payment.receiptNumber));
});

test('Phase 9: QR encoding/parsing & image data URL generation work deterministically', async () => {
  const adapter = new LocalStorageAdapter({ storage: new MemStorage(), debounceMs: 0 });
  const repos = createRepositories(adapter);
  const students = repos.students.list();
  const target = students[0];

  const payload = encodeStudentQrPayload(target);
  assert.ok(payload.startsWith('EDUFLOW:STUDENT:'));

  const parsedFromPayload = parseStudentQrPayload(payload, students);
  assert.equal(parsedFromPayload?.id, target.id);

  const parsedFromCode = parseStudentQrPayload(target.code, students);
  assert.equal(parsedFromCode?.id, target.id);

  const dataUrl = await generateQrDataUrl(payload);
  assert.ok(dataUrl.startsWith('data:image/png;base64,'));
});

test('Phase 10: Biometric face matching enforces parent consent and owner-only settings toggle', async () => {
  const adapter = new LocalStorageAdapter({ storage: new MemStorage(), debounceMs: 0 });
  setActivePermissionActor({ userId: 'owner-1', role: UserRole.OWNER, centerId: 'center-1' });
  const repos = createRepositories(adapter, {
    getActor: getActivePermissionActor,
    enforcePermissions: true,
  });
  const student = repos.students.list()[0];
  const signature = `face:${student.code}`;
  const hash = await createDeterministicFaceHash(signature);

  // Without consent -> blocked
  const noConsent = verifyFaceAttendanceMatch({
    student,
    consents: [],
    faceTemplates: [
      {
        id: 'ft-1',
        centerId: 'center-1',
        studentId: student.id,
        descriptorHash: hash,
        enrolledAt: new Date().toISOString(),
        enrolledBy: 'test',
        status: 'active',
      },
    ],
    capturedHash: hash,
  });
  assert.equal(noConsent.matched, false);

  // With active consent + matching hash -> matched >= 95%
  const matched = verifyFaceAttendanceMatch({
    student,
    consents: [
      {
        id: 'c-1',
        centerId: 'center-1',
        studentId: student.id,
        parentPhone: student.parentPhone,
        type: 'biometric_face',
        granted: true,
        grantedAt: new Date().toISOString(),
        capturedBy: 'owner',
      },
    ],
    faceTemplates: [
      {
        id: 'ft-1',
        centerId: 'center-1',
        studentId: student.id,
        descriptorHash: hash,
        enrolledAt: new Date().toISOString(),
        enrolledBy: 'test',
        status: 'active',
      },
    ],
    capturedHash: hash,
  });
  assert.equal(matched.matched, true);
  assert.ok(matched.confidence >= 95);

  // Repository guard: Admin cannot flip biometricFaceEnabled, Owner can
  const prevSettings = repos.meta.getCenterSettings();
  setActivePermissionActor({
    userId: 'admin-1',
    role: UserRole.ADMIN,
    centerId: 'center-1',
  });
  assert.throws(
    () =>
      repos.meta.setCenterSettings({
        ...prevSettings,
        biometricFaceEnabled: !prevSettings.biometricFaceEnabled,
      }),
    PermissionError
  );

  setActivePermissionActor({
    userId: 'owner-1',
    role: UserRole.OWNER,
    centerId: 'center-1',
  });
  repos.meta.setCenterSettings({
    ...prevSettings,
    biometricFaceEnabled: true,
  });
  assert.equal(repos.meta.getCenterSettings().biometricFaceEnabled, true);
  setActivePermissionActor(null);
});
