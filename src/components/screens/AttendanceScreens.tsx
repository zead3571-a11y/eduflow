import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  CalendarPlus,
  Check,
  CheckCheck,
  CheckCircle2,
  Copy,
  Edit3,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  MessageSquare,
  QrCode,
  ScanFace,
  Search,
} from 'lucide-react';
import { useEduflow } from '../../context/EduflowContext';
import {
  AttendanceEntry,
  AttendanceSession,
  AttendanceStatus,
  OutboxMessage,
  ScreenId,
} from '../../types/eduflow';
import { can, canAccessScreen } from '../../permissions/permissions';
import { Can } from '../../permissions/Can';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  InitialAvatar,
  ListStateSwitcher,
  Modal,
  SelectInput,
  StatusChip,
  TableSkeleton,
  TextInput,
} from '../ui/Primitives';
import { computeAttendanceStats } from '../../utils/eduflowLogic';
import {
  buildAttendanceHistoryPdf,
  buildSessionAttendancePdf,
} from '../../utils/pdfExportLogic';
import { parseStudentQrPayload } from '../../features/qr/qrService';
import {
  createDeterministicFaceHash,
  getActiveFaceTemplate,
  hasActiveBiometricConsent,
  verifyFaceAttendanceMatch,
} from '../../features/biometrics/faceAttendanceService';
import {
  buildAbsenceMessage,
  buildWhatsAppUrl,
} from '../../features/messaging/whatsappService';

