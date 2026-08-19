/**
 * GET — Familias con excepción post-cierre (enviado, no verificado, doc incorrecto).
 */
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getInsforgeAdmin } from '@/lib/insforge-server';
import { getCicloBecaARenovar } from '@/lib/ciclo-escolar';
import { labelGrado } from '@/lib/label-grado';
import { DOCUMENTO_FLAG_COLUMN } from '@/lib/documentos-requeridos';

const DOC_LABELS: Record<string, string> = {
  ingresos: 'Comprobante de ingresos',
  domicilio: 'Comprobante de domicilio',
  comp_inscripcion: 'Comprobante inscripción',
  acta_nacimiento: 'Acta de nacimiento',
  curp: 'CURP',
  curp_tutor: 'CURP tutor',
  constancia_no_adeudo: 'Constancia no adeudo',
  carta_buena_conducta: 'Carta buena conducta',
  boleta: 'Boleta SEP',
};

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const admin = getInsforgeAdmin();
    const ciclo = getCicloBecaARenovar();

    const { data: renovaciones, error: renErr } = await admin.database
      .from('becas_renovacion')
      .select('id, alumno_id, correo_enviado_en')
      .eq('ciclo_escolar', ciclo)
      .eq('correo_enviado', true)
      .eq('verificado', false);

    if (renErr) {
      return NextResponse.json({ error: renErr.message }, { status: 500 });
    }

    const familias: Array<{
      alumno_ref: string;
      nombre: string;
      grado: string;
      grupo: string | null;
      enviado_en: string | null;
      docs_incorrectos: Array<{ tipo: string; label: string; nota: string | null }>;
    }> = [];

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
          'alumno_ref, alumno_app, alumno_apm, alumno_nombre, alumno_nivel, alumno_grado, alumno_grupo'
        )
        .eq('alumno_id', ren.alumno_id)
        .maybeSingle();

      if (!alumno) continue;

      if (!auth.admin.niveles.includes(Number(alumno.alumno_nivel))) continue;

      familias.push({
        alumno_ref: String(alumno.alumno_ref),
        nombre: `${alumno.alumno_app || ''} ${alumno.alumno_apm || ''} ${alumno.alumno_nombre || ''}`.trim(),
        grado: labelGrado(alumno.alumno_nivel, alumno.alumno_grado),
        grupo: alumno.alumno_grupo != null ? String(alumno.alumno_grupo) : null,
        enviado_en: ren.correo_enviado_en || null,
        docs_incorrectos: docs.map((d) => ({
          tipo: d.tipo,
          label: DOC_LABELS[d.tipo] || d.tipo,
          nota: d.revision_nota || null,
        })),
      });
    }

    familias.sort((a, b) => Number(a.alumno_ref) - Number(b.alumno_ref));

    return NextResponse.json({
      ciclo,
      total: familias.length,
      familias,
      _tipos_documento: Object.keys(DOCUMENTO_FLAG_COLUMN),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
