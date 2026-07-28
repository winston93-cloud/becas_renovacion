/**
 * Listado de bitácora Control Escolar (filtrado por niveles del rol).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getInsforgeAdmin } from '@/lib/insforge-server';
import { etiquetaAccionAuditoria } from '@/lib/admin-auditoria';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const sp = request.nextUrl.searchParams;
    const q = (sp.get('q') || '').trim();
    const accion = (sp.get('accion') || '').trim();
    const limitRaw = Number(sp.get('limit') || 80);
    const limit = Math.min(200, Math.max(10, Number.isFinite(limitRaw) ? limitRaw : 80));

    const db = getInsforgeAdmin();
    let query = db.database
      .from('becas_admin_auditoria')
      .select(
        'id, created_at, actor_role, actor_label, accion, entidad, entidad_id, alumno_id, alumno_ref, alumno_nombre, alumno_nivel, detalle, ip, user_agent'
      )
      .order('created_at', { ascending: false })
      .limit(limit);

    // Login/logout del propio rol + movimientos de alumnos de sus niveles.
    // Filtramos en memoria por niveles para no perder eventos de sesión.
    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const niveles = new Set(auth.admin.niveles);
    let items = (data || []).filter((row) => {
      if (row.entidad === 'sesion') {
        return row.actor_role === auth.admin.role;
      }
      if (row.alumno_nivel == null) return row.actor_role === auth.admin.role;
      return niveles.has(Number(row.alumno_nivel));
    });

    if (accion) {
      items = items.filter((r) => String(r.accion) === accion);
    }
    if (q) {
      const needle = q.toLowerCase();
      items = items.filter((r) => {
        const blob = [
          r.alumno_ref,
          r.alumno_nombre,
          r.actor_label,
          r.accion,
          r.entidad_id,
          r.ip,
        ]
          .map((x) => String(x || '').toLowerCase())
          .join(' ');
        return blob.includes(needle);
      });
    }

    return NextResponse.json({
      total: items.length,
      items: items.map((r) => ({
        ...r,
        accion_label: etiquetaAccionAuditoria(String(r.accion)),
      })),
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Error al cargar bitácora.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
