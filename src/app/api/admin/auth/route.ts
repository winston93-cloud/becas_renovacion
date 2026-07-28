/**
 * 2026-07-24 - Login Control Escolar: rol + PIN (bcrypt), estilo AgendaW.
 */
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import bcrypt from 'bcrypt';
import {
  ADMIN_COOKIE,
  COOKIE_MAX_AGE,
  getPinHash,
  isAdminRole,
  type AdminRole,
  ADMIN_ROLES,
} from '@/lib/admin-roles';
import { createAdminSessionValue } from '@/lib/admin-session';
import {
  clientMetaFromRequest,
  registrarAuditoria,
} from '@/lib/admin-auditoria';
import { readAdminAuth } from '@/lib/admin-auth';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const roleRaw = String(body.role || '').trim();
    const pin = String(body.pin || '');

    if (!isAdminRole(roleRaw)) {
      return NextResponse.json({ error: 'Nivel inválido.' }, { status: 400 });
    }
    const role = roleRaw as AdminRole;

    if (!pin) {
      return NextResponse.json(
        { error: 'Ingrese la clave de acceso.' },
        { status: 400 }
      );
    }

    const hash = getPinHash(role);
    if (!hash) {
      return NextResponse.json(
        {
          error:
            'Clave no configurada para este nivel. Contacte a sistemas.',
        },
        { status: 500 }
      );
    }

    const ok = await bcrypt.compare(pin, hash);
    if (!ok) {
      return NextResponse.json(
        { error: 'Clave incorrecta.' },
        { status: 401 }
      );
    }

    const value = createAdminSessionValue(role, COOKIE_MAX_AGE);
    const jar = await cookies();
    jar.set(ADMIN_COOKIE, value, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: COOKIE_MAX_AGE,
      path: '/',
    });

    const meta = clientMetaFromRequest(request);
    await registrarAuditoria(
      {
        role,
        label: ADMIN_ROLES[role].label,
        niveles: ADMIN_ROLES[role].niveles,
      },
      {
        accion: 'login',
        entidad: 'sesion',
        detalle: { role },
        ...meta,
      }
    );

    return NextResponse.json({
      ok: true,
      role,
      label: ADMIN_ROLES[role].label,
      niveles: ADMIN_ROLES[role].niveles,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Error al iniciar sesión.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  const jar = await cookies();
  const raw = jar.get(ADMIN_COOKIE)?.value;
  const { verifyAdminSessionValue } = await import('@/lib/admin-session');
  const payload = verifyAdminSessionValue(raw);
  if (!payload) {
    return NextResponse.json({ role: null });
  }
  return NextResponse.json({
    role: payload.role,
    label: ADMIN_ROLES[payload.role].label,
    niveles: ADMIN_ROLES[payload.role].niveles,
  });
}

export async function DELETE(request: Request) {
  const admin = await readAdminAuth();
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE);
  if (admin) {
    const meta = clientMetaFromRequest(request);
    await registrarAuditoria(admin, {
      accion: 'logout',
      entidad: 'sesion',
      ...meta,
    });
  }
  return NextResponse.json({ ok: true });
}
