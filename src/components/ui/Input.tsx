import type { InputHTMLAttributes } from 'react';

/**
 * 2026-07-16 - Input premium con estados focus/error del design system.
 */
type Props = InputHTMLAttributes<HTMLInputElement> & {
  error?: boolean;
};

export function Input({ error, className = '', ...props }: Props) {
  return (
    <input
      className={[
        'ui-control',
        error ? 'ui-control-error' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    />
  );
}
