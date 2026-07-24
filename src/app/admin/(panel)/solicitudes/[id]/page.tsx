'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { Alert, Badge, Button, Card } from '@/components/ui';

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
  documentos: { id: string; tipo: string; label: string }[];
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

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/solicitudes/${id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error');
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

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

  const { solicitud: s, alumno: a } = data;

  return (
    <div className="space-y-4">
      <Link
        href="/admin/solicitudes"
        className="text-sm text-text-secondary hover:text-primary"
      >
        ← Volver al listado
      </Link>

      <div>
        <h2 className="font-[family-name:var(--font-display)] text-2xl text-primary">
          {a.nombre}
        </h2>
        <p className="text-sm text-text-secondary">
          {a.alumno_ref} · {a.nivel_label} {a.grado ?? '—'} / {a.grupo} · Ciclo{' '}
          {s.ciclo_label}
        </p>
        <div className="mt-2 flex flex-wrap gap-1">
          {s.enviado ? (
            <Badge variant="success">Enviada</Badge>
          ) : (
            <Badge>Borrador</Badge>
          )}
          {s.verificado ? (
            <Badge variant="success">Verificada</Badge>
          ) : (
            <Badge variant="pending">Sin verificar</Badge>
          )}
          {s.beca_autorizada ? (
            <Badge variant="primary">Autorizada</Badge>
          ) : (
            <Badge>Sin autorizar</Badge>
          )}
        </div>
      </div>

      {error ? <Alert variant="error">{error}</Alert> : null}

      <Card className="space-y-3">
        <h3 className="text-sm font-semibold text-primary">Acciones</h3>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button
            type="button"
            disabled={saving}
            onClick={() => patch({ verificado: !s.verificado })}
          >
            {s.verificado ? 'Quitar verificación' : 'Marcar verificada'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={saving}
            onClick={() => patch({ beca_autorizada: !s.beca_autorizada })}
          >
            {s.beca_autorizada ? 'Quitar autorización' : 'Autorizar beca'}
          </Button>
        </div>
      </Card>

      <Card className="space-y-2">
        <h3 className="text-sm font-semibold text-primary">Motivo</h3>
        <p className="text-sm whitespace-pre-wrap text-text-secondary">
          {s.motivo || '—'}
        </p>
      </Card>

      <Card className="space-y-2">
        <h3 className="text-sm font-semibold text-primary">Documentos</h3>
        <ul className="space-y-1 text-sm">
          {data.docs_requeridos.map((d) => {
            const ok =
              s.flags_docs[d.tipo] ||
              data.documentos.some((x) => x.tipo === d.tipo);
            return (
              <li key={d.tipo} className="flex justify-between gap-2">
                <span>{d.label}</span>
                <Badge variant={ok ? 'success' : 'pending'}>
                  {ok ? 'Sí' : 'Falta'}
                </Badge>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
