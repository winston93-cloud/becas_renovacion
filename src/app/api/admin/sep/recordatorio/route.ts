/**
 * 2026-10-12 - Beca SEP: Control Escolar envía el recordatorio "falta subir su documento" a una familia
 * que contestó en el cuestionario que ya recibió la beca. Máximo uno por alumno cada 7 días.
 */
import { NextResponse } from 'next/server';
import { requireAdminSep } from '@/lib/sep/admin';
import { respuestaError } from '@/lib/sep/http';
import { enviarRecordatorioDocumento } from '@/lib/sep/recordatorioDocumento';

export async function POST(request: Request) {
  const auth = await requireAdminSep();
  if (!auth.ok) return auth.response;
  try {
    const body = (await request.json().catch(() => ({}))) as { alumnoRef?: unknown };
    const ref = Number(body.alumnoRef);
    if (!Number.isInteger(ref) || ref <= 0) return NextResponse.json({ error: 'No. de control inválido.' }, { status: 400 });
    const r = await enviarRecordatorioDocumento(auth.admin, ref);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ ok: true, detalle: r.detalle, enviadoEn: r.enviadoEn });
  } catch (e) {
    return respuestaError(e, 'recordatorio documento');
  }
}
