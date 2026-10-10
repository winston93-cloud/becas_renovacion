/**
 * 2026-10-08 - OCR open source (Tesseract, Apache 2.0) para fotos y PDF escaneados del documento SEP.
 * Todo corre en nuestro servidor: el idioma español viene en @tesseract.js-data/spa (no se descarga nada).
 * Solo convierte la imagen en texto; las reglas de reglasDocumento.ts deciden nombre y porcentaje.
 */
import 'server-only';
import path from 'node:path';
import sharp from 'sharp';
import { createWorker, OEM, PSM, type Worker } from 'tesseract.js';

/** Modelo "best_int": ~2 MB, solo LSTM; buen balance entre precisión y velocidad. */
const RUTA_IDIOMA = path.join(process.cwd(), 'node_modules/@tesseract.js-data/spa/4.0.0_best_int');
/**
 * Ancho al que se lleva la imagen antes de leerla. Solo se agrandan imágenes muy chicas: al agrandar
 * de más, el modo automático de Tesseract deja de encontrar los renglones.
 */
const ANCHO_MIN = 1000;
const ANCHO_MAX = 2600;
/** Páginas del PDF escaneado que se leen (la autorización SEP es de 1 o 2 hojas). */
const MAX_PAGINAS = 2;
/** Confianza (0-100) a partir de la cual no se prueban otras orientaciones. */
const CONFIANZA_BUENA = 70;
/** Tiempo máximo de lectura; si se pasa, el documento queda para revisión a mano. */
export const LIMITE_OCR_MS = 40_000;

export type ResultadoOcr = { texto: string; confianza: number; ms: number };

let trabajador: Promise<Worker> | null = null;

/** Un solo worker por instancia del servidor: cargarlo cuesta ~1 s, leer después es más rápido. */
function obtenerTrabajador(): Promise<Worker> {
  if (!trabajador) {
    trabajador = (async () => {
      const w = await createWorker('spa', OEM.LSTM_ONLY, {
        langPath: RUTA_IDIOMA,
        gzip: true,
        // En Vercel el disco es de solo lectura: no guardar copia del idioma.
        cacheMethod: 'none',
      });
      // Las fotos suelen traer 72 dpi o ninguno; se fija 300 porque la imagen ya se escala en prepararImagen.
      await w.setParameters({ preserve_interword_spaces: '1', user_defined_dpi: '300' });
      return w;
    })().catch((e) => {
      trabajador = null;
      throw e;
    });
  }
  return trabajador;
}

/** Libera el worker (pruebas o apagado del servidor). */
export async function cerrarOcr(): Promise<void> {
  const w = trabajador;
  trabajador = null;
  if (w) await (await w).terminate();
}

/** Endereza (EXIF), pasa a gris, ajusta tamaño y contraste: lo que más mejora a Tesseract con fotos. */
export async function prepararImagen(entrada: sharp.Sharp, girar = 0): Promise<Buffer> {
  const base = entrada.rotate().flatten({ background: '#ffffff' }).grayscale();
  const girada = girar ? sharp(await base.png().toBuffer()).rotate(girar) : base;
  const { width = ANCHO_MIN } = await girada.clone().metadata();
  const ancho = Math.min(Math.max(width, ANCHO_MIN), ANCHO_MAX);
  return girada.resize({ width: ancho }).normalize().sharpen().png().toBuffer();
}

/**
 * Modos de acomodo de Tesseract: automático (documentos escaneados con columnas) y "texto disperso"
 * (fotos: hoja chueca con fondo alrededor, donde el automático a veces no encuentra nada).
 */
const MODOS = [PSM.AUTO, PSM.SPARSE_TEXT];

async function leerImagen(imagen: Buffer, modo: PSM): Promise<{ texto: string; confianza: number }> {
  const w = await obtenerTrabajador();
  await w.setParameters({ tessedit_pageseg_mode: modo });
  const { data } = await w.recognize(imagen, { rotateAuto: true });
  return { texto: data.text ?? '', confianza: data.confidence ?? 0 };
}

const esBuena = (r: { texto: string; confianza: number }) =>
  r.confianza >= CONFIANZA_BUENA && r.texto.replace(/\s+/g, ' ').trim().length >= 40;

/**
 * Lee una imagen probando modos y orientaciones (fotos de lado o de cabeza sin datos EXIF) y se queda
 * con la de mayor confianza. Se detiene en cuanto una lectura es buena.
 */
async function leerConOrientaciones(origen: () => sharp.Sharp, limite: number): Promise<{ texto: string; confianza: number }> {
  let mejor = { texto: '', confianza: 0 };
  for (const giro of [0, 90, 270, 180]) {
    const imagen = await prepararImagen(origen(), giro);
    for (const modo of MODOS) {
      if (Date.now() > limite) return mejor;
      const r = await leerImagen(imagen, modo);
      if (r.confianza > mejor.confianza) mejor = r;
      if (esBuena(mejor)) return mejor;
    }
  }
  return mejor;
}

/** Foto JPG/PNG → texto. */
export async function ocrImagen(bytes: Buffer): Promise<ResultadoOcr> {
  const inicio = Date.now();
  const r = await leerConOrientaciones(() => sharp(bytes), inicio + LIMITE_OCR_MS);
  return { ...r, ms: Date.now() - inicio };
}

/**
 * PDF escaneado → texto. Un escaneo es un PDF con una imagen grande por hoja: se toma la imagen más
 * grande de cada página (sin dibujar el PDF, así no hace falta una librería de canvas).
 */
export async function ocrPdfEscaneado(bytes: Buffer): Promise<ResultadoOcr> {
  const inicio = Date.now();
  const limite = inicio + LIMITE_OCR_MS;
  const { getDocumentProxy, extractImages } = await import('unpdf');
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const textos: string[] = [];
  const confianzas: number[] = [];
  for (let pagina = 1; pagina <= Math.min(pdf.numPages, MAX_PAGINAS); pagina++) {
    if (Date.now() > limite) break;
    const imagenes = await extractImages(pdf, pagina);
    const grande = imagenes.sort((a, b) => b.width * b.height - a.width * a.height)[0];
    if (!grande || grande.width < 300 || grande.height < 300) continue;
    const raw = { width: grande.width, height: grande.height, channels: grande.channels };
    const r = await leerConOrientaciones(() => sharp(Buffer.from(grande.data), { raw }), limite);
    textos.push(r.texto);
    confianzas.push(r.confianza);
  }
  const confianza = confianzas.length ? confianzas.reduce((a, b) => a + b, 0) / confianzas.length : 0;
  return { texto: textos.join('\n'), confianza, ms: Date.now() - inicio };
}
