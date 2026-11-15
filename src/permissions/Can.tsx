import React from 'react';
import { ShieldAlert, ArrowRight } from 'lucide-react';
import { useEduflow } from '../context/EduflowContext';
import { ScreenId, UserRole } from '../types/eduflow';
import {
  can,
  getDefaultHomeScreen,
  PermissionAction,
  PermissionContext,
  PermissionResource,
} from './permissions';
import { Button, Card } from '../components/ui/Primitives';

interface CanProps {
  action: PermissionAction;
  resource: PermissionResource;
  context?: PermissionContext;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export const Can: React.FC<CanProps> = ({
  action,
  resource,
  context,
  fallback = null,
  children,
}) => {
  const { currentActor, groups, students } = useEduflow();

  const mergedContext: PermissionContext = {
    groups,
    students,
    ...context,
  };

  if (!can(currentActor, action, resource, mergedContext)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

interface AccessDeniedScreenProps {
  reason?: string;
}

export const AccessDeniedScreen: React.FC<AccessDeniedScreenProps> = ({
  reason = 'ليس لديك صلاحية للوصول إلى هذه الصفحة أو عرض بياناتها.',
}) => {
  const { currentActor, currentRole, navigate } = useEduflow();
  const homeScreen = getDefaultHomeScreen(currentActor);

  return (
    <div className="min-h-[60vh] py-12 flex items-center justify-center px-4">
      <Card className="max-w-lg w-full p-8 text-center space-y-4">
        <div className="w-14 h-14 mx-auto rounded-full bg-[#FEE2E2] text-[#991B1B] flex items-center justify-center">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-lg font-bold text-[#0F2A4A]">صلاحية غير متاحة</h2>
          <p className="text-sm text-[#5B6B80]">{reason}</p>
          <p className="text-xs text-[#5B6B80]">
            الدور الحالي:{' '}
            <span className="font-bold text-[#0F2A4A]">{currentRole}</span>
          </p>
        </div>
        <div className="pt-2 flex justify-center">
          <Button onClick={() => navigate(homeScreen)} icon={<ArrowRight className="w-4 h-4" />}>
            {currentRole === UserRole.STUDENT || homeScreen === ScreenId.STUDENT_PORTAL
              ? 'العودة إلى بوابة الطالب'
              : 'العودة إلى الصفحة المتاحة'}
          </Button>
        </div>
      </Card>
    </div>
  );
};
