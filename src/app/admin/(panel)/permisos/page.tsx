'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, Input, Label } from '@/components/ui';

type Item = {
  alumno_id: number;
  alumno_ref: string;
  nombre: string;
  nivel_label: string;
  grado: number | null;
  grupo: string;
  permiso_solicitud: boolean;
  acceso_enviada: boolean;
};

export default function AdminPermisosPage() {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  async function load(query = q) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      const res = await fetch(
        `/api/admin/permisos-solicitud?${params.toString()}`
      );
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
    load('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    load(q);
  }

  async function setPermiso(alumnoId: number, permiso: boolean) {
    setBusyId(alumnoId);
    setError(null);
    try {
      const res = await fetch('/api/admin/permisos-solicitud', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alumno_id: alumnoId,
          permiso_solicitud: permiso,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'No se pudo guardar.');
      await load(q);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="admin-hero">
        <h2>Permisos de solicitud</h2>
        <p>
          Aquí aparecen los pedidos de acceso del correo «Solicitud de acceso a
          beca». Autoriza al alumno para que pueda llenar el formulario; la
          solicitud enviada se ve después en la pestaña Solicitudes.
        </p>
      </div>

      <form
        onSubmit={onSearch}
        className="flex flex-col gap-2 sm:flex-row sm:items-end"
      >
        <div className="flex-1">
          <Label htmlFor="q">Buscar No. Control o nombre</Label>
          <Input
            id="q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ej. 12345"
            className="mt-1"
          />
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
          No hay alumnos con pedido de acceso o permiso en tu nivel. Usa la
          búsqueda por No. de Control.
        </Card>
      ) : null}

      <div className="space-y-2">
        {items.map((it) => (
          <Card
            key={it.alumno_id}
            className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-semibold text-primary">{it.nombre}</p>
              <p className="text-sm text-text-secondary">
                {it.alumno_ref} · {it.nivel_label} {it.grado ?? '—'} /{' '}
                {it.grupo}
              </p>
              <div className="mt-1 flex flex-wrap gap-1">
                {it.acceso_enviada ? (
                  <Badge variant="pending">Pidió acceso</Badge>
                ) : null}
                {it.permiso_solicitud ? (
                  <Badge variant="success">Autorizado</Badge>
                ) : (
                  <Badge>Sin permiso</Badge>
                )}
              </div>
            </div>
            <Button
              type="button"
              variant={it.permiso_solicitud ? 'secondary' : 'primary'}
              disabled={
                busyId === it.alumno_id ||
                (!it.permiso_solicitud && !it.acceso_enviada)
              }
              title={
                !it.permiso_solicitud && !it.acceso_enviada
                  ? 'Solo se autoriza si la familia ya pidió acceso'
                  : undefined
              }
              onClick={() =>
                setPermiso(it.alumno_id, !it.permiso_solicitud)
              }
            >
              {it.permiso_solicitud ? 'Revocar' : 'Autorizar solicitud'}
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
