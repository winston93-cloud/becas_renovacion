import type { ButtonHTMLAttributes, ReactNode } from 'react';

/**
 * 2026-07-16 - Botones primary/secondary/ghost del portal institucional.
 * 2026-07-18 - Press sutil (active scale) con ease institucional.
 */
type Variant = 'primary' | 'secondary' | 'ghost';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  children: ReactNode;
  fullWidth?: boolean;
};

const variants: Record<Variant, string> = {
  primary:
    'bg-primary text-white hover:bg-primary-hover hover:-translate-y-px hover:shadow-card disabled:hover:translate-y-0 disabled:hover:shadow-none',
  secondary:
    'border border-border bg-card text-text hover:bg-primary-light',
  ghost: 'bg-transparent text-text-secondary hover:bg-primary-light hover:text-text',
};

export function Button({
  variant = 'primary',
  children,
  fullWidth,
  className = '',
  type = 'button',
  ...props
}: Props) {
  return (
    <button
      type={type}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-[12px] px-5 py-2.5 text-sm font-semibold transition duration-[180ms] ease-[cubic-bezier(0.25,1,0.5,1)]',
        'active:scale-[0.98] disabled:active:scale-100',
        'focus-visible:outline-none focus-visible:shadow-focus',
        'disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        fullWidth ? 'w-full' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {children}
    </button>
  );
}
