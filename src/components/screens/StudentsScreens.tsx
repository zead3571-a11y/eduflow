import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Camera,
  Check,
  Copy,
  Download,
  Edit3,
  FileText,
  Filter,
  KeyRound,
  Laptop,
  MessageSquare,
  MoreVertical,
  Phone,
  Plus,
  Printer,
  QrCode,
  RefreshCw,
  ScanFace,
  Search,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Trash2,
  UserPlus,
  UserX,
  Wallet,
} from 'lucide-react';
import { useEduflow } from '../../context/EduflowContext';
import { PaymentStatus, ScreenId } from '../../types/eduflow';
import { can } from '../../permissions/permissions';
import { Can } from '../../permissions/Can';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  InitialAvatar,
  ListStateSwitcher,
  Modal,
  SelectInput,
  StatusChip,
  TableSkeleton,
  TextInput,
  paymentStatusChipProps,
} from '../ui/Primitives';
import { formatDateDDMMYYYY, formatEGP } from '../../utils/eduflowLogic';
import { buildStudentParentReportPdf } from '../../utils/pdfExportLogic';
import { buildStudentsCsv, downloadCsvFile } from '../../features/export/excelExport';
import { encodeStudentQrPayload, generateQrDataUrl } from '../../features/qr/qrService';
import {
  getActiveFaceTemplate,
  hasActiveBiometricConsent,
} from '../../features/biometrics/faceAttendanceService';
import { BulkPrintSlipItem } from '../../features/studentPortal/studentAuthService';
import { isPlanFeatureEnabled } from '../../data/seedData';

