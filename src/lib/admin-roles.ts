/**
 * 2026-07-24 - Roles de Control Escolar (panel admin becas).
 * Un rol = un nivel escolar (MK agrupa maternal+kinder).
 */

export const ADMIN_COOKIE = 'becas_ce_session';
export const COOKIE_MAX_AGE = 60 * 60 * 12; // 12 horas

export type AdminRole = 'ce_mk' | 'ce_pri' | 'ce_sec';

export const ADMIN_ROLES: Record<
  AdminRole,
  { label: string; niveles: number[]; short: string }
> = {
  ce_mk: {
    label: 'Maternal y Kinder',
    short: 'MK',
    niveles: [1, 2],
  },
  ce_pri: {
    label: 'Primaria',
    short: 'Primaria',
    niveles: [3],
  },
  ce_sec: {
    label: 'Secundaria',
    short: 'Secundaria',
    niveles: [4],
  },
};

export const VALID_ADMIN_ROLES = Object.keys(ADMIN_ROLES) as AdminRole[];

export function isAdminRole(value: string | null | undefined): value is AdminRole {
  return !!value && (VALID_ADMIN_ROLES as string[]).includes(value);
}

/** Hash bcrypt en env por rol (la clave en claro solo la tiene Control Escolar). */
export function pinHashEnvKey(role: AdminRole): string {
  if (role === 'ce_mk') return 'ADMIN_PIN_HASH_MK';
  if (role === 'ce_pri') return 'ADMIN_PIN_HASH_PRI';
  return 'ADMIN_PIN_HASH_SEC';
}

export function getPinHash(role: AdminRole): string | undefined {
  return process.env[pinHashEnvKey(role)]?.trim() || undefined;
}
