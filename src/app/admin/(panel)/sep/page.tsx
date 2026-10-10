/**
 * 2026-10-07 - Control Escolar · Beca SEP: trámites enviados por las familias (filtrados por nivel del rol).
 * 2026-10-08 - Simplificado: tres pestañas (Por revisar, Esperando a la familia, Aplicadas) y aviso de
 *              "Listo" al volver de una revisión.
 */
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card } from '@/components/ui';
import { getSchoolCycleLabel } from '@/lib/ciclo-escolar';
import { pesos } from '@/lib/sep/core/dinero';
import { NOMBRE_NIVEL } from '@/lib/sep/core/ciclo';
import { leerAdminSep } from '@/lib/sep/admin';
import { cicloSep, listarSep, montoVigente, porcentajeEfectivo, requiereRevisionManual } from '@/lib/sep/servicio';
import type { EstadoSep, SolicitudSep } from '@/lib/sep/tipos';
import { AvisoListo } from './AvisoListo';

const VISTAS = [
  { valor: 'revisar', texto: 'Por revisar', estados: ['enviada'] as EstadoSep[], vacio: 'No hay documentos por revisar. ¡Todo al día!' },
  { valor: 'familia', texto: 'Esperando a la familia', estados: ['correccion', 'borrador'] as EstadoSep[], vacio: 'Ninguna familia tiene pendiente un documento.' },
  { valor: 'aplicadas', texto: 'Aplicadas', estados: ['aplicada'] as EstadoSep[], vacio: 'Todavía no hay becas aplicadas en este ciclo.' },
];

const nivelGrado = (s: SolicitudSep) =>
  `${s.nivel != null ? NOMBRE_NIVEL[s.nivel] ?? `Nivel ${s.nivel}` : 'Sin nivel'}${s.grado ? ` ${s.grado}°` : ''}`;

const fechaCorta = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) : '—';

export default async function AdminSepPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string; hecho?: string; de?: string }>;
}) {
  const admin = await leerAdminSep();
  if (!admin) redirect('/admin/login');
  const { vista, hecho, de } = await searchParams;
  const todas = await listarSep(admin);
  const conteo = (estados: EstadoSep[]) => todas.filter((s) => estados.includes(s.estado)).length;
  const actual = VISTAS.find((v) => v.valor === vista) ?? VISTAS[0];
  const lista = todas
    .filter((s) => actual.estados.includes(s.estado))
    .sort((a, b) => (a.enviadaEn ?? a.creadaEn).localeCompare(b.enviadaEn ?? b.creadaEn));

  return (
    <div className="space-y-4">
      <div className="admin-hero">
        <h2>Beca SEP</h2>
        <p>
          {admin.label} · Ciclo {getSchoolCycleLabel(cicloSep())}
        </p>
        <p className="text-sm">
          Las familias suben aquí el documento de la SEP. Usted solo revisa que sea del alumno y que el
          porcentaje esté bien, y da <strong>Aplicar</strong>. Las cuentas las hace el sistema.
        </p>
      </div>

      <AvisoListo hecho={hecho} de={de} pendientes={conteo(['enviada'])} />

      <nav className="flex flex-wrap items-center gap-2" aria-label="Trámites">
        {VISTAS.map((v) => {
          const n = conteo(v.estados);
          const activa = v.valor === actual.valor;
          return (
            <Link
              key={v.valor}
              href={`/admin/sep?vista=${v.valor}`}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${
                activa ? 'border-primary bg-primary text-white' : 'border-border bg-card text-primary'
              }`}
            >
              {v.texto}
              <span className={`rounded-full px-2 text-xs ${activa ? 'bg-white/20' : 'bg-bg'}`}>{n}</span>
            </Link>
          );
        })}
        {admin.esSistemas ? (
          // 2026-10-09 - Antes "Reporte de Sistemas": ahora tablero de Dirección General.
          <Link href="/admin/sep/direccion" className="ml-auto rounded-full border border-accent px-4 py-2 text-sm font-semibold text-accent">
            Dirección General →
          </Link>
        ) : null}
      </nav>

      {lista.length === 0 ? (
        <Card className="py-10 text-center text-sm text-text-secondary">{actual.vacio}</Card>
      ) : (
        <ul className="space-y-2">
          {lista.map((s) => (
            <li key={s.id}>
              <Link
                href={`/admin/sep/${s.id}`}
                className="admin-panel-card flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 transition hover:border-primary"
              >
                <div className="min-w-[14rem] flex-1">
                  <p className="font-semibold">{s.nombreAlumno}</p>
                  <p className="text-xs text-text-secondary">
                    No. control {s.alumnoRef} · {nivelGrado(s)}
                  </p>
                </div>
                <Detalle s={s} />
                <span className="ml-auto rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-white">
                  {s.estado === 'enviada' ? 'Revisar' : 'Ver'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Lo único que necesita saber la coordinación de cada trámite, en una línea. */
function Detalle({ s }: { s: SolicitudSep }) {
  const pct = porcentajeEfectivo(s);
  if (s.estado === 'enviada') {
    return (
      <div className="text-sm">
        <p>
          Beca {pct != null ? <strong>{pct} %</strong> : <span className="text-warning">sin porcentaje leído</span>}
          {requiereRevisionManual(s) ? <span className="ml-2 text-warning">· revisar el documento a mano</span> : null}
        </p>
        <p className="text-xs text-text-secondary">Enviado el {fechaCorta(s.enviadaEn)}</p>
      </div>
    );
  }
  if (s.estado === 'aplicada') {
    return (
      <div className="text-sm">
        <p>
          Beca <strong>{s.porcentajeConfirmado} %</strong> · paga <strong>{pesos(montoVigente(s))}</strong> al mes
        </p>
        <p className="text-xs text-text-secondary">Aplicada el {fechaCorta(s.aplicadaEn)}</p>
      </div>
    );
  }
  return (
    <div className="text-sm">
      <p className="text-warning">{s.estado === 'correccion' ? 'Le pedimos otro documento' : 'Subió documento pero aún no lo envía'}</p>
      {s.motivoCorreccion ? <p className="max-w-md truncate text-xs text-text-secondary">Motivo: {s.motivoCorreccion}</p> : null}
    </div>
  );
}
