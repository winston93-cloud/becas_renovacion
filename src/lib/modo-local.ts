/**
 * 2026-10-07 - Modo local seguro (rama beca-sep).
 * Con BECAS_LOCAL_SOLO_LECTURA=1 InsForge queda en solo lectura y el correo no sale.
 * Nunca se activa en Vercel aunque alguien copie la variable.
 */

export function esModoLocalSoloLectura(): boolean {
  return process.env.BECAS_LOCAL_SOLO_LECTURA === '1' && process.env.VERCEL !== '1';
}

/** Clave de prueba para entrar como familia en local (vacía fuera de modo local). */
export function clavePruebaLocal(): string | null {
  if (!esModoLocalSoloLectura()) return null;
  const clave = process.env.BECAS_LOCAL_CLAVE_PRUEBA?.trim();
  return clave && clave.length >= 8 ? clave : null;
}
