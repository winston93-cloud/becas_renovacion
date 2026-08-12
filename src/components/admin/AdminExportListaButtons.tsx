'use client';

import { useState } from 'react';
import { Button } from '@/components/ui';
import type {
  AdminExportFlujo,
  AdminExportRow,
} from '@/lib/admin-export-lista';

type Props = {
  flujo: AdminExportFlujo;
  titulo: string;
  filtroLabel: string;
  rows: AdminExportRow[];
  disabled?: boolean;
};

async function descargarBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function AdminExportListaButtons({
  flujo,
  titulo,
  filtroLabel,
  rows,
  disabled,
}: Props) {
  const [busy, setBusy] = useState<'excel' | 'pdf' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function exportar(formato: 'excel' | 'pdf') {
    if (rows.length === 0) {
      setError('No hay filas visibles para exportar.');
      return;
    }
    setBusy(formato);
    setError(null);
    try {
      const res = await fetch('/api/admin/export-lista', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flujo,
          formato,
          titulo,
          filtro_label: filtroLabel,
          rows,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'No se pudo generar el archivo.');
      }
      const blob = await res.blob();
      const cd = res.headers.get('Content-Disposition') || '';
      const match = /filename="([^"]+)"/.exec(cd);
      const fallback =
        formato === 'excel'
          ? `${flujo}-revision.xls`
          : `${flujo}-revision.pdf`;
      await descargarBlob(blob, match?.[1] || fallback);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al exportar');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex w-full flex-col gap-1 sm:w-auto">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          className="min-h-[44px] px-3.5"
          disabled={disabled || busy !== null || rows.length === 0}
          onClick={() => void exportar('excel')}
          title="Descargar Excel con las filas visibles"
        >
          {busy === 'excel' ? 'Excel…' : 'Excel'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="min-h-[44px] px-3.5"
          disabled={disabled || busy !== null || rows.length === 0}
          onClick={() => void exportar('pdf')}
          title="Descargar PDF con las filas visibles"
        >
          {busy === 'pdf' ? 'PDF…' : 'PDF'}
        </Button>
      </div>
      {error ? (
        <p className="text-xs text-error" role="alert">
          {error}
        </p>
      ) : (
        <p className="text-[11px] text-text-secondary sm:hidden">
          Exporta lo visible en la tabla ({rows.length})
        </p>
      )}
    </div>
  );
}
