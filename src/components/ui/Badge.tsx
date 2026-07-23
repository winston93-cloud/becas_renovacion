import type { ReactNode } from 'react';

/**
 * 2026-07-16 - Badges de estado (pendiente, subido, ciclo).
 */
type Variant = 'neutral' | 'pending' | 'success' | 'primary';

type Props = {
  children: ReactNode;
  variant?: Variant;
  className?: string;
};

const variants: Record<Variant, string> = {
  neutral: 'bg-bg text-text-secondary border-border',
  pending: 'bg-warning-bg text-warning border-warning/20',
  success: 'bg-success-bg text-success border-success/20',
  primary: 'bg-primary-light text-primary border-primary/15',
};

export function Badge({ children, variant = 'neutral', className = '' }: Props) {
  return (
    <span
      className={[
        'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium',
        variants[variant],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </span>
  );
}
