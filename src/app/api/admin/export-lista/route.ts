import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import type { AdminExportPayload, AdminExportRow } from '@/lib/admin-export-lista';
import { buildListaRevisionExcel } from '@/lib/excel/lista-revision';
import { buildListaRevisionPdf } from '@/lib/pdf/lista-revision';

function sanitizeRows(raw: unknown): AdminExportRow[] {
  if (!Array.isArray(raw)) return [];
  const out: AdminExportRow[] = [];
  for (const item of raw.slice(0, 3000)) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    out.push({
      alumno_ref: String(r.alumno_ref ?? ''),
      nombre: String(r.nombre ?? ''),
      nivel_label: String(r.nivel_label ?? ''),
      grado:
        r.grado == null ||
        String(r.grado).trim() === '' ||
        String(r.grado).toLowerCase() === 'nan'
          ? null
          : typeof r.grado === 'number'
            ? Number.isFinite(r.grado)
              ? r.grado
              : null
            : String(r.grado),
      grupo: String(r.grupo ?? ''),
      enviado: Boolean(r.enviado),
      enviado_en: r.enviado_en ? String(r.enviado_en) : null,
      verificado: Boolean(r.verificado),
      beca_autorizada: Boolean(r.beca_autorizada),
      beca_rechazada: Boolean(r.beca_rechazada),
      beca_activada: Boolean(r.beca_activada),
      firmado_por: r.firmado_por ? String(r.firmado_por) : null,
      beca_activada_en: r.beca_activada_en ? String(r.beca_activada_en) : null,
    });
  }
  return out;
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Cuerpo inválido.' }, { status: 400 });
    }

    const formato = body.formato === 'pdf' ? 'pdf' : body.formato === 'excel' ? 'excel' : null;
    const flujo =
      body.flujo === 'renovacion' || body.flujo === 'solicitud'
        ? body.flujo
        : null;
    if (!formato || !flujo) {
      return NextResponse.json(
        { error: 'formato y flujo son requeridos.' },
        { status: 400 }
      );
    }

    const payload: AdminExportPayload = {
      flujo,
      formato,
      titulo: String(body.titulo || 'Listado').slice(0, 200),
      filtro_label: String(body.filtro_label || '—').slice(0, 120),
      ciclo_label: body.ciclo_label ? String(body.ciclo_label).slice(0, 80) : undefined,
      rows: sanitizeRows(body.rows),
    };

    const stamp = new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:T]/g, '-');
    const baseName =
      flujo === 'renovacion'
        ? `renovaciones-revision-${stamp}`
        : `solicitudes-revision-${stamp}`;

    if (formato === 'excel') {
      const buf = await buildListaRevisionExcel(payload);
      return new NextResponse(new Uint8Array(buf), {
        status: 200,
        headers: {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${baseName}.xlsx"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    const pdf = await buildListaRevisionPdf(payload);
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${baseName}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'No se pudo generar el archivo.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
