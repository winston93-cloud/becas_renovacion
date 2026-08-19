import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import {
  listRenovaciones,
  type AdminListEstado,
} from '@/lib/admin-queries';
import {
  getCicloBecaARenovar,
  getCurrentSchoolCycle,
  getSchoolCycleLabel,
} from '@/lib/ciclo-escolar';

export const maxDuration = 60;

function mensajeErrorApi(err: unknown): string {
  const raw = err instanceof Error ? err.message : 'Error al listar renovaciones.';
  if (raw.includes('<html>') || raw.includes('502 Bad Gateway')) {
    return 'El servidor de datos no respondió. Espere unos segundos e intente de nuevo.';
  }
  return raw.length > 280 ? `${raw.slice(0, 280)}…` : raw;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const sp = request.nextUrl.searchParams;
    const ciclo = Number(sp.get('ciclo') || getCicloBecaARenovar());
    const gradoRaw = sp.get('grado');
    const grado =
      gradoRaw != null && gradoRaw !== '' ? Number(gradoRaw) : null;
    const estado = (sp.get('estado') || 'enviadas') as AdminListEstado;

    const rows = await listRenovaciones({
      admin: auth.admin,
      ciclo,
      grado: Number.isFinite(grado as number) ? grado : null,
      estado,
    });

    // Etiqueta visible = ciclo destino (calendario), no el ciclo de origen de la beca.
    const cicloDestino = getCurrentSchoolCycle();

    return NextResponse.json({
      ciclo,
      ciclo_label: getSchoolCycleLabel(cicloDestino),
      titulo: `Renovación de becas ${getSchoolCycleLabel(cicloDestino)}`,
      total: rows.length,
      items: rows,
    });
  } catch (err) {
    return NextResponse.json({ error: mensajeErrorApi(err) }, { status: 500 });
  }
}
