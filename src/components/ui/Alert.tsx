import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info, AlertTriangle } from 'lucide-react';

/**
 * 2026-07-16 - Alertas tipadas del design system.
 */
type Variant = 'error' | 'warning' | 'success' | 'info';

type Props = {
  variant?: Variant;
  title?: string;
  children: ReactNode;
  className?: string;
};

const styles: Record<Variant, { box: string; icon: typeof Info }> = {
  error: {
    box: 'border-error/25 bg-error-bg text-error',
    icon: AlertCircle,
  },
  warning: {
    box: 'border-warning/25 bg-warning-bg text-warning',
    icon: AlertTriangle,
  },
  success: {
    box: 'border-success/25 bg-success-bg text-success',
    icon: CheckCircle2,
  },
  info: {
    box: 'border-border bg-primary-light text-primary',
    icon: Info,
  },
};

export function Alert({
  variant = 'info',
  title,
  children,
  className = '',
}: Props) {
  const { box, icon: Icon } = styles[variant];
  return (
    <div
      role="alert"
      className={`flex gap-3 rounded-[12px] border px-4 py-3 text-sm ${box} ${className}`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0">
        {title && <p className="mb-0.5 font-semibold">{title}</p>}
        <div className="text-[0.925em] opacity-90">{children}</div>
      </div>
    </div>
  );
}
