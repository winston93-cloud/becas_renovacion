'use client';

/**
 * Lista de documentos con revisión (ver PDF → OK / incorrecto).
 * Incorrecto exige motivo y avisa a los papás por correo.
 */
import { useCallback, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card } from '@/components/ui';
import {
  etiquetaRevisionEstado,
  type RevisionEstadoDoc,
} from '@/lib/doc-revision';

export type DocAdminItem = {
  id: string;
  tipo: string;
  label: string;
  nombre_original?: string | null;
  subido_en?: string | null;
  revision_estado: RevisionEstadoDoc;
  revision_nota?: string | null;
  revisado_en?: string | null;
  revisado_por?: string | null;
};

export type DocRequeridoItem = { tipo: string; label: string };

type Props = {
  flujo: 'renovacion' | 'solicitud';
  docsRequeridos: DocRequeridoItem[];
  documentos: DocAdminItem[];
  onChanged: () => Promise<void> | void;
};

function badgeVariant(
  estado: RevisionEstadoDoc | 'falta'
): 'success' | 'pending' | 'primary' | 'neutral' {
  if (estado === 'ok') return 'success';
  if (estado === 'incorrecto') return 'pending';
  if (estado === 'reenviado') return 'primary';
  if (estado === 'falta') return 'pending';
  return 'neutral';
}

