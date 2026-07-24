import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { listRenovaciones, listSolicitudes } from '@/lib/admin-queries';
import {
  getCicloBecaARenovar,
  getCurrentSchoolCycle,
  getSchoolCycleLabel,
} from '@/lib/ciclo-escolar';

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const cicloRen = getCicloBecaARenovar();
    const cicloSol = getCurrentSchoolCycle();

    const [renovaciones, solicitudes] = await Promise.all([
      listRenovaciones({
        admin: auth.admin,
        ciclo: cicloRen,
        estado: 'todas',
      }),
      listSolicitudes({
        admin: auth.admin,
        ciclo: cicloSol,
        estado: 'todas',
      }),
    ]);

    const renEnviadas = renovaciones.filter((r) => r.correo_enviado);
    const solEnviadas = solicitudes.filter((s) => s.enviado);

    return NextResponse.json({
      role: auth.admin.role,
      label: auth.admin.label,
      niveles: auth.admin.niveles,
      ciclo_renovacion: cicloRen,
      ciclo_renovacion_label: getSchoolCycleLabel(cicloRen),
      ciclo_solicitud: cicloSol,
      ciclo_solicitud_label: getSchoolCycleLabel(cicloSol),
      renovaciones: {
        total: renEnviadas.length,
        pendientes: renEnviadas.filter((r) => !r.verificado).length,
        verificadas: renEnviadas.filter((r) => r.verificado).length,
        autorizadas: renEnviadas.filter((r) => r.beca_autorizada).length,
      },
      solicitudes: {
        total: solEnviadas.length,
        pendientes: solEnviadas.filter((s) => !s.verificado).length,
        verificadas: solEnviadas.filter((s) => s.verificado).length,
        autorizadas: solEnviadas.filter((s) => s.beca_autorizada).length,
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Error en dashboard admin.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
