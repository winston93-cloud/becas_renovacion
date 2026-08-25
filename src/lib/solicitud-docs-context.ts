/**
 * 2026-08-25 - Contexto de documentos requeridos en solicitud de beca:
 * ingresos siempre; boleta SEP salvo reinscrito (promedio en Boletas) o sin_boleta_sep (MK).
 */
import { getCicloBecaARenovar } from '@/lib/ciclo-escolar';
import {
  docsRequeridos,
  esMaternalOKinder,
  type DocsRequeridosOpts,
} from '@/lib/documentos-requeridos';
import {
  cargarPromedioBecadoRenovacion,
  promedioTieneCalificacion,
  type PromedioBecadoRenovacion,
} from '@/lib/promedioBecadoRenovacion';
import type { DocumentoTipo } from '@/lib/types';

export type SolicitudDocsContext = {
  opts: DocsRequeridosOpts;
  tipos: DocumentoTipo[];
  sin_boleta_sep: boolean;
  /** Alumno reinscrito en Winston: hay promedio en Boletas del ciclo previo. */
  alumno_reinscrito: boolean;
  exento_boleta_sep: boolean;
  es_maternal_kinder: boolean;
  promedio: PromedioBecadoRenovacion | null;
};

type AlumnoRow = {
  alumno_id: number;
  alumno_ref?: number | string | null;
  alumno_nivel?: number | null;
  alumno_grado?: number | null;
};

type SolicitudRow = {
  sin_boleta_sep?: boolean | null;
  beca_deseada_id?: number | null;
};

export async function buildSolicitudDocsContext(params: {
  alumno: AlumnoRow;
  solicitud?: SolicitudRow | null;
  becaClase?: string | null;
}): Promise<SolicitudDocsContext> {
  const nivel =
    params.alumno.alumno_nivel != null
      ? Number(params.alumno.alumno_nivel)
      : null;
  const grado =
    params.alumno.alumno_grado != null
      ? Number(params.alumno.alumno_grado)
      : null;
  const esMaternalKinder = esMaternalOKinder(nivel, grado);
  const sinBoletaSep = Boolean(params.solicitud?.sin_boleta_sep);

  const cicloPromedio = getCicloBecaARenovar();
  const promedio = await cargarPromedioBecadoRenovacion({
    alumnoId: Number(params.alumno.alumno_id),
    alumnoRef: String(params.alumno.alumno_ref ?? params.alumno.alumno_id),
    nivelFicha: nivel ?? 0,
    gradoFicha: grado ?? 0,
    cicloDatos: cicloPromedio,
  });

  const alumnoReinscrito = promedioTieneCalificacion(promedio);
  const exentoBoletaSep =
    alumnoReinscrito || (esMaternalKinder && sinBoletaSep);

  const opts: DocsRequeridosOpts = {
    flujo: 'solicitud',
    nivel,
    grado,
    becaId:
      params.solicitud?.beca_deseada_id != null
        ? Number(params.solicitud.beca_deseada_id)
        : null,
    becaClase: params.becaClase ?? null,
    exentoBoletaSep,
    sinBoletaSep: esMaternalKinder ? sinBoletaSep : false,
  };

  return {
    opts,
    tipos: docsRequeridos(opts),
    sin_boleta_sep: sinBoletaSep,
    alumno_reinscrito: alumnoReinscrito,
    exento_boleta_sep: exentoBoletaSep,
    es_maternal_kinder: esMaternalKinder,
    promedio,
  };
}
