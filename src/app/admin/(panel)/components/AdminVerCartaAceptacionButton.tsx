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

export function AdminVerCartaAceptacionButton({
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
      ? `/api/admin/carta-aceptacion?flujo=${encodeURIComponent(flujo)}&expediente_id=${encodeURIComponent(expedienteId)}&t=${Date.now()}`
      : null;

  const abrir = useCallback(async () => {
    setLoading(true);
    setModalError(null);
    try {
      const res = await fetch(
        `/api/admin/carta-aceptacion?flujo=${encodeURIComponent(flujo)}&expediente_id=${encodeURIComponent(expedienteId)}`
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'No se pudo cargar la carta.');
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
          '!border-2 !border-amber-400 !bg-cyan-600 !text-amber-50',
          'hover:!bg-cyan-700 hover:!border-amber-300',
        ].join(' ')}
      >
        {loading ? 'Cargando…' : 'Ver carta de aceptación'}
      </Button>

      <Modal
        open={open}
        title="Carta de aceptación de beca"
        eyebrow="Vista previa · firma electrónica"
        onClose={cerrar}
        secondaryLabel="Cerrar"
      >
        {modalError ? (
          <Alert variant="error">{modalError}</Alert>
        ) : pdfUrl ? (
          <div className="space-y-3">
            <p className="text-xs text-text-secondary">
              Misma carta que verá el padre en firma digital. Si aún no firma,
              el espacio de firma aparece vacío.
            </p>
            <div className="overflow-hidden rounded-xl border border-border bg-[#525659]">
              <iframe
                title="Carta de aceptación de beca PDF"
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
