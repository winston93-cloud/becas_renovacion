'use client';

/**
 * 2026-10-09 - Aviso en Renovaciones / Solicitudes: la beca del colegio del alumno se sustituyó por la Beca SEP
 * y no se renueva (la familia debe hacer Solicitud nueva). Sin movimientos no muestra nada.
 *   alumnoRef  → aviso de un solo alumno (detalle del expediente)
 *   sin props  → lista de todos los alumnos con beca sustituida (listado de Renovaciones)
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert } from '@/components/ui';

type Movimiento = {
  solicitudId: string;
  alumnoRef: number;
  nombreAlumno: string;
  cicloLabel: string;
  porcentajeSep: number | null;
  becaSustituida: { clase: string | null; porcentaje: number } | null;
  texto: string;
};

export function AvisoMovimientoSep({ alumnoRef }: { alumnoRef?: string | number }) {
  const [movs, setMovs] = useState<Movimiento[]>([]);

  useEffect(() => {
    let vivo = true;
    const qs = alumnoRef ? `?alumno_ref=${encodeURIComponent(String(alumnoRef))}` : '';
    fetch(`/api/admin/sep/movimientos${qs}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { movimientos: [] }))
      .then((j) => vivo && setMovs(Array.isArray(j.movimientos) ? j.movimientos : []))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [alumnoRef]);

  if (!movs.length) return null;

  if (alumnoRef) {
    const m = movs[0];
    return (
      <Alert variant="warning" title="Beca sustituida por la Beca SEP">
        {m.texto}{' '}
        <Link href={`/admin/sep/${m.solicitudId}`} className="font-semibold underline">
          Ver trámite SEP
        </Link>
      </Alert>
    );
  }

  return (
    <Alert variant="warning" title={`Becas sustituidas por la Beca SEP (${movs.length})`}>
      <p className="mb-2">
        A estos alumnos se les aplicó la Beca SEP y perdieron la beca del colegio: esa beca <strong>no se renueva</strong>.
        Si la familia la quiere de nuevo, debe hacer una Solicitud nueva.
      </p>
      <ul className="space-y-1">
        {movs.map((m) => (
          <li key={m.solicitudId}>
            <Link href={`/admin/sep/${m.solicitudId}`} className="font-semibold underline">
              {m.nombreAlumno}
            </Link>{' '}
            ({m.alumnoRef}) · {m.cicloLabel} · SEP {m.porcentajeSep ?? '—'} %
            {m.becaSustituida ? ` · perdió ${m.becaSustituida.clase ?? 'beca'} ${m.becaSustituida.porcentaje} %` : ''}
          </li>
        ))}
      </ul>
    </Alert>
  );
}
