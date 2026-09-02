'use client';

import { useState } from 'react';
import {
  MESES_APLICA_OPCIONES,
  etiquetaMesAplicaCorta,
  esMesAplicaTardio,
  mesAplicaEfectivo,
} from '@/lib/beca-aplica-desde-mes';

type Props = {
  flujo: 'renovacion' | 'solicitud';
  expedienteId: string;
  mes: number | null | undefined;
  onSaved?: () => void;
};

/**
 * Identificación operativa: desde qué mes aplica la beca en colegiaturas.
 * No altera cobros; solo marca el expediente para CE.
 */
export function AdminMesAplicaControl({
  flujo,
  expedienteId,
  mes,
  onSaved,
}: Props) {
  const actual = mesAplicaEfectivo(mes);
  const [value, setValue] = useState(actual);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const dirty = value !== actual;
  const tardio = esMesAplicaTardio(value);

  async function guardar() {
    setSaving(true);
    setError(null);
    setOk(false);
    try {
      const path =
        flujo === 'renovacion'
          ? `/api/admin/renovaciones/${expedienteId}`
          : `/api/admin/solicitudes/${expedienteId}`;
      const res = await fetch(path, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ beca_aplica_desde_mes: value }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || 'No se pudo guardar el mes.');
      }
      setOk(true);
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className={[
        'rounded-xl border px-3 py-3',
        tardio
          ? 'border-amber-500/40 bg-amber-50/80'
          : 'border-border bg-bg/40',
      ].join(' ')}
    >
      <p className="text-xs font-bold uppercase tracking-wide text-text-secondary">
        Aplica desde
      </p>
      <p className="mt-0.5 text-sm text-text-secondary">
        Mes de colegiatura en que empieza a correr la beca (solo identificación
        para CE; no cambia cobros sola).
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select
          className="min-h-[44px] min-w-[160px] rounded-lg border border-border bg-card px-3 text-sm"
          value={value}
          disabled={saving}
          onChange={(e) => {
            setValue(Number(e.target.value));
            setOk(false);
          }}
        >
          {MESES_APLICA_OPCIONES.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={saving || !dirty}
          onClick={() => void guardar()}
          className="min-h-[44px] rounded-lg bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? 'Guardando…' : 'Guardar mes'}
        </button>
        <span
          className={[
            'text-sm font-semibold',
            tardio ? 'text-amber-800' : 'text-text-secondary',
          ].join(' ')}
        >
          {etiquetaMesAplicaCorta(value)}
        </span>
      </div>
      {error ? (
        <p className="mt-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {ok ? (
        <p className="mt-2 text-sm text-emerald-700">Mes actualizado.</p>
      ) : null}
    </div>
  );
}

/** Badge compacto para listados. */
export function AdminMesAplicaBadge({
  mes,
}: {
  mes: number | null | undefined;
}) {
  const tardio = esMesAplicaTardio(mes);
  return (
    <span
      className={[
        'admin-badge-estado',
        tardio
          ? 'admin-badge-estado--mes-tardio'
          : 'admin-badge-estado--mes-normal',
      ].join(' ')}
      title="Mes desde el que aplica la beca en colegiaturas"
    >
      {etiquetaMesAplicaCorta(mes)}
    </span>
  );
}
