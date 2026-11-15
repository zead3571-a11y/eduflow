import React from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Inbox,
  Info,
  Lock,
  Loader2,
  RefreshCw,
  X,
} from 'lucide-react';
import { getInitials } from '../../utils/eduflowLogic';
import { ListStateMode } from '../../types/eduflow';

export const EduflowLogo: React.FC<{ dark?: boolean; compact?: boolean }> = ({
  dark = true,
  compact = false,
}) => (
  <div className="inline-flex items-center gap-2.5 select-none">
    <div
      className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-base tracking-tight shrink-0 ${
        dark ? 'bg-[#0F766E] text-white' : 'bg-[#0F2A4A] text-white'
      }`}
      aria-hidden="true"
    >
      EF
    </div>
    {!compact && (
      <div className="flex flex-col leading-none">
        <span
          className={`text-lg font-bold tracking-tight ${
            dark ? 'text-white' : 'text-[#0F2A4A]'
          }`}
        >
          EDUFLOW
        </span>
      </div>
    )}
  </div>
);

export const InitialAvatar: React.FC<{
  name: string;
  size?: 'sm' | 'md' | 'lg';
  tint?: string;
}> = ({ name, size = 'md', tint }) => {
  const sizeClasses =
    size === 'sm'
      ? 'w-8 h-8 text-xs'
      : size === 'lg'
      ? 'w-14 h-14 text-lg'
      : 'w-10 h-10 text-xs';
  return (
    <div
      className={`${sizeClasses} rounded-full font-bold flex items-center justify-center shrink-0 select-none ${
        tint ? 'text-white' : 'bg-[#0F2A4A]/10 text-[#0F2A4A]'
      }`}
      style={tint ? { backgroundColor: tint } : undefined}
      aria-hidden="true"
    >
      {getInitials(name)}
    </div>
  );
};

export type SemanticChipTone = 'success' | 'danger' | 'warning' | 'neutral' | 'navy';

export const StatusChip: React.FC<{
  tone: SemanticChipTone;
  label: string;
}> = ({ tone, label }) => {
  const map: Record<SemanticChipTone, string> = {
    success: 'bg-[#D1FAE5] text-[#065F46]',
    danger: 'bg-[#FEE2E2] text-[#991B1B]',
    warning: 'bg-[#FEF3C7] text-[#92400E]',
    neutral: 'bg-slate-100 text-[#5B6B80]',
    navy: 'bg-[#0F2A4A]/10 text-[#0F2A4A]',
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 ${map[tone]}`}
    >
      {label}
    </span>
  );
};

export function paymentStatusChipProps(status: 'paid' | 'partial' | 'pending' | 'overdue'): {
  tone: SemanticChipTone;
  label: string;
} {
  switch (status) {
    case 'paid':
      return { tone: 'success', label: 'مدفوع' };
    case 'partial':
      return { tone: 'warning', label: 'جزئي' };
    case 'pending':
      return { tone: 'warning', label: 'مستحق' };
    case 'overdue':
      return { tone: 'danger', label: 'متأخر' };
  }
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'destructive' | 'ghost';
  size?: 'md' | 'sm';
  loading?: boolean;
  soon?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  soon = false,
  icon,
  children,
  disabled,
  className = '',
  type = 'button',
  ...rest
}) => {
  const isDisabled = disabled || loading || soon;
  const heightClass = size === 'sm' ? 'min-h-[38px] px-3 py-1.5 text-xs' : 'min-h-[44px] px-4 py-2.5 text-sm';

  const variantClasses: Record<NonNullable<ButtonProps['variant']>, string> = {
    primary:
      'bg-[#0F766E] text-white hover:bg-[#0D655E] focus-visible:ring-2 focus-visible:ring-[#0F766E]/40 disabled:bg-[#0F766E]/50 disabled:text-white/90',
    secondary:
      'bg-white text-[#1E293B] border border-[#E2E8F0] hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-[#0F766E]/30 disabled:bg-slate-50 disabled:text-[#5B6B80]',
    destructive:
      'bg-[#DC2626] text-white hover:bg-[#B91C1C] focus-visible:ring-2 focus-visible:ring-red-400 disabled:bg-red-300',
    ghost:
      'bg-transparent text-[#1E293B] hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-slate-300 disabled:text-[#5B6B80]',
  };

  return (
    <button
      type={type}
      disabled={isDisabled}
      className={`inline-flex items-center justify-center gap-2 rounded-[8px] font-semibold transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer disabled:cursor-not-allowed focus:outline-none ${heightClass} ${variantClasses[variant]} ${className}`}
      {...rest}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : icon}
      <span>{children}</span>
      {soon && (
        <span className="px-1.5 py-0.5 text-[11px] font-bold rounded bg-[#FEF3C7] text-[#92400E] mr-0.5">
          قريباً
        </span>
      )}
    </button>
  );
};

export const Card: React.FC<{
  children: React.ReactNode;
  className?: string;
  padding?: string;
}> = ({ children, className = '', padding = 'p-5' }) => (
  <div
    className={`bg-white border border-[#E2E8F0] rounded-[12px] ${padding} ${className}`}
  >
    {children}
  </div>
);

