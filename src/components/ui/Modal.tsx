'use client';

/**
 * 2026-07-17 - Modal accesible para avisos del portal.
 * 2026-07-24 - Variantes notice/warning con más presencia visual.
 */
import { useEffect, useId, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';

type Tone = 'default' | 'notice' | 'warning';

type Props = {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  primaryLabel?: string;
  onPrimary?: () => void;
  secondaryLabel?: string;
  /** Estilo visual del aviso. */
  tone?: Tone;
  /** Icono opcional en el encabezado. */
  icon?: ReactNode;
  /** Texto corto encima del título (ej. Aviso del portal). */
  eyebrow?: string;
};

export function Modal({
  open,
  title,
  children,
  onClose,
  primaryLabel,
  onPrimary,
  secondaryLabel = 'Entendido',
  tone = 'default',
  icon,
  eyebrow,
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

  const toneClass =
    tone === 'notice'
      ? 'ui-modal--notice'
      : tone === 'warning'
        ? 'ui-modal--warning'
        : '';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
    >
      <button
        type="button"
        className="ui-modal-backdrop absolute inset-0"
        aria-label="Cerrar"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={['ui-modal', toneClass, 'ui-enter'].filter(Boolean).join(' ')}
      >
        <div className="ui-modal-accent" aria-hidden />

        <div className="ui-modal-header">
          <div className="ui-modal-heading">
            {icon ? (
              <span className="ui-modal-icon" aria-hidden>
                {icon}
              </span>
            ) : null}
            <div className="min-w-0">
              {eyebrow ? <p className="ui-modal-eyebrow">{eyebrow}</p> : null}
              <h2 id={titleId} className="ui-modal-title">
                {title}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ui-modal-close"
            aria-label="Cerrar diálogo"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="ui-modal-body">{children}</div>

        <div className="ui-modal-actions">
          <Button
            variant={primaryLabel && onPrimary ? 'secondary' : 'primary'}
            onClick={onClose}
            className="sm:min-w-[8rem]"
          >
            {secondaryLabel}
          </Button>
          {primaryLabel && onPrimary ? (
            <Button onClick={onPrimary} className="sm:min-w-[8rem]">
              {primaryLabel}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
