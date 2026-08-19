'use client';

/**
 * Módulo admin: cambiar tipo de beca y porcentaje en revisión individual.
 */
import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Input, Label, Select } from '@/components/ui';
import type { ConceptoBecaAdmin } from '@/lib/admin-beca-catalogo';

type BecaActual = {
  beca_id: number | null;
  beca_clase: string | null;
  beca_porcentaje: number | null;
};

type Props = {
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
}: Props) {
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
    <Card className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-primary">
          Tipo y porcentaje de beca
        </h3>
        <p className="mt-1 text-xs text-text-secondary">
          Ajuste el {becaLabel.toLowerCase()} sin afectar la revisión de
          documentos. Los cambios quedan registrados en bitácora.
        </p>
      </div>

      {error ? <Alert variant="error">{error}</Alert> : null}
      {okMsg ? <Alert variant="success">{okMsg}</Alert> : null}

      {becaAutorizada ? (
        <p className="text-xs text-amber-800">
          Esta beca ya está autorizada: el cambio también actualiza el registro
          de cobro del ciclo actual.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="admin-beca-tipo">Tipo de beca</Label>
          <Select
            id="admin-beca-tipo"
            className="min-h-[44px] text-base sm:text-sm"
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

        <div className="space-y-1.5">
          <Label htmlFor="admin-beca-pct">Porcentaje (%)</Label>
          <Input
            id="admin-beca-pct"
            type="number"
            min={0}
            max={100}
            inputMode="numeric"
            className="min-h-[44px] text-base sm:text-sm"
            value={porcentaje}
            onChange={(e) => setPorcentaje(e.target.value)}
          />
          {conceptoSel?.beca_porcentaje_default != null ? (
            <button
              type="button"
              className="text-xs text-primary underline-offset-2 hover:underline"
              onClick={aplicarPorcentajeDefault}
            >
              Usar sugerido:{' '}
              {Math.round(conceptoSel.beca_porcentaje_default)}%
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button
          type="button"
          className="!min-h-[44px]"
          disabled={saving || !dirty || !becaId || porcentaje.trim() === ''}
          onClick={() => void guardar()}
        >
          {saving ? 'Guardando…' : 'Guardar tipo y porcentaje'}
        </Button>
        {!dirty && beca?.beca_clase ? (
          <p className="text-xs text-text-secondary">
            Actual: {beca.beca_clase} ·{' '}
            {beca.beca_porcentaje != null
              ? `${Math.round(beca.beca_porcentaje)}%`
              : '—'}
          </p>
        ) : null}
      </div>
    </Card>
  );
}
