import React, { useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  CheckSquare,
  CreditCard,
  FileSpreadsheet,
  GraduationCap,
  Home,
  Layers,
  LogOut,
  MoreHorizontal,
  Receipt,
  Search,
  Settings,
  ShieldAlert,
  Sparkles,
  UserCheck,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { useEduflow } from '../../context/EduflowContext';
import { ScreenId, UserRole } from '../../types/eduflow';
import { EduflowLogo, InitialAvatar, ToastViewport } from '../ui/Primitives';
import {
  GlobalLockedFeatureModal,
  GroupFormDrawer,
  RecordPaymentDrawerAndReceipt,
  StudentFormDrawer,
} from '../drawers/GlobalDrawers';
import { PdfExportModal } from '../drawers/PdfExportModal';
import { canAccessScreen } from '../../permissions/permissions';

const SCREEN_TITLES: Record<ScreenId, string> = {
  [ScreenId.LANDING]: 'الصفحة الرئيسية للمنصة',
  [ScreenId.LOGIN]: 'تسجيل الدخول',
  [ScreenId.ONBOARDING]: 'إعداد السنتر الجديد',
  [ScreenId.DASHBOARD]: 'الرئيسية',
  [ScreenId.STUDENTS]: 'الطلاب',
  [ScreenId.STUDENT_PROFILE]: 'ملف الطالب',
  [ScreenId.TEACHERS]: 'المدرسين',
  [ScreenId.TEACHER_PROFILE]: 'ملف المدرس',
  [ScreenId.GROUPS]: 'المجموعات الدراسية',
  [ScreenId.SCHEDULE]: 'الجدول الأسبوعي والقاعات',
  [ScreenId.TAKE_ATTENDANCE]: 'تسجيل الحضور',
  [ScreenId.ATTENDANCE_SUMMARY]: 'ملخص الحضور',
  [ScreenId.ATTENDANCE_HISTORY]: 'سجل الحضور',
  [ScreenId.PAYMENTS]: 'المدفوعات والفواتير',
  [ScreenId.LATE_PAYMENTS]: 'المتأخرون في الدفع',
  [ScreenId.EXPENSES]: 'المصروفات',
  [ScreenId.ASSESSMENTS]: 'التقييمات والامتحانات',
  [ScreenId.NOTIFICATIONS]: 'مركز الإشعارات',
  [ScreenId.REPORTS]: 'التقارير',
  [ScreenId.SETTINGS]: 'الإعدادات',
  [ScreenId.SUBSCRIPTION]: 'الاشتراك والباقات',
  [ScreenId.PARENT_PORTAL]: 'بوابة أولياء الأمور',
  [ScreenId.STUDENT_LOGIN]: 'دخول منصة الطالب',
  [ScreenId.STUDENT_PORTAL]: 'منصة الطالب',
  [ScreenId.DESIGN_SYSTEM]: 'نظام التصميم (EDUFLOW Components)',
};

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    currentScreen,
    navigate,
    authSession,
    currentActor,
    currentRole,
    canUseRoleSwitcher,
    setCurrentRole,
    logout,
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
    students,
    setSelectedStudentId,
    setSelectedTeacherId,
    centerSettings,
    updateCenterSettings,
    toasts,
    dismissToast,
  } = useEduflow();

  const [bellOpen, setBellOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);

  // Standalone full-bleed screens (Landing, Login, Onboarding, Parent Portal, Student Portal/Login, or any screen while logged in as Student)
  const isStandalone =
    currentScreen === ScreenId.LANDING ||
    currentScreen === ScreenId.LOGIN ||
    currentScreen === ScreenId.ONBOARDING ||
    currentScreen === ScreenId.PARENT_PORTAL ||
    currentScreen === ScreenId.STUDENT_LOGIN ||
    currentScreen === ScreenId.STUDENT_PORTAL ||
    currentRole === UserRole.STUDENT;

  if (isStandalone) {
    return (
      <div className="min-h-screen bg-[#F4F7FA] text-[#1E293B]">
        {children}
        <PdfExportModal />
        <ToastViewport toasts={toasts} onDismiss={dismissToast} />
      </div>
    );
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  const primarySidebarItems: {
    id: ScreenId;
    label: string;
    icon: React.ReactNode;
    matchIds?: ScreenId[];
    onSelect?: () => void;
  }[] = [
    { id: ScreenId.DASHBOARD, label: 'الرئيسية', icon: <Home className="w-4 h-4" /> },
    {
      id: ScreenId.STUDENTS,
      label: 'الطلاب',
      icon: <Users className="w-4 h-4" />,
      matchIds: [ScreenId.STUDENTS, ScreenId.STUDENT_PROFILE],
    },
    ...(currentRole === UserRole.TEACHER && currentActor?.teacherId
      ? [
          {
            id: ScreenId.TEACHER_PROFILE,
            label: 'مستحقاتي وحصصي',
            icon: <GraduationCap className="w-4 h-4" />,
            matchIds: [ScreenId.TEACHER_PROFILE],
            onSelect: () => {
              if (currentActor.teacherId) setSelectedTeacherId(currentActor.teacherId);
              navigate(ScreenId.TEACHER_PROFILE);
            },
          },
        ]
      : [
          {
            id: ScreenId.TEACHERS,
            label: 'المدرسين',
            icon: <GraduationCap className="w-4 h-4" />,
            matchIds: [ScreenId.TEACHERS, ScreenId.TEACHER_PROFILE],
          },
        ]),
    {
      id: ScreenId.GROUPS,
      label: 'المجموعات والجدول',
      icon: <CalendarDays className="w-4 h-4" />,
      matchIds: [ScreenId.GROUPS, ScreenId.SCHEDULE],
    },
    {
      id: ScreenId.TAKE_ATTENDANCE,
      label: 'الحضور',
      icon: <CheckSquare className="w-4 h-4" />,
      matchIds: [
        ScreenId.TAKE_ATTENDANCE,
        ScreenId.ATTENDANCE_SUMMARY,
        ScreenId.ATTENDANCE_HISTORY,
      ],
    },
    {
      id: ScreenId.PAYMENTS,
      label: 'المدفوعات',
      icon: <Wallet className="w-4 h-4" />,
      matchIds: [ScreenId.PAYMENTS, ScreenId.LATE_PAYMENTS, ScreenId.EXPENSES],
    },
    {
      id: ScreenId.ASSESSMENTS,
      label: 'التقييمات',
      icon: <BookOpen className="w-4 h-4" />,
    },
    {
      id: ScreenId.REPORTS,
      label: 'التقارير',
      icon: <BarChart3 className="w-4 h-4" />,
    },
    {
      id: ScreenId.SETTINGS,
      label: 'الإعدادات',
      icon: <Settings className="w-4 h-4" />,
      matchIds: [ScreenId.SETTINGS, ScreenId.SUBSCRIPTION],
    },
  ].filter((item) =>
    canAccessScreen(currentActor, item.id, {
      teacherId:
        item.id === ScreenId.TEACHER_PROFILE ? currentActor?.teacherId : undefined,
    })
  );

  const quickSearchStudents = globalSearch.trim()
    ? students
        .filter(
          (s) =>
            s.name.includes(globalSearch.trim()) ||
            s.parentPhone.includes(globalSearch.trim())
        )
        .slice(0, 5)
    : [];

  return (
    <div className="min-h-screen flex bg-[#F4F7FA] text-[#1E293B]">
      {/* Desktop Right-Side Navy Sidebar (220px, RTL first flex child = right side) */}
      <aside
        aria-label="القائمة الرئيسية"
        className="hidden lg:flex flex-col w-[220px] shrink-0 bg-[#0F2A4A] text-white sticky top-0 h-screen z-30 select-none"
      >
        <div className="h-16 px-4 flex items-center justify-between border-b border-white/10">
          <button
            type="button"
            onClick={() => navigate(ScreenId.DASHBOARD)}
            className="cursor-pointer text-right"
          >
            <EduflowLogo dark />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-1">
          {primarySidebarItems.map((item) => {
            const isActive = item.matchIds
              ? item.matchIds.includes(currentScreen)
              : currentScreen === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => (item.onSelect ? item.onSelect() : navigate(item.id))}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[8px] text-sm font-semibold transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[#0F766E] text-white'
                    : 'text-slate-200 hover:bg-white/10 hover:text-white'
                }`}
              >
                {item.icon}
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}

          <div className="pt-3 mt-3 border-t border-white/10 space-y-1">
            <p className="px-3 py-1 text-[11px] font-semibold text-slate-400">
              شاشات النظام والبوابات
            </p>
            <button
              type="button"
              onClick={() => navigate(ScreenId.LANDING)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-[8px] text-xs font-semibold text-slate-300 hover:bg-white/10 cursor-pointer"
            >
              <Home className="w-4 h-4" />
              <span>الصفحة الرئيسية للمنصة</span>
            </button>
            {canAccessScreen(currentActor, ScreenId.SUBSCRIPTION) && (
              <button
                type="button"
                onClick={() => navigate(ScreenId.SUBSCRIPTION)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-[8px] text-xs font-semibold transition-colors cursor-pointer ${
                  currentScreen === ScreenId.SUBSCRIPTION
                    ? 'bg-[#0F766E] text-white'
                    : 'text-slate-300 hover:bg-white/10'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                <span>الاشتراك والباقات</span>
              </button>
            )}
            {canAccessScreen(currentActor, ScreenId.PARENT_PORTAL) && (
              <button
                type="button"
                onClick={() => navigate(ScreenId.PARENT_PORTAL)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-[8px] text-xs font-semibold text-slate-300 hover:bg-white/10 cursor-pointer"
              >
                <UserCheck className="w-4 h-4" />
                <span>بوابة أولياء الأمور</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate(ScreenId.STUDENT_LOGIN)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-[8px] text-xs font-semibold text-slate-300 hover:bg-white/10 cursor-pointer"
            >
              <GraduationCap className="w-4 h-4" />
              <span>بوابة الطالب</span>
            </button>
            {canAccessScreen(currentActor, ScreenId.DESIGN_SYSTEM) && (
              <button
                type="button"
                onClick={() => navigate(ScreenId.DESIGN_SYSTEM)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-[8px] text-xs font-semibold transition-colors cursor-pointer ${
                  currentScreen === ScreenId.DESIGN_SYSTEM
                    ? 'bg-[#0F766E] text-white'
                    : 'text-slate-300 hover:bg-white/10'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>مكتبة المكونات</span>
              </button>
            )}
          </div>
        </nav>

        <div className="p-3 border-t border-white/10 text-xs text-slate-300">
          <p className="font-bold text-white truncate">{centerSettings.name}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            الصلاحية الحالية: {currentRole}
          </p>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col pb-16 lg:pb-0">
        {/* Subscription Status Banner (Screen 20: Grace Period / Failed / Read-Only) */}
        {centerSettings.billingBanner !== 'none' && (
          <div
            role="alert"
            className={`px-4 lg:px-6 py-2.5 text-xs font-bold flex flex-wrap items-center justify-between gap-2 ${
              centerSettings.billingBanner === 'grace_period'
                ? 'bg-[#FEF3C7] text-[#92400E] border-b border-amber-300'
                : 'bg-[#FEE2E2] text-[#991B1B] border-b border-red-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {centerSettings.billingBanner === 'read_only' ? (
                <ShieldAlert className="w-4 h-4 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              )}
              <span>
                {centerSettings.billingBanner === 'payment_failed' &&
                  'تعذر خصم قيمة التجديد الشهري للباقة. يرجى تحديث وسيلة الدفع لتجنب إيقاف الحساب.'}
                {centerSettings.billingBanner === 'grace_period' &&
                  'فترة السماح: باقي 5 أيام على تحويل الحساب للقراءة فقط. جدد اشتراكك الآن.'}
                {centerSettings.billingBanner === 'read_only' &&
                  'وضع القراءة فقط: انتهت صلاحية الاشتراك الحالي. يمكنك استعراض البيانات فقط لحين التجديد.'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate(ScreenId.SUBSCRIPTION)}
                className="underline font-bold cursor-pointer"
              >
                إدارة الاشتراك
              </button>
              <button
                type="button"
                onClick={() => updateCenterSettings({ billingBanner: 'none' })}
                aria-label="إخفاء الشريط"
                className="opacity-75 hover:opacity-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Top Bar: Page Title on Right; Search, Notifications Bell, User Menu on Left */}
        <header className="h-16 bg-white border-b border-[#E2E8F0] px-4 lg:px-6 flex items-center justify-between gap-4 sticky top-0 z-20">
          {/* Right Zone: Page Title */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="lg:hidden">
              <EduflowLogo dark={false} compact />
            </div>
            <h1 className="text-lg lg:text-[24px] font-bold text-[#0F2A4A] truncate">
              {SCREEN_TITLES[currentScreen]}
            </h1>
          </div>

          {/* Left Zone: Search + Notifications Bell + Role/User Menu */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Global Search */}
            <div className="relative hidden md:block w-64">
              <Search className="w-4 h-4 text-[#5B6B80] absolute right-3 top-3 pointer-events-none" />
              <input
                type="search"
                aria-label="بحث سريع عن طالب"
                placeholder="ابحث باسم الطالب أو الهاتف..."
                value={globalSearch}
                onFocus={() => setSearchDropdownOpen(true)}
                onBlur={() => setTimeout(() => setSearchDropdownOpen(false), 180)}
                onChange={(e) => {
                  setGlobalSearch(e.target.value);
                  setSearchDropdownOpen(true);
                }}
                className="w-full h-10 pr-9 pl-3 rounded-[8px] bg-[#F4F7FA] border border-[#E2E8F0] text-xs text-[#1E293B] focus:bg-white focus:outline-none focus:border-[#0F766E]"
              />
              {searchDropdownOpen && globalSearch.trim().length > 0 && (
                <div className="absolute left-0 right-0 top-11 bg-white border border-[#E2E8F0] rounded-[10px] shadow-lg overflow-hidden z-40">
                  {quickSearchStudents.length === 0 ? (
                    <div className="p-3 text-xs text-[#5B6B80] text-center">
                      لا توجد نتائج مطابقة
                    </div>
                  ) : (
                    quickSearchStudents.map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        onMouseDown={() => {
                          setSelectedStudentId(st.id);
                          setGlobalSearch('');
                          navigate(ScreenId.STUDENT_PROFILE);
                        }}
                        className="w-full px-3.5 py-2.5 text-right hover:bg-slate-50 flex items-center justify-between text-xs border-b last:border-b-0 border-slate-100 cursor-pointer"
                      >
                        <span className="font-bold text-[#1E293B]">{st.name}</span>
                        <span className="text-[#5B6B80] tabular-nums">{st.parentPhone}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Notifications Bell & Dropdown (#17) */}
            <div className="relative">
              <button
                type="button"
                aria-label="الإشعارات"
                aria-expanded={bellOpen}
                onClick={() => {
                  setBellOpen((o) => !o);
                  setUserMenuOpen(false);
                }}
                className="relative w-10 h-10 rounded-[8px] border border-[#E2E8F0] bg-white hover:bg-slate-50 flex items-center justify-center text-[#1E293B] cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -left-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#DC2626] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                    {unreadCount}
                  </span>
                )}
              </button>

              {bellOpen && (
                <div className="absolute left-0 mt-2 w-80 sm:w-96 bg-white border border-[#E2E8F0] rounded-[12px] shadow-xl z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#E2E8F0] flex items-center justify-between">
                    <span className="text-sm font-bold text-[#0F2A4A]">أحدث الإشعارات</span>
                    <button
                      type="button"
                      onClick={markAllNotificationsRead}
                      className="text-xs font-semibold text-[#0F766E] hover:underline cursor-pointer"
                    >
                      تحديد الكل كمقروء
                    </button>
                  </div>
                  <div className="divide-y divide-[#E2E8F0] max-h-80 overflow-y-auto">
                    {notifications.slice(0, 5).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          markNotificationRead(item.id);
                          if (item.targetStudentId) {
                            setSelectedStudentId(item.targetStudentId);
                          }
                          setBellOpen(false);
                          navigate(item.targetScreen);
                        }}
                        className={`w-full text-right px-4 py-3 hover:bg-slate-50 transition-colors flex items-start gap-3 cursor-pointer ${
                          !item.read ? 'bg-[#0F766E]/[0.04]' : ''
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-bold text-[#1E293B] truncate">
                              {item.title}
                            </p>
                            {!item.read && (
                              <span
                                className="w-2 h-2 rounded-full bg-[#0F766E] shrink-0"
                                aria-label="غير مقروء"
                              />
                            )}
                          </div>
                          <p className="text-xs text-[#5B6B80] line-clamp-2 mt-0.5">
                            {item.body}
                          </p>
                          <span className="text-[11px] text-[#5B6B80] mt-1 block">
                            {item.relativeTime}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="p-2.5 bg-slate-50 border-t border-[#E2E8F0] text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setBellOpen(false);
                        navigate(ScreenId.NOTIFICATIONS);
                      }}
                      className="text-xs font-bold text-[#0F2A4A] hover:text-[#0F766E] cursor-pointer"
                    >
                      عرض كل الإشعارات
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* User & Optional Owner Demo Role Switcher Menu */}
            <div className="relative">
              <button
                type="button"
                aria-label="قائمة المستخدم"
                aria-expanded={userMenuOpen}
                onClick={() => {
                  setUserMenuOpen((o) => !o);
                  setBellOpen(false);
                }}
                className="h-10 pl-3 pr-1.5 rounded-[8px] border border-[#E2E8F0] bg-white hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
              >
                <InitialAvatar
                  name={authSession?.name || 'محمود عبد الرحمن'}
                  size="sm"
                  tint="#0F2A4A"
                />
                <div className="hidden sm:block text-right leading-tight">
                  <span className="text-xs font-bold text-[#1E293B] block max-w-[120px] truncate">
                    {authSession?.name || 'أ. محمود'}
                  </span>
                  <span className="text-[10px] text-[#5B6B80] block">{currentRole}</span>
                </div>
              </button>

              {userMenuOpen && (
                <div className="absolute left-0 mt-2 w-64 bg-white border border-[#E2E8F0] rounded-[12px] shadow-xl z-50 overflow-hidden py-1.5">
                  <div className="px-3.5 py-2 border-b border-[#E2E8F0]">
                    <p className="text-xs font-bold text-[#0F2A4A] truncate">
                      {authSession?.name || 'أ. محمود عبد الرحمن'}
                    </p>
                    <p className="text-[11px] text-[#5B6B80]">
                      الصلاحية الحالية: {currentRole}
                    </p>
                  </div>

                  {canUseRoleSwitcher && (
                    <div className="px-3.5 py-2 border-b border-[#E2E8F0] bg-[#F4F7FA]">
                      <p className="text-xs font-bold text-[#0F2A4A]">معاينة كدور</p>
                      <p className="text-[11px] text-[#5B6B80]">
                        متاح للمالك فقط عند تفعيل وضع المعاينة
                      </p>
                      <div className="grid grid-cols-3 gap-1 mt-2">
                        {Object.values(UserRole)
                          .filter((role) => role !== UserRole.STUDENT)
                          .map((role) => (
                            <button
                              key={role}
                              type="button"
                              onClick={() => {
                                setCurrentRole(role);
                                setUserMenuOpen(false);
                              }}
                              className={`py-1 px-2 rounded text-[11px] font-bold border cursor-pointer ${
                                currentRole === role
                                  ? 'bg-[#0F766E] text-white border-[#0F766E]'
                                  : 'bg-white text-[#1E293B] border-[#E2E8F0]'
                              }`}
                            >
                              {role}
                            </button>
                          ))}
                      </div>
                    </div>
                  )}

                  {canAccessScreen(currentActor, ScreenId.SETTINGS) && (
                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        navigate(ScreenId.SETTINGS);
                      }}
                      className="w-full px-3.5 py-2 text-right text-xs font-semibold text-[#1E293B] hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                    >
                      <Settings className="w-4 h-4 text-[#0F766E]" />
                      <span>إعدادات السنتر والنسخ الاحتياطي</span>
                    </button>
                  )}
                  {canAccessScreen(currentActor, ScreenId.PARENT_PORTAL) && (
                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        navigate(ScreenId.PARENT_PORTAL);
                      }}
                      className="w-full px-3.5 py-2 text-right text-xs font-semibold text-[#1E293B] hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                    >
                      <UserCheck className="w-4 h-4 text-[#0F766E]" />
                      <span>بوابة أولياء الأمور</span>
                    </button>
                  )}
                  {canAccessScreen(currentActor, ScreenId.DESIGN_SYSTEM) && (
                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        navigate(ScreenId.DESIGN_SYSTEM);
                      }}
                      className="w-full px-3.5 py-2 text-right text-xs font-semibold text-[#1E293B] hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                    >
                      <Layers className="w-4 h-4 text-[#0F766E]" />
                      <span>مكتبة المكونات وبرومتات التصميم</span>
                    </button>
                  )}
                  <div className="my-1 border-t border-[#E2E8F0]" />
                  <button
                    type="button"
                    onClick={() => {
                      setUserMenuOpen(false);
                      logout();
                    }}
                    className="w-full px-3.5 py-2 text-right text-xs font-semibold text-[#991B1B] hover:bg-red-50 flex items-center gap-2 cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>تسجيل الخروج</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Content Container: Max-width 1200, 24px gutters */}
        <main className="flex-1 w-full max-w-[1200px] mx-auto px-4 sm:px-6 py-6">
          {children}
        </main>
      </div>

      {/* Mobile 390px Bottom Tab Bar */}
      {(() => {
        const mobileTabs = [
          { id: ScreenId.DASHBOARD, label: 'الرئيسية', icon: <Home className="w-5 h-5" /> },
          { id: ScreenId.STUDENTS, label: 'الطلاب', icon: <Users className="w-5 h-5" /> },
          {
            id: ScreenId.TAKE_ATTENDANCE,
            label: 'الحضور',
            icon: <CheckSquare className="w-5 h-5" />,
          },
          { id: ScreenId.PAYMENTS, label: 'المدفوعات', icon: <Wallet className="w-5 h-5" /> },
        ].filter((t) => canAccessScreen(currentActor, t.id));
        const colClass =
          mobileTabs.length === 4
            ? 'grid-cols-5'
            : mobileTabs.length === 3
            ? 'grid-cols-4'
            : mobileTabs.length === 2
            ? 'grid-cols-3'
            : 'grid-cols-2';
        return (
          <nav
            aria-label="التنقل السفلي للموبايل"
            className={`lg:hidden fixed bottom-0 inset-x-0 h-16 bg-white border-t border-[#E2E8F0] grid ${colClass} z-30`}
          >
            {mobileTabs.map((tab) => {
              const active = currentScreen === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setMobileMoreOpen(false);
                    navigate(tab.id);
                  }}
                  className={`flex flex-col items-center justify-center gap-1 text-[11px] font-bold cursor-pointer ${
                    active ? 'text-[#0F766E]' : 'text-[#5B6B80]'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setMobileMoreOpen(true)}
              className={`flex flex-col items-center justify-center gap-1 text-[11px] font-bold cursor-pointer ${
                mobileMoreOpen ? 'text-[#0F766E]' : 'text-[#5B6B80]'
              }`}
            >
              <MoreHorizontal className="w-5 h-5" />
              <span>المزيد</span>
            </button>
          </nav>
        );
      })()}

      {/* Mobile "المزيد" Bottom Sheet */}
      {mobileMoreOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-slate-900/45 flex flex-col justify-end"
          role="dialog"
          aria-modal="true"
          aria-label="المزيد من الأقسام"
        >
          <div className="bg-white rounded-t-[16px] p-5 space-y-3 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]">
              <span className="text-base font-bold text-[#0F2A4A]">جميع أقسام السنتر</span>
              <button
                type="button"
                onClick={() => setMobileMoreOpen(false)}
                aria-label="إغلاق القائمة"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#5B6B80]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { id: ScreenId.TEACHERS, label: 'المدرسين', icon: <GraduationCap className="w-4 h-4" /> },
                ...(currentRole === UserRole.TEACHER && currentActor?.teacherId
                  ? [
                      {
                        id: ScreenId.TEACHER_PROFILE,
                        label: 'مستحقاتي وحصصي',
                        icon: <GraduationCap className="w-4 h-4" />,
                        onSelect: () => {
                          if (currentActor.teacherId) setSelectedTeacherId(currentActor.teacherId);
                          navigate(ScreenId.TEACHER_PROFILE);
                        },
                      },
                    ]
                  : []),
                { id: ScreenId.GROUPS, label: 'المجموعات', icon: <Users className="w-4 h-4" /> },
                { id: ScreenId.SCHEDULE, label: 'الجدول الأسبوعي', icon: <CalendarDays className="w-4 h-4" /> },
                { id: ScreenId.ATTENDANCE_HISTORY, label: 'سجل الحضور', icon: <FileSpreadsheet className="w-4 h-4" /> },
                { id: ScreenId.LATE_PAYMENTS, label: 'المتأخرون في الدفع', icon: <AlertTriangle className="w-4 h-4" /> },
                { id: ScreenId.EXPENSES, label: 'المصروفات', icon: <Receipt className="w-4 h-4" /> },
                { id: ScreenId.ASSESSMENTS, label: 'التقييمات والامتحانات', icon: <BookOpen className="w-4 h-4" /> },
                { id: ScreenId.NOTIFICATIONS, label: 'مركز الإشعارات', icon: <Bell className="w-4 h-4" /> },
                { id: ScreenId.REPORTS, label: 'التقارير', icon: <BarChart3 className="w-4 h-4" /> },
                { id: ScreenId.SETTINGS, label: 'الإعدادات', icon: <Settings className="w-4 h-4" /> },
                { id: ScreenId.SUBSCRIPTION, label: 'الاشتراك والباقات', icon: <CreditCard className="w-4 h-4" /> },
                { id: ScreenId.PARENT_PORTAL, label: 'بوابة ولي الأمر', icon: <UserCheck className="w-4 h-4" /> },
                { id: ScreenId.DESIGN_SYSTEM, label: 'مكتبة المكونات', icon: <Layers className="w-4 h-4" /> },
                { id: ScreenId.LANDING, label: 'الصفحة الرئيسية للمنصة', icon: <Home className="w-4 h-4" /> },
              ]
                .filter((item) =>
                  canAccessScreen(currentActor, item.id, {
                    teacherId:
                      item.id === ScreenId.TEACHER_PROFILE
                        ? currentActor?.teacherId
                        : undefined,
                  })
                )
                .map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setMobileMoreOpen(false);
                      if ('onSelect' in item && item.onSelect) item.onSelect();
                      else navigate(item.id);
                    }}
                    className="flex items-center gap-2.5 p-3 rounded-[10px] border border-[#E2E8F0] text-right text-xs font-bold text-[#1E293B] hover:bg-slate-50"
                  >
                    <span className="text-[#0F766E]">{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Global Drawers & Modals */}
      <StudentFormDrawer />
      <RecordPaymentDrawerAndReceipt />
      <GroupFormDrawer />
      <GlobalLockedFeatureModal />
      <PdfExportModal />
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};
