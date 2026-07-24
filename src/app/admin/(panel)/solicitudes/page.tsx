'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Alert, Badge, Card, Select } from '@/components/ui';

type Item = {
  id: string;
  enviado: boolean;
  enviado_en: string | null;
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
  const [cicloLabel, setCicloLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/admin/solicitudes?estado=${encodeURIComponent(estado)}`
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Error');
        if (!cancelled) {
          setItems(json.items || []);
          setCicloLabel(json.ciclo_label || '');
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-2xl text-primary">
            Solicitudes nuevas
          </h2>
          <p className="text-sm text-text-secondary">
            Ciclo {cicloLabel || '…'} · {items.length} registro(s)
          </p>
        </div>
        <div className="w-full sm:w-56">
          <Select
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            aria-label="Filtrar estado"
          >
            <option value="enviadas">Enviadas</option>
            <option value="pendientes">Pendientes de verificar</option>
            <option value="verificadas">Verificadas</option>
            <option value="autorizadas">Autorizadas</option>
            <option value="todas">Todas</option>
          </Select>
        </div>
      </div>

      {loading ? (
        <Card className="text-sm text-text-secondary">Cargando…</Card>
      ) : null}
      {error ? <Alert variant="error">{error}</Alert> : null}

      {!loading && !error && items.length === 0 ? (
        <Card className="text-sm text-text-secondary">
          No hay solicitudes con este filtro.
        </Card>
      ) : null}

      <div className="space-y-2 md:hidden">
        {items.map((it) => (
          <Link
            key={it.id}
            href={`/admin/solicitudes/${it.id}`}
            className="block rounded-xl border border-border bg-card p-4"
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

      <div className="hidden overflow-x-auto rounded-xl border border-border md:block">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-bg text-text-secondary">
            <tr>
              <th className="px-3 py-2 font-medium">No. Control</th>
              <th className="px-3 py-2 font-medium">Alumno</th>
              <th className="px-3 py-2 font-medium">Grado</th>
              <th className="px-3 py-2 font-medium">Estado</th>
              <th className="px-3 py-2 font-medium">Enviado</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr
                key={it.id}
                className="border-t border-border hover:bg-bg/60"
              >
                <td className="px-3 py-2">
                  <Link
                    href={`/admin/solicitudes/${it.id}`}
                    className="font-medium text-primary underline-offset-2 hover:underline"
                  >
                    {it.alumno.alumno_ref}
                  </Link>
                </td>
                <td className="px-3 py-2">{it.alumno.nombre}</td>
                <td className="px-3 py-2">
                  {it.alumno.grado ?? '—'} / {it.alumno.grupo}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {it.verificado ? (
                      <Badge variant="success">Verificada</Badge>
                    ) : it.enviado ? (
                      <Badge variant="pending">Pendiente</Badge>
                    ) : (
                      <Badge>Borrador</Badge>
                    )}
                    {it.beca_autorizada ? (
                      <Badge variant="primary">Autorizada</Badge>
                    ) : null}
                  </div>
                </td>
                <td className="px-3 py-2 text-text-secondary">
                  {it.enviado_en
                    ? new Date(it.enviado_en).toLocaleString('es-MX')
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AdminSolicitudesPage() {
  return (
    <Suspense fallback={<Card>Cargando…</Card>}>
      <ListInner />
    </Suspense>
  );
}
