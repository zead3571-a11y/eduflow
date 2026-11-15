import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CheckSquare,
  UserPlus,
  Wallet,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useEduflow } from '../../context/EduflowContext';
import { ScreenId, UserRole } from '../../types/eduflow';
import { Button, Card, StatusChip } from '../ui/Primitives';
import { COLLECTIONS_30_DAYS } from '../../data/seedData';
import {
  buildAttendanceTrendSeries,
  buildMonthlyRevenueDistribution,
  computeAttendanceStats,
  formatEGP,
  formatNumber,
} from '../../utils/eduflowLogic';
import { can } from '../../permissions/permissions';
import { Can } from '../../permissions/Can';

// 3) Owner Dashboard (with Role Variants + Recharts Analytics + New-Center Empty Checklist)
export const DashboardScreen: React.FC = () => {
  const {
    authSession,
    currentActor,
    currentRole,
    canUseRoleSwitcher,
    setCurrentRole,
    newCenterEmptyMode,
    setNewCenterEmptyMode,
    sessions,
    groups,
    teachers,
    rooms,
    invoices,
    payments,
    students,
    navigate,
    setSelectedSessionId,
    openAddStudent,
    openRecordPayment,
    openCreateGroup,
  } = useEduflow();

  const [attendanceChartMode, setAttendanceChartMode] = useState<'rate' | 'counts'>('rate');

  const actorTeacherId = currentActor?.teacherId || 't1';
  const canViewFinancials = can(currentActor, 'view', 'financialReports');
  const canTakeAttendance = can(currentActor, 'take_attendance', 'sessions');

  // Filter today's sessions (2026-11-12) and filter by teacher if role === TEACHER
  const todaySessions = sessions.filter((s) => {
    if (s.date !== '2026-11-12') return false;
    if (currentRole === UserRole.TEACHER) {
      const grp = groups.find((g) => g.id === s.groupId);
      return grp?.teacherId === actorTeacherId;
    }
    return true;
  });

  // Sessions scoped to current role for attendance trend chart
  const roleScopedSessions = useMemo(() => {
    if (currentRole !== UserRole.TEACHER) return sessions;
    const teacherGroupIds = new Set(
      groups.filter((g) => g.teacherId === actorTeacherId).map((g) => g.id)
    );
    return sessions.filter((s) => teacherGroupIds.has(s.groupId));
  }, [sessions, groups, currentRole, actorTeacherId]);

  const attendanceTrendData = useMemo(
    () => buildAttendanceTrendSeries(roleScopedSessions, currentRole !== UserRole.TEACHER),
    [roleScopedSessions, currentRole]
  );

  const revenueDistributionData = useMemo(
    () => buildMonthlyRevenueDistribution(groups, students, invoices, payments),
    [groups, students, invoices, payments]
  );

  const totalDistributedRevenue = useMemo(
    () => revenueDistributionData.reduce((sum, item) => sum + item.amount, 0),
    [revenueDistributionData]
  );

  // KPI calculations
  let presentToday = 0;
  let absentToday = 0;
  todaySessions.forEach((sess) => {
    const stats = computeAttendanceStats(sess.entries);
    presentToday += stats.present + stats.late;
    absentToday += stats.absent;
  });

  const collectedToday = payments
    .filter((p) => p.date === '2026-11-12')
    .reduce((acc, p) => acc + p.amount, 0);

  const overdueInvoices = invoices.filter((inv) => inv.status === 'overdue');
  const repeatedAbsenceStudents = students.filter(
    (s) => s.status === 'active' && s.attendanceRate < 80
  );
  const pendingAttendanceSessions = todaySessions.filter((s) => s.status === 'pending');

  const avgAttendanceRate =
    attendanceTrendData.length > 0
      ? Math.round(
          attendanceTrendData.reduce((s, d) => s + d.attendanceRate, 0) /
            attendanceTrendData.length
        )
      : 0;

  return (
    <div className="space-y-6">
      {/* Greeting & Owner Demo Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#0F2A4A]">
            {currentRole === UserRole.TEACHER
              ? `أهلاً بك، ${authSession?.name || 'أ. محمد عبد السلام'}`
              : currentRole === UserRole.ACCOUNTANT
              ? `أهلاً بك، ${authSession?.name || 'محمود عادل'} — القسم المالي`
              : currentRole === UserRole.RECEPTIONIST
              ? `أهلاً بك، ${authSession?.name || 'ندى مصطفى'} — الاستقبال`
              : `مرحباً، ${authSession?.name || 'أ. محمود عبد الرحمن'}`}
          </h2>
          <p className="text-xs text-[#5B6B80] mt-0.5 tabular-nums">
            الخميس، 12 نوفمبر 2026 · متابعة حية لحصص السنتر اليوم
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canUseRoleSwitcher && (
            <div
              className="inline-flex items-center gap-1 p-1 bg-white border border-[#E2E8F0] rounded-[8px] text-xs"
              role="group"
              aria-label="معاينة كدور"
            >
              {[
                { role: UserRole.OWNER, label: 'منظور المالك' },
                { role: UserRole.ACCOUNTANT, label: 'المحاسب' },
                { role: UserRole.TEACHER, label: 'المدرس' },
              ].map((item) => (
                <button
                  key={item.role}
                  type="button"
                  onClick={() => setCurrentRole(item.role)}
                  className={`px-2.5 py-1 rounded-[6px] font-bold transition-colors cursor-pointer ${
                    currentRole === item.role
                      ? 'bg-[#0F2A4A] text-white'
                      : 'text-[#5B6B80] hover:text-[#1E293B]'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}

          {authSession?.role === UserRole.OWNER && (
            <button
              type="button"
              onClick={() => setNewCenterEmptyMode(!newCenterEmptyMode)}
              className={`px-3 py-1.5 rounded-[8px] border text-xs font-bold transition-colors cursor-pointer ${
                newCenterEmptyMode
                  ? 'bg-[#0F766E] text-white border-[#0F766E]'
                  : 'bg-white text-[#5B6B80] border-[#E2E8F0] hover:text-[#0F2A4A]'
              }`}
            >
              {newCenterEmptyMode ? 'عرض بيانات السنتر العامرة' : 'معاينة حالة سنتر جديد (فارغ)'}
            </button>
          )}
        </div>
      </div>

      {/* New Center Empty State Checklist */}
      {newCenterEmptyMode ? (
        <Card className="p-6 sm:p-8">
          <div className="max-w-xl space-y-5">
            <div>
              <h3 className="text-lg font-bold text-[#0F2A4A]">
                ابدأ تشغيل سنترك في 3 خطوات بسيطة
              </h3>
              <p className="text-sm text-[#5B6B80] mt-1">
                لم يتم تسجيل حصص لهذا اليوم بعد. أكمل الخطوات التالية لتفعيل الحضور والتحصيل اليومي.
              </p>
            </div>

            <div className="divide-y divide-[#E2E8F0] border border-[#E2E8F0] rounded-[12px]">
              <div className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-full bg-[#D1FAE5] text-[#065F46] text-xs font-bold flex items-center justify-center tabular-nums">
                    1
                  </span>
                  <div>
                    <p className="text-sm font-bold text-[#1E293B]">أضف مدرساً للسنتر</p>
                    <p className="text-xs text-[#5B6B80]">سجّل المدرسين ونسبة السنتر أو إيجار القاعة</p>
                  </div>
                </div>
                <Button size="sm" variant="secondary" onClick={() => navigate(ScreenId.TEACHERS)}>
                  أضف مدرس
                </Button>
              </div>

              <div className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-full bg-[#0F2A4A]/10 text-[#0F2A4A] text-xs font-bold flex items-center justify-center tabular-nums">
                    2
                  </span>
                  <div>
                    <p className="text-sm font-bold text-[#1E293B]">أنشئ أول مجموعة دراسية</p>
                    <p className="text-xs text-[#5B6B80]">حدد المواعيد والقاعة وقيمة الاشتراك الشهري</p>
                  </div>
                </div>
                <Button size="sm" variant="secondary" onClick={() => openCreateGroup()}>
                  أضف مجموعة
                </Button>
              </div>

              <div className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-full bg-[#0F2A4A]/10 text-[#0F2A4A] text-xs font-bold flex items-center justify-center tabular-nums">
                    3
                  </span>
                  <div>
                    <p className="text-sm font-bold text-[#1E293B]">أضف طلاب المجموعة</p>
                    <p className="text-xs text-[#5B6B80]">سجّل بيانات الطلاب وأرقام أولياء الأمور</p>
                  </div>
                </div>
                <Button size="sm" onClick={openAddStudent}>
                  أضف طلاب
                </Button>
              </div>
            </div>
          </div>
        </Card>
      ) : (
        <>
          {/* KPI Cards Row (2x2 on Mobile, 4 cols on Desktop) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4 sm:p-5">
              <span className="text-xs font-semibold text-[#5B6B80] block">حصص اليوم</span>
              <span className="text-2xl font-bold text-[#0F2A4A] tabular-nums mt-1.5 block">
                {todaySessions.length}
              </span>
              <span className="text-xs text-[#5B6B80] mt-1 block">
                {pendingAttendanceSessions.length} بانتظار تسجيل الحضور
              </span>
            </Card>

            <Card className="p-4 sm:p-5">
              <span className="text-xs font-semibold text-[#5B6B80] block">حاضرون اليوم</span>
              <span className="text-2xl font-bold text-[#065F46] tabular-nums mt-1.5 block">
                {presentToday}
              </span>
              <span className="text-xs text-[#5B6B80] mt-1 block">طالب تم تسجيل حضوره</span>
            </Card>

            <Card className="p-4 sm:p-5">
              <span className="text-xs font-semibold text-[#5B6B80] block">غائبون اليوم</span>
              <span className="text-2xl font-bold text-[#991B1B] tabular-nums mt-1.5 block">
                {absentToday}
              </span>
              <span className="text-xs text-[#5B6B80] mt-1 block">تنبيهات أولياء الأمور جاهزة</span>
            </Card>

            {canViewFinancials ? (
              <Card className="p-4 sm:p-5">
                <span className="text-xs font-semibold text-[#5B6B80] block">محصّل اليوم</span>
                <span className="text-2xl font-bold text-[#0F766E] tabular-nums mt-1.5 block">
                  {formatEGP(collectedToday)}
                </span>
                <span className="text-xs text-[#5B6B80] mt-1 block tabular-nums">
                  المتأخرات: {formatEGP(overdueInvoices.reduce((s, i) => s + (i.total - i.paid), 0))}
                </span>
              </Card>
            ) : currentRole === UserRole.TEACHER ? (
              <Card className="p-4 sm:p-5">
                <span className="text-xs font-semibold text-[#5B6B80] block">مجموعاتك النشطة</span>
                <span className="text-2xl font-bold text-[#0F766E] tabular-nums mt-1.5 block">
                  {groups.filter((g) => g.teacherId === actorTeacherId).length}
                </span>
                <span className="text-xs text-[#5B6B80] mt-1 block">
                  الطلاب المسجلون: {students.length} طالب
                </span>
              </Card>
            ) : (
              <Card className="p-4 sm:p-5">
                <span className="text-xs font-semibold text-[#5B6B80] block">الطلاب النشطون</span>
                <span className="text-2xl font-bold text-[#0F766E] tabular-nums mt-1.5 block">
                  {students.filter((s) => s.status === 'active').length}
                </span>
                <span className="text-xs text-[#5B6B80] mt-1 block tabular-nums">
                  إيصالات صادرة اليوم: {payments.filter((p) => p.date === '2026-11-12').length}
                </span>
              </Card>
            )}
          </div>

          {/* Quick Actions + Alerts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Quick Actions Card */}
            <Card className="lg:col-span-5 p-5 flex flex-col justify-between">
              <div>
                <h3 className="text-base font-bold text-[#0F2A4A]">إجراءات سريعة</h3>
                <p className="text-xs text-[#5B6B80] mt-0.5">
                  المهام اليومية المتاحة لدورك الوظيفي الحالي
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-2.5 mt-4">
                <Can action="take_attendance" resource="sessions">
                  <Button
                    onClick={() => navigate(ScreenId.TAKE_ATTENDANCE)}
                    icon={<CheckSquare className="w-4 h-4" />}
                    className="w-full justify-start"
                  >
                    تسجيل حضور حصة
                  </Button>
                </Can>
                <Can action="create" resource="payments">
                  <Button
                    variant="secondary"
                    onClick={() => openRecordPayment()}
                    icon={<Wallet className="w-4 h-4 text-[#0F766E]" />}
                    className="w-full justify-start"
                  >
                    تسجيل دفعة وإصدار إيصال
                  </Button>
                </Can>
                <Can action="create" resource="students">
                  <Button
                    variant="secondary"
                    onClick={openAddStudent}
                    icon={<UserPlus className="w-4 h-4 text-[#0F2A4A]" />}
                    className="w-full justify-start"
                  >
                    إضافة طالب جديد
                  </Button>
                </Can>
                {currentRole === UserRole.ACCOUNTANT && (
                  <Button
                    variant="secondary"
                    onClick={() => navigate(ScreenId.REPORTS)}
                    icon={<ArrowLeft className="w-4 h-4 text-[#0F2A4A]" />}
                    className="w-full justify-start"
                  >
                    عرض التقارير المالية
                  </Button>
                )}
              </div>
            </Card>

            {/* Alerts Card */}
            <Card className="lg:col-span-7 p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-bold text-[#0F2A4A]">تنبيهات تحتاج للمتابعة</h3>
                <span className="text-xs text-[#5B6B80] tabular-nums">متابعة يومية</span>
              </div>
              <div className="divide-y divide-[#E2E8F0]">
                <Can action="view" resource="financialReports">
                  <div className="py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#FEE2E2] text-[#991B1B] flex items-center justify-center shrink-0">
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[#1E293B] tabular-nums">
                          {overdueInvoices.length} طلاب متأخرون في سداد الاشتراك الشهري
                        </p>
                        <p className="text-xs text-[#5B6B80]">
                          تجاوزوا موعد الاستحقاق المحدد للشهر الحالي
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(ScreenId.LATE_PAYMENTS)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-[#0F766E] hover:underline shrink-0 cursor-pointer"
                    >
                      <span>عرض المتأخرين</span>
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </Can>

                <div className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#FEF3C7] text-[#92400E] flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#1E293B] tabular-nums">
                        {repeatedAbsenceStudents.length} طلاب لديهم غياب متكرر هذا الشهر
                      </p>
                      <p className="text-xs text-[#5B6B80]">
                        نسبة حضورهم أقل من 80% ويحتاجون لتواصل مع ولي الأمر
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate(ScreenId.STUDENTS)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#0F766E] hover:underline shrink-0 cursor-pointer"
                  >
                    <span>مراجعة الطلاب</span>
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 text-[#0F2A4A] flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#1E293B] tabular-nums">
                        {pendingAttendanceSessions.length === 1
                          ? 'حصة واحدة اليوم لم يُسجّل حضورها بعد'
                          : `${pendingAttendanceSessions.length} حصص اليوم لم يُسجّل حضورها بعد`}
                      </p>
                      <p className="text-xs text-[#5B6B80]">
                        تابع حالة تسجيل الحضور للحصص المجدولة اليوم
                      </p>
                    </div>
                  </div>
                  {canTakeAttendance && (
                    <button
                      type="button"
                      onClick={() => {
                        if (pendingAttendanceSessions[0]) {
                          setSelectedSessionId(pendingAttendanceSessions[0].id);
                        }
                        navigate(ScreenId.TAKE_ATTENDANCE);
                      }}
                      className="inline-flex items-center gap-1 text-xs font-bold text-[#0F766E] hover:underline shrink-0 cursor-pointer"
                    >
                      <span>تسجيل الآن</span>
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </Card>
          </div>

          {/* Today's Sessions Table */}
          <Card padding="p-0" className="overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E2E8F0] flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-[#0F2A4A]">جدول حصص اليوم</h3>
                <p className="text-xs text-[#5B6B80]">
                  متابعة حالة التسجيل اللحظي لكل مجموعة في القاعات
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate(ScreenId.SCHEDULE)}
              >
                الجدول الأسبوعي الكامل
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-[#E2E8F0] text-xs font-bold text-[#5B6B80]">
                    <th className="py-3 px-4">المجموعة</th>
                    <th className="py-3 px-4">المدرس</th>
                    <th className="py-3 px-4">الموعد</th>
                    <th className="py-3 px-4">القاعة</th>
                    <th className="py-3 px-4">الحالة</th>
                    <th className="py-3 px-4 text-left">الإجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0] text-sm">
                  {todaySessions.map((sess) => {
                    const grp = groups.find((g) => g.id === sess.groupId);
                    const tch = teachers.find((t) => t.id === grp?.teacherId);
                    const rm = rooms.find((r) => r.id === sess.roomId);
                    return (
                      <tr key={sess.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-[#1E293B]">
                          {grp?.name}
                        </td>
                        <td className="py-3.5 px-4 text-[#5B6B80]">{tch?.name}</td>
                        <td className="py-3.5 px-4 tabular-nums text-[#1E293B]">
                          {sess.timeLabel}
                        </td>
                        <td className="py-3.5 px-4 text-[#5B6B80]">{rm?.name}</td>
                        <td className="py-3.5 px-4">
                          {sess.status === 'recorded' && (
                            <StatusChip tone="success" label="تم التسجيل" />
                          )}
                          {sess.status === 'pending' && (
                            <StatusChip tone="warning" label="بانتظار الحضور" />
                          )}
                          {sess.status === 'upcoming' && (
                            <StatusChip tone="neutral" label="لم تبدأ" />
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-left">
                          {canTakeAttendance ? (
                            <Button
                              size="sm"
                              variant={sess.status === 'pending' ? 'primary' : 'secondary'}
                              onClick={() => {
                                setSelectedSessionId(sess.id);
                                navigate(ScreenId.TAKE_ATTENDANCE);
                              }}
                            >
                              {sess.status === 'recorded' ? 'عرض / تعديل' : 'تسجيل الحضور'}
                            </Button>
                          ) : (
                            <span className="text-xs text-[#5B6B80]">عرض فقط</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Recharts Analytics Row: Student Attendance Trends + Monthly Revenue Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Student Attendance Trends Chart */}
            <Card
              className={`p-5 ${
                canViewFinancials ? 'lg:col-span-7' : 'lg:col-span-12'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <div>
                  <h3 className="text-base font-bold text-[#0F2A4A]">
                    اتجاهات حضور الطلاب
                  </h3>
                  <p className="text-xs text-[#5B6B80] mt-0.5 tabular-nums">
                    متوسط نسبة الالتزام:{' '}
                    <strong className="text-[#0F766E]">{avgAttendanceRate}%</strong>
                    {' · '}
                    <span>{attendanceTrendData.length} أيام دراسية</span>
                  </p>
                </div>

                <div
                  className="inline-flex items-center gap-1 p-1 bg-[#F4F7FA] border border-[#E2E8F0] rounded-[8px] text-xs"
                  role="group"
                  aria-label="نمط عرض مخطط الحضور"
                >
                  <button
                    type="button"
                    onClick={() => setAttendanceChartMode('rate')}
                    className={`px-2.5 py-1 rounded-[6px] font-bold cursor-pointer transition-colors ${
                      attendanceChartMode === 'rate'
                        ? 'bg-white text-[#0F2A4A] shadow-xs'
                        : 'text-[#5B6B80] hover:text-[#1E293B]'
                    }`}
                  >
                    نسبة الحضور %
                  </button>
                  <button
                    type="button"
                    onClick={() => setAttendanceChartMode('counts')}
                    className={`px-2.5 py-1 rounded-[6px] font-bold cursor-pointer transition-colors ${
                      attendanceChartMode === 'counts'
                        ? 'bg-white text-[#0F2A4A] shadow-xs'
                        : 'text-[#5B6B80] hover:text-[#1E293B]'
                    }`}
                  >
                    حاضر / غائب
                  </button>
                </div>
              </div>

              {attendanceChartMode === 'counts' && (
                <div className="flex flex-wrap items-center gap-4 mb-2 text-xs text-[#5B6B80]">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-[#1E293B]">
                    <span className="w-2.5 h-2.5 rounded-xs bg-[#0F766E] inline-block" />
                    حاضر
                  </span>
                  <span className="inline-flex items-center gap-1.5 font-semibold text-[#1E293B]">
                    <span className="w-2.5 h-2.5 rounded-xs bg-[#D97706] inline-block" />
                    متأخر
                  </span>
                  <span className="inline-flex items-center gap-1.5 font-semibold text-[#1E293B]">
                    <span className="w-2.5 h-2.5 rounded-xs bg-[#DC2626] inline-block" />
                    غائب
                  </span>
                </div>
              )}

              <div className="w-full h-64" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  {attendanceChartMode === 'rate' ? (
                    <AreaChart
                      data={attendanceTrendData}
                      margin={{ top: 10, right: 8, left: 10, bottom: 4 }}
                    >
                      <defs>
                        <linearGradient id="attendanceRateGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0F766E" stopOpacity={0.28} />
                          <stop offset="95%" stopColor="#0F766E" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                      <XAxis
                        dataKey="label"
                        reversed
                        tick={{ fill: '#5B6B80', fontSize: 11, fontFamily: 'Cairo, sans-serif' }}
                        axisLine={{ stroke: '#E2E8F0' }}
                        tickLine={false}
                      />
                      <YAxis
                        orientation="right"
                        domain={[0, 100]}
                        width={44}
                        tickFormatter={(val) => `${val}%`}
                        tick={{ fill: '#5B6B80', fontSize: 11, fontFamily: 'Cairo, sans-serif' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload || !payload.length) return null;
                          const pt = payload[0].payload;
                          return (
                            <div
                              dir="rtl"
                              className="bg-white border border-[#E2E8F0] rounded-[10px] shadow-md px-3.5 py-2.5 text-xs space-y-1 text-right"
                            >
                              <p className="font-bold text-[#0F2A4A]">{pt.label}</p>
                              <p className="font-bold text-[#0F766E] tabular-nums">
                                نسبة الالتزام: {pt.attendanceRate}%
                              </p>
                              <p className="text-[#5B6B80] tabular-nums">
                                حاضر: {pt.present} · متأخر: {pt.late} · غائب: {pt.absent}
                              </p>
                            </div>
                          );
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="attendanceRate"
                        name="نسبة الحضور"
                        stroke="#0F766E"
                        strokeWidth={2.5}
                        fill="url(#attendanceRateGrad)"
                        activeDot={{ r: 5, fill: '#0F2A4A', stroke: '#FFFFFF', strokeWidth: 2 }}
                      />
                    </AreaChart>
                  ) : (
                    <BarChart
                      data={attendanceTrendData}
                      margin={{ top: 10, right: 8, left: 10, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                      <XAxis
                        dataKey="label"
                        reversed
                        tick={{ fill: '#5B6B80', fontSize: 11, fontFamily: 'Cairo, sans-serif' }}
                        axisLine={{ stroke: '#E2E8F0' }}
                        tickLine={false}
                      />
                      <YAxis
                        orientation="right"
                        width={36}
                        tick={{ fill: '#5B6B80', fontSize: 11, fontFamily: 'Cairo, sans-serif' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload || !payload.length) return null;
                          const pt = payload[0].payload;
                          return (
                            <div
                              dir="rtl"
                              className="bg-white border border-[#E2E8F0] rounded-[10px] shadow-md px-3.5 py-2.5 text-xs space-y-1 text-right"
                            >
                              <p className="font-bold text-[#0F2A4A]">{pt.label}</p>
                              <p className="text-[#065F46] font-semibold tabular-nums">
                                حاضر: {pt.present}
                              </p>
                              <p className="text-[#92400E] font-semibold tabular-nums">
                                متأخر: {pt.late}
                              </p>
                              <p className="text-[#991B1B] font-semibold tabular-nums">
                                غائب: {pt.absent}
                              </p>
                            </div>
                          );
                        }}
                      />
                      <Bar dataKey="present" stackId="att" fill="#0F766E" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="late" stackId="att" fill="#D97706" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="absent" stackId="att" fill="#DC2626" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Monthly Revenue Distribution Donut Chart (Financial Roles Only) */}
            <Can action="view" resource="financialReports">
              <Card className="lg:col-span-5 p-5 flex flex-col justify-between">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div>
                    <h3 className="text-base font-bold text-[#0F2A4A]">
                      توزيع الإيرادات الشهرية
                    </h3>
                    <p className="text-xs text-[#5B6B80] mt-0.5 tabular-nums">
                      حسب المادة الدراسية · الإجمالي:{' '}
                      <strong className="text-[#0F2A4A]">
                        {formatEGP(totalDistributedRevenue)}
                      </strong>
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 items-center gap-4 my-auto">
                  <div className="w-full h-48" dir="ltr">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={revenueDistributionData}
                          dataKey="amount"
                          nameKey="subject"
                          cx="50%"
                          cy="50%"
                          innerRadius={48}
                          outerRadius={76}
                          paddingAngle={2}
                        >
                          {revenueDistributionData.map((entry) => (
                            <Cell key={entry.subject} fill={entry.color} stroke="#FFFFFF" strokeWidth={2} />
                          ))}
                        </Pie>
                        <Tooltip
                          content={({ active, payload }) => {
                            if (!active || !payload || !payload.length) return null;
                            const item = payload[0].payload;
                            return (
                              <div
                                dir="rtl"
                                className="bg-white border border-[#E2E8F0] rounded-[10px] shadow-md px-3 py-2 text-xs text-right"
                              >
                                <p className="font-bold text-[#0F2A4A]">{item.subject}</p>
                                <p className="text-[#0F766E] font-bold tabular-nums mt-0.5">
                                  {formatEGP(item.amount)} ({item.percentage}%)
                                </p>
                              </div>
                            );
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="space-y-2 text-xs">
                    {revenueDistributionData.map((slice) => (
                      <div
                        key={slice.subject}
                        className="flex items-center justify-between gap-2 py-1 border-b border-slate-100 last:border-b-0"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-xs shrink-0"
                            style={{ backgroundColor: slice.color }}
                          />
                          <span className="font-bold text-[#1E293B] truncate">
                            {slice.subject}
                          </span>
                        </div>
                        <span className="tabular-nums font-bold text-[#0F2A4A] shrink-0">
                          {slice.percentage}% · {formatEGP(slice.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            </Can>
          </div>

          {/* 30-Day Collections Recharts Area Chart (Financial Roles Only) */}
          <Can action="view" resource="financialReports">
            <Card className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <div>
                  <h3 className="text-base font-bold text-[#0F2A4A]">
                    منحنى التحصيل اليومي — آخر 30 يوماً
                  </h3>
                  <p className="text-xs text-[#5B6B80]">
                    إجمالي المتحصلات خلال 30 يوماً:{' '}
                    <strong className="text-[#0F2A4A] tabular-nums">
                      {formatEGP(
                        COLLECTIONS_30_DAYS.reduce((sum, item) => sum + item.amount, 0)
                      )}
                    </strong>
                  </p>
                </div>
                <span className="text-xs text-[#5B6B80]">
                  مرر المؤشر على النقاط لعرض قيمة تحصيل كل يوم
                </span>
              </div>

              <div className="w-full h-56" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={COLLECTIONS_30_DAYS}
                    margin={{ top: 10, right: 8, left: 10, bottom: 4 }}
                  >
                    <defs>
                      <linearGradient id="collectionsTealGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0F766E" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#0F766E" stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis
                      dataKey="day"
                      reversed
                      interval={1}
                      tick={{ fill: '#5B6B80', fontSize: 11, fontFamily: 'Cairo, sans-serif' }}
                      axisLine={{ stroke: '#E2E8F0' }}
                      tickLine={false}
                    />
                    <YAxis
                      orientation="right"
                      width={52}
                      tickFormatter={(val) => `${formatNumber(val)}`}
                      tick={{ fill: '#5B6B80', fontSize: 11, fontFamily: 'Cairo, sans-serif' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload || !payload.length) return null;
                        const pt = payload[0].payload;
                        return (
                          <div
                            dir="rtl"
                            className="bg-[#0F2A4A] text-white rounded-[8px] shadow-md px-3 py-2 text-xs text-right tabular-nums"
                          >
                            <span className="block opacity-85">{pt.day}</span>
                            <strong className="text-sm">{formatEGP(pt.amount)}</strong>
                          </div>
                        );
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="amount"
                      name="التحصيل اليومي"
                      stroke="#0F766E"
                      strokeWidth={2.5}
                      fill="url(#collectionsTealGrad)"
                      activeDot={{ r: 5.5, fill: '#0F2A4A', stroke: '#FFFFFF', strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </Can>
        </>
      )}
    </div>
  );
};