export const Field: React.FC<{
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}> = ({ label, htmlFor, error, hint, required, children }) => (
  <div className="flex flex-col gap-1.5">
    <label
      htmlFor={htmlFor}
      className="text-xs font-bold text-[#1E293B] flex items-center gap-1"
    >
      <span>{label}</span>
      {required && <span className="text-[#DC2626]">*</span>}
    </label>
    {children}
    {error ? (
      <p className="text-xs text-[#991B1B] font-medium flex items-center gap-1">
        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
        <span>{error}</span>
      </p>
    ) : hint ? (
      <p className="text-xs text-[#5B6B80]">{hint}</p>
    ) : null}
  </div>
);

export const TextInput: React.FC<
  React.InputHTMLAttributes<HTMLInputElement> & { hasError?: boolean }
> = ({ hasError, className = '', ...props }) => (
  <input
    className={`w-full h-[44px] px-3.5 rounded-[8px] bg-white border text-sm text-[#1E293B] placeholder:text-[#5B6B80]/70 transition-colors focus:outline-none focus:ring-2 ${
      hasError
        ? 'border-[#DC2626] focus:ring-[#DC2626]/20'
        : 'border-[#E2E8F0] focus:border-[#0F766E] focus:ring-[#0F766E]/20'
    } disabled:bg-slate-100 disabled:text-[#5B6B80] ${className}`}
    {...props}
  />
);

export const SelectInput: React.FC<
  React.SelectHTMLAttributes<HTMLSelectElement> & { hasError?: boolean }
> = ({ hasError, className = '', children, ...props }) => (
  <select
    className={`w-full h-[44px] px-3 rounded-[8px] bg-white border text-sm text-[#1E293B] transition-colors focus:outline-none focus:ring-2 ${
      hasError
        ? 'border-[#DC2626] focus:ring-[#DC2626]/20'
        : 'border-[#E2E8F0] focus:border-[#0F766E] focus:ring-[#0F766E]/20'
    } disabled:bg-slate-100 ${className}`}
    {...props}
  >
    {children}
  </select>
);

