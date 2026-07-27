'use client';

import { useCallback, useEffect, useMemo, useState, use } from 'react';
import Link from 'next/link';
import { Alert, Badge, Button, Card } from '@/components/ui';
import {
  AdminDocumentosRevision,
  docsListosParaVerificar,
  type DocAdminItem,
} from '@/app/admin/(panel)/components/AdminDocumentosRevision';
import { normalizarRevisionEstado } from '@/lib/doc-revision';

type Detail = {
  renovacion: {
    id: string;
    ciclo_label: string;
    motivo: string | null;
    correo_enviado: boolean;
    correo_enviado_en: string | null;
    verificado: boolean;
    fecha_verificado: string | null;
    beca_autorizada: boolean;
    flags_docs: Record<string, boolean>;
  };
  alumno: {
    alumno_ref: string;
    nombre: string;
    nivel_label: string;
    grado: number | null;
    grupo: string;
  };
  documentos: DocAdminItem[];
  docs_requeridos: { tipo: string; label: string }[];
};

export default function RenovacionDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (opts?: { soft?: boolean }) => {
    if (!opts?.soft) setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/renovaciones/${id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error');
      setData({
        ...json,
        documentos: (json.documentos || []).map(
          (d: DocAdminItem & { revision_estado?: string }) => ({
            ...d,
            revision_estado: normalizarRevisionEstado(d.revision_estado),
          })
        ),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      if (!opts?.soft) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const refreshDocs = useCallback(() => load({ soft: true }), [load]);

  const docsOk = useMemo(
    () =>
      data
        ? docsListosParaVerificar(data.docs_requeridos, data.documentos)
        : false,
    [data]
  );

  async function patch(body: {
    verificado?: boolean;
    beca_autorizada?: boolean;
  }) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/renovaciones/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'No se pudo guardar.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <Card className="text-sm text-text-secondary">Cargando…</Card>;
  }
  if (error && !data) return <Alert variant="error">{error}</Alert>;
  if (!data) return null;

  const { renovacion: r, alumno: a } = data;

  return (
    <div className="space-y-4">
      <Link
        href="/admin/renovaciones"
        className="text-sm text-text-secondary hover:text-primary"
      >
        ← Volver al listado
      </Link>

      <div>
        <h2 className="font-[family-name:var(--font-display)] text-2xl text-primary">
          {a.nombre}
        </h2>
        <p className="text-sm text-text-secondary">
          {a.alumno_ref} · {a.nivel_label} {a.grado ?? '—'} / {a.grupo} ·
          Renovación de becas {r.ciclo_label}
        </p>
        <div className="mt-2 flex flex-wrap gap-1">
          {r.correo_enviado ? (
            <Badge variant="success">Enviada</Badge>
          ) : (
            <Badge>Borrador</Badge>
          )}
          {r.verificado ? (
            <Badge variant="success">Verificada</Badge>
          ) : (
            <Badge variant="pending">Sin verificar</Badge>
          )}
          {r.beca_autorizada ? (
            <Badge variant="primary">Autorizada</Badge>
          ) : (
            <Badge>Sin autorizar</Badge>
          )}
        </div>
      </div>

      {error ? <Alert variant="error">{error}</Alert> : null}

      <Card className="space-y-3">
        <h3 className="text-sm font-semibold text-primary">
          Acciones de Control Escolar
        </h3>
        <p className="text-xs text-text-secondary">
          Primero revise cada documento (Revisar → correcto / incorrecto).
          Cuando todos estén OK, marque el expediente como verificado.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button
            type="button"
            disabled={
              saving || (!r.verificado && !docsOk)
            }
            onClick={() => patch({ verificado: !r.verificado })}
            title={
              !r.verificado && !docsOk
                ? 'Revise todos los documentos y márquelos OK primero'
                : undefined
            }
          >
            {r.verificado
              ? 'Quitar verificación'
              : '✓ Marcar como verificada'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={saving}
            onClick={() => patch({ beca_autorizada: !r.beca_autorizada })}
          >
            {r.beca_autorizada ? 'Quitar autorización' : 'Autorizar beca'}
          </Button>
        </div>
        {!r.verificado && !docsOk ? (
          <p className="text-xs text-amber-800">
            Aún no se puede verificar: faltan documentos por revisar o hay
            alguno marcado como incorrecto.
          </p>
        ) : null}
        {r.fecha_verificado ? (
          <p className="text-xs text-text-secondary">
            Verificada el{' '}
            {new Date(r.fecha_verificado).toLocaleString('es-MX')}
          </p>
        ) : null}
      </Card>

      <Card className="space-y-2">
        <h3 className="text-sm font-semibold text-primary">Motivo</h3>
        <p className="text-sm whitespace-pre-wrap text-text-secondary">
          {r.motivo || '—'}
        </p>
      </Card>

      <AdminDocumentosRevision
        flujo="renovacion"
        docsRequeridos={data.docs_requeridos}
        documentos={data.documentos}
        onChanged={refreshDocs}
      />
    </div>
  );
}
