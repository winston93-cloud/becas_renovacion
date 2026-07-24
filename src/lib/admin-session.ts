/**
 * 2026-07-24 - Cookie firmada de sesión Control Escolar (HMAC).
 * Valor: payloadB64.sig — no se puede falsificar el rol.
 */
import { createHmac, timingSafeEqual } from 'crypto';
import type { AdminRole } from '@/lib/admin-roles';
import { isAdminRole } from '@/lib/admin-roles';

type AdminPayload = {
  role: AdminRole;
  exp: number;
};

function getSecret(): string {
  const secret =
    process.env.ADMIN_TOKEN_SECRET ||
    process.env.ACCESO_TOKEN_SECRET ||
    process.env.INSFORGE_API_KEY ||
    '';
  if (!secret) {
    throw new Error(
      'Falta ADMIN_TOKEN_SECRET o ACCESO_TOKEN_SECRET para firmar la sesión admin.'
    );
  }
  return secret;
}

function sign(payloadB64: string): string {
  return createHmac('sha256', getSecret())
    .update(payloadB64)
    .digest('base64url');
}

export function createAdminSessionValue(
  role: AdminRole,
  maxAgeSec: number
): string {
  const payload: AdminPayload = {
    role,
    exp: Date.now() + maxAgeSec * 1000,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${payloadB64}.${sign(payloadB64)}`;
}

export function verifyAdminSessionValue(
  token: string | null | undefined
): AdminPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;
  if (!payloadB64 || !sig) return null;

  const expected = sign(payloadB64);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  try {
    const json = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf8')
    ) as AdminPayload;
    if (!isAdminRole(json.role)) return null;
    if (!json.exp || Date.now() > Number(json.exp)) return null;
    return { role: json.role, exp: Number(json.exp) };
  } catch {
    return null;
  }
}