// 4) Students List
export const StudentsListScreen: React.FC = () => {
  const {
    currentActor,
    students,
    groups,
    teachers,
    stages,
    centerSettings,
    studentPortalAvailable,
    listStateMode,
    setListStateMode,
    openAddStudent,
    openEditStudent,
    deactivateStudent,
    bulkMoveStudentsToGroup,
    bulkDeactivateStudents,
    bulkGenerateStudentSlips,
    openLockedFeatureModal,
    setSelectedStudentId,
    logExcelExport,
    showToast,
    navigate,
  } = useEduflow();

  const canCreateStudent = can(currentActor, 'create', 'students');
  const canUpdateStudent = can(currentActor, 'update', 'students');
  const canManagePortalAccounts = can(currentActor, 'create', 'studentAccounts');
  const canViewFinancialCols = can(currentActor, 'view', 'invoices');

  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [groupFilter, setGroupFilter] = useState('all');
  const [teacherFilter, setTeacherFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState<'all' | PaymentStatus>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkMoveModalOpen, setBulkMoveModalOpen] = useState(false);
  const [targetBulkGroupId, setTargetBulkGroupId] = useState(groups[0]?.id || '');
  const [bulkSlipsConfirmOpen, setBulkSlipsConfirmOpen] = useState(false);
  const [bulkSlipsGenerating, setBulkSlipsGenerating] = useState(false);
  const [bulkSlips, setBulkSlips] = useState<BulkPrintSlipItem[]>([]);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [openMenuStudentId, setOpenMenuStudentId] = useState<string | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(6);

  const filteredStudents = useMemo(() => {
    return students.filter((st) => {
      const q = search.trim();
      if (q && !st.name.includes(q) && !st.parentPhone.includes(q)) return false;
      if (stageFilter !== 'all' && st.stage !== stageFilter) return false;
      if (groupFilter !== 'all' && !st.groupIds.includes(groupFilter)) return false;
      if (teacherFilter !== 'all') {
        const teacherGroupIds = groups
          .filter((g) => g.teacherId === teacherFilter)
          .map((g) => g.id);
        if (!st.groupIds.some((gid) => teacherGroupIds.includes(gid))) return false;
      }
      if (paymentFilter !== 'all' && st.paymentStatus !== paymentFilter) return false;
      return true;
    });
  }, [students, search, stageFilter, groupFilter, teacherFilter, paymentFilter, groups]);

  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / rowsPerPage));
  const paginatedStudents = filteredStudents.slice(
    (page - 1) * rowsPerPage,
    page * rowsPerPage
  );

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAllPage = () => {
    const pageIds = paginatedStudents.map((s) => s.id);
    const allSelected = pageIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const resetFilters = () => {
    setSearch('');
    setStageFilter('all');
    setGroupFilter('all');
    setTeacherFilter('all');
    setPaymentFilter('all');
    setPage(1);
  };

  return (
    <div className="space-y-5">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Can action="create" resource="students">
            <Button onClick={openAddStudent} icon={<UserPlus className="w-4 h-4" />}>
              إضافة طالب
            </Button>
          </Can>
          <Can action="export" resource="reports">
            <Button
              variant="secondary"
              icon={<Download className="w-4 h-4 text-[#0F766E]" />}
              onClick={() => {
                const csv = buildStudentsCsv(filteredStudents, groups);
                const dateSlug = new Date().toISOString().slice(0, 10);
                downloadCsvFile(`eduflow-students-${dateSlug}.csv`, csv);
                logExcelExport(`قائمة الطلاب (${filteredStudents.length} طالب)`);
                showToast(`تم تصدير ملف Excel لـ ${filteredStudents.length} طالب بنجاح`);
              }}
            >
              تصدير Excel
            </Button>
          </Can>
        </div>

        <ListStateSwitcher mode={listStateMode} onChange={setListStateMode} />
      </div>

      {/* Search & Filters Card */}
      <Card className="p-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#5B6B80] absolute right-3.5 top-3.5 pointer-events-none" />
            <TextInput
              className="pr-10"
              placeholder="ابحث باسم الطالب أو رقم موبايل ولي الأمر..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          {/* Mobile Filter Trigger */}
          <div className="lg:hidden">
            <Button
              variant="secondary"
              onClick={() => setMobileFilterOpen(true)}
              icon={<Filter className="w-4 h-4" />}
              className="w-full"
            >
              تصفية النتائج
            </Button>
          </div>

          {/* Desktop Filters */}
          <div className="hidden lg:grid grid-cols-4 gap-2.5 lg:w-[64%]">
            <SelectInput
              aria-label="تصفية حسب المرحلة"
              value={stageFilter}
              onChange={(e) => {
                setStageFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">كل المراحل</option>
              {stages.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </SelectInput>

            <SelectInput
              aria-label="تصفية حسب المجموعة"
              value={groupFilter}
              onChange={(e) => {
                setGroupFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">كل المجموعات</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </SelectInput>

            <SelectInput
              aria-label="تصفية حسب المدرس"
              value={teacherFilter}
              onChange={(e) => {
                setTeacherFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">كل المدرسين</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </SelectInput>

            <SelectInput
              aria-label="تصفية حسب حالة الدفع"
              value={paymentFilter}
              onChange={(e) => {
                setPaymentFilter(e.target.value as 'all' | PaymentStatus);
                setPage(1);
              }}
            >
              <option value="all">كل حالات الدفع</option>
              <option value="paid">مدفوع</option>
              <option value="partial">جزئي</option>
              <option value="pending">مستحق</option>
              <option value="overdue">متأخر</option>
            </SelectInput>
          </div>
        </div>
      </Card>

      {/* Bulk Action Bar */}
      {(canUpdateStudent || canManagePortalAccounts) && selectedIds.length > 0 && (
        <div className="px-4 py-3 rounded-[10px] bg-[#0F2A4A] text-white flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs font-bold tabular-nums">
            تم تحديد {selectedIds.length} طلاب
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {canManagePortalAccounts && (
              <Button
                size="sm"
                variant="secondary"
                icon={<KeyRound className="w-3.5 h-3.5 text-[#0F766E]" />}
                onClick={() => {
                  if (!isPlanFeatureEnabled(centerSettings.currentPlanId, 'studentPortal')) {
                    openLockedFeatureModal('منصة الطالب وأكواد الدخول', 'الباقة الاحترافية');
                    return;
                  }
                  if (!studentPortalAvailable) {
                    showToast('يرجى تفعيل سويتش «منصة الطالب» من الإعدادات أولاً', 'info');
                    return;
                  }
                  setBulkSlipsConfirmOpen(true);
                }}
              >
                طباعة بطاقات دخول المنصة
              </Button>
            )}
            {canUpdateStudent && (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setBulkMoveModalOpen(true)}
                >
                  نقل لمجموعة
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    bulkDeactivateStudents(selectedIds);
                    setSelectedIds([]);
                  }}
                >
                  إيقاف المحددين
                </Button>
              </>
            )}
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="text-xs text-slate-300 hover:text-white px-2 cursor-pointer"
            >
              إلغاء التحديد
            </button>
          </div>
        </div>
      )}

      {/* States Handling */}
      {listStateMode === 'loading' ? (
        <TableSkeleton rows={6} />
      ) : listStateMode === 'error' ? (
        <ErrorState onRetry={() => setListStateMode('ready')} />
      ) : listStateMode === 'empty' ? (
        <EmptyState
          title="لا يوجد طلاب مسجلون بعد"
          description="ابدأ بإضافة طلاب السنتر وربطهم بالمجموعات الدراسية لتفعيل كشوف الحضور والفواتير الشهرية."
          actionLabel={canCreateStudent ? 'إضافة أول طالب' : undefined}
          onAction={canCreateStudent ? openAddStudent : undefined}
        />
      ) : filteredStudents.length === 0 ? (
        <EmptyState
          title="لا توجد نتائج مطابقة للبحث أو التصفية"
          description="جرّب تعديل كلمات البحث أو إعادة ضبط فلاتر المرحلة وحالة الدفع."
          actionLabel="إعادة ضبط الفلاتر"
          onAction={resetFilters}
        />
      ) : (
        <>
          {/* Desktop Table */}
          <Card padding="p-0" className="hidden md:block overflow-visible">
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-[#E2E8F0] text-xs font-bold text-[#5B6B80] sticky top-0">
                    {canUpdateStudent && (
                      <th className="py-3.5 px-4 w-10">
                        <input
                          type="checkbox"
                          aria-label="تحديد كل طلاب الصفحة"
                          checked={
                            paginatedStudents.length > 0 &&
                            paginatedStudents.every((s) => selectedIds.includes(s.id))
                          }
                          onChange={toggleSelectAllPage}
                          className="w-4 h-4 accent-[#0F766E]"
                        />
                      </th>
                    )}
                    <th className="py-3.5 px-4">الطالب</th>
                    <th className="py-3.5 px-4">المرحلة</th>
                    <th className="py-3.5 px-4">المجموعات</th>
                    <th className="py-3.5 px-4">هاتف ولي الأمر</th>
                    {canViewFinancialCols && <th className="py-3.5 px-4">حالة الدفع</th>}
                    <th className="py-3.5 px-4">آخر حضور</th>
                    <th className="py-3.5 px-4 text-left">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0] text-sm">
                  {paginatedStudents.map((st) => {
                    const chip = paymentStatusChipProps(st.paymentStatus);
                    const stGroups = groups.filter((g) => st.groupIds.includes(g.id));
                    return (
                      <tr
                        key={st.id}
                        className={`hover:bg-slate-50/90 transition-colors ${
                          st.status === 'inactive' ? 'opacity-60' : ''
                        }`}
                      >
                        {canUpdateStudent && (
                          <td className="py-3 px-4">
                            <input
                              type="checkbox"
                              aria-label={`تحديد ${st.name}`}
                              checked={selectedIds.includes(st.id)}
                              onChange={() => toggleSelectOne(st.id)}
                              className="w-4 h-4 accent-[#0F766E]"
                            />
                          </td>
                        )}
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedStudentId(st.id);
                              navigate(ScreenId.STUDENT_PROFILE);
                            }}
                            className="flex items-center gap-3 text-right hover:text-[#0F766E] cursor-pointer"
                          >
                            <InitialAvatar name={st.name} size="sm" />
                            <div>
                              <span className="font-bold text-[#1E293B] block">{st.name}</span>
                              {st.status === 'inactive' && (
                                <span className="text-[11px] text-[#991B1B] font-semibold">
                                  موقوف
                                </span>
                              )}
                            </div>
                          </button>
                        </td>
                        <td className="py-3 px-4 text-xs text-[#5B6B80]">{st.stage}</td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1">
                            {stGroups.slice(0, 2).map((g) => (
                              <span
                                key={g.id}
                                className="px-2 py-0.5 rounded-md bg-slate-100 text-[#1E293B] text-xs font-medium"
                              >
                                {g.subject}
                              </span>
                            ))}
                            {stGroups.length > 2 && (
                              <span className="text-xs text-[#5B6B80] tabular-nums">
                                +{stGroups.length - 2}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 tabular-nums text-xs font-medium text-[#1E293B]">
                          {st.parentPhone}
                        </td>
                        {canViewFinancialCols && (
                          <td className="py-3 px-4">
                            <StatusChip tone={chip.tone} label={chip.label} />
                          </td>
                        )}
                        <td className="py-3 px-4 text-xs text-[#5B6B80] tabular-nums">
                          {st.lastAttendance}
                        </td>
                        <td className="py-3 px-4 text-left relative">
                          <div className="inline-flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedStudentId(st.id);
                                navigate(ScreenId.STUDENT_PROFILE);
                              }}
                            >
                              عرض
                            </Button>
                            {canUpdateStudent && (
                              <button
                                type="button"
                                aria-label={`خيارات الطالب ${st.name}`}
                                onClick={() =>
                                  setOpenMenuStudentId((prev) => (prev === st.id ? null : st.id))
                                }
                                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-[#5B6B80] cursor-pointer"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>
                            )}
                          </div>

                          {canUpdateStudent && openMenuStudentId === st.id && (
                            <div className="absolute left-4 top-11 w-36 bg-white border border-[#E2E8F0] rounded-[8px] shadow-lg z-30 py-1 text-right text-xs">
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenMenuStudentId(null);
                                  setSelectedStudentId(st.id);
                                  navigate(ScreenId.STUDENT_PROFILE);
                                }}
                                className="w-full px-3 py-2 hover:bg-slate-50 font-semibold text-[#1E293B] cursor-pointer text-right"
                              >
                                عرض الملف الكامل
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenMenuStudentId(null);
                                  openEditStudent(st);
                                }}
                                className="w-full px-3 py-2 hover:bg-slate-50 font-semibold text-[#1E293B] cursor-pointer text-right"
                              >
                                تعديل البيانات
                              </button>
                              {st.status === 'active' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMenuStudentId(null);
                                    deactivateStudent(st.id);
                                  }}
                                  className="w-full px-3 py-2 hover:bg-red-50 font-semibold text-[#991B1B] cursor-pointer text-right"
                                >
                                  إيقاف القيد
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="px-4 py-3 border-t border-[#E2E8F0] flex flex-wrap items-center justify-between gap-3 text-xs text-[#5B6B80]">
              <div className="flex items-center gap-2">
                <span>عدد الصفوف:</span>
                <select
                  aria-label="عدد الصفوف في الصفحة"
                  value={rowsPerPage}
                  onChange={(e) => {
                    setRowsPerPage(Number(e.target.value));
                    setPage(1);
                  }}
                  className="border border-[#E2E8F0] rounded px-2 py-1 bg-white text-[#1E293B] tabular-nums"
                >
                  <option value={6}>6</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                </select>
                <span className="tabular-nums">
                  إجمالي {filteredStudents.length} طالب
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  السابق
                </Button>
                <span className="px-2 font-bold text-[#0F2A4A] tabular-nums">
                  صفحة {page} من {totalPages}
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  التالي
                </Button>
              </div>
            </div>
          </Card>

          {/* Mobile Card List (Swipe-free explicit menu) */}
          <div className="md:hidden space-y-3">
            {paginatedStudents.map((st) => {
              const chip = paymentStatusChipProps(st.paymentStatus);
              const stGroups = groups.filter((g) => st.groupIds.includes(g.id));
              return (
                <Card key={st.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedStudentId(st.id);
                        navigate(ScreenId.STUDENT_PROFILE);
                      }}
                      className="flex items-center gap-2.5 text-right"
                    >
                      <InitialAvatar name={st.name} size="sm" />
                      <div>
                        <p className="text-sm font-bold text-[#0F2A4A]">{st.name}</p>
                        <p className="text-xs text-[#5B6B80]">{st.stage}</p>
                      </div>
                    </button>
                    <StatusChip tone={chip.tone} label={chip.label} />
                  </div>

                  <div className="text-xs text-[#5B6B80] flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    <span className="tabular-nums">ولي الأمر: {st.parentPhone}</span>
                    <span>{stGroups.map((g) => g.subject).join(' · ')}</span>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="flex-1"
                      onClick={() => {
                        setSelectedStudentId(st.id);
                        navigate(ScreenId.STUDENT_PROFILE);
                      }}
                    >
                      عرض الملف
                    </Button>
                    <Can action="update" resource="students">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => openEditStudent(st)}
                      >
                        تعديل
                      </Button>
                    </Can>
                    {st.status === 'active' && (
                      <Can action="update" resource="students">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deactivateStudent(st.id)}
                          aria-label={`إيقاف ${st.name}`}
                        >
                          <UserX className="w-4 h-4 text-[#991B1B]" />
                        </Button>
                      </Can>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* Mobile Filters Bottom Sheet */}
      {mobileFilterOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/45 flex flex-col justify-end lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="تصفية الطلاب"
        >
          <div className="bg-white rounded-t-[16px] p-5 space-y-4">
            <h3 className="text-base font-bold text-[#0F2A4A]">تصفية قائمة الطلاب</h3>
            <SelectInput
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
            >
              <option value="all">كل المراحل</option>
              {stages.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </SelectInput>
            <SelectInput
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
            >
              <option value="all">كل المجموعات</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </SelectInput>
            <SelectInput
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value as 'all' | PaymentStatus)}
            >
              <option value="all">كل حالات الدفع</option>
              <option value="paid">مدفوع</option>
              <option value="partial">جزئي</option>
              <option value="pending">مستحق</option>
              <option value="overdue">متأخر</option>
            </SelectInput>
            <div className="flex gap-2 pt-2">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  resetFilters();
                  setMobileFilterOpen(false);
                }}
              >
                إعادة ضبط
              </Button>
              <Button className="flex-1" onClick={() => setMobileFilterOpen(false)}>
                تطبيق الفلاتر
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Move Modal */}
      <Modal
        open={bulkMoveModalOpen}
        onClose={() => setBulkMoveModalOpen(false)}
        title="نقل الطلاب المحددين إلى مجموعة"
        footer={
          <>
            <Button variant="secondary" onClick={() => setBulkMoveModalOpen(false)}>
              إلغاء
            </Button>
            <Button
              onClick={() => {
                bulkMoveStudentsToGroup(selectedIds, targetBulkGroupId);
                setSelectedIds([]);
                setBulkMoveModalOpen(false);
              }}
            >
              تأكيد الإضافة للمجموعة
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-[#5B6B80]">
            اختر المجموعة المراد إلحاق الطلاب المحددين ({selectedIds.length}) بها:
          </p>
          <SelectInput
            value={targetBulkGroupId}
            onChange={(e) => setTargetBulkGroupId(e.target.value)}
          >
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </SelectInput>
        </div>
      </Modal>

      {/* Bulk Login Slips Warning Modal (Step 1: Confirm generate-then-print) */}
      <Modal
        open={bulkSlipsConfirmOpen}
        onClose={() => setBulkSlipsConfirmOpen(false)}
        title="تحذير أمان قبل توليد وطباعة بطاقات دخول المنصة"
        footer={
          <>
            <Button variant="secondary" onClick={() => setBulkSlipsConfirmOpen(false)}>
              إلغاء
            </Button>
            <Button
              loading={bulkSlipsGenerating}
              icon={<Printer className="w-4 h-4" />}
              onClick={async () => {
                setBulkSlipsGenerating(true);
                const generated = await bulkGenerateStudentSlips(selectedIds);
                setBulkSlipsGenerating(false);
                setBulkSlipsConfirmOpen(false);
                if (generated.length > 0) {
                  setBulkSlips(generated);
                  setSelectedIds([]);
                }
              }}
            >
              توليد الأكواد وعرض الطباعة ({selectedIds.length})
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm text-[#1E293B]">
          <div className="p-3.5 rounded-[10px] bg-[#FEF3C7] border border-amber-300 text-[#92400E] flex items-start gap-2.5 text-xs font-bold leading-relaxed">
            <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p>تنبيه سري للغاية للموظفين:</p>
              <p className="font-normal mt-1">
                لا يُخزَّن أي كود دخول بصيغة مقروءة في قاعدة البيانات. عند المتابعة سيتم توليد أكواد دخول جديدة لـ {selectedIds.length} طلاب، وإبطال أي أكواد أو جلسات سابقة لهم، وتظهر الأكواد لمرة واحدة فقط للطباعة (8 بطاقات في كل صفحة A4).
              </p>
            </div>
          </div>
          <p className="text-xs text-[#5B6B80]">
            يرجى تسليم كل بطاقة للطالب المعني شخصياً وعدم ترك النسخ المطبوعة في متناول الآخرين.
          </p>
        </div>
      </Modal>

      {/* Bulk Printable A4 Login Slips Sheet Modal (8 slips per A4 page) */}
      <Modal
        open={bulkSlips.length > 0}
        onClose={() => setBulkSlips([])}
        maxWidth="max-w-4xl"
        title={`بطاقات دخول منصة الطالب (${bulkSlips.length} بطاقة — 8 بطاقات / صفحة A4)`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setBulkSlips([])}>
              إغلاق ومسح الأكواد من الشاشة
            </Button>
            <Button
              icon={<Printer className="w-4 h-4" />}
              onClick={() => window.print()}
            >
              طباعة ورق A4 الآن
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="p-3 rounded-[8px] bg-[#FEE2E2] text-[#991B1B] text-xs font-bold flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>
              تظهر هذه الأكواد لمرة واحدة فقط ولن يمكن عرضها مجدداً بعد إغلاق النافذة. اطبع الصفحة قبل الإغلاق.
            </span>
          </div>

          <div id="printable-login-slips" className="space-y-6">
            {Array.from({ length: Math.ceil(bulkSlips.length / 8) }).map((_, pageIdx) => {
              const chunk = bulkSlips.slice(pageIdx * 8, pageIdx * 8 + 8);
              const portalUrl =
                typeof window !== 'undefined'
                  ? `${window.location.origin}/#/student-login`
                  : '#/student-login';
              return (
                <div
                  key={pageIdx}
                  className="login-slip-page grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-white border border-[#E2E8F0] rounded-[10px]"
                >
                  {chunk.map((slip) => (
                    <div
                      key={slip.studentId}
                      className="p-3.5 rounded-[10px] border-2 border-dashed border-[#0F2A4A]/40 bg-white space-y-2 text-right break-inside-avoid"
                    >
                      <div className="flex items-center justify-between gap-2 border-b border-[#E2E8F0] pb-1.5">
                        <span className="text-[11px] font-bold text-[#0F766E]">
                          {centerSettings.name} — منصة الطالب
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#FEE2E2] text-[#991B1B]">
                          سري
                        </span>
                      </div>

                      <div>
                        <p className="text-sm font-bold text-[#0F2A4A]">{slip.studentName}</p>
                        <p className="text-[11px] text-[#5B6B80]">
                          {slip.stage} · {slip.groupNames.join('، ') || 'بدون مجموعة'}
                        </p>
                      </div>

                      <div className="p-2 rounded-[8px] bg-[#F4F7FA] border border-[#E2E8F0] text-center">
                        <span className="text-[10px] text-[#5B6B80] block">كود الدخول الشخصي</span>
                        <span
                          dir="ltr"
                          className="text-lg font-extrabold text-[#0F2A4A] tracking-widest tabular-nums"
                        >
                          {slip.accessCode}
                        </span>
                      </div>

                      <div className="text-[10px] text-[#5B6B80] space-y-0.5 leading-relaxed">
                        <p>
                          رابط المنصة:{' '}
                          <span dir="ltr" className="font-bold text-[#0F766E]">
                            {portalUrl}
                          </span>
                        </p>
                        <p>
                          في أول دخول: أدخل الكود ثم أنشئ رمز مرور (PIN) من 4-6 أرقام واحفظه.
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </Modal>
    </div>
  );
};

// 6) Student Profile
export const StudentProfileScreen: React.FC = () => {
  const {
    currentActor,
    selectedStudentId,
    students,
    groups,
    sessions,
    attendanceRecords,
    invoices,
    assessments,
    centerSettings,
    studentPortalAvailable,
    consents,
    faceTemplates,
    studentAccounts,
    studentSessions: portalDeviceSessions,
    saveBiometricConsent,
    enrollFaceTemplate,
    deleteFaceTemplate,
    issueStudentAccessCode,
    toggleStudentPortalAccountStatus,
    revokeAllStudentPortalSessions,
    revokeSingleStudentPortalSession,
    openLockedFeatureModal,
    openPdfExport,
    navigate,
    openEditStudent,
    openRecordPayment,
    addStudentNote,
    showToast,
  } = useEduflow();

  const [activeTab, setActiveTab] = useState<
    'overview' | 'attendance' | 'payments' | 'assessments' | 'notes' | 'portal'
  >('overview');
  const [newNote, setNewNote] = useState('');

  // QR Card Modal
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');

  // Portal Account One-Time Code Reveal & Regenerate Confirm
  const [revealedCode, setRevealedCode] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [regenConfirmOpen, setRegenConfirmOpen] = useState(false);
  const [issuingCode, setIssuingCode] = useState(false);

  // Face Enrollment Camera State
  const [faceCameraOpen, setFaceCameraOpen] = useState(false);
  const [faceSampleSignature, setFaceSampleSignature] = useState('');
  const [enrollingFace, setEnrollingFace] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const canViewFinancialTabs = can(currentActor, 'view', 'invoices');
  const canRecordPayment = can(currentActor, 'create', 'payments');
  const canUpdateStudent = can(currentActor, 'update', 'students');
  const canManageConsents = can(currentActor, 'create', 'consents');
  const canManageFaceTemplates = can(currentActor, 'create', 'faceTemplates');
  const canViewPortalTab = can(currentActor, 'view', 'studentAccounts');
  const canManagePortalAccounts = can(currentActor, 'create', 'studentAccounts');

  const student = students.find((s) => s.id === selectedStudentId) || students[0];

  useEffect(() => {
    if (!qrModalOpen || !student) return;
    let active = true;
    generateQrDataUrl(encodeStudentQrPayload(student))
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {
        if (active) setQrDataUrl('');
      });
    return () => {
      active = false;
    };
  }, [qrModalOpen, student]);

  useEffect(() => {
    if (!faceCameraOpen) return;
    let stream: MediaStream | null = null;
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: 'user' } })
        .then((s) => {
          stream = s;
          if (videoRef.current) {
            videoRef.current.srcObject = s;
          }
        })
        .catch(() => {
          // Allow signature-based enrollment when camera is unavailable in headless/desktop envs
        });
    }
    return () => {
      stream?.getTracks().forEach((tr) => tr.stop());
    };
  }, [faceCameraOpen]);

  if (!student) return null;

  const studentGroups = groups.filter((g) => student.groupIds.includes(g.id));
  const studentInvoices = invoices.filter((i) => i.studentId === student.id);
  const totalDue = studentInvoices.reduce((acc, inv) => acc + Math.max(0, inv.total - inv.paid), 0);
  const studentSessions = sessions.filter((sess) =>
    sess.entries.some((e) => e.studentId === student.id)
  );
  const studentAssessments = assessments.filter((a) =>
    a.grades.some((g) => g.studentId === student.id)
  );

  const hasBiometricConsent = hasActiveBiometricConsent(consents, student.id);
  const activeFaceTemplate = getActiveFaceTemplate(faceTemplates, student.id);
  const portalAccount = studentAccounts.find((a) => a.studentId === student.id);
  const activePortalDevices = portalDeviceSessions
    .filter((s) => s.studentId === student.id && !s.revokedAt && s.expiresAt > Date.now())
    .sort((a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime());

  const payChip = paymentStatusChipProps(student.paymentStatus);
  const effectiveTab =
    (activeTab === 'payments' && !canViewFinancialTabs) ||
    (activeTab === 'portal' && !canViewPortalTab)
      ? 'overview'
      : activeTab;

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={() => navigate(ScreenId.STUDENTS)}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-[#5B6B80] hover:text-[#0F2A4A] cursor-pointer"
      >
        <ArrowRight className="w-4 h-4" />
        <span>العودة لقائمة الطلاب</span>
      </button>

      {/* Profile Header Card */}
      <Card className="p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-4">
            <InitialAvatar name={student.name} size="lg" tint="#0F2A4A" />
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-xl font-bold text-[#0F2A4A]">{student.name}</h2>
                <StatusChip
                  tone={student.status === 'active' ? 'success' : 'danger'}
                  label={student.status === 'active' ? 'طالب نشط' : 'موقوف'}
                />
                {canViewFinancialTabs && (
                  <StatusChip tone={payChip.tone} label={`الدفع: ${payChip.label}`} />
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-[#5B6B80] mt-1.5">
                <span>{student.stage}</span>
                <span>·</span>
                <span>ولي الأمر: {student.parentName}</span>
                <span>·</span>
                <a
                  href={`tel:${student.parentPhone}`}
                  className="inline-flex items-center gap-1 font-bold text-[#0F766E] hover:underline tabular-nums"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>{student.parentPhone}</span>
                </a>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={<QrCode className="w-4 h-4 text-[#0F2A4A]" />}
              onClick={() => setQrModalOpen(true)}
            >
              بطاقة الطالب QR
            </Button>
            <Can action="update" resource="students">
              <Button
                variant="secondary"
                size="sm"
                icon={<Edit3 className="w-4 h-4" />}
                onClick={() => openEditStudent(student)}
              >
                تعديل
              </Button>
            </Can>
            <Button
              variant="secondary"
              size="sm"
              icon={<FileText className="w-4 h-4 text-[#0F766E]" />}
              onClick={() =>
                openPdfExport(
                  buildStudentParentReportPdf({
                    centerSettings,
                    student,
                    groups,
                    sessions,
                    invoices,
                    assessments,
                  })
                )
              }
            >
              تقرير لولي الأمر PDF
            </Button>
            <Can action="create" resource="messages">
              <Button
                variant="secondary"
                size="sm"
                icon={<MessageSquare className="w-4 h-4 text-[#0F766E]" />}
                onClick={() =>
                  showToast(`تم تجهيز رسالة تواصل لولي الأمر (${student.parentPhone})`, 'info')
                }
              >
                رسالة لولي الأمر
              </Button>
            </Can>
            <Can action="create" resource="payments">
              <Button
                size="sm"
                icon={<Wallet className="w-4 h-4" />}
                onClick={() => openRecordPayment(student.id)}
              >
                تسجيل دفعة
              </Button>
            </Can>
          </div>
        </div>

        {/* Horizontal Scrollable Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto border-t border-[#E2E8F0] mt-5 pt-3">
          {(
            [
              { id: 'overview', label: 'نظرة عامة' },
              { id: 'attendance', label: 'الحضور' },
              ...(canViewFinancialTabs ? [{ id: 'payments' as const, label: 'المدفوعات' }] : []),
              { id: 'assessments', label: 'التقييمات' },
              { id: 'notes', label: `ملاحظات (${student.notes.length})` },
              ...(canViewPortalTab ? [{ id: 'portal' as const, label: 'حساب المنصة' }] : []),
            ] as readonly {
              id: 'overview' | 'attendance' | 'payments' | 'assessments' | 'notes' | 'portal';
              label: string;
            }[]
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2 rounded-[8px] text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                effectiveTab === t.id
                  ? 'bg-[#0F2A4A] text-white'
                  : 'text-[#5B6B80] hover:bg-slate-100 hover:text-[#1E293B]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </Card>

      {/* Tab 1: Overview */}
      {effectiveTab === 'overview' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4">
              <span className="text-xs text-[#5B6B80]">نسبة الحضور</span>
              <span className="text-2xl font-bold text-[#0F766E] tabular-nums block mt-1">
                {student.attendanceRate}%
              </span>
            </Card>
            <Card className="p-4">
              <span className="text-xs text-[#5B6B80]">إجمالي المستحق الحالي</span>
              <span
                className={`text-2xl font-bold tabular-nums block mt-1 ${
                  totalDue > 0 ? 'text-[#991B1B]' : 'text-[#065F46]'
                }`}
              >
                {formatEGP(totalDue)}
              </span>
            </Card>
            <Card className="p-4">
              <span className="text-xs text-[#5B6B80]">آخر حضور مسجل</span>
              <span className="text-base font-bold text-[#0F2A4A] tabular-nums block mt-2">
                {student.lastAttendance}
              </span>
            </Card>
            <Card className="p-4">
              <span className="text-xs text-[#5B6B80]">المجموعات المشترك بها</span>
              <span className="text-2xl font-bold text-[#0F2A4A] tabular-nums block mt-1">
                {studentGroups.length}
              </span>
            </Card>
          </div>

          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-[#0F2A4A]">المجموعات الدراسية الحالية</h3>
              <span className="text-xs font-bold text-[#5B6B80] tabular-nums">
                كود الطالب: {student.code}
              </span>
            </div>
            {studentGroups.length === 0 ? (
              <p className="text-sm text-[#5B6B80]">لم يلتحق بأي مجموعة حالياً.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {studentGroups.map((g) => (
                  <div
                    key={g.id}
                    className="p-3.5 rounded-[10px] border border-[#E2E8F0] flex items-center justify-between"
                  >
                    <div>
                      <p className="text-sm font-bold text-[#1E293B]">{g.name}</p>
                      <p className="text-xs text-[#5B6B80] mt-0.5">
                        {g.days.join('، ')} · {g.startTime} - {g.endTime}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-[#0F766E] tabular-nums">
                      {formatEGP(g.monthlyPrice)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {student.standingDiscountConfig && student.standingDiscountConfig.value > 0 && (
            <Card className="p-5 bg-[#D1FAE5]/30 border-emerald-200 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-[#065F46]">منحة / خصم دائم مسجل على الملف</h4>
                <p className="text-xs text-[#1E293B] mt-1">
                  {student.standingDiscountConfig.type === 'scholarship'
                    ? `منحة دراسية بنسبة ${student.standingDiscountConfig.value}%`
                    : `إعفاء ثابت بقيمة ${formatEGP(student.standingDiscountConfig.value)}`}
                  {student.standingDiscountConfig.reason
                    ? ` — السبب: ${student.standingDiscountConfig.reason}`
                    : ''}
                </p>
              </div>
              <StatusChip tone="success" label="مفعّل تلقائياً في الفواتير" />
            </Card>
          )}

          {/* Biometric Consent & Face Enrollment Card (Phase 10) */}
          <Card className="p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-[#0F2A4A] flex items-center gap-2">
                  <ScanFace className="w-4 h-4 text-[#0F766E]" />
                  <span>بصمة الوجه وموافقة ولي الأمر</span>
                </h3>
                <p className="text-xs text-[#5B6B80] mt-0.5">
                  لا يمكن تسجيل بصمة الوجه أو استخدامها إلا بعد تفعيل الميزة من المالك وموافقة ولي الأمر.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusChip
                  tone={hasBiometricConsent ? 'success' : 'warning'}
                  label={hasBiometricConsent ? 'موافقة ولي الأمر موثقة' : 'بانتظار موافقة ولي الأمر'}
                />
                <StatusChip
                  tone={activeFaceTemplate ? 'navy' : 'neutral'}
                  label={activeFaceTemplate ? 'البصمة مسجلة' : 'غير مسجلة'}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-[#E2E8F0]">
              {canManageConsents && (
                <Button
                  size="sm"
                  variant={hasBiometricConsent ? 'secondary' : 'primary'}
                  icon={<ShieldCheck className="w-4 h-4" />}
                  onClick={() =>
                    saveBiometricConsent({
                      studentId: student.id,
                      granted: !hasBiometricConsent,
                    })
                  }
                >
                  {hasBiometricConsent ? 'إلغاء موافقة ولي الأمر' : 'توثيق موافقة ولي الأمر'}
                </Button>
              )}

              {canManageFaceTemplates && (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!centerSettings.biometricFaceEnabled || !hasBiometricConsent}
                  icon={<Camera className="w-4 h-4 text-[#0F766E]" />}
                  onClick={() => {
                    setFaceSampleSignature(`face:${student.code}`);
                    setFaceCameraOpen(true);
                  }}
                >
                  {activeFaceTemplate ? 'تحديث بصمة الوجه' : 'التقاط وتسجيل بصمة الوجه'}
                </Button>
              )}

              {canManageFaceTemplates && activeFaceTemplate && (
                <Button
                  size="sm"
                  variant="destructive"
                  icon={<Trash2 className="w-4 h-4" />}
                  onClick={() => deleteFaceTemplate(student.id)}
                >
                  حذف البصمة
                </Button>
              )}
            </div>

            {!centerSettings.biometricFaceEnabled && (
              <p className="text-xs font-semibold text-[#92400E] bg-[#FEF3C7] px-3 py-2 rounded-[8px]">
                ميزة الحضور ببصمة الوجه مغلقة حالياً — يمكن لمالك السنتر تفعيلها من الإعدادات &gt; البيانات.
              </p>
            )}

            {faceCameraOpen && (
              <div className="p-4 rounded-[10px] bg-[#F4F7FA] border border-[#E2E8F0] space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                  <div className="aspect-video bg-[#0F2A4A] rounded-[8px] overflow-hidden flex items-center justify-center relative">
                    <video
                      ref={videoRef}
                      autoPlay
                      muted
                      playsInline
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/60 text-white text-[10px]">
                      كاميرا التحقق
                    </span>
                  </div>
                  <div className="space-y-2.5">
                    <label className="text-xs font-bold text-[#0F2A4A] block">
                      توقيع نموذج البصمة المشفّر
                    </label>
                    <TextInput
                      dir="ltr"
                      className="text-right tabular-nums text-xs"
                      value={faceSampleSignature}
                      onChange={(e) => setFaceSampleSignature(e.target.value)}
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        loading={enrollingFace}
                        onClick={async () => {
                          setEnrollingFace(true);
                          await enrollFaceTemplate({
                            studentId: student.id,
                            sampleSignature: faceSampleSignature || `face:${student.code}`,
                          });
                          setEnrollingFace(false);
                          setFaceCameraOpen(false);
                        }}
                      >
                        تأكيد حفظ البصمة
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setFaceCameraOpen(false)}
                      >
                        إغلاق الكاميرا
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Tab 2: Attendance */}
      {effectiveTab === 'attendance' && (
        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="text-sm font-bold text-[#0F2A4A] mb-3">
              شريط الحضور الشهري — نوفمبر 2026
            </h3>
            <div className="flex flex-wrap gap-2">
              {[
                { day: '02 نوف', st: 'present' },
                { day: '04 نوف', st: 'present' },
                { day: '05 نوف', st: 'late' },
                { day: '08 نوف', st: 'present' },
                { day: '10 نوف', st: student.attendanceRate < 80 ? 'absent' : 'present' },
                { day: '11 نوف', st: 'present' },
                { day: '12 نوف', st: student.attendanceRate < 80 ? 'absent' : 'present' },
              ].map((d, i) => (
                <div
                  key={i}
                  className={`px-3 py-2 rounded-[8px] text-xs font-bold tabular-nums ${
                    d.st === 'present'
                      ? 'bg-[#D1FAE5] text-[#065F46]'
                      : d.st === 'late'
                      ? 'bg-[#FEF3C7] text-[#92400E]'
                      : 'bg-[#FEE2E2] text-[#991B1B]'
                  }`}
                >
                  <span className="block">{d.day}</span>
                  <span className="text-[10px]">
                    {d.st === 'present' ? 'حاضر' : d.st === 'late' ? 'متأخر' : 'غائب'}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {studentSessions.length === 0 ? (
            <EmptyState
              title="لا يوجد سجل حصص لهذا الطالب بعد"
              description="ستظهر هنا تفاصيل حضور الطالب في كل حصة فور رصدها."
            />
          ) : (
            <Card padding="p-0" className="overflow-hidden">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-[#E2E8F0] text-xs font-bold text-[#5B6B80]">
                    <th className="py-3 px-4">التاريخ</th>
                    <th className="py-3 px-4">المجموعة</th>
                    <th className="py-3 px-4">الحالة</th>
                    <th className="py-3 px-4">ملاحظات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0] text-sm">
                  {studentSessions.map((sess) => {
                    const entry = sess.entries.find((e) => e.studentId === student.id);
                    const grp = groups.find((g) => g.id === sess.groupId);
                    const rec = attendanceRecords.find(
                      (r) => r.sessionId === sess.id && r.studentId === student.id
                    );
                    return (
                      <tr key={sess.id}>
                        <td className="py-3 px-4 tabular-nums">
                          <span>{sess.date}</span>
                          {sess.type === 'makeup' && (
                            <span className="mr-1.5 px-1.5 py-0.5 rounded bg-[#E0F2FE] text-[#075985] text-[10px] font-bold">
                              تعويضية
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-semibold">{grp?.name}</td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {entry?.status === 'present' && (
                              <StatusChip tone="success" label="حاضر" />
                            )}
                            {entry?.status === 'late' && (
                              <StatusChip tone="warning" label="متأخر" />
                            )}
                            {entry?.status === 'absent' && (
                              <StatusChip tone="danger" label="غائب" />
                            )}
                            {entry?.status === 'unrecorded' && (
                              <StatusChip tone="neutral" label="لم يُسجّل" />
                            )}
                            {rec?.method === 'qr' && (
                              <StatusChip tone="navy" label="QR" />
                            )}
                            {rec?.method === 'face' && (
                              <StatusChip tone="navy" label={`بصمة وجه ${rec.confidence ? `${rec.confidence}%` : ''}`} />
                            )}
                            {rec?.compensatedBy && (
                              <StatusChip tone="success" label="تم التعويض" />
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-xs text-[#5B6B80]">
                          {entry?.note || rec?.note || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      )}

      {/* Tab 3: Payments */}
      {effectiveTab === 'payments' && canViewFinancialTabs && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-bold text-[#0F2A4A]">سجل الفواتير والمدفوعات</h3>
            {canRecordPayment && (
              <Button size="sm" onClick={() => openRecordPayment(student.id)}>
                تسجيل دفعة للطالب
              </Button>
            )}
          </div>
          {studentInvoices.length === 0 ? (
            <EmptyState
              title="لا توجد فواتير مسجلة لهذا الطالب"
              description="يمكنك إصدار فواتير الشهر من قسم المدفوعات."
            />
          ) : (
            <Card padding="p-0" className="overflow-hidden">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-[#E2E8F0] text-xs font-bold text-[#5B6B80]">
                    <th className="py-3 px-4">رقم الفاتورة</th>
                    <th className="py-3 px-4">الشهر / المجموعة</th>
                    <th className="py-3 px-4">الإجمالي</th>
                    <th className="py-3 px-4">المدفوع</th>
                    <th className="py-3 px-4">المتبقي</th>
                    <th className="py-3 px-4">الحالة</th>
                    <th className="py-3 px-4 text-left">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0] text-sm">
                  {studentInvoices.map((inv) => {
                    const grp = groups.find((g) => g.id === inv.groupId);
                    const ch = paymentStatusChipProps(inv.status);
                    const rem = Math.max(0, inv.total - inv.paid);
                    return (
                      <tr key={inv.id}>
                        <td className="py-3 px-4 tabular-nums font-semibold">{inv.invoiceNumber}</td>
                        <td className="py-3 px-4">
                          <span className="font-bold block">{inv.month}</span>
                          <span className="text-xs text-[#5B6B80]">{grp?.name}</span>
                        </td>
                        <td className="py-3 px-4 tabular-nums">{formatEGP(inv.total)}</td>
                        <td className="py-3 px-4 tabular-nums text-[#065F46]">
                          {formatEGP(inv.paid)}
                        </td>
                        <td className="py-3 px-4 tabular-nums font-bold">
                          {formatEGP(rem)}
                        </td>
                        <td className="py-3 px-4">
                          <StatusChip tone={ch.tone} label={ch.label} />
                        </td>
                        <td className="py-3 px-4 text-left">
                          {rem > 0 && canRecordPayment && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => openRecordPayment(student.id, inv.id)}
                            >
                              سداد
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      )}

      {/* Tab 4: Assessments */}
      {effectiveTab === 'assessments' && (
        <div className="space-y-4">
          {studentAssessments.length === 0 ? (
            <EmptyState
              title="لا توجد درجات امتحانات مسجلة بعد"
              description="ستظهر درجات الامتحانات والكويزات الخاصة بالطالب هنا."
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="lg:col-span-2 p-0 overflow-hidden">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-[#E2E8F0] text-xs font-bold text-[#5B6B80]">
                      <th className="py-3 px-4">التقييم</th>
                      <th className="py-3 px-4">النوع</th>
                      <th className="py-3 px-4">التاريخ</th>
                      <th className="py-3 px-4">الدرجة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0] text-sm">
                    {studentAssessments.map((as) => {
                      const gr = as.grades.find((g) => g.studentId === student.id);
                      return (
                        <tr key={as.id}>
                          <td className="py-3 px-4 font-bold">{as.title}</td>
                          <td className="py-3 px-4 text-xs text-[#5B6B80]">{as.type}</td>
                          <td className="py-3 px-4 tabular-nums text-xs">{as.date}</td>
                          <td className="py-3 px-4 tabular-nums font-bold">
                            {gr?.absent ? (
                              <StatusChip tone="danger" label="غائب" />
                            ) : gr?.score !== null && gr?.score !== undefined ? (
                              `${gr.score} / ${as.maxScore}`
                            ) : (
                              'قيد التصحيح'
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Card>

              <Card className="p-5">
                <h4 className="text-sm font-bold text-[#0F2A4A] mb-3">مؤشر تطور الدرجات</h4>
                <div className="space-y-3">
                  {studentAssessments.map((as) => {
                    const gr = as.grades.find((g) => g.studentId === student.id);
                    const pct =
                      gr && !gr.absent && gr.score !== null
                        ? Math.round((gr.score / as.maxScore) * 100)
                        : 0;
                    return (
                      <div key={as.id} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="truncate max-w-[180px]">{as.title}</span>
                          <span className="font-bold tabular-nums">{pct}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full bg-[#0F766E] rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Tab 5: Notes Timeline */}
      {effectiveTab === 'notes' && (
        <Card className="p-5 space-y-5">
          {canUpdateStudent && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newNote.trim()) return;
                addStudentNote(student.id, newNote.trim());
                setNewNote('');
              }}
              className="flex flex-col sm:flex-row gap-2.5"
            >
              <TextInput
                placeholder="أضف ملاحظة تربوية أو إدارية حول الطالب..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
              />
              <Button type="submit" icon={<Plus className="w-4 h-4" />}>
                إضافة ملاحظة
              </Button>
            </form>
          )}

          {student.notes.length === 0 ? (
            <EmptyState
              title="لا توجد ملاحظات مسجلة"
              description="استخدم الحقل أعلاه لتوثيق أي ملاحظات تخص المستوى الدراسي أو التواصل مع ولي الأمر."
            />
          ) : (
            <div className="space-y-3">
              {student.notes.map((n) => (
                <div
                  key={n.id}
                  className="p-4 rounded-[10px] bg-[#F4F7FA] border border-[#E2E8F0]"
                >
                  <div className="flex items-center justify-between text-xs text-[#5B6B80] mb-1">
                    <span className="font-bold text-[#0F2A4A]">{n.author}</span>
                    <span className="tabular-nums">{n.date}</span>
                  </div>
                  <p className="text-sm text-[#1E293B]">{n.text}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Student QR Card Modal (Phase 9) */}
      <Modal
        open={qrModalOpen}
        onClose={() => setQrModalOpen(false)}
        title={`بطاقة الطالب — ${student.name}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setQrModalOpen(false)}>
              إغلاق
            </Button>
            <Button
              icon={<Printer className="w-4 h-4" />}
              onClick={() => window.print()}
            >
              طباعة البطاقة
            </Button>
          </>
        }
      >
        <div
          id="printable-student-card"
          className="p-5 rounded-[12px] border-2 border-[#0F2A4A] bg-white space-y-4 text-center"
        >
          <div className="border-b border-[#E2E8F0] pb-3">
            <p className="text-xs font-bold text-[#0F766E]">{centerSettings.name}</p>
            <h4 className="text-lg font-bold text-[#0F2A4A] mt-0.5">{student.name}</h4>
            <p className="text-xs text-[#5B6B80]">{student.stage}</p>
          </div>

          <div className="flex justify-center">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`رمز QR للطالب ${student.name}`}
                className="w-44 h-44 border border-[#E2E8F0] rounded-[10px] p-2 bg-white"
              />
            ) : (
              <div className="w-44 h-44 rounded-[10px] bg-slate-100 flex items-center justify-center text-xs text-[#5B6B80]">
                جاري إنشاء QR...
              </div>
            )}
          </div>

          <div className="p-3 rounded-[8px] bg-[#F4F7FA] border border-[#E2E8F0] space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-[#5B6B80]">كود الطالب:</span>
              <span className="font-bold text-[#0F2A4A] tabular-nums" dir="ltr">
                {student.code}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#5B6B80]">المجموعات:</span>
              <span className="font-semibold text-[#1E293B]">
                {studentGroups.map((g) => g.subject).join(' · ') || '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#5B6B80]">هاتف ولي الأمر:</span>
              <span className="font-bold tabular-nums">{student.parentPhone}</span>
            </div>
          </div>
        </div>
      </Modal>

      {/* Tab 6: حساب المنصة (Phase 11A) */}
      {effectiveTab === 'portal' && canViewPortalTab && (
        <div className="space-y-4">
          {!studentPortalAvailable && (
            <div
              role="status"
              className="p-4 rounded-[10px] bg-[#FEF3C7] border border-amber-300 text-[#92400E] text-xs font-bold flex flex-wrap items-center justify-between gap-3"
            >
              <span>
                منصة الطالب غير مفعّلة حالياً في إعدادات السنتر أو غير متاحة في الباقة الحالية.
              </span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => navigate(ScreenId.SETTINGS)}
              >
                فتح الإعدادات
              </Button>
            </div>
          )}

          <Card className="p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-[#0F2A4A] flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-[#0F766E]" />
                  <span>حساب منصة الطالب وكود الدخول</span>
                </h3>
                <p className="text-xs text-[#5B6B80] mt-1">
                  كود الدخول الشخصي منفصل تماماً عن بطاقة الحضور QR ويُحفظ كـ hash مشفّر بملح خاص ولا يُعرض إلا مرة واحدة عند الإنشاء.
                </p>
              </div>
              <StatusChip
                tone={
                  !portalAccount
                    ? 'neutral'
                    : portalAccount.status === 'active'
                    ? 'success'
                    : 'danger'
                }
                label={
                  !portalAccount
                    ? 'غير مُنشأ'
                    : portalAccount.status === 'active'
                    ? 'مفعّل'
                    : 'موقوف'
                }
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-[10px] bg-[#F4F7FA] border border-[#E2E8F0]">
                <span className="text-[11px] text-[#5B6B80] block">حالة رمز المرور (PIN)</span>
                <span className="text-sm font-bold text-[#0F2A4A] block mt-1">
                  {!portalAccount
                    ? 'لم يصدر كود بعد'
                    : portalAccount.hasPinSet
                    ? 'تم تعيين رمز PIN'
                    : 'بانتظار أول دخول للطالب'}
                </span>
              </div>
              <div className="p-3.5 rounded-[10px] bg-[#F4F7FA] border border-[#E2E8F0]">
                <span className="text-[11px] text-[#5B6B80] block">آخر تسجيل دخول</span>
                <span className="text-sm font-bold text-[#0F2A4A] tabular-nums block mt-1">
                  {portalAccount?.lastLoginAt
                    ? formatDateDDMMYYYY(new Date(portalAccount.lastLoginAt))
                    : 'لم يدخل بعد'}
                </span>
              </div>
              <div className="p-3.5 rounded-[10px] bg-[#F4F7FA] border border-[#E2E8F0]">
                <span className="text-[11px] text-[#5B6B80] block">الأجهزة النشطة</span>
                <span className="text-sm font-bold text-[#0F766E] tabular-nums block mt-1">
                  {activePortalDevices.length} / {centerSettings.studentMaxDevices || 2}
                </span>
              </div>
            </div>

            {canManagePortalAccounts && (
              <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-[#E2E8F0]">
                {!portalAccount ? (
                  <Button
                    loading={issuingCode}
                    icon={<KeyRound className="w-4 h-4" />}
                    onClick={async () => {
                      if (!isPlanFeatureEnabled(centerSettings.currentPlanId, 'studentPortal')) {
                        openLockedFeatureModal('منصة الطالب وأكواد الدخول', 'الباقة الاحترافية');
                        return;
                      }
                      setIssuingCode(true);
                      const res = await issueStudentAccessCode(student.id, false);
                      setIssuingCode(false);
                      if (res) {
                        setCopiedCode(false);
                        setRevealedCode(res.plainCode);
                      }
                    }}
                  >
                    إنشاء كود دخول
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="secondary"
                      loading={issuingCode}
                      icon={<RefreshCw className="w-4 h-4 text-[#0F766E]" />}
                      onClick={() => setRegenConfirmOpen(true)}
                    >
                      إعادة توليد الكود
                    </Button>
                    <Button
                      variant={portalAccount.status === 'active' ? 'destructive' : 'primary'}
                      onClick={() =>
                        toggleStudentPortalAccountStatus(
                          student.id,
                          portalAccount.status === 'active' ? 'suspended' : 'active'
                        )
                      }
                    >
                      {portalAccount.status === 'active' ? 'إيقاف الحساب' : 'تفعيل الحساب'}
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={activePortalDevices.length === 0}
                      onClick={() => revokeAllStudentPortalSessions(student.id)}
                    >
                      إنهاء كل الجلسات ({activePortalDevices.length})
                    </Button>
                  </>
                )}
              </div>
            )}
          </Card>

          {portalAccount && (
            <Card className="p-5 space-y-3">
              <h4 className="text-sm font-bold text-[#0F2A4A]">
                الأجهزة والجلسات النشطة للطالب
              </h4>
              {activePortalDevices.length === 0 ? (
                <p className="text-xs text-[#5B6B80]">لا توجد جلسات دخول نشطة لهذا الطالب حالياً.</p>
              ) : (
                <div className="space-y-2">
                  {activePortalDevices.map((dev) => (
                    <div
                      key={dev.id}
                      className="p-3 rounded-[10px] bg-[#F4F7FA] border border-[#E2E8F0] flex flex-wrap items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2.5">
                        {dev.deviceLabel.includes('موبايل') ? (
                          <Smartphone className="w-4 h-4 text-[#0F766E]" />
                        ) : (
                          <Laptop className="w-4 h-4 text-[#0F2A4A]" />
                        )}
                        <div>
                          <p className="text-xs font-bold text-[#0F2A4A]">{dev.deviceLabel}</p>
                          <p className="text-[11px] text-[#5B6B80] tabular-nums">
                            تاريخ الدخول: {formatDateDDMMYYYY(new Date(dev.createdAt))} · ينتهي:{' '}
                            {formatDateDDMMYYYY(new Date(dev.expiresAt))}
                          </p>
                        </div>
                      </div>
                      {canManagePortalAccounts && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => revokeSingleStudentPortalSession(dev.id)}
                        >
                          إنهاء الجلسة
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>
      )}

      {/* Regenerate Code Confirmation Modal */}
      <Modal
        open={regenConfirmOpen}
        onClose={() => setRegenConfirmOpen(false)}
        title="تأكيد إعادة توليد كود دخول الطالب"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRegenConfirmOpen(false)}>
              إلغاء
            </Button>
            <Button
              variant="destructive"
              loading={issuingCode}
              onClick={async () => {
                setIssuingCode(true);
                const res = await issueStudentAccessCode(student.id, true);
                setIssuingCode(false);
                setRegenConfirmOpen(false);
                if (res) {
                  setCopiedCode(false);
                  setRevealedCode(res.plainCode);
                }
              }}
            >
              تأكيد إعادة التوليد وإنهاء الجلسات
            </Button>
          </>
        }
      >
        <p className="text-sm text-[#1E293B] leading-relaxed">
          سيؤدي إعادة توليد الكود للطالب <strong>{student.name}</strong> إلى إبطال الكود القديم فوراً وإنهاء جميع الجلسات المفتوحة على أجهزته. سيظهر الكود الجديد لمرة واحدة فقط.
        </p>
      </Modal>

      {/* One-Time Access Code Reveal Modal */}
      <Modal
        open={Boolean(revealedCode)}
        onClose={() => {
          setRevealedCode(null);
          setCopiedCode(false);
        }}
        title={`كود دخول منصة الطالب — ${student.name}`}
        footer={
          <Button
            onClick={() => {
              setRevealedCode(null);
              setCopiedCode(false);
            }}
          >
            تم الحفظ / إغلاق
          </Button>
        }
      >
        {revealedCode && (
          <div className="space-y-4">
            <div className="p-3 rounded-[8px] bg-[#FEF3C7] border border-amber-300 text-[#92400E] text-xs font-bold flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                يُعرض هذا الكود لمرة واحدة فقط ولن يمكن استرجاعه بعد إغلاق النافذة. انسخه أو سلّمه للطالب الآن.
              </span>
            </div>

            <div className="p-5 rounded-[12px] bg-[#F4F7FA] border-2 border-[#0F2A4A] text-center space-y-2">
              <span className="text-xs text-[#5B6B80] block">كود الدخول الشخصي</span>
              <div
                dir="ltr"
                className="text-2xl font-extrabold text-[#0F2A4A] tracking-widest tabular-nums"
              >
                {revealedCode}
              </div>
              <Button
                size="sm"
                variant="secondary"
                icon={copiedCode ? <Check className="w-4 h-4 text-[#065F46]" /> : <Copy className="w-4 h-4" />}
                onClick={() => {
                  if (typeof navigator !== 'undefined' && navigator.clipboard) {
                    navigator.clipboard.writeText(revealedCode).catch(() => {});
                  }
                  setCopiedCode(true);
                  showToast('تم نسخ كود الدخول');
                }}
              >
                {copiedCode ? 'تم النسخ' : 'نسخ الكود'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
