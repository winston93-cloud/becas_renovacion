/**
 * 2026-10-07 - Beca SEP (familia): envía el trámite a Control Escolar.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAcceso } from '@/lib/acceso-auth';
import { enviarSolicitud } from '@/lib/sep/servicio';
import { respuestaError, vistaFamilia } from '@/lib/sep/http';

export async function POST(request: NextRequest) {
  const auth = requireAcceso(request);
  if (!auth.ok) return auth.response;
  try {
    const s = await enviarSolicitud(auth.acceso.alumno_ref);
    return NextResponse.json({ ok: true, solicitud: vistaFamilia(s) });
  } catch (err) {
    return respuestaError(err, 'POST /api/sep/enviar');
  }
}
