/**
 * 2026-07-22 - Extrae y valida el token de acceso en Route Handlers.
 */
import { NextRequest, NextResponse } from 'next/server';
import { ACCESO_HEADER, verifyAccesoToken } from '@/lib/acceso-token';

export type AccesoAuth = {
  alumno_ref: number;
  alumno_id: number;
};

function unauthorized(message?: string) {
  return NextResponse.json(
    {
      error:
        message ||
        'Debe iniciar sesión con número de control y contraseña.',
      codigo: 'NO_AUTENTICADO',
    },
    { status: 401 }
  );
}

/** Lee el token del header X-Becas-Acceso o Authorization Bearer. */
export function readAccesoToken(req: NextRequest): string | null {
  const header = req.headers.get(ACCESO_HEADER);
  if (header?.trim()) return header.trim();
  const auth = req.headers.get('authorization');
  if (auth?.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim() || null;
  }
  return null;
}

/**
 * Exige token válido. Si se pasa alumnoRef esperado, debe coincidir.
 */
export function requireAcceso(
  req: NextRequest,
  alumnoRefEsperado?: number | null
): { ok: true; acceso: AccesoAuth } | { ok: false; response: NextResponse } {
  const token = readAccesoToken(req);
  const payload = verifyAccesoToken(token);
  if (!payload) {
    return { ok: false, response: unauthorized() };
  }
  if (
    alumnoRefEsperado != null &&
    Number(alumnoRefEsperado) !== Number(payload.alumno_ref)
  ) {
    return {
      ok: false,
      response: unauthorized(
        'La sesión no corresponde a este número de control.'
      ),
    };
  }
  return {
    ok: true,
    acceso: {
      alumno_ref: payload.alumno_ref,
      alumno_id: payload.alumno_id,
    },
  };
}

/** Tras cargar la fila, confirma que pertenece al alumno de la sesión. */
export function forbidWrongAlumno(
  acceso: AccesoAuth,
  alumnoId: number | null | undefined
): NextResponse | null {
  if (alumnoId == null || Number(acceso.alumno_id) !== Number(alumnoId)) {
    return NextResponse.json(
      {
        error: 'No tiene permiso para este trámite.',
        codigo: 'NO_AUTORIZADO',
      },
      { status: 403 }
    );
  }
  return null;
}
