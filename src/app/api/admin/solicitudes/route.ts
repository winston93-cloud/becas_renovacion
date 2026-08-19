import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import {
  listSolicitudes,
  type AdminListEstado,
} from '@/lib/admin-queries';
import {
  getCurrentSchoolCycle,
  getSchoolCycleLabel,
} from '@/lib/ciclo-escolar';

export const maxDuration = 60;

function mensajeErrorApi(err: unknown): string {
  const raw = err instanceof Error ? err.message : 'Error al listar solicitudes.';
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
    const ciclo = Number(sp.get('ciclo') || getCurrentSchoolCycle());
    const gradoRaw = sp.get('grado');
    const grado =
      gradoRaw != null && gradoRaw !== '' ? Number(gradoRaw) : null;
    const estado = (sp.get('estado') || 'enviadas') as AdminListEstado;

    const rows = await listSolicitudes({
      admin: auth.admin,
      ciclo,
      grado: Number.isFinite(grado as number) ? grado : null,
      estado,
    });

    return NextResponse.json({
      ciclo,
      ciclo_label: getSchoolCycleLabel(ciclo),
      total: rows.length,
      items: rows,
    });
  } catch (err) {
    return NextResponse.json({ error: mensajeErrorApi(err) }, { status: 500 });
  }
}
