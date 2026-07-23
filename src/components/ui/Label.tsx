import type { LabelHTMLAttributes, ReactNode } from 'react';

/**
 * 2026-07-16 - Label tipográfico del design system institucional.
 */
type Props = LabelHTMLAttributes<HTMLLabelElement> & {
  children: ReactNode;
  hint?: string;
  required?: boolean;
};

export function Label({ children, hint, required, className = '', ...props }: Props) {
  return (
    <label
      className={`mb-1.5 block text-sm font-medium text-text ${className}`}
      {...props}
    >
      {children}
      {required && <span className="ml-0.5 text-error">*</span>}
      {hint && (
        <span className="mt-0.5 block text-xs font-normal text-text-secondary">
          {hint}
        </span>
      )}
    </label>
  );
}
