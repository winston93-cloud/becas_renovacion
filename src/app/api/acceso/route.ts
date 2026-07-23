/**
 * 2026-07-22 - Login familiar: valida alumno_ref + alumno_clave → token.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getInsforgeAdmin } from '@/lib/insforge-server';
import {
  clavesCoinciden,
  createAccesoToken,
} from '@/lib/acceso-token';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      alumno_ref?: string | number;
      alumno_clave?: string;
    };

    const refRaw = String(body.alumno_ref ?? '').trim();
    const clave = String(body.alumno_clave ?? '');

    if (!/^\d+$/.test(refRaw)) {
      return NextResponse.json(
        { error: 'Ingrese un número de control válido.', codigo: 'REF_INVALIDA' },
        { status: 400 }
      );
    }
    if (!clave) {
      return NextResponse.json(
        { error: 'Ingrese la contraseña.', codigo: 'CLAVE_REQUERIDA' },
        { status: 400 }
      );
    }

    const alumnoRef = Number(refRaw);
    const admin = getInsforgeAdmin();

    const { data: alumno, error: alumnoErr } = await admin.database
      .from('alumno')
      .select('alumno_id, alumno_ref, alumno_status')
      .eq('alumno_ref', alumnoRef)
      .maybeSingle();

    if (alumnoErr) throw alumnoErr;
    if (!alumno) {
      return NextResponse.json(
        {
          error: 'Número de control o contraseña incorrectos.',
          codigo: 'CREDENCIALES_INVALIDAS',
        },
        { status: 401 }
      );
    }

    const { data: detalle, error: detErr } = await admin.database
      .from('alumno_detalles')
      .select('alumno_clave')
      .eq('alumno_id', alumno.alumno_id)
      .maybeSingle();

    if (detErr) throw detErr;

    if (!clavesCoinciden(clave, detalle?.alumno_clave as string | null)) {
      return NextResponse.json(
        {
          error: 'Número de control o contraseña incorrectos.',
          codigo: 'CREDENCIALES_INVALIDAS',
        },
        { status: 401 }
      );
    }

    const token = createAccesoToken(
      Number(alumno.alumno_ref),
      Number(alumno.alumno_id)
    );

    return NextResponse.json({
      ok: true,
      token,
      alumno_ref: String(alumno.alumno_ref),
      alumno_id: Number(alumno.alumno_id),
    });
  } catch (err) {
    console.error('[api/acceso]', err);
    return NextResponse.json(
      { error: 'No se pudo iniciar sesión. Intente de nuevo.' },
      { status: 500 }
    );
  }
}
