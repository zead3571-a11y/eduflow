import React from 'react';
import { EduflowProvider, useEduflow } from './context/EduflowContext';
import { ScreenId } from './types/eduflow';
import { AppShell } from './components/layout/AppShell';
import { LandingScreen } from './components/screens/LandingScreen';
import { LoginScreen, OnboardingScreen } from './components/screens/AuthScreens';
import { DashboardScreen } from './components/screens/DashboardScreen';
import {
  StudentProfileScreen,
  StudentsListScreen,
} from './components/screens/StudentsScreens';
import {
  TeacherProfileScreen,
  TeachersListScreen,
} from './components/screens/TeachersScreens';
import {
  GroupsListScreen,
  WeeklyScheduleScreen,
} from './components/screens/GroupsAndScheduleScreens';
import {
  AttendanceHistoryScreen,
  AttendanceSummaryScreen,
  TakeAttendanceScreen,
} from './components/screens/AttendanceScreens';
import {
  ExpensesScreen,
  LatePaymentsScreen,
  PaymentsScreen,
} from './components/screens/FinanceScreens';
import { AssessmentsScreen } from './components/screens/AssessmentsScreen';
import {
  NotificationsScreen,
  ReportsScreen,
} from './components/screens/NotificationsAndReportsScreens';
import {
  SettingsScreen,
  SubscriptionScreen,
} from './components/screens/SettingsAndSubscriptionScreens';
import { ParentPortalScreen } from './components/screens/ParentPortalScreen';
import {
  StudentLoginScreen,
  StudentPortalScreen,
} from './components/screens/StudentPortalScreens';
import { DesignSystemScreen } from './components/screens/DesignSystemScreen';

import { canAccessScreen } from './permissions/permissions';
import { AccessDeniedScreen } from './permissions/Can';

const ScreenRouter: React.FC = () => {
  const { currentScreen, currentActor, selectedTeacherId } = useEduflow();

  if (
    !canAccessScreen(currentActor, currentScreen, {
      teacherId: currentScreen === ScreenId.TEACHER_PROFILE ? selectedTeacherId : undefined,
    })
  ) {
    return <AccessDeniedScreen />;
  }

  switch (currentScreen) {
    case ScreenId.LANDING:
      return <LandingScreen />;
    case ScreenId.LOGIN:
      return <LoginScreen />;
    case ScreenId.ONBOARDING:
      return <OnboardingScreen />;
    case ScreenId.DASHBOARD:
      return <DashboardScreen />;
    case ScreenId.STUDENTS:
      return <StudentsListScreen />;
    case ScreenId.STUDENT_PROFILE:
      return <StudentProfileScreen />;
    case ScreenId.TEACHERS:
      return <TeachersListScreen />;
    case ScreenId.TEACHER_PROFILE:
      return <TeacherProfileScreen />;
    case ScreenId.GROUPS:
      return <GroupsListScreen />;
    case ScreenId.SCHEDULE:
      return <WeeklyScheduleScreen />;
    case ScreenId.TAKE_ATTENDANCE:
      return <TakeAttendanceScreen />;
    case ScreenId.ATTENDANCE_SUMMARY:
      return <AttendanceSummaryScreen />;
    case ScreenId.ATTENDANCE_HISTORY:
      return <AttendanceHistoryScreen />;
    case ScreenId.PAYMENTS:
      return <PaymentsScreen />;
    case ScreenId.LATE_PAYMENTS:
      return <LatePaymentsScreen />;
    case ScreenId.EXPENSES:
      return <ExpensesScreen />;
    case ScreenId.ASSESSMENTS:
      return <AssessmentsScreen />;
    case ScreenId.NOTIFICATIONS:
      return <NotificationsScreen />;
    case ScreenId.REPORTS:
      return <ReportsScreen />;
    case ScreenId.SETTINGS:
      return <SettingsScreen />;
    case ScreenId.SUBSCRIPTION:
      return <SubscriptionScreen />;
    case ScreenId.PARENT_PORTAL:
      return <ParentPortalScreen />;
    case ScreenId.STUDENT_LOGIN:
      return <StudentLoginScreen />;
    case ScreenId.STUDENT_PORTAL:
      return <StudentPortalScreen />;
    case ScreenId.DESIGN_SYSTEM:
      return <DesignSystemScreen />;
    default:
      return <DashboardScreen />;
  }
};

export default function App() {
  return (
    <EduflowProvider>
      <AppShell>
        <ScreenRouter />
      </AppShell>
    </EduflowProvider>
  );
}
