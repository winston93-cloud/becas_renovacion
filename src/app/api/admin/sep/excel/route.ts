/**
 * 2026-10-07 - Beca SEP (Sistemas): Excel con fórmulas de todos los cálculos del ciclo.
 */
import { NextResponse } from 'next/server';
import { requireAdminSep } from '@/lib/sep/admin';
import { respuestaError } from '@/lib/sep/http';
import { excelSistemas } from '@/lib/sep/reporte';

export async function GET() {
  const auth = await requireAdminSep(true);
  if (!auth.ok) return auth.response;
  try {
    const { nombre, buffer } = await excelSistemas(auth.admin.label);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${nombre}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err) {
    return respuestaError(err, 'GET /api/admin/sep/excel');
  }
}
