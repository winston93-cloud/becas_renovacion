'use client';

/**
 * Checkbox + modal para cláusula de seguimiento individualizado en la carta.
 * Solo guarda en el expediente (no envía correo), igual espíritu que preview de rechazo.
 */
import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Modal, Textarea } from '@/components/ui';
import {
  CLAUSULA_SEGUIMIENTO_DEFAULT,
} from '@/lib/clausula-seguimiento-carta';

type Props = {
  flujo: 'renovacion' | 'solicitud';
  expedienteId: string;
  activo: boolean;
  texto: string | null;
  disabled?: boolean;
  onSaved: () => void | Promise<void>;
  onError?: (mensaje: string) => void;
};

export function AdminSeguimientoIndividualizado({
  flujo,
  expedienteId,
  activo,
  texto,
  disabled,
  onSaved,
  onError,
}: Props) {
  const [checked, setChecked] = useState(activo);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(texto || CLAUSULA_SEGUIMIENTO_DEFAULT);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  useEffect(() => {
    setChecked(activo);
    setDraft(
      (texto && texto.trim()) || CLAUSULA_SEGUIMIENTO_DEFAULT
    );
  }, [activo, texto]);

  const cerrar = useCallback(() => {
    if (saving) return;
    setOpen(false);
    setModalError(null);
    // Si cerró sin guardar y no estaba activo, desmarcar
    if (!activo) setChecked(false);
    else setDraft((texto && texto.trim()) || CLAUSULA_SEGUIMIENTO_DEFAULT);
  }, [activo, saving, texto]);

  function onToggle(next: boolean) {
    setOkMsg(null);
    if (!next) {
      // Quitar: guardar de inmediato sin modal
      void guardar(false, null);
      return;
    }
    setChecked(true);
    setDraft((texto && texto.trim()) || CLAUSULA_SEGUIMIENTO_DEFAULT);
    setModalError(null);
    setOpen(true);
  }

  async function guardar(activoFlag: boolean, clausula: string | null) {
    setSaving(true);
    setModalError(null);
    setOkMsg(null);
    try {
      const api =
        flujo === 'renovacion'
          ? `/api/admin/renovaciones/${expedienteId}`
          : `/api/admin/solicitudes/${expedienteId}`;

      const res = await fetch(api, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seguimiento_individualizado: activoFlag,
          clausula_seguimiento_texto: activoFlag
            ? clausula
            : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'No se pudo guardar.');

      setChecked(activoFlag);
      setOpen(false);
      setOkMsg(
        activoFlag
          ? 'Cláusula de seguimiento guardada. Aparecerá al final de la carta.'
          : 'Cláusula de seguimiento quitada de la carta.'
      );
      await onSaved();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al guardar.';
      setModalError(msg);
      onError?.(msg);
      if (!activoFlag) setChecked(activo);
      if (activoFlag && !activo) setChecked(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="space-y-2 rounded-xl border border-border/80 bg-white/80 px-4 py-3">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            className="mt-1 h-5 w-5 shrink-0 rounded border-border text-primary focus:ring-primary"
            checked={checked}
            disabled={disabled || saving}
            onChange={(e) => onToggle(e.target.checked)}
          />
          <span>
            <span className="block text-sm font-semibold text-primary">
              Seguimiento individualizado en carta de aceptación
            </span>
            <span className="mt-0.5 block text-xs text-text-secondary">
              Si se activa, se agrega una cláusula editable al final de la carta.
              No envía correo: solo actualiza el texto del expediente.
            </span>
          </span>
        </label>

        {activo ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button
              type="button"
              variant="secondary"
              className="!min-h-[44px] w-full sm:w-auto"
              disabled={disabled || saving}
              onClick={() => {
                setDraft((texto && texto.trim()) || CLAUSULA_SEGUIMIENTO_DEFAULT);
                setModalError(null);
                setOpen(true);
              }}
            >
              Editar cláusula
            </Button>
            <p className="line-clamp-2 text-xs text-text-secondary">
              {(texto && texto.trim()) || CLAUSULA_SEGUIMIENTO_DEFAULT}
            </p>
          </div>
        ) : null}

        {okMsg ? <Alert variant="success">{okMsg}</Alert> : null}
      </div>

      <Modal
        open={open}
        title="Cláusula de seguimiento individualizado"
        eyebrow="Carta de aceptación · sin envío de correo"
        onClose={cerrar}
        secondaryLabel="Cancelar"
        primaryLabel={saving ? 'Guardando…' : 'Guardar cláusula'}
        onPrimary={() => {
          if (saving || draft.trim() === '') return;
          void guardar(true, draft.trim());
        }}
      >
        <div className="space-y-3">
          <p className="text-sm text-text-secondary">
            Este texto se agregará al final de las cláusulas de la carta. El
            padre lo verá al firmar. Puede detallar la condición especial
            reemplazando el texto entre corchetes.
          </p>
          <Textarea
            id="clausula-seguimiento"
            rows={6}
            className="min-h-[140px] text-base"
            value={draft}
            disabled={saving}
            onChange={(e) => setDraft(e.target.value)}
          />
          {modalError ? <Alert variant="error">{modalError}</Alert> : null}
        </div>
      </Modal>
    </>
  );
}
