'use client';

/**
 * Carga de PDFs para solicitud de beca.
 * Modo corrección: tras envío, re-sube incorrectos y completa faltantes;
 * los OK se muestran verificados.
 * 2026-08-25 - Ingresos + boleta SEP; exención MK; reinscrito usa promedio en admin.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, FileText, Upload } from 'lucide-react';
import type { Documento, DocumentoTipo } from '@/lib/types';
import {
  docsRequeridos,
  labelDocRequerido,
} from '@/lib/documentos-requeridos';
import { fetchConAcceso, getAccesoToken } from '@/lib/acceso-session';
import { Alert, Badge, Button, Card } from '@/components/ui';

type Props = {
  solicitudId: string;
  documentosIniciales: Documento[];
  nivel: number | null;
  grado: number | null;
  becaId?: number | null;
  sinBoletaSep?: boolean;
  alumnoReinscrito?: boolean;
  exentoBoletaSep?: boolean;
  esMaternalKinder?: boolean;
  onComplete: () => void;
  /** Expediente ya enviado: corregir incorrectos o completar faltantes nuevos */
  modoCorreccion?: boolean;
};

function uploadWithProgress(
  form: FormData,
  onProgress: (pct: number) => void
): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/solicitud/documentos');
    const token = getAccesoToken();
    if (token) xhr.setRequestHeader('x-becas-acceso', token);

    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return;
      const pct = Math.min(99, Math.round((e.loaded / e.total) * 100));
      onProgress(pct);
    };

    xhr.onload = () => {
      let json: Record<string, unknown> = {};
      try {
        json = JSON.parse(xhr.responseText || '{}');
      } catch {
        json = {};
      }
      resolve({
        ok: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        json,
      });
    };

    xhr.onerror = () => reject(new Error('Error de red al subir el documento.'));
    xhr.onabort = () => reject(new Error('Subida cancelada.'));

    xhr.send(form);
  });
}

