import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAttendanceHistoryPdf,
  buildFinancialReportPdf,
  buildSessionAttendancePdf,
  buildStudentParentReportPdf,
} from './pdfExportLogic';
import {
  INITIAL_ASSESSMENTS,
  INITIAL_CENTER_SETTINGS,
  INITIAL_EXPENSES,
  INITIAL_GROUPS,
  INITIAL_INVOICES,
  INITIAL_PAYMENTS,
  INITIAL_SESSIONS,
  INITIAL_STUDENTS,
  INITIAL_TEACHERS,
} from '../data/seedData';

test('buildFinancialReportPdf computes revenue, expenses, and share summary', () => {
  const payload = buildFinancialReportPdf({
    centerSettings: INITIAL_CENTER_SETTINGS,
    payments: INITIAL_PAYMENTS,
    expenses: INITIAL_EXPENSES,
    invoices: INITIAL_INVOICES,
    groups: INITIAL_GROUPS,
    students: INITIAL_STUDENTS,
    teachers: INITIAL_TEACHERS,
    fromDate: '2026-11-01',
    toDate: '2026-11-30',
    groupFilter: 'all',
    focusTab: 'all',
  });

  assert.equal(payload.tables.length, 4);
  assert.ok(payload.title.includes('التقرير المالي'));
  assert.ok(payload.shareText.includes(INITIAL_CENTER_SETTINGS.name));
  assert.equal(payload.kpis.length, 4);
});

test('buildAttendanceHistoryPdf filters by student and builds parent greeting', () => {
  const payload = buildAttendanceHistoryPdf({
    centerSettings: INITIAL_CENTER_SETTINGS,
    sessions: INITIAL_SESSIONS,
    groups: INITIAL_GROUPS,
    teachers: INITIAL_TEACHERS,
    students: INITIAL_STUDENTS,
    fromDate: '2026-11-01',
    toDate: '2026-11-30',
    groupFilter: 'all',
    studentFilter: 's1',
  });

  assert.equal(payload.tables.length, 2);
  assert.ok(payload.parentGreeting?.includes('يوسف أحمد محمود'));
  assert.equal(payload.parentPhone, '01002349871');
});

test('buildSessionAttendancePdf summarizes a single session roster', () => {
  const session = INITIAL_SESSIONS[0];
  const grp = INITIAL_GROUPS.find((g) => g.id === session.groupId);
  const tch = INITIAL_TEACHERS.find((t) => t.id === grp?.teacherId);

  const payload = buildSessionAttendancePdf({
    centerSettings: INITIAL_CENTER_SETTINGS,
    session,
    group: grp,
    teacher: tch,
    students: INITIAL_STUDENTS,
  });

  assert.equal(payload.kind, 'attendance_session');
  assert.equal(payload.tables[0].rows.length, session.entries.length);
  assert.ok(payload.shareText.includes('حاضر:'));
});

test('buildStudentParentReportPdf includes attendance, invoices, and assessments', () => {
  const student = INITIAL_STUDENTS[0];
  const payload = buildStudentParentReportPdf({
    centerSettings: INITIAL_CENTER_SETTINGS,
    student,
    groups: INITIAL_GROUPS,
    sessions: INITIAL_SESSIONS,
    invoices: INITIAL_INVOICES,
    assessments: INITIAL_ASSESSMENTS,
  });

  assert.equal(payload.kind, 'student_parent_report');
  assert.equal(payload.tables.length, 3);
  assert.ok(payload.shareText.includes(student.name));
});
