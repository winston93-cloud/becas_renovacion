'use client';

/**
 * Editor de tipo/porcentaje integrado en el encabezado del expediente admin.
 */
import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Input, Select } from '@/components/ui';
import type { ConceptoBecaAdmin } from '@/lib/admin-beca-catalogo';

type BecaActual = {
  beca_id: number | null;
  beca_clase: string | null;
  beca_porcentaje: number | null;
};

export type AdminBecaTipoPorcentajeProps = {
  flujo: 'renovacion' | 'solicitud';
  expedienteId: string;
  becaLabel: string;
  beca: BecaActual | null;
  conceptos: ConceptoBecaAdmin[];
  becaAutorizada?: boolean;
  onSaved: () => void | Promise<void>;
};

export function AdminBecaTipoPorcentaje({
  flujo,
  expedienteId,
  becaLabel,
  beca,
  conceptos,
  becaAutorizada = false,
  onSaved,
}: AdminBecaTipoPorcentajeProps) {
  const [becaId, setBecaId] = useState('');
  const [porcentaje, setPorcentaje] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  useEffect(() => {
    setBecaId(beca?.beca_id != null ? String(beca.beca_id) : '');
    setPorcentaje(
      beca?.beca_porcentaje != null ? String(Math.round(beca.beca_porcentaje)) : ''
    );
  }, [beca?.beca_id, beca?.beca_porcentaje]);

  const conceptoSel = useMemo(
    () => conceptos.find((c) => String(c.beca_id) === becaId),
    [conceptos, becaId]
  );

  const dirty = useMemo(() => {
    const idActual = beca?.beca_id != null ? String(beca.beca_id) : '';
    const pctActual =
      beca?.beca_porcentaje != null
        ? String(Math.round(beca.beca_porcentaje))
        : '';
    return becaId !== idActual || porcentaje.trim() !== pctActual;
  }, [beca, becaId, porcentaje]);

  function aplicarPorcentajeDefault() {
    if (conceptoSel?.beca_porcentaje_default != null) {
      setPorcentaje(String(Math.round(conceptoSel.beca_porcentaje_default)));
    }
  }

  async function guardar() {
    setSaving(true);
    setError(null);
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
          beca_id: Number(becaId),
          beca_porcentaje: Number(porcentaje),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'No se pudo guardar la beca.');

      setOkMsg('Tipo y porcentaje actualizados.');
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
        <div className="rounded-xl border border-border/80 bg-white/80 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
            {becaLabel} · tipo
          </p>
          <Select
            id="admin-beca-tipo"
            aria-label={`${becaLabel} · tipo`}
            className="mt-2 min-h-[44px] w-full border-0 bg-transparent p-0 text-base font-semibold text-primary shadow-none focus:ring-0 sm:text-base"
            value={becaId}
            onChange={(e) => setBecaId(e.target.value)}
          >
            <option value="">Seleccione…</option>
            {conceptos.map((c) => (
              <option key={c.beca_id} value={c.beca_id}>
                {c.beca_clase}
              </option>
            ))}
          </Select>
        </div>

        <div className="rounded-xl border border-border/80 bg-white/80 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
            {becaLabel} · porcentaje
          </p>
          <div className="mt-2 flex items-center gap-1">
            <Input
              id="admin-beca-pct"
              type="number"
              min={0}
              max={100}
              inputMode="numeric"
              aria-label={`${becaLabel} · porcentaje`}
              className="min-h-[44px] w-20 border-0 bg-transparent p-0 text-base font-semibold text-primary shadow-none focus:ring-0 sm:text-base"
              value={porcentaje}
              onChange={(e) => setPorcentaje(e.target.value)}
            />
            <span className="text-base font-semibold text-primary">%</span>
          </div>
          {conceptoSel?.beca_porcentaje_default != null ? (
            <button
              type="button"
              className="mt-1 text-[11px] text-primary underline-offset-2 hover:underline"
              onClick={aplicarPorcentajeDefault}
            >
              Sugerido: {Math.round(conceptoSel.beca_porcentaje_default)}%
            </button>
          ) : null}
        </div>
      </div>

      {error ? <Alert variant="error">{error}</Alert> : null}
      {okMsg ? <Alert variant="success">{okMsg}</Alert> : null}

      {becaAutorizada ? (
        <p className="text-xs text-text-secondary">
          Beca autorizada: el tipo y porcentaje quedan registrados en el
          expediente; no activan descuento en cobro hasta el paso de firma
          electrónica.
        </p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button
          type="button"
          className="!min-h-[44px] w-full sm:w-auto"
          disabled={saving || !dirty || !becaId || porcentaje.trim() === ''}
          onClick={() => void guardar()}
        >
          {saving ? 'Guardando…' : 'Guardar tipo y porcentaje'}
        </Button>
        {dirty ? (
          <p className="text-xs text-text-secondary">
            Hay cambios sin guardar.
          </p>
        ) : null}
      </div>
    </div>
  );
}
