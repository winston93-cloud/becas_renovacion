import type { InputHTMLAttributes, ReactNode } from 'react';

/**
 * 2026-07-16 - Radio compacto alineado al Checkbox.
 */
type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: ReactNode;
};

export function Radio({ label, className = '', id, ...props }: Props) {
  const inputId = id || `${props.name}-${props.value}`;
  return (
    <label
      htmlFor={inputId}
      className={`inline-flex cursor-pointer items-center gap-2.5 text-sm text-text ${className}`}
    >
      <input
        id={String(inputId)}
        type="radio"
        className="h-4 w-4 shrink-0 cursor-pointer border-border accent-primary transition duration-[180ms] focus-visible:outline-none focus-visible:shadow-focus disabled:cursor-not-allowed disabled:opacity-50"
        {...props}
      />
      <span>{label}</span>
    </label>
  );
}
