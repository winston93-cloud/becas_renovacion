/**
 * Arma payload de carta de aceptación desde expediente admin (InsForge).
 */
import {
  getCicloBecaARenovar,
  getCurrentSchoolCycle,
  getSchoolCycleLabel,
} from '@/lib/ciclo-escolar';
import { getInsforgeAdmin } from '@/lib/insforge-server';

export type NivelCartaFirma = 'maternal-kinder' | 'primaria' | 'secundaria';

export type CartaAceptacionPayload = {
  nivel: NivelCartaFirma;
  datos: {
    tutorNombre: string;
    alumnoNombre: string;
    grado: string;
    tipoBeca: string;
    becaId: number;
    porcentaje: string;
    promedioMinimoCartaOverride?: number | null;
    cicloLabel?: string;
  };
};

type Db = ReturnType<typeof getInsforgeAdmin>['database'];

export function nivelCartaDesdeAlumno(
  nivel: number | null | undefined
): NivelCartaFirma | null {
  const n = Number(nivel);
  if (!Number.isFinite(n)) return null;
  if (n <= 2) return 'maternal-kinder';
  if (n === 3) return 'primaria';
  if (n === 4) return 'secundaria';
  return null;
}

export function gradoCartaBeca(
  nivel: number,
  grado: number | null | undefined
): string {
  const g = Number(grado);
  if (!Number.isFinite(g)) return '—';
  if (nivel === 1) return g === 1 ? 'MATERNAL A' : 'MATERNAL B';
  if (nivel === 2) return `KINDER ${g}`;
  if (nivel === 3 && g >= 1 && g <= 6) return `${g}° PRIMARIA`;
  if (nivel === 4 && g >= 1 && g <= 3) return `${g}° SECUNDARIA`;
  return String(g);
}

function nombreCompleto(
  app?: string | null,
  apm?: string | null,
  nombre?: string | null
): string {
  return [app, apm, nombre]
    .map((p) => (p != null ? String(p).trim() : ''))
    .filter(Boolean)
    .join(' ')
    .toUpperCase();
}

async function nombreTutorCarta(db: Db, alumnoId: number): Promise<string> {
  const { data, error } = await db
    .from('alumno_familiar')
    .select('tutor_id, familiar_app, familiar_apm, familiar_nombre')
    .eq('alumno_id', alumnoId)
    .in('tutor_id', [1, 2]);

  if (error) throw new Error(error.message);

  for (const tutorId of [2, 1]) {
    const row = (data || []).find((f) => Number(f.tutor_id) === tutorId);
    if (!row) continue;
    const n = nombreCompleto(
      row.familiar_app,
      row.familiar_apm,
      row.familiar_nombre
    );
    if (n) return n;
  }
  return 'PADRE DE FAMILIA';
}

export async function construirCartaAceptacionPayload(opts: {
  flujo: 'solicitud' | 'renovacion';
  expedienteId: string;
}): Promise<
  { ok: true; data: CartaAceptacionPayload } | { ok: false; error: string }
> {
  const db = getInsforgeAdmin().database;
  const tabla =
    opts.flujo === 'renovacion' ? 'becas_renovacion' : 'becas_solicitud';

  const { data: parent, error: pErr } = await db
    .from(tabla)
    .select('*')
    .eq('id', opts.expedienteId)
    .maybeSingle();

  if (pErr) return { ok: false, error: pErr.message };
  if (!parent) return { ok: false, error: 'Expediente no encontrado.' };

  const { data: alumno, error: aErr } = await db
    .from('alumno')
    .select(
      'alumno_id, alumno_app, alumno_apm, alumno_nombre, alumno_nivel, alumno_grado'
    )
    .eq('alumno_id', Number(parent.alumno_id))
    .maybeSingle();

  if (aErr) return { ok: false, error: aErr.message };
  if (!alumno) return { ok: false, error: 'Alumno no encontrado.' };

  const nivelCarta = nivelCartaDesdeAlumno(Number(alumno.alumno_nivel));
  if (!nivelCarta) {
    return { ok: false, error: 'Nivel escolar no soportado para la carta.' };
  }

  let becaId: number | null = null;
  let becaClase: string | null = null;
  let becaPorcentaje: number | null = null;
  const promedioOverride: number | null =
    parent.promedio_minimo_carta != null
      ? Number(parent.promedio_minimo_carta)
      : null;

  if (opts.flujo === 'solicitud') {
    becaId =
      parent.beca_deseada_id != null ? Number(parent.beca_deseada_id) : null;
    becaPorcentaje =
      parent.beca_porcentaje_deseado != null
        ? Number(parent.beca_porcentaje_deseado)
        : null;
  } else {
    const { data: becaRow } = await db
      .from('alumno_beca')
      .select('beca_id, beca_porcentaje')
      .eq('alumno_id', Number(alumno.alumno_id))
      .eq('beca_ciclo_escolar', getCicloBecaARenovar())
      .maybeSingle();
    becaId = becaRow?.beca_id != null ? Number(becaRow.beca_id) : null;
    becaPorcentaje =
      becaRow?.beca_porcentaje != null ? Number(becaRow.beca_porcentaje) : null;
  }

  if (becaId != null && becaId > 0) {
    const { data: concepto } = await db
      .from('becas_concepto_beca')
      .select('beca_clase')
      .eq('beca_id', becaId)
      .maybeSingle();
    becaClase = concepto?.beca_clase ? String(concepto.beca_clase) : null;
  }

  if (!becaClase || becaPorcentaje == null || !(Number(becaPorcentaje) >= 0)) {
    return {
      ok: false,
      error: 'Defina tipo y porcentaje de beca antes de ver la carta.',
    };
  }

  const tutorNombre = await nombreTutorCarta(db, Number(alumno.alumno_id));
  const cicloLabel = getSchoolCycleLabel(getCurrentSchoolCycle()).replace(
    '-',
    '–'
  );

  return {
    ok: true,
    data: {
      nivel: nivelCarta,
      datos: {
        tutorNombre,
        alumnoNombre: nombreCompleto(
          alumno.alumno_app,
          alumno.alumno_apm,
          alumno.alumno_nombre
        ),
        grado: gradoCartaBeca(
          Number(alumno.alumno_nivel),
          Number(alumno.alumno_grado)
        ),
        tipoBeca: becaClase,
        becaId: becaId as number,
        porcentaje: `${Math.round(Number(becaPorcentaje))}%`,
        promedioMinimoCartaOverride: promedioOverride,
        cicloLabel,
      },
    },
  };
}
