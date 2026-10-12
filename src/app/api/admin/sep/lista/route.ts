/**
 * 2026-10-12 - Beca SEP: Excel o PDF de las filas visibles en la lista de Control Escolar.
 * Recibe solo ids y orden; los datos se leen de nuevo y se limitan al nivel de quien exporta.
 */
import { NextResponse } from 'next/server';
import { requireAdminSep } from '@/lib/sep/admin';
import { respuestaError } from '@/lib/sep/http';
import { cicloSep, listarSep } from '@/lib/sep/servicio';
import { excelListaSep, filaExportSep, pdfListaSep } from '@/lib/sep/exportLista';
import { getSchoolCycleLabel } from '@/lib/ciclo-escolar';

export async function POST(request: Request) {
  const auth = await requireAdminSep();
  if (!auth.ok) return auth.response;
  try {
    const body = (await request.json().catch(() => ({}))) as { formato?: unknown; ids?: unknown; filtro?: unknown };
    const formato = body.formato === 'pdf' ? 'pdf' : body.formato === 'excel' ? 'excel' : null;
    if (!formato) return NextResponse.json({ error: 'Formato inválido.' }, { status: 400 });
    const ids = Array.isArray(body.ids) ? body.ids.map(String).slice(0, 3000) : [];
    if (!ids.length) return NextResponse.json({ error: 'No hay filas visibles para exportar.' }, { status: 400 });

    const porId = new Map((await listarSep(auth.admin)).map((s) => [s.id, s]));
    const filas = ids.flatMap((id) => {
      const s = porId.get(id);
      return s ? [filaExportSep(s)] : [];
    });
    const meta = {
      titulo: `Ciclo ${getSchoolCycleLabel(cicloSep())}`,
      area: auth.admin.label,
      filtro: String(body.filtro ?? '—').slice(0, 120),
    };
    const sello = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    const nombre = `beca-sep-${sello}.${formato === 'excel' ? 'xlsx' : 'pdf'}`;
    const archivo = formato === 'excel' ? await excelListaSep(filas, meta) : await pdfListaSep(filas, meta);
    return new NextResponse(new Uint8Array(archivo), {
      headers: {
        'Content-Type':
          formato === 'excel' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/pdf',
        'Content-Disposition': `attachment; filename="${nombre}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err) {
    return respuestaError(err, 'POST /api/admin/sep/lista');
  }
}
