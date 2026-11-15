import React, { useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCheck,
  CheckSquare,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Lock,
  MessageSquare,
  Settings,
  Wallet,
} from 'lucide-react';
import { useEduflow } from '../../context/EduflowContext';
import { AppNotification, ScreenId } from '../../types/eduflow';
import { can } from '../../permissions/permissions';
import {
  Button,
  Card,
  EmptyState,
  LockedFeatureCard,
  SelectInput,
  StatusChip,
  TextInput,
} from '../ui/Primitives';
import { calculateTeacherShare, formatEGP } from '../../utils/eduflowLogic';
import {
  buildAttendanceHistoryPdf,
  buildFinancialReportPdf,
} from '../../utils/pdfExportLogic';
import { buildReportCsv, downloadCsvFile } from '../../features/export/excelExport';
import { buildWhatsAppUrl } from '../../features/messaging/whatsappService';

// 17) Notifications Full Page Screen
export const NotificationsScreen: React.FC = () => {
  const {
    currentActor,
    notifications,
    messages,
    markAllNotificationsRead,
    markNotificationRead,
    markOutboxMessageSent,
    setSelectedStudentId,
    showToast,
    navigate,
  } = useEduflow();

  const [filter, setFilter] = useState<'all' | 'attendance' | 'payments' | 'system' | 'outbox'>('all');
  const [emptyDemo, setEmptyDemo] = useState(false);

  const canViewOutbox = can(currentActor, 'view', 'messages');
  const filtered = emptyDemo
    ? []
    : notifications.filter((n) => filter === 'all' || n.category === filter);

  const todayList = filtered.filter((n) => n.isToday);
  const earlierList = filtered.filter((n) => !n.isToday);

  const renderIcon = (cat: AppNotification['category']) => {
    if (cat === 'attendance') {
      return (
        <div className="w-10 h-10 rounded-full bg-[#FEF3C7] text-[#92400E] flex items-center justify-center shrink-0">
          <CheckSquare className="w-4 h-4" />
        </div>
      );
    }
    if (cat === 'payments') {
      return (
        <div className="w-10 h-10 rounded-full bg-[#D1FAE5] text-[#065F46] flex items-center justify-center shrink-0">
          <Wallet className="w-4 h-4" />
        </div>
      );
    }
    return (
      <div className="w-10 h-10 rounded-full bg-[#0F2A4A]/10 text-[#0F2A4A] flex items-center justify-center shrink-0">
        <Settings className="w-4 h-4" />
      </div>
    );
  };

  const renderRow = (item: AppNotification) => (
    <button
      key={item.id}
      type="button"
      onClick={() => {
        markNotificationRead(item.id);
        if (item.targetStudentId) setSelectedStudentId(item.targetStudentId);
        navigate(item.targetScreen);
      }}
      className={`w-full text-right p-4 flex items-start gap-3.5 hover:bg-slate-50 transition-colors cursor-pointer ${
        !item.read ? 'bg-[#0F766E]/[0.04]' : ''
      }`}
    >
      {renderIcon(item.category)}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-bold text-[#0F2A4A]">{item.title}</h4>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-[#5B6B80]">{item.relativeTime}</span>
            {!item.read && (
              <span className="w-2.5 h-2.5 rounded-full bg-[#0F766E]" aria-label="غير مقروء" />
            )}
          </div>
        </div>
        <p className="text-xs text-[#5B6B80] mt-1">{item.body}</p>
      </div>
    </button>
  );

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-white border border-[#E2E8F0] rounded-[8px]">
          {(
            [
              { id: 'all', label: 'الكل' },
              { id: 'attendance', label: 'الحضور' },
              { id: 'payments', label: 'المدفوعات' },
              { id: 'system', label: 'النظام' },
              ...(canViewOutbox
                ? [{ id: 'outbox' as const, label: `سجل رسائل واتساب (${messages.length})` }]
                : []),
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setFilter(t.id)}
              className={`px-3.5 py-1.5 rounded-[6px] text-xs font-bold cursor-pointer ${
                filter === t.id ? 'bg-[#0F2A4A] text-white' : 'text-[#5B6B80]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setEmptyDemo((v) => !v)}
            className="text-xs font-semibold text-[#5B6B80] hover:text-[#0F2A4A] underline cursor-pointer"
          >
            {emptyDemo ? 'عرض الإشعارات' : 'معاينة حالة لا توجد إشعارات'}
          </button>
          <Button
            variant="secondary"
            size="sm"
            onClick={markAllNotificationsRead}
            icon={<CheckCheck className="w-4 h-4 text-[#0F766E]" />}
          >
            تحديد الكل كمقروء
          </Button>
        </div>
      </div>

      {filter === 'outbox' && canViewOutbox ? (
        messages.length === 0 || emptyDemo ? (
          <EmptyState
            icon={<MessageSquare className="w-6 h-6" />}
            title="لا توجد رسائل واتساب في السجل بعد"
            description="ستظهر هنا كل رسائل تنبيه الغياب والتأخيرات والإيصالات المُجهّزة للإرسال عبر واتساب."
          />
        ) : (
          <Card padding="p-0" className="divide-y divide-[#E2E8F0] overflow-hidden">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-[#0F2A4A]">{msg.recipientName}</span>
                    <span className="text-xs text-[#5B6B80] tabular-nums">
                      {msg.recipientPhone}
                    </span>
                    <StatusChip
                      tone={
                        msg.status === 'sent'
                          ? 'success'
                          : msg.status === 'failed'
                          ? 'danger'
                          : 'warning'
                      }
                      label={
                        msg.status === 'sent'
                          ? 'تم الإرسال'
                          : msg.status === 'failed'
                          ? 'فشل'
                          : 'جاهز للإرسال'
                      }
                    />
                  </div>
                  <p className="text-xs text-[#5B6B80] leading-relaxed">{msg.body}</p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<Copy className="w-3.5 h-3.5" />}
                    onClick={() => {
                      navigator.clipboard?.writeText(msg.body);
                      showToast('تم نسخ نص الرسالة');
                    }}
                  >
                    نسخ
                  </Button>
                  <a
                    href={buildWhatsAppUrl(msg.recipientPhone, msg.body)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => markOutboxMessageSent(msg.id)}
                    className="inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-[8px] bg-[#0F766E] text-white text-xs font-bold"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>فتح واتساب</span>
                  </a>
                  {msg.status !== 'sent' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Check className="w-3.5 h-3.5 text-[#065F46]" />}
                      onClick={() => markOutboxMessageSent(msg.id)}
                    >
                      تم الإرسال
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </Card>
        )
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Bell className="w-6 h-6" />}
          title="لا توجد إشعارات"
          description="ستظهر هنا تنبيهات الغياب المتكرر، الدفعات الجديدة، وتعارضات الجدول فور حدوثها."
        />
      ) : (
        <div className="space-y-5">
          {todayList.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-[#5B6B80] px-1">اليوم</h3>
              <Card padding="p-0" className="divide-y divide-[#E2E8F0] overflow-hidden">
                {todayList.map(renderRow)}
              </Card>
            </div>
          )}

          {earlierList.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-[#5B6B80] px-1">سابقاً</h3>
              <Card padding="p-0" className="divide-y divide-[#E2E8F0] overflow-hidden">
                {earlierList.map(renderRow)}
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// 18) Reports Screen (4 Tabs + Locked Plan Blurred State)
export const ReportsScreen: React.FC = () => {
  const {
    currentActor,
    groups,
    teachers,
    invoices,
    payments,
    expenses,
    students,
    sessions,
    centerSettings,
    updateCenterSettings,
    openPdfExport,
    logExcelExport,
    showToast,
    navigate,
  } = useEduflow();

  const canViewTeacherShares = can(currentActor, 'view', 'teacherShares');
  const canExportReports =
    can(currentActor, 'export', 'reports') ||
    can(currentActor, 'export', 'financialReports');
  const canManageSettings = can(currentActor, 'update', 'settings');

  const [tab, setTab] = useState<'attendance' | 'revenue' | 'overdue' | 'teachers'>('attendance');
  const [fromDate, setFromDate] = useState('2026-11-01');
  const [toDate, setToDate] = useState('2026-11-30');
  const [groupFilter, setGroupFilter] = useState('all');

  const activeTab =
    tab === 'teachers' && !canViewTeacherShares ? 'attendance' : tab;

  const isLocked =
    centerSettings.currentPlanId === 'basic' || centerSettings.reportsLockedDemo;

  const handleExportPdf = (mode: 'current' | 'full_financial' = 'current') => {
    if (mode === 'full_financial') {
      openPdfExport(
        buildFinancialReportPdf({
          centerSettings,
          payments,
          expenses,
          invoices,
          groups,
          students,
          teachers,
          fromDate,
          toDate,
          groupFilter,
          focusTab: 'all',
        })
      );
      return;
    }
    if (tab === 'attendance') {
      openPdfExport(
        buildAttendanceHistoryPdf({
          centerSettings,
          sessions,
          groups,
          teachers,
          students,
          fromDate,
          toDate,
          groupFilter,
          studentFilter: 'all',
        })
      );
      return;
    }
    openPdfExport(
      buildFinancialReportPdf({
        centerSettings,
        payments,
        expenses,
        invoices,
        groups,
        students,
        teachers,
        fromDate,
        toDate,
        groupFilter,
        focusTab: tab,
      })
    );
  };

  const totalCollected = payments.reduce((s, p) => s + p.amount, 0) + 42000;
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const netCenter = totalCollected - totalExpenses;

  return (
    <div className="space-y-5">
      {/* Top Tabs + Locked State Simulator */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 p-1 bg-white border border-[#E2E8F0] rounded-[8px] overflow-x-auto">
          {(
            [
              { id: 'attendance', label: 'الحضور الشهري' },
              { id: 'revenue', label: 'الإيرادات والمصروفات' },
              { id: 'overdue', label: 'المتأخرون' },
              ...(canViewTeacherShares
                ? [{ id: 'teachers' as const, label: 'حسابات المدرسين' }]
                : []),
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`px-3.5 py-2 rounded-[6px] text-xs font-bold whitespace-nowrap cursor-pointer ${
                activeTab === item.id ? 'bg-[#0F2A4A] text-white' : 'text-[#5B6B80]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {canManageSettings && (
            <button
              type="button"
              onClick={() =>
                updateCenterSettings({ reportsLockedDemo: !centerSettings.reportsLockedDemo })
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-[#E2E8F0] bg-white text-xs font-bold text-[#0F2A4A] hover:bg-slate-50 cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5 text-[#0F766E]" />
              <span>{isLocked ? 'إلغاء قفل الباقة' : 'معاينة حالة الباقة المقفلة'}</span>
            </button>
          )}
          {canExportReports && (
            <>
              <Button
                variant="secondary"
                size="sm"
                disabled={isLocked}
                icon={<Download className="w-4 h-4 text-[#0F766E]" />}
                onClick={() => {
                  const { filename, csv } = buildReportCsv(activeTab, {
                    payments,
                    expenses,
                    invoices,
                    groups,
                    teachers,
                    sessions,
                    students,
                  });
                  downloadCsvFile(filename, csv);
                  logExcelExport(`تقرير (${activeTab})`);
                  showToast('تم تصدير التقرير بصيغة Excel (CSV) بنجاح');
                }}
              >
                Excel
              </Button>
              <Button
                size="sm"
                disabled={isLocked}
                onClick={() => handleExportPdf('current')}
                icon={<FileText className="w-4 h-4" />}
              >
                تصدير PDF
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={isLocked}
                onClick={() => handleExportPdf('full_financial')}
                icon={<FileText className="w-4 h-4 text-[#0F766E]" />}
              >
                التقرير المالي الشامل PDF
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <TextInput
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="tabular-nums"
        />
        <TextInput
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="tabular-nums"
        />
        <SelectInput
          value={groupFilter}
          onChange={(e) => setGroupFilter(e.target.value)}
        >
          <option value="all">جميع المجموعات</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </SelectInput>
      </Card>

      {/* Content Area with Optional Locked Blurred Overlay */}
      <div className="relative">
        <div className={isLocked ? 'blur-[6px] pointer-events-none select-none opacity-60' : ''}>
          {activeTab === 'attendance' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="p-4">
                  <span className="text-xs text-[#5B6B80]">متوسط نسبة الحضور العام</span>
                  <span className="text-2xl font-bold text-[#0F766E] tabular-nums block mt-1">
                    89.4%
                  </span>
                </Card>
                <Card className="p-4">
                  <span className="text-xs text-[#5B6B80]">إجمالي الحصص المنعقدة</span>
                  <span className="text-2xl font-bold text-[#0F2A4A] tabular-nums block mt-1">
                    48 حصة
                  </span>
                </Card>
                <Card className="p-4">
                  <span className="text-xs text-[#5B6B80]">حالات الغياب المرصودة</span>
                  <span className="text-2xl font-bold text-[#991B1B] tabular-nums block mt-1">
                    34 حالة
                  </span>
                </Card>
              </div>

              <Card className="p-5">
                <h3 className="text-sm font-bold text-[#0F2A4A] mb-4">
                  نسبة التزام المجموعات بالحضور الشهري
                </h3>
                <div className="space-y-3">
                  {groups.slice(0, 5).map((g, idx) => {
                    const rate = [94, 91, 86, 89, 92][idx % 5];
                    return (
                      <div key={g.id} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-bold text-[#1E293B]">{g.name}</span>
                          <span className="font-bold text-[#0F766E] tabular-nums">{rate}%</span>
                        </div>
                        <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full bg-[#0F766E] rounded-full"
                            style={{ width: `${rate}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          )}

          {activeTab === 'revenue' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="p-4">
                  <span className="text-xs text-[#5B6B80]">إجمالي إيرادات الشهر</span>
                  <span className="text-2xl font-bold text-[#065F46] tabular-nums block mt-1">
                    {formatEGP(totalCollected)}
                  </span>
                </Card>
                <Card className="p-4">
                  <span className="text-xs text-[#5B6B80]">إجمالي المصروفات التشغيلية</span>
                  <span className="text-2xl font-bold text-[#991B1B] tabular-nums block mt-1">
                    {formatEGP(totalExpenses)}
                  </span>
                </Card>
                <Card className="p-4">
                  <span className="text-xs text-[#5B6B80]">صافي الفائض قبل نسب المدرسين</span>
                  <span className="text-2xl font-bold text-[#0F2A4A] tabular-nums block mt-1">
                    {formatEGP(netCenter)}
                  </span>
                </Card>
              </div>

              <Card padding="p-0" className="overflow-hidden">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-[#E2E8F0] text-xs font-bold text-[#5B6B80]">
                      <th className="py-3 px-4">المجموعة</th>
                      <th className="py-3 px-4">عدد الطلاب</th>
                      <th className="py-3 px-4">الاشتراك الشهري</th>
                      <th className="py-3 px-4">المحصّل الفعلي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0] text-sm">
                    {groups.slice(0, 5).map((g) => {
                      const cnt = students.filter((s) => s.groupIds.includes(g.id)).length + 18;
                      return (
                        <tr key={g.id}>
                          <td className="py-3 px-4 font-bold">{g.name}</td>
                          <td className="py-3 px-4 tabular-nums">{cnt}</td>
                          <td className="py-3 px-4 tabular-nums">{formatEGP(g.monthlyPrice)}</td>
                          <td className="py-3 px-4 tabular-nums font-bold text-[#0F766E]">
                            {formatEGP(cnt * g.monthlyPrice * 0.9)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Card>
            </div>
          )}

          {activeTab === 'overdue' && (
            <Card padding="p-0" className="overflow-hidden">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-[#E2E8F0] text-xs font-bold text-[#5B6B80]">
                    <th className="py-3 px-4">الطالب</th>
                    <th className="py-3 px-4">الفاتورة</th>
                    <th className="py-3 px-4">أيام التأخير</th>
                    <th className="py-3 px-4">المبلغ المتبقي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0] text-sm">
                  {invoices
                    .filter((i) => i.status === 'overdue')
                    .map((inv) => {
                      const st = students.find((s) => s.id === inv.studentId);
                      return (
                        <tr key={inv.id}>
                          <td className="py-3 px-4 font-bold">{st?.name}</td>
                          <td className="py-3 px-4 tabular-nums">{inv.invoiceNumber}</td>
                          <td className="py-3 px-4">
                            <StatusChip tone="danger" label={`${inv.daysOverdue} يوم`} />
                          </td>
                          <td className="py-3 px-4 tabular-nums font-bold text-[#991B1B]">
                            {formatEGP(inv.total - inv.paid)}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </Card>
          )}

          {activeTab === 'teachers' && canViewTeacherShares && (
            <Card padding="p-0" className="overflow-hidden">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-[#E2E8F0] text-xs font-bold text-[#5B6B80]">
                    <th className="py-3 px-4">المدرس</th>
                    <th className="py-3 px-4">نظام التعاقد</th>
                    <th className="py-3 px-4">إجمالي تحصيل مجموعاته</th>
                    <th className="py-3 px-4">مستحقات المدرس</th>
                    <th className="py-3 px-4">صافي حصة السنتر</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0] text-sm">
                  {teachers.map((t, i) => {
                    const gross = [28400, 22100, 19500, 24000, 16800][i % 5];
                    const split = calculateTeacherShare(
                      gross,
                      t.compensationType,
                      t.compensationValue
                    );
                    return (
                      <tr key={t.id}>
                        <td className="py-3 px-4 font-bold">{t.name}</td>
                        <td className="py-3 px-4 text-xs">
                          {t.compensationType === 'percentage'
                            ? `نسبة ${t.compensationValue}%`
                            : `إيجار ثابت ${formatEGP(t.compensationValue)}`}
                        </td>
                        <td className="py-3 px-4 tabular-nums">{formatEGP(gross)}</td>
                        <td className="py-3 px-4 tabular-nums font-bold text-[#0F766E]">
                          {formatEGP(split.teacherShare)}
                        </td>
                        <td className="py-3 px-4 tabular-nums font-bold text-[#0F2A4A]">
                          {formatEGP(split.centerShare)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          )}
        </div>

        {/* Centered Locked Feature Overlay */}
        {isLocked && (
          <div className="absolute inset-0 flex items-center justify-center p-4 z-10">
            <LockedFeatureCard
              featureName="التقارير التحليلية وحسابات نسب المدرسين"
              planName="الباقة الاحترافية"
              description="احصل على تقارير مالية تفصيلية، صافي أرباح السنتر، وكشوف تسوية مستحقات المدرسين الشهرية."
              onUpgrade={() => navigate(ScreenId.SUBSCRIPTION)}
            />
          </div>
        )}
      </div>
    </div>
  );
};
