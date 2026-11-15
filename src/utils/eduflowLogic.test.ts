import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAttendanceTrendSeries,
  buildMonthlyRevenueDistribution,
  calculateTeacherShare,
  computeAssessmentSummary,
  computeAttendanceStats,
  computeInvoiceStatus,
  detectGroupConflicts,
  formatEGP,
  getOverdueBucket,
  interpolateTemplate,
  isGroupConflictingAt,
  validateAssessmentScore,
  validatePaymentAmount,
} from './eduflowLogic';
import { Group } from '../types/eduflow';
import {
  INITIAL_GROUPS,
  INITIAL_INVOICES,
  INITIAL_PAYMENTS,
  INITIAL_SESSIONS,
  INITIAL_STUDENTS,
} from '../data/seedData';

const sampleGroups: Group[] = [
  {
    id: 'g1',
    centerId: 'center-1',
    name: 'فيزياء - ثالثة ثانوي (أ)',
    subject: 'فيزياء',
    teacherId: 't1',
    stage: 'الصف الثالث الثانوي',
    days: ['السبت', 'الثلاثاء'],
    startTime: '16:00',
    endTime: '18:00',
    room: 'قاعة 1 - الرئيسية',
    roomId: 'r1',
    capacity: 40,
    monthlyPrice: 450,
    startDate: '2026-09-01',
    status: 'active',
  },
];

test('formatEGP uses Western digits and ج currency suffix', () => {
  assert.equal(formatEGP(2800), '2,800 ج');
  assert.equal(formatEGP(450), '450 ج');
});

test('detectGroupConflicts and isGroupConflictingAt isolate exact day and hour overlaps', () => {
  const roomConflict = detectGroupConflicts(
    {
      teacherId: 't2',
      roomId: 'r1',
      days: ['السبت', 'الأربعاء'],
      startTime: '17:00',
      endTime: '19:00',
    },
    sampleGroups
  );
  assert.equal(roomConflict.length, 1);
  assert.equal(roomConflict[0].reason, 'room');
  assert.equal(roomConflict[0].day, 'السبت');

  const tuesdayExtra: Group = {
    id: 'g7',
    centerId: 'center-1',
    name: 'ميكانيكا',
    subject: 'ميكانيكا',
    teacherId: 't3',
    stage: 'الصف الثالث الثانوي',
    days: ['الثلاثاء'],
    startTime: '17:00',
    endTime: '19:00',
    room: 'قاعة 1 - الرئيسية',
    roomId: 'r1',
    capacity: 40,
    monthlyPrice: 380,
    startDate: '2026-10-12',
    status: 'active',
  };
  const all = [...sampleGroups, tuesdayExtra];
  // Saturday has NO conflict for g1
  assert.equal(isGroupConflictingAt(sampleGroups[0], 'السبت', all, 16), false);
  assert.equal(isGroupConflictingAt(sampleGroups[0], 'السبت', all, 17), false);
  // Tuesday 16:00 has no overlap yet, Tuesday 17:00 overlaps!
  assert.equal(isGroupConflictingAt(sampleGroups[0], 'الثلاثاء', all, 16), false);
  assert.equal(isGroupConflictingAt(sampleGroups[0], 'الثلاثاء', all, 17), true);
});

test('validatePaymentAmount enforces positive amount and remaining balance ceiling', () => {
  assert.equal(validatePaymentAmount(0, 450).valid, false);
  assert.equal(validatePaymentAmount(500, 450).valid, false);
  const partial = validatePaymentAmount(250, 450);
  assert.equal(partial.valid, true);
  assert.equal(partial.remainingAfter, 200);
});

test('computeInvoiceStatus and getOverdueBucket classify invoices properly', () => {
  assert.equal(computeInvoiceStatus(450, 450, 10), 'paid');
  assert.equal(computeInvoiceStatus(450, 200, 5), 'overdue');
  assert.equal(computeInvoiceStatus(450, 200, 0), 'partial');
  assert.equal(computeInvoiceStatus(450, 0, 0), 'pending');

  assert.equal(getOverdueBucket(0), null);
  assert.equal(getOverdueBucket(5), '1-7');
  assert.equal(getOverdueBucket(18), '8-30');
  assert.equal(getOverdueBucket(42), '30+');
});

test('computeAttendanceStats tallies all four attendance states', () => {
  const stats = computeAttendanceStats([
    { studentId: 's1', status: 'present' },
    { studentId: 's2', status: 'present' },
    { studentId: 's3', status: 'late' },
    { studentId: 's4', status: 'absent' },
    { studentId: 's5', status: 'unrecorded' },
  ]);
  assert.deepEqual(stats, {
    present: 2,
    late: 1,
    absent: 1,
    unrecorded: 1,
    total: 5,
  });
});

test('calculateTeacherShare handles percentage and fixed_rent modes', () => {
  assert.deepEqual(calculateTeacherShare(10000, 'percentage', 70), {
    teacherShare: 7000,
    centerShare: 3000,
  });
  assert.deepEqual(calculateTeacherShare(10000, 'fixed_rent', 2500), {
    teacherShare: 7500,
    centerShare: 2500,
  });
});

test('validateAssessmentScore and computeAssessmentSummary compute grades accurately', () => {
  assert.equal(validateAssessmentScore(55, 50, false).valid, false);
  assert.equal(validateAssessmentScore(48, 50, false).valid, true);

  const summary = computeAssessmentSummary(
    [
      { studentId: 's1', score: 45, absent: false },
      { studentId: 's2', score: 35, absent: false },
      { studentId: 's3', score: 20, absent: false },
      { studentId: 's4', score: null, absent: true },
    ],
    50
  );
  assert.equal(summary.gradedCount, 3);
  assert.equal(summary.absentCount, 1);
  assert.equal(summary.highest, 45);
  assert.equal(summary.lowest, 20);
  assert.equal(summary.average, 33.3);
});

test('interpolateTemplate substitutes Arabic variables cleanly', () => {
  const msg = interpolateTemplate(
    'ولي أمر الطالب {اسم_الطالب}، نود إبلاغكم بغيابه اليوم {التاريخ} في مجموعة {المجموعة}.',
    {
      اسم_الطالب: 'يوسف أحمد',
      التاريخ: '12/11/2026',
      المجموعة: 'فيزياء 3ث',
    }
  );
  assert.equal(
    msg,
    'ولي أمر الطالب يوسف أحمد، نود إبلاغكم بغيابه اليوم 12/11/2026 في مجموعة فيزياء 3ث.'
  );
});

test('buildAttendanceTrendSeries merges baseline and live sessions in chronological order', () => {
  const series = buildAttendanceTrendSeries(INITIAL_SESSIONS);
  assert.ok(series.length >= 7);
  assert.equal(series[0].date <= series[series.length - 1].date, true);

  const liveOnly = buildAttendanceTrendSeries(INITIAL_SESSIONS, false);
  assert.equal(liveOnly.length, 3);
  const nov11 = liveOnly.find((p) => p.date === '2026-11-11');
  assert.equal(nov11?.attendanceRate, 100);
});

test('buildMonthlyRevenueDistribution aggregates revenue shares by subject', () => {
  const slices = buildMonthlyRevenueDistribution(
    INITIAL_GROUPS,
    INITIAL_STUDENTS,
    INITIAL_INVOICES,
    INITIAL_PAYMENTS
  );
  assert.ok(slices.length >= 4);
  assert.ok(slices[0].amount >= slices[1].amount);
  const sumPct = slices.reduce((acc, s) => acc + s.percentage, 0);
  assert.ok(sumPct >= 95 && sumPct <= 105);
});
