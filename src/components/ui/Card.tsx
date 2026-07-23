import type { HTMLAttributes, ReactNode } from 'react';

/**
 * 2026-07-16 - Card blanca con borde sutil y sombra ligera.
 */
type Props = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  hover?: boolean;
  padding?: boolean;
};

export function Card({
  children,
  hover = false,
  padding = true,
  className = '',
  ...props
}: Props) {
  return (
    <div
      className={[
        'rounded-[12px] border border-border bg-card shadow-card',
        padding ? 'p-6 sm:p-8' : '',
        hover
          ? 'transition duration-[180ms] hover:shadow-card-hover'
          : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {children}
    </div>
  );
}
