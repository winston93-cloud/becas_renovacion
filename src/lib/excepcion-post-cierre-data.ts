/**
 * Datos de familias con excepción post-cierre (docs incorrectos).
 */
import type { getInsforgeAdmin } from '@/lib/insforge-server';
import { getCicloBecaARenovar, getCurrentSchoolCycle, getSchoolCycleLabel } from '@/lib/ciclo-escolar';
import { labelDocumentoTipo, labelNivel } from '@/lib/email-renovacion';
import { labelGrado } from '@/lib/label-grado';
import { labelGrupo } from '@/lib/label-grupo';

type AdminClient = ReturnType<typeof getInsforgeAdmin>;

export type ExcepcionDocIncorrecto = {
  tipo: string;
  label: string;
  nota: string | null;
};

export type ExcepcionFamilia = {
  alumno_id: number;
  alumno_ref: string;
  nombre: string;
  alumno_nivel: number;
  alumno_grado: number | null;
  nivel_label: string;
  grado: string;
  grupo: string | null;
  grado_grupo: string;
  enviado_en: string | null;
  docs_incorrectos: ExcepcionDocIncorrecto[];
};

export type ExcepcionGrupoGrado = {
  nivel: number;
  nivel_label: string;
  grado_num: number | null;
  grado_label: string;
  familias: ExcepcionFamilia[];
};

const NIVEL_ORDER = [1, 2, 3, 4] as const;

function gradoSortKey(f: ExcepcionFamilia): number {
  const g = f.alumno_grado;
  return g != null && Number.isFinite(g) ? g : 99;
}

export async function fetchExcepcionFamilias(
  admin: AdminClient,
  opts?: { niveles?: number[] }
): Promise<{ ciclo: number; ciclo_label: string; familias: ExcepcionFamilia[] }> {
  const ciclo = getCicloBecaARenovar();
  const ciclo_label = getSchoolCycleLabel(getCurrentSchoolCycle());
  const nivelesFilter = opts?.niveles;

  const { data: renovaciones, error: renErr } = await admin.database
    .from('becas_renovacion')
    .select('id, alumno_id, correo_enviado_en')
    .eq('ciclo_escolar', ciclo)
    .eq('correo_enviado', true)
    .eq('verificado', false);

  if (renErr) throw new Error(renErr.message);

  const familias: ExcepcionFamilia[] = [];

  for (const ren of renovaciones || []) {
    const { data: docs, error: docErr } = await admin.database
      .from('becas_documento')
      .select('tipo, revision_estado, revision_nota')
      .eq('renovacion_id', ren.id)
      .eq('revision_estado', 'incorrecto');

    if (docErr || !(docs?.length ?? 0)) continue;

    const { data: alumno } = await admin.database
      .from('alumno')
      .select(
        'alumno_id, alumno_ref, alumno_app, alumno_apm, alumno_nombre, alumno_nivel, alumno_grado, alumno_grupo'
      )
      .eq('alumno_id', ren.alumno_id)
      .maybeSingle();

    if (!alumno) continue;

    const nivel = Number(alumno.alumno_nivel);
    if (!Number.isFinite(nivel)) continue;
    if (nivelesFilter && !nivelesFilter.includes(nivel)) continue;

    const grado = labelGrado(alumno.alumno_nivel, alumno.alumno_grado);
    const grupo = labelGrupo(alumno.alumno_grupo);
    const gradoGrupo =
      [grado, grupo !== '—' ? grupo : null].filter(Boolean).join(' / ') || '—';

    familias.push({
      alumno_id: Number(alumno.alumno_id),
      alumno_ref: String(alumno.alumno_ref),
      nombre: `${alumno.alumno_app || ''} ${alumno.alumno_apm || ''} ${alumno.alumno_nombre || ''}`.trim(),
      alumno_nivel: nivel,
      alumno_grado:
        alumno.alumno_grado != null ? Number(alumno.alumno_grado) : null,
      nivel_label: labelNivel(nivel),
      grado,
      grupo: alumno.alumno_grupo != null ? String(alumno.alumno_grupo) : null,
      grado_grupo: gradoGrupo,
      enviado_en: ren.correo_enviado_en || null,
      docs_incorrectos: docs.map((d) => ({
        tipo: d.tipo,
        label: labelDocumentoTipo(String(d.tipo)),
        nota: d.revision_nota || null,
      })),
    });
  }

  familias.sort((a, b) => {
    if (a.alumno_nivel !== b.alumno_nivel) return a.alumno_nivel - b.alumno_nivel;
    const ga = gradoSortKey(a);
    const gb = gradoSortKey(b);
    if (ga !== gb) return ga - gb;
    return Number(a.alumno_ref) - Number(b.alumno_ref);
  });

  return { ciclo, ciclo_label, familias };
}

/** Agrupa por nivel escolar y grado (para PDF). */
export function agruparPorNivelGrado(
  familias: ExcepcionFamilia[]
): ExcepcionGrupoGrado[] {
  const map = new Map<string, ExcepcionGrupoGrado>();

  for (const f of familias) {
    const gradoNum = f.alumno_grado;
    const key = `${f.alumno_nivel}:${gradoNum ?? 'x'}`;
    let g = map.get(key);
    if (!g) {
      g = {
        nivel: f.alumno_nivel,
        nivel_label: f.nivel_label,
        grado_num: gradoNum,
        grado_label: f.grado,
        familias: [],
      };
      map.set(key, g);
    }
    g.familias.push(f);
  }

  return [...map.values()].sort((a, b) => {
    const ia = NIVEL_ORDER.indexOf(a.nivel as (typeof NIVEL_ORDER)[number]);
    const ib = NIVEL_ORDER.indexOf(b.nivel as (typeof NIVEL_ORDER)[number]);
    if (ia !== ib) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    const ga = a.grado_num ?? 99;
    const gb = b.grado_num ?? 99;
    return ga - gb;
  });
}

export function nivelSeccionTitulo(nivel: number): string {
  if (nivel === 1) return 'Maternal y Kinder — Maternal';
  if (nivel === 2) return 'Maternal y Kinder — Kinder';
  if (nivel === 3) return 'Primaria';
  if (nivel === 4) return 'Secundaria';
  return labelNivel(nivel);
}

export function docTiposLista(docs: ExcepcionDocIncorrecto[]): string {
  return docs.map((d) => d.label).join('; ');
}
