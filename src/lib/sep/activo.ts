/**
 * 2026-10-10 - Interruptor de Beca SEP para familias.
 * NEXT_PUBLIC_BECAS_SEP_ACTIVO=1 abre el trámite a todas las familias (tarjeta en el inicio y /sep).
 * Apagado: solo los No. de control de BECAS_SEP_REFS_PRUEBA pueden tramitar, y todos los correos del
 * trámite van al buzón de prueba (BECAS_EMAIL_TO). El panel de admin siempre está disponible.
 * Cambiar la variable en Vercel requiere un redeploy (NEXT_PUBLIC_* se fija al compilar).
 */
import { esModoLocalSoloLectura } from '@/lib/modo-local';

/** Alumno de prueba "PRUEBA LAURA PRUEBA" (no es un alumno real). */
const REFS_PRUEBA_POR_DEFECTO = [29905];

export function sepAbiertoAFamilias(): boolean {
  return process.env.NEXT_PUBLIC_BECAS_SEP_ACTIVO === '1';
}

export function refsPruebaSep(): number[] {
  const crudo = process.env.BECAS_SEP_REFS_PRUEBA?.trim();
  if (!crudo) return REFS_PRUEBA_POR_DEFECTO;
  return crudo
    .split(',')
    .map((x) => Number(x.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
}

/** La familia de este alumno puede usar el trámite (siempre en modo local). */
export function familiaPuedeUsarSep(alumnoRef: number): boolean {
  return esModoLocalSoloLectura() || sepAbiertoAFamilias() || refsPruebaSep().includes(alumnoRef);
}

/** Con el interruptor apagado ningún correo del trámite sale a familias ni a coordinaciones reales. */
export function correosSepSoloPrueba(): boolean {
  return process.env.BECAS_EMAIL_FORCE_TEST === '1' || !sepAbiertoAFamilias();
}

export function buzonPruebaSep(): string {
  return process.env.BECAS_EMAIL_TO?.trim() || 'sistemas3@winston93.edu.mx';
}

export const MENSAJE_SEP_NO_DISPONIBLE =
  'El trámite de Beca SEP todavía no está disponible. Le avisaremos cuando pueda subir su documento.';
