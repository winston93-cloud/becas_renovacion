import { NextRequest, NextResponse } from 'next/server';
import { assertNivelPermitido, requireAdmin } from '@/lib/admin-auth';
import {
  fetchAlumnosByNivel,
  listPedidosAccesoSolicitud,
  mapAlumnoRow,
} from '@/lib/admin-queries';
import { getInsforgeAdmin } from '@/lib/insforge-server';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const sp = request.nextUrl.searchParams;
    const q = (sp.get('q') || '').trim();
    const soloPendientes = sp.get('pendientes') !== '0' && !q;

    let items;
    if (soloPendientes && !q) {
      items = await listPedidosAccesoSolicitud(auth.admin);
    } else {
      let alumnos = await fetchAlumnosByNivel(auth.admin.niveles);
      if (q) {
        const needle = q.toLowerCase();
        alumnos = alumnos.filter((a) => {
          const ref = String(a.alumno_ref || '');
          const nombre =
            `${a.alumno_app || ''} ${a.alumno_apm || ''} ${a.alumno_nombre || ''}`.toLowerCase();
          return ref.includes(needle) || nombre.includes(needle);
        });
      }
      items = alumnos.map(mapAlumnoRow);
    }

    items = items
      .sort((a, b) => {
        // Primero quienes pidieron acceso y aún no tienen permiso
        const pa =
          a.acceso_enviada && !a.permiso_solicitud
            ? 0
            : a.acceso_enviada
              ? 1
              : 2;
        const pb =
          b.acceso_enviada && !b.permiso_solicitud
            ? 0
            : b.acceso_enviada
              ? 1
              : 2;
        if (pa !== pb) return pa - pb;
        return Number(a.alumno_ref) - Number(b.alumno_ref);
      })
      .slice(0, 300);

    return NextResponse.json({
      total: items.length,
      pendientes_autorizar: items.filter(
        (i) => i.acceso_enviada && !i.permiso_solicitud
      ).length,
      items,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Error al listar permisos.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const body = await request.json().catch(() => ({}));
    const alumnoId = Number(body.alumno_id);
    const permiso = body.permiso_solicitud;

    if (!Number.isFinite(alumnoId) || alumnoId <= 0) {
      return NextResponse.json(
        { error: 'alumno_id inválido.' },
        { status: 400 }
      );
    }
    if (typeof permiso !== 'boolean') {
      return NextResponse.json(
        { error: 'permiso_solicitud debe ser boolean.' },
        { status: 400 }
      );
    }

    const db = getInsforgeAdmin();
    const { data: alumno, error } = await db.database
      .from('alumno')
      .select('alumno_id, alumno_nivel')
      .eq('alumno_id', alumnoId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!alumno) {
      return NextResponse.json(
        { error: 'Alumno no encontrado.' },
        { status: 404 }
      );
    }

    const forbid = assertNivelPermitido(auth.admin, alumno.alumno_nivel);
    if (forbid) return forbid;

    const { data: updated, error: upErr } = await db.database
      .from('alumno')
      .update({
        alumno_permiso_solicitud_beca: permiso,
        // Si se autoriza, limpia bandera de “esperando respuesta”
        ...(permiso
          ? { alumno_solicitud_acceso_enviada: false }
          : {}),
      })
      .eq('alumno_id', alumnoId)
      .select(
        'alumno_id, alumno_permiso_solicitud_beca, alumno_solicitud_acceso_enviada'
      )
      .maybeSingle();

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, alumno: updated });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Error al actualizar permiso.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
