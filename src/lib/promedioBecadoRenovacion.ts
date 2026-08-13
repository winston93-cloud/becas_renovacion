/**
 * Promedio final Winston para el detalle admin de renovación.
 *
 * 2026-08-13 - Fuente principal: InsForge proyecto Boletas (`promedio_ciclo`),
 * ciclo = getCicloBecaARenovar() (ej. 22). La ficha puede ir un grado adelante
 * (6° en renovación ↔ boleta 5° en ciclo 22).
 *
 * Sin umbral ≥9: aplica a todos los becados.
 */
import { origenCalifsDesdeFicha } from '@/lib/origenCalifsBecados';
import { getSchoolCycleLabel } from '@/lib/ciclo-escolar';
import { getInsforgeBoletasConfig } from '@/lib/insforge-boletas';

export type PromedioBecadoRenovacion = {
  cicloDatos: number;
  cicloLabel: string;
  fuente: 'kinder' | 'primaria' | 'secundaria' | null;
  gradoOrigen: number | null;
  muestraEsEn: boolean;
  promedioEs: number | null;
  promedioEn: number | null;
  letraEn: string | null;
  promedioGeneral: number | null;
  nota: string | null;
};

function vacio(
  cicloDatos: number,
  nota: string,
  extras?: Partial<PromedioBecadoRenovacion>
): PromedioBecadoRenovacion {
  return {
    cicloDatos,
    cicloLabel: getSchoolCycleLabel(cicloDatos),
    fuente: null,
    gradoOrigen: null,
    muestraEsEn: false,
    promedioEs: null,
    promedioEn: null,
    letraEn: null,
    promedioGeneral: null,
    nota,
    ...extras,
  };
}

function numOrNull(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Lee promedio desde InsForge Boletas (`promedio_ciclo`).
 * Si la tabla aún no existe / backend no listo, devuelve nota explicativa.
 */
async function cargarDesdeInsforgeBoletas(opts: {
  alumnoId: number;
  nivelFicha: number;
  gradoFicha: number;
  cicloDatos: number;
}): Promise<PromedioBecadoRenovacion> {
  const { alumnoId, nivelFicha, gradoFicha, cicloDatos } = opts;
  const origen = origenCalifsDesdeFicha(nivelFicha, gradoFicha);
  const cfg = getInsforgeBoletasConfig();
  if (!cfg) {
    return vacio(
      cicloDatos,
      'Falta configurar INSFORGE_BOLETAS_URL / INSFORGE_BOLETAS_API_KEY.'
    );
  }

  try {
    const { createAdminClient } = await import('@insforge/sdk');
    const db = createAdminClient({
      baseUrl: cfg.baseUrl,
      apiKey: cfg.apiKey,
    });

    const { data, error } = await db.database
      .from('promedio_ciclo')
      .select(
        'alumno_id, ciclo, nivel_origen, grado_origen, fuente, promedio_es, promedio_en, letra_en, promedio_general'
      )
      .eq('alumno_id', alumnoId)
      .eq('ciclo', cicloDatos)
      .maybeSingle();

    if (error) {
      return vacio(
        cicloDatos,
        `InsForge Boletas: ${error.message}. Si el proyecto es nuevo, hay que crear la tabla promedio_ciclo y migrar el ciclo ${cicloDatos}.`,
        origen
          ? {
              fuente: origen.fuente,
              gradoOrigen: origen.gradoOrigen,
              muestraEsEn:
                origen.fuente !== 'secundaria' && Number(nivelFicha) !== 4,
            }
          : undefined
      );
    }

    if (!data) {
      return vacio(
        cicloDatos,
        origen
          ? `Sin promedio en InsForge Boletas para este alumno (ciclo ${cicloDatos}, origen ${origen.fuente} grado ${origen.gradoOrigen}).`
          : `Sin promedio en boletas del ciclo (sin grado previo).`,
        origen
          ? {
              fuente: origen.fuente,
              gradoOrigen: origen.gradoOrigen,
              muestraEsEn:
                origen.fuente !== 'secundaria' && Number(nivelFicha) !== 4,
            }
          : undefined
      );
    }

    const fuente = String(data.fuente || origen?.fuente || '') as
      | 'kinder'
      | 'primaria'
      | 'secundaria';
    const soloGeneral = Number(nivelFicha) === 4 && fuente === 'primaria';
    const muestraEsEn =
      (fuente === 'kinder' || fuente === 'primaria') && !soloGeneral;

    return {
      cicloDatos,
      cicloLabel: getSchoolCycleLabel(cicloDatos),
      fuente: fuente || origen?.fuente || null,
      gradoOrigen:
        data.grado_origen != null
          ? Number(data.grado_origen)
          : (origen?.gradoOrigen ?? null),
      muestraEsEn,
      promedioEs: muestraEsEn ? numOrNull(data.promedio_es) : null,
      promedioEn: muestraEsEn ? numOrNull(data.promedio_en) : null,
      letraEn: muestraEsEn && data.letra_en ? String(data.letra_en) : null,
      promedioGeneral: numOrNull(data.promedio_general),
      nota:
        numOrNull(data.promedio_general) == null
          ? 'Registro en Boletas sin promedio_general.'
          : null,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error InsForge Boletas';
    return vacio(cicloDatos, `No se pudo cargar el promedio: ${msg}`, {
      fuente: origen?.fuente ?? null,
      gradoOrigen: origen?.gradoOrigen ?? null,
      muestraEsEn: Boolean(
        origen && origen.fuente !== 'secundaria' && Number(nivelFicha) !== 4
      ),
    });
  }
}

/**
 * @param cicloDatos Ciclo de la beca a renovar (`getCicloBecaARenovar()`).
 */
export async function cargarPromedioBecadoRenovacion(opts: {
  alumnoId: number;
  alumnoRef: string;
  nivelFicha: number;
  gradoFicha: number;
  cicloDatos: number;
}): Promise<PromedioBecadoRenovacion> {
  // Ya no se consulta MySQL hosting (sale de servicio). Solo InsForge Boletas.
  return cargarDesdeInsforgeBoletas(opts);
}
