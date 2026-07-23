'use client';

/**
 * 2026-07-17 - Pantalla de confirmación al completar la solicitud de beca.
 */
import { CheckCircle2, Clock } from 'lucide-react';
import { Alert, Card } from '@/components/ui';
import { labelGrupo } from '@/lib/label-grupo';

type Props = {
  solicitudId: string;
  alumnoNombre: string;
  alumnoRef: string;
  cicloLabel: string;
  grado: string | null;
  grupo: string | null;
  yaRegistrado?: boolean;
  fechaRegistro?: string | null;
};

export default function ResumenConfirmacionSolicitud({
  solicitudId,
  alumnoNombre,
  alumnoRef,
  cicloLabel,
  grado,
  grupo,
  yaRegistrado = false,
  fechaRegistro = null,
}: Props) {
  // 2026-07-18 - Grupo numérico → letra
  const gradoGrupo =
    [grado, labelGrupo(grupo)].filter((p) => p && p !== '—').join(' / ') ||
    '—';

  const fechaLabel = fechaRegistro
    ? new Intl.DateTimeFormat('es-MX', {
        dateStyle: 'long',
        timeStyle: 'short',
      }).format(new Date(fechaRegistro))
    : null;

  return (
    <Card>
      <div className="mb-6 flex flex-col items-center text-center sm:items-start sm:text-left">
        <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success/15 text-success">
          {yaRegistrado ? (
            <Clock className="h-6 w-6" aria-hidden />
          ) : (
            <CheckCircle2 className="h-6 w-6" aria-hidden />
          )}
        </span>
        <h2 className="text-xl font-semibold tracking-tight text-text">
          {yaRegistrado
            ? 'Solicitud ya registrada'
            : 'Solicitud enviada correctamente'}
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-text-secondary">
          {yaRegistrado
            ? 'Este alumno ya había completado su solicitud de beca. Coordinación revisará el expediente.'
            : 'Su solicitud de beca quedó registrada. Coordinación revisará la documentación y le notificará el resultado.'}
        </p>
      </div>

      <dl className="grid gap-3 rounded-[12px] border border-border bg-bg p-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-text-secondary">
            Alumno
          </dt>
          <dd className="mt-1 text-sm font-medium text-text">{alumnoNombre}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-text-secondary">
            No. Control
          </dt>
          <dd className="mt-1 text-sm font-medium text-text">{alumnoRef}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-text-secondary">
            Ciclo
          </dt>
          <dd className="mt-1 text-sm font-medium text-text">{cicloLabel}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-text-secondary">
            Grado / Grupo
          </dt>
          <dd className="mt-1 text-sm font-medium text-text">{gradoGrupo}</dd>
        </div>
        {fechaLabel && (
          <div className="sm:col-span-2">
            <dt className="text-xs font-medium uppercase tracking-wide text-text-secondary">
              Fecha de registro
            </dt>
            <dd className="mt-1 text-sm font-medium text-text">{fechaLabel}</dd>
          </div>
        )}
        <div className="sm:col-span-2">
          <dt className="text-xs font-medium uppercase tracking-wide text-text-secondary">
            Folio interno
          </dt>
          <dd className="mt-1 break-all font-mono text-xs text-text-secondary">
            {solicitudId}
          </dd>
        </div>
      </dl>

      <Alert variant="info" className="mt-6" title="Siguiente paso">
        Conserve este acuse. Si tiene dudas, comuníquese con coordinación de
        becas del nivel correspondiente.
      </Alert>
    </Card>
  );
}
