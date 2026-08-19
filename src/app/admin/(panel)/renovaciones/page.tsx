'use client';

import { useCallback, useEffect, useMemo, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Alert, Badge, Card, Select } from '@/components/ui';
import {
  AdminAlumnoListaBusqueda,
  type AdminAlumnoListaItem,
} from '@/components/admin/AdminAlumnoListaBusqueda';
import { AdminExportListaButtons } from '@/components/admin/AdminExportListaButtons';
import {
  etiquetaFiltroEstado,
  type AdminExportRow,
} from '@/lib/admin-export-lista';

type DocIncorrecto = {
  tipo: string;
  label: string;
  nota: string | null;
};

type Item = {
  id: string;
  correo_enviado: boolean;
  correo_enviado_en: string | null;
  verificado: boolean;
  beca_autorizada: boolean;
  docs_incorrectos?: DocIncorrecto[];
  docs_incorrectos_count?: number;
  alumno: {
    alumno_ref: string;
    nombre: string;
    nivel_label: string;
    grado: number | null;
    grado_label?: string;
    grupo: string;
  };
};

function ListInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const [estado, setEstado] = useState(sp.get('estado') || 'enviadas');
  const [items, setItems] = useState<Item[]>([]);
  const [titulo, setTitulo] = useState('Renovación de becas');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filtradosIds, setFiltradosIds] = useState<string[] | null>(null);

  useEffect(() => {
    const e = sp.get('estado') || 'enviadas';
    setEstado(e);
  }, [sp]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setFiltradosIds(null);
      try {
        const res = await fetch(
          `/api/admin/renovaciones?estado=${encodeURIComponent(estado)}`
        );
        const ct = res.headers.get('content-type') || '';
        if (!ct.includes('application/json')) {
          throw new Error(
            res.status === 502
              ? 'El servidor no respondió (502). Intente de nuevo en unos segundos.'
              : `Error del servidor (${res.status}).`
          );
        }
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

  const opcionesBusqueda = useMemo<AdminAlumnoListaItem[]>(
    () =>
      items.map((it) => ({
        id: it.id,
        alumno_ref: it.alumno.alumno_ref,
        nombre: it.alumno.nombre,
        meta: `${it.alumno.nivel_label} · ${it.alumno.grado_label ?? it.alumno.grado ?? '—'} / ${it.alumno.grupo}`,
      })),
    [items]
  );

  const visibles = useMemo(() => {
    if (!filtradosIds) return items;
    const set = new Set(filtradosIds);
    return items.filter((it) => set.has(it.id));
  }, [items, filtradosIds]);

  const exportRows = useMemo<AdminExportRow[]>(
    () =>
      visibles.map((it) => ({
        alumno_ref: it.alumno.alumno_ref,
        nombre: it.alumno.nombre,
        nivel_label: it.alumno.nivel_label,
        grado: it.alumno.grado_label ?? it.alumno.grado,
        grupo: it.alumno.grupo,
        enviado: it.correo_enviado,
        enviado_en: it.correo_enviado_en,
        verificado: it.verificado,
        beca_autorizada: it.beca_autorizada,
      })),
    [visibles]
  );

  const onFilteredChange = useCallback((filtered: AdminAlumnoListaItem[]) => {
    setFiltradosIds(filtered.map((f) => f.id));
  }, []);

  const onSelectAlumno = useCallback(
    (id: string) => {
      router.push(`/admin/renovaciones/${id}`);
    },
    [router]
  );

  const esCorreccionDocs = estado === 'correccion_documentos';

  return (
    <div className="space-y-4">
      <div className="admin-hero">
        <h2>Renovaciones</h2>
        <p>
          {titulo} · {items.length} registro(s)
          {filtradosIds && filtradosIds.length !== items.length
            ? ` · mostrando ${visibles.length}`
            : ''}
        </p>
        <p className="text-xs text-text-secondary">
          {esCorreccionDocs
            ? 'Familias a las que se envió correo por documentación incorrecta. Cuando reenvíen, vuelven a «Pendientes de verificar». Marque verificada solo cuando todo el expediente esté correcto.'
            : 'Abra el No. de control para revisar documentos y marcar como verificada o autorizada.'}
        </p>
      </div>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <AdminAlumnoListaBusqueda
          items={opcionesBusqueda}
          disabled={loading || items.length === 0}
          onSelect={onSelectAlumno}
          onFilteredChange={onFilteredChange}
          placeholder="Buscar por nombre o no. de control…"
        />
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-end sm:justify-end lg:w-auto">
          <AdminExportListaButtons
            flujo="renovacion"
            titulo={titulo}
            filtroLabel={etiquetaFiltroEstado(estado)}
            rows={exportRows}
            disabled={loading}
          />
          <div className="w-full sm:w-56">
            <Select
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              aria-label="Filtrar estado"
            >
              <option value="enviadas">Enviadas</option>
              <option value="pendientes">Pendientes de verificar</option>
              <option value="correccion_documentos">
                Corrección de documentos
              </option>
              <option value="verificadas">Verificadas</option>
              <option value="autorizadas">Autorizadas</option>
              <option value="todas">Todas (borradores incluidos)</option>
            </Select>
          </div>
        </div>
      </div>

      {loading ? (
        <Card className="text-sm text-text-secondary">Cargando…</Card>
      ) : null}
      {error ? <Alert variant="error">{error}</Alert> : null}

      {!loading && !error && items.length === 0 ? (
        <Card className="text-sm text-text-secondary">
          {esCorreccionDocs
            ? 'No hay renovaciones esperando corrección de documentos.'
            : 'No hay renovaciones con este filtro.'}
        </Card>
      ) : null}

      {!loading && !error && items.length > 0 && visibles.length === 0 ? (
        <Card className="text-sm text-text-secondary">
          Ningún alumno de la lista coincide con la búsqueda.
        </Card>
      ) : null}

      <div className="space-y-2 md:hidden">
        {visibles.map((it) => (
          <Link
            key={it.id}
            href={`/admin/renovaciones/${it.id}`}
            className="admin-mobile-card"
          >
            <p className="font-semibold text-primary">{it.alumno.nombre}</p>
            <p className="text-sm text-text-secondary">
              {it.alumno.alumno_ref} · {it.alumno.nivel_label}{' '}
              {it.alumno.grado_label ?? it.alumno.grado ?? '—'} / {it.alumno.grupo}
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              {it.verificado ? (
                <Badge variant="success">Verificada</Badge>
              ) : esCorreccionDocs || (it.docs_incorrectos_count ?? 0) > 0 ? (
                <Badge variant="pending">Docs incorrectos</Badge>
              ) : (
                <Badge variant="pending">Pendiente</Badge>
              )}
              {it.beca_autorizada ? (
                <Badge variant="primary">Autorizada</Badge>
              ) : null}
            </div>
            {esCorreccionDocs && it.docs_incorrectos?.length ? (
              <p className="mt-2 text-xs text-text-secondary">
                {it.docs_incorrectos.map((d) => d.label).join(' · ')}
              </p>
            ) : null}
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
              {esCorreccionDocs ? <th>Docs incorrectos</th> : null}
              <th>Estado</th>
              <th>Enviado</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((it) => (
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
                  {it.alumno.grado_label ?? it.alumno.grado ?? '—'} / {it.alumno.grupo}
                </td>
                {esCorreccionDocs ? (
                  <td className="max-w-xs text-sm text-text-secondary">
                    {it.docs_incorrectos?.length ? (
                      <ul className="list-inside list-disc space-y-1">
                        {it.docs_incorrectos.map((d) => (
                          <li key={d.tipo}>
                            <span className="font-medium text-text-primary">
                              {d.label}
                            </span>
                            {d.nota ? (
                              <span className="block text-xs">{d.nota}</span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      '—'
                    )}
                  </td>
                ) : null}
                <td>
                  <div className="flex flex-wrap gap-1">
                    {it.verificado ? (
                      <Badge variant="success">Verificada</Badge>
                    ) : esCorreccionDocs ? (
                      <Badge variant="pending">Esperando corrección</Badge>
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
