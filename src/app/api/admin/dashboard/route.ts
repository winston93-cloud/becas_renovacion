import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import {
  contarRenovacionesRevision,
  contarSolicitudesRevision,
  listPedidosAccesoSolicitud,
  listRenovaciones,
  listSolicitudes,
} from '@/lib/admin-queries';
import {
  getCicloBecaARenovar,
  getCurrentSchoolCycle,
  getSchoolCycleLabel,
} from '@/lib/ciclo-escolar';

export const maxDuration = 60;

function mensajeErrorApi(err: unknown): string {
  const raw = err instanceof Error ? err.message : 'Error en dashboard admin.';
  if (raw.includes('<html>') || raw.includes('502 Bad Gateway')) {
    return 'El servidor de datos no respondió. Espere unos segundos e intente de nuevo.';
  }
  return raw.length > 280 ? `${raw.slice(0, 280)}…` : raw;
}

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const cicloRen = getCicloBecaARenovar();
    const cicloSol = getCurrentSchoolCycle();

    const [renovaciones, solicitudes, pedidosAcceso] = await Promise.all([
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
      listPedidosAccesoSolicitud(auth.admin),
    ]);

    const renEnviadas = renovaciones.filter((r) => r.correo_enviado);
    const solEnviadas = solicitudes.filter((s) => s.enviado);
    const accesoPendientes = pedidosAcceso.filter(
      (a) => a.acceso_enviada && !a.permiso_solicitud
    );
    // Solo cuentan autorizaciones con historial de pedido de acceso.
    const accesoAutorizados = pedidosAcceso.filter(
      (a) => a.permiso_solicitud && Boolean(a.acceso_enviada_en)
    );

    const renRevision = await contarRenovacionesRevision(
      renEnviadas.map((r) => ({ id: r.id, verificado: r.verificado }))
    );

    const solRevision = await contarSolicitudesRevision(
      solEnviadas.map((s) => ({ id: s.id, verificado: s.verificado }))
    );

    return NextResponse.json({
      role: auth.admin.role,
      label: auth.admin.label,
      niveles: auth.admin.niveles,
      ciclo_renovacion: cicloRen,
      ciclo_renovacion_label: getSchoolCycleLabel(cicloSol),
      titulo_renovacion: `Renovación de becas ${getSchoolCycleLabel(cicloSol)}`,
      ciclo_solicitud: cicloSol,
      ciclo_solicitud_label: getSchoolCycleLabel(cicloSol),
      renovaciones: {
        total: renEnviadas.length,
        pendientes: renRevision.pendientes,
        correccion_documentos: renRevision.correccion_documentos,
        verificadas: renEnviadas.filter((r) => r.verificado).length,
        autorizadas: renEnviadas.filter((r) => r.beca_autorizada).length,
      },
      solicitudes: {
        total: solEnviadas.length,
        pendientes: solRevision.pendientes,
        correccion_documentos: solRevision.correccion_documentos,
        verificadas: solEnviadas.filter((s) => s.verificado).length,
        autorizadas: solEnviadas.filter((s) => s.beca_autorizada).length,
      },
      /** Pedidos de acceso al formulario (antes de enviar la solicitud). */
      accesos: {
        pendientes: accesoPendientes.length,
        autorizados: accesoAutorizados.length,
        total: pedidosAcceso.length,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: mensajeErrorApi(err) }, { status: 500 });
  }
}
