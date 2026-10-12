/**
 * 2026-10-07 - Control Escolar · Beca SEP: trámites enviados por las familias (filtrados por nivel del rol).
 * 2026-10-12 - Panel como cola de trabajo: cifras, filtros, orden FIFO y tabla paginada (no lista infinita).
 */
import { redirect } from 'next/navigation';
import { getSchoolCycleLabel } from '@/lib/ciclo-escolar';
import { leerAdminSep } from '@/lib/sep/admin';
import { cicloSep, listarSep, montoVigente, porcentajeEfectivo, requiereRevisionManual } from '@/lib/sep/servicio';
import { resumenBeneficiosExternos } from '@/lib/sep/beneficiosExternos';
import { gradosDeNiveles, type FilaCuestionarioSep, type FilaTramiteSep, type ResumenBxPanel, type VistaTramite } from '@/lib/sep/panelLista';
import { PanelSep } from './PanelSep';

export default async function AdminSepPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string; hecho?: string; de?: string }>;
}) {
  const admin = await leerAdminSep();
  if (!admin) redirect('/admin/login');
  const { vista, hecho, de } = await searchParams;
  const [todas, externos] = await Promise.all([listarSep(admin), resumenBeneficiosExternos(admin)]);
  const tramitePorRef = new Map(todas.map((s) => [s.alumnoRef, s.id]));

  const tramites: FilaTramiteSep[] = todas.map((s) => ({
    id: s.id,
    alumnoRef: s.alumnoRef,
    nombreAlumno: s.nombreAlumno,
    nivel: s.nivel,
    grado: s.grado,
    estado: s.estado,
    porcentaje: porcentajeEfectivo(s),
    monto: montoVigente(s),
    fecha: s.enviadaEn ?? s.aplicadaEn ?? s.actualizadaEn ?? s.creadaEn,
    revisionManual: s.estado === 'enviada' && requiereRevisionManual(s),
    motivoCorreccion: s.motivoCorreccion,
  }));

  const cuestionario: FilaCuestionarioSep[] = (externos?.respuestas ?? []).map((f) => ({
    alumnoRef: f.alumno_ref ?? null,
    alumnoNivel: f.alumno_nivel,
    aplico: f.aplico,
    beneficio: f.beneficio,
    beneficioNombre: f.beneficio_nombre,
    recibio: f.recibio,
    esPrueba: f.es_prueba,
    actualizadoEn: f.actualizado_en ?? null,
    tramiteId: f.alumno_ref != null ? (tramitePorRef.get(f.alumno_ref) ?? null) : null,
    tieneTramite: f.alumno_ref != null && tramitePorRef.has(f.alumno_ref),
  }));

  const resumen: ResumenBxPanel | null = externos
    ? {
        contestaron: externos.contestaron,
        noAplicaron: externos.noAplicaron,
        aplicaron: externos.aplicaron,
        sep: externos.sep,
        otra: externos.otra,
        dePrueba: externos.dePrueba,
      }
    : null;

  const vistaInicial: VistaTramite =
    vista === 'familia' || vista === 'aplicadas' || vista === 'revisar' ? vista : 'revisar';

  return (
    <div className="space-y-4">
      <div className="admin-hero">
        <h2>Beca SEP</h2>
        <p>
          {admin.label} · Ciclo {getSchoolCycleLabel(cicloSep())}
        </p>
        <p className="text-sm">
          Revise primero quien lleva más tiempo esperando. Busque por nombre o no. de control; el
          cuestionario dice quién aplicó aunque todavía no suba su documento.
        </p>
      </div>

      <PanelSep
        tramites={tramites}
        cuestionario={cuestionario}
        resumen={resumen}
        esSistemas={admin.esSistemas}
        hecho={hecho}
        de={de}
        vistaInicial={vistaInicial}
        gradosDisponibles={gradosDeNiveles(admin.niveles)}
      />
    </div>
  );
}
