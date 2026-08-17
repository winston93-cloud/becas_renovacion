/**
 * Presentación de alumno_grado según nivel (BD numérico → etiqueta legible).
 * Maternal: 1 = Maternal A, 2 = Maternal B.
 * Solo para UI / PDF / correo; no cambia el valor en BD.
 */

export function labelGrado(
  nivel: number | string | null | undefined,
  grado: number | string | null | undefined
): string {
  if (grado == null || grado === '') return '—';
  const g = Number(grado);
  if (!Number.isFinite(g)) return '—';

  const n = Number(nivel);
  if (!Number.isFinite(n)) return String(g);

  if (n === 1) {
    if (g === 1) return 'Maternal A';
    if (g === 2) return 'Maternal B';
  }
  if (n === 2) {
    if (g === 1) return 'Kinder-1';
    if (g === 2) return 'Kinder-2';
    if (g === 3) return 'Kinder-3';
  }
  if (n === 3) {
    if (g >= 1 && g <= 6) return `${g}° de Primaria`;
  }
  if (n === 4) {
    if (g === 1) return '7mo';
    if (g === 2) return '8vo';
    if (g === 3) return '9no';
  }

  return String(g);
}

/** Grado + grupo legibles, p. ej. "Maternal B / A". */
export function labelGradoGrupo(
  nivel: number | string | null | undefined,
  grado: number | string | null | undefined,
  grupo: number | string | null | undefined,
  labelGrupoFn: (g: number | string | null | undefined) => string
): string {
  const g = labelGrado(nivel, grado);
  const gr = labelGrupoFn(grupo);
  return [g, gr].filter((p) => p && p !== '—').join(' / ') || '—';
}
