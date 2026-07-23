'use client';

/**
 * 2026-07-16 - Pantalla de confirmación al completar la renovación.
 * 2026-07-16 - Éxito sobrio con icono Lucide (sin círculo saturado).
 * 2026-07-16 - Menciona que se notificó a coordinación por correo.
 * 2026-07-16 - Botón para descargar comprobante PDF con QR.
 * 2026-07-16 - Modo yaRegistrado: solo consulta, pendiente de resolución académica.
 */
import { useState } from 'react';
import { CheckCircle2, Clock, Download } from 'lucide-react';
import { Alert, Button, Card } from '@/components/ui';
import { labelGrupo } from '@/lib/label-grupo';
import { fetchConAcceso } from '@/lib/acceso-session';

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
}: Props) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // 2026-07-18 - Grupo numérico → letra (A/B/C)
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
    <Card className="ui-fade-in text-center">
      <div
        className={[
          'mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full',
          yaRegistrado
            ? 'bg-primary-light text-primary'
            : 'bg-success-bg text-success',
        ].join(' ')}
      >
        {yaRegistrado ? (
          <Clock className="h-7 w-7" aria-hidden />
        ) : (
          <CheckCircle2 className="h-7 w-7" aria-hidden />
        )}
      </div>

      <h2 className="mb-2 text-2xl font-semibold tracking-tight text-text">
        {yaRegistrado
          ? 'Solicitud ya registrada'
          : 'Renovación enviada'}
      </h2>

      {yaRegistrado && (
        <Alert variant="info" className="mx-auto mb-5 max-w-lg text-left">
          Este alumno ya realizó su renovación de beca. No es posible enviar el
          formulario de nuevo. Puede descargar su comprobante; la solicitud
          permanece pendiente de resolución por el área académica.
        </Alert>
      )}

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
        {yaRegistrado
          ? 'Su solicitud está en revisión. En las próximas semanas el área académica emitirá la resolución correspondiente.'
          : 'Se notificó a coordinación por correo. En las próximas semanas se le dará la resolución correspondiente. Descargue su comprobante de registro.'}
      </p>

      {error && (
        <Alert variant="error" className="mx-auto mt-4 max-w-md text-left">
          {error}
        </Alert>
      )}

      <div className="mt-6 flex justify-center">
        <Button
          type="button"
          variant={yaRegistrado ? 'primary' : 'secondary'}
          onClick={handleDownloadComprobante}
          disabled={downloading}
          className="w-full sm:w-auto"
        >
          <Download className="h-4 w-4" aria-hidden />
          {downloading ? 'Generando…' : 'Descargar comprobante'}
        </Button>
      </div>
    </Card>
  );
}
