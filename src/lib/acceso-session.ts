/**
 * 2026-07-22 - Sesión de acceso en el navegador (sessionStorage).
 * El token nunca va en la URL; solo No. de Control en query.
 */
'use client';

const ACCESO_HEADER = 'x-becas-acceso';
const TOKEN_KEY = 'becas_acceso_token';
const REF_KEY = 'becas_acceso_ref';

export function saveAccesoSession(token: string, alumnoRef: string) {
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(REF_KEY, alumnoRef.trim());
  } catch {
    // sessionStorage puede fallar en modo privado estricto
  }
}

export function clearAccesoSession() {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(REF_KEY);
  } catch {
    // ignore
  }
}

export function getAccesoToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getAccesoRef(): string | null {
  try {
    return sessionStorage.getItem(REF_KEY);
  } catch {
    return null;
  }
}

/** true si hay token y coincide con el alumno_ref de la página. */
export function hasAccesoForRef(alumnoRef: string): boolean {
  const token = getAccesoToken();
  const ref = getAccesoRef();
  if (!token || !ref) return false;
  return ref.trim() === alumnoRef.trim();
}

export function accesoHeaders(
  extra?: HeadersInit
): Record<string, string> {
  const token = getAccesoToken();
  const base: Record<string, string> = {};
  if (token) base[ACCESO_HEADER] = token;
  if (extra) {
    const h = new Headers(extra);
    h.forEach((v, k) => {
      base[k] = v;
    });
  }
  return base;
}

/** fetch con header de acceso. */
export async function fetchConAcceso(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const headers = new Headers(init?.headers || {});
  const token = getAccesoToken();
  if (token) headers.set(ACCESO_HEADER, token);
  return fetch(input, { ...init, headers });
}
