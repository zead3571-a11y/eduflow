import React, { useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  Database,
  Download,
  History,
  KeyRound,
  Lock,
  Plus,
  Printer,
  Receipt,
  RotateCcw,
  ScanFace,
  Shield,
  Smartphone,
  Trash2,
  Upload,
  UserPlus,
  X,
} from 'lucide-react';
import { useEduflow } from '../../context/EduflowContext';
import { CenterSettings, MessageTemplate, ScreenId, UserRole } from '../../types/eduflow';
import { can, canAccessScreen } from '../../permissions/permissions';
import {
  Button,
  Card,
  Drawer,
  Field,
  Modal,
  SelectInput,
  StatusChip,
  TextInput,
} from '../ui/Primitives';
import {
  BILLING_HISTORY,
  SUBSCRIPTION_PLANS,
  getPlanConfig,
  isPlanFeatureEnabled,
} from '../../data/seedData';
import { formatEGP, interpolateTemplate } from '../../utils/eduflowLogic';

// 19) Settings Screen (6 Secondary Tabs + Sticky Save Bar + Unsaved Warning + Data Backup/Restore)
export const SettingsScreen: React.FC = () => {
  const {
    authSession,
    currentActor,
    demoMode,
    setDemoMode,
    centerSettings,
    updateCenterSettings,
    users,
    inviteUser,
    rooms,
    addRoom,
    deleteRoom,
    stages,
    addStage,
    deleteStage,
    templates,
    updateTemplate,
    activityLog,
    students,
    studentAccounts,
    studentSessions,
    studentPortalAvailable,
    invoices,
    payments,
    exportBackupJson,
    validateBackupJson,
    importBackupJson,
    resetDemoData,
    changeMyPassword,
    navigate,
    showToast,
  } = useEduflow();

  const [tab, setTab] = useState<
    'center' | 'users' | 'rooms' | 'templates' | 'receipts' | 'studentPortal' | 'data' | 'account'
  >('center');
  const [pendingTab, setPendingTab] = useState<typeof tab | null>(null);

  const canEnableBiometrics = can(currentActor, 'enable_biometrics', 'biometrics');

  const allowedTabs = (
    [
      { id: 'center', label: 'بيانات السنتر', allowed: can(currentActor, 'update', 'settings') },
      { id: 'users', label: 'المستخدمون والصلاحيات', allowed: can(currentActor, 'view', 'users') },
      { id: 'rooms', label: 'القاعات والمراحل', allowed: can(currentActor, 'update', 'rooms') },
      { id: 'templates', label: 'قوالب الرسائل', allowed: can(currentActor, 'update', 'messageTemplates') },
      {
        id: 'receipts',
        label: 'تنسيق الإيصال',
        allowed: can(currentActor, 'update', 'receiptSettings'),
      },
      {
        id: 'studentPortal',
        label: 'منصة الطالب',
        allowed: can(currentActor, 'update', 'settings'),
      },
      { id: 'data', label: 'البيانات', allowed: can(currentActor, 'manage_backup', 'backup') },
      { id: 'account', label: 'حسابي', allowed: true },
    ] as const
  ).filter((item) => item.allowed);

  const activeTab = allowedTabs.some((t) => t.id === tab)
    ? tab
    : allowedTabs[0]?.id || 'account';

  const [maxDevicesInput, setMaxDevicesInput] = useState(
    String(centerSettings.studentMaxDevices ?? 2)
  );
  const [sessionDaysInput, setSessionDaysInput] = useState(
    String(centerSettings.studentSessionDays ?? 7)
  );

  // Tab 1: Center Info + Discount Policy + Settlement Basis
  const [cName, setCName] = useState(centerSettings.name);
  const [cPhone, setCPhone] = useState(centerSettings.phone);
  const [cAddress, setCAddress] = useState(centerSettings.address);
  const [logoName, setLogoName] = useState('شعار_النخبة.svg');
  const [siblingEnabled, setSiblingEnabled] = useState(
    centerSettings.discountPolicy?.siblingEnabled ?? true
  );
  const [secondChildPct, setSecondChildPct] = useState(
    String(centerSettings.discountPolicy?.secondChildPercent ?? 10)
  );
  const [thirdChildPct, setThirdChildPct] = useState(
    String(centerSettings.discountPolicy?.thirdPlusChildPercent ?? 20)
  );
  const [settlementBasis, setSettlementBasis] = useState<'cash' | 'invoiced'>(
    centerSettings.settlementBasis || 'cash'
  );
  const [dirty, setDirty] = useState(false);

  // Receipt Settings tab (Phase 7)
  const [rcHeaderNote, setRcHeaderNote] = useState(
    centerSettings.receiptSettings?.headerNote || ''
  );
  const [rcFooterNote, setRcFooterNote] = useState(
    centerSettings.receiptSettings?.footerNote || ''
  );
  const [rcDefaultFormat, setRcDefaultFormat] = useState<'a5' | 'thermal80'>(
    centerSettings.receiptSettings?.defaultFormat || 'a5'
  );

  // Tab 2: Invite user drawer
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invName, setInvName] = useState('');
  const [invEmail, setInvEmail] = useState('');
  const [invPhone, setInvPhone] = useState('');
  const [invRole, setInvRole] = useState<UserRole>(UserRole.RECEPTIONIST);

  // Tab 3: Rooms & Stages inline add + delete confirm
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomCap, setNewRoomCap] = useState('40');
  const [newStageName, setNewStageName] = useState('');
  const [deleteRoomConfirmId, setDeleteRoomConfirmId] = useState<string | null>(null);

  // Tab 4: Message Templates
  const [selectedTplId, setSelectedTplId] = useState<MessageTemplate['id']>('absence');
  const currentTpl = templates.find((t) => t.id === selectedTplId) || templates[0];
  const [tplBody, setTplBody] = useState(currentTpl.body);

  // Tab 5: Data Backup, Restore & Double-Confirm Reset
  const [backupError, setBackupError] = useState('');
  const [pendingRestore, setPendingRestore] = useState<{
    fileName: string;
    rawPayload: unknown;
    summary: { students: number; teachers: number; groups: number; invoices: number; payments: number };
  } | null>(null);
  const [resetModalStep, setResetModalStep] = useState<0 | 1 | 2>(0);
  const [resetConfirmPhrase, setResetConfirmPhrase] = useState('');

  // Tab 6: Account
  const [myName, setMyName] = useState(authSession?.name || 'أ. محمود عبد الرحمن');
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [accountError, setAccountError] = useState('');

  const switchTab = (next: typeof tab) => {
    if (dirty) {
      setPendingTab(next);
      return;
    }
    setTab(next);
  };

  const selectTemplate = (id: MessageTemplate['id']) => {
    setSelectedTplId(id);
    const found = templates.find((t) => t.id === id);
    if (found) setTplBody(found.body);
  };

  const insertVariable = (varToken: string) => {
    setTplBody((prev) => `${prev} {${varToken}}`);
  };

  const handleDownloadBackup = () => {
    const payload = exportBackupJson();
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const dateSlug = new Date().toISOString().slice(0, 10);
    const link = document.createElement('a');
    link.href = url;
    link.download = `eduflow-backup-${dateSlug}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('تم تنزيل ملف النسخة الاحتياطية JSON بنجاح');
  };

  const handleUploadBackupFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBackupError('');
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || ''));
        const check = validateBackupJson(parsed);
        if (!check.valid || !check.summary) {
          setBackupError(check.error || 'ملف النسخة الاحتياطية غير صالح.');
          showToast(check.error || 'ملف النسخة الاحتياطية غير صالح', 'error');
          return;
        }
        setPendingRestore({
          fileName: file.name,
          rawPayload: parsed,
          summary: check.summary,
        });
      } catch {
        const msg = 'تعذر قراءة الملف: تأكد من اختيار ملف JSON صالح.';
        setBackupError(msg);
        showToast(msg, 'error');
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  return (
    <div className="space-y-5 pb-20">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Secondary Tab Nav */}
        <div className="flex items-center gap-1 p-1 bg-white border border-[#E2E8F0] rounded-[8px] overflow-x-auto w-full sm:w-auto">
          {allowedTabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => switchTab(item.id)}
              className={`px-3.5 py-2 rounded-[6px] text-xs font-bold whitespace-nowrap cursor-pointer ${
                activeTab === item.id ? 'bg-[#0F2A4A] text-white' : 'text-[#5B6B80]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {canAccessScreen(currentActor, ScreenId.SUBSCRIPTION) && (
          <Button
            variant="secondary"
            size="sm"
            icon={<CreditCard className="w-4 h-4 text-[#0F766E]" />}
            onClick={() => navigate(ScreenId.SUBSCRIPTION)}
          >
            الاشتراك والباقات
          </Button>
        )}
      </div>

      {/* Tab 1: بيانات السنتر */}
      {activeTab === 'center' && (
        <Card className="p-6 max-w-3xl space-y-4">
          <h3 className="text-base font-bold text-[#0F2A4A]">البيانات الأساسية للسنتر</h3>

          <div className="flex items-center gap-4 p-4 rounded-[10px] bg-[#F4F7FA] border border-[#E2E8F0]">
            <div className="w-14 h-14 rounded-[10px] bg-[#0F2A4A] text-white font-bold flex items-center justify-center text-lg shrink-0">
              EF
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold text-[#1E293B]">شعار السنتر على الإيصالات</p>
              <p className="text-[11px] text-[#5B6B80]">الملف الحالي: {logoName}</p>
            </div>
            <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[8px] bg-white border border-[#E2E8F0] text-xs font-bold text-[#1E293B] hover:bg-slate-50 cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              <span>رفع شعار</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setLogoName(f.name);
                    setDirty(true);
                  }
                }}
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="اسم السنتر" htmlFor="set-cname" required>
              <TextInput
                id="set-cname"
                value={cName}
                onChange={(e) => {
                  setCName(e.target.value);
                  setDirty(true);
                }}
              />
            </Field>
            <Field label="رقم هاتف السنتر" htmlFor="set-cphone" required>
              <TextInput
                id="set-cphone"
                dir="ltr"
                className="text-right tabular-nums"
                value={cPhone}
                onChange={(e) => {
                  setCPhone(e.target.value);
                  setDirty(true);
                }}
              />
            </Field>
          </div>

          <Field label="العنوان التفصيلي" htmlFor="set-caddr">
            <TextInput
              id="set-caddr"
              value={cAddress}
              onChange={(e) => {
                setCAddress(e.target.value);
                setDirty(true);
              }}
            />
          </Field>

          {/* Discount Policy & Settlement Basis (Phases 4 & 5) */}
          <div className="pt-4 border-t border-[#E2E8F0] space-y-4">
            <h4 className="text-sm font-bold text-[#0F2A4A]">سياسة الخصومات وتسويات المدرسين</h4>
            <label className="flex items-center justify-between p-3.5 rounded-[10px] bg-[#F4F7FA] border border-[#E2E8F0] cursor-pointer">
              <div>
                <span className="text-xs font-bold text-[#0F2A4A] block">
                  تفعيل خصم الأخوة التلقائي عند توليد الفواتير
                </span>
                <span className="text-[11px] text-[#5B6B80]">
                  يتعرف النظام تلقائياً على الطلاب المشتركين بنفس رقم موبايل ولي الأمر
                </span>
              </div>
              <input
                type="checkbox"
                checked={siblingEnabled}
                onChange={(e) => {
                  setSiblingEnabled(e.target.checked);
                  setDirty(true);
                }}
                className="w-4 h-4 accent-[#0F766E]"
              />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="خصم الابن الثاني (%)" htmlFor="pol-sib2">
                <TextInput
                  id="pol-sib2"
                  type="number"
                  min={0}
                  max={100}
                  disabled={!siblingEnabled}
                  value={secondChildPct}
                  onChange={(e) => {
                    setSecondChildPct(e.target.value);
                    setDirty(true);
                  }}
                  className="tabular-nums"
                />
              </Field>
              <Field label="خصم الابن الثالث فأكثر (%)" htmlFor="pol-sib3">
                <TextInput
                  id="pol-sib3"
                  type="number"
                  min={0}
                  max={100}
                  disabled={!siblingEnabled}
                  value={thirdChildPct}
                  onChange={(e) => {
                    setThirdChildPct(e.target.value);
                    setDirty(true);
                  }}
                  className="tabular-nums"
                />
              </Field>
              <Field label="الأساس الافتراضي لتسوية المدرسين" htmlFor="pol-basis">
                <SelectInput
                  id="pol-basis"
                  value={settlementBasis}
                  onChange={(e) => {
                    setSettlementBasis(e.target.value as 'cash' | 'invoiced');
                    setDirty(true);
                  }}
                >
                  <option value="cash">النقدي المحصّل</option>
                  <option value="invoiced">الفواتير المصدرة</option>
                </SelectInput>
              </Field>
            </div>
          </div>
        </Card>
      )}

      {/* Tab 2: المستخدمون والصلاحيات */}
      {activeTab === 'users' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-[#0F2A4A]">فريق عمل السنتر</h3>
              <p className="text-xs text-[#5B6B80]">إدارة حسابات الموظفين والمدرسين وصلاحياتهم</p>
            </div>
            <Button
              size="sm"
              icon={<UserPlus className="w-4 h-4" />}
              onClick={() => setInviteOpen(true)}
            >
              دعوة مستخدم
            </Button>
          </div>

          <Card padding="p-0" className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-[#E2E8F0] text-xs font-bold text-[#5B6B80]">
                    <th className="py-3 px-4">الاسم</th>
                    <th className="py-3 px-4">البريد / الهاتف</th>
                    <th className="py-3 px-4">الدور</th>
                    <th className="py-3 px-4">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0] text-sm">
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td className="py-3 px-4 font-bold text-[#1E293B]">{u.name}</td>
                      <td className="py-3 px-4 text-xs text-[#5B6B80] tabular-nums">
                        {u.email} · {u.phone}
                      </td>
                      <td className="py-3 px-4">
                        <StatusChip tone="navy" label={u.role} />
                      </td>
                      <td className="py-3 px-4">
                        <StatusChip
                          tone={u.status === 'active' ? 'success' : 'warning'}
                          label={u.status === 'active' ? 'نشط' : 'بانتظار القبول'}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Read-only Permission Matrix */}
          <Card padding="p-0" className="overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#0F766E]" />
              <h4 className="text-sm font-bold text-[#0F2A4A]">مصفوفة الصلاحيات حسب الدور (للقراءة فقط)</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-[#E2E8F0] font-bold text-[#5B6B80]">
                    <th className="py-3 px-4">الصلاحية</th>
                    <th className="py-3 px-4 text-center">مالك / مدير</th>
                    <th className="py-3 px-4 text-center">محاسب</th>
                    <th className="py-3 px-4 text-center">ريسبشن</th>
                    <th className="py-3 px-4 text-center">مدرس</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {[
                    { perm: 'تسجيل الحضور وإضافة الطلاب', owner: true, acc: false, rec: true, tch: true },
                    { perm: 'تحصيل الدفعات وإصدار الإيصالات', owner: true, acc: true, rec: true, tch: false },
                    { perm: 'إدارة وحذف المصروفات والتقارير المالية', owner: true, acc: true, rec: false, tch: false },
                    { perm: 'إدارة الإعدادات والاشتراك الشهري', owner: true, acc: false, rec: false, tch: false },
                  ].map((row) => (
                    <tr key={row.perm}>
                      <td className="py-2.5 px-4 font-semibold text-[#1E293B]">{row.perm}</td>
                      {[row.owner, row.acc, row.rec, row.tch].map((allowed, i) => (
                        <td key={i} className="py-2.5 px-4 text-center">
                          {allowed ? (
                            <Check className="w-4 h-4 text-[#065F46] mx-auto" />
                          ) : (
                            <X className="w-4 h-4 text-slate-300 mx-auto" />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Tab 3: القاعات والمراحل */}
      {activeTab === 'rooms' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card className="p-5 space-y-4">
            <h3 className="text-base font-bold text-[#0F2A4A]">قاعات السنتر الدراسية</h3>
            <div className="flex gap-2">
              <TextInput
                placeholder="اسم القاعة الجديدة"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
              />
              <TextInput
                type="number"
                className="w-24 tabular-nums"
                placeholder="السعة"
                value={newRoomCap}
                onChange={(e) => setNewRoomCap(e.target.value)}
              />
              <Button
                onClick={() => {
                  if (!newRoomName.trim()) return;
                  addRoom(newRoomName.trim(), Number(newRoomCap) || 40);
                  setNewRoomName('');
                }}
                icon={<Plus className="w-4 h-4" />}
              >
                إضافة
              </Button>
            </div>

            <div className="divide-y divide-[#E2E8F0] border border-[#E2E8F0] rounded-[8px]">
              {rooms.map((rm) => (
                <div key={rm.id} className="px-3.5 py-2.5 flex items-center justify-between text-sm">
                  <div>
                    <span className="font-bold text-[#1E293B]">{rm.name}</span>
                    <span className="text-xs text-[#5B6B80] mr-2 tabular-nums">
                      (السعة: {rm.capacity} طالب)
                    </span>
                  </div>
                  <button
                    type="button"
                    aria-label={`حذف ${rm.name}`}
                    onClick={() => setDeleteRoomConfirmId(rm.id)}
                    className="text-[#991B1B] hover:bg-red-50 p-1.5 rounded cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5 space-y-4">
            <h3 className="text-base font-bold text-[#0F2A4A]">المراحل والصفوف الدراسية</h3>
            <div className="flex gap-2">
              <TextInput
                placeholder="مثال: الصف الخامس الابتدائي"
                value={newStageName}
                onChange={(e) => setNewStageName(e.target.value)}
              />
              <Button
                onClick={() => {
                  if (!newStageName.trim()) return;
                  addStage(newStageName.trim());
                  setNewStageName('');
                }}
                icon={<Plus className="w-4 h-4" />}
              >
                إضافة
              </Button>
            </div>
            <div className="divide-y divide-[#E2E8F0] border border-[#E2E8F0] rounded-[8px]">
              {stages.map((st) => (
                <div key={st} className="px-3.5 py-2.5 flex items-center justify-between text-sm">
                  <span className="font-semibold text-[#1E293B]">{st}</span>
                  <button
                    type="button"
                    aria-label={`حذف مرحلة ${st}`}
                    onClick={() => deleteStage(st)}
                    className="text-[#991B1B] hover:bg-red-50 p-1.5 rounded cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Tab 4: قوالب الرسائل */}
      {activeTab === 'templates' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <Card className="lg:col-span-7 p-5 space-y-4">
            <div className="flex flex-wrap gap-2">
              {templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => selectTemplate(t.id)}
                  className={`px-3.5 py-2 rounded-[8px] text-xs font-bold border cursor-pointer ${
                    selectedTplId === t.id
                      ? 'bg-[#0F766E] text-white border-[#0F766E]'
                      : 'bg-white text-[#1E293B] border-[#E2E8F0]'
                  }`}
                >
                  {t.title}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold text-[#5B6B80] block">
                اضغط لإدراج متغير تلقائي في النص:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {['اسم_الطالب', 'التاريخ', 'المجموعة', 'المبلغ', 'الموعد'].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => insertVariable(v)}
                    className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-xs font-bold text-[#0F2A4A] cursor-pointer"
                  >
                    +{`{${v}}`}
                  </button>
                ))}
              </div>
            </div>

            <Field label="نص القالب" htmlFor="tpl-editor">
              <textarea
                id="tpl-editor"
                rows={4}
                value={tplBody}
                onChange={(e) => setTplBody(e.target.value)}
                className="w-full p-3.5 rounded-[8px] border border-[#E2E8F0] text-sm text-[#1E293B] focus:outline-none focus:border-[#0F766E]"
              />
            </Field>

            <Button onClick={() => updateTemplate(selectedTplId, tplBody)}>
              حفظ قالب الرسالة
            </Button>
          </Card>

          {/* Live Preview */}
          <Card className="lg:col-span-5 p-5 space-y-3 bg-[#F4F7FA]">
            <h4 className="text-sm font-bold text-[#0F2A4A]">معاينة حية لرسالة ولي الأمر</h4>
            <div className="p-4 rounded-[12px] bg-white border border-[#E2E8F0] text-sm leading-relaxed text-[#1E293B] shadow-2xs">
              {interpolateTemplate(tplBody, {
                اسم_الطالب: 'يوسف أحمد محمود',
                التاريخ: '12/11/2026',
                المجموعة: 'فيزياء - ثالثة ثانوي',
                المبلغ: '480',
                الموعد: '4:00 م',
              })}
            </div>
          </Card>
        </div>
      )}

      {/* Tab 4b: تنسيق الإيصال (A5 / Thermal 80mm) */}
      {activeTab === 'receipts' && (
        <Card className="p-6 max-w-2xl space-y-4">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-[#0F766E]" />
            <h3 className="text-base font-bold text-[#0F2A4A]">
              إعدادات طباعة الإيصالات (A5 / حراري 80mm)
            </h3>
          </div>

          <Field label="الصيغة الافتراضية لطباعة الإيصالات" htmlFor="rc-fmt">
            <SelectInput
              id="rc-fmt"
              value={rcDefaultFormat}
              onChange={(e) => setRcDefaultFormat(e.target.value as 'a5' | 'thermal80')}
            >
              <option value="a5">ورقي قياسي A5</option>
              <option value="thermal80">طابعة حرارية 80mm</option>
            </SelectInput>
          </Field>

          <Field label="عبارة الترويسة أعلى الإيصال" htmlFor="rc-header">
            <TextInput
              id="rc-header"
              placeholder="مثال: سنتر النخبة التعليمي — جودة ومتابعة مستمرة"
              value={rcHeaderNote}
              onChange={(e) => setRcHeaderNote(e.target.value)}
            />
          </Field>

          <Field label="عبارة التذييل أسفل الإيصال" htmlFor="rc-footer">
            <TextInput
              id="rc-footer"
              placeholder="مثال: يُرجى الاحتفاظ بالإيصال للمراجعة المالية"
              value={rcFooterNote}
              onChange={(e) => setRcFooterNote(e.target.value)}
            />
          </Field>

          <Button
            onClick={() =>
              updateCenterSettings({
                receiptSettings: {
                  headerNote: rcHeaderNote.trim(),
                  footerNote: rcFooterNote.trim(),
                  defaultFormat: rcDefaultFormat,
                },
              })
            }
          >
            حفظ تنسيق الإيصال
          </Button>
        </Card>
      )}

      {/* Tab 5: البيانات (النسخ الاحتياطي، الاستعادة، إعادة التعيين، وضع المعاينة، سجل النشاط) */}
      {activeTab === 'data' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Backup Export */}
            <Card className="p-5 flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-[10px] bg-[#0F766E]/10 text-[#0F766E] flex items-center justify-center">
                  <Download className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-[#0F2A4A]">نسخة احتياطية JSON</h3>
                <p className="text-xs text-[#5B6B80] leading-relaxed">
                  حمّل نسخة كاملة من بيانات السنتر ({students.length} طالب، {invoices.length} فاتورة،{' '}
                  {payments.length} إيصال) بصيغة JSON مشمولة بإصدار المخطط.
                </p>
              </div>
              <Button
                onClick={handleDownloadBackup}
                icon={<Download className="w-4 h-4" />}
                className="w-full"
              >
                نسخة احتياطية JSON
              </Button>
            </Card>

            {/* Restore Backup */}
            <Card className="p-5 flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-[10px] bg-[#0F2A4A]/10 text-[#0F2A4A] flex items-center justify-center">
                  <Upload className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-[#0F2A4A]">استعادة نسخة</h3>
                <p className="text-xs text-[#5B6B80] leading-relaxed">
                  ارفع ملف JSON مُصدَّر مسبقاً من EDUFLOW. سيتم التحقق من صحة الجداول وعرض ملخص للتأكيد قبل الاستبدال.
                </p>
                {backupError && (
                  <p role="alert" className="text-xs font-bold text-[#991B1B] bg-[#FEE2E2] p-2 rounded-[8px]">
                    {backupError}
                  </p>
                )}
              </div>
              <label className="w-full min-h-[44px] px-4 rounded-[8px] border border-[#E2E8F0] bg-white hover:bg-slate-50 text-xs font-bold text-[#0F2A4A] inline-flex items-center justify-center gap-2 cursor-pointer">
                <Upload className="w-4 h-4 text-[#0F766E]" />
                <span>استعادة نسخة</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={handleUploadBackupFile}
                />
              </label>
            </Card>

            {/* Double-confirmed Seed Reset */}
            <Card className="p-5 flex flex-col justify-between space-y-4 border-red-200/80">
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-[10px] bg-[#FEE2E2] text-[#991B1B] flex items-center justify-center">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-[#991B1B]">إعادة تعيين بيانات تجريبية</h3>
                <p className="text-xs text-[#5B6B80] leading-relaxed">
                  يعيد هذا الإجراء مسح جميع التعديلات المحفوظة محلياً واستعادة البيانات التجريبية الأولية بعد تأكيد مزدوج.
                </p>
              </div>
              <Button
                variant="destructive"
                icon={<RotateCcw className="w-4 h-4" />}
                onClick={() => {
                  setResetConfirmPhrase('');
                  setResetModalStep(1);
                }}
                className="w-full"
              >
                إعادة تعيين بيانات تجريبية
              </Button>
            </Card>
          </div>

          {/* Owner-only Demo Mode Switcher Flag */}
          {authSession?.role === UserRole.OWNER && (
            <Card className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-[10px] bg-[#0F2A4A] text-white flex items-center justify-center shrink-0">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#0F2A4A]">
                    وضع معاينة الأدوار (Demo Mode — للمالك فقط)
                  </h4>
                  <p className="text-xs text-[#5B6B80] mt-0.5">
                    عند التفعيل يظهر محوّل «معاينة كدور» للمالك فقط في الشريط العلوي ولوحة التحكم لتجربة واجهات المحاسب والمدرس.
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={demoMode}
                onClick={() => setDemoMode(!demoMode)}
                className={`min-h-[44px] px-4 rounded-[8px] text-xs font-bold border transition-colors cursor-pointer shrink-0 ${
                  demoMode
                    ? 'bg-[#0F766E] text-white border-[#0F766E]'
                    : 'bg-white text-[#1E293B] border-[#E2E8F0] hover:bg-slate-50'
                }`}
              >
                {demoMode ? 'وضع المعاينة مفعّل (إيقاف)' : 'تفعيل وضع المعاينة'}
              </button>
            </Card>
          )}

          {/* Owner-only Biometric Face Attendance Toggle (Phase 10) */}
          {canEnableBiometrics && (
            <Card className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-[10px] bg-[#0F766E] text-white flex items-center justify-center shrink-0">
                  <ScanFace className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#0F2A4A]">
                    تفعيل الحضور ببصمة الوجه (للمالك فقط)
                  </h4>
                  <p className="text-xs text-[#5B6B80] mt-0.5">
                    تُحفظ بصمات مشفرة بعد توثيق موافقة ولي الأمر فقط. يُسجّل تفعيل أو إيقاف الميزة في سجل النشاط.
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={Boolean(centerSettings.biometricFaceEnabled)}
                onClick={() =>
                  updateCenterSettings({
                    biometricFaceEnabled: !centerSettings.biometricFaceEnabled,
                  })
                }
                className={`min-h-[44px] px-4 rounded-[8px] text-xs font-bold border transition-colors cursor-pointer shrink-0 ${
                  centerSettings.biometricFaceEnabled
                    ? 'bg-[#0F766E] text-white border-[#0F766E]'
                    : 'bg-white text-[#1E293B] border-[#E2E8F0] hover:bg-slate-50'
                }`}
              >
                {centerSettings.biometricFaceEnabled
                  ? 'بصمة الوجه مفعّلة (إيقاف)'
                  : 'تفعيل بصمة الوجه'}
              </button>
            </Card>
          )}

          {/* Activity Log Preview */}
          <Card padding="p-0" className="overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-[#0F766E]" />
                <h4 className="text-sm font-bold text-[#0F2A4A]">
                  سجل النشاط والعمليات الحساسة ({activityLog.length})
                </h4>
              </div>
              <span className="text-xs text-[#5B6B80]">يُسجّل تلقائياً في وحدة التخزين المحلية</span>
            </div>
            {activityLog.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#5B6B80]">
                لا توجد عمليات مسجلة حتى الآن.
              </div>
            ) : (
              <div className="overflow-x-auto max-h-80">
                <table className="w-full text-right border-collapse text-xs">
                  <thead className="sticky top-0 bg-slate-50 border-b border-[#E2E8F0] font-bold text-[#5B6B80]">
                    <tr>
                      <th className="py-2.5 px-4">الوقت</th>
                      <th className="py-2.5 px-4">المستخدم</th>
                      <th className="py-2.5 px-4">العملية</th>
                      <th className="py-2.5 px-4">التفاصيل</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {activityLog.slice(0, 20).map((entry) => (
                      <tr key={entry.id} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-4 tabular-nums text-[#5B6B80] whitespace-nowrap">
                          {new Date(entry.timestamp).toLocaleString('en-GB')}
                        </td>
                        <td className="py-2.5 px-4 font-bold text-[#0F2A4A] whitespace-nowrap">
                          {entry.actorName} ({entry.actorRole})
                        </td>
                        <td className="py-2.5 px-4">
                          <StatusChip tone="navy" label={entry.action} />
                        </td>
                        <td className="py-2.5 px-4 text-[#1E293B]">{entry.summary}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Tab: منصة الطالب (Phase 11 Plan & Settings Gate) */}
      {activeTab === 'studentPortal' && (
        <div className="space-y-5 max-w-3xl">
          {!isPlanFeatureEnabled(centerSettings.currentPlanId, 'studentPortal') ? (
            <Card className="p-6 space-y-4 border-amber-300 bg-[#FEF3C7]/40">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-[10px] bg-[#FEF3C7] text-[#92400E] flex items-center justify-center shrink-0">
                  <Lock className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-[#0F2A4A]">
                    منصة الطالب غير مشمولة في الباقة الحالية
                  </h3>
                  <p className="text-xs text-[#5B6B80] leading-relaxed">
                    تتطلب ميزة «منصة الطالب» ودخول الطلاب بالأكواد الشخصية الترقية من{' '}
                    <strong>{getPlanConfig(centerSettings.currentPlanId).name}</strong> إلى الباقة الاحترافية أو المتكاملة.
                  </p>
                </div>
              </div>
              <Button
                icon={<CreditCard className="w-4 h-4" />}
                onClick={() => navigate(ScreenId.SUBSCRIPTION)}
              >
                عرض الباقات والترقية
              </Button>
            </Card>
          ) : (
            <>
              <Card className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-[10px] bg-[#0F766E] text-white flex items-center justify-center shrink-0">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-bold text-[#0F2A4A]">منصة الطالب</h3>
                      <StatusChip
                        tone={studentPortalAvailable ? 'success' : 'neutral'}
                        label={studentPortalAvailable ? 'مفعّلة' : 'مغلقة'}
                      />
                    </div>
                    <p className="text-xs text-[#5B6B80] mt-1">
                      تتيح للطلاب تسجيل الدخول بكود شخصي ورمز PIN لمتابعة الحضور والنتائج والدروس. عند الإغلاق يتم إيقاف دخول الطلاب فوراً.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-label="تفعيل منصة الطالب"
                  aria-checked={Boolean(centerSettings.studentPortalEnabled ?? true)}
                  onClick={() =>
                    updateCenterSettings({
                      studentPortalEnabled: !(centerSettings.studentPortalEnabled ?? true),
                    })
                  }
                  className={`min-h-[44px] px-4 rounded-[8px] text-xs font-bold border transition-colors cursor-pointer shrink-0 ${
                    centerSettings.studentPortalEnabled ?? true
                      ? 'bg-[#0F766E] text-white border-[#0F766E]'
                      : 'bg-white text-[#1E293B] border-[#E2E8F0] hover:bg-slate-50'
                  }`}
                >
                  {centerSettings.studentPortalEnabled ?? true
                    ? 'منصة الطالب مفعّلة (إيقاف)'
                    : 'تفعيل منصة الطالب'}
                </button>
              </Card>

              <Card className="p-5 space-y-4">
                <h4 className="text-sm font-bold text-[#0F2A4A] flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-[#0F766E]" />
                  <span>سياسة الأجهزة والجلسات ورابط الدخول</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field
                    label="الحد الأقصى للأجهزة لكل طالب"
                    htmlFor="sp-max-devices"
                    hint="الافتراضي: جهازان (مع إمكانية إخراج أقدم جهاز)"
                  >
                    <TextInput
                      id="sp-max-devices"
                      type="number"
                      min={1}
                      max={5}
                      value={maxDevicesInput}
                      onChange={(e) => setMaxDevicesInput(e.target.value)}
                      className="tabular-nums"
                    />
                  </Field>
                  <Field
                    label="مدة استمرار الجلسة (بالأيام)"
                    htmlFor="sp-session-days"
                    hint="الافتراضي: 7 أيام قبل طلب رمز المرور مجدداً"
                  >
                    <TextInput
                      id="sp-session-days"
                      type="number"
                      min={1}
                      max={30}
                      value={sessionDaysInput}
                      onChange={(e) => setSessionDaysInput(e.target.value)}
                      className="tabular-nums"
                    />
                  </Field>
                </div>

                <div className="p-3.5 rounded-[10px] bg-[#F4F7FA] border border-[#E2E8F0] flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div>
                    <span className="text-[#5B6B80] block">رابط تسجيل دخول الطلاب المباشر</span>
                    <span dir="ltr" className="font-bold text-[#0F2A4A]">
                      {typeof window !== 'undefined'
                        ? `${window.location.origin}/#/student-login`
                        : '#/student-login'}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<Copy className="w-3.5 h-3.5" />}
                    onClick={() => {
                      const url =
                        typeof window !== 'undefined'
                          ? `${window.location.origin}/#/student-login`
                          : '#/student-login';
                      if (typeof navigator !== 'undefined' && navigator.clipboard) {
                        navigator.clipboard.writeText(url).catch(() => {});
                      }
                      showToast('تم نسخ رابط دخول منصة الطالب');
                    }}
                  >
                    نسخ الرابط
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-[8px] border border-[#E2E8F0]">
                    <span className="text-[#5B6B80] block">حسابات الطلاب الصادرة</span>
                    <span className="text-lg font-bold text-[#0F2A4A] tabular-nums">
                      {studentAccounts.length} / {students.length}
                    </span>
                  </div>
                  <div className="p-3 rounded-[8px] border border-[#E2E8F0]">
                    <span className="text-[#5B6B80] block">أجهزة الطلاب المتصلة حالياً</span>
                    <span className="text-lg font-bold text-[#0F766E] tabular-nums">
                      {
                        studentSessions.filter(
                          (s) => !s.revokedAt && s.expiresAt > Date.now()
                        ).length
                      }
                    </span>
                  </div>
                </div>

                <Button
                  onClick={() =>
                    updateCenterSettings({
                      studentMaxDevices: Math.min(5, Math.max(1, Number(maxDevicesInput) || 2)),
                      studentSessionDays: Math.min(30, Math.max(1, Number(sessionDaysInput) || 7)),
                    })
                  }
                >
                  حفظ إعدادات منصة الطالب
                </Button>
              </Card>
            </>
          )}
        </div>
      )}

      {/* Tab 6: حسابي */}
      {activeTab === 'account' && (
        <Card className="p-6 max-w-xl space-y-4">
          <h3 className="text-base font-bold text-[#0F2A4A]">إعدادات حسابي الشخصي</h3>
          {accountError && (
            <div role="alert" className="p-3 rounded-[8px] bg-[#FEE2E2] text-[#991B1B] text-xs font-bold">
              {accountError}
            </div>
          )}
          <Field label="الاسم المعروض" htmlFor="acc-name">
            <TextInput
              id="acc-name"
              value={myName}
              onChange={(e) => setMyName(e.target.value)}
            />
          </Field>
          <Field label="كلمة السر الحالية" htmlFor="acc-old-pass">
            <TextInput
              id="acc-old-pass"
              type="password"
              dir="ltr"
              className="text-right"
              value={oldPass}
              onChange={(e) => {
                setOldPass(e.target.value);
                setAccountError('');
              }}
            />
          </Field>
          <Field label="كلمة السر الجديدة" htmlFor="acc-new-pass">
            <TextInput
              id="acc-new-pass"
              type="password"
              dir="ltr"
              className="text-right"
              value={newPass}
              onChange={(e) => {
                setNewPass(e.target.value);
                setAccountError('');
              }}
            />
          </Field>
          <Button
            onClick={async () => {
              setAccountError('');
              const res = await changeMyPassword(oldPass, newPass, myName);
              if (!res.ok) {
                setAccountError(res.error || 'تعذر تحديث الحساب.');
                return;
              }
              setOldPass('');
              setNewPass('');
            }}
          >
            تحديث الحساب
          </Button>
        </Card>
      )}

      {/* Sticky Save Bar when Center Info has unsaved edits */}
      {dirty && (
        <div className="fixed bottom-16 lg:bottom-0 left-0 right-0 lg:right-[220px] bg-white border-t border-[#E2E8F0] px-6 py-3 z-20 flex items-center justify-between shadow-lg">
          <span className="text-xs font-bold text-[#92400E]">
            لديك تغييرات غير محفوظة في بيانات السنتر
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setCName(centerSettings.name);
                setCPhone(centerSettings.phone);
                setCAddress(centerSettings.address);
                setSiblingEnabled(centerSettings.discountPolicy?.siblingEnabled ?? true);
                setSecondChildPct(String(centerSettings.discountPolicy?.secondChildPercent ?? 10));
                setThirdChildPct(String(centerSettings.discountPolicy?.thirdPlusChildPercent ?? 20));
                setSettlementBasis(centerSettings.settlementBasis || 'cash');
                setDirty(false);
              }}
            >
              تراجع
            </Button>
            <Button
              size="sm"
              onClick={() => {
                updateCenterSettings({
                  name: cName,
                  phone: cPhone,
                  address: cAddress,
                  settlementBasis,
                  discountPolicy: {
                    siblingEnabled,
                    secondChildPercent: Math.min(100, Math.max(0, Number(secondChildPct) || 0)),
                    thirdPlusChildPercent: Math.min(100, Math.max(0, Number(thirdChildPct) || 0)),
                  },
                });
                setDirty(false);
              }}
            >
              حفظ التغييرات
            </Button>
          </div>
        </div>
      )}

      {/* Unsaved Changes Warning Modal */}
      <Modal
        open={Boolean(pendingTab)}
        onClose={() => setPendingTab(null)}
        title="تغييرات غير محفوظة"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPendingTab(null)}>
              البقاء لحفظ التعديلات
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setDirty(false);
                if (pendingTab) setTab(pendingTab);
                setPendingTab(null);
              }}
            >
              تجاهل التغييرات والمتابعة
            </Button>
          </>
        }
      >
        <p className="text-sm text-[#1E293B]">
          لديك تعديلات لم يتم حفظها في هذا القسم. هل ترغب في تجاهلها والانتقال إلى تبويب آخر؟
        </p>
      </Modal>

      {/* Destructive Room Delete Modal */}
      <Modal
        open={Boolean(deleteRoomConfirmId)}
        onClose={() => setDeleteRoomConfirmId(null)}
        title="حذف القاعة الدراسية"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteRoomConfirmId(null)}>
              إلغاء
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteRoomConfirmId) deleteRoom(deleteRoomConfirmId);
                setDeleteRoomConfirmId(null);
              }}
            >
              تأكيد الحذف
            </Button>
          </>
        }
      >
        <p className="text-sm text-[#1E293B]">
          هل أنت متأكد من حذف هذه القاعة؟ تأكد أولاً من نقل المجموعات المرتبطة بها.
        </p>
      </Modal>

      {/* Invite User Drawer */}
      <Drawer
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="دعوة مستخدم جديد للسنتر"
        footer={
          <>
            <Button variant="secondary" onClick={() => setInviteOpen(false)}>
              إلغاء
            </Button>
            <Button
              onClick={() => {
                if (!invName.trim() || !invEmail.trim()) return;
                inviteUser({
                  name: invName.trim(),
                  email: invEmail.trim(),
                  phone: invPhone.trim() || '01000000000',
                  role: invRole,
                });
                setInvName('');
                setInvEmail('');
                setInvPhone('');
                setInviteOpen(false);
              }}
            >
              إرسال الدعوة
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="اسم الموظف / المدرس" htmlFor="inv-name" required>
            <TextInput
              id="inv-name"
              value={invName}
              onChange={(e) => setInvName(e.target.value)}
            />
          </Field>
          <Field label="البريد الإلكتروني" htmlFor="inv-email" required>
            <TextInput
              id="inv-email"
              type="email"
              dir="ltr"
              className="text-right"
              value={invEmail}
              onChange={(e) => setInvEmail(e.target.value)}
            />
          </Field>
          <Field label="رقم الهاتف" htmlFor="inv-phone">
            <TextInput
              id="inv-phone"
              dir="ltr"
              className="text-right tabular-nums"
              value={invPhone}
              onChange={(e) => setInvPhone(e.target.value)}
            />
          </Field>
          <Field label="الدور الوظيفي والصلاحية" htmlFor="inv-role">
            <SelectInput
              id="inv-role"
              value={invRole}
              onChange={(e) => setInvRole(e.target.value as UserRole)}
            >
              {Object.values(UserRole)
                .filter(
                  (r) =>
                    r !== UserRole.PARENT &&
                    r !== UserRole.STUDENT &&
                    (r !== UserRole.OWNER || can(currentActor, 'manage_owners', 'users'))
                )
                .map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
            </SelectInput>
          </Field>
        </div>
      </Drawer>

      {/* Restore Backup Confirmation Modal */}
      <Modal
        open={Boolean(pendingRestore)}
        onClose={() => setPendingRestore(null)}
        title="تأكيد استعادة النسخة الاحتياطية"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPendingRestore(null)}>
              إلغاء
            </Button>
            <Button
              onClick={() => {
                if (pendingRestore) {
                  try {
                    importBackupJson(pendingRestore.rawPayload);
                    setPendingRestore(null);
                  } catch (err) {
                    const msg =
                      err instanceof Error ? err.message : 'فشلت استعادة النسخة الاحتياطية.';
                    setBackupError(msg);
                    showToast(msg, 'error');
                  }
                }
              }}
            >
              تأكيد الاستعادة واستبدال البيانات
            </Button>
          </>
        }
      >
        {pendingRestore && (
          <div className="space-y-3 text-sm text-[#1E293B]">
            <p>
              الملف المختار: <strong dir="ltr">{pendingRestore.fileName}</strong>
            </p>
            <div className="p-3.5 rounded-[10px] bg-[#F4F7FA] border border-[#E2E8F0] grid grid-cols-2 gap-2 text-xs tabular-nums">
              <span>الطلاب: <strong>{pendingRestore.summary.students}</strong></span>
              <span>المدرسين: <strong>{pendingRestore.summary.teachers}</strong></span>
              <span>المجموعات: <strong>{pendingRestore.summary.groups}</strong></span>
              <span>الفواتير: <strong>{pendingRestore.summary.invoices}</strong></span>
              <span>المدفوعات: <strong>{pendingRestore.summary.payments}</strong></span>
            </div>
            <p className="text-xs text-[#92400E] bg-[#FEF3C7] p-2.5 rounded-[8px] font-semibold">
              تنبيه: سيتم استبدال البيانات الحالية في المتصفح بمحتويات هذا الملف.
            </p>
          </div>
        )}
      </Modal>

      {/* Double-Confirmation Seed Reset Modal */}
      <Modal
        open={resetModalStep > 0}
        onClose={() => {
          setResetModalStep(0);
          setResetConfirmPhrase('');
        }}
        title={
          resetModalStep === 1
            ? 'تحذير: إعادة تعيين البيانات التجريبية (الخطوة 1 من 2)'
            : 'تأكيد نهائي لإعادة التعيين (الخطوة 2 من 2)'
        }
        footer={
          resetModalStep === 1 ? (
            <>
              <Button variant="secondary" onClick={() => setResetModalStep(0)}>
                إلغاء
              </Button>
              <Button variant="destructive" onClick={() => setResetModalStep(2)}>
                متابعة للتأكيد النهائي
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  setResetModalStep(0);
                  setResetConfirmPhrase('');
                }}
              >
                إلغاء
              </Button>
              <Button
                variant="destructive"
                disabled={resetConfirmPhrase.trim() !== 'إعادة تعيين'}
                onClick={() => {
                  resetDemoData();
                  setResetModalStep(0);
                  setResetConfirmPhrase('');
                }}
              >
                تنفيذ إعادة التعيين الآن
              </Button>
            </>
          )
        }
      >
        {resetModalStep === 1 ? (
          <div className="flex items-start gap-3 text-sm text-[#1E293B]">
            <AlertTriangle className="w-5 h-5 text-[#DC2626] shrink-0 mt-0.5" />
            <p>
              سيتم حذف جميع التعديلات الجديدة (الطلاب، الدفعات، المصروفات، الحضور) والعودة إلى بيانات السنتر التجريبية الأولية. هل ترغب في المتابعة؟
            </p>
          </div>
        ) : (
          <div className="space-y-3 text-sm text-[#1E293B]">
            <p className="text-xs text-[#991B1B] font-bold">
              للتأكيد النهائي، اكتب عبارة «إعادة تعيين» في الحقل أدناه:
            </p>
            <TextInput
              placeholder="إعادة تعيين"
              value={resetConfirmPhrase}
              onChange={(e) => setResetConfirmPhrase(e.target.value)}
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

// 20) Subscription & Plans Screen
export const SubscriptionScreen: React.FC = () => {
  const {
    currentActor,
    centerSettings,
    updateCenterSettings,
    students,
    users,
    openLockedFeatureModal,
    showToast,
  } = useEduflow();

  const canChangePlan = can(currentActor, 'change_plan', 'subscription');

  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [upgradePlanId, setUpgradePlanId] = useState<'basic' | 'pro' | 'enterprise' | null>(null);
  const [upgradeStep, setUpgradeStep] = useState<'payment' | 'success'>('payment');
  const [gatewayMethod, setGatewayMethod] = useState<'card' | 'wallet'>('card');

  const currentPlan =
    SUBSCRIPTION_PLANS.find((p) => p.id === centerSettings.currentPlanId) ||
    SUBSCRIPTION_PLANS[1];

  const usedStudents = students.filter((s) => s.status === 'active').length + 310;
  const usedUsers = users.length;
  const studentPct = Math.min(100, Math.round((usedStudents / currentPlan.maxStudents) * 100));
  const userPct = Math.min(100, Math.round((usedUsers / currentPlan.maxUsers) * 100));

  const targetUpgradePlan = SUBSCRIPTION_PLANS.find((p) => p.id === upgradePlanId);

  return (
    <div className="space-y-6">
      {!canChangePlan && (
        <div
          role="status"
          className="px-4 py-3 rounded-[10px] bg-[#FEF3C7] border border-amber-300 text-[#92400E] text-xs font-bold flex items-center gap-2"
        >
          <Shield className="w-4 h-4 shrink-0" />
          <span>عرض فقط: تغيير أو ترقية باقة الاشتراك متاح لمالك السنتر فقط.</span>
        </div>
      )}

      {/* Banner Simulator Controls (Owner only) */}
      {canChangePlan && (
        <Card className="p-4 flex flex-wrap items-center justify-between gap-3 bg-white">
          <span className="text-xs font-bold text-[#0F2A4A]">
            معاينة تنبيهات حالة الاشتراك والمزايا المقفلة:
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { id: 'none', label: 'اشتراك منتظم' },
                { id: 'payment_failed', label: 'فشل الدفع' },
                { id: 'grace_period', label: 'فترة السماح (5 أيام)' },
                { id: 'read_only', label: 'القراءة فقط' },
              ] as { id: CenterSettings['billingBanner']; label: string }[]
            ).map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => updateCenterSettings({ billingBanner: b.id })}
                className={`px-3 py-1.5 rounded-[6px] text-xs font-bold border cursor-pointer ${
                  centerSettings.billingBanner === b.id
                    ? 'bg-[#0F2A4A] text-white border-[#0F2A4A]'
                    : 'bg-slate-50 text-[#5B6B80] border-[#E2E8F0]'
                }`}
              >
                {b.label}
              </button>
            ))}
            <Button
              size="sm"
              variant="secondary"
              icon={<Lock className="w-3.5 h-3.5 text-[#0F766E]" />}
              onClick={() =>
                openLockedFeatureModal('إرسال رسائل واتساب التلقائية وتقارير الفروع', 'الباقة المتكاملة')
              }
            >
              معاينة نافذة الميزة المقفلة
            </Button>
          </div>
        </Card>
      )}

      {/* Current Plan & Usage Meters */}
      <Card className="p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <StatusChip tone="success" label="الباقة الحالية مفعّلة" />
            <h2 className="text-xl font-bold text-[#0F2A4A] mt-2">{currentPlan.name}</h2>
            <p className="text-xs text-[#5B6B80] tabular-nums">
              قيمة الاشتراك الشهري: <strong>{formatEGP(currentPlan.monthlyPrice)}</strong> · موعد التجديد القادم: <strong>01 ديسمبر 2026</strong>
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:w-[54%]">
            <div className="p-3.5 rounded-[10px] bg-[#F4F7FA] border border-[#E2E8F0] space-y-2">
              <div className="flex justify-between text-xs">
                <span className="font-bold text-[#1E293B]">الطلاب النشطون</span>
                <span className="tabular-nums font-bold text-[#0F2A4A]">
                  {usedStudents} / {currentPlan.maxStudents}
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full bg-[#0F766E] rounded-full"
                  style={{ width: `${studentPct}%` }}
                />
              </div>
            </div>

            <div className="p-3.5 rounded-[10px] bg-[#F4F7FA] border border-[#E2E8F0] space-y-2">
              <div className="flex justify-between text-xs">
                <span className="font-bold text-[#1E293B]">حسابات الموظفين</span>
                <span className="tabular-nums font-bold text-[#0F2A4A]">
                  {usedUsers} / {currentPlan.maxUsers}
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full bg-[#0F2A4A] rounded-full"
                  style={{ width: `${userPct}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Monthly / Annual Billing Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-[#0F2A4A]">مقارنة باقات EDUFLOW</h3>
          <p className="text-xs text-[#5B6B80]">
            اختر الباقة المناسبة لحجم طلاب سنترك — الدفع السنوي يوفر شهرين مجاناً (ادفع 10 شهور فقط)
          </p>
        </div>

        <div className="inline-flex items-center gap-1 p-1 bg-white border border-[#E2E8F0] rounded-[8px]">
          <button
            type="button"
            onClick={() => setBillingCycle('monthly')}
            className={`px-3.5 py-2 rounded-[6px] text-xs font-bold cursor-pointer ${
              billingCycle === 'monthly' ? 'bg-[#0F2A4A] text-white' : 'text-[#5B6B80]'
            }`}
          >
            دفع شهري
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle('annual')}
            className={`px-3.5 py-2 rounded-[6px] text-xs font-bold cursor-pointer flex items-center gap-1.5 ${
              billingCycle === 'annual' ? 'bg-[#0F766E] text-white' : 'text-[#5B6B80]'
            }`}
          >
            <span>دفع سنوي</span>
            <span className="px-1.5 py-0.5 rounded bg-[#D1FAE5] text-[#065F46] text-[10px]">
              وفّر شهرين
            </span>
          </button>
        </div>
      </div>

      {/* 3 Pricing Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
        {SUBSCRIPTION_PLANS.map((plan) => {
          const isCurrent = plan.id === centerSettings.currentPlanId;
          const displayPrice =
            billingCycle === 'monthly' ? plan.monthlyPrice : plan.monthlyPrice * 10;

          return (
            <Card
              key={plan.id}
              className={`p-6 flex flex-col justify-between ${
                plan.popular ? 'border-2 border-[#0F766E] relative' : ''
              }`}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-bold text-[#0F2A4A]">{plan.name}</h4>
                  {plan.popular && <StatusChip tone="success" label="الأكثر طلباً" />}
                </div>
                <p className="text-xs text-[#5B6B80]">{plan.subtitle}</p>

                <div className="pt-2 pb-4 border-b border-[#E2E8F0]">
                  <span className="text-3xl font-bold text-[#0F2A4A] tabular-nums">
                    {formatEGP(displayPrice)}
                  </span>
                  <span className="text-xs text-[#5B6B80] mr-1">
                    / {billingCycle === 'monthly' ? 'شهرياً' : 'سنوياً (10 شهور)'}
                  </span>
                </div>

                <ul className="space-y-2.5 text-xs">
                  {plan.features.map((feat, idx) => (
                    <li key={idx} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {feat.included ? (
                          <Check className="w-4 h-4 text-[#0F766E] shrink-0" />
                        ) : (
                          <X className="w-4 h-4 text-slate-300 shrink-0" />
                        )}
                        <span
                          className={
                            feat.included ? 'text-[#1E293B] font-medium' : 'text-slate-400'
                          }
                        >
                          {feat.text}
                        </span>
                      </div>
                      {feat.soon && (
                        <span className="px-1.5 py-0.5 rounded bg-[#FEF3C7] text-[#92400E] text-[10px] font-bold shrink-0">
                          قريباً
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-6">
                <Button
                  variant={isCurrent ? 'secondary' : plan.popular ? 'primary' : 'secondary'}
                  disabled={isCurrent || !canChangePlan}
                  className="w-full"
                  onClick={() => {
                    if (!canChangePlan) return;
                    setUpgradePlanId(plan.id);
                    setUpgradeStep('payment');
                  }}
                >
                  {isCurrent
                    ? 'باقتك الحالية'
                    : !canChangePlan
                      ? 'الترقية للمالك فقط'
                      : 'ترقية إلى هذه الباقة'}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Billing History Table */}
      <Card padding="p-0" className="overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E2E8F0]">
          <h3 className="text-base font-bold text-[#0F2A4A]">سجل الفواتير والاشتراكات السابقة</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-[#E2E8F0] text-xs font-bold text-[#5B6B80]">
                <th className="py-3 px-4">رقم الإيصال</th>
                <th className="py-3 px-4">التاريخ</th>
                <th className="py-3 px-4">الباقة</th>
                <th className="py-3 px-4">وسيلة الدفع</th>
                <th className="py-3 px-4">المبلغ</th>
                <th className="py-3 px-4">الحالة</th>
                <th className="py-3 px-4 text-left">الإيصال</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {BILLING_HISTORY.map((b) => (
                <tr key={b.id}>
                  <td className="py-3 px-4 tabular-nums font-bold text-[#0F2A4A]">{b.receiptNo}</td>
                  <td className="py-3 px-4 tabular-nums text-xs">{b.date}</td>
                  <td className="py-3 px-4 font-semibold">{b.planName}</td>
                  <td className="py-3 px-4 text-xs text-[#5B6B80]">{b.method}</td>
                  <td className="py-3 px-4 tabular-nums font-bold">{formatEGP(b.amount)}</td>
                  <td className="py-3 px-4">
                    <StatusChip tone="success" label="مدفوع" />
                  </td>
                  <td className="py-3 px-4 text-left">
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Receipt className="w-4 h-4" />}
                      onClick={() => showToast(`تم عرض فاتورة الاشتراك ${b.receiptNo}`, 'info')}
                    >
                      عرض
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Upgrade Payment Flow Modal */}
      <Modal
        open={Boolean(upgradePlanId)}
        onClose={() => setUpgradePlanId(null)}
        title={upgradeStep === 'payment' ? 'تأكيد ترقية الباقة والدفع' : 'تمت ترقية باقة السنتر'}
        footer={
          upgradeStep === 'payment' ? (
            <>
              <Button variant="secondary" onClick={() => setUpgradePlanId(null)}>
                إلغاء
              </Button>
              <Button
                disabled={!canChangePlan}
                onClick={() => {
                  if (upgradePlanId && canChangePlan) {
                    updateCenterSettings({
                      currentPlanId: upgradePlanId,
                      billingBanner: 'none',
                      reportsLockedDemo: false,
                    });
                    setUpgradeStep('success');
                  }
                }}
              >
                إتمام الدفع وتفعيل الباقة
              </Button>
            </>
          ) : (
            <Button onClick={() => setUpgradePlanId(null)}>تم</Button>
          )
        }
      >
        {targetUpgradePlan && upgradeStep === 'payment' && (
          <div className="space-y-4">
            <div className="p-4 rounded-[10px] bg-[#F4F7FA] border border-[#E2E8F0] flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-[#0F2A4A]">{targetUpgradePlan.name}</p>
                <p className="text-xs text-[#5B6B80]">
                  {billingCycle === 'monthly' ? 'دورة فوترة شهرية' : 'دورة فوترة سنوية (10 شهور)'}
                </p>
              </div>
              <span className="text-lg font-bold text-[#0F766E] tabular-nums">
                {formatEGP(
                  billingCycle === 'monthly'
                    ? targetUpgradePlan.monthlyPrice
                    : targetUpgradePlan.monthlyPrice * 10
                )}
              </span>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold text-[#1E293B] block">
                اختر وسيلة الدفع عبر بوابة الدفع المؤمنة:
              </span>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setGatewayMethod('card')}
                  className={`p-3 rounded-[8px] border text-xs font-bold cursor-pointer ${
                    gatewayMethod === 'card'
                      ? 'border-[#0F766E] bg-[#0F766E]/10 text-[#0F766E]'
                      : 'border-[#E2E8F0] text-[#1E293B]'
                  }`}
                >
                  بطاقة بنكية (Visa / Meeza)
                </button>
                <button
                  type="button"
                  onClick={() => setGatewayMethod('wallet')}
                  className={`p-3 rounded-[8px] border text-xs font-bold cursor-pointer ${
                    gatewayMethod === 'wallet'
                      ? 'border-[#0F766E] bg-[#0F766E]/10 text-[#0F766E]'
                      : 'border-[#E2E8F0] text-[#1E293B]'
                  }`}
                >
                  محفظة إلكترونية (Vodafone / InstaPay)
                </button>
              </div>
            </div>
          </div>
        )}

        {upgradeStep === 'success' && (
          <div className="text-center py-4 space-y-3">
            <div className="w-12 h-12 rounded-full bg-[#D1FAE5] text-[#065F46] flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h4 className="text-lg font-bold text-[#0F2A4A]">
              تم تفعيل {targetUpgradePlan?.name} بنجاح!
            </h4>
            <p className="text-xs text-[#5B6B80]">
              تم فتح كافة مزايا الباقة وحدود الطلاب والمستخدمين الجديدة فوراً.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
};
