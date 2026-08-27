'use client';

/**
 * Encabezado destacado del expediente en admin (renovación / solicitud).
 * Muestra identidad, estatus y tipo/porcentaje de beca en una tarjeta.
 */
import type { ReactNode } from 'react';
import { Badge, Card } from '@/components/ui';
import {
  AdminBecaTipoPorcentaje,
  type AdminBecaTipoPorcentajeProps,
} from '@/app/admin/(panel)/components/AdminBecaTipoPorcentaje';

export type AdminExpedienteHeaderProps = {
  nombre: string;
  alumnoRef: string;
  metaLinea: string;
  badges: ReactNode;
  /** Tipo de beca (catálogo) o texto descriptivo. Solo lectura si no hay becaEdit. */
  tipoBeca: string | null;
  /** Porcentaje 0–100. Solo lectura si no hay becaEdit. */
  porcentajeBeca: number | null;
  /** Etiqueta del bloque de beca, p. ej. "Beca a renovar" / "Beca solicitada". */
  becaLabel?: string;
  /** Si se pasa, reemplaza las cajas de solo lectura por el editor integrado. */
  becaEdit?: Omit<AdminBecaTipoPorcentajeProps, 'becaLabel'>;
};

export function AdminExpedienteHeader({
  nombre,
  alumnoRef,
  metaLinea,
  badges,
  tipoBeca,
  porcentajeBeca,
  becaLabel = 'Beca',
  becaEdit,
}: AdminExpedienteHeaderProps) {
  const pct =
    porcentajeBeca != null && Number.isFinite(porcentajeBeca)
      ? `${Math.round(Number(porcentajeBeca))}%`
      : null;
  const tipo = (tipoBeca || '').trim() || null;

  return (
    <Card className="overflow-hidden border-primary/25 bg-gradient-to-br from-white via-[#fffaf3] to-[#f3f7fb] !p-0 shadow-md">
      <div className="border-b border-primary/15 bg-primary/[0.06] px-5 py-4 sm:px-6 sm:py-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary/70">
          Expediente · No. control {alumnoRef}
        </p>
        <h2 className="mt-1 font-[family-name:var(--font-display)] text-2xl leading-tight text-primary sm:text-[1.75rem]">
          {nombre}
        </h2>
        <p className="mt-1.5 text-sm text-text-secondary">{metaLinea}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">{badges}</div>
      </div>

      <div className="px-5 py-4 sm:px-6 sm:py-5">
        {becaEdit ? (
          <AdminBecaTipoPorcentaje {...becaEdit} becaLabel={becaLabel} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
            <div className="rounded-xl border border-border/80 bg-white/80 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                {becaLabel} · tipo
              </p>
              <p className="mt-1 text-base font-semibold text-primary">
                {tipo || '—'}
              </p>
            </div>
            <div className="rounded-xl border border-border/80 bg-white/80 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                {becaLabel} · porcentaje
              </p>
              <p className="mt-1 text-base font-semibold text-primary">
                {pct || '—'}
              </p>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

export function BadgeEnviada({ enviada }: { enviada: boolean }) {
  return enviada ? (
    <Badge variant="success">Enviada</Badge>
  ) : (
    <Badge>Borrador</Badge>
  );
}

export function BadgeVerificada({ verificada }: { verificada: boolean }) {
  return verificada ? (
    <Badge variant="success">Verificada</Badge>
  ) : (
    <Badge variant="pending">Sin verificar</Badge>
  );
}

export function BadgeAutorizada({ autorizada }: { autorizada: boolean }) {
  return autorizada ? (
    <Badge
      variant="success"
      className="!border-emerald-600 !bg-emerald-600 !px-2.5 !py-1 !text-[11px] !font-bold !uppercase !tracking-wide !text-white"
    >
      ✓ Autorizada
    </Badge>
  ) : (
    <Badge>Sin autorizar</Badge>
  );
}

/** Verde: padre ya firmó la carta y activó la beca. */
export function BadgeBecaActivada({ activada }: { activada: boolean }) {
  if (!activada) return null;
  return <Badge variant="success">Beca activada</Badge>;
}
