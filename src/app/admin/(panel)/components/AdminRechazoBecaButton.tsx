'use client';

import { useCallback, useState } from 'react';
import { Alert, Button, Modal } from '@/components/ui';

type Flujo = 'solicitud' | 'renovacion';

type Preview = {
  subject: string;
  html: string;
  from: string;
  destinatarios: string[];
  es_prueba: boolean;
  sin_correo: boolean;
  alumno: {
    nombre: string;
    ref: string;
    nivel: string;
    grado_grupo: string;
    ciclo: string;
  };
};

type Props = {
  flujo: Flujo;
  expedienteId: string;
  tramiteEnviado: boolean;
  disabled?: boolean;
  onEnviado?: (mensaje: string) => void;
  onError?: (mensaje: string) => void;
};

export function AdminRechazoBecaButton({
  flujo,
  expedienteId,
  tramiteEnviado,
  disabled,
  onEnviado,
  onError,
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  const cerrar = useCallback(() => {
    if (sending) return;
    setOpen(false);
    setPreview(null);
    setModalError(null);
  }, [sending]);

  const cargarPreview = useCallback(async () => {
    setLoading(true);
    setModalError(null);
    try {
      const res = await fetch('/api/admin/beca-rechazo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flujo,
          expediente_id: expedienteId,
          enviar: false,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'No se pudo cargar la vista previa.');
      setPreview(json.preview as Preview);
      setOpen(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error';
      onError?.(msg);
    } finally {
      setLoading(false);
    }
  }, [expedienteId, flujo, onError]);

  const enviarCorreo = useCallback(async () => {
    setSending(true);
    setModalError(null);
    try {
      const res = await fetch('/api/admin/beca-rechazo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flujo,
          expediente_id: expedienteId,
          enviar: true,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'No se pudo enviar el correo.');
      cerrar();
      onEnviado?.(
        json.email?.to
          ? `Correo de rechazo enviado a: ${json.email.to}.`
          : 'Correo de rechazo enviado.'
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al enviar.';
      setModalError(msg);
    } finally {
      setSending(false);
    }
  }, [cerrar, expedienteId, flujo, onEnviado]);

  return (
    <>
      <Button
        type="button"
        disabled={disabled || loading || !tramiteEnviado}
        onClick={() => void cargarPreview()}
        title={
          !tramiteEnviado
            ? 'El trámite debe estar enviado para notificar rechazo'
            : undefined
        }
        className={[
          'w-full sm:w-auto',
          '!min-h-[52px] px-6 py-3.5 text-base font-bold',
          '!border-transparent !bg-teal-500 !text-white hover:!bg-teal-600',
        ].join(' ')}
      >
        {loading ? 'Cargando…' : 'Rechazo de beca'}
      </Button>

      <Modal
        open={open}
        title="Correo de rechazo de beca"
        eyebrow="Vista previa institucional"
        tone="warning"
        onClose={cerrar}
        secondaryLabel="Cancelar"
        primaryLabel={sending ? 'Enviando…' : 'Enviar correo'}
        onPrimary={
          preview && !preview.sin_correo && !sending
            ? () => void enviarCorreo()
            : undefined
        }
      >
        {preview ? (
          <div className="space-y-4">
            {modalError ? <Alert variant="error">{modalError}</Alert> : null}
            {preview.sin_correo ? (
              <Alert variant="warning" title="Sin correo registrado">
                No hay correo de papá o mamá en la ficha del alumno. No se puede
                enviar el aviso hasta registrar un destinatario.
              </Alert>
            ) : null}
            {preview.es_prueba ? (
              <Alert variant="info" title="Alumno de prueba">
                El correo se enviará al buzón de pruebas configurado, no a los
                padres reales.
              </Alert>
            ) : null}

            <dl className="grid gap-2 text-sm sm:grid-cols-[7rem_1fr]">
              <dt className="text-text-secondary">De</dt>
              <dd className="font-medium break-all">{preview.from}</dd>
              <dt className="text-text-secondary">Para</dt>
              <dd className="font-medium break-all">
                {preview.destinatarios.length > 0
                  ? preview.destinatarios.join(', ')
                  : '—'}
              </dd>
              <dt className="text-text-secondary">Asunto</dt>
              <dd className="font-medium">{preview.subject}</dd>
            </dl>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
                Mensaje
              </p>
              <div className="overflow-hidden rounded-xl border border-border bg-[#F7F9FC]">
                <iframe
                  title="Vista previa del correo de rechazo"
                  srcDoc={preview.html}
                  className="h-[min(420px,55vh)] w-full border-0 bg-white"
                  sandbox=""
                />
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-text-secondary">Cargando vista previa…</p>
        )}
      </Modal>
    </>
  );
}
