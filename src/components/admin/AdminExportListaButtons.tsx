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

function IconExcel({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden
      focusable="false"
    >
      <rect x="2" y="2" width="20" height="20" rx="3" fill="#217346" />
      <path
        d="M7 7.5 10.2 12 7 16.5h1.8l1.9-2.8 1.9 2.8H15l-3.2-4.5L15 7.5h-1.8l-1.9 2.7L9.2 7.5H7Z"
        fill="#fff"
      />
      <path
        d="M14.5 7.5H17.5V9H16V11.5H17.25V13H16V16.5H14.5V7.5Z"
        fill="#fff"
      />
    </svg>
  );
}

function IconPdf({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden
      focusable="false"
    >
      <path
        d="M6 2h8l4 4v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z"
        fill="#E53935"
      />
      <path d="M14 2v4h4" fill="#FFCDD2" />
      <path
        d="M7.2 13.2h1.1c.9 0 1.5.5 1.5 1.3 0 .9-.7 1.4-1.7 1.4H7.2V13.2Zm1 2.1c.4 0 .6-.2.6-.5 0-.3-.2-.5-.6-.5H8.1v1Zm2.5-2.1h1.8c1.2 0 2 .7 2 1.8 0 1.1-.8 1.8-2 1.8h-1.8V13.2Zm1.7 2.8c.5 0 .8-.3.8-.7 0-.4-.3-.7-.8-.7h-.6v1.4Zm2.3-2.8h2.4v.9h-1.3v.7h1.2v.9h-1.2v1.3h-1.1V13.2Z"
        fill="#fff"
      />
    </svg>
  );
}

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
          ? `${flujo}-revision.xlsx`
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
          variant="primary"
          className="admin-export-btn admin-export-btn--excel min-h-[44px] min-w-[6.5rem] px-3 shadow-sm"
          disabled={disabled || busy !== null || rows.length === 0}
          onClick={() => void exportar('excel')}
          title="Descargar Excel con las filas visibles"
        >
          {busy === 'excel' ? (
            'Excel…'
          ) : (
            <>
              <IconExcel className="admin-export-btn__icon" />
              <span>Excel</span>
            </>
          )}
        </Button>
        <Button
          type="button"
          variant="primary"
          className="admin-export-btn admin-export-btn--pdf min-h-[44px] min-w-[6.5rem] border border-[#c62828] bg-[#e53935] px-3 text-white shadow-sm hover:bg-[#d32f2f] hover:shadow-card disabled:hover:bg-[#e53935]"
          disabled={disabled || busy !== null || rows.length === 0}
          onClick={() => void exportar('pdf')}
          title="Descargar PDF con las filas visibles"
        >
          {busy === 'pdf' ? (
            'PDF…'
          ) : (
            <>
              <IconPdf className="admin-export-btn__icon" />
              <span>PDF</span>
            </>
          )}
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
