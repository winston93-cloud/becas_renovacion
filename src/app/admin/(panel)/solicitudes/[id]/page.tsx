'use client';

import { useCallback, useEffect, useMemo, useState, use } from 'react';
import Link from 'next/link';
import { Alert, Card } from '@/components/ui';
import {
  AdminDocumentosRevision,
  docsListosParaVerificar,
  type DocAdminItem,
} from '@/app/admin/(panel)/components/AdminDocumentosRevision';
import { AdminPromedioBecado } from '@/app/admin/(panel)/components/AdminPromedioBecado';
import type { PromedioBecadoRenovacion } from '@/lib/promedioBecadoRenovacion';
import {
  AdminExpedienteHeader,
  BadgeAutorizada,
  BadgeBecaActivada,
  BadgeEnviada,
  BadgeRechazada,
  BadgeVerificada,
} from '@/components/admin/AdminExpedienteHeader';
import { normalizarRevisionEstado } from '@/lib/doc-revision';
import { AdminAutorizarBecaButton } from '@/app/admin/(panel)/components/AdminAutorizarBecaButton';
import { AdminRechazoBecaButton } from '@/app/admin/(panel)/components/AdminRechazoBecaButton';
import { AdminVerCartaAceptacionButton } from '@/app/admin/(panel)/components/AdminVerCartaAceptacionButton';
import { AdminVerCartaFirmadaButton } from '@/app/admin/(panel)/components/AdminVerCartaFirmadaButton';
import { AdminSeguimientoIndividualizado } from '@/app/admin/(panel)/components/AdminSeguimientoIndividualizado';
import { AdminEstadoBecaExpediente } from '@/app/admin/(panel)/components/AdminEstadoBecaExpediente';
import {
  AdminExpedienteAccionesPorRol,
  AvisoAutorizarSinVerificar,
} from '@/app/admin/(panel)/components/AdminExpedienteAccionesPorRol';
import type { ConceptoBecaAdmin } from '@/lib/admin-beca-catalogo';

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
    beca_rechazada?: boolean;
    flags_docs: Record<string, boolean>;
  };
  alumno: {
    alumno_ref: string;
    nombre: string;
    nivel_label: string;
    grado: number | null;
    grado_label?: string;
    grupo: string;
  };
  beca: {
    beca_id: number | null;
    beca_clase: string | null;
    beca_porcentaje: number | null;
  } | null;
  documentos: DocAdminItem[];
  seguimiento_individualizado?: boolean;
  clausula_seguimiento_texto?: string | null;
  docs_requeridos: { tipo: string; label: string }[];
  promedio?: PromedioBecadoRenovacion | null;
  exento_boleta_sep?: boolean;
  alumno_reinscrito?: boolean;
  conceptos: ConceptoBecaAdmin[];
  firma_electronica?: {
    activo: boolean;
    beca_activada: boolean;
    tiene_carta_firmada: boolean;
    firmado_por: string | null;
  };
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
  const [actionMsg, setActionMsg] = useState<string | null>(null);

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
        metaLinea={`${a.nivel_label} ${a.grado_label ?? a.grado ?? '—'} / ${a.grupo} · Ciclo ${s.ciclo_label}`}
        badges={
          <>
            <BadgeEnviada enviada={s.enviado} />
            <BadgeVerificada verificada={s.verificado} />
            <BadgeRechazada rechazada={Boolean(s.beca_rechazada)} />
            <BadgeAutorizada autorizada={s.beca_autorizada} />
            <BadgeBecaActivada
              activada={Boolean(data.firma_electronica?.beca_activada)}
            />
          </>
        }
        becaLabel="Beca solicitada"
        tipoBeca={beca?.beca_clase ?? null}
        porcentajeBeca={beca?.beca_porcentaje ?? null}
        becaEdit={{
          flujo: 'solicitud',
          expedienteId: s.id,
          beca,
          conceptos: data.conceptos || [],
          becaAutorizada: s.beca_autorizada,
          onSaved: () => load({ soft: true }),
        }}
      />

      <AdminEstadoBecaExpediente
        autorizada={s.beca_autorizada}
        becaActivada={Boolean(data.firma_electronica?.beca_activada)}
        firmadoPor={data.firma_electronica?.firmado_por}
      />

      {error ? <Alert variant="error">{error}</Alert> : null}
      {actionMsg ? <Alert variant="success">{actionMsg}</Alert> : null}

      <AdminExpedienteAccionesPorRol
        nivelLabel={a.nivel_label}
        verificado={s.verificado}
        fechaVerificado={s.fecha_verificado}
        docsOk={docsOk}
        saving={saving}
        onToggleVerificado={() => patch({ verificado: !s.verificado })}
        accionesDireccion={
          <>
            <AdminSeguimientoIndividualizado
              flujo="solicitud"
              expedienteId={s.id}
              activo={Boolean(data.seguimiento_individualizado)}
              texto={data.clausula_seguimiento_texto ?? null}
              disabled={saving}
              onSaved={() => load({ soft: true })}
              onError={setError}
            />
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-stretch">
              <AdminVerCartaAceptacionButton
                flujo="solicitud"
                expedienteId={s.id}
                disabled={saving}
                onError={setError}
              />
              {data.firma_electronica?.tiene_carta_firmada ? (
                <AdminVerCartaFirmadaButton
                  flujo="solicitud"
                  expedienteId={s.id}
                  disabled={saving}
                  onError={setError}
                />
              ) : null}
              <AdminRechazoBecaButton
                flujo="solicitud"
                expedienteId={s.id}
                tramiteEnviado={s.enviado}
                disabled={saving}
                onEnviado={setActionMsg}
                onError={setError}
              />
              <AdminAutorizarBecaButton
                autorizada={s.beca_autorizada}
                verificado={s.verificado}
                saving={saving}
                onClick={() => patch({ beca_autorizada: !s.beca_autorizada })}
              />
            </div>
          </>
        }
        avisoDireccion={
          <AvisoAutorizarSinVerificar
            autorizada={s.beca_autorizada}
            verificado={s.verificado}
          />
        }
      />

      <Card className="space-y-2">
        <h3 className="text-sm font-semibold text-primary">Motivo</h3>
        <p className="text-sm whitespace-pre-wrap text-text-secondary">
          {s.motivo || '—'}
        </p>
      </Card>

      {/* Solo alumno Winston reinscrito (hay promedio en Boletas; no pide boleta SEP).
          Si viene de otra escuela, se pide boleta SEP y no se muestra este bloque. */}
      {data.alumno_reinscrito ? (
        <AdminPromedioBecado promedio={data.promedio} />
      ) : null}

      <AdminDocumentosRevision
        flujo="solicitud"
        expedienteId={s.id}
        docsRequeridos={data.docs_requeridos}
        documentos={data.documentos}
        onChanged={refreshDocs}
      />
    </div>
  );
}
