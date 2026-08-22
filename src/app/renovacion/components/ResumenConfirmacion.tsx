'use client';

/**
 * 2026-07-16 - Pantalla de confirmación al completar la renovación.
 * 2026-08-22 - Copy post-cierre: no bloquear a quien debe corregir docs.
 */
import { useState } from 'react';
import { CheckCircle2, Clock, Download, Upload } from 'lucide-react';
import { Alert, Button, Card } from '@/components/ui';
import { labelGrupo } from '@/lib/label-grupo';
import { fetchConAcceso } from '@/lib/acceso-session';
import { getPortalStatus } from '@/lib/portal-ventanas';

type Props = {
  renovacionId: string;
  alumnoNombre: string;
  alumnoRef: string;
  cicloLabel: string;
  grado: string | null;
  grupo: string | null;
  /** true si el alumno ya había finalizado en una visita previa */
  yaRegistrado?: boolean;
  fechaRegistro?: string | null;
  /** Acaba de reenviar documentos marcados incorrectos. */
  correccionEnviada?: boolean;
  /** Hay docs incorrectos: no debería mostrarse esta pantalla, pero hay CTA de respaldo. */
  docsPorCorregir?: boolean;
  onIrACorregir?: () => void;
};

export default function ResumenConfirmacion({
  renovacionId,
  alumnoNombre,
  alumnoRef,
  cicloLabel,
  grado,
  grupo,
  yaRegistrado = false,
  fechaRegistro = null,
  correccionEnviada = false,
  docsPorCorregir = false,
  onIrACorregir,
}: Props) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const portalCerrado = !getPortalStatus('renovacion').open;

  async function handleDownloadComprobante() {
    setError(null);
    setDownloading(true);
    try {
      const res = await fetchConAcceso(
        `/api/renovacion/comprobante?renovacion_id=${encodeURIComponent(renovacionId)}`
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(
          (json as { error?: string }).error ||
            'No se pudo generar el comprobante.'
        );
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `comprobante-beca-${alumnoRef}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Error al descargar comprobante.'
      );
    } finally {
      setDownloading(false);
    }
  }

  const gradoGrupo =
    [grado, labelGrupo(grupo)].filter((p) => p && p !== '—').join(' / ') ||
    '—';

  const fechaLabel = fechaRegistro
    ? new Intl.DateTimeFormat('es-MX', {
        dateStyle: 'long',
        timeStyle: 'short',
      }).format(new Date(fechaRegistro))
    : null;

  const titulo = docsPorCorregir
    ? 'Hay documentos por corregir'
    : correccionEnviada
      ? 'Documentos reenviados'
      : yaRegistrado
        ? 'Renovación ya registrada'
        : 'Renovación enviada';

  return (
    <Card className="ui-fade-in text-center">
      <div
        className={[
          'mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full',
          docsPorCorregir
            ? 'bg-warning-bg text-warning'
            : yaRegistrado && !correccionEnviada
              ? 'bg-primary-light text-primary'
              : 'bg-success-bg text-success',
        ].join(' ')}
      >
        {docsPorCorregir ? (
          <Upload className="h-7 w-7" aria-hidden />
        ) : yaRegistrado && !correccionEnviada ? (
          <Clock className="h-7 w-7" aria-hidden />
        ) : (
          <CheckCircle2 className="h-7 w-7" aria-hidden />
        )}
      </div>

      <h2 className="mb-2 text-2xl font-semibold tracking-tight text-text">
        {titulo}
      </h2>

      {docsPorCorregir ? (
        <Alert variant="warning" className="mx-auto mb-5 max-w-lg text-left">
          Control Escolar marcó uno o más documentos como incorrectos. No hace
          falta volver a llenar el formulario: suba únicamente el archivo que le
          pidieron corregir.
        </Alert>
      ) : correccionEnviada ? (
        <Alert variant="success" className="mx-auto mb-5 max-w-lg text-left">
          El documento corregido ya quedó en el expediente. Control Escolar lo
          volverá a revisar.
        </Alert>
      ) : yaRegistrado ? (
        <Alert variant="info" className="mx-auto mb-5 max-w-lg text-left">
          Su renovación de beca ya está registrada. Puede descargar el
          comprobante. El expediente sigue en revisión por el área académica.
        </Alert>
      ) : null}

      <p className="mb-1 text-sm text-text-secondary">
        {yaRegistrado
          ? 'Registro de renovación para:'
          : 'Se registró la solicitud de renovación para:'}
      </p>
      <p className="text-lg font-semibold text-text">{alumnoNombre}</p>
      <p className="mt-1 text-sm text-text-secondary">
        No. Control: {alumnoRef}
      </p>
      <p className="mt-1 text-sm text-text-secondary">
        Grado / Grupo: {gradoGrupo}
      </p>
      <p className="mt-2 text-sm text-text-secondary">
        Renovación becas ciclo {cicloLabel}
      </p>
      {fechaLabel && (
        <p className="mt-1 text-sm text-text-secondary">
          Fecha de registro: {fechaLabel}
        </p>
      )}

      <p className="mx-auto mt-6 max-w-md text-sm leading-relaxed text-text-secondary">
        {docsPorCorregir
          ? 'Use el botón de abajo para ir a la carga de documentos.'
          : correccionEnviada
            ? 'En las próximas semanas el área académica emitirá la resolución. Conserve su comprobante.'
            : yaRegistrado
              ? 'Su solicitud está en revisión. En las próximas semanas el área académica emitirá la resolución correspondiente.'
              : 'Se notificó a coordinación por correo. En las próximas semanas se le dará la resolución correspondiente. Descargue su comprobante de registro.'}
      </p>

      {portalCerrado && !docsPorCorregir ? (
        <Alert variant="warning" className="mx-auto mt-5 max-w-lg text-left">
          El período general de renovación de beca ya concluyó. Su expediente
          queda en revisión. Si Control Escolar le pide por correo corregir un
          documento, vuelva a entrar: el portal se abre solo para subir ese
          archivo.
        </Alert>
      ) : null}

      {error && (
        <Alert variant="error" className="mx-auto mt-4 max-w-md text-left">
          {error}
        </Alert>
      )}

      <div className="mt-6 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        {docsPorCorregir && onIrACorregir ? (
          <Button
            type="button"
            variant="primary"
            onClick={onIrACorregir}
            className="w-full min-h-[44px] sm:w-auto"
          >
            <Upload className="h-4 w-4" aria-hidden />
            Corregir documentos
          </Button>
        ) : null}
        <Button
          type="button"
          variant={docsPorCorregir ? 'secondary' : yaRegistrado ? 'primary' : 'secondary'}
          onClick={handleDownloadComprobante}
          disabled={downloading}
          className="w-full min-h-[44px] sm:w-auto"
        >
          <Download className="h-4 w-4" aria-hidden />
          {downloading ? 'Generando…' : 'Descargar comprobante'}
        </Button>
      </div>
    </Card>
  );
}
