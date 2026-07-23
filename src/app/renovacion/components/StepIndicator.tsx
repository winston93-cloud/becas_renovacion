import { Check } from 'lucide-react';

/**
 * 2026-07-16 - Indicador de pasos del flujo (renovación / solicitud).
 * 2026-07-17 - aria-label configurable; no asumir solo renovación.
 * 2026-07-18 - Labels cortos en móvil para no truncar el sentido.
 */
type Step = 'form' | 'docs' | 'done';

type Props = {
  current: Step;
  ariaLabel?: string;
};

const STEPS: { id: Step; label: string; shortLabel: string }[] = [
  { id: 'form', label: 'Formulario', shortLabel: 'Form.' },
  { id: 'docs', label: 'Documentos', shortLabel: 'Docs' },
  { id: 'done', label: 'Confirmación', shortLabel: 'Listo' },
];

const order: Record<Step, number> = { form: 0, docs: 1, done: 2 };

export function StepIndicator({
  current,
  ariaLabel = 'Progreso del trámite',
}: Props) {
  const currentIdx = order[current];

  return (
    <nav aria-label={ariaLabel} className="mb-8">
      <ol className="flex items-center gap-0">
        {STEPS.map((step, i) => {
          const done = i < currentIdx;
          const active = i === currentIdx;
          return (
            <li key={step.id} className="flex min-w-0 flex-1 items-center">
              <div className="flex min-w-0 flex-col items-center gap-2 text-center">
                <span
                  className={[
                    'flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition duration-[180ms]',
                    done
                      ? 'bg-primary text-white'
                      : active
                        ? 'bg-primary-light text-primary ring-2 ring-primary/20'
                        : 'bg-card text-text-secondary ring-1 ring-border',
                  ].join(' ')}
                  aria-current={active ? 'step' : undefined}
                >
                  {done ? <Check className="h-4 w-4" aria-hidden /> : i + 1}
                </span>
                <span
                  className={[
                    'px-0.5 text-[11px] font-medium leading-tight sm:text-xs',
                    active || done ? 'text-text' : 'text-text-secondary',
                  ].join(' ')}
                >
                  <span className="sm:hidden">{step.shortLabel}</span>
                  <span className="hidden sm:inline">{step.label}</span>
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={[
                    'mx-1 mb-6 h-px flex-1 sm:mx-2',
                    i < currentIdx ? 'bg-primary' : 'bg-border',
                  ].join(' ')}
                  aria-hidden
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
