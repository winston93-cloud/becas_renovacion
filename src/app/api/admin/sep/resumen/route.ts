/**
 * 2026-10-07 - Beca SEP: contadores para el inicio del panel (aviso de pendientes).
 */
import { NextResponse } from 'next/server';
import { requireAdminSep } from '@/lib/sep/admin';
import { respuestaError } from '@/lib/sep/http';
import { listarSep } from '@/lib/sep/servicio';

export async function GET() {
  const auth = await requireAdminSep();
  if (!auth.ok) return auth.response;
  try {
    const todas = await listarSep(auth.admin);
    const n = (e: string) => todas.filter((s) => s.estado === e).length;
    return NextResponse.json({
      disponible: true,
      enviadas: n('enviada'),
      correccion: n('correccion'),
      aplicadas: n('aplicada'),
    });
  } catch (err) {
    return respuestaError(err, 'GET /api/admin/sep/resumen');
  }
}
