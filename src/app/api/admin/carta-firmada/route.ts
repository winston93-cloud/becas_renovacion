/**
 * GET: PDF de la carta ya firmada por el padre (activación de beca).
 * Query: flujo, expediente_id
 */
import { NextRequest, NextResponse } from 'next/server';
import { assertNivelPermitido, requireAdmin } from '@/lib/admin-auth';
import { getInsforgeAdmin } from '@/lib/insforge-server';
import { obtenerFirmaElectronicaExpediente } from '@/lib/firma-electronica-estado';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const flujo = request.nextUrl.searchParams.get('flujo')?.trim() || '';
    const expedienteId =
      request.nextUrl.searchParams.get('expediente_id')?.trim() || '';

    if (!expedienteId || (flujo !== 'renovacion' && flujo !== 'solicitud')) {
      return NextResponse.json(
        { error: 'Parámetros inválidos (flujo, expediente_id).' },
        { status: 400 }
      );
    }

    const db = getInsforgeAdmin();
    const parentTable =
      flujo === 'renovacion' ? 'becas_renovacion' : 'becas_solicitud';
    const { data: parent } = await db.database
      .from(parentTable)
      .select('alumno_id')
      .eq('id', expedienteId)
      .maybeSingle();

    if (!parent) {
      return NextResponse.json(
        { error: 'Expediente no encontrado.' },
        { status: 404 }
      );
    }

    const alumnoId = Number(parent.alumno_id);
    const { data: alumno } = await db.database
      .from('alumno')
      .select('alumno_nivel')
      .eq('alumno_id', alumnoId)
      .maybeSingle();

    const forbid = assertNivelPermitido(auth.admin, alumno?.alumno_nivel);
    if (forbid) return forbid;

    const firma = await obtenerFirmaElectronicaExpediente({
      flujo: flujo as 'solicitud' | 'renovacion',
      expedienteId,
      alumnoId,
    });

    if (!firma.beca_activada || !firma.carta_firmada_key) {
      return NextResponse.json(
        { error: 'El padre aún no ha firmado / activado la beca.' },
        { status: 404 }
      );
    }

    const bucket = firma.carta_firmada_bucket || 'becas-documentos';
    const { data, error } = await db.storage
      .from(bucket)
      .download(firma.carta_firmada_key);

    if (error || !data) {
      return NextResponse.json(
        {
          error: error?.message || 'No se pudo leer la carta firmada en Storage.',
        },
        { status: 502 }
      );
    }

    const pdfBytes = await data.arrayBuffer();
    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition':
          'inline; filename="carta-aceptacion-beca-firmada.pdf"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Error al cargar carta firmada.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
