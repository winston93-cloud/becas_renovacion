'use client';

/**
 * 2026-07-17 - Modal accesible para avisos del portal (sin jerga técnica).
 */
import { useEffect, useId, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';

type Props = {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  primaryLabel?: string;
  onPrimary?: () => void;
  secondaryLabel?: string;
};

export function Modal({
  open,
  title,
  children,
  onClose,
  primaryLabel,
  onPrimary,
  secondaryLabel = 'Entendido',
}: Props) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-[#0B173A]/45 transition duration-[180ms]"
        aria-label="Cerrar"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="ui-fade-in relative z-10 w-full max-w-md rounded-[14px] border border-border bg-card p-6 shadow-card sm:p-7"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2
            id={titleId}
            className="text-lg font-semibold tracking-tight text-text"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[10px] p-1.5 text-text-secondary transition hover:bg-bg hover:text-text"
            aria-label="Cerrar diálogo"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="text-sm leading-relaxed text-text-secondary">
          {children}
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} className="sm:min-w-[7rem]">
            {secondaryLabel}
          </Button>
          {primaryLabel && onPrimary ? (
            <Button onClick={onPrimary} className="sm:min-w-[7rem]">
              {primaryLabel}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
