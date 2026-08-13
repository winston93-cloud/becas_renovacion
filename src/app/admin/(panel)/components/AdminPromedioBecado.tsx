'use client';

/**
 * Sustituye la antigua fila «Boleta SEP» en renovación:
 * muestra promedios finales Winston (ES/EN/general) desde MySQL legacy.
 * Informativo: no bloquea verificación ni autorización.
 */
import { Card } from '@/components/ui';
import type { PromedioBecadoRenovacion } from '@/lib/promedioBecadoRenovacion';

function fmtNota(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toFixed(1);
}

type Props = {
  promedio: PromedioBecadoRenovacion | null | undefined;
};

export function AdminPromedioBecado({ promedio }: Props) {
  if (!promedio) {
    return (
      <Card className="space-y-2">
        <h3 className="text-sm font-semibold text-primary">
          Promedio general
        </h3>
        <p className="text-sm text-text-secondary">
          Sin promedio en boletas del ciclo.
        </p>
      </Card>
    );
  }

  const fuenteLabel =
    promedio.fuente === 'kinder'
      ? 'Kinder (ES + EN)'
      : promedio.fuente === 'primaria'
        ? 'Primaria (ES + EN)'
        : promedio.fuente === 'secundaria'
          ? 'Secundaria'
          : null;

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-primary">
          Promedio general
        </h3>
        <p className="text-xs text-text-secondary">
          Ciclo {promedio.cicloLabel}
          {fuenteLabel ? ` · ${fuenteLabel}` : ''}
        </p>
      </div>

      {promedio.nota ? (
        <p className="text-sm text-amber-800">{promedio.nota}</p>
      ) : null}

      {promedio.muestraEsEn ? (
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-[12px] border border-border bg-card px-3 py-3">
            <dt className="text-xs text-text-secondary">Promedio ES</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums text-text">
              {fmtNota(promedio.promedioEs)}
            </dd>
          </div>
          <div className="rounded-[12px] border border-border bg-card px-3 py-3">
            <dt className="text-xs text-text-secondary">Promedio EN</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums text-text">
              {fmtNota(promedio.promedioEn)}
              {promedio.letraEn ? (
                <span className="ml-2 text-sm font-medium text-text-secondary">
                  ({promedio.letraEn})
                </span>
              ) : null}
            </dd>
          </div>
          <div className="rounded-[12px] border border-border bg-card px-3 py-3">
            <dt className="text-xs text-text-secondary">Promedio general</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums text-text">
              {fmtNota(promedio.promedioGeneral)}
            </dd>
          </div>
        </dl>
      ) : (
        <div className="rounded-[12px] border border-border bg-card px-3 py-3 sm:max-w-xs">
          <p className="text-xs text-text-secondary">Promedio general</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-text">
            {fmtNota(promedio.promedioGeneral)}
          </p>
        </div>
      )}

      <p className="text-xs text-text-secondary">
        Calculado desde boletas Winston del ciclo a renovar (no se pide boleta
        SEP al papá). No forma parte del checklist de documentos.
      </p>
    </Card>
  );
}