export function AdminDocumentosRevision({
  flujo,
  docsRequeridos,
  documentos,
  onChanged,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [savingTipo, setSavingTipo] = useState<string | null>(null);
  const [visor, setVisor] = useState<{
    doc: DocAdminItem;
    label: string;
    url: string;
  } | null>(null);
  const [notaIncorrecto, setNotaIncorrecto] = useState('');
  const [promptIncorrecto, setPromptIncorrecto] = useState<{
    doc: DocAdminItem;
    label: string;
  } | null>(null);

  const porTipo = useMemo(() => {
    const m = new Map<string, DocAdminItem>();
    for (const d of documentos) m.set(d.tipo, d);
    return m;
  }, [documentos]);

  const resumen = useMemo(() => {
    let ok = 0;
    let incorrectos = 0;
    let reenviados = 0;
    let pendientes = 0;
    let faltan = 0;
    for (const req of docsRequeridos) {
      const doc = porTipo.get(req.tipo);
      if (!doc) {
        faltan += 1;
        continue;
      }
      if (doc.revision_estado === 'ok') ok += 1;
      else if (doc.revision_estado === 'incorrecto') incorrectos += 1;
      else if (doc.revision_estado === 'reenviado') reenviados += 1;
      else pendientes += 1;
    }
    const total = docsRequeridos.length;
    const listosParaVerificar = ok === total && faltan === 0;
    return {
      ok,
      incorrectos,
      reenviados,
      pendientes,
      faltan,
      total,
      listosParaVerificar,
    };
  }, [docsRequeridos, porTipo]);

  const cerrarVisor = useCallback(() => {
    if (visor?.url) URL.revokeObjectURL(visor.url);
    setVisor(null);
    setNotaIncorrecto('');
  }, [visor]);

  const abrirRevisar = useCallback(
    async (doc: DocAdminItem, label: string) => {
      setError(null);
      setOkMsg(null);
      setSavingTipo(doc.tipo);
      try {
        const res = await fetch(
          `/api/admin/documentos/download?flujo=${encodeURIComponent(flujo)}&id=${encodeURIComponent(doc.id)}`
        );
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.error || 'No se pudo abrir el documento.');
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        if (visor?.url) URL.revokeObjectURL(visor.url);
        setVisor({ doc, label, url });
        setNotaIncorrecto(doc.revision_nota || '');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al abrir PDF.');
      } finally {
        setSavingTipo(null);
      }
    },
    [flujo, visor]
  );

  const marcar = useCallback(
    async (doc: DocAdminItem, estado: RevisionEstadoDoc, nota?: string) => {
      setError(null);
      setOkMsg(null);
      if (estado === 'incorrecto') {
        const m = (nota || '').trim();
        if (m.length < 5) {
          setError(
            'Escriba el motivo de lo incorrecto (mínimo 5 caracteres). Se enviará a los padres.'
          );
          return;
        }
      }
      setSavingTipo(doc.tipo);
      try {
        const res = await fetch('/api/admin/documentos/revision', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            flujo,
            documento_id: doc.id,
            revision_estado: estado,
            revision_nota: estado === 'incorrecto' ? nota || null : null,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'No se pudo guardar.');
        await onChanged();
        setPromptIncorrecto(null);
        if (visor?.doc.id === doc.id) {
          if (estado === 'ok' || estado === 'incorrecto') cerrarVisor();
        }
        if (estado === 'incorrecto') {
          if (json.email_aviso?.ok) {
            setOkMsg(
              `Documento marcado incorrecto. Aviso enviado a: ${json.email_aviso.to}.`
            );
          } else if (json.email_aviso?.error) {
            setOkMsg(
              `Documento marcado incorrecto, pero el correo no se envió: ${json.email_aviso.error}`
            );
          } else {
            setOkMsg('Documento marcado incorrecto.');
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al guardar.');
      } finally {
        setSavingTipo(null);
      }
    },
    [flujo, onChanged, visor, cerrarVisor]
  );

  return (
    <>
      <Card className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-primary">Documentos</h3>
          <p className="text-xs text-text-secondary">
            {resumen.ok} de {resumen.total} revisados OK
            {resumen.incorrectos > 0
              ? ` · ${resumen.incorrectos} incorrecto(s)`
              : ''}
            {resumen.reenviados > 0
              ? ` · ${resumen.reenviados} reenviado(s)`
              : ''}
            {resumen.pendientes > 0
              ? ` · ${resumen.pendientes} por revisar`
              : ''}
            {resumen.faltan > 0 ? ` · ${resumen.faltan} faltante(s)` : ''}
          </p>
        </div>
        <p className="text-xs text-text-secondary">
          Abra cada PDF con <strong>Revisar</strong>, luego márquelo como
          correcto o incorrecto. Al marcar incorrecto debe indicar el motivo; se
          avisa a los padres para que corrijan solo ese documento en el portal.
          Solo con todos en OK se puede marcar el expediente como verificado.
        </p>
        {error ? <Alert variant="error">{error}</Alert> : null}
        {okMsg ? <Alert variant="success">{okMsg}</Alert> : null}
        <ul className="space-y-3">
          {docsRequeridos.map((req) => {
            const doc = porTipo.get(req.tipo);
            const estado: RevisionEstadoDoc | 'falta' = doc
              ? doc.revision_estado
              : 'falta';
            const busy = savingTipo === req.tipo;
            return (
              <li
                key={req.tipo}
                className="rounded-[12px] border border-border bg-card px-3 py-3"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-medium text-text">{req.label}</p>
                    {doc?.nombre_original ? (
                      <p className="truncate text-xs text-text-secondary">
                        {doc.nombre_original}
                      </p>
                    ) : null}
                    {estado === 'incorrecto' && doc?.revision_nota ? (
                      <p className="text-xs text-amber-800">
                        Motivo: {doc.revision_nota}
                      </p>
                    ) : null}
                    {estado === 'reenviado' ? (
                      <p className="text-xs font-medium text-primary">
                        El padre ya reenvió el documento corregido. Vuelva a
                        revisarlo.
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={badgeVariant(estado)}>
                      {estado === 'falta'
                        ? 'Falta'
                        : etiquetaRevisionEstado(estado)}
                    </Badge>
                    {doc ? (
                      <>
                        <Button
                          type="button"
                          variant="secondary"
                          className="!min-h-[44px] !px-3 !py-1.5 text-xs"
                          disabled={busy}
                          onClick={() => void abrirRevisar(doc, req.label)}
                        >
                          {busy && !visor ? 'Abriendo…' : 'Revisar'}
                        </Button>
                        {doc.revision_estado !== 'ok' ? (
                          <Button
                            type="button"
                            className="!min-h-[44px] !px-3 !py-1.5 text-xs"
                            disabled={busy}
                            onClick={() => void marcar(doc, 'ok')}
                          >
                            Marcar OK
                          </Button>
                        ) : null}
                        {doc.revision_estado !== 'incorrecto' ? (
                          <Button
                            type="button"
                            variant="ghost"
                            className="!min-h-[44px] !px-3 !py-1.5 text-xs text-amber-800"
                            disabled={busy}
                            onClick={() => {
                              setError(null);
                              setNotaIncorrecto('');
                              setPromptIncorrecto({ doc, label: req.label });
                            }}
                          >
                            Incorrecto
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            className="!min-h-[44px] !px-3 !py-1.5 text-xs"
                            disabled={busy}
                            onClick={() => void marcar(doc, 'pendiente')}
                          >
                            Quitar rechazo
                          </Button>
                        )}
                      </>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      {promptIncorrecto ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center sm:p-6"
          role="presentation"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Cerrar"
            onClick={() => setPromptIncorrecto(null)}
          />
          <div
            role="dialog"
            aria-modal="true"
            className="relative z-10 w-full max-w-lg rounded-[16px] bg-card p-4 shadow-xl sm:p-5"
          >
            <h2 className="text-base font-semibold text-primary">
              Motivo de documento incorrecto
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              {promptIncorrecto.label}. Este motivo se enviará por correo a los
              padres y se mostrará en la carga de documentos del portal.
            </p>
            <label className="mt-3 block text-xs text-text-secondary">
              Motivo (obligatorio)
              <textarea
                value={notaIncorrecto}
                onChange={(e) => setNotaIncorrecto(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-[10px] border border-border bg-card px-3 py-2 text-base text-text sm:text-sm"
                placeholder="Ej. Ilegible, incompleto, no corresponde al alumno…"
                autoFocus
              />
            </label>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="ghost"
                className="!min-h-[44px]"
                onClick={() => setPromptIncorrecto(null)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className="!min-h-[44px]"
                disabled={
                  savingTipo === promptIncorrecto.doc.tipo ||
                  notaIncorrecto.trim().length < 5
                }
                onClick={() =>
                  void marcar(
                    promptIncorrecto.doc,
                    'incorrecto',
                    notaIncorrecto.trim()
                  )
                }
              >
                Confirmar e informar a padres
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {visor ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
          role="presentation"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Cerrar"
            onClick={cerrarVisor}
          />
          <div
            role="dialog"
            aria-modal="true"
            className="relative z-10 flex max-h-[95vh] w-full max-w-4xl flex-col overflow-hidden rounded-[16px] bg-card shadow-xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wide text-text-secondary">
                  Revisión de documento
                </p>
                <h2 className="truncate text-base font-semibold text-primary">
                  {visor.label}
                </h2>
              </div>
              <Button type="button" variant="ghost" onClick={cerrarVisor}>
                Cerrar
              </Button>
            </div>
            <div className="min-h-[50vh] flex-1 bg-slate-100">
              <iframe
                title={visor.label}
                src={visor.url}
                className="h-[min(70vh,640px)] w-full border-0"
              />
            </div>
            <div className="space-y-3 border-t border-border px-4 py-3">
              <label className="block text-xs text-text-secondary">
                Motivo si es incorrecto (obligatorio para rechazar)
                <textarea
                  value={notaIncorrecto}
                  onChange={(e) => setNotaIncorrecto(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-[10px] border border-border bg-card px-3 py-2 text-base text-text sm:text-sm"
                  placeholder="Ej. Ilegible, incompleto, no corresponde al alumno…"
                />
              </label>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  className="!min-h-[44px]"
                  disabled={
                    savingTipo === visor.doc.tipo ||
                    notaIncorrecto.trim().length < 5
                  }
                  onClick={() =>
                    void marcar(
                      visor.doc,
                      'incorrecto',
                      notaIncorrecto.trim()
                    )
                  }
                >
                  Marcar como incorrecto
                </Button>
                <Button
                  type="button"
                  className="!min-h-[44px]"
                  disabled={savingTipo === visor.doc.tipo}
                  onClick={() => void marcar(visor.doc, 'ok')}
                >
                  Documento correcto
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

/** ¿Se puede marcar el expediente como verificado? */
export function docsListosParaVerificar(
  docsRequeridos: DocRequeridoItem[],
  documentos: DocAdminItem[]
): boolean {
  if (docsRequeridos.length === 0) return false;
  const porTipo = new Map(documentos.map((d) => [d.tipo, d]));
  return docsRequeridos.every((req) => {
    const doc = porTipo.get(req.tipo);
    return Boolean(doc && doc.revision_estado === 'ok');
  });
}
