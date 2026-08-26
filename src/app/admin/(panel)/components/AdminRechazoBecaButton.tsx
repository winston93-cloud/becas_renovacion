'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Input, Modal, Textarea } from '@/components/ui';

type Flujo = 'solicitud' | 'renovacion';

type Preview = {
  subject: string;
  subject_default?: string;
  html: string;
  mensaje_texto: string;
  mensaje_default?: string;
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

const MAX_ADJ_BYTES = 8 * 1024 * 1024;

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
  const [subject, setSubject] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [adjunto, setAdjunto] = useState<File | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [htmlPreview, setHtmlPreview] = useState('');

  const cerrar = useCallback(() => {
    if (sending) return;
    setOpen(false);
    setPreview(null);
    setSubject('');
    setMensaje('');
    setAdjunto(null);
    setHtmlPreview('');
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
      const p = json.preview as Preview;
      setPreview(p);
      setSubject(p.subject || '');
      setMensaje(p.mensaje_texto || '');
      setHtmlPreview(p.html || '');
      setAdjunto(null);
      setOpen(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error';
      onError?.(msg);
    } finally {
      setLoading(false);
    }
  }, [expedienteId, flujo, onError]);

  // Vista previa HTML al editar (debounce ligero vía effect)
  useEffect(() => {
    if (!open || !preview) return;
    let cancelled = false;
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch('/api/admin/beca-rechazo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            flujo,
            expediente_id: expedienteId,
            enviar: false,
            subject,
            mensaje_texto: mensaje,
          }),
        });
        const json = await res.json();
        if (!res.ok || cancelled) return;
        setHtmlPreview(String(json.preview?.html || ''));
      } catch {
        /* preview best-effort */
      }
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [open, preview, flujo, expedienteId, subject, mensaje]);

  const adjuntoLabel = useMemo(() => {
    if (!adjunto) return null;
    const mb = adjunto.size / (1024 * 1024);
    return `${adjunto.name} (${mb < 0.1 ? `${Math.round(adjunto.size / 1024)} KB` : `${mb.toFixed(1)} MB`})`;
  }, [adjunto]);

  const enviarCorreo = useCallback(async () => {
    if (!preview) return;
    if (!mensaje.trim()) {
      setModalError('El mensaje del correo no puede quedar vacío.');
      return;
    }
    if (adjunto && adjunto.size > MAX_ADJ_BYTES) {
      setModalError('El adjunto no puede superar 8 MB.');
      return;
    }

    setSending(true);
    setModalError(null);
    try {
      const form = new FormData();
      form.set('flujo', flujo);
      form.set('expediente_id', expedienteId);
      form.set('enviar', 'true');
      form.set('subject', subject.trim());
      form.set('mensaje_texto', mensaje.trim());
      if (adjunto) form.set('archivo', adjunto);

      const res = await fetch('/api/admin/beca-rechazo', {
        method: 'POST',
        body: form,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'No se pudo enviar el correo.');
      cerrar();
      const adjuntoNota = json.email?.adjunto
        ? ` (con adjunto: ${json.email.adjunto})`
        : '';
      onEnviado?.(
        json.email?.to
          ? `Correo de rechazo enviado a: ${json.email.to}.${adjuntoNota}`
          : `Correo de rechazo enviado.${adjuntoNota}`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al enviar.';
      setModalError(msg);
    } finally {
      setSending(false);
    }
  }, [
    adjunto,
    cerrar,
    expedienteId,
    flujo,
    mensaje,
    onEnviado,
    preview,
    subject,
  ]);

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
        eyebrow="Vista previa · editable"
        tone="warning"
        size="wide"
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

            <dl className="grid gap-2 text-sm sm:grid-cols-[5.5rem_1fr]">
              <dt className="text-text-secondary">De</dt>
              <dd className="font-medium break-all">{preview.from}</dd>
              <dt className="text-text-secondary">Para</dt>
              <dd className="font-medium break-all">
                {preview.destinatarios.length > 0
                  ? preview.destinatarios.join(', ')
                  : '—'}
              </dd>
            </dl>

            <div>
              <label
                htmlFor="rechazo-asunto"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-secondary"
              >
                Asunto
              </label>
              <Input
                id="rechazo-asunto"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={sending}
                className="min-h-[44px] text-base"
              />
            </div>

            <div>
              <label
                htmlFor="rechazo-mensaje"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-secondary"
              >
                Mensaje (editable)
              </label>
              <Textarea
                id="rechazo-mensaje"
                rows={10}
                value={mensaje}
                disabled={sending}
                onChange={(e) => setMensaje(e.target.value)}
                className="min-h-[180px] text-base leading-relaxed"
              />
              <p className="mt-1 text-xs text-text-secondary">
                Puede ajustar el texto antes de enviar. La vista previa de abajo
                se actualiza al editar.
              </p>
            </div>

            <div>
              <label
                htmlFor="rechazo-adjunto"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-secondary"
              >
                Adjunto (opcional · 1 archivo)
              </label>
              <input
                id="rechazo-adjunto"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,application/pdf,image/*"
                disabled={sending}
                className="block w-full min-h-[44px] text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  if (f && f.size > MAX_ADJ_BYTES) {
                    setModalError('El adjunto no puede superar 8 MB.');
                    e.target.value = '';
                    setAdjunto(null);
                    return;
                  }
                  setModalError(null);
                  setAdjunto(f);
                }}
              />
              {adjuntoLabel ? (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-text-secondary">
                  <span>{adjuntoLabel}</span>
                  <button
                    type="button"
                    className="min-h-[44px] px-2 font-semibold text-primary underline-offset-2 hover:underline"
                    disabled={sending}
                    onClick={() => setAdjunto(null)}
                  >
                    Quitar
                  </button>
                </div>
              ) : (
                <p className="mt-1 text-xs text-text-secondary">
                  PDF, imagen o Word · máximo 8 MB.
                </p>
              )}
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
                Vista previa
              </p>
              <div className="overflow-hidden rounded-xl border border-border bg-[#F7F9FC]">
                <iframe
                  title="Vista previa del correo de rechazo"
                  srcDoc={htmlPreview || preview.html}
                  className="h-[min(360px,42vh)] w-full border-0 bg-white"
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
