/**
 * Promedio final Winston para el detalle admin de renovación.
 * Misma lógica que el reporte «Becados Promedio > 9» de servicios_admin,
 * pero SIN umbral: aplica a todos los becados del ciclo a renovar.
 */
import { origenCalifsDesdeFicha } from '@/lib/origenCalifsBecados';
import { getSchoolCycleLabel } from '@/lib/ciclo-escolar';

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

/**
 * @param cicloDatos Ciclo de la beca a renovar (`getCicloBecaARenovar()`).
 * @param nivelFicha Nivel actual del alumno (ficha).
 * @param gradoFicha Grado actual del alumno (ficha).
 */
export async function cargarPromedioBecadoRenovacion(opts: {
  alumnoId: number;
  alumnoRef: string;
  nivelFicha: number;
  gradoFicha: number;
  cicloDatos: number;
}): Promise<PromedioBecadoRenovacion> {
  const { alumnoId, alumnoRef, nivelFicha, gradoFicha, cicloDatos } = opts;

  const origen = origenCalifsDesdeFicha(nivelFicha, gradoFicha);
  if (!origen) {
    return vacio(
      cicloDatos,
      'Sin promedio en boletas del ciclo (sin grado previo en boletas Winston).'
    );
  }

  try {
    if (origen.fuente === 'kinder') {
      const { cargarPromediosKinderMysql } = await import(
        '@/lib/kinderPromedioMysql'
      );
      const mapa = await cargarPromediosKinderMysql([alumnoId]);
      const p = mapa.get(alumnoId);
      return {
        cicloDatos,
        cicloLabel: getSchoolCycleLabel(cicloDatos),
        fuente: 'kinder',
        gradoOrigen: origen.gradoOrigen,
        muestraEsEn: true,
        promedioEs: p?.promedioEs ?? null,
        promedioEn: p?.promedioEn ?? null,
        letraEn: p?.letraEn ?? null,
        promedioGeneral: p?.promedio ?? null,
        nota:
          p?.promedio == null
            ? 'Sin promedio en boletas del ciclo (Kinder ES/EN).'
            : null,
      };
    }

    if (origen.fuente === 'primaria') {
      const { cargarPromediosPrimariaMysql } = await import(
        '@/lib/primariaPromedioMysql'
      );
      const mapa = await cargarPromediosPrimariaMysql([
        {
          alumnoId,
          alumnoRef: String(alumnoRef ?? '').trim(),
          grado: origen.gradoOrigen,
        },
      ]);
      const p = mapa.get(alumnoId);
      // 7mo (ficha secundaria grado 1): origen primaria 6° → una sola columna.
      const soloGeneral = Number(nivelFicha) === 4;
      return {
        cicloDatos,
        cicloLabel: getSchoolCycleLabel(cicloDatos),
        fuente: 'primaria',
        gradoOrigen: origen.gradoOrigen,
        muestraEsEn: !soloGeneral,
        promedioEs: soloGeneral ? null : (p?.promedioEs ?? null),
        promedioEn: soloGeneral ? null : (p?.promedioEn ?? null),
        letraEn: null,
        promedioGeneral: p?.promedio ?? null,
        nota:
          p?.promedio == null
            ? 'Sin promedio en boletas del ciclo (Primaria ES/EN).'
            : null,
      };
    }

    // secundaria
    const { cargarPromediosSecundariaMysql } = await import(
      '@/lib/secundariaPromedioMysql'
    );
    const mapa = await cargarPromediosSecundariaMysql([alumnoId], cicloDatos);
    const p = mapa.get(alumnoId);
    return {
      cicloDatos,
      cicloLabel: getSchoolCycleLabel(cicloDatos),
      fuente: 'secundaria',
      gradoOrigen: origen.gradoOrigen,
      muestraEsEn: false,
      promedioEs: null,
      promedioEn: null,
      letraEn: null,
      promedioGeneral: p?.promedio ?? null,
      nota:
        p?.promedio == null
          ? 'Sin promedio en boletas del ciclo (Secundaria).'
          : null,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al leer MySQL';
    return vacio(cicloDatos, `No se pudo cargar el promedio: ${msg}`, {
      fuente: origen.fuente,
      gradoOrigen: origen.gradoOrigen,
      muestraEsEn: origen.fuente !== 'secundaria' && Number(nivelFicha) !== 4,
    });
  }
}
