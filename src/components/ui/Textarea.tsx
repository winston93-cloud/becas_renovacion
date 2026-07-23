import type { TextareaHTMLAttributes } from 'react';

/**
 * 2026-07-16 - Textarea alineado al estilo de Input.
 */
type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  error?: boolean;
};

export function Textarea({ error, className = '', ...props }: Props) {
  return (
    <textarea
      className={[
        'ui-control min-h-[96px] resize-y',
        error ? 'ui-control-error' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    />
  );
}