// 10) Take Attendance Screen (Fast, 48px+ touch targets, QR, Face, Makeup)
export const TakeAttendanceScreen: React.FC = () => {
  const {
    currentActor,
    sessions,
    groups,
    rooms,
    students,
    centerSettings,
    consents,
    faceTemplates,
    selectedSessionId,
    setSelectedSessionId,
    saveAttendanceSession,
    createMakeupSession,
    markStudentAttendanceByMethod,
    showToast,
    navigate,
  } = useEduflow();

  const [sessionDate, setSessionDate] = useState('2026-11-12');
  const [search, setSearch] = useState('');
  const [entries, setEntries] = useState<AttendanceEntry[]>([]);
  const [readOnlySaved, setReadOnlySaved] = useState(false);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [openNoteStudentId, setOpenNoteStudentId] = useState<string | null>(null);
  const [noSessionsDemo, setNoSessionsDemo] = useState(false);

  // QR Scanner Modal (Phase 9)
  const [qrScanModalOpen, setQrScanModalOpen] = useState(false);
  const [qrInput, setQrInput] = useState('');
  const [qrScanStatus, setQrScanStatus] = useState<'present' | 'late'>('present');
  const [qrFeedback, setQrFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const qrVideoRef = useRef<HTMLVideoElement | null>(null);

  // Face Check-In Modal (Phase 10)
  const [faceModalOpen, setFaceModalOpen] = useState(false);
  const [faceStudentId, setFaceStudentId] = useState('');
  const [faceSignatureInput, setFaceSignatureInput] = useState('');
  const [faceMatchFeedback, setFaceMatchFeedback] = useState<{
    type: 'ok' | 'err';
    msg: string;
  } | null>(null);
  const faceVideoRef = useRef<HTMLVideoElement | null>(null);

  // Makeup Session Modal (Phase 6)
  const [makeupModalOpen, setMakeupModalOpen] = useState(false);
  const [makeupGroupId, setMakeupGroupId] = useState(groups[0]?.id || '');
  const [makeupOrigSessionId, setMakeupOrigSessionId] = useState('');
  const [makeupDate, setMakeupDate] = useState('2026-11-14');
  const [makeupTime, setMakeupTime] = useState('4:00 م');
  const [makeupRoomId, setMakeupRoomId] = useState(rooms[0]?.id || '');
  const [makeupStudentIds, setMakeupStudentIds] = useState<string[]>([]);

  const activeSession =
    sessions.find((s) => s.id === selectedSessionId) || sessions[0];
  const activeGroup = groups.find((g) => g.id === activeSession?.groupId);
  const canTakeSessionAttendance = activeSession
    ? can(currentActor, 'take_attendance', 'sessions', {
        groupId: activeSession.groupId,
        groups,
      })
    : can(currentActor, 'take_attendance', 'sessions');
  const effectiveReadOnly = readOnlySaved || !canTakeSessionAttendance;

  useEffect(() => {
    if (!activeSession) return;
    setSessionDate(activeSession.date);
    // Ensure all active students in the group appear in entries
    const groupRoster = students.filter(
      (s) => s.status === 'active' && s.groupIds.includes(activeSession.groupId)
    );
    const merged: AttendanceEntry[] = groupRoster.map((st) => {
      const existing = activeSession.entries.find((e) => e.studentId === st.id);
      return existing || { studentId: st.id, status: 'unrecorded' };
    });
    setEntries(merged);
    setReadOnlySaved(activeSession.status === 'recorded');
    setUnsavedChanges(false);
  }, [activeSession, students]);

  const stats = useMemo(() => computeAttendanceStats(entries), [entries]);

  const updateStudentStatus = (studentId: string, status: AttendanceStatus) => {
    if (readOnlySaved) return;
    setEntries((prev) =>
      prev.map((e) => (e.studentId === studentId ? { ...e, status } : e))
    );
    setUnsavedChanges(true);
  };

  const updateStudentNote = (studentId: string, note: string) => {
    if (readOnlySaved) return;
    setEntries((prev) =>
      prev.map((e) => (e.studentId === studentId ? { ...e, note } : e))
    );
    setUnsavedChanges(true);
  };

  const markAllPresent = () => {
    if (readOnlySaved) return;
    setEntries((prev) => prev.map((e) => ({ ...e, status: 'present' })));
    setUnsavedChanges(true);
  };

  const handleSave = () => {
    if (!activeSession) return;
    setSaving(true);
    setTimeout(() => {
      saveAttendanceSession(activeSession.id, entries);
      setSaving(false);
      setUnsavedChanges(false);
      navigate(ScreenId.ATTENDANCE_SUMMARY);
    }, 220);
  };

  useEffect(() => {
    if (!qrScanModalOpen) return;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: 'environment' } })
        .then((s) => {
          stream = s;
          if (qrVideoRef.current) qrVideoRef.current.srcObject = s;
          const Detector = (
            window as unknown as {
              BarcodeDetector?: new (opts?: { formats: string[] }) => {
                detect: (src: HTMLVideoElement) => Promise<{ rawValue?: string }[]>;
              };
            }
          ).BarcodeDetector;
          if (Detector && qrVideoRef.current) {
            const detector = new Detector({ formats: ['qr_code'] });
            timer = setInterval(async () => {
              try {
                if (!qrVideoRef.current) return;
                const found = await detector.detect(qrVideoRef.current);
                if (found[0]?.rawValue) {
                  setQrInput(found[0].rawValue);
                }
              } catch {
                // ignore frame read errors
              }
            }, 600);
          }
        })
        .catch(() => {
          // Camera permission unavailable — manual/barcode wedge input remains active
        });
    }
    return () => {
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [qrScanModalOpen]);

  useEffect(() => {
    if (!faceModalOpen) return;
    let stream: MediaStream | null = null;
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: 'user' } })
        .then((s) => {
          stream = s;
          if (faceVideoRef.current) faceVideoRef.current.srcObject = s;
        })
        .catch(() => {
          // Camera unavailable in headless tests
        });
    }
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [faceModalOpen]);

  const handleQrSubmit = (rawCode: string) => {
    if (!activeSession) return;
    const foundStudent = parseStudentQrPayload(rawCode, students);
    if (!foundStudent) {
      setQrFeedback({ type: 'err', msg: 'تعذر التعرف على كود الطالب. تأكد من الكود أو البطاقة.' });
      return;
    }
    const ok = markStudentAttendanceByMethod({
      sessionId: activeSession.id,
      studentId: foundStudent.id,
      status: qrScanStatus,
      method: 'qr',
      note: 'تحضير عبر QR',
    });
    if (ok) {
      setQrFeedback({
        type: 'ok',
        msg: `تم تحضير الطالب ${foundStudent.name} (${qrScanStatus === 'present' ? 'حاضر' : 'متأخر'}) عبر QR`,
      });
      setQrInput('');
    }
  };

  const handleFaceVerifySubmit = async () => {
    if (!activeSession) return;
    if (!centerSettings.biometricFaceEnabled) {
      setFaceMatchFeedback({
        type: 'err',
        msg: 'الحضور ببصمة الوجه مغلق حالياً. يجب تفعيله من المالك في الإعدادات.',
      });
      return;
    }
    const target = students.find((s) => s.id === faceStudentId);
    if (!target) {
      setFaceMatchFeedback({ type: 'err', msg: 'اختر طالباً أولاً.' });
      return;
    }
    const sig = faceSignatureInput.trim() || `face:${target.code}`;
    const capturedHash = await createDeterministicFaceHash(sig);
    const result = verifyFaceAttendanceMatch({
      student: target,
      consents,
      faceTemplates,
      capturedHash,
    });
    if (!result.matched) {
      setFaceMatchFeedback({
        type: 'err',
        msg: result.reason || 'لم تتطابق بصمة الوجه.',
      });
      return;
    }
    const ok = markStudentAttendanceByMethod({
      sessionId: activeSession.id,
      studentId: target.id,
      status: 'present',
      method: 'face',
      confidence: result.confidence,
      note: `تحضير بالوجه (${result.confidence}%)`,
    });
    if (ok) {
      setFaceMatchFeedback({
        type: 'ok',
        msg: `تم التحقق بنجاح (${result.confidence}%) وتحضر الطالب ${target.name}`,
      });
    }
  };

  const openMakeupCreator = () => {
    const gId = activeSession?.groupId || groups[0]?.id || '';
    const absentIds = (activeSession?.entries || [])
      .filter((e) => e.status === 'absent')
      .map((e) => e.studentId);
    setMakeupGroupId(gId);
    setMakeupOrigSessionId(activeSession?.id || '');
    setMakeupStudentIds(absentIds);
    setMakeupRoomId(activeGroup?.roomId || rooms[0]?.id || '');
    setMakeupModalOpen(true);
  };

  const visibleEntries = entries.filter((entry) => {
    const st = students.find((s) => s.id === entry.studentId);
    if (!st) return false;
    if (search.trim() && !st.name.includes(search.trim())) return false;
    return true;
  });

  return (
    <div className="space-y-4 pb-24">
      {/* Sub-navigation between Take Attendance & Attendance History */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 p-1 bg-white border border-[#E2E8F0] rounded-[8px]">
          <button
            type="button"
            className="px-3.5 py-2 rounded-[6px] text-xs font-bold bg-[#0F2A4A] text-white cursor-pointer"
          >
            تسجيل حضور الحصة
          </button>
          {canAccessScreen(currentActor, ScreenId.ATTENDANCE_HISTORY) && (
            <button
              type="button"
              onClick={() => navigate(ScreenId.ATTENDANCE_HISTORY)}
              className="px-3.5 py-2 rounded-[6px] text-xs font-bold text-[#5B6B80] hover:text-[#0F2A4A] cursor-pointer flex items-center gap-1.5"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>سجل الحضور السابق</span>
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setNoSessionsDemo((v) => !v)}
            className="text-xs font-semibold text-[#5B6B80] hover:text-[#0F2A4A] underline cursor-pointer"
          >
            {noSessionsDemo ? 'العودة لحصص اليوم' : 'معاينة حالة لا توجد حصص اليوم'}
          </button>
          {canTakeSessionAttendance && (
            <>
              <Button
                variant="secondary"
                size="sm"
                icon={<CalendarPlus className="w-4 h-4 text-[#0F766E]" />}
                onClick={openMakeupCreator}
              >
                حصة تعويضية
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={<QrCode className="w-4 h-4 text-[#0F2A4A]" />}
                onClick={() => {
                  setQrFeedback(null);
                  setQrScanModalOpen(true);
                }}
              >
                مسح QR
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={<ScanFace className="w-4 h-4 text-[#0F766E]" />}
                onClick={() => {
                  const firstSid = entries[0]?.studentId || students[0]?.id || '';
                  const firstSt = students.find((s) => s.id === firstSid);
                  setFaceStudentId(firstSid);
                  setFaceSignatureInput(firstSt ? `face:${firstSt.code}` : '');
                  setFaceMatchFeedback(null);
                  setFaceModalOpen(true);
                }}
              >
                بصمة الوجه
              </Button>
            </>
          )}
        </div>
      </div>

      {noSessionsDemo ? (
        <EmptyState
          title="لا توجد حصص مجدولة لهذا اليوم"
          description="جميع قاعات السنتر خالية حالياً. يمكنك مراجعة الجدول الأسبوعي أو سجل الحضور السابق."
          actionLabel="عرض الجدول الأسبوعي"
          onAction={() => navigate(ScreenId.SCHEDULE)}
        />
      ) : (
        <>
          {/* Group Select, Date & Session Time Chip */}
          <Card className="p-3.5 sm:p-4">
            <div className="grid grid-cols-12 gap-2.5 sm:gap-3 items-end">
              <div className="col-span-7 md:col-span-6">
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="att-session-select"
                    className="text-xs font-bold text-[#1E293B]"
                  >
                    المجموعة
                  </label>
                  <span className="md:hidden text-[10px] font-bold text-[#0F766E] tabular-nums">
                    {activeSession?.timeLabel || '5:00 م'}
                  </span>
                </div>
                <SelectInput
                  id="att-session-select"
                  value={activeSession?.id || ''}
                  onChange={(e) => setSelectedSessionId(e.target.value)}
                >
                  {sessions.map((s) => {
                    const g = groups.find((gr) => gr.id === s.groupId);
                    return (
                      <option key={s.id} value={s.id}>
                        {g?.name} — ({s.date}){s.type === 'makeup' ? ' [تعويضية]' : ''}
                      </option>
                    );
                  })}
                </SelectInput>
              </div>

              <div className="col-span-5 md:col-span-3">
                <label htmlFor="att-date" className="text-xs font-bold text-[#1E293B] block mb-1">
                  تاريخ الحصة
                </label>
                <TextInput
                  id="att-date"
                  type="date"
                  value={sessionDate}
                  onChange={(e) => setSessionDate(e.target.value)}
                  className="tabular-nums"
                />
              </div>

              <div className="hidden md:flex md:col-span-3 items-center justify-end gap-2 h-[44px]">
                {activeSession?.type === 'makeup' && (
                  <StatusChip tone="warning" label="حصة تعويضية" />
                )}
                <StatusChip
                  tone="navy"
                  label={`موعد الحصة: ${activeSession?.timeLabel || '5:00 م'}`}
                />
              </div>
            </div>
          </Card>

          {/* Already-Saved Read-Only Banner */}
          {readOnlySaved && (
            <div className="p-3.5 rounded-[10px] bg-[#D1FAE5] border border-emerald-300 text-[#065F46] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-bold">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>
                  تم حفظ حضور هذه الحصة مسبقاً ({activeSession?.savedAt || 'اليوم'}). الكشف للقراءة فقط حالياً.
                </span>
              </div>
              {canTakeSessionAttendance && (
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<Edit3 className="w-3.5 h-3.5" />}
                  onClick={() => setReadOnlySaved(false)}
                >
                  تعديل الحضور
                </Button>
              )}
            </div>
          )}

          {/* Sticky Live Counters Bar */}
          <div className="sticky top-16 z-10 bg-[#F4F7FA]/95 backdrop-blur-xs py-1.5">
            <div className="grid grid-cols-4 gap-2 sm:gap-3">
              <div className="bg-[#D1FAE5] text-[#065F46] rounded-[10px] px-2 py-2 text-center">
                <span className="text-base sm:text-lg font-bold tabular-nums block leading-none">
                  {stats.present}
                </span>
                <span className="text-[11px] font-bold mt-1 block">حاضر</span>
              </div>
              <div className="bg-[#FEF3C7] text-[#92400E] rounded-[10px] px-2 py-2 text-center">
                <span className="text-base sm:text-lg font-bold tabular-nums block leading-none">
                  {stats.late}
                </span>
                <span className="text-[11px] font-bold mt-1 block">متأخر</span>
              </div>
              <div className="bg-[#FEE2E2] text-[#991B1B] rounded-[10px] px-2 py-2 text-center">
                <span className="text-base sm:text-lg font-bold tabular-nums block leading-none">
                  {stats.absent}
                </span>
                <span className="text-[11px] font-bold mt-1 block">غائب</span>
              </div>
              <div className="bg-white border border-[#E2E8F0] text-[#5B6B80] rounded-[10px] px-2 py-2 text-center">
                <span className="text-base sm:text-lg font-bold tabular-nums block leading-none">
                  {stats.unrecorded}
                </span>
                <span className="text-[11px] font-bold mt-1 block">لم يُسجَّل</span>
              </div>
            </div>
          </div>

          {/* Search & Mark All Present (Single horizontal row on both Mobile & Desktop) */}
          <div className="flex items-center justify-between gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 text-[#5B6B80] absolute right-3.5 top-3.5 pointer-events-none" />
              <TextInput
                className="pr-10"
                placeholder="ابحث باسم الطالب..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button
              variant="secondary"
              disabled={effectiveReadOnly}
              onClick={markAllPresent}
              icon={<CheckCheck className="w-4 h-4 text-[#0F766E]" />}
            >
              الكل حاضر
            </Button>
          </div>

          {/* Roster List with Large 48px+ 3-Option Segmented Controls */}
          <Card padding="p-0" className="divide-y divide-[#E2E8F0] overflow-hidden">
            {visibleEntries.map((entry) => {
              const st = students.find((s) => s.id === entry.studentId);
              if (!st) return null;
              const noteExpanded = openNoteStudentId === st.id;

              return (
                <div key={st.id} className="p-3.5 sm:px-5 space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center justify-between sm:justify-start gap-3">
                      <div className="flex items-center gap-3">
                        <InitialAvatar name={st.name} size="sm" />
                        <div>
                          <p className="text-sm font-bold text-[#1E293B]">{st.name}</p>
                          <p className="text-[11px] text-[#5B6B80] tabular-nums">
                            ولي الأمر: {st.parentPhone}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        aria-label={`ملاحظة للطالب ${st.name}`}
                        onClick={() =>
                          setOpenNoteStudentId(noteExpanded ? null : st.id)
                        }
                        className={`w-10 h-10 rounded-[8px] border flex items-center justify-center cursor-pointer sm:mr-2 ${
                          entry.note
                            ? 'border-[#0F766E] bg-[#0F766E]/10 text-[#0F766E]'
                            : 'border-[#E2E8F0] text-[#5B6B80] hover:bg-slate-50'
                        }`}
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>
                    </div>

                    {/* 3-Option Segmented Control (min 48px touch height) */}
                    <div
                      role="group"
                      aria-label={`حالة حضور ${st.name}`}
                      className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-[10px] sm:w-80"
                    >
                      <button
                        type="button"
                        disabled={effectiveReadOnly}
                        onClick={() => updateStudentStatus(st.id, 'present')}
                        className={`min-h-[48px] rounded-[8px] text-xs font-bold transition-colors cursor-pointer disabled:cursor-not-allowed ${
                          entry.status === 'present'
                            ? 'bg-[#065F46] text-white shadow-xs'
                            : 'text-[#1E293B] hover:bg-white/70'
                        }`}
                      >
                        حاضر
                      </button>
                      <button
                        type="button"
                        disabled={effectiveReadOnly}
                        onClick={() => updateStudentStatus(st.id, 'late')}
                        className={`min-h-[48px] rounded-[8px] text-xs font-bold transition-colors cursor-pointer disabled:cursor-not-allowed ${
                          entry.status === 'late'
                            ? 'bg-[#D97706] text-white shadow-xs'
                            : 'text-[#1E293B] hover:bg-white/70'
                        }`}
                      >
                        متأخر
                      </button>
                      <button
                        type="button"
                        disabled={effectiveReadOnly}
                        onClick={() => updateStudentStatus(st.id, 'absent')}
                        className={`min-h-[48px] rounded-[8px] text-xs font-bold transition-colors cursor-pointer disabled:cursor-not-allowed ${
                          entry.status === 'absent'
                            ? 'bg-[#DC2626] text-white shadow-xs'
                            : 'text-[#1E293B] hover:bg-white/70'
                        }`}
                      >
                        غايب
                      </button>
                    </div>
                  </div>

                  {(noteExpanded || entry.note) && (
                    <div className="pt-1">
                      <TextInput
                        disabled={effectiveReadOnly}
                        placeholder="اكتب ملاحظة سريعة حول حضور الطالب (مثال: استأذن مبكراً)..."
                        value={entry.note || ''}
                        onChange={(e) => updateStudentNote(st.id, e.target.value)}
                        className="h-9 text-xs"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </Card>

          {/* Save Footer */}
          {!effectiveReadOnly && (
            <div className="lg:fixed lg:bottom-0 lg:left-0 lg:right-[220px] bg-white border lg:border-x-0 lg:border-b-0 border-[#E2E8F0] rounded-[12px] lg:rounded-none px-4 sm:px-6 py-3.5 z-20 shadow-xs lg:shadow-lg">
              <div className="max-w-[1200px] mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="text-xs text-[#5B6B80]">
                  {unsavedChanges ? (
                    <span className="font-bold text-[#92400E]">
                      • لديك تعديلات غير محفوظة —{' '}
                    </span>
                  ) : null}
                  <span>
                    سيتم تجهيز رسائل تنبيه لأولياء أمور الطلاب الغائبين (
                    {stats.absent === 1 ? 'طالب واحد' : `${stats.absent} طلاب`}).
                  </span>
                </div>
                <Button onClick={handleSave} loading={saving} className="w-full sm:w-auto">
                  حفظ وتجهيز تنبيه أولياء الأمور
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* QR Scanner Check-in Modal (Phase 9) */}
      <Modal
        open={qrScanModalOpen}
        onClose={() => setQrScanModalOpen(false)}
        title="تسجيل الحضور بمسح بطاقة الطالب QR"
        footer={
          <Button variant="secondary" onClick={() => setQrScanModalOpen(false)}>
            إغلاق
          </Button>
        }
      >
        <div className="space-y-4">
          <div className="aspect-video bg-[#0F2A4A] rounded-[10px] overflow-hidden relative flex items-center justify-center">
            <video
              ref={qrVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/60 text-white text-[11px]">
              الكاميرا / ماسح الباركود جاهز
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 items-end">
            <div className="col-span-2">
              <Field label="كود الطالب أو محتوى QR" htmlFor="qr-code-input">
                <TextInput
                  id="qr-code-input"
                  dir="ltr"
                  className="text-right tabular-nums"
                  placeholder="S-000101 أو EDUFLOW:STUDENT:..."
                  value={qrInput}
                  onChange={(e) => setQrInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleQrSubmit(qrInput);
                    }
                  }}
                />
              </Field>
            </div>
            <Field label="الحالة" htmlFor="qr-status-sel">
              <SelectInput
                id="qr-status-sel"
                value={qrScanStatus}
                onChange={(e) => setQrScanStatus(e.target.value as 'present' | 'late')}
              >
                <option value="present">حاضر</option>
                <option value="late">متأخر</option>
              </SelectInput>
            </Field>
          </div>

          <Button className="w-full" onClick={() => handleQrSubmit(qrInput)}>
            تحضير الطالب بالكود
          </Button>

          {qrFeedback && (
            <div
              className={`p-3 rounded-[8px] text-xs font-bold ${
                qrFeedback.type === 'ok'
                  ? 'bg-[#D1FAE5] text-[#065F46]'
                  : 'bg-[#FEE2E2] text-[#991B1B]'
              }`}
            >
              {qrFeedback.msg}
            </div>
          )}

          {/* Quick Clickable Roster Codes */}
          <div className="border-t border-[#E2E8F0] pt-3 space-y-2">
            <span className="text-xs font-bold text-[#5B6B80] block">
              تحضير سريع من طلاب المجموعة ({entries.length}):
            </span>
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
              {entries.map((e) => {
                const st = students.find((s) => s.id === e.studentId);
                if (!st) return null;
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => handleQrSubmit(st.code)}
                    className="px-2.5 py-1.5 rounded-[6px] bg-slate-100 hover:bg-[#0F766E] hover:text-white text-xs font-semibold cursor-pointer tabular-nums"
                  >
                    {st.name} ({st.code})
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Modal>

      {/* Face Attendance Verification Modal (Phase 10) */}
      <Modal
        open={faceModalOpen}
        onClose={() => setFaceModalOpen(false)}
        title="تسجيل الحضور ببصمة الوجه"
        footer={
          <Button variant="secondary" onClick={() => setFaceModalOpen(false)}>
            إغلاق
          </Button>
        }
      >
        <div className="space-y-4">
          {!centerSettings.biometricFaceEnabled && (
            <div className="p-3 rounded-[8px] bg-[#FEF3C7] text-[#92400E] text-xs font-bold">
              ميزة بصمة الوجه مغلقة من المالك في الإعدادات &gt; البيانات. يجب تفعيلها أولاً.
            </div>
          )}

          <div className="aspect-video bg-[#0F2A4A] rounded-[10px] overflow-hidden relative flex items-center justify-center">
            <video
              ref={faceVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/60 text-white text-[11px]">
              التقاط بصمة الوجه
            </span>
          </div>

          <Field label="الطالب المطلوب التحقق منه" htmlFor="face-student-select">
            <SelectInput
              id="face-student-select"
              value={faceStudentId}
              onChange={(e) => {
                const sid = e.target.value;
                setFaceStudentId(sid);
                const st = students.find((s) => s.id === sid);
                setFaceSignatureInput(st ? `face:${st.code}` : '');
                setFaceMatchFeedback(null);
              }}
            >
              {students
                .filter((s) => s.status === 'active')
                .map((st) => {
                  const hasC = hasActiveBiometricConsent(consents, st.id);
                  const hasTpl = Boolean(getActiveFaceTemplate(faceTemplates, st.id));
                  return (
                    <option key={st.id} value={st.id}>
                      {st.name} ({st.code}) — {hasC && hasTpl ? 'جاهز للبصمة' : 'بدون موافقة/بصمة'}
                    </option>
                  );
                })}
            </SelectInput>
          </Field>

          <Field label="توقيع العيّنة الملتقطة" htmlFor="face-sig-input">
            <TextInput
              id="face-sig-input"
              dir="ltr"
              className="text-right tabular-nums text-xs"
              value={faceSignatureInput}
              onChange={(e) => setFaceSignatureInput(e.target.value)}
            />
          </Field>

          <Button
            className="w-full"
            disabled={!centerSettings.biometricFaceEnabled}
            onClick={handleFaceVerifySubmit}
          >
            مطابقة البصمة وتسجيل الحضور
          </Button>

          {faceMatchFeedback && (
            <div
              className={`p-3 rounded-[8px] text-xs font-bold ${
                faceMatchFeedback.type === 'ok'
                  ? 'bg-[#D1FAE5] text-[#065F46]'
                  : 'bg-[#FEE2E2] text-[#991B1B]'
              }`}
            >
              {faceMatchFeedback.msg}
            </div>
          )}
        </div>
      </Modal>

      {/* Create Makeup Session Modal (Phase 6) */}
      <Modal
        open={makeupModalOpen}
        onClose={() => setMakeupModalOpen(false)}
        title="إنشاء حصة تعويضية للغائبين"
        footer={
          <>
            <Button variant="secondary" onClick={() => setMakeupModalOpen(false)}>
              إلغاء
            </Button>
            <Button
              onClick={() => {
                if (!makeupGroupId || makeupStudentIds.length === 0) {
                  showToast('اختر المجموعة وطالباً واحداً على الأقل للحصة التعويضية', 'error');
                  return;
                }
                createMakeupSession({
                  groupId: makeupGroupId,
                  date: makeupDate,
                  timeLabel: makeupTime,
                  roomId: makeupRoomId,
                  originalSessionId: makeupOrigSessionId || undefined,
                  studentIds: makeupStudentIds,
                });
                setMakeupModalOpen(false);
              }}
            >
              إنشاء الحصة التعويضية
            </Button>
          </>
        }
      >
        <div className="space-y-3.5">
          <Field label="المجموعة" htmlFor="mk-grp">
            <SelectInput
              id="mk-grp"
              value={makeupGroupId}
              onChange={(e) => setMakeupGroupId(e.target.value)}
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </SelectInput>
          </Field>

          <Field label="الحصة الأصلية المرتبطة (اختياري)" htmlFor="mk-orig">
            <SelectInput
              id="mk-orig"
              value={makeupOrigSessionId}
              onChange={(e) => setMakeupOrigSessionId(e.target.value)}
            >
              <option value="">بدون ربط بحصة محددة</option>
              {sessions
                .filter((s) => s.groupId === makeupGroupId && s.type !== 'makeup')
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    حصة {s.date} ({s.timeLabel})
                  </option>
                ))}
            </SelectInput>
          </Field>

          <div className="grid grid-cols-3 gap-2">
            <Field label="التاريخ" htmlFor="mk-date">
              <TextInput
                id="mk-date"
                type="date"
                value={makeupDate}
                onChange={(e) => setMakeupDate(e.target.value)}
                className="tabular-nums"
              />
            </Field>
            <Field label="التوقيت" htmlFor="mk-time">
              <TextInput
                id="mk-time"
                value={makeupTime}
                onChange={(e) => setMakeupTime(e.target.value)}
              />
            </Field>
            <Field label="القاعة" htmlFor="mk-room">
              <SelectInput
                id="mk-room"
                value={makeupRoomId}
                onChange={(e) => setMakeupRoomId(e.target.value)}
              >
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </SelectInput>
            </Field>
          </div>

          <Field label={`الطلاب المدعوون للتعويض (${makeupStudentIds.length})`}>
            <div className="border border-[#E2E8F0] rounded-[8px] divide-y divide-[#E2E8F0] max-h-40 overflow-y-auto">
              {students
                .filter((s) => s.status === 'active' && s.groupIds.includes(makeupGroupId))
                .map((st) => {
                  const checked = makeupStudentIds.includes(st.id);
                  return (
                    <label
                      key={st.id}
                      className="flex items-center justify-between px-3 py-2 text-xs cursor-pointer"
                    >
                      <span>{st.name}</span>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setMakeupStudentIds((prev) =>
                            checked ? prev.filter((id) => id !== st.id) : [...prev, st.id]
                          )
                        }
                        className="w-4 h-4 accent-[#0F766E]"
                      />
                    </label>
                  );
                })}
            </div>
          </Field>
        </div>
      </Modal>
    </div>
  );
};

// 11a) Post-Save Attendance Summary Screen
export const AttendanceSummaryScreen: React.FC = () => {
  const {
    lastSavedSessionId,
    sessions,
    groups,
    teachers,
    students,
    templates,
    attendanceRecords,
    centerSettings,
    queueWhatsAppMessages,
    markOutboxMessageSent,
    compensateAbsentStudent,
    openPdfExport,
    showToast,
    navigate,
  } = useEduflow();

  const [bulkQueue, setBulkQueue] = useState<{ msg: OutboxMessage; studentId: string }[]>([]);
  const [singleModalStudentId, setSingleModalStudentId] = useState<string | null>(null);
  const [compensateStudentId, setCompensateStudentId] = useState<string | null>(null);
  const [selectedMakeupId, setSelectedMakeupId] = useState('');

  const session =
    sessions.find((s) => s.id === lastSavedSessionId) || sessions[0];
  const group = groups.find((g) => g.id === session?.groupId);
  const teacher = teachers.find((t) => t.id === group?.teacherId);
  const stats = computeAttendanceStats(session?.entries || []);
  const absentEntries = (session?.entries || []).filter((e) => e.status === 'absent');
  const absenceTemplate =
    templates.find((t) => t.id === 'absence')?.body ||
    'نود إبلاغكم بتغيب الطالب {اسم_الطالب} عن حصة {المجموعة} بتاريخ {التاريخ}.';
  const makeupSessionsForGroup = sessions.filter(
    (s) => s.type === 'makeup' && s.groupId === session?.groupId
  );

  const openBulkAlerts = () => {
    if (!session || absentEntries.length === 0) return;
    const items = absentEntries
      .map((entry) => {
        const st = students.find((s) => s.id === entry.studentId);
        if (!st) return null;
        return {
          studentId: st.id,
          recipientName: st.parentName,
          recipientPhone: st.parentPhone,
          templateId: 'absence',
          body: buildAbsenceMessage(absenceTemplate, { student: st, group, session }),
          sessionId: session.id,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    const created = queueWhatsAppMessages(items);
    setBulkQueue(
      created.map((msg, idx) => ({ msg, studentId: items[idx]?.studentId || '' }))
    );
    showToast(`تم تجهيز ${created.length} رسالة غياب لإرسالها عبر واتساب`);
  };

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold text-[#0F2A4A]">
            تم حفظ حضور الحصة بنجاح
          </h2>
          <p className="text-xs text-[#5B6B80] mt-0.5">
            {group?.name} · التاريخ: {session?.date}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {session && (
            <Button
              size="sm"
              icon={<FileText className="w-4 h-4" />}
              onClick={() =>
                openPdfExport(
                  buildSessionAttendancePdf({
                    centerSettings,
                    session,
                    group,
                    teacher,
                    students,
                  })
                )
              }
            >
              تصدير ملخص الحصة PDF
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={() => navigate(ScreenId.DASHBOARD)}>
            العودة للرئيسية
          </Button>
        </div>
      </div>

      {/* Result Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 text-center bg-[#D1FAE5]/40 border-emerald-200">
          <span className="text-2xl font-bold text-[#065F46] tabular-nums block">
            {stats.present}
          </span>
          <span className="text-xs font-bold text-[#065F46]">حاضر</span>
        </Card>
        <Card className="p-4 text-center bg-[#FEF3C7]/50 border-amber-200">
          <span className="text-2xl font-bold text-[#92400E] tabular-nums block">
            {stats.late}
          </span>
          <span className="text-xs font-bold text-[#92400E]">متأخر</span>
        </Card>
        <Card className="p-4 text-center bg-[#FEE2E2]/50 border-red-200">
          <span className="text-2xl font-bold text-[#991B1B] tabular-nums block">
            {stats.absent}
          </span>
          <span className="text-xs font-bold text-[#991B1B]">غائب</span>
        </Card>
      </div>

      {/* Absent Students & Prepared Parent Messages */}
      <Card padding="p-0" className="overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E2E8F0] flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-[#0F2A4A]">
              تنبيهات الغياب لأولياء الأمور ({absentEntries.length})
            </h3>
            <p className="text-xs text-[#5B6B80]">
              تم تجهيز نص الرسالة تلقائياً لكل طالب غائب وفق قالب السنتر
            </p>
          </div>
          <Button
            size="sm"
            disabled={absentEntries.length === 0}
            onClick={openBulkAlerts}
          >
            إرسال التنبيهات للكل عبر واتساب
          </Button>
        </div>

        {absentEntries.length === 0 ? (
          <div className="p-8 text-center text-sm font-semibold text-[#065F46]">
            لا يوجد أي طلاب غائبين في هذه الحصة — حضور كامل!
          </div>
        ) : (
          <div className="divide-y divide-[#E2E8F0]">
            {absentEntries.map((entry) => {
              const st = students.find((s) => s.id === entry.studentId);
              if (!st) return null;
              const msgStatus = entry.messageStatus || 'ready';
              const rec = attendanceRecords.find(
                (r) => r.sessionId === session?.id && r.studentId === st.id
              );
              return (
                <div
                  key={entry.studentId}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <p className="text-sm font-bold text-[#1E293B]">{st.name}</p>
                    <p className="text-xs text-[#5B6B80] tabular-nums">
                      هاتف ولي الأمر: {st.parentPhone} ({st.parentName})
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {rec?.compensatedBy && (
                      <StatusChip tone="success" label="تم التعويض" />
                    )}
                    {msgStatus === 'ready' && (
                      <StatusChip tone="warning" label="رسالة جاهزة" />
                    )}
                    {msgStatus === 'sent' && (
                      <StatusChip tone="success" label="تم الإرسال" />
                    )}
                    {msgStatus === 'failed' && (
                      <StatusChip tone="danger" label="فشل الإرسال" />
                    )}
                    {!rec?.compensatedBy && makeupSessionsForGroup.length > 0 && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setCompensateStudentId(st.id);
                          setSelectedMakeupId(makeupSessionsForGroup[0]?.id || '');
                        }}
                      >
                        تعويض غياب
                      </Button>
                    )}
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setSingleModalStudentId(st.id)}
                    >
                      إرسال التنبيه
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Single Student WhatsApp Alert Modal */}
      <Modal
        open={Boolean(singleModalStudentId)}
        onClose={() => setSingleModalStudentId(null)}
        title="إرسال تنبيه غياب لولي الأمر"
        footer={
          singleModalStudentId &&
          session &&
          (() => {
            const st = students.find((s) => s.id === singleModalStudentId);
            if (!st) return null;
            const body = buildAbsenceMessage(absenceTemplate, { student: st, group, session });
            return (
              <>
                <Button variant="secondary" onClick={() => setSingleModalStudentId(null)}>
                  إغلاق
                </Button>
                <a
                  href={buildWhatsAppUrl(st.parentPhone, body)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    const [queued] = queueWhatsAppMessages([
                      {
                        studentId: st.id,
                        recipientName: st.parentName,
                        recipientPhone: st.parentPhone,
                        templateId: 'absence',
                        body,
                        sessionId: session.id,
                      },
                    ]);
                    if (queued) {
                      markOutboxMessageSent(queued.id, {
                        sessionId: session.id,
                        studentId: st.id,
                      });
                    }
                    setSingleModalStudentId(null);
                  }}
                  className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-[8px] bg-[#0F766E] text-white text-sm font-bold"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>فتح واتساب وإرسال</span>
                </a>
              </>
            );
          })()
        }
      >
        {singleModalStudentId &&
          session &&
          (() => {
            const st = students.find((s) => s.id === singleModalStudentId);
            if (!st) return null;
            const body = buildAbsenceMessage(absenceTemplate, { student: st, group, session });
            return (
              <div className="space-y-3">
                <p className="text-xs text-[#5B6B80] tabular-nums">
                  إلى: <strong>{st.parentName}</strong> ({st.parentPhone})
                </p>
                <div className="p-3.5 rounded-[10px] bg-[#F4F7FA] border border-[#E2E8F0] text-sm">
                  {body}
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<Copy className="w-3.5 h-3.5" />}
                  onClick={() => {
                    navigator.clipboard?.writeText(body);
                    showToast('تم نسخ رسالة الغياب للحافظة');
                  }}
                >
                  نسخ نص الرسالة
                </Button>
              </div>
            );
          })()}
      </Modal>

      {/* Bulk WhatsApp Absence Queue Modal */}
      <Modal
        open={bulkQueue.length > 0}
        onClose={() => setBulkQueue([])}
        title={`تنبيهات الغياب الجماعية عبر واتساب (${bulkQueue.length})`}
        maxWidth="max-w-2xl"
        footer={<Button onClick={() => setBulkQueue([])}>إغلاق</Button>}
      >
        <div className="divide-y divide-[#E2E8F0] border border-[#E2E8F0] rounded-[10px] max-h-96 overflow-y-auto">
          {bulkQueue.map(({ msg, studentId }) => (
            <div key={msg.id} className="p-3.5 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-bold text-[#0F2A4A]">{msg.recipientName}</span>
                  <span className="text-xs text-[#5B6B80] mr-2 tabular-nums">
                    {msg.recipientPhone}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
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
                    onClick={() => {
                      if (session) {
                        markOutboxMessageSent(msg.id, { sessionId: session.id, studentId });
                      }
                      setBulkQueue((prev) =>
                        prev.map((x) =>
                          x.msg.id === msg.id ? { ...x, msg: { ...x.msg, status: 'sent' } } : x
                        )
                      );
                    }}
                    className="inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-[8px] bg-[#0F766E] text-white text-xs font-bold"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>{msg.status === 'sent' ? 'تم الفتح' : 'فتح واتساب'}</span>
                  </a>
                  {msg.status !== 'sent' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Check className="w-3.5 h-3.5 text-[#065F46]" />}
                      onClick={() => {
                        if (session) {
                          markOutboxMessageSent(msg.id, { sessionId: session.id, studentId });
                        }
                        setBulkQueue((prev) =>
                          prev.map((x) =>
                            x.msg.id === msg.id ? { ...x, msg: { ...x.msg, status: 'sent' } } : x
                          )
                        );
                      }}
                    >
                      تحديد كمُرسَل
                    </Button>
                  )}
                </div>
              </div>
              <p className="text-xs text-[#5B6B80] bg-[#F4F7FA] p-2 rounded-[6px]">{msg.body}</p>
            </div>
          ))}
        </div>
      </Modal>

      {/* Compensate Absent Student Modal */}
      <Modal
        open={Boolean(compensateStudentId)}
        onClose={() => setCompensateStudentId(null)}
        title="تسجيل تعويض غياب في حصة تعويضية"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCompensateStudentId(null)}>
              إلغاء
            </Button>
            <Button
              disabled={!selectedMakeupId}
              onClick={() => {
                if (!session || !compensateStudentId || !selectedMakeupId) return;
                compensateAbsentStudent({
                  originalSessionId: session.id,
                  studentId: compensateStudentId,
                  makeupSessionId: selectedMakeupId,
                });
                setCompensateStudentId(null);
              }}
            >
              تأكيد التعويض
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="اختر الحصة التعويضية" htmlFor="comp-mk-sel">
            <SelectInput
              id="comp-mk-sel"
              value={selectedMakeupId}
              onChange={(e) => setSelectedMakeupId(e.target.value)}
            >
              {makeupSessionsForGroup.map((m) => (
                <option key={m.id} value={m.id}>
                  حصة تعويضية {m.date} ({m.timeLabel})
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>
      </Modal>
    </div>
  );
};

// 11b) Attendance History Screen
export const AttendanceHistoryScreen: React.FC = () => {
  const {
    sessions,
    groups,
    teachers,
    students,
    attendanceRecords,
    centerSettings,
    openPdfExport,
    listStateMode,
    setListStateMode,
    navigate,
  } = useEduflow();

  const [groupFilter, setGroupFilter] = useState('all');
  const [studentFilter, setStudentFilter] = useState('all');
  const [fromDate, setFromDate] = useState('2026-11-01');
  const [toDate, setToDate] = useState('2026-11-30');
  const [detailSession, setDetailSession] = useState<AttendanceSession | null>(null);

  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      if (groupFilter !== 'all' && s.groupId !== groupFilter) return false;
      if (studentFilter !== 'all' && !s.entries.some((e) => e.studentId === studentFilter))
        return false;
      if (fromDate && s.date < fromDate) return false;
      if (toDate && s.date > toDate) return false;
      return true;
    });
  }, [sessions, groupFilter, studentFilter, fromDate, toDate]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate(ScreenId.TAKE_ATTENDANCE)}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#5B6B80] hover:text-[#0F2A4A] cursor-pointer"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة لتسجيل حضور اليوم</span>
        </button>

        <div className="flex items-center gap-2">
          <ListStateSwitcher mode={listStateMode} onChange={setListStateMode} />
          <Can action="export" resource="attendanceRecords">
            <Button
              size="sm"
              icon={<FileText className="w-4 h-4" />}
              onClick={() =>
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
                    studentFilter,
                  })
                )
              }
            >
              تصدير سجل الحضور PDF
            </Button>
          </Can>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <SelectInput
          aria-label="تصفية بالمجموعة"
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
          aria-label="تصفية بالطالب"
          value={studentFilter}
          onChange={(e) => setStudentFilter(e.target.value)}
        >
          <option value="all">كل الطلاب</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </SelectInput>

        <TextInput
          type="date"
          aria-label="من تاريخ"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="tabular-nums"
        />

        <TextInput
          type="date"
          aria-label="إلى تاريخ"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="tabular-nums"
        />
      </Card>

      {listStateMode === 'loading' ? (
        <TableSkeleton rows={5} />
      ) : listStateMode === 'error' ? (
        <ErrorState onRetry={() => setListStateMode('ready')} />
      ) : listStateMode === 'empty' || filteredSessions.length === 0 ? (
        <EmptyState
          title="لا توجد حصص مسجلة في هذه الفترة"
          description="جرّب توسيع النطاق الزمني أو اختيار مجموعة أخرى."
        />
      ) : (
        <Card padding="p-0" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-[#E2E8F0] text-xs font-bold text-[#5B6B80]">
                  <th className="py-3.5 px-4">التاريخ</th>
                  <th className="py-3.5 px-4">المجموعة</th>
                  <th className="py-3.5 px-4">المدرس</th>
                  <th className="py-3.5 px-4">الحاضرون</th>
                  <th className="py-3.5 px-4">الغائبون</th>
                  <th className="py-3.5 px-4 text-left">كشف الحصة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] text-sm">
                {filteredSessions.map((sess) => {
                  const grp = groups.find((g) => g.id === sess.groupId);
                  const tch = teachers.find((t) => t.id === grp?.teacherId);
                  const st = computeAttendanceStats(sess.entries);
                  return (
                    <tr
                      key={sess.id}
                      onClick={() => setDetailSession(sess)}
                      className="hover:bg-slate-50 cursor-pointer"
                    >
                      <td className="py-3.5 px-4 tabular-nums font-semibold">
                        <span>{sess.date}</span>
                        {sess.type === 'makeup' && (
                          <span className="mr-1.5 px-1.5 py-0.5 rounded bg-[#E0F2FE] text-[#075985] text-[10px] font-bold">
                            تعويضية
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-[#0F2A4A]">{grp?.name}</td>
                      <td className="py-3.5 px-4 text-[#5B6B80]">{tch?.name}</td>
                      <td className="py-3.5 px-4">
                        <StatusChip
                          tone="success"
                          label={`${st.present + st.late} حاضر`}
                        />
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusChip tone="danger" label={`${st.absent} غائب`} />
                      </td>
                      <td className="py-3.5 px-4 text-left">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDetailSession(sess);
                          }}
                        >
                          عرض الكشف
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

      {/* Session Roster Detail Modal */}
      <Modal
        open={Boolean(detailSession)}
        onClose={() => setDetailSession(null)}
        title="كشف حضور الحصة التفصيلي"
        footer={
          <>
            {detailSession && (
              <Button
                variant="secondary"
                icon={<FileText className="w-4 h-4 text-[#0F766E]" />}
                onClick={() => {
                  const grp = groups.find((g) => g.id === detailSession.groupId);
                  const tch = teachers.find((t) => t.id === grp?.teacherId);
                  openPdfExport(
                    buildSessionAttendancePdf({
                      centerSettings,
                      session: detailSession,
                      group: grp,
                      teacher: tch,
                      students,
                    })
                  );
                }}
              >
                تصدير كشف الحصة PDF
              </Button>
            )}
            <Button onClick={() => setDetailSession(null)}>إغلاق</Button>
          </>
        }
      >
        {detailSession && (
          <div className="space-y-3">
            <p className="text-xs text-[#5B6B80] tabular-nums">
              التاريخ: {detailSession.date} · التوقيت: {detailSession.timeLabel}
            </p>
            <div className="divide-y divide-[#E2E8F0] border border-[#E2E8F0] rounded-[8px]">
              {detailSession.entries.map((entry) => {
                const st = students.find((s) => s.id === entry.studentId);
                const rec = attendanceRecords.find(
                  (r) => r.sessionId === detailSession.id && r.studentId === entry.studentId
                );
                return (
                  <div
                    key={entry.studentId}
                    className="px-3.5 py-2.5 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-[#1E293B] block">{st?.name}</span>
                      {(entry.note || rec?.note) && (
                        <span className="text-[#5B6B80] text-[11px]">{entry.note || rec?.note}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {rec?.method === 'qr' && <StatusChip tone="navy" label="QR" />}
                      {rec?.method === 'face' && (
                        <StatusChip tone="navy" label={`بصمة ${rec.confidence || 97}%`} />
                      )}
                      {rec?.compensatedBy && <StatusChip tone="success" label="تم التعويض" />}
                      {entry.status === 'present' && <StatusChip tone="success" label="حاضر" />}
                      {entry.status === 'late' && <StatusChip tone="warning" label="متأخر" />}
                      {entry.status === 'absent' && <StatusChip tone="danger" label="غائب" />}
                      {entry.status === 'unrecorded' && (
                        <StatusChip tone="neutral" label="لم يُسجّل" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
