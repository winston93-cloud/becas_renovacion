import type { InputHTMLAttributes, ReactNode } from 'react';

/**
 * 2026-07-16 - Checkbox compacto y elegante.
 */
type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: ReactNode;
};

export function Checkbox({ label, className = '', id, ...props }: Props) {
  const inputId = id || props.name;
  return (
    <label
      htmlFor={inputId}
      className={`inline-flex cursor-pointer items-start gap-2.5 text-sm text-text ${className}`}
    >
      <input
        id={inputId}
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded-[4px] border-border accent-primary transition duration-[180ms] focus-visible:outline-none focus-visible:shadow-focus disabled:cursor-not-allowed disabled:opacity-50"
        {...props}
      />
      <span>{label}</span>
    </label>
  );
}
