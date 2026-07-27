'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Alert, Badge, Card, Select } from '@/components/ui';

type Item = {
  id: string;
  correo_enviado: boolean;
  correo_enviado_en: string | null;
  verificado: boolean;
  beca_autorizada: boolean;
  alumno: {
    alumno_ref: string;
    nombre: string;
    nivel_label: string;
    grado: number | null;
    grupo: string;
  };
};

function ListInner() {
  const sp = useSearchParams();
  const [estado, setEstado] = useState(sp.get('estado') || 'enviadas');
  const [items, setItems] = useState<Item[]>([]);
  const [titulo, setTitulo] = useState('Renovación de becas');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/admin/renovaciones?estado=${encodeURIComponent(estado)}`
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Error');
        if (!cancelled) {
          setItems(json.items || []);
          setTitulo(
            json.titulo ||
              (json.ciclo_label
                ? `Renovación de becas ${json.ciclo_label}`
                : 'Renovación de becas')
          );
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Error');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [estado]);

  return (
    <div className="space-y-4">
      <div className="admin-hero">
        <h2>Renovaciones</h2>
        <p>
          {titulo} · {items.length} registro(s)
        </p>
        <p className="text-xs text-text-secondary">
          Abra el No. de control para revisar documentos y marcar como
          verificada o autorizada.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="w-full sm:ml-auto sm:w-56">
          <Select
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            aria-label="Filtrar estado"
          >
            <option value="enviadas">Enviadas</option>
            <option value="pendientes">Pendientes de verificar</option>
            <option value="verificadas">Verificadas</option>
            <option value="autorizadas">Autorizadas</option>
            <option value="todas">Todas (borradores incluidos)</option>
          </Select>
        </div>
      </div>

      {loading ? (
        <Card className="text-sm text-text-secondary">Cargando…</Card>
      ) : null}
      {error ? <Alert variant="error">{error}</Alert> : null}

      {!loading && !error && items.length === 0 ? (
        <Card className="text-sm text-text-secondary">
          No hay renovaciones con este filtro.
        </Card>
      ) : null}

      <div className="space-y-2 md:hidden">
        {items.map((it) => (
          <Link
            key={it.id}
            href={`/admin/renovaciones/${it.id}`}
            className="admin-mobile-card"
          >
            <p className="font-semibold text-primary">{it.alumno.nombre}</p>
            <p className="text-sm text-text-secondary">
              {it.alumno.alumno_ref} · {it.alumno.nivel_label}{' '}
              {it.alumno.grado ?? '—'} / {it.alumno.grupo}
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              {it.verificado ? (
                <Badge variant="success">Verificada</Badge>
              ) : (
                <Badge variant="pending">Pendiente</Badge>
              )}
              {it.beca_autorizada ? (
                <Badge variant="primary">Autorizada</Badge>
              ) : null}
            </div>
          </Link>
        ))}
      </div>

      <div className="admin-panel-card hidden overflow-x-auto md:block">
        <table className="admin-table">
          <thead>
            <tr>
              <th>No. Control</th>
              <th>Alumno</th>
              <th>Grado</th>
              <th>Estado</th>
              <th>Enviado</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id}>
                <td>
                  <Link
                    href={`/admin/renovaciones/${it.id}`}
                    className="font-semibold text-primary underline-offset-2 hover:underline"
                  >
                    {it.alumno.alumno_ref}
                  </Link>
                </td>
                <td>{it.alumno.nombre}</td>
                <td>
                  {it.alumno.grado ?? '—'} / {it.alumno.grupo}
                </td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    {it.verificado ? (
                      <Badge variant="success">Verificada</Badge>
                    ) : it.correo_enviado ? (
                      <Badge variant="pending">Pendiente</Badge>
                    ) : (
                      <Badge variant="neutral">Borrador</Badge>
                    )}
                    {it.beca_autorizada ? (
                      <Badge variant="primary">Autorizada</Badge>
                    ) : null}
                  </div>
                </td>
                <td className="text-text-secondary">
                  {it.correo_enviado_en
                    ? new Date(it.correo_enviado_en).toLocaleString('es-MX')
                    : '—'}
                </td>
                <td>
                  <Link
                    href={`/admin/renovaciones/${it.id}`}
                    className="font-semibold text-primary underline-offset-2 hover:underline"
                  >
                    Revisar →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AdminRenovacionesPage() {
  return (
    <Suspense fallback={<Card>Cargando…</Card>}>
      <ListInner />
    </Suspense>
  );
}
