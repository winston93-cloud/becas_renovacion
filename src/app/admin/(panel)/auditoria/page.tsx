'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, Input, Label } from '@/components/ui';

type Item = {
  id: string;
  created_at: string;
  actor_role: string;
  actor_label: string;
  accion: string;
  accion_label: string;
  entidad: string;
  entidad_id: string | null;
  alumno_ref: string | null;
  alumno_nombre: string | null;
  alumno_nivel: number | null;
  ip: string | null;
  detalle: Record<string, unknown> | null;
};

function fmtFecha(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-MX', {
      timeZone: 'America/Mexico_City',
      dateStyle: 'medium',
      timeStyle: 'medium',
    });
  } catch {
    return iso;
  }
}

export default function AdminAuditoriaPage() {
  const [q, setQ] = useState('');
  const [accion, setAccion] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load(opts?: { q?: string; accion?: string }) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      const qq = opts?.q ?? q;
      const aa = opts?.accion ?? accion;
      if (qq.trim()) params.set('q', qq.trim());
      if (aa.trim()) params.set('accion', aa.trim());
      params.set('limit', '120');
      const res = await fetch(`/api/admin/auditoria?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error');
      setItems(json.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load({ q: '', accion: '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    void load();
  }

  return (
    <div className="space-y-4">
      <div className="admin-hero">
        <h2>Bitácora</h2>
        <p>
          Registro de verificaciones, autorizaciones, permisos de acceso y
          revisión de documentos. Incluye cuenta (nivel), fecha, hora e IP.
        </p>
        <p className="mt-2 text-xs text-text-secondary">
          Nota: el acceso al panel es por clave de nivel (Secundaria / Primaria /
          MK), no por usuario personal. La «cuenta» registrada es ese nivel.
        </p>
      </div>

      <form
        onSubmit={onSearch}
        className="flex flex-col gap-2 sm:flex-row sm:items-end"
      >
        <div className="flex-1">
          <Label htmlFor="q">Buscar No. Control, nombre o IP</Label>
          <Input
            id="q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ej. 21889"
            className="mt-1"
          />
        </div>
        <div className="sm:w-56">
          <Label htmlFor="accion">Acción</Label>
          <select
            id="accion"
            value={accion}
            onChange={(e) => setAccion(e.target.value)}
            className="mt-1 w-full rounded-[12px] border border-border bg-card px-3 py-2.5 text-sm"
          >
            <option value="">Todas</option>
            <option value="acceso.autorizar">Autorizó acceso</option>
            <option value="acceso.revocar">Revocó acceso</option>
            <option value="renovacion.verificar">Verificó renovación</option>
            <option value="renovacion.autorizar">Autorizó renovación</option>
            <option value="solicitud.verificar">Verificó solicitud</option>
            <option value="solicitud.autorizar">Autorizó solicitud</option>
            <option value="documento.marcar_ok">Documento OK</option>
            <option value="documento.marcar_incorrecto">
              Documento incorrecto
            </option>
            <option value="login">Inicio de sesión</option>
            <option value="logout">Cierre de sesión</option>
          </select>
        </div>
        <Button type="submit" disabled={loading}>
          Buscar
        </Button>
      </form>

      {error ? <Alert variant="error">{error}</Alert> : null}
      {loading ? (
        <Card className="text-sm text-text-secondary">Cargando…</Card>
      ) : null}

      {!loading && items.length === 0 ? (
        <Card className="text-sm text-text-secondary">
          Aún no hay movimientos registrados (la bitácora arranca desde este
          deploy).
        </Card>
      ) : null}

      <div className="space-y-2">
        {items.map((it) => (
          <Card key={it.id} className="space-y-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-primary">{it.accion_label}</p>
                <p className="text-xs text-text-secondary">
                  {fmtFecha(it.created_at)}
                </p>
              </div>
              <Badge variant="primary">{it.actor_label}</Badge>
            </div>
            {it.alumno_ref || it.alumno_nombre ? (
              <p className="text-sm text-text">
                {it.alumno_ref ? (
                  <span className="font-semibold">{it.alumno_ref}</span>
                ) : null}
                {it.alumno_nombre ? ` · ${it.alumno_nombre}` : null}
              </p>
            ) : (
              <p className="text-sm text-text-secondary">Sesión del panel</p>
            )}
            <p className="text-xs text-text-secondary">
              IP: {it.ip || '—'}
              {it.entidad_id ? ` · id ${it.entidad_id.slice(0, 8)}…` : ''}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}
