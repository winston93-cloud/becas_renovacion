'use client';

/**
 * 2026-07-16 - Carga de PDFs requeridos para renovación.
 * 2026-07-17 - Lista dinámica según nivel/grado (docsRequeridos).
 * 2026-07-18 - Progreso con shimmer, stagger y success-pop.
 */
import { useMemo, useState } from 'react';
import { CheckCircle2, FileText, Upload } from 'lucide-react';
import type { Documento, DocumentoTipo } from '@/lib/types';
import {
  docsRequeridos,
  labelDocRequerido,
} from '@/lib/documentos-requeridos';
import { fetchConAcceso, getAccesoToken } from '@/lib/acceso-session';
import { Alert, Badge, Button, Card } from '@/components/ui';

type Props = {
  renovacionId: string;
  documentosIniciales: Documento[];
  nivel: number | null;
  grado: number | null;
  onComplete: () => void;
};

function uploadWithProgress(
  form: FormData,
  onProgress: (pct: number) => void
): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/renovacion/documentos');
    // 2026-07-22 - Token de sesión en subida XHR
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
      resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, json });
    };

    xhr.onerror = () => reject(new Error('Error de red al subir el documento.'));
    xhr.onabort = () => reject(new Error('Subida cancelada.'));

    xhr.send(form);
  });
}

export default function SubirDocumentos({
  renovacionId,
  documentosIniciales,
  nivel,
  grado,
  onComplete,
}: Props) {
  // 2026-07-17 - Docs según maternal/kinder1 vs kinder2+
  const docsList = useMemo(
    () =>
      docsRequeridos({ flujo: 'renovacion', nivel, grado }).map((tipo) => ({
        tipo,
        label: labelDocRequerido(tipo),
      })),
    [nivel, grado]
  );

  const [docs, setDocs] = useState<Partial<Record<DocumentoTipo, Documento | null>>>(
    () => {
      const initial: Partial<Record<DocumentoTipo, Documento | null>> = {};
      for (const d of docsList) {
        initial[d.tipo] =
          documentosIniciales.find((x) => x.tipo === d.tipo) || null;
      }
      return initial;
    }
  );
  const [uploading, setUploading] = useState<DocumentoTipo | null>(null);
  const [progress, setProgress] = useState<Partial<Record<DocumentoTipo, number>>>(
    {}
  );
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFinalize() {
    setError(null);
    setFinalizing(true);
    try {
      const res = await fetchConAcceso('/api/renovacion/finalizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ renovacion_id: renovacionId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'No se pudo finalizar la renovación.');
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al finalizar.');
    } finally {
      setFinalizing(false);
    }
  }

  async function handleUpload(tipo: DocumentoTipo, file: File | null) {
    if (!file) return;
    setError(null);
    setUploading(tipo);
    setProgress((prev) => ({ ...prev, [tipo]: 2 }));

    try {
      const form = new FormData();
      form.append('renovacion_id', renovacionId);
      form.append('tipo', tipo);
      form.append('file', file);

      const { ok, json } = await uploadWithProgress(form, (pct) => {
        setProgress((prev) => ({ ...prev, [tipo]: pct }));
      });

      if (!ok) {
        throw new Error(
          (json.error as string) || 'Error al subir documento.'
        );
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
        },
      }));
    } catch (err) {
      setProgress((prev) => ({ ...prev, [tipo]: 0 }));
      setError(err instanceof Error ? err.message : 'Error al subir.');
    } finally {
      setUploading(null);
    }
  }

  const allUploaded = docsList.every((d) => docs[d.tipo]);

  return (
    <Card>
      <div className="mb-6">
        <h2 className="text-lg font-semibold tracking-tight text-text">
          Carga de documentos
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          Sube los {docsList.length} PDFs requeridos para completar la renovación.
        </p>
      </div>

      <div className="space-y-4">
        {docsList.map((doc, index) => {
          const uploaded = docs[doc.tipo];
          const isUploading = uploading === doc.tipo;
          const pct = progress[doc.tipo] || 0;
          const fillPct = isUploading ? pct : uploaded ? 100 : 0;
          const enterDelay =
            index === 0
              ? ''
              : index === 1
                ? 'ui-enter-delay-1'
                : index === 2
                  ? 'ui-enter-delay-2'
                  : 'ui-enter-delay-3';

          return (
            <div
              key={doc.tipo}
              className={[
                'ui-enter relative overflow-hidden rounded-[12px] border p-4 transition-[border-color,box-shadow] duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]',
                enterDelay,
                uploaded
                  ? 'border-success/30 hover:shadow-card'
                  : 'border-border hover:shadow-card',
                isUploading ? 'border-success/40' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <div
                className="pointer-events-none absolute inset-0 origin-left bg-success-bg transition-[width] duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]"
                style={{ width: `${fillPct}%` }}
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
                      uploaded || isUploading
                        ? 'bg-success/15 text-success'
                        : 'bg-primary-light text-primary',
                    ].join(' ')}
                  >
                    {uploaded && !isUploading ? (
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
                      <p className="text-sm font-medium text-text">{doc.label}</p>
                      {isUploading ? (
                        <Badge
                          variant="primary"
                          className="animate-pulse"
                        >
                          {pct}%
                        </Badge>
                      ) : uploaded ? (
                        <Badge variant="success">Subido</Badge>
                      ) : (
                        <Badge variant="pending">Pendiente</Badge>
                      )}
                    </div>
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

                <label
                  className={[
                    'inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-[12px] border px-4 py-2.5 text-sm font-medium transition duration-[180ms] ease-[cubic-bezier(0.25,1,0.5,1)] focus-within:shadow-focus active:scale-[0.98] sm:w-auto',
                    isUploading
                      ? 'cursor-not-allowed border-success/20 bg-card/80 text-text-secondary opacity-70 active:scale-100'
                      : 'border-border bg-card text-text hover:bg-primary-light',
                  ].join(' ')}
                >
                  <Upload className="h-4 w-4 text-text-secondary" aria-hidden />
                  {isUploading
                    ? 'Subiendo…'
                    : uploaded
                      ? 'Reemplazar PDF'
                      : 'Elegir PDF'}
                  <input
                    type="file"
                    accept="application/pdf"
                    disabled={isUploading || Boolean(uploading)}
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null;
                      e.target.value = '';
                      handleUpload(doc.tipo, f);
                    }}
                  />
                </label>
              </div>

              {(isUploading || uploaded) && (
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
          disabled={!allUploaded || finalizing}
          onClick={handleFinalize}
          className="w-full sm:w-auto"
        >
          {finalizing ? 'Enviando...' : 'Finalizar renovación'}
        </Button>
      </div>
    </Card>
  );
}
