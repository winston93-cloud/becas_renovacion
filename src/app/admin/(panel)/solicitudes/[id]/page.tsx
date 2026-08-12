'use client';

import { useCallback, useEffect, useMemo, useState, use } from 'react';
import Link from 'next/link';
import { Alert, Button, Card } from '@/components/ui';
import {
  AdminDocumentosRevision,
  docsListosParaVerificar,
  type DocAdminItem,
} from '@/app/admin/(panel)/components/AdminDocumentosRevision';
import {
  AdminExpedienteHeader,
  BadgeAutorizada,
  BadgeEnviada,
  BadgeVerificada,
} from '@/components/admin/AdminExpedienteHeader';
import { normalizarRevisionEstado } from '@/lib/doc-revision';

type Detail = {
  solicitud: {
    id: string;
    ciclo_label: string;
    motivo: string | null;
    enviado: boolean;
    enviado_en: string | null;
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
  beca: {
    beca_id: number | null;
    beca_clase: string | null;
    beca_porcentaje: number | null;
  } | null;
  documentos: DocAdminItem[];
  docs_requeridos: { tipo: string; label: string }[];
};

export default function SolicitudDetallePage({
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
      const res = await fetch(`/api/admin/solicitudes/${id}`);
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
      const res = await fetch(`/api/admin/solicitudes/${id}`, {
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

  const { solicitud: s, alumno: a, beca } = data;

  return (
    <div className="space-y-4">
      <Link
        href="/admin/solicitudes"
        className="text-sm text-text-secondary hover:text-primary"
      >
        ← Volver al listado
      </Link>

      <AdminExpedienteHeader
        nombre={a.nombre}
        alumnoRef={a.alumno_ref}
        metaLinea={`${a.nivel_label} ${a.grado ?? '—'} / ${a.grupo} · Ciclo ${s.ciclo_label}`}
        badges={
          <>
            <BadgeEnviada enviada={s.enviado} />
            <BadgeVerificada verificada={s.verificado} />
            <BadgeAutorizada autorizada={s.beca_autorizada} />
          </>
        }
        becaLabel="Beca solicitada"
        tipoBeca={beca?.beca_clase ?? null}
        porcentajeBeca={beca?.beca_porcentaje ?? null}
      />

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
            className="!min-h-[44px]"
            disabled={saving || (!s.verificado && !docsOk)}
            onClick={() => patch({ verificado: !s.verificado })}
            title={
              !s.verificado && !docsOk
                ? 'Revise todos los documentos y márquelos OK primero'
                : undefined
            }
          >
            {s.verificado
              ? 'Quitar verificación'
              : '✓ Marcar como verificada'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="!min-h-[44px]"
            disabled={saving}
            onClick={() => patch({ beca_autorizada: !s.beca_autorizada })}
          >
            {s.beca_autorizada ? 'Quitar autorización' : 'Autorizar beca'}
          </Button>
        </div>
        {!s.verificado && !docsOk ? (
          <p className="text-xs text-amber-800">
            Aún no se puede verificar: faltan documentos por revisar o hay
            alguno marcado como incorrecto.
          </p>
        ) : null}
        {s.fecha_verificado ? (
          <p className="text-xs text-text-secondary">
            Verificada el{' '}
            {new Date(s.fecha_verificado).toLocaleString('es-MX')}
          </p>
        ) : null}
      </Card>

      <Card className="space-y-2">
        <h3 className="text-sm font-semibold text-primary">Motivo</h3>
        <p className="text-sm whitespace-pre-wrap text-text-secondary">
          {s.motivo || '—'}
        </p>
      </Card>

      <AdminDocumentosRevision
        flujo="solicitud"
        docsRequeridos={data.docs_requeridos}
        documentos={data.documentos}
        onChanged={refreshDocs}
      />
    </div>
  );
}
