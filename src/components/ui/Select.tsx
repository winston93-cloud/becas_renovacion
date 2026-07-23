import type { SelectHTMLAttributes, ReactNode } from 'react';

/**
 * 2026-07-16 - Select estilizado (sin apariencia nativa del navegador).
 */
type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  children: ReactNode;
  error?: boolean;
};

export function Select({ error, className = '', children, ...props }: Props) {
  return (
    <select
      className={[
        'ui-control ui-select',
        error ? 'ui-control-error' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {children}
    </select>
  );
}
