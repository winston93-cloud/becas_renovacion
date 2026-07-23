/**
 * 2026-07-22 - Token firmado de acceso familiar (No. Control + clave).
 * Sustituye el acceso solo por ?alumno_ref= sin contraseña.
 */
import { createHmac, timingSafeEqual } from 'crypto';

const TTL_MS = 8 * 60 * 60 * 1000; // 8 horas

type AccesoPayload = {
  alumno_ref: number;
  alumno_id: number;
  exp: number;
};

function getSecret(): string {
  const secret =
    process.env.ACCESO_TOKEN_SECRET ||
    process.env.INSFORGE_API_KEY ||
    '';
  if (!secret) {
    throw new Error(
      'Falta ACCESO_TOKEN_SECRET o INSFORGE_API_KEY para firmar el acceso.'
    );
  }
  return secret;
}

function sign(payloadB64: string): string {
  return createHmac('sha256', getSecret())
    .update(payloadB64)
    .digest('base64url');
}

export function createAccesoToken(
  alumnoRef: number,
  alumnoId: number
): string {
  const payload: AccesoPayload = {
    alumno_ref: alumnoRef,
    alumno_id: alumnoId,
    exp: Date.now() + TTL_MS,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${payloadB64}.${sign(payloadB64)}`;
}

export function verifyAccesoToken(
  token: string | null | undefined
): AccesoPayload | null {
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
    const raw = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf8')
    ) as AccesoPayload;
    if (
      !raw ||
      typeof raw.alumno_ref !== 'number' ||
      typeof raw.alumno_id !== 'number' ||
      typeof raw.exp !== 'number'
    ) {
      return null;
    }
    if (Date.now() > raw.exp) return null;
    return raw;
  } catch {
    return null;
  }
}

/** Comparación de clave en texto plano (igual que el legacy PHP). */
export function clavesCoinciden(
  enviada: string,
  almacenada: string | null | undefined
): boolean {
  if (almacenada == null || almacenada === '') return false;
  const a = Buffer.from(enviada);
  const b = Buffer.from(String(almacenada));
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export const ACCESO_HEADER = 'x-becas-acceso';
