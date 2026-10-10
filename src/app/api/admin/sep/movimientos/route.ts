/**
 * 2026-10-09 - Movimientos Beca SEP para Renovaciones / Solicitudes: becas del colegio sustituidas por la SEP
 * (no se renuevan; la familia debe hacer Solicitud nueva). ?alumno_ref= para un solo alumno.
 * Respeta los niveles del rol que consulta.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCicloBecaARenovar, getCurrentSchoolCycle } from '@/lib/ciclo-escolar';
import { requireAdminSep } from '@/lib/sep/admin';
import { respuestaError } from '@/lib/sep/http';
import { movimientosSep, textoBecaSustituida } from '@/lib/sep/movimientos';

export async function GET(request: NextRequest) {
  const auth = await requireAdminSep();
  if (!auth.ok) return auth.response;
  try {
    const ref = Number(request.nextUrl.searchParams.get('alumno_ref') || 0);
    const ciclos = [...new Set([getCurrentSchoolCycle(), getCicloBecaARenovar()])];
    const lista = await movimientosSep({ ciclos, niveles: auth.admin.niveles });
    const movimientos = lista
      .filter((m) => !ref || m.alumnoRef === ref)
      .map((m) => ({ ...m, texto: textoBecaSustituida(m) }));
    return NextResponse.json({ movimientos }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (err) {
    return respuestaError(err, 'GET /api/admin/sep/movimientos');
  }
}