export default function SubirDocumentosSolicitud({
  solicitudId,
  documentosIniciales,
  nivel,
  grado,
  becaId = null,
  sinBoletaSep: sinBoletaSepInicial = false,
  alumnoReinscrito = false,
  exentoBoletaSep: exentoBoletaSepInicial = false,
  esMaternalKinder = false,
  onComplete,
  modoCorreccion = false,
}: Props) {
  const [sinBoletaSep, setSinBoletaSep] = useState(sinBoletaSepInicial);
  const [exentoBoletaSep, setExentoBoletaSep] = useState(exentoBoletaSepInicial);
  const [guardandoExencion, setGuardandoExencion] = useState(false);

  useEffect(() => {
    setSinBoletaSep(sinBoletaSepInicial);
    setExentoBoletaSep(exentoBoletaSepInicial);
  }, [sinBoletaSepInicial, exentoBoletaSepInicial]);

  const docsList = useMemo(
    () =>
      docsRequeridos({
        flujo: 'solicitud',
        nivel,
        grado,
        becaId,
        exentoBoletaSep: alumnoReinscrito || exentoBoletaSep,
        sinBoletaSep: esMaternalKinder ? sinBoletaSep : false,
      }).map((tipo) => ({
        tipo,
        label: labelDocRequerido(tipo),
      })),
    [
      nivel,
      grado,
      becaId,
      alumnoReinscrito,
      exentoBoletaSep,
      esMaternalKinder,
      sinBoletaSep,
    ]
  );

  const [docs, setDocs] = useState<
    Partial<Record<DocumentoTipo, Documento | null>>
  >(() => {
    const initial: Partial<Record<DocumentoTipo, Documento | null>> = {};
    for (const d of docsList) {
      initial[d.tipo] =
        documentosIniciales.find((x) => x.tipo === d.tipo) || null;
    }
    return initial;
  });
  const [uploading, setUploading] = useState<DocumentoTipo | null>(null);

  useEffect(() => {
    setDocs((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const d of docsList) {
        if (!(d.tipo in next)) {
          next[d.tipo] =
            documentosIniciales.find((x) => x.tipo === d.tipo) || null;
          changed = true;
        }
      }
      for (const key of Object.keys(next) as DocumentoTipo[]) {
        if (!docsList.some((d) => d.tipo === key)) {
          delete next[key];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [docsList, documentosIniciales]);

  const [progress, setProgress] = useState<
    Partial<Record<DocumentoTipo, number>>
  >({});
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pendientesCorregir = docsList.filter((d) => {
    const doc = docs[d.tipo];
    if (!doc) return true;
    return doc.revision_estado === 'incorrecto';
  }).length;

  const allUploaded = docsList.every((d) => docs[d.tipo]);
  const correccionesListas =
    modoCorreccion &&
    docsList.every((d) => {
      const doc = docs[d.tipo];
      if (!doc) return false;
      return doc.revision_estado !== 'incorrecto';
    });

  const toggleSinBoletaSep = useCallback(
    async (checked: boolean) => {
      if (alumnoReinscrito || !esMaternalKinder) return;
      setError(null);
      setGuardandoExencion(true);
      try {
        const res = await fetchConAcceso('/api/solicitud/sin-boleta-sep', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            solicitud_id: solicitudId,
            sin_boleta_sep: checked,
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || 'No se pudo guardar la exención.');
        }
        setSinBoletaSep(checked);
        setExentoBoletaSep(Boolean(json.exento_boleta_sep));
        if (checked) {
          setDocs((prev) => {
            const next = { ...prev };
            delete next.boleta;
            return next;
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al guardar.');
      } finally {
        setGuardandoExencion(false);
      }
    },
    [alumnoReinscrito, esMaternalKinder, solicitudId]
  );

  async function handleFinalize() {
    if (modoCorreccion) {
      onComplete();
      return;
    }
    setError(null);
    setFinalizing(true);
    try {
      const res = await fetchConAcceso('/api/solicitud/finalizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ solicitud_id: solicitudId }),
      });
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error || 'No se pudo finalizar la solicitud.');
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al finalizar.');
    } finally {
      setFinalizing(false);
    }
  }

  async function handleUpload(tipo: DocumentoTipo, file: File | null) {
    if (!file) return;
    const current = docs[tipo];
    if (modoCorreccion && current?.revision_estado === 'ok') {
      setError('Este documento ya fue verificado; no es necesario reemplazarlo.');
      return;
    }
    if (
      modoCorreccion &&
      current &&
      current.revision_estado !== 'incorrecto'
    ) {
      setError(
        'Solo puede reemplazar documentos marcados como incorrectos.'
      );
      return;
    }

    setError(null);
    setUploading(tipo);
    setProgress((prev) => ({ ...prev, [tipo]: 2 }));

    try {
      const form = new FormData();
      form.append('solicitud_id', solicitudId);
      form.append('tipo', tipo);
      form.append('file', file);

      const { ok, json } = await uploadWithProgress(form, (pct) => {
        setProgress((prev) => ({ ...prev, [tipo]: pct }));
      });

      if (!ok) {
        throw new Error((json.error as string) || 'Error al subir documento.');
      }

      setProgress((prev) => ({ ...prev, [tipo]: 100 }));

      setDocs((prev) => ({
        ...prev,
        [tipo]: {
          id: json.documento_id as string,
          tipo,
          storage_key: json.storage_key as string,
          storage_url: (json.storage_url as string) || null,
          nombre_original: file.name,
          subido_en: new Date().toISOString(),
          revision_estado:
            (json.revision_estado as Documento['revision_estado']) ||
            (modoCorreccion ? 'reenviado' : 'pendiente'),
          revision_nota: null,
        },
      }));
    } catch (err) {
      setProgress((prev) => ({ ...prev, [tipo]: 0 }));
      setError(err instanceof Error ? err.message : 'Error al subir.');
    } finally {
      setUploading(null);
    }
  }

  const muestraExencionBoleta =
    esMaternalKinder && !alumnoReinscrito && docsList.some((d) => d.tipo === 'boleta');

  return (
    <Card>
      <div className="mb-6">
        <h2 className="text-lg font-semibold tracking-tight text-text">
          Carga de documentos
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          {modoCorreccion
            ? 'Su solicitud ya está registrada. Suba los documentos faltantes o los marcados como incorrectos. Los verificados no se modifican.'
            : `Sube los ${docsList.length} PDFs requeridos para completar la solicitud de beca.`}
        </p>
        {modoCorreccion && pendientesCorregir > 0 ? (
          <Alert variant="warning" className="mt-3" title="Documentos pendientes">
            Quedan {pendientesCorregir} documento(s) por subir o corregir.
            {pendientesCorregir > 0 && !documentosIniciales.some((d) => d.revision_estado === 'incorrecto')
              ? ' Se requieren documentos adicionales (comprobante de ingresos y/o boleta SEP).'
              : ' Lea el motivo indicado en cada uno marcado como incorrecto.'}
          </Alert>
        ) : null}
        {alumnoReinscrito ? (
          <Alert variant="info" className="mt-3" title="Alumno reinscrito">
            No debe subir boleta SEP: Control Escolar consultará su promedio
            en el colegio, igual que en renovación de beca.
          </Alert>
        ) : null}
      </div>

      <div className="space-y-4">
        {docsList.map((doc, index) => {
          const uploaded = docs[doc.tipo];
          const isUploading = uploading === doc.tipo;
          const pct = progress[doc.tipo] || 0;
          const estado = uploaded?.revision_estado || null;
          const esOk = estado === 'ok';
          const esIncorrecto = estado === 'incorrecto';
          const esReenviado = estado === 'reenviado';
          const fillPct = isUploading ? pct : uploaded ? 100 : 0;
          const enterDelay =
            index === 0
              ? ''
              : index === 1
                ? 'ui-enter-delay-1'
                : index === 2
                  ? 'ui-enter-delay-2'
                  : index === 3
                    ? 'ui-enter-delay-3'
                    : 'ui-enter-delay-3';
          const puedeSubir =
            !esOk &&
            !esReenviado &&
            (!modoCorreccion || esIncorrecto || !uploaded);

          return (
            <div key={doc.tipo}>
              <div
                className={[
                  'ui-enter relative overflow-hidden rounded-[12px] border p-4 transition-[border-color,box-shadow] duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]',
                  enterDelay,
                  esIncorrecto
                    ? 'border-amber-400/60'
                    : uploaded
                      ? 'border-success/30 hover:shadow-card'
                      : 'border-border hover:shadow-card',
                  isUploading ? 'border-success/40' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <div
                  className="pointer-events-none absolute inset-0 origin-left bg-success-bg transition-[width] duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]"
                  style={{
                    width: `${esOk || (!esIncorrecto && uploaded) ? fillPct : isUploading ? fillPct : 0}%`,
                  }}
                  aria-hidden
                />
                {isUploading && (
                  <div
                    className="pointer-events-none absolute inset-0 overflow-hidden"
                    aria-hidden
                  >
                    <div className="ui-upload-shimmer absolute inset-y-0 w-16 bg-gradient-to-r from-transparent via-success/20 to-transparent" />
                  </div>
                )}

                <div className="relative z-[1] flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      className={[
                        'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] transition duration-[180ms]',
                        esOk || (uploaded && !esIncorrecto) || isUploading
                          ? 'bg-success/15 text-success'
                          : esIncorrecto
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-primary-light text-primary',
                      ].join(' ')}
                    >
                      {uploaded && !isUploading && !esIncorrecto ? (
                        <CheckCircle2
                          className="ui-success-pop h-4 w-4"
                          aria-hidden
                        />
                      ) : (
                        <FileText className="h-4 w-4" aria-hidden />
                      )}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-text">
                          {doc.label}
                        </p>
                        {isUploading ? (
                          <Badge variant="primary" className="animate-pulse">
                            {pct}%
                          </Badge>
                        ) : esOk ? (
                          <Badge variant="success">Verificado</Badge>
                        ) : esIncorrecto ? (
                          <Badge variant="pending">Incorrecto</Badge>
                        ) : esReenviado ? (
                          <Badge variant="primary">Reenviado</Badge>
                        ) : uploaded && modoCorreccion ? (
                          <Badge variant="primary">Corregido · por revisar</Badge>
                        ) : uploaded ? (
                          <Badge variant="success">Subido</Badge>
                        ) : (
                          <Badge variant="pending">Pendiente</Badge>
                        )}
                      </div>
                      {esIncorrecto && uploaded?.revision_nota ? (
                        <p className="mt-1 text-xs font-medium text-amber-900">
                          Motivo: {uploaded.revision_nota}
                        </p>
                      ) : null}
                      {uploaded?.nombre_original && !isUploading && (
                        <p className="mt-1 truncate text-xs text-text-secondary">
                          {uploaded.nombre_original}
                        </p>
                      )}
                      {isUploading && (
                        <p className="mt-1 text-xs font-medium text-success">
                          Subiendo… {pct}%
                        </p>
                      )}
                    </div>
                  </div>

                  {puedeSubir ? (
                    <label
                      className={[
                        'inline-flex min-h-[44px] w-full cursor-pointer items-center justify-center gap-2 rounded-[12px] border px-4 py-2.5 text-sm font-medium transition duration-[180ms] ease-[cubic-bezier(0.25,1,0.5,1)] focus-within:shadow-focus active:scale-[0.98] sm:w-auto',
                        isUploading
                          ? 'cursor-not-allowed border-success/20 bg-card/80 text-text-secondary opacity-70 active:scale-100'
                          : 'border-border bg-card text-text hover:bg-primary-light',
                      ].join(' ')}
                    >
                      <Upload
                        className="h-4 w-4 text-text-secondary"
                        aria-hidden
                      />
                      {isUploading
                        ? 'Subiendo…'
                        : uploaded
                          ? 'Subir PDF corregido'
                          : 'Elegir PDF'}
                      <input
                        type="file"
                        accept="application/pdf"
                        disabled={isUploading || Boolean(uploading)}
                        className="sr-only"
                        onChange={(e) => {
                          const f = e.target.files?.[0] || null;
                          e.target.value = '';
                          void handleUpload(doc.tipo, f);
                        }}
                      />
                    </label>
                  ) : esOk ? (
                    <p className="text-xs text-success sm:text-right">
                      Ya verificado por Control Escolar
                    </p>
                  ) : esReenviado ? (
                    <p className="text-xs text-primary sm:text-right">
                      Documento corregido reenviado
                    </p>
                  ) : null}
                </div>

                {(isUploading || (uploaded && !esIncorrecto)) && (
                  <div
                    className="relative z-[1] mt-3 h-1 overflow-hidden rounded-full bg-success/15"
                    role={isUploading ? 'progressbar' : undefined}
                    aria-valuenow={isUploading ? pct : undefined}
                    aria-valuemin={isUploading ? 0 : undefined}
                    aria-valuemax={isUploading ? 100 : undefined}
                    aria-label={isUploading ? `Subiendo ${doc.label}` : undefined}
                  >
                    <div
                      className="h-full rounded-full bg-success transition-[width] duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]"
                      style={{ width: `${fillPct}%` }}
                    />
                  </div>
                )}
              </div>

              {doc.tipo === 'boleta' && muestraExencionBoleta ? (
                <label className="mt-3 flex min-h-[44px] cursor-pointer items-start gap-3 rounded-[12px] border border-border bg-card/80 p-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-5 w-5 shrink-0 rounded border-border accent-primary"
                    checked={sinBoletaSep}
                    disabled={guardandoExencion || Boolean(uploading)}
                    onChange={(e) => void toggleSinBoletaSep(e.target.checked)}
                  />
                  <span className="text-sm leading-snug text-text-secondary">
                    <span className="font-medium text-text">
                      El alumno no trae boleta SEP
                    </span>{' '}
                    (viene de casa / educación en el hogar). Al marcar esta
                    casilla no será obligatorio subir la boleta SEP.
                  </span>
                </label>
              ) : null}
            </div>
          );
        })}
      </div>

      {error && (
        <Alert variant="error" className="mt-4">
          {error}
        </Alert>
      )}

      <div className="mt-6 flex justify-end">
        <Button
          type="button"
          disabled={
            modoCorreccion
              ? !correccionesListas || finalizing
              : !allUploaded || finalizing
          }
          onClick={() => void handleFinalize()}
          className="min-h-[44px] w-full sm:w-auto"
        >
          {modoCorreccion
            ? finalizing
              ? 'Guardando…'
              : 'ENVIAR DOCUMENTO CORREGIDO'
            : finalizing
              ? 'Enviando...'
              : 'Finalizar solicitud'}
        </Button>
      </div>
    </Card>
  );
}
