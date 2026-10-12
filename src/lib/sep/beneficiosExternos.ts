/**
 * 2026-10-12 - Respuestas de las familias al cuestionario "Beneficios externos" (servicios escolares):
 * cuántas aplicaron a una beca externa antes de subir documentos. Solo lectura.
 */
import 'server-only';
import { getInsforgeAdmin } from '@/lib/insforge-server';
import { cicloSep, type AdminSep } from '@/lib/sep/servicio';

export type FilaBeneficioExterno = {
  alumno_ref?: number | null;
  alumno_nivel: number | null;
  aplico: boolean;
  beneficio: 'sep' | 'otra' | null;
  beneficio_nombre: string | null;
  recibio: boolean | null;
  es_prueba: boolean;
  actualizado_en?: string | null;
};

type Conteo = { total: number; recibida: number; enEspera: number };

export type ResumenBeneficiosExternos = {
  contestaron: number;
  noAplicaron: number;
  aplicaron: number;
  sep: Conteo;
  otra: Conteo & { nombres: { nombre: string; total: number }[] };
  porNivel: { nivel: number | null; contestaron: number; aplicaron: number; sep: number }[];
  dePrueba: number;
  /** 2026-10-12 - Respuestas de los alumnos de prueba, para ver que el cuestionario sí guarda. */
  pruebas: FilaBeneficioExterno[];
  /** 2026-10-12 - Todas las filas (reales y de prueba) para la tabla filtrable del panel. */
  respuestas: FilaBeneficioExterno[];
};

const conteoVacio = (): Conteo => ({ total: 0, recibida: 0, enEspera: 0 });

export function resumirBeneficiosExternos(filas: FilaBeneficioExterno[]): ResumenBeneficiosExternos {
  const reales = filas.filter((f) => !f.es_prueba);
  const sep = conteoVacio();
  const otra = conteoVacio();
  const nombres = new Map<string, number>();
  const niveles = new Map<number | null, { contestaron: number; aplicaron: number; sep: number }>();

  for (const f of reales) {
    const n = niveles.get(f.alumno_nivel) ?? { contestaron: 0, aplicaron: 0, sep: 0 };
    n.contestaron += 1;
    if (f.aplico) {
      n.aplicaron += 1;
      const c = f.beneficio === 'sep' ? sep : otra;
      c.total += 1;
      if (f.recibio === true) c.recibida += 1;
      else if (f.recibio === false) c.enEspera += 1;
      if (f.beneficio === 'sep') n.sep += 1;
      const nombre = f.beneficio === 'otra' ? f.beneficio_nombre?.trim().toUpperCase() : '';
      if (nombre) nombres.set(nombre, (nombres.get(nombre) ?? 0) + 1);
    }
    niveles.set(f.alumno_nivel, n);
  }

  const aplicaron = sep.total + otra.total;
  return {
    contestaron: reales.length,
    noAplicaron: reales.length - aplicaron,
    aplicaron,
    sep,
    otra: {
      ...otra,
      nombres: [...nombres.entries()]
        .map(([nombre, total]) => ({ nombre, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5),
    },
    porNivel: [...niveles.entries()]
      .sort(([a], [b]) => (a ?? 99) - (b ?? 99))
      .map(([nivel, v]) => ({ nivel, ...v })),
    dePrueba: filas.length - reales.length,
    pruebas: filas.filter((f) => f.es_prueba),
    respuestas: filas,
  };
}

/** Respuestas del ciclo vigente en los niveles del rol. Si la tabla falla, devuelve null (no tumba el panel). */
export async function resumenBeneficiosExternos(admin: AdminSep): Promise<ResumenBeneficiosExternos | null> {
  try {
    const { data, error } = await getInsforgeAdmin()
      .database.from('beneficios_externos_respuesta')
      .select('alumno_ref, alumno_nivel, aplico, beneficio, beneficio_nombre, recibio, es_prueba, actualizado_en')
      .eq('ciclo_escolar', cicloSep())
      .in('alumno_nivel', admin.niveles.length ? admin.niveles : [-1]);
    if (error) throw error;
    return resumirBeneficiosExternos((data ?? []) as FilaBeneficioExterno[]);
  } catch (e) {
    console.error('[sep/beneficiosExternos]', e);
    return null;
  }
}