export const Drawer: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
  wide?: boolean;
}> = ({ open, onClose, title, subtitle, footer, children, wide = false }) => {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex justify-start bg-slate-900/40 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={`relative bg-white h-full w-full ${
          wide ? 'sm:max-w-[560px]' : 'sm:max-w-[460px]'
        } border-l border-[#E2E8F0] flex flex-col shadow-xl`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0] shrink-0">
          <div>
            <h2 className="text-base font-bold text-[#0F2A4A]">{title}</h2>
            {subtitle && <p className="text-xs text-[#5B6B80] mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق اللوحة"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-[#5B6B80] hover:bg-slate-100 hover:text-[#1E293B] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">{children}</div>
        {footer && (
          <div className="px-5 py-3.5 border-t border-[#E2E8F0] bg-white flex items-center justify-end gap-2.5 shrink-0">
            {footer}
          </div>
        )}
      </div>
      <div className="flex-1" onClick={onClose} aria-hidden="true" />
    </div>
  );
};

export const Modal: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
}> = ({ open, onClose, title, children, footer, maxWidth = 'max-w-lg' }) => {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={`bg-white border border-[#E2E8F0] rounded-[12px] w-full ${maxWidth} overflow-hidden shadow-xl`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
          <h2 className="text-base font-bold text-[#0F2A4A]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق النافذة"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-[#5B6B80] hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 max-h-[75vh] overflow-y-auto">{children}</div>
        {footer && (
          <div className="px-5 py-3.5 border-t border-[#E2E8F0] bg-slate-50/70 flex items-center justify-end gap-2.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export const EmptyState: React.FC<{
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}> = ({ title, description, actionLabel, onAction, icon }) => (
  <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-10 text-center flex flex-col items-center justify-center">
    <div className="w-12 h-12 rounded-full bg-[#F4F7FA] text-[#5B6B80] flex items-center justify-center mb-3">
      {icon || <Inbox className="w-6 h-6" />}
    </div>
    <h3 className="text-base font-bold text-[#0F2A4A]">{title}</h3>
    <p className="text-sm text-[#5B6B80] max-w-md mt-1">{description}</p>
    {actionLabel && onAction && (
      <div className="mt-4">
        <Button onClick={onAction}>{actionLabel}</Button>
      </div>
    )}
  </div>
);

export const ErrorState: React.FC<{
  title?: string;
  description?: string;
  onRetry: () => void;
}> = ({
  title = 'تعذر تحميل البيانات',
  description = 'حدث خطأ أثناء الاتصال بالخادم. يرجى المحاولة مرة أخرى.',
  onRetry,
}) => (
  <div className="bg-white border border-[#FEE2E2] rounded-[12px] p-8 text-center flex flex-col items-center">
    <div className="w-12 h-12 rounded-full bg-[#FEE2E2] text-[#991B1B] flex items-center justify-center mb-3">
      <AlertCircle className="w-6 h-6" />
    </div>
    <h3 className="text-base font-bold text-[#991B1B]">{title}</h3>
    <p className="text-sm text-[#5B6B80] max-w-md mt-1">{description}</p>
    <div className="mt-4">
      <Button
        variant="secondary"
        onClick={onRetry}
        icon={<RefreshCw className="w-4 h-4" />}
      >
        إعادة المحاولة
      </Button>
    </div>
  </div>
);

export const TableSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => (
  <div
    className="bg-white border border-[#E2E8F0] rounded-[12px] overflow-hidden"
    aria-busy="true"
    aria-label="جاري التحميل"
  >
    <div className="h-11 bg-slate-50 border-b border-[#E2E8F0] px-4 flex items-center gap-6">
      <div className="h-3 w-28 bg-slate-200 rounded animate-pulse" />
      <div className="h-3 w-24 bg-slate-200 rounded animate-pulse" />
      <div className="h-3 w-20 bg-slate-200 rounded animate-pulse" />
      <div className="h-3 w-24 bg-slate-200 rounded animate-pulse mr-auto" />
    </div>
    <div className="divide-y divide-[#E2E8F0]">
      {Array.from({ length: rows }).map((_, idx) => (
        <div key={idx} className="h-[56px] px-4 flex items-center gap-4">
          <div className="w-9 h-9 rounded-full bg-slate-200 animate-pulse shrink-0" />
          <div className="space-y-2 flex-1">
            <div className="h-3 w-40 bg-slate-200 rounded animate-pulse" />
            <div className="h-2.5 w-24 bg-slate-100 rounded animate-pulse" />
          </div>
          <div className="h-6 w-16 bg-slate-100 rounded-full animate-pulse" />
          <div className="h-3 w-20 bg-slate-200 rounded animate-pulse" />
        </div>
      ))}
    </div>
  </div>
);

export const ListStateSwitcher: React.FC<{
  mode: ListStateMode;
  onChange: (m: ListStateMode) => void;
}> = ({ mode, onChange }) => (
  <div
    className="inline-flex items-center gap-1 p-1 bg-slate-100 border border-[#E2E8F0] rounded-[8px] text-xs"
    role="group"
    aria-label="معاينة حالات القائمة"
  >
    {(
      [
        { id: 'ready', label: 'البيانات' },
        { id: 'loading', label: 'تحميل' },
        { id: 'empty', label: 'فارغ' },
        { id: 'error', label: 'خطأ' },
      ] as const
    ).map((item) => (
      <button
        key={item.id}
        type="button"
        onClick={() => onChange(item.id)}
        className={`px-2.5 py-1 rounded-[6px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
          mode === item.id
            ? 'bg-white text-[#0F2A4A] shadow-xs'
            : 'text-[#5B6B80] hover:text-[#1E293B]'
        }`}
      >
        {item.label}
      </button>
    ))}
  </div>
);

export const LockedFeatureCard: React.FC<{
  featureName: string;
  planName: string;
  description?: string;
  onUpgrade: () => void;
}> = ({ featureName, planName, description, onUpgrade }) => (
  <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-8 max-w-md mx-auto text-center shadow-lg">
    <div className="w-12 h-12 rounded-full bg-[#0F2A4A]/10 text-[#0F2A4A] flex items-center justify-center mx-auto mb-3">
      <Lock className="w-6 h-6" />
    </div>
    <h3 className="text-base font-bold text-[#0F2A4A]">{featureName}</h3>
    <p className="text-sm text-[#5B6B80] mt-1.5">
      {description || `هذه الميزة متاحة ضمن ${planName}. قم بترقية باقتك الحالية للوصول الفوري.`}
    </p>
    <div className="mt-3 text-xs font-semibold text-[#0F766E]">
      تُفتح في: {planName}
    </div>
    <div className="mt-5">
      <Button onClick={onUpgrade} className="w-full">
        ترقية الباقة
      </Button>
    </div>
  </div>
);

export const ToastViewport: React.FC<{
  toasts: { id: string; title: string; type: 'success' | 'error' | 'info' }[];
  onDismiss: (id: string) => void;
}> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-20 md:bottom-6 left-6 z-[60] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-[10px] border shadow-lg bg-white ${
            t.type === 'error'
              ? 'border-[#FEE2E2] text-[#991B1B]'
              : t.type === 'info'
              ? 'border-[#E2E8F0] text-[#0F2A4A]'
              : 'border-[#D1FAE5] text-[#065F46]'
          }`}
        >
          {t.type === 'error' ? (
            <AlertCircle className="w-5 h-5 shrink-0 text-[#DC2626]" />
          ) : t.type === 'info' ? (
            <Info className="w-5 h-5 shrink-0 text-[#0F2A4A]" />
          ) : (
            <CheckCircle2 className="w-5 h-5 shrink-0 text-[#0F766E]" />
          )}
          <span className="text-sm font-semibold text-[#1E293B] flex-1">{t.title}</span>
          <button
            type="button"
            onClick={() => onDismiss(t.id)}
            aria-label="إغلاق التنبيه"
            className="text-[#5B6B80] hover:text-[#1E293B] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};
