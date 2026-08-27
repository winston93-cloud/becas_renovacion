'use client';

import { useCallback, useState } from 'react';
import { Alert, Button, Modal } from '@/components/ui';

type Flujo = 'solicitud' | 'renovacion';

type Props = {
  flujo: Flujo;
  expedienteId: string;
  disabled?: boolean;
  onError?: (mensaje: string) => void;
};

export function AdminVerCartaFirmadaButton({
  flujo,
  expedienteId,
  disabled,
  onError,
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const pdfUrl =
    open && !modalError
      ? `/api/admin/carta-firmada?flujo=${encodeURIComponent(flujo)}&expediente_id=${encodeURIComponent(expedienteId)}&t=${Date.now()}`
      : null;

  const abrir = useCallback(async () => {
    setLoading(true);
    setModalError(null);
    try {
      const res = await fetch(
        `/api/admin/carta-firmada?flujo=${encodeURIComponent(flujo)}&expediente_id=${encodeURIComponent(expedienteId)}`
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'No se pudo cargar la carta firmada.');
      }
      await res.arrayBuffer();
      setOpen(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error';
      setModalError(msg);
      onError?.(msg);
    } finally {
      setLoading(false);
    }
  }, [expedienteId, flujo, onError]);

  const cerrar = useCallback(() => {
    setOpen(false);
    setModalError(null);
  }, []);

  return (
    <>
      <Button
        type="button"
        disabled={disabled || loading}
        onClick={() => void abrir()}
        className={[
          'w-full sm:w-auto',
          '!min-h-[52px] px-5 py-3.5 text-sm font-bold',
          '!border-2 !border-emerald-500 !bg-emerald-600 !text-white',
          'hover:!bg-emerald-700 hover:!border-emerald-400',
        ].join(' ')}
      >
        {loading ? 'Cargando…' : 'Ver carta firmada'}
      </Button>

      <Modal
        open={open}
        title="Carta firmada · beca activada"
        eyebrow="Firma electrónica"
        onClose={cerrar}
        secondaryLabel="Cerrar"
      >
        {modalError ? (
          <Alert variant="error">{modalError}</Alert>
        ) : pdfUrl ? (
          <div className="space-y-3">
            <p className="text-xs text-text-secondary">
              Documento enviado por el padre al activar la beca.
            </p>
            <div className="overflow-hidden rounded-xl border border-border bg-[#525659]">
              <iframe
                title="Carta firmada de aceptación de beca"
                src={pdfUrl}
                className="h-[min(70vh,640px)] w-full border-0 bg-white"
              />
            </div>
          </div>
        ) : (
          <p className="text-sm text-text-secondary">Preparando PDF…</p>
        )}
      </Modal>
    </>
  );
}
