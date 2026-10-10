/**
 * 2026-10-07 - Beca SEP (familia): sube el documento de autorización y lo lee automáticamente.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAcceso } from '@/lib/acceso-auth';
import { subirDocumento } from '@/lib/sep/servicio';
import { respuestaError, vistaFamilia } from '@/lib/sep/http';
import { MAX_BYTES_DOCUMENTO_SEP, MENSAJE_LIMITE_DOCUMENTO_SEP } from '@/lib/sep/tipos';

// 2026-10-09 - Margen para los campos del formulario además del archivo.
const MARGEN_FORMULARIO = 64 * 1024;

// 2026-10-08 - Fotos y escaneos pasan por OCR (hasta ~45 s en el peor caso).
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const auth = requireAcceso(request);
  if (!auth.ok) return auth.response;
  // 2026-10-09 - Si el envío completo ya pasa de 5 MB se rechaza sin leer el archivo.
  const largo = Number(request.headers.get('content-length') ?? 0);
  if (largo > MAX_BYTES_DOCUMENTO_SEP + MARGEN_FORMULARIO) {
    return NextResponse.json({ error: MENSAJE_LIMITE_DOCUMENTO_SEP }, { status: 413 });
  }
  try {
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Falta el archivo.' }, { status: 400 });
    }
    // 2026-10-08 - La familia debe confirmar el aviso de pérdida de otras becas (casilla en pantalla).
    const r = await subirDocumento(auth.acceso.alumno_ref, file, form.get('acepta_aviso') === '1');
    return NextResponse.json({ ok: true, solicitud: vistaFamilia(r.solicitud) });
  } catch (err) {
    return respuestaError(err, 'POST /api/sep/documento');
  }
}
