/**
 * 2026-10-07 - Lectura del documento de autorización SEP.
 * Interfaz `LectorDocumento` para cambiar de lector sin tocar las APIs.
 * 2026-10-08 - PDF con texto → unpdf (rápido). Foto o PDF escaneado → OCR con Tesseract (open source,
 *              en nuestro servidor). Si el OCR falla o tarda demasiado, queda para revisión a mano.
 */
import 'server-only';
import { analizarTexto, documentoIlegible, MIN_CARACTERES_TEXTO } from '@/lib/sep/reglasDocumento';
import { LIMITE_OCR_MS, ocrImagen, ocrPdfEscaneado, type ResultadoOcr } from '@/lib/sep/ocrDocumento';
import type { DeteccionDocumento } from '@/lib/sep/tipos';
// 2026-10-09 - El tope bajó de 10 MB a 5 MB; vive en tipos.ts para usarlo también en la pantalla.
export { MAX_BYTES_DOCUMENTO_SEP } from '@/lib/sep/tipos';

export const TIPOS_DOCUMENTO_SEP = ['application/pdf', 'image/jpeg', 'image/png'] as const;

export interface LectorDocumento {
  leer(bytes: Buffer, tipo: string, nombreAlumno: string): Promise<DeteccionDocumento>;
}

async function textoPdf(bytes: Buffer): Promise<string> {
  const { extractText } = await import('unpdf');
  const { text } = await extractText(new Uint8Array(bytes), { mergePages: true });
  return Array.isArray(text) ? text.join('\n') : String(text ?? '');
}

/** El OCR nunca debe trabar la subida: con error o pasado el límite, revisión a mano. */
async function conLimite(trabajo: Promise<ResultadoOcr>): Promise<ResultadoOcr | null> {
  let reloj: ReturnType<typeof setTimeout> | undefined;
  const tiempo = new Promise<null>((ok) => {
    reloj = setTimeout(() => ok(null), LIMITE_OCR_MS + 5_000);
  });
  const seguro = trabajo.catch((e) => {
    console.error('[sep] OCR falló', e);
    return null;
  });
  try {
    return await Promise.race([seguro, tiempo]);
  } finally {
    clearTimeout(reloj);
  }
}

class LectorSep implements LectorDocumento {
  async leer(bytes: Buffer, tipo: string, nombreAlumno: string) {
    if (tipo === 'application/pdf') {
      let texto: string;
      try {
        texto = await textoPdf(bytes);
      } catch {
        return documentoIlegible('El PDF no se pudo abrir (puede estar dañado o protegido).');
      }
      if (texto.replace(/\s+/g, ' ').trim().length >= MIN_CARACTERES_TEXTO) return analizarTexto(texto, nombreAlumno);
      return this.leerOcr(ocrPdfEscaneado(bytes), nombreAlumno, 'El PDF parece escaneado y no se pudo leer.');
    }
    return this.leerOcr(ocrImagen(bytes), nombreAlumno, 'No se pudo leer la foto automáticamente.');
  }

  private async leerOcr(trabajo: Promise<ResultadoOcr>, nombreAlumno: string, siFalla: string) {
    const r = await conLimite(trabajo);
    if (!r) return documentoIlegible(siFalla);
    console.info(`[sep] OCR ${r.ms} ms, confianza ${Math.round(r.confianza)}`);
    return analizarTexto(r.texto, nombreAlumno, 'ocr');
  }
}

export function getLectorDocumento(): LectorDocumento {
  return new LectorSep();
}
