/**
 * 2026-10-13 - Tope real de los PDFs de solicitud y renovación.
 * Vercel rechaza cuerpos de más de 4.5 MB antes de llegar a la API (413), así que el
 * límite útil es 4 MB y se avisa al papá desde que elige el archivo.
 */
export const MAX_PDF_MB = 4;
export const MAX_PDF_BYTES = MAX_PDF_MB * 1024 * 1024;

export function mbTexto(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

export function mensajePdfExcedido(bytes?: number): string {
  const pesa =
    bytes != null
      ? `El PDF pesa ${mbTexto(bytes)} MB; el máximo es ${MAX_PDF_MB} MB.`
      : `El PDF supera el máximo de ${MAX_PDF_MB} MB.`;
  return `${pesa} Escanéelo con menos hojas o redúzcalo (por ejemplo en ilovepdf.com, «Comprimir PDF») y vuelva a subirlo.`;
}
