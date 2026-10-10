/**
 * 2026-10-07 - Beca SEP: acciones sobre un trámite.
 *   aplicar     (Control Escolar)  { accion: 'aplicar', porcentaje }
 *   correccion  (Control Escolar)  { accion: 'correccion', motivo }
 *   recalcular  (Dirección General) { accion: 'recalcular' }
 *   ajuste      (Dirección General) { accion: 'ajuste', monto, motivo }  monto vacío = quitar ajuste
 *   avisar_pago (Control Escolar)  { accion: 'avisar_pago' }  2026-10-09: correo a la familia por pagos de menos / de más
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSep } from '@/lib/sep/admin';
import { respuestaError } from '@/lib/sep/http';
import { ajusteManualSep, aplicarSep, avisarPagoSep, pedirCorreccionSep, recalcularSep } from '@/lib/sep/servicio';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const accion = String(body.accion ?? '');
  const soloSistemas = accion === 'recalcular' || accion === 'ajuste';
  const auth = await requireAdminSep(soloSistemas);
  if (!auth.ok) return auth.response;
  const id = (await params).id;
  try {
    const s =
      accion === 'aplicar'
        ? await aplicarSep(auth.admin, id, body.porcentaje)
        : accion === 'correccion'
          ? await pedirCorreccionSep(auth.admin, id, body.motivo)
          : accion === 'recalcular'
            ? await recalcularSep(auth.admin, id)
            : accion === 'ajuste'
              ? await ajusteManualSep(auth.admin, id, body.monto, body.motivo)
              : accion === 'avisar_pago'
                ? await avisarPagoSep(auth.admin, id)
                : null;
    if (!s) return NextResponse.json({ error: 'Acción no válida.' }, { status: 400 });
    return NextResponse.json({ ok: true, estado: s.estado });
  } catch (err) {
    return respuestaError(err, `POST /api/admin/sep/[id] ${accion}`);
  }
}
