import React, { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Plus,
} from 'lucide-react';
import { useEduflow } from '../../context/EduflowContext';
import { Assessment, AssessmentType } from '../../types/eduflow';
import { can } from '../../permissions/permissions';
import { Can } from '../../permissions/Can';
import {
  Button,
  Card,
  Drawer,
  EmptyState,
  ErrorState,
  Field,
  InitialAvatar,
  ListStateSwitcher,
  SelectInput,
  StatusChip,
  TableSkeleton,
  TextInput,
} from '../ui/Primitives';
import {
  computeAssessmentSummary,
  validateAssessmentScore,
} from '../../utils/eduflowLogic';

// 16) Assessments & Grade Entry Screen
export const AssessmentsScreen: React.FC = () => {
  const {
    currentActor,
    assessments,
    groups,
    students,
    listStateMode,
    setListStateMode,
    createAssessment,
    updateAssessmentGrades,
  } = useEduflow();

  const canEnterAssessments = can(currentActor, 'enter_assessments', 'assessments');

  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string | null>(null);
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);

  // Create form state
  const [title, setTitle] = useState('');
  const [type, setType] = useState<AssessmentType>('امتحان');
  const [groupId, setGroupId] = useState(groups[0]?.id || '');
  const [date, setDate] = useState('2026-11-14');
  const [maxScore, setMaxScore] = useState('50');
  const [formErr, setFormErr] = useState('');

  // Grade entry autosave indicator & errors
  const [autosaveStatus, setAutosaveStatus] = useState<'saved' | 'saving'>('saved');
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  const activeAssessment: Assessment | null =
    assessments.find((a) => a.id === selectedAssessmentId) || null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setFormErr('يرجى كتابة عنوان التقييم.');
      return;
    }
    const max = Number(maxScore);
    if (!max || max <= 0) {
      setFormErr('النهاية العظمى يجب أن تكون أكبر من صفر.');
      return;
    }
    const created = createAssessment({
      title: title.trim(),
      type,
      groupId,
      date,
      maxScore: max,
    });
    setTitle('');
    setFormErr('');
    setCreateDrawerOpen(false);
    setSelectedAssessmentId(created.id);
  };

  if (activeAssessment) {
    const grp = groups.find((g) => g.id === activeAssessment.groupId);
    const canEditThisAssessment = can(
      currentActor,
      'enter_assessments',
      'assessments',
      { groupId: activeAssessment.groupId, groups }
    );
    const summary = computeAssessmentSummary(
      activeAssessment.grades,
      activeAssessment.maxScore
    );
    const maxBucketCount = Math.max(...summary.distribution.map((d) => d.count), 1);

    const handleScoreChange = (studentId: string, rawVal: string) => {
      if (!canEditThisAssessment) return;
      const parsed = rawVal === '' ? null : Number(rawVal);
      const check = validateAssessmentScore(parsed, activeAssessment.maxScore, false);
      if (!check.valid) {
        setRowErrors((prev) => ({ ...prev, [studentId]: check.error || 'قيمة خاطئة' }));
        return;
      }
      setRowErrors((prev) => {
        const next = { ...prev };
        delete next[studentId];
        return next;
      });
      setAutosaveStatus('saving');
      const nextGrades = activeAssessment.grades.map((g) =>
        g.studentId === studentId ? { ...g, score: parsed, absent: false } : g
      );
      updateAssessmentGrades(activeAssessment.id, nextGrades);
      setTimeout(() => setAutosaveStatus('saved'), 300);
    };

    const handleAbsentToggle = (studentId: string, absent: boolean) => {
      if (!canEditThisAssessment) return;
      setAutosaveStatus('saving');
      const nextGrades = activeAssessment.grades.map((g) =>
        g.studentId === studentId
          ? { ...g, absent, score: absent ? null : g.score }
          : g
      );
      updateAssessmentGrades(activeAssessment.id, nextGrades);
      setTimeout(() => setAutosaveStatus('saved'), 250);
    };

    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setSelectedAssessmentId(null)}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#5B6B80] hover:text-[#0F2A4A] cursor-pointer"
          >
            <ArrowRight className="w-4 h-4" />
            <span>العودة لقائمة التقييمات</span>
          </button>

          {canEditThisAssessment ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#D1FAE5] text-[#065F46] text-xs font-bold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>
                {autosaveStatus === 'saving'
                  ? 'جاري الحفظ التلقائي...'
                  : 'تم الحفظ التلقائي للدرجات'}
              </span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FEF3C7] text-[#92400E] text-xs font-bold">
              <span>وضع العرض فقط — إدخال الدرجات متاح للمدرس أو الإدارة</span>
            </div>
          )}
        </div>

        {/* Assessment Header & Summary Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <Card className="lg:col-span-7 p-5 space-y-4">
            <div>
              <div className="flex items-center gap-2">
                <StatusChip tone="navy" label={activeAssessment.type} />
                <span className="text-xs text-[#5B6B80] tabular-nums">
                  {activeAssessment.date}
                </span>
              </div>
              <h2 className="text-lg font-bold text-[#0F2A4A] mt-1.5">
                {activeAssessment.title}
              </h2>
              <p className="text-xs text-[#5B6B80]">{grp?.name}</p>
            </div>

            <div className="grid grid-cols-4 gap-3 pt-3 border-t border-[#E2E8F0]">
              <div>
                <span className="text-xs text-[#5B6B80] block">النهاية العظمى</span>
                <span className="text-lg font-bold text-[#0F2A4A] tabular-nums">
                  {activeAssessment.maxScore}
                </span>
              </div>
              <div>
                <span className="text-xs text-[#5B6B80] block">متوسط المجموعة</span>
                <span className="text-lg font-bold text-[#0F766E] tabular-nums">
                  {summary.average}
                </span>
              </div>
              <div>
                <span className="text-xs text-[#5B6B80] block">أعلى درجة</span>
                <span className="text-lg font-bold text-[#065F46] tabular-nums">
                  {summary.highest}
                </span>
              </div>
              <div>
                <span className="text-xs text-[#5B6B80] block">أقل درجة</span>
                <span className="text-lg font-bold text-[#991B1B] tabular-nums">
                  {summary.lowest}
                </span>
              </div>
            </div>
          </Card>

          {/* Score Distribution Bar Chart */}
          <Card className="lg:col-span-5 p-5">
            <h3 className="text-sm font-bold text-[#0F2A4A] mb-3">توزيع درجات الطلاب</h3>
            <div className="space-y-2.5">
              {summary.distribution.map((bucket) => (
                <div key={bucket.label} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-[#5B6B80] font-medium">{bucket.label}</span>
                    <span className="font-bold text-[#1E293B] tabular-nums">
                      {bucket.count} طالب
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-[#0F766E] rounded-full transition-all"
                      style={{ width: `${(bucket.count / maxBucketCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Grade Entry Roster */}
        <Card padding="p-0" className="overflow-hidden">
          <div className="px-5 py-3.5 bg-slate-50 border-b border-[#E2E8F0] flex items-center justify-between text-xs font-bold text-[#5B6B80]">
            <span>رصد درجات الطلاب (النهاية العظمى: {activeAssessment.maxScore})</span>
            <span>يتم التحقق تلقائياً من عدم تجاوز الدرجة القصوى</span>
          </div>

          <div className="divide-y divide-[#E2E8F0]">
            {activeAssessment.grades.map((gr) => {
              const st = students.find((s) => s.id === gr.studentId);
              if (!st) return null;
              const errMsg = rowErrors[st.id];

              return (
                <div
                  key={st.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <InitialAvatar name={st.name} size="sm" />
                    <div>
                      <p className="text-sm font-bold text-[#1E293B]">{st.name}</p>
                      {errMsg && (
                        <p className="text-xs font-bold text-[#991B1B] mt-0.5">{errMsg}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#5B6B80] cursor-pointer">
                      <input
                        type="checkbox"
                        disabled={!canEditThisAssessment}
                        checked={gr.absent}
                        onChange={(e) => handleAbsentToggle(st.id, e.target.checked)}
                        className="w-4 h-4 accent-[#DC2626]"
                      />
                      <span>غائب</span>
                    </label>

                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        inputMode="numeric"
                        aria-label={`درجة ${st.name}`}
                        disabled={gr.absent || !canEditThisAssessment}
                        min={0}
                        max={activeAssessment.maxScore}
                        placeholder="—"
                        value={gr.score === null ? '' : gr.score}
                        onChange={(e) => handleScoreChange(st.id, e.target.value)}
                        className={`w-24 h-11 px-3 rounded-[8px] border text-center text-base font-bold tabular-nums focus:outline-none ${
                          errMsg
                            ? 'border-[#DC2626] bg-red-50 text-[#991B1B]'
                            : 'border-[#E2E8F0] bg-white text-[#0F2A4A] focus:border-[#0F766E]'
                        } disabled:bg-slate-100 disabled:text-slate-400`}
                      />
                      <span className="text-xs font-bold text-[#5B6B80] tabular-nums">
                        / {activeAssessment.maxScore}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Can action="enter_assessments" resource="assessments">
          <Button onClick={() => setCreateDrawerOpen(true)} icon={<Plus className="w-4 h-4" />}>
            إنشاء تقييم أو امتحان
          </Button>
        </Can>
        <ListStateSwitcher mode={listStateMode} onChange={setListStateMode} />
      </div>

      {listStateMode === 'loading' ? (
        <TableSkeleton rows={4} />
      ) : listStateMode === 'error' ? (
        <ErrorState onRetry={() => setListStateMode('ready')} />
      ) : listStateMode === 'empty' || assessments.length === 0 ? (
        <EmptyState
          title="لا توجد تقييمات أو امتحانات بعد"
          description="أنشئ امتحانات شهرية أو كويزات سريعة لرصد درجات الطلاب ومشاركتها مع أولياء الأمور."
          actionLabel={canEnterAssessments ? 'إنشاء أول امتحان' : undefined}
          onAction={canEnterAssessments ? () => setCreateDrawerOpen(true) : undefined}
        />
      ) : (
        <Card padding="p-0" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-[#E2E8F0] text-xs font-bold text-[#5B6B80]">
                  <th className="py-3.5 px-4">عنوان التقييم</th>
                  <th className="py-3.5 px-4">المجموعة</th>
                  <th className="py-3.5 px-4">التاريخ</th>
                  <th className="py-3.5 px-4">النهاية العظمى</th>
                  <th className="py-3.5 px-4">متوسط الدرجات</th>
                  <th className="py-3.5 px-4">الحالة</th>
                  <th className="py-3.5 px-4 text-left">الرصد</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] text-sm">
                {assessments.map((as) => {
                  const grp = groups.find((g) => g.id === as.groupId);
                  const sum = computeAssessmentSummary(as.grades, as.maxScore);
                  return (
                    <tr key={as.id} className="hover:bg-slate-50">
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-[#0F2A4A] block">{as.title}</span>
                        <span className="text-xs text-[#5B6B80]">{as.type}</span>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-[#5B6B80]">{grp?.name}</td>
                      <td className="py-3.5 px-4 tabular-nums text-xs">{as.date}</td>
                      <td className="py-3.5 px-4 tabular-nums font-bold">{as.maxScore}</td>
                      <td className="py-3.5 px-4 tabular-nums font-bold text-[#0F766E]">
                        {sum.average} / {as.maxScore}
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusChip
                          tone={as.status === 'graded' ? 'success' : 'warning'}
                          label={as.status === 'graded' ? 'مكتمل الرصد' : 'جاري الرصد'}
                        />
                      </td>
                      <td className="py-3.5 px-4 text-left">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setSelectedAssessmentId(as.id)}
                        >
                          رصد / النتائج
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Create Assessment Drawer */}
      <Drawer
        open={createDrawerOpen}
        onClose={() => setCreateDrawerOpen(false)}
        title="إنشاء تقييم جديد"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateDrawerOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={handleCreate}>إنشاء وبدء رصد الدرجات</Button>
          </>
        }
      >
        <form onSubmit={handleCreate} className="space-y-4">
          {formErr && (
            <div className="p-3 rounded-[8px] bg-[#FEE2E2] text-[#991B1B] text-xs font-bold">
              {formErr}
            </div>
          )}
          <Field label="عنوان الامتحان / التقييم" htmlFor="as-title" required>
            <TextInput
              id="as-title"
              placeholder="مثال: امتحان الشهر الأول - الكيمياء العضوية"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="النوع" htmlFor="as-type" required>
              <SelectInput
                id="as-type"
                value={type}
                onChange={(e) => setType(e.target.value as AssessmentType)}
              >
                <option value="امتحان">امتحان</option>
                <option value="كويز">كويز</option>
                <option value="واجب">واجب</option>
              </SelectInput>
            </Field>

            <Field label="النهاية العظمى" htmlFor="as-max" required>
              <TextInput
                id="as-max"
                type="number"
                min="5"
                value={maxScore}
                onChange={(e) => setMaxScore(e.target.value)}
                className="tabular-nums font-bold"
              />
            </Field>
          </div>

          <Field label="المجموعة" htmlFor="as-group" required>
            <SelectInput
              id="as-group"
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </SelectInput>
          </Field>

          <Field label="تاريخ التقييم" htmlFor="as-date" required>
            <TextInput
              id="as-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="tabular-nums"
            />
          </Field>
        </form>
      </Drawer>
    </div>
  );
};
