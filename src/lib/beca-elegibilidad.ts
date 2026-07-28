/**
 * 2026-07-28 - Criterio de trámite:
 * - Renovación: solo si hubo beca activa el ciclo pasado (calendario − 1).
 * - Solicitud nueva: si NO tuvo beca el ciclo pasado (aunque haya tenido
 *   antepasado o antes). Historial antiguo no obliga a renovar.
 */
import { getCicloBecaARenovar } from '@/lib/ciclo-escolar';

/**
 * Misma regla que el gate de `/api/renovacion`:
 * beca_estatus = 1 en getCicloBecaARenovar().
 */
export async function tieneBecaActivaCicloPasado(
  // Cliente InsForge database (admin)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  database: any,
  alumnoId: number
): Promise<{ ok: true; tiene: boolean; ciclo: number } | { ok: false; error: string }> {
  const ciclo = getCicloBecaARenovar();
  const { data, error } = await database
    .from('alumno_beca')
    .select('alumno_beca_id')
    .eq('alumno_id', alumnoId)
    .eq('beca_ciclo_escolar', ciclo)
    .eq('beca_estatus', 1)
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, tiene: Boolean(data), ciclo };
}
