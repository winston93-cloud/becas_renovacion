/**
 * 2026-07-24 - Auth Control Escolar en Route Handlers y Server Components.
 */
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  ADMIN_COOKIE,
  ADMIN_ROLES,
  type AdminRole,
} from '@/lib/admin-roles';
import { verifyAdminSessionValue } from '@/lib/admin-session';

export type AdminAuth = {
  role: AdminRole;
  label: string;
  niveles: number[];
};

export async function readAdminAuth(): Promise<AdminAuth | null> {
  const jar = await cookies();
  const raw = jar.get(ADMIN_COOKIE)?.value;
  const payload = verifyAdminSessionValue(raw);
  if (!payload) return null;
  const meta = ADMIN_ROLES[payload.role];
  return {
    role: payload.role,
    label: meta.label,
    niveles: meta.niveles,
  };
}

export async function requireAdmin(): Promise<
  { ok: true; admin: AdminAuth } | { ok: false; response: NextResponse }
> {
  const admin = await readAdminAuth();
  if (!admin) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: 'Debe iniciar sesión en Control Escolar.',
          codigo: 'NO_AUTENTICADO',
        },
        { status: 401 }
      ),
    };
  }
  return { ok: true, admin };
}

/** El alumno_nivel debe estar dentro de los niveles del rol. */
export function assertNivelPermitido(
  admin: AdminAuth,
  nivel: number | null | undefined
): NextResponse | null {
  const n = nivel == null ? NaN : Number(nivel);
  if (!Number.isFinite(n) || !admin.niveles.includes(n)) {
    return NextResponse.json(
      {
        error: 'No tiene permiso para este nivel escolar.',
        codigo: 'NIVEL_NO_AUTORIZADO',
      },
      { status: 403 }
    );
  }
  return null;
}
