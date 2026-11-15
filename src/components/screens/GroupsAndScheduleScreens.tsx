import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  Edit3,
  LayoutGrid,
  Plus,
} from 'lucide-react';
import { useEduflow } from '../../context/EduflowContext';
import { DayOfWeek, ScreenId } from '../../types/eduflow';
import { can } from '../../permissions/permissions';
import { Can } from '../../permissions/Can';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  ListStateSwitcher,
  SelectInput,
  StatusChip,
  TableSkeleton,
} from '../ui/Primitives';
import {
  DAYS_ORDER,
  detectGroupConflicts,
  formatEGP,
  formatTimeArabic12h,
  formatTimeRangeArabic,
  isGroupConflictingAt,
} from '../../utils/eduflowLogic';

// 8) Groups List Screen
export const GroupsListScreen: React.FC = () => {
  const {
    currentActor,
    groups,
    teachers,
    rooms,
    students,
    listStateMode,
    setListStateMode,
    openCreateGroup,
    openEditGroup,
    navigate,
  } = useEduflow();

  const canCreateGroup = can(currentActor, 'create', 'groups');

  return (
    <div className="space-y-5">
      {/* Sub-Nav Switcher between Groups List (#8) and Weekly Schedule (#9) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 p-1 bg-white border border-[#E2E8F0] rounded-[8px]">
          <button
            type="button"
            className="px-3.5 py-2 rounded-[6px] text-xs font-bold bg-[#0F2A4A] text-white cursor-pointer flex items-center gap-1.5"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>قائمة المجموعات</span>
          </button>
          <button
            type="button"
            onClick={() => navigate(ScreenId.SCHEDULE)}
            className="px-3.5 py-2 rounded-[6px] text-xs font-bold text-[#5B6B80] hover:text-[#0F2A4A] cursor-pointer flex items-center gap-1.5"
          >
            <CalendarDays className="w-3.5 h-3.5" />
            <span>الجدول الأسبوعي والقاعات</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <ListStateSwitcher mode={listStateMode} onChange={setListStateMode} />
          <Can action="create" resource="groups">
            <Button onClick={() => openCreateGroup()} icon={<Plus className="w-4 h-4" />}>
              إنشاء مجموعة
            </Button>
          </Can>
        </div>
      </div>

      {listStateMode === 'loading' ? (
        <TableSkeleton rows={5} />
      ) : listStateMode === 'error' ? (
        <ErrorState onRetry={() => setListStateMode('ready')} />
      ) : listStateMode === 'empty' ? (
        <EmptyState
          title="لا توجد مجموعات دراسية بعد"
          description="أنشئ مجموعات السنتر وحدد المدرس والقاعة والمواعيد الأسبوعية للبدء في تسجيل الطلاب."
          actionLabel={canCreateGroup ? 'إنشاء أول مجموعة' : undefined}
          onAction={canCreateGroup ? () => openCreateGroup() : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {groups.map((grp) => {
            const tch = teachers.find((t) => t.id === grp.teacherId);
            const rm = rooms.find((r) => r.id === grp.roomId);
            const enrolledCount = students.filter(
              (s) => s.status === 'active' && s.groupIds.includes(grp.id)
            ).length;
            const fillPct = Math.min(100, Math.round((enrolledCount / grp.capacity) * 100));
            const conflicts = detectGroupConflicts(grp, groups);

            return (
              <Card key={grp.id} className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold text-[#0F2A4A]">{grp.name}</h3>
                    <p className="text-xs text-[#5B6B80] mt-0.5">
                      {tch?.name} · {grp.stage}
                    </p>
                  </div>
                  <StatusChip
                    tone={fillPct >= 100 ? 'warning' : 'success'}
                    label={fillPct >= 100 ? 'مكتملة' : 'نشطة'}
                  />
                </div>

                {conflicts.length > 0 && (
                  <div className="p-2.5 rounded-[8px] bg-[#FEE2E2] text-[#991B1B] text-xs font-semibold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>
                      يوجد تعارض يوم {conflicts[0].day} مع «{conflicts[0].conflictingGroupName}»
                    </span>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#1E293B] bg-[#F4F7FA] px-3 py-2.5 rounded-[8px]">
                  <span className="font-semibold">{grp.days.join('، ')}</span>
                  <span className="tabular-nums font-bold text-[#0F766E]">
                    {formatTimeRangeArabic(grp.startTime, grp.endTime)}
                  </span>
                  <span className="text-[#5B6B80]">{rm?.name}</span>
                </div>

                {/* Capacity Progress Bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#5B6B80]">إشغال القاعة والطلاب</span>
                    <span className="font-bold text-[#1E293B] tabular-nums">
                      {enrolledCount} / {grp.capacity} طالب ({fillPct}%)
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        fillPct >= 90 ? 'bg-amber-500' : 'bg-[#0F766E]'
                      }`}
                      style={{ width: `${Math.max(8, fillPct)}%` }}
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-sm font-bold text-[#0F2A4A] tabular-nums">
                    الاشتراك الشهري: {formatEGP(grp.monthlyPrice)}
                  </span>
                  <Can action="update" resource="groups">
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<Edit3 className="w-3.5 h-3.5" />}
                      onClick={() => openEditGroup(grp)}
                    >
                      تعديل / الطلاب
                    </Button>
                  </Can>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

// 9) Weekly Schedule & Rooms Screen
const TIME_SLOTS = [
  '14:00',
  '15:00',
  '16:00',
  '17:00',
  '18:00',
  '19:00',
  '20:00',
  '21:00',
];

export const WeeklyScheduleScreen: React.FC = () => {
  const {
    currentActor,
    groups,
    teachers,
    rooms,
    stages,
    openCreateGroup,
    openEditGroup,
    navigate,
  } = useEduflow();

  const canCreateGroup = can(currentActor, 'create', 'groups');
  const canUpdateGroup = can(currentActor, 'update', 'groups');

  const [viewMode, setViewMode] = useState<'room' | 'teacher'>('room');
  const [teacherFilter, setTeacherFilter] = useState('all');
  const [stageFilter, setStageFilter] = useState('all');
  const [roomFilter, setRoomFilter] = useState('all');
  const [mobileDay, setMobileDay] = useState<DayOfWeek>('الثلاثاء');

  const filteredGroups = useMemo(() => {
    return groups.filter((g) => {
      if (teacherFilter !== 'all' && g.teacherId !== teacherFilter) return false;
      if (stageFilter !== 'all' && g.stage !== stageFilter) return false;
      if (roomFilter !== 'all' && g.roomId !== roomFilter) return false;
      return true;
    });
  }, [groups, teacherFilter, stageFilter, roomFilter]);

  return (
    <div className="space-y-5">
      {/* Top Sub-Nav & View Mode Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 p-1 bg-white border border-[#E2E8F0] rounded-[8px]">
          <button
            type="button"
            onClick={() => navigate(ScreenId.GROUPS)}
            className="px-3.5 py-2 rounded-[6px] text-xs font-bold text-[#5B6B80] hover:text-[#0F2A4A] cursor-pointer flex items-center gap-1.5"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>قائمة المجموعات</span>
          </button>
          <button
            type="button"
            className="px-3.5 py-2 rounded-[6px] text-xs font-bold bg-[#0F2A4A] text-white cursor-pointer flex items-center gap-1.5"
          >
            <CalendarDays className="w-3.5 h-3.5" />
            <span>الجدول الأسبوعي والقاعات</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1 p-1 bg-white border border-[#E2E8F0] rounded-[8px]">
            <button
              type="button"
              onClick={() => setViewMode('room')}
              className={`px-3 py-1.5 rounded-[6px] text-xs font-bold cursor-pointer ${
                viewMode === 'room' ? 'bg-[#0F766E] text-white' : 'text-[#5B6B80]'
              }`}
            >
              عرض بالقاعات
            </button>
            <button
              type="button"
              onClick={() => setViewMode('teacher')}
              className={`px-3 py-1.5 rounded-[6px] text-xs font-bold cursor-pointer ${
                viewMode === 'teacher' ? 'bg-[#0F766E] text-white' : 'text-[#5B6B80]'
              }`}
            >
              عرض بالمدرسين
            </button>
          </div>
          <Can action="create" resource="groups">
            <Button onClick={() => openCreateGroup()} icon={<Plus className="w-4 h-4" />}>
              حجز موعد جديد
            </Button>
          </Can>
        </div>
      </div>

      {/* Filters + Conflict Legend */}
      <Card className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 flex-1">
          <SelectInput
            aria-label="تصفية القاعة"
            value={roomFilter}
            onChange={(e) => setRoomFilter(e.target.value)}
          >
            <option value="all">كل القاعات</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </SelectInput>

          <SelectInput
            aria-label="تصفية المدرس"
            value={teacherFilter}
            onChange={(e) => setTeacherFilter(e.target.value)}
          >
            <option value="all">كل المدرسين</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </SelectInput>

          <SelectInput
            aria-label="تصفية المرحلة"
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
        </div>

        <div className="flex items-center gap-4 text-xs shrink-0">
          <div className="flex items-center gap-1.5 text-[#991B1B] font-bold">
            <span className="w-3.5 h-3.5 rounded border-2 border-[#DC2626] bg-[#FEE2E2] inline-block" />
            <span>تعارض قاعة أو مدرس</span>
          </div>
          <span className="text-[#5B6B80]">اضغط على أي خانة فارغة لإنشاء مجموعة</span>
        </div>
      </Card>

      {/* Desktop Weekly Grid (Saturday to Friday, 2 PM to 10 PM) */}
      <Card padding="p-0" className="hidden lg:block overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse table-fixed">
            <thead>
              <tr className="bg-slate-50 border-b border-[#E2E8F0] text-xs font-bold text-[#0F2A4A]">
                <th className="py-3 px-3 w-24 border-l border-[#E2E8F0]">الوقت</th>
                {DAYS_ORDER.map((day) => (
                  <th key={day} className="py-3 px-2 border-l last:border-l-0 border-[#E2E8F0]">
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {TIME_SLOTS.map((slot) => {
                const slotHour = Number(slot.split(':')[0]);
                return (
                  <tr key={slot} className="min-h-[82px]">
                    <td className="py-3 px-3 text-xs font-bold text-[#5B6B80] bg-slate-50/50 border-l border-[#E2E8F0] tabular-nums align-top">
                      {formatTimeArabic12h(slot)}
                    </td>
                    {DAYS_ORDER.map((day) => {
                      const cellGroups = filteredGroups.filter((g) => {
                        if (!g.days.includes(day)) return false;
                        const stH = Number(g.startTime.split(':')[0]);
                        const enH = Number(g.endTime.split(':')[0]);
                        return slotHour >= stH && slotHour < enH;
                      });

                      return (
                        <td
                          key={day}
                          className="p-1.5 border-l last:border-l-0 border-[#E2E8F0] align-top hover:bg-slate-50/70 transition-colors"
                        >
                          {cellGroups.length === 0 ? (
                            canCreateGroup ? (
                              <button
                                type="button"
                                onClick={() =>
                                  openCreateGroup({
                                    day,
                                    startTime: slot,
                                    roomId: roomFilter !== 'all' ? roomFilter : rooms[0]?.id,
                                  })
                                }
                                aria-label={`إضافة مجموعة يوم ${day} الساعة ${formatTimeArabic12h(slot)}`}
                                className="w-full h-14 rounded-[6px] border border-dashed border-transparent hover:border-[#0F766E]/40 hover:bg-[#0F766E]/5 text-[11px] text-transparent hover:text-[#0F766E] font-semibold flex items-center justify-center cursor-pointer transition-colors"
                              >
                                + إضافة
                              </button>
                            ) : (
                              <div className="w-full h-14" />
                            )
                          ) : (
                            <div className="space-y-1.5">
                              {cellGroups.map((cg) => {
                                const tch = teachers.find((t) => t.id === cg.teacherId);
                                const rm = rooms.find((r) => r.id === cg.roomId);
                                const hasConflict = isGroupConflictingAt(cg, day, groups, slotHour);
                                const tintColor = tch?.color || '#0F766E';
                                return (
                                  <button
                                    key={cg.id}
                                    type="button"
                                    disabled={!canUpdateGroup}
                                    onClick={() => canUpdateGroup && openEditGroup(cg)}
                                    title={`${cg.name} — ${tch?.name} — ${rm?.name}`}
                                    style={
                                      !hasConflict
                                        ? {
                                            backgroundColor: `${tintColor}10`,
                                            borderColor: `${tintColor}38`,
                                          }
                                        : undefined
                                    }
                                    className={`w-full text-right p-2 rounded-[8px] text-xs transition-colors cursor-pointer ${
                                      hasConflict
                                        ? 'bg-[#FEE2E2] border-2 border-[#DC2626] text-[#991B1B]'
                                        : 'border text-[#1E293B] hover:brightness-95'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between gap-1">
                                      <span
                                        className="font-bold truncate flex-1"
                                        style={!hasConflict ? { color: tintColor } : undefined}
                                      >
                                        {cg.subject}
                                      </span>
                                      {hasConflict && (
                                        <AlertTriangle className="w-3.5 h-3.5 text-[#DC2626] shrink-0" />
                                      )}
                                    </div>
                                    <p className="text-[11px] truncate mt-0.5 opacity-90">
                                      {viewMode === 'room' ? rm?.name : tch?.name}
                                    </p>
                                    <p className="text-[10px] tabular-nums opacity-75">
                                      {formatTimeRangeArabic(cg.startTime, cg.endTime)}
                                    </p>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Mobile Day Selector Chips & Agenda List */}
      <div className="lg:hidden space-y-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {DAYS_ORDER.map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => setMobileDay(day)}
              className={`px-3.5 py-2 rounded-full text-xs font-bold whitespace-nowrap cursor-pointer ${
                mobileDay === day
                  ? 'bg-[#0F2A4A] text-white'
                  : 'bg-white text-[#5B6B80] border border-[#E2E8F0]'
              }`}
            >
              {day}
            </button>
          ))}
        </div>

        <div className="space-y-2.5">
          {filteredGroups
            .filter((g) => g.days.includes(mobileDay))
            .map((cg) => {
              const tch = teachers.find((t) => t.id === cg.teacherId);
              const rm = rooms.find((r) => r.id === cg.roomId);
              const hasConflict = isGroupConflictingAt(cg, mobileDay, groups);
              return (
                <Card
                  key={cg.id}
                  className={`p-4 ${
                    hasConflict ? 'border-2 border-[#DC2626] bg-[#FEE2E2]/30' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-[#0F2A4A]">{cg.name}</span>
                    <span className="text-xs font-bold text-[#0F766E] tabular-nums">
                      {formatTimeRangeArabic(cg.startTime, cg.endTime)}
                    </span>
                  </div>
                  <p className="text-xs text-[#5B6B80] mt-1">
                    {tch?.name} · {rm?.name}
                  </p>
                  {hasConflict && (
                    <p className="text-xs text-[#991B1B] font-bold mt-1.5 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>تعارض في حجز القاعة بنفس التوقيت</span>
                    </p>
                  )}
                </Card>
              );
            })}
        </div>
      </div>
    </div>
  );
};
