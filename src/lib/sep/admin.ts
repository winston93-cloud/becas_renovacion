/**
 * 2026-10-07 - Sesión de Control Escolar / Sistemas para el trámite Beca SEP.
 */
import 'server-only';
import { NextResponse } from 'next/server';
import { readAdminAuth } from '@/lib/admin-auth';
import { esRolSistemas } from '@/lib/admin-roles';
import type { AdminSep } from '@/lib/sep/servicio';

export type AdminSepSesion = AdminSep & { label: string; esSistemas: boolean };

export async function leerAdminSep(): Promise<AdminSepSesion | null> {
  const a = await readAdminAuth();
  if (!a) return null;
  return { role: a.role, niveles: a.niveles, label: a.label, esSistemas: esRolSistemas(a.role) };
}

export async function requireAdminSep(
  soloSistemas = false
): Promise<{ ok: true; admin: AdminSepSesion } | { ok: false; response: NextResponse }> {
  const admin = await leerAdminSep();
  if (!admin) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Debe iniciar sesión en Control Escolar.', codigo: 'NO_AUTENTICADO' }, { status: 401 }),
    };
  }
  if (soloSistemas && !admin.esSistemas) {
    // 2026-10-09 - El rol "sistemas" se muestra como Dirección General.
    return { ok: false, response: NextResponse.json({ error: 'Solo Dirección General puede hacer esto.' }, { status: 403 }) };
  }
  return { ok: true, admin };
}
