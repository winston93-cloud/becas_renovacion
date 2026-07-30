import { forwardRef, type InputHTMLAttributes } from 'react';

/**
 * 2026-07-16 - Input premium con estados focus/error del design system.
 */
type Props = InputHTMLAttributes<HTMLInputElement> & {
  error?: boolean;
};

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { error, className = '', ...props },
  ref
) {
  return (
    <input
      ref={ref}
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
});
